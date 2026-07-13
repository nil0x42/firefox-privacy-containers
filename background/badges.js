export function createBadgeManager(deps) {
    const {
      state,
      browser,
      Shared,
      constants,
      tabIndex,
      tabActions,
    } = deps;
    const action = browser.action || browser.browserAction;

    function getBadgeTextForCookieStoreId(cookieStoreId) {
      const effectiveCookieStoreId = Shared.getEffectiveCookieStoreId(cookieStoreId);
      if (
        state.runtime.proxyRuntime.invalidAssignmentByContainerId[
          effectiveCookieStoreId
        ]
      ) {
        return "!";
      }

      return state.runtime.proxyRuntime.planByContainerId[effectiveCookieStoreId]
        ? "P"
        : "";
    }

    async function setBadgeText(tabId, text) {
      if (state.badgeTextByTabId.get(tabId) === text) {
        return;
      }

      await action.setBadgeText({ tabId, text });
      state.badgeTextByTabId.set(tabId, text);
    }

    async function setTrackedBadgeText(tabId, cookieStoreId) {
      try {
        await setBadgeText(tabId, getBadgeTextForCookieStoreId(cookieStoreId));
      } catch (_) {
        tabIndex.untrackTab(tabId);
        state.badgeTextByTabId.delete(tabId);
      }
    }

    function clearCommandErrorTimer(tabId) {
      const timerId = state.commandErrorTimerByTabId.get(tabId);
      if (!timerId) {
        return;
      }

      clearTimeout(timerId);
      state.commandErrorTimerByTabId.delete(tabId);
    }

    async function updateBadgeForTab(tabId, tab) {
      const trackedCookieStoreId = tabIndex.getTrackedCookieStoreId(tabId);
      if (trackedCookieStoreId) {
        await setTrackedBadgeText(tabId, trackedCookieStoreId);
        return;
      }

      try {
        const resolvedTab = tab || (await browser.tabs.get(tabId));
        await setTrackedBadgeText(tabId, tabIndex.trackTab(resolvedTab));
      } catch (_) {
        tabIndex.untrackTab(tabId);
        state.badgeTextByTabId.delete(tabId);
      }
    }

    async function updateAllBadges() {
      state.badgeTextByTabId.forEach((_, tabId) => {
        if (!state.tabCookieStoreIdByTabId.has(tabId)) {
          state.badgeTextByTabId.delete(tabId);
        }
      });

      const badgeUpdates = [];
      state.tabCookieStoreIdByTabId.forEach((cookieStoreId, tabId) => {
        badgeUpdates.push(setTrackedBadgeText(tabId, cookieStoreId));
      });

      await Promise.all(badgeUpdates);
    }

    async function updateBadgesForContainers(containerIds) {
      const relevantContainerIds = new Set();
      for (const cookieStoreId of containerIds || []) {
        const effectiveCookieStoreId = Shared.getEffectiveCookieStoreId(cookieStoreId);
        if (effectiveCookieStoreId) {
          relevantContainerIds.add(effectiveCookieStoreId);
        }
      }
      if (!relevantContainerIds.size) {
        return;
      }

      const badgeUpdates = [];

      relevantContainerIds.forEach((cookieStoreId) => {
        const trackedTabIds =
          tabIndex.getTrackedTabIdsForCookieStoreId(cookieStoreId);
        if (!trackedTabIds) {
          return;
        }

        trackedTabIds.forEach((tabId) => {
          badgeUpdates.push(setTrackedBadgeText(tabId, cookieStoreId));
        });
      });

      await Promise.all(badgeUpdates);
    }

    async function restoreBrowserActionForTab(tabId, tab) {
      clearCommandErrorTimer(tabId);
      await action.setTitle({
        tabId,
        title: constants.DEFAULT_BROWSER_ACTION_TITLE,
      });
      await updateBadgeForTab(tabId, tab);
    }

    function getCommandFailureMessage(error) {
      if (!error) {
        return "Shortcut action failed.";
      }

      const message =
        typeof error.message === "string" && error.message.trim()
          ? error.message.trim()
          : String(error);

      return message.endsWith(".") ? message : `${message}.`;
    }

    async function showCommandFailure(error) {
      const activeTab = await tabActions.getCurrentBrowserTab();
      if (!activeTab || typeof activeTab.id !== "number") {
        return;
      }

      const message = getCommandFailureMessage(error);
      clearCommandErrorTimer(activeTab.id);

      await action.setTitle({
        tabId: activeTab.id,
        title: `Privacy Containers: ${message}`,
      });
      await action.setBadgeText({
        tabId: activeTab.id,
        text: constants.COMMAND_ERROR_BADGE_TEXT,
      });
      state.badgeTextByTabId.set(activeTab.id, constants.COMMAND_ERROR_BADGE_TEXT);

      state.commandErrorTimerByTabId.set(
        activeTab.id,
        setTimeout(() => {
          restoreBrowserActionForTab(activeTab.id, activeTab).catch(() => undefined);
        }, constants.COMMAND_ERROR_BADGE_DURATION_MS),
      );
    }

    return {
      clearCommandErrorTimer,
      getBadgeTextForCookieStoreId,
      showCommandFailure,
      updateAllBadges,
      updateBadgeForTab,
      updateBadgesForContainers,
    };
  }
