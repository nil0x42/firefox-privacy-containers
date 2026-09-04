export function createEmptyRequestContextCacheSlot() {
    return {
      requestId: "",
      cookieStoreId: "",
      method: "",
      url: "",
      context: null,
    };
  }

export function createBackgroundState(Shared) {
    return {
      badgeTextByTabId: new Map(),
      config: Shared.createDefaultConfig(),
      configMeta: Shared.createConfigBundle(Shared.createDefaultConfig(), {}).meta,
      tabCookieStoreIdByTabId: new Map(),
      tabIdsByCookieStoreId: new Map(),
      containers: [],
      containerMetaById: new Map(),
      blockedPageEntries: new Map(),
      requestContextCachePrimary: createEmptyRequestContextCacheSlot(),
      requestContextCacheSecondary: createEmptyRequestContextCacheSlot(),
      routingReady: false,
      runtime: Shared.compileRuntime(Shared.createDefaultConfig(), []),
    };
  }
