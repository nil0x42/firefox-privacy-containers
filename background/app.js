import Shared from "../utils/shared.js";
import {
  BACKGROUND_WRITER_ID,
  BLOCKED_PAGE_ENTRY_TTL_MS,
  BLOCKED_PAGE_MAX_ENTRIES,
  BLOCKED_PAGE_PATH,
  BLOCKED_PAGE_STORAGE_PREFIX,
  PROXY_CONNECTION_ISOLATION_PREFIX,
  PROXY_FAILOVER_TIMEOUT_SECONDS,
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
import { createLifecycleController } from "./lifecycle.js";
import { createEventBinder } from "./events.js";
import { createConfigService } from "./config-service.js";

const constants = Object.freeze({
  BACKGROUND_WRITER_ID,
  BLOCKED_PAGE_ENTRY_TTL_MS,
  BLOCKED_PAGE_MAX_ENTRIES,
  BLOCKED_PAGE_PATH,
  BLOCKED_PAGE_STORAGE_PREFIX,
  PROXY_CONNECTION_ISOLATION_PREFIX,
  PROXY_FAILOVER_TIMEOUT_SECONDS,
});

export function createBackgroundApp(deps = {}) {
  const browserApi = deps.browser || globalThis.browser;
  const sharedApi = deps.Shared || Shared;
  const state = createBackgroundState(sharedApi);

  function markRoutingReady() {
    state.routingReady = true;
  }

  const tabIndex = createTabIndex({ Shared: sharedApi, state });
  const containerCache = createContainerCache({
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
  const runtimeManager = createRuntimeManager({
    Shared: sharedApi,
    state,
    onRoutingReady: markRoutingReady,
  });
  let lifecycle = null;
  const configService = createConfigService({
    Shared: sharedApi,
    browser: browserApi,
    writerId: BACKGROUND_WRITER_ID,
    onChanged: (bundle) => lifecycle.handleConfigChanged(bundle),
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
    waitForRoutingReady: () =>
      lifecycle.initialize().then(() => state.routingReady),
  });
  const badges = createBadgeManager({
    Shared: sharedApi,
    browser: browserApi,
    state,
    tabIndex,
  });
  const shortcuts = createShortcutManager({
    browser: browserApi,
    containerCache,
    state,
    tabActions,
  });
  lifecycle = createLifecycleController({
    Shared: sharedApi,
    badges,
    browser: browserApi,
    constants,
    containerCache,
    configService,
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
    configService,
    lifecycle,
    requestHandlers,
    shortcuts,
    state,
    tabIndex,
  });

  function bindBrowserEvents() {
    // Event-page listeners must be registered synchronously during startup.
    events.bindBrowserEvents();
  }

  function initialize() {
    return lifecycle.initialize();
  }

  return {
    BACKGROUND_WRITER_ID,
    BLOCKED_PAGE_PATH,
    addHeaders: requestHandlers.addHeaders,
    bindBrowserEvents,
    buildBlockedPageUrl: blockedPageStore.buildBlockedPageUrl,
    buildTabCreateProperties: tabActions.buildTabCreateProperties,
    cleanupBlockedPageEntries: blockedPageStore.cleanupBlockedPageEntries,
    createBlockedPageEntry: blockedPageStore.createBlockedPageEntry,
    createBackgroundApp,
    configService,
    enforceHostRules: requestHandlers.enforceHostRules,
    getBlockedPageContextPayload: blockedPageStore.getBlockedPageContextPayload,
    getBlockedPageEntry: blockedPageStore.getBlockedPageEntry,
    handleConfigChanged: lifecycle.handleConfigChanged,
    handleRuntimeMessage: events.handleRuntimeMessage,
    initialize,
    openBlockedUrlInContainer: blockedPageStore.openBlockedUrlInContainer,
    rebuildRuntime: runtimeManager.rebuildRuntime,
    removeBlockedPageEntriesForTab: blockedPageStore.removeBlockedPageEntriesForTab,
    setContainerCache: containerCache.setContainerCache,
    setTrackedTabs: tabIndex.setTrackedTabs,
    setProxy: requestHandlers.setProxy,
    state,
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
