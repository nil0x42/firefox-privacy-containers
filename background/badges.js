export function createBadgeManager(deps) {
    const {
      state,
      browser,
      Shared,
      tabIndex,
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

    return {
      getBadgeTextForCookieStoreId,
      updateAllBadges,
      updateBadgeForTab,
      updateBadgesForContainers,
    };
  }
