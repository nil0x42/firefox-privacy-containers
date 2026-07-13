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
      commandErrorTimerByTabId: new Map(),
      commandDescriptionByName: new Map(),
      config: Shared.createDefaultConfig(),
      configMeta: Shared.createConfigBundle(Shared.createDefaultConfig(), {}).meta,
      tabCookieStoreIdByTabId: new Map(),
      tabIdsByCookieStoreId: new Map(),
      containers: [],
      containerMetaById: new Map(),
      blockedPageEntries: new Map(),
      requestContextCachePrimary: createEmptyRequestContextCacheSlot(),
      requestContextCacheSecondary: createEmptyRequestContextCacheSlot(),
      listeners: {
        auth: false,
        headers: false,
        hostRules: false,
        proxy: false,
      },
      networkListenerPatternsByKey: {
        auth: null,
        headers: null,
        hostRules: null,
        proxy: null,
      },
      runtime: Shared.compileRuntime(Shared.createDefaultConfig(), []),
    };
  }
