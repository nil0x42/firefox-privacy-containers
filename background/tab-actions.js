export function createTabActions(deps) {
    const { browser, Shared } = deps;

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

    async function openTabInContainerFromReferenceTab(cookieStoreId, activeTab) {
      const validation = getTabPlacementValidation(activeTab);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      await browser.tabs.create(
        withContainer(buildTabCreateProperties(activeTab, {}), cookieStoreId),
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

      await browser.tabs.create(
        withContainer(
          buildTabCreateProperties(activeTab, {
            url: activeTab.url,
            pinned: Boolean(activeTab.pinned),
          }),
          cookieStoreId,
        ),
      );
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
