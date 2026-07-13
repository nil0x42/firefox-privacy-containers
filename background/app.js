import "../utils/shared.js";
import {
  BACKGROUND_WRITER_ID,
  BLOCKED_PAGE_ENTRY_TTL_MS,
  BLOCKED_PAGE_MAX_ENTRIES,
  BLOCKED_PAGE_PATH,
  BLOCKED_PAGE_STORAGE_KEY,
  COMMAND_ERROR_BADGE_DURATION_MS,
  COMMAND_ERROR_BADGE_TEXT,
  DEFAULT_BROWSER_ACTION_TITLE,
  DIRECT,
} from "./constants.js";
import { createBackgroundState } from "./state.js";
import { createTabIndex } from "./tab-index.js";
import { createRequestContextCache } from "./request-context-cache.js";
import { createContainerCache } from "./container-cache.js";
import { createTabActions } from "./tab-actions.js";
import { createRuntimeManager } from "./runtime-manager.js";
import { createBlockedPageStore } from "./blocked-page-store.js";
import { createBadgeManager } from "./badges.js";
import { createShortcutManager } from "./shortcuts.js";
import { createRequestHandlers } from "./request-handlers.js";
import { createNetworkListenerManager } from "./network-listeners.js";
import { createLifecycleController } from "./lifecycle.js";
import { createEventBinder } from "./events.js";

const Shared = globalThis.PrivacyContainersShared;
const constants = Object.freeze({
  BACKGROUND_WRITER_ID,
  BLOCKED_PAGE_ENTRY_TTL_MS,
  BLOCKED_PAGE_MAX_ENTRIES,
  BLOCKED_PAGE_PATH,
  BLOCKED_PAGE_STORAGE_KEY,
  COMMAND_ERROR_BADGE_DURATION_MS,
  COMMAND_ERROR_BADGE_TEXT,
  DEFAULT_BROWSER_ACTION_TITLE,
  DIRECT,
});

export function createBackgroundApp(deps = {}) {
  const browserApi = deps.browser || globalThis.browser;
  const sharedApi = deps.Shared || Shared;
  const state = createBackgroundState(sharedApi);
  const tabIndex = createTabIndex({ Shared: sharedApi, state });
  const containerCache = createContainerCache({
    Shared: sharedApi,
    browser: browserApi,
    state,
  });
  const requestContextCache = createRequestContextCache({
    Shared: sharedApi,
    state,
  });
  const tabActions = createTabActions({
    Shared: sharedApi,
    browser: browserApi,
    tabIndex,
  });
  let networkListenerManager = null;
  const runtimeManager = createRuntimeManager({
    Shared: sharedApi,
    state,
    syncNetworkListeners() {
      networkListenerManager?.syncNetworkListeners();
    },
  });
  const blockedPageStore = createBlockedPageStore({
    Shared: sharedApi,
    browser: browserApi,
    constants,
    containerCache,
    requestContextCache,
    state,
    tabActions,
  });
  const requestHandlers = createRequestHandlers({
    Shared: sharedApi,
    blockedPageStore,
    constants,
    requestContextCache,
    state,
  });
  networkListenerManager = createNetworkListenerManager({
    Shared: sharedApi,
    browser: browserApi,
    requestHandlers,
    state,
  });
  const badges = createBadgeManager({
    Shared: sharedApi,
    browser: browserApi,
    constants,
    state,
    tabActions,
    tabIndex,
  });
  const shortcuts = createShortcutManager({
    Shared: sharedApi,
    browser: browserApi,
    containerCache,
    state,
    tabActions,
  });
  const lifecycle = createLifecycleController({
    Shared: sharedApi,
    badges,
    browser: browserApi,
    constants,
    containerCache,
    runtimeManager,
    shortcuts,
    state,
    tabIndex,
  });
  const events = createEventBinder({
    Shared: sharedApi,
    badges,
    blockedPageStore,
    browser: browserApi,
    constants,
    lifecycle,
    shortcuts,
    state,
    tabIndex,
  });

  return {
    BACKGROUND_WRITER_ID,
    BLOCKED_PAGE_PATH,
    addHeaders: requestHandlers.addHeaders,
    bindBrowserEvents: events.bindBrowserEvents,
    buildBlockedPageUrl: blockedPageStore.buildBlockedPageUrl,
    buildTabCreateProperties: tabActions.buildTabCreateProperties,
    cleanupBlockedPageEntries: blockedPageStore.cleanupBlockedPageEntries,
    createBlockedPageEntry: blockedPageStore.createBlockedPageEntry,
    createBackgroundApp,
    enforceHostRules: requestHandlers.enforceHostRules,
    getBlockedPageContextPayload: blockedPageStore.getBlockedPageContextPayload,
    getBlockedPageEntry: blockedPageStore.getBlockedPageEntry,
    handleConfigChanged: lifecycle.handleConfigChanged,
    handleRuntimeMessage: events.handleRuntimeMessage,
    initialize: lifecycle.initialize,
    openBlockedUrlInContainer: blockedPageStore.openBlockedUrlInContainer,
    rebuildRuntime: runtimeManager.rebuildRuntime,
    removeBlockedPageEntriesForTab: blockedPageStore.removeBlockedPageEntriesForTab,
    setContainerCache: containerCache.setContainerCache,
    setTrackedTabs: tabIndex.setTrackedTabs,
    setProxy: requestHandlers.setProxy,
    state,
    syncNetworkListeners: networkListenerManager.syncNetworkListeners,
    updateAllBadges: badges.updateAllBadges,
    updateBadgeForTab: badges.updateBadgeForTab,
    updateBadgesForContainers: badges.updateBadgesForContainers,
    withContainer: tabActions.withContainer,
  };
}

if (globalThis.browser && Shared) {
  const app = createBackgroundApp();
  app.bindBrowserEvents();
  app.initialize().catch((error) => {
    console.error("Failed to initialize Privacy Containers", error);
  });
}
