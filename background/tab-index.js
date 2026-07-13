export function createTabIndex(deps) {
    const { state, Shared } = deps;

    function addTabToCookieStoreIndex(tabId, cookieStoreId) {
      const entry = state.tabIdsByCookieStoreId.get(cookieStoreId) || new Set();
      entry.add(tabId);
      state.tabIdsByCookieStoreId.set(cookieStoreId, entry);
    }

    function removeTabFromCookieStoreIndex(tabId, cookieStoreId) {
      const entry = state.tabIdsByCookieStoreId.get(cookieStoreId);
      if (!entry) {
        return;
      }

      entry.delete(tabId);
      if (!entry.size) {
        state.tabIdsByCookieStoreId.delete(cookieStoreId);
      }
    }

    function trackTab(tab) {
      if (!tab || typeof tab.id !== "number") {
        return "";
      }

      const previousCookieStoreId = state.tabCookieStoreIdByTabId.get(tab.id) || "";
      const hasCookieStoreId = Object.prototype.hasOwnProperty.call(
        tab,
        "cookieStoreId",
      );
      const nextCookieStoreId = hasCookieStoreId
        ? Shared.getEffectiveCookieStoreId(tab.cookieStoreId)
        : previousCookieStoreId;

      if (hasCookieStoreId && previousCookieStoreId !== nextCookieStoreId) {
        if (previousCookieStoreId) {
          removeTabFromCookieStoreIndex(tab.id, previousCookieStoreId);
        }

        state.tabCookieStoreIdByTabId.set(tab.id, nextCookieStoreId);
        addTabToCookieStoreIndex(tab.id, nextCookieStoreId);
      }

      return nextCookieStoreId;
    }

    function untrackTab(tabId) {
      if (typeof tabId !== "number") {
        return;
      }

      const cookieStoreId = state.tabCookieStoreIdByTabId.get(tabId);
      if (cookieStoreId) {
        removeTabFromCookieStoreIndex(tabId, cookieStoreId);
      }

      state.tabCookieStoreIdByTabId.delete(tabId);
    }

    function setTrackedTabs(tabs) {
      state.tabCookieStoreIdByTabId = new Map();
      state.tabIdsByCookieStoreId = new Map();

      (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
        trackTab(tab);
      });
    }

    function getTrackedCookieStoreId(tabId) {
      return state.tabCookieStoreIdByTabId.get(tabId) || "";
    }

    function getTrackedTabIdsForCookieStoreId(cookieStoreId) {
      return state.tabIdsByCookieStoreId.get(cookieStoreId) || null;
    }

    return {
      getTrackedCookieStoreId,
      getTrackedTabIdsForCookieStoreId,
      setTrackedTabs,
      trackTab,
      untrackTab,
    };
  }
