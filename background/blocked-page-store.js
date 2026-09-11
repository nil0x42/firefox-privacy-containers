import { showNotification } from "./notifications.js";
import { FIREFOX_DEFAULT_CONTAINER } from "../domain/containers.js";
import { createId } from "../domain/ids.js";
import { canReopenTabUrl } from "../domain/tabs.js";
import { isRecord, normalizeText } from "../domain/values.js";

export function createBlockedPageStore(deps) {
    const {
      Shared,
      state,
      browser,
      constants,
      containerCache,
      tabActions,
    } = deps;
    const pendingAutoReopenAttempts = new Set();

    function getCurrentHostRuleDecision(url, cookieStoreId) {
      const target = Shared.parseRequestTarget(url);
      const hostRuleRuntime = state.runtime && state.runtime.hostRuleRuntime;
      if (!target || !hostRuleRuntime) {
        return null;
      }

      return {
        decision: Shared.getHostRuleDecisionForNormalizedHost(
          hostRuleRuntime,
          target.host,
          cookieStoreId,
        ),
      };
    }

    function isContainerCurrentlyAllowed(entry, cookieStoreId) {
      const current = getCurrentHostRuleDecision(
        entry && entry.url,
        cookieStoreId,
      );
      return Boolean(
        current &&
          (!current.decision || current.decision.decision !== "block"),
      );
    }

    function buildAutoReopenAttemptKey(details, cookieStoreId) {
      return [
        details.tabId,
        details.requestId || "",
        cookieStoreId,
        details.url,
      ].join("\u0001");
    }

    async function showAutoReopenNotification(decision, cookieStoreId) {
      const container = containerCache.getContainerDescriptor(cookieStoreId);
      const containerName = container?.name || "the allowed container";
      const ruleName = decision?.ruleName || "this Host Rule";

      await showNotification(browser, {
        id: "auto-reopen",
        title: `Link reopened in ${containerName}`,
        message: `Privacy Containers automatically reopened this link in "${containerName}" because the Host Rule "${ruleName}" only allows this host in that container.`,
      });
    }

    function isUsableContainerSnapshot(container) {
      return (
        isRecord(container) &&
        typeof container.cookieStoreId === "string" &&
        Boolean(container.cookieStoreId) &&
        typeof container.name === "string" &&
        Boolean(container.name)
      );
    }

    function isUsableStoredEntry(entry) {
      return (
        isRecord(entry) &&
        typeof entry.id === "string" &&
        Boolean(entry.id) &&
        Number.isFinite(entry.createdAt) &&
        (entry.tabId === null || Number.isInteger(entry.tabId)) &&
        typeof entry.url === "string" &&
        (entry.mode === "blacklist" || entry.mode === "whitelist") &&
        isUsableContainerSnapshot(entry.blockedContainer) &&
        Array.isArray(entry.allowedContainers) &&
        entry.allowedContainers.every(isUsableContainerSnapshot)
      );
    }

    function getStorageKey(entryId) {
      return `${constants.BLOCKED_PAGE_STORAGE_PREFIX}${entryId}`;
    }

    function parseStoredEntries(payload) {
      const entries = [];
      const invalidKeys = [];

      Object.entries(payload || {}).forEach(([key, entry]) => {
        if (!key.startsWith(constants.BLOCKED_PAGE_STORAGE_PREFIX)) {
          return;
        }
        if (isUsableStoredEntry(entry) && key === getStorageKey(entry.id)) {
          entries.push({ key, entry });
          return;
        }
        invalidKeys.push(key);
      });

      return { entries, invalidKeys };
    }

    async function cleanupPersistedEntries(now) {
      const staleThreshold =
        (Number.isFinite(now) ? now : Date.now()) -
        constants.BLOCKED_PAGE_ENTRY_TTL_MS;
      const parsed = parseStoredEntries(await browser.storage.session.get(null));
      const storedEntries = parsed.entries.sort(
        (left, right) => left.entry.createdAt - right.entry.createdAt,
      );
      const retained = storedEntries.filter(
        ({ entry }) => entry.createdAt >= staleThreshold,
      );
      const excessCount = Math.max(
        0,
        retained.length - constants.BLOCKED_PAGE_MAX_ENTRIES,
      );
      const keysToRemove = [
        ...parsed.invalidKeys,
        ...storedEntries
          .filter(({ entry }) => entry.createdAt < staleThreshold)
          .map(({ key }) => key),
        ...retained.slice(0, excessCount).map(({ key }) => key),
      ];

      if (keysToRemove.length) {
        await browser.storage.session.remove(keysToRemove);
      }
    }

    async function persistBlockedPageEntry(entry) {
      if (!isUsableStoredEntry(entry)) {
        return;
      }
      await browser.storage.session.set({ [getStorageKey(entry.id)]: entry });
      await cleanupPersistedEntries();
    }

    async function removePersistedBlockedPageEntry(entryId) {
      if (!entryId) {
        return;
      }

      await browser.storage.session.remove(getStorageKey(entryId));
    }

    async function removePersistedBlockedPageEntriesForTab(tabId) {
      if (typeof tabId !== "number") {
        return;
      }

      const keys = parseStoredEntries(
        await browser.storage.session.get(null),
      ).entries
        .filter(({ entry }) => entry.tabId === tabId)
        .map(({ key }) => key);
      if (keys.length) {
        await browser.storage.session.remove(keys);
      }
    }

    async function loadPersistedBlockedPageEntry(entryId) {
      if (!entryId) {
        return null;
      }

      const key = getStorageKey(entryId);
      const payload = await browser.storage.session.get(key);
      const entry = payload[key];
      if (
        !isUsableStoredEntry(entry) ||
        entry.createdAt + constants.BLOCKED_PAGE_ENTRY_TTL_MS <= Date.now()
      ) {
        if (Object.hasOwn(payload, key)) {
          await browser.storage.session.remove(key);
        }
        return null;
      }
      if (entry) {
        state.blockedPageEntries.set(entryId, entry);
      }
      return entry || null;
    }

    function createBlockedPageEntryId() {
      return createId("blocked");
    }

    function cleanupBlockedPageEntries(now) {
      const effectiveNow = Number.isFinite(now) ? now : Date.now();
      const staleThreshold =
        effectiveNow - constants.BLOCKED_PAGE_ENTRY_TTL_MS;

      state.blockedPageEntries.forEach((entry, entryId) => {
        if (!entry || entry.createdAt < staleThreshold) {
          state.blockedPageEntries.delete(entryId);
        }
      });

      while (state.blockedPageEntries.size > constants.BLOCKED_PAGE_MAX_ENTRIES) {
        const oldestEntryId = state.blockedPageEntries.keys().next().value;
        if (!oldestEntryId) {
          break;
        }

        state.blockedPageEntries.delete(oldestEntryId);
      }
    }

    async function createBlockedPageEntry(decision, details) {
      cleanupBlockedPageEntries();

      const entryId = createBlockedPageEntryId();
      const allowedContainers = [];

      if (decision.mode === "blacklist") {
        for (
          let index = 0;
          index < decision.allowedContainerIdsForBlockedPage.length;
          index += 1
        ) {
          const descriptor = containerCache.getContainerDescriptor(
            decision.allowedContainerIdsForBlockedPage[index],
          );
          if (descriptor.missing) {
            continue;
          }

          allowedContainers.push({
            ...descriptor,
            actionLabel: `Continue in ${descriptor.name}`,
          });
        }
      }

      state.blockedPageEntries.set(entryId, {
        id: entryId,
        ruleId: decision.ruleId,
        ruleName: decision.ruleName,
        mode: decision.mode,
        host: decision.host,
        url: details.url,
        blockedContainer: containerCache.getContainerDescriptor(
          decision.cookieStoreId,
        ),
        allowedContainers,
        tabId: typeof details.tabId === "number" ? details.tabId : null,
        createdAt: Date.now(),
      });
      cleanupBlockedPageEntries();
      try {
        await persistBlockedPageEntry(state.blockedPageEntries.get(entryId));
        return entryId;
      } catch (error) {
        state.blockedPageEntries.delete(entryId);
        throw error;
      }
    }

    async function getBlockedPageEntry(entryId) {
      cleanupBlockedPageEntries();
      return (
        state.blockedPageEntries.get(entryId) ||
        (await loadPersistedBlockedPageEntry(entryId))
      );
    }

    async function removeBlockedPageEntriesForTab(tabId) {
      if (typeof tabId !== "number") {
        return;
      }

      state.blockedPageEntries.forEach((entry, entryId) => {
        if (entry && entry.tabId === tabId) {
          state.blockedPageEntries.delete(entryId);
        }
      });

      await removePersistedBlockedPageEntriesForTab(tabId);
    }

    function buildBlockedPageUrl(entryId) {
      const params = new URLSearchParams({
        entry: entryId,
      });

      return `${browser.runtime.getURL(constants.BLOCKED_PAGE_PATH)}?${params.toString()}`;
    }

    async function createBlockedPageRedirect(decision, details) {
      const entryId = await createBlockedPageEntry(decision, details);
      return {
        redirectUrl: buildBlockedPageUrl(entryId),
      };
    }

    async function getBlockedPageContextPayload(message) {
      const entryId = normalizeText(message && message.entry);
      const entry = await getBlockedPageEntry(entryId);

      if (!entry) {
        return null;
      }

      const ambiguousContainerIds = containerCache.getAmbiguousContainerIdSet();
      const allowedContainers = [];
      const unavailableAllowedContainers = [];
      const noLongerAllowedContainers = [];

      for (let index = 0; index < entry.allowedContainers.length; index += 1) {
        const container = entry.allowedContainers[index];
        if (containerCache.isContainerAvailable(container.cookieStoreId)) {
          const decorated = containerCache.decorateContainerDescriptor(
            container,
            ambiguousContainerIds,
          );
          if (isContainerCurrentlyAllowed(entry, container.cookieStoreId)) {
            allowedContainers.push(decorated);
          } else {
            noLongerAllowedContainers.push(decorated);
          }
          continue;
        }

        unavailableAllowedContainers.push(
          containerCache.decorateContainerDescriptor(
            container,
            ambiguousContainerIds,
          ),
        );
      }

      return {
        entry: entry.id,
        ruleId: entry.ruleId,
        ruleName: entry.ruleName,
        mode: entry.mode,
        host: entry.host,
        url: entry.url,
        container: containerCache.decorateContainerDescriptor(
          entry.blockedContainer,
          ambiguousContainerIds,
        ),
        allowedContainers,
        unavailableAllowedContainers,
        noLongerAllowedContainers,
      };
    }

    function getUniqueAvailableAllowedContainerId(decision, details) {
      if (
        !decision ||
        decision.mode !== "blacklist" ||
        !canReopenTabUrl(details && details.url)
      ) {
        return "";
      }

      const availableContainerIds = Array.from(
        new Set(
          (Array.isArray(decision.allowedContainerIdsForBlockedPage)
            ? decision.allowedContainerIdsForBlockedPage
            : []
          ).filter((cookieStoreId) =>
            containerCache.isContainerAvailable(cookieStoreId),
          ),
        ),
      );

      return availableContainerIds.length === 1 ? availableContainerIds[0] : "";
    }

    async function reopenBlockedMainFrameInContainer(details, cookieStoreId) {
      if (
        typeof details.tabId !== "number"
      ) {
        throw new Error("The blocked tab could not be reopened automatically.");
      }

      const referenceTab = await browser.tabs.get(details.tabId);
      if (!referenceTab || typeof referenceTab.id !== "number") {
        throw new Error("The blocked tab no longer exists.");
      }

      return tabActions.replaceTabInContainer(cookieStoreId, referenceTab, {
        url: details.url,
        index:
          typeof referenceTab.index === "number"
            ? referenceTab.index
            : undefined,
        pinned: Boolean(referenceTab.pinned),
      });
    }

    function handleAutoReopenBlockedMainFrame(decision, details) {
      const initialTargetCookieStoreId = getUniqueAvailableAllowedContainerId(
        decision,
        details,
      );
      if (!initialTargetCookieStoreId || typeof details.tabId !== "number") {
        return false;
      }

      const attemptKey = buildAutoReopenAttemptKey(
        details,
        initialTargetCookieStoreId,
      );
      if (pendingAutoReopenAttempts.has(attemptKey)) {
        return false;
      }

      pendingAutoReopenAttempts.add(attemptKey);

      return Promise.resolve()
        .then(async () => {
          const current = getCurrentHostRuleDecision(
            details.url,
            decision.cookieStoreId,
          );
          if (!current) {
            return { cancel: true };
          }
          if (!current.decision || current.decision.decision !== "block") {
            return {};
          }

          const targetCookieStoreId = getUniqueAvailableAllowedContainerId(
            current.decision,
            details,
          );
          if (!targetCookieStoreId) {
            return createBlockedPageRedirect(current.decision, details);
          }

          try {
            await reopenBlockedMainFrameInContainer(details, targetCookieStoreId);
          } catch (error) {
            if (error && error.code !== "TAB_REPLACEMENT_ROLLBACK_FAILED") {
              try {
                return await createBlockedPageRedirect(
                  current.decision,
                  details,
                );
              } catch (navigationError) {
                console.error(
                  "Failed to fall back to the blocked page after auto-reopen failure",
                  navigationError,
                );
              }
            }
            console.error("Failed to auto-reopen blocked navigation", error);
            return { cancel: true };
          }
          await showAutoReopenNotification(
            current.decision,
            targetCookieStoreId,
          ).catch((error) => {
            console.error("Failed to show auto-reopen notification", error);
          });
          return { cancel: true };
        })
        .catch((error) => {
          console.error("Failed to auto-reopen blocked navigation", error);
          return { cancel: true };
        })
        .finally(() => {
          pendingAutoReopenAttempts.delete(attemptKey);
        });
    }

    async function openBlockedUrlInContainer(message, sender) {
      const entryId = normalizeText(message && message.entry);
      const cookieStoreId =
        normalizeText(message && message.cookieStoreId) ||
        FIREFOX_DEFAULT_CONTAINER;
      const referenceTab = sender && sender.tab ? sender.tab : null;
      const entry = await getBlockedPageEntry(entryId);

      if (!entry) {
        throw new Error("The blocked navigation context expired.");
      }

      if (
        !referenceTab ||
        typeof referenceTab.id !== "number" ||
        referenceTab.id !== entry.tabId
      ) {
        throw new Error("This action is only valid from the matching blocked tab.");
      }

      if (entry.mode !== "blacklist" || !entry.allowedContainers.length) {
        throw new Error("This blocked navigation cannot be reopened automatically.");
      }

      if (
        !entry.allowedContainers.some(
          (container) => container.cookieStoreId === cookieStoreId,
        )
      ) {
        throw new Error("This container is not allowed for the blocked host.");
      }

      if (!containerCache.isContainerAvailable(cookieStoreId)) {
        throw new Error("The allowed container no longer exists.");
      }

      if (!canReopenTabUrl(entry.url)) {
        throw new Error("The blocked URL cannot be reopened in another container.");
      }

      if (!isContainerCurrentlyAllowed(entry, cookieStoreId)) {
        throw new Error(
          "This container is no longer allowed for the blocked host.",
        );
      }

      const createOverrides = {
        url: entry.url,
        index:
          typeof referenceTab.index === "number"
            ? referenceTab.index
            : undefined,
        pinned: Boolean(referenceTab && referenceTab.pinned),
      };
      const shouldReplaceBlockedTab =
        typeof referenceTab.url === "string" &&
        referenceTab.url.startsWith(
          browser.runtime.getURL(constants.BLOCKED_PAGE_PATH),
        );
      const createdTab = shouldReplaceBlockedTab
        ? await tabActions.replaceTabInContainer(
            cookieStoreId,
            referenceTab,
            createOverrides,
          )
        : await browser.tabs.create(
            tabActions.withContainer(
              tabActions.buildTabCreateProperties(referenceTab, createOverrides),
              cookieStoreId,
            ),
          );

      state.blockedPageEntries.delete(entryId);
      await removePersistedBlockedPageEntry(entryId).catch((error) => {
        console.error("Failed to remove consumed blocked navigation context", error);
      });

      return {
        ok: true,
        tabId: createdTab && createdTab.id,
      };
    }

    return {
      buildBlockedPageUrl,
      cleanupBlockedPageEntries,
      cleanupPersistedEntries,
      createBlockedPageEntry,
      createBlockedPageRedirect,
      getBlockedPageContextPayload,
      getBlockedPageEntry,
      handleAutoReopenBlockedMainFrame,
      openBlockedUrlInContainer,
      removeBlockedPageEntriesForTab,
    };
  }
