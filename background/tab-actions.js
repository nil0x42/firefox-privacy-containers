import { showTransientNotification } from "./notifications.js";

export function createTabActions(deps) {
    const { browser, Shared } = deps;
    const DEFAULT_CONTAINER_NOTIFICATION_DURATION_MS = 6000;

    function isBlankTabUrl(url) {
      return url === "about:newtab" || url === "about:blank";
    }

    async function showDefaultContainerNotification() {
      try {
        await showTransientNotification(browser, {
          idPrefix: "default-container-required",
          durationMs: DEFAULT_CONTAINER_NOTIFICATION_DURATION_MS,
          title: "Default container required",
          message: "This URL can only be opened in Firefox's default container.",
        });
      } catch (_) {
        // The tab action must not fail just because its informational notice did.
      }
    }

    async function getCurrentBrowserTab() {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab || null;
    }

    async function getCurrentWindowTabs() {
      const tabs = await browser.tabs.query({ currentWindow: true });
      return tabs.slice().sort((left, right) => left.index - right.index);
    }

    async function getCurrentWindowActiveTabState() {
      const tabs = await getCurrentWindowTabs();
      const activeIndex = tabs.findIndex((tab) => tab && tab.active);
      if (activeIndex < 0) {
        return {
          tabs,
          activeTab: null,
          activeIndex: -1,
        };
      }

      return {
        tabs,
        activeTab: tabs[activeIndex],
        activeIndex,
      };
    }

    function getTabPlacementValidation(tab) {
      return Shared.getTabPlacementValidation(tab);
    }

    function buildTabCreateProperties(referenceTab, overrides) {
      return {
        active: true,
        windowId: referenceTab ? referenceTab.windowId : undefined,
        index: referenceTab ? referenceTab.index + 1 : undefined,
        ...overrides,
      };
    }

    function withContainer(createProperties, cookieStoreId) {
      if (!cookieStoreId || cookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER) {
        return createProperties;
      }

      return {
        ...createProperties,
        cookieStoreId,
      };
    }

    async function openTabInContainerFromReferenceTab(
      cookieStoreId,
      activeTab,
      overrides = {},
    ) {
      const validation = getTabPlacementValidation(activeTab);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      return browser.tabs.create(
        withContainer(buildTabCreateProperties(activeTab, overrides), cookieStoreId),
      );
    }

    async function openTabInContainer(cookieStoreId) {
      const activeTab = await getCurrentBrowserTab();
      return openTabInContainerFromReferenceTab(cookieStoreId, activeTab);
    }

    async function openCurrentContainerTab() {
      const activeTab = await getCurrentBrowserTab();
      const validation = getTabPlacementValidation(activeTab);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      await openTabInContainerFromReferenceTab(
        activeTab.cookieStoreId || Shared.FIREFOX_DEFAULT_CONTAINER,
        activeTab,
      );
    }

    async function reopenCurrentTabInContainer(cookieStoreId) {
      const activeTab = await getCurrentBrowserTab();
      const validation = getTabPlacementValidation(activeTab);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const pinned = Boolean(activeTab.pinned);
      if (Shared.canReopenTabUrl(activeTab.url)) {
        await openTabInContainerFromReferenceTab(cookieStoreId, activeTab, {
          pinned,
          url: activeTab.url,
        });
      } else if (isBlankTabUrl(activeTab.url)) {
        await openTabInContainerFromReferenceTab(cookieStoreId, activeTab, {
          pinned,
        });
      } else {
        await showDefaultContainerNotification();
        if (
          Shared.getEffectiveCookieStoreId(activeTab.cookieStoreId) ===
          Shared.FIREFOX_DEFAULT_CONTAINER
        ) {
          return false;
        }

        try {
          await openTabInContainerFromReferenceTab(
            Shared.FIREFOX_DEFAULT_CONTAINER,
            activeTab,
            { pinned, url: activeTab.url },
          );
        } catch (_) {
          return false;
        }
      }

      await browser.tabs.remove(activeTab.id);
      return true;
    }

    async function goOneTabLeft() {
      const { tabs, activeIndex } = await getCurrentWindowActiveTabState();
      if (activeIndex < 0 || !tabs.length) {
        return false;
      }

      const targetIndex = (activeIndex - 1 + tabs.length) % tabs.length;
      await browser.tabs.update(tabs[targetIndex].id, { active: true });
      return true;
    }

    async function goOneTabRight() {
      const { tabs, activeIndex } = await getCurrentWindowActiveTabState();
      if (activeIndex < 0 || !tabs.length) {
        return false;
      }

      const targetIndex = (activeIndex + 1) % tabs.length;
      await browser.tabs.update(tabs[targetIndex].id, { active: true });
      return true;
    }

    async function moveTabLeft() {
      const { tabs, activeTab, activeIndex } = await getCurrentWindowActiveTabState();
      if (!activeTab || activeIndex < 0) {
        return false;
      }

      const pinnedPrefixCount = tabs.findIndex((tab) => !tab.pinned);
      const firstUnpinnedIndex =
        pinnedPrefixCount < 0 ? tabs.length : pinnedPrefixCount;
      const segmentStart = activeTab.pinned ? 0 : firstUnpinnedIndex;
      if (activeIndex <= segmentStart) {
        return false;
      }

      await browser.tabs.move(activeTab.id, { index: tabs[activeIndex - 1].index });
      return true;
    }

    async function moveTabRight() {
      const { tabs, activeTab, activeIndex } = await getCurrentWindowActiveTabState();
      if (!activeTab || activeIndex < 0) {
        return false;
      }

      const pinnedPrefixCount = tabs.findIndex((tab) => !tab.pinned);
      const firstUnpinnedIndex =
        pinnedPrefixCount < 0 ? tabs.length : pinnedPrefixCount;
      const segmentEnd = activeTab.pinned ? firstUnpinnedIndex - 1 : tabs.length - 1;
      if (activeIndex < 0 || activeIndex >= segmentEnd) {
        return false;
      }

      await browser.tabs.move(activeTab.id, { index: tabs[activeIndex + 1].index });
      return true;
    }

    async function toggleTabPinned() {
      const activeTab = await getCurrentBrowserTab();
      if (!activeTab) {
        return false;
      }

      await browser.tabs.update(activeTab.id, {
        pinned: !Boolean(activeTab.pinned),
      });
      return true;
    }

    return {
      buildTabCreateProperties,
      getCurrentWindowTabs,
      getCurrentBrowserTab,
      goOneTabLeft,
      goOneTabRight,
      moveTabLeft,
      moveTabRight,
      openCurrentContainerTab,
      openTabInContainer,
      openTabInContainerFromReferenceTab,
      reopenCurrentTabInContainer,
      toggleTabPinned,
      withContainer,
    };
  }
