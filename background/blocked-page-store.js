export function createBlockedPageStore(deps) {
    const {
      state,
      browser,
      Shared,
      constants,
      containerCache,
      requestContextCache,
      tabActions,
    } = deps;
    const pendingStorageTasks = new Set();
    const autoReopenAttemptsByKey = new Map();
    const AUTO_REOPEN_GUARD_TTL_MS = 10000;
    const AUTO_REOPEN_NOTIFICATION_DURATION_MS = 6000;

    function trackStorageTask(task) {
      if (!task || typeof task.then !== "function") {
        return task;
      }

      pendingStorageTasks.add(task);
      task.finally(() => {
        pendingStorageTasks.delete(task);
      });
      return task;
    }

    async function flushPendingStorageTasks() {
      if (!pendingStorageTasks.size) {
        return;
      }

      await Promise.allSettled(Array.from(pendingStorageTasks));
    }

    function cleanupAutoReopenAttempts(now) {
      const effectiveNow = Number.isFinite(now) ? now : Date.now();
      autoReopenAttemptsByKey.forEach((createdAt, key) => {
        if (createdAt + AUTO_REOPEN_GUARD_TTL_MS <= effectiveNow) {
          autoReopenAttemptsByKey.delete(key);
        }
      });
    }

    function buildAutoReopenAttemptKey(url, cookieStoreId) {
      return `${cookieStoreId}\u0001${url}`;
    }

    async function showAutoReopenNotification(decision, cookieStoreId) {
      if (
        !browser.notifications ||
        typeof browser.notifications.create !== "function"
      ) {
        return;
      }

      const container = containerCache.getContainerDescriptor(cookieStoreId);
      const containerName = container?.name || "the allowed container";
      const ruleName = decision?.ruleName || "this Host Rule";
      const notificationId = `auto-reopen-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      await browser.notifications.create(notificationId, {
        type: "basic",
        iconUrl: browser.runtime.getURL("res/icon.png"),
        title: `Link reopened in ${containerName}`,
        message: `Privacy Containers automatically reopened this link in "${containerName}" because the Host Rule "${ruleName}" only allows this host in that container.`,
      });

      if (typeof browser.notifications.clear === "function") {
        const clearTimer = setTimeout(() => {
          browser.notifications.clear(notificationId).catch(() => undefined);
        }, AUTO_REOPEN_NOTIFICATION_DURATION_MS);
        if (typeof clearTimer?.unref === "function") {
          clearTimer.unref();
        }
      }
    }

    function getStoredEntriesValue(payload) {
      if (!payload || typeof payload !== "object") {
        return [];
      }

      const entries = payload[constants.BLOCKED_PAGE_STORAGE_KEY];
      return Array.isArray(entries) ? entries : [];
    }

    function isUsableStoredEntry(entry) {
      return (
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.createdAt === "number"
      );
    }

    function pruneEntryList(entries, now) {
      const effectiveNow = Number.isFinite(now) ? now : Date.now();
      const staleThreshold =
        effectiveNow - constants.BLOCKED_PAGE_ENTRY_TTL_MS;
      const filtered = (Array.isArray(entries) ? entries : []).filter(
        (entry) =>
          isUsableStoredEntry(entry) && entry.createdAt >= staleThreshold,
      );

      if (filtered.length <= constants.BLOCKED_PAGE_MAX_ENTRIES) {
        return filtered;
      }

      return filtered.slice(
        filtered.length - constants.BLOCKED_PAGE_MAX_ENTRIES,
      );
    }

    async function readStoredEntries() {
      if (
        !browser.storage ||
        !browser.storage.local ||
        typeof browser.storage.local.get !== "function"
      ) {
        return [];
      }

      const payload = await browser.storage.local.get(
        constants.BLOCKED_PAGE_STORAGE_KEY,
      );
      return getStoredEntriesValue(payload);
    }

    async function writeStoredEntries(entries) {
      if (
        !browser.storage ||
        !browser.storage.local ||
        typeof browser.storage.local.set !== "function"
      ) {
        return;
      }

      await browser.storage.local.set({
        [constants.BLOCKED_PAGE_STORAGE_KEY]: entries,
      });
    }

    async function persistBlockedPageEntry(entry) {
      if (!isUsableStoredEntry(entry)) {
        return;
      }

      const entries = await readStoredEntries();
      const nextEntries = pruneEntryList(
        entries.filter((storedEntry) => storedEntry.id !== entry.id).concat(entry),
      );
      await writeStoredEntries(nextEntries);
    }

    async function removePersistedBlockedPageEntry(entryId) {
      if (!entryId) {
        return;
      }

      const entries = await readStoredEntries();
      const nextEntries = pruneEntryList(
        entries.filter((entry) => entry.id !== entryId),
      );
      await writeStoredEntries(nextEntries);
    }

    async function removePersistedBlockedPageEntriesForTab(tabId) {
      if (typeof tabId !== "number") {
        return;
      }

      const entries = await readStoredEntries();
      const nextEntries = pruneEntryList(
        entries.filter((entry) => entry.tabId !== tabId),
      );
      await writeStoredEntries(nextEntries);
    }

    async function loadPersistedBlockedPageEntry(entryId) {
      if (!entryId) {
        return null;
      }

      await flushPendingStorageTasks();
      const storedEntries = await readStoredEntries();
      const entries = pruneEntryList(storedEntries);
      if (entries.length !== storedEntries.length) {
        await writeStoredEntries(entries);
      }
      const entry = entries.find((storedEntry) => storedEntry.id === entryId) || null;
      if (entry) {
        state.blockedPageEntries.set(entryId, entry);
      }
      return entry;
    }

    function createBlockedPageEntryId() {
      return `blocked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

    function createBlockedPageEntry(decision, details) {
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
      trackStorageTask(
        persistBlockedPageEntry(state.blockedPageEntries.get(entryId)),
      );

      cleanupBlockedPageEntries();
      return entryId;
    }

    async function getBlockedPageEntry(entryId) {
      cleanupBlockedPageEntries();
      return (
        state.blockedPageEntries.get(entryId) ||
        (await loadPersistedBlockedPageEntry(entryId))
      );
    }

    function removeBlockedPageEntriesForTab(tabId) {
      if (typeof tabId !== "number") {
        return;
      }

      state.blockedPageEntries.forEach((entry, entryId) => {
        if (entry && entry.tabId === tabId) {
          state.blockedPageEntries.delete(entryId);
        }
      });

      trackStorageTask(removePersistedBlockedPageEntriesForTab(tabId));
    }

    function buildBlockedPageUrl(entryId) {
      const params = new URLSearchParams({
        entry: entryId,
      });

      return `${browser.runtime.getURL(constants.BLOCKED_PAGE_PATH)}?${params.toString()}`;
    }

    async function getBlockedPageContextPayload(message) {
      const entryId = requestContextCache.normalizeMessageText(
        message && message.entry,
      );
      const entry = await getBlockedPageEntry(entryId);

      if (!entry) {
        return null;
      }

      const ambiguousContainerIds = containerCache.getAmbiguousContainerIdSet();
      const allowedContainers = [];
      const unavailableAllowedContainers = [];

      for (let index = 0; index < entry.allowedContainers.length; index += 1) {
        const container = entry.allowedContainers[index];
        if (containerCache.isContainerAvailable(container.cookieStoreId)) {
          allowedContainers.push(
            containerCache.decorateContainerDescriptor(
              container,
              ambiguousContainerIds,
            ),
          );
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
      };
    }

    function getUniqueAvailableAllowedContainerId(decision, details) {
      if (
        !decision ||
        decision.mode !== "blacklist" ||
        !Shared.canReopenTabUrl(details && details.url)
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

    async function navigateTabToBlockedPage(decision, details) {
      if (
        !browser.tabs ||
        typeof browser.tabs.update !== "function" ||
        typeof details.tabId !== "number"
      ) {
        return false;
      }

      const entryId = createBlockedPageEntry(decision, details);
      await browser.tabs.update(details.tabId, {
        url: buildBlockedPageUrl(entryId),
      });
      return true;
    }

    async function reopenBlockedMainFrameInContainer(details, cookieStoreId) {
      if (
        !browser.tabs ||
        typeof browser.tabs.get !== "function" ||
        typeof browser.tabs.create !== "function" ||
        typeof browser.tabs.remove !== "function" ||
        typeof details.tabId !== "number"
      ) {
        throw new Error("The blocked tab could not be reopened automatically.");
      }

      const referenceTab = await browser.tabs.get(details.tabId);
      if (!referenceTab || typeof referenceTab.id !== "number") {
        throw new Error("The blocked tab no longer exists.");
      }

      const createdTab = await browser.tabs.create(
        tabActions.withContainer(
          tabActions.buildTabCreateProperties(referenceTab, {
            url: details.url,
            index:
              typeof referenceTab.index === "number"
                ? referenceTab.index
                : undefined,
            pinned: Boolean(referenceTab.pinned),
          }),
          cookieStoreId,
        ),
      );
      await browser.tabs.remove(referenceTab.id);
      return createdTab;
    }

    function scheduleAutoReopenBlockedMainFrame(decision, details) {
      cleanupAutoReopenAttempts();

      const targetCookieStoreId = getUniqueAvailableAllowedContainerId(
        decision,
        details,
      );
      if (!targetCookieStoreId || typeof details.tabId !== "number") {
        return false;
      }

      const attemptKey = buildAutoReopenAttemptKey(
        details.url,
        targetCookieStoreId,
      );
      if (autoReopenAttemptsByKey.has(attemptKey)) {
        return false;
      }

      autoReopenAttemptsByKey.set(attemptKey, Date.now());

      Promise.resolve()
        .then(async () => {
          try {
            await reopenBlockedMainFrameInContainer(details, targetCookieStoreId);
            await showAutoReopenNotification(decision, targetCookieStoreId);
          } catch (error) {
            try {
              await navigateTabToBlockedPage(decision, details);
            } catch (navigationError) {
              console.error(
                "Failed to fall back to the blocked page after auto-reopen failure",
                navigationError,
              );
            }
            console.error("Failed to auto-reopen blocked navigation", error);
          }
        })
        .catch(() => undefined);

      return true;
    }

    async function openBlockedUrlInContainer(message, sender) {
      const entryId = requestContextCache.normalizeMessageText(
        message && message.entry,
      );
      const cookieStoreId =
        requestContextCache.normalizeMessageText(
          message && message.cookieStoreId,
        ) || Shared.FIREFOX_DEFAULT_CONTAINER;
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

      if (!Shared.canReopenTabUrl(entry.url)) {
        throw new Error("The blocked URL cannot be reopened in another container.");
      }

      const createdTab = await browser.tabs.create(
        tabActions.withContainer(
          tabActions.buildTabCreateProperties(referenceTab, {
            url: entry.url,
            index:
              typeof referenceTab.index === "number"
                ? referenceTab.index
                : undefined,
            pinned: Boolean(referenceTab && referenceTab.pinned),
          }),
          cookieStoreId,
        ),
      );
      state.blockedPageEntries.delete(entryId);
      await removePersistedBlockedPageEntry(entryId);

      if (
        typeof referenceTab.url === "string" &&
        referenceTab.url.startsWith(
          browser.runtime.getURL(constants.BLOCKED_PAGE_PATH),
        )
      ) {
        await browser.tabs.remove(referenceTab.id);
      }

      return {
        ok: true,
        tabId: createdTab && createdTab.id,
      };
    }

    return {
      buildBlockedPageUrl,
      cleanupBlockedPageEntries,
      createBlockedPageEntry,
      getBlockedPageContextPayload,
      getBlockedPageEntry,
      openBlockedUrlInContainer,
      scheduleAutoReopenBlockedMainFrame,
      removeBlockedPageEntriesForTab,
    };
  }
