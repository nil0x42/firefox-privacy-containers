import assert from "node:assert";
import test from "node:test";
import Shared from "../utils/shared.js";
import * as CookieActions from "../popup/cookies.js";
import { createBackgroundApp } from "../background/app.js";
import { createBlockedPageStore } from "../background/blocked-page-store.js";
import { createTabActions } from "../background/tab-actions.js";
import { createRequestHandlers } from "../background/request-handlers.js";
import { createRequestContextCache } from "../background/request-context-cache.js";

function createEventTarget() {
  return {
    listeners: [],
    addListener(listener, filter, extraInfoSpec) {
      this.listeners.push({ listener, filter, extraInfoSpec });
    },
    removeListener(listener) {
      this.listeners = this.listeners.filter((entry) => entry.listener !== listener);
    },
  };
}

function getBlockedEntryId(redirectUrl) {
  return new URL(redirectUrl).searchParams.get("entry");
}

async function createBlockedReopenEntry(ctx) {
  ctx.background.setContainerCache([
    {
      cookieStoreId: "firefox-container-1",
      name: "Work",
      color: "blue",
      iconUrl: "work.svg",
    },
  ]);
  return ctx.background.createBlockedPageEntry(
    {
      ruleId: "rule-1",
      ruleName: "Work only",
      mode: "blacklist",
      host: "example.com",
      cookieStoreId: "firefox-container-9",
      allowedContainerIdsForBlockedPage: ["firefox-container-1"],
    },
    {
      url: "https://example.com/dashboard",
      tabId: 7,
    },
  );
}

function createBlockedReopenSender() {
  return {
    tab: {
      id: 7,
      url: "moz-extension://test/blocked/blocked.html?entry=test",
      windowId: 4,
      index: 2,
      pinned: true,
    },
  };
}

function loadBackgroundModule() {
  const storageLocalState = {};
  const storageSessionState = {};
  function createStorageArea(state) {
    return {
      state,
      async get(keys) {
        if (typeof keys === "string") {
          return Object.prototype.hasOwnProperty.call(this.state, keys)
            ? { [keys]: this.state[keys] }
            : {};
        }
        if (Array.isArray(keys)) {
          return keys.reduce((result, key) => {
            if (Object.prototype.hasOwnProperty.call(this.state, key)) {
              result[key] = this.state[key];
            }
            return result;
          }, {});
        }
        return { ...this.state };
      },
      async set(values) {
        Object.assign(this.state, values);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete this.state[key];
        }
      },
    };
  }
  const browserMock = {
    proxy: {
      onRequest: createEventTarget(),
    },
    webRequest: {
      onBeforeRequest: createEventTarget(),
      onBeforeSendHeaders: createEventTarget(),
      onAuthRequired: createEventTarget(),
    },
    runtime: {
      getURL: (targetPath) => `moz-extension://test/${targetPath}`,
      onInstalled: createEventTarget(),
      onMessage: createEventTarget(),
      onStartup: createEventTarget(),
    },
    storage: {
      onChanged: {
        addListener() {},
      },
      local: createStorageArea(storageLocalState),
      session: createStorageArea(storageSessionState),
    },
    contextualIdentities: {
      onCreated: createEventTarget(),
      onRemoved: createEventTarget(),
      onUpdated: createEventTarget(),
      query: async () => [],
    },
    commands: {
      onCommand: createEventTarget(),
      async getAll() {
        return [];
      },
      async update() {},
    },
    tabs: {
      byId: new Map(),
      created: [],
      got: 0,
      queried: 0,
      removed: [],
      updated: [],
      async create(details) {
        this.created.push(details);
        return {
          id: 99,
          ...details,
        };
      },
      async remove(tabId) {
        this.removed.push(tabId);
      },
      onActivated: createEventTarget(),
      onCreated: createEventTarget(),
      onRemoved: createEventTarget(),
      query: async function query() {
        this.queried += 1;
        return [];
      },
      get: async function get(tabId) {
        this.got += 1;
        return this.byId.get(tabId) || null;
      },
      update: async function update(tabId, details) {
        this.updated.push({ tabId, details });
        const current = this.byId.get(tabId) || { id: tabId };
        const next = {
          ...current,
          ...details,
        };
        this.byId.set(tabId, next);
        return next;
      },
    },
    notifications: {
      created: [],
      cleared: [],
      async create(notificationId, details) {
        this.created.push({ notificationId, details });
        return notificationId;
      },
      async clear(notificationId) {
        this.cleared.push(notificationId);
        return true;
      },
    },
    action: {
      badgeTextCalls: [],
      setBadgeText: async function setBadgeText(details) {
        this.badgeTextCalls.push(details);
      },
      setTitle: async () => undefined,
    },
  };

  const background = createBackgroundApp({
    Shared,
    browser: browserMock,
  });

  return {
    background,
    browserMock,
    cleanup() {},
  };
}

test("registers all network listeners synchronously and only once", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.bindBrowserEvents();
    assert.strictEqual(ctx.browserMock.proxy.onRequest.listeners.length, 1);
    assert.strictEqual(
      ctx.browserMock.webRequest.onBeforeSendHeaders.listeners.length,
      1,
    );
    assert.strictEqual(
      ctx.browserMock.webRequest.onAuthRequired.listeners.length,
      1,
    );
    assert.strictEqual(ctx.browserMock.webRequest.onBeforeRequest.listeners.length, 1);

    ctx.background.bindBrowserEvents();
    assert.strictEqual(ctx.browserMock.proxy.onRequest.listeners.length, 1);
    assert.strictEqual(
      ctx.browserMock.webRequest.onBeforeSendHeaders.listeners.length,
      1,
    );

    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({ hostRules: [] });
    ctx.background.rebuildRuntime();
    assert.strictEqual(ctx.browserMock.proxy.onRequest.listeners.length, 1);
    assert.strictEqual(
      ctx.browserMock.webRequest.onBeforeSendHeaders.listeners.length,
      1,
    );
    assert.strictEqual(
      ctx.browserMock.webRequest.onAuthRequired.listeners.length,
      1,
    );
    assert.strictEqual(ctx.browserMock.webRequest.onBeforeRequest.listeners.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("initializes once and reconciles browser-owned state on startup", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.bindBrowserEvents();
    await Promise.all([ctx.background.initialize(), ctx.background.initialize()]);
    assert.strictEqual(ctx.browserMock.tabs.queried, 1);

    const startupListener = ctx.browserMock.runtime.onStartup.listeners[0].listener;
    await startupListener();

    assert.strictEqual(ctx.browserMock.tabs.queried, 1);
  } finally {
    ctx.cleanup();
  }
});

test("waits for background initialization before handling commands", async () => {
  const ctx = loadBackgroundModule();
  let releaseContainers;
  const containersReady = new Promise((resolve) => {
    releaseContainers = resolve;
  });

  ctx.browserMock.contextualIdentities.query = async () => {
    await containersReady;
    return [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        icon: "briefcase",
      },
    ];
  };
  ctx.browserMock.tabs.query = async function query() {
    this.queried += 1;
    return [
      {
        id: 7,
        active: true,
        cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
        index: 0,
        pinned: false,
        url: "https://example.com/",
        windowId: 1,
      },
    ];
  };

  try {
    ctx.background.bindBrowserEvents();
    const commandListener =
      ctx.browserMock.commands.onCommand.listeners[0].listener;
    const pendingCommand = commandListener(
      Shared.getOpenContainerSlotCommandName(1),
    );

    await Promise.resolve();
    assert.deepStrictEqual(ctx.browserMock.tabs.created, []);

    releaseContainers();
    await pendingCommand;

    assert.strictEqual(ctx.browserMock.tabs.created.length, 1);
    assert.strictEqual(
      ctx.browserMock.tabs.created[0].cookieStoreId,
      "firefox-container-1",
    );
  } finally {
    ctx.cleanup();
  }
});

test("removes obsolete local navigation state when the extension is installed", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.browserMock.storage.local.state.blockedPageEntries = [{ id: "old" }];
    ctx.background.bindBrowserEvents();

    const installedListener =
      ctx.browserMock.runtime.onInstalled.listeners[0].listener;
    await installedListener();

    assert.strictEqual(
      Object.hasOwn(ctx.browserMock.storage.local.state, "blockedPageEntries"),
      false,
    );
  } finally {
    ctx.cleanup();
  }
});

test("holds startup requests until the routing runtime is ready", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.bindBrowserEvents();
    ctx.browserMock.storage.local.state[Shared.CONFIG_KEY] =
      Shared.createConfigBundle({
        proxies: [
          {
            id: "proxy-1",
            type: "http",
            host: "127.0.0.1",
            port: 8080,
          },
        ],
        containerSettings: {
          "firefox-container-1": {
            proxyId: "proxy-1",
          },
        },
      });
    const get = ctx.browserMock.storage.local.get;
    let releaseStorage;
    const storageReady = new Promise((resolve) => {
      releaseStorage = resolve;
    });
    ctx.browserMock.storage.local.get = async function getWhenReady(keys) {
      await storageReady;
      return get.call(this, keys);
    };
    const pendingResult = ctx.background.setProxy({
      url: "https://example.com/",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "startup-request",
    });
    let settled = false;
    pendingResult.then(() => {
      settled = true;
    });
    await Promise.resolve();
    assert.strictEqual(settled, false);

    releaseStorage();

    const result = await pendingResult;
    assert.strictEqual(result[0].host, "127.0.0.1");
    assert.strictEqual(result[0].port, 8080);
    assert.strictEqual(result[1], null);
  } finally {
    ctx.cleanup();
  }
});

test("fails closed when routing initialization cannot complete", async () => {
  const state = {
    config: Shared.createDefaultConfig(),
    routingReady: false,
    runtime: Shared.compileRuntime(Shared.createDefaultConfig(), []),
    tabCookieStoreIdByTabId: new Map(),
    requestContextCachePrimary: {
      requestId: "",
      cookieStoreId: "",
      method: "",
      url: "",
      context: null,
    },
    requestContextCacheSecondary: {
      requestId: "",
      cookieStoreId: "",
      method: "",
      url: "",
      context: null,
    },
  };
  const requestContextCache = createRequestContextCache({ state, Shared });
  const handlers = createRequestHandlers({
    Shared,
    blockedPageStore: {},
    constants: {
      PROXY_CONNECTION_ISOLATION_PREFIX: "firefox-privacy-containers",
      PROXY_FAILOVER_TIMEOUT_SECONDS: 1,
    },
    requestContextCache,
    state,
    waitForRoutingReady: () => Promise.resolve(false),
  });

  const result = await handlers.setProxy({
    url: "https://example.com/",
    method: "GET",
    cookieStoreId: "firefox-container-1",
  });
  assert.strictEqual(result[0].host, "127.0.0.1");
  assert.strictEqual(result[0].port, 1);
  assert.strictEqual(result[1], null);
});

test("recovers routing after a transient initialization failure", async () => {
  const ctx = loadBackgroundModule();
  const get = ctx.browserMock.storage.local.get;
  let reads = 0;
  ctx.browserMock.storage.local.get = async function getWithFailure(keys) {
    reads += 1;
    if (reads === 1) {
      throw new Error("Temporary storage failure");
    }
    return get.call(this, keys);
  };
  const request = {
    url: "https://example.com/",
    method: "GET",
    cookieStoreId: "firefox-default",
    requestId: "startup-retry",
  };

  try {
    const firstProxyResult = await ctx.background.setProxy(request);
    assert.strictEqual(firstProxyResult[0].host, "127.0.0.1");
    assert.deepStrictEqual(await ctx.background.enforceHostRules(request), {});
    assert.strictEqual(ctx.background.setProxy(request), null);
    assert.strictEqual(ctx.background.state.routingReady, true);
    assert.strictEqual(reads, 2);
  } finally {
    ctx.cleanup();
  }
});

test("returns a terminal isolated proxy chain with minimal failure quarantine", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();

    assert.deepStrictEqual(
      ctx.background.setProxy({
        url: "https://example.com/",
        method: "GET",
        cookieStoreId: "firefox-container-1",
      }),
      [
        {
          type: "http",
          host: "127.0.0.1",
          port: 8080,
          failoverTimeout: 1,
          connectionIsolationKey:
            "firefox-privacy-containers:firefox-container-1:proxy-1",
        },
        null,
      ],
    );
  } finally {
    ctx.cleanup();
  }
});

test("recovers a missing request container from the tracked tab", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.setTrackedTabs([
      {
        id: 42,
        cookieStoreId: "firefox-container-1",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();

    const recoveredResult = ctx.background.setProxy({
      url: "https://example.com/",
      method: "GET",
      tabId: 42,
    });
    assert.strictEqual(recoveredResult[0].host, "127.0.0.1");
    assert.strictEqual(
      recoveredResult[0].connectionIsolationKey,
      "firefox-privacy-containers:firefox-container-1:proxy-1",
    );

    const unknownTabResult = ctx.background.setProxy({
      url: "https://example.com/",
      method: "GET",
      tabId: 43,
    });
    assert.strictEqual(unknownTabResult[0].host, "127.0.0.1");
    assert.strictEqual(unknownTabResult[0].port, 1);
    assert.strictEqual(unknownTabResult[1], null);
  } finally {
    ctx.cleanup();
  }
});

test("uses explicit direct routing only for unassigned or bypassed requests", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
          bypass: {
            optionsMethod: true,
          },
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();

    assert.strictEqual(
      ctx.background.setProxy({
        url: "https://example.com/",
        method: "GET",
        cookieStoreId: "firefox-default",
      }),
      null,
    );
    assert.strictEqual(
      ctx.background.setProxy({
        url: "https://example.com/",
        method: "OPTIONS",
        cookieStoreId: "firefox-container-1",
      }),
      null,
    );
    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        url: "https://example.com/",
        method: "OPTIONS",
        type: "xmlhttprequest",
        cookieStoreId: "firefox-container-1",
        proxyInfo: { type: "direct" },
      }),
      {},
    );
  } finally {
    ctx.cleanup();
  }
});

test("routes from compiled proxy state without consulting raw config", () => {
  const ctx = loadBackgroundModule();
  const originalResolver = Shared.resolveProxyAssignment;

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        { id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 },
      ],
      containerSettings: {
        "firefox-container-1": { proxyId: "proxy-1" },
      },
    });
    ctx.background.rebuildRuntime();
    Shared.resolveProxyAssignment = () => {
      throw new Error("raw configuration was consulted");
    };

    const result = ctx.background.setProxy({
      url: "https://example.com/",
      method: "GET",
      cookieStoreId: "firefox-container-1",
    });

    assert.strictEqual(result[0].host, "127.0.0.1");
    assert.strictEqual(result[0].port, 8080);
  } finally {
    Shared.resolveProxyAssignment = originalResolver;
    ctx.cleanup();
  }
});

test("cancels requests when Firefox did not apply the computed proxy route", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();
    const details = {
      url: "https://example.com/",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
    };

    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        ...details,
        proxyInfo: {
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      }),
      {},
    );
    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        ...details,
        proxyInfo: { type: "direct" },
      }),
      { cancel: true },
    );
    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        ...details,
        proxyInfo: {
          type: "http",
          host: "127.0.0.1",
          port: 8081,
        },
      }),
      { cancel: true },
    );
  } finally {
    ctx.cleanup();
  }
});

test("accepts the Firefox proxy type compiled for SOCKS4a routes", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "socks4a",
          host: "127.0.0.1",
          port: 1080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();

    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        url: "https://example.com/",
        method: "GET",
        type: "script",
        cookieStoreId: "firefox-container-1",
        proxyInfo: {
          type: "socks4",
          host: "127.0.0.1",
          port: 1080,
          proxyDNS: true,
        },
      }),
      {},
    );
  } finally {
    ctx.cleanup();
  }
});

test("blocks requests when a container references an invalid proxy", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.bindBrowserEvents();
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();

    assert.strictEqual(
      ctx.background.state.runtime.proxyRuntime.hasAnyInvalidAssignments,
      true,
    );
    const proxyResult = ctx.background.setProxy({
      url: "https://example.com/",
      method: "GET",
      cookieStoreId: "firefox-container-1",
    });
    assert.strictEqual(proxyResult[0].host, "127.0.0.1");
    assert.strictEqual(proxyResult[0].port, 1);
    assert.strictEqual(proxyResult[1], null);
    assert.strictEqual(ctx.browserMock.webRequest.onBeforeRequest.listeners.length, 1);
    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        url: "https://example.com/",
        type: "main_frame",
        cookieStoreId: "firefox-container-1",
      }),
      { cancel: true },
    );
  } finally {
    ctx.cleanup();
  }
});

test("redirects blocked main_frame requests and cancels subresources", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Block",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    const redirect = await ctx.background.enforceHostRules({
      url: "https://example.com/account",
      type: "main_frame",
      cookieStoreId: "firefox-container-1",
      tabId: 7,
    });
    const cancel = ctx.background.enforceHostRules({
      url: "https://example.com/app.js",
      type: "script",
      cookieStoreId: "firefox-container-1",
    });

    assert.ok(
      redirect.redirectUrl.startsWith(
        "moz-extension://test/blocked/blocked.html?",
      ),
    );
    assert.ok(getBlockedEntryId(redirect.redirectUrl));
    assert.deepStrictEqual(cancel, { cancel: true });
  } finally {
    ctx.cleanup();
  }
});

test("automatically reopens blocked main_frame requests when exactly one allowed container is available", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Work only",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: ["firefox-container-1"],
        },
      ],
    });
    ctx.background.rebuildRuntime();
    ctx.browserMock.tabs.byId.set(7, {
      id: 7,
      windowId: 4,
      index: 2,
      pinned: true,
      url: "https://previous.example.com/",
    });

    const result = await ctx.background.enforceHostRules({
      url: "https://example.com/account",
      type: "main_frame",
      cookieStoreId: "firefox-container-9",
      tabId: 7,
    });

    assert.deepStrictEqual(result, { cancel: true });

  await new Promise((resolve) => {
    setImmediate(resolve);
  });

    assert.deepStrictEqual(ctx.browserMock.tabs.created, [
      {
        active: true,
        windowId: 4,
        index: 2,
        url: "https://example.com/account",
        pinned: true,
        cookieStoreId: "firefox-container-1",
      },
    ]);
    assert.deepStrictEqual(ctx.browserMock.tabs.removed, [7]);
    assert.strictEqual(ctx.browserMock.notifications.created.length, 1);
    assert.strictEqual(
      ctx.browserMock.notifications.created[0].details.title,
      "Link reopened in Work",
    );
    assert.ok(
      ctx.browserMock.notifications.created[0].details.message.includes(
        'Host Rule "Work only"',
      ),
    );
  } finally {
    ctx.cleanup();
  }
});

test("does not fall back after an auto-reopen notification failure", async () => {
  const ctx = loadBackgroundModule();
  const originalConsoleError = console.error;

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Work only",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: ["firefox-container-1"],
        },
      ],
    });
    ctx.background.rebuildRuntime();
    ctx.browserMock.tabs.byId.set(7, {
      id: 7,
      windowId: 4,
      index: 2,
      pinned: false,
    });
    ctx.browserMock.notifications.create = async () => {
      throw new Error("Notification unavailable");
    };
    console.error = () => undefined;

    const result = await ctx.background.enforceHostRules({
      url: "https://example.com/account",
      type: "main_frame",
      cookieStoreId: "firefox-container-9",
      tabId: 7,
    });

    assert.deepStrictEqual(result, { cancel: true });
    assert.strictEqual(ctx.browserMock.tabs.created.length, 1);
    assert.deepStrictEqual(ctx.browserMock.tabs.removed, [7]);
    assert.deepStrictEqual(ctx.browserMock.tabs.updated, []);
    assert.strictEqual(
      Object.keys(ctx.browserMock.storage.session.state).length,
      0,
    );
  } finally {
    console.error = originalConsoleError;
    ctx.cleanup();
  }
});

test("treats missing cookieStoreId as the default container", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Default allowed",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [Shared.FIREFOX_DEFAULT_CONTAINER],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        url: "https://example.com/",
        type: "main_frame",
      }),
      {},
    );
  } finally {
    ctx.cleanup();
  }
});

test("ignores disabled host rules at runtime", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Disabled",
          enabled: false,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    assert.strictEqual(
      ctx.background.state.runtime.hostRuleRuntime.hasAnyEnabledRules,
      false,
    );
    assert.deepStrictEqual(
      ctx.background.enforceHostRules({
        url: "https://example.com/",
        type: "main_frame",
        cookieStoreId: "firefox-container-1",
      }),
      {},
    );
  } finally {
    ctx.cleanup();
  }
});

test("updates all badges from the tracked tab cache without querying tabs again", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();
    ctx.background.setTrackedTabs([
      { id: 1, cookieStoreId: "firefox-container-1" },
      { id: 2, cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER },
    ]);
    ctx.browserMock.tabs.queried = 0;

    await ctx.background.updateAllBadges();

    assert.strictEqual(ctx.browserMock.tabs.queried, 0);
    assert.deepStrictEqual(ctx.browserMock.action.badgeTextCalls, [
      { tabId: 1, text: "P" },
      { tabId: 2, text: "" },
    ]);
  } finally {
    ctx.cleanup();
  }
});

test("updates only tracked tabs for the affected containers without querying tabs", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    });
    ctx.background.rebuildRuntime();
    ctx.background.setTrackedTabs([
      { id: 1, cookieStoreId: "firefox-container-1" },
      { id: 2, cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER },
      { id: 3, cookieStoreId: "firefox-container-1" },
    ]);
    ctx.browserMock.tabs.queried = 0;

    await ctx.background.updateBadgesForContainers(["firefox-container-1"]);

    assert.strictEqual(ctx.browserMock.tabs.queried, 0);
    assert.deepStrictEqual(ctx.browserMock.action.badgeTextCalls, [
      { tabId: 1, text: "P" },
      { tabId: 3, text: "P" },
    ]);
  } finally {
    ctx.cleanup();
  }
});

test("rebuilds only the affected runtime slices on config changes", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      globalHeaders: [{ id: "g1", name: "X-Test", value: "1" }],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
          pwnFoxColorEnabled: true,
        },
      },
      hostRules: [
        {
          id: "rule-1",
          name: "First",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.state.configMeta = { revision: 1, writer: "", updatedAt: "" };
    ctx.background.rebuildRuntime();

    const proxyRuntime = ctx.background.state.runtime.proxyRuntime;
    const headerRuntime = ctx.background.state.runtime.headerRuntime;
    const hostRuleRuntime = ctx.background.state.runtime.hostRuleRuntime;

    await ctx.background.handleConfigChanged(
      Shared.createConfigBundle(
        {
          ...ctx.background.state.config,
          hostRules: [
            {
              id: "rule-1",
              name: "Updated",
              enabled: true,
              mode: "blacklist",
              patterns: ["example.com"],
              exceptions: ["firefox-container-1"],
            },
          ],
        },
        { revision: 2, writer: "test" },
      ),
    );

    assert.strictEqual(ctx.background.state.runtime.proxyRuntime, proxyRuntime);
    assert.strictEqual(ctx.background.state.runtime.headerRuntime, headerRuntime);
    assert.notStrictEqual(
      ctx.background.state.runtime.hostRuleRuntime,
      hostRuleRuntime,
    );
  } finally {
    ctx.cleanup();
  }
});

test("parses request targets only when routing needs the host", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.state.config = Shared.normalizeConfig({ hostRules: [] });
    ctx.background.rebuildRuntime();
    const directRequest = {
      url: "https://example.com/direct",
      method: "GET",
      cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
      requestId: "direct-request",
      type: "xmlhttprequest",
    };

    assert.strictEqual(ctx.background.setProxy(directRequest), null);
    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context.targetParsed,
      false,
    );
    assert.deepStrictEqual(ctx.background.enforceHostRules(directRequest), {});
    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context.targetParsed,
      false,
    );

    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Block example",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.rebuildRuntime();
    const ruledRequest = {
      ...directRequest,
      requestId: "ruled-request",
    };
    assert.deepStrictEqual(ctx.background.enforceHostRules(ruledRequest), {
      cancel: true,
    });
    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context.targetParsed,
      true,
    );
  } finally {
    ctx.cleanup();
  }
});

test("reuses cached request contexts across runtime listeners for the same request", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
          doNotProxyLocal: true,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
      hostRules: [
        {
          id: "rule-1",
          name: "Block",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    ctx.background.setProxy({
      url: "https://example.com/app",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });
    const proxyContext = ctx.background.state.requestContextCachePrimary.context;
    ctx.background.enforceHostRules({
      url: "https://example.com/app",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });

    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context,
      proxyContext,
    );
  } finally {
    ctx.cleanup();
  }
});

test("keeps the previous request context hot across one interleaved request", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
          doNotProxyLocal: true,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
      hostRules: [
        {
          id: "rule-1",
          name: "Block",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    ctx.background.setProxy({
      url: "https://example.com/app",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });
    const firstContext = ctx.background.state.requestContextCachePrimary.context;
    ctx.background.setProxy({
      url: "https://example.com/other",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "request-2",
    });
    const secondContext = ctx.background.state.requestContextCachePrimary.context;
    ctx.background.enforceHostRules({
      url: "https://example.com/app",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });
    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context,
      firstContext,
    );
    ctx.background.enforceHostRules({
      url: "https://example.com/other",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-2",
    });

    assert.strictEqual(
      ctx.background.state.requestContextCachePrimary.context,
      secondContext,
    );
  } finally {
    ctx.cleanup();
  }
});

test("serves blocked-page payloads from stored snapshots even after config changes", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
      {
        cookieStoreId: "firefox-container-2",
        name: "Admin",
        color: "red",
        iconUrl: "admin.svg",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Work only",
          enabled: true,
          mode: "blacklist",
          patterns: ["app.example.com"],
          exceptions: ["firefox-container-1", "firefox-container-2"],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    const redirect = await ctx.background.enforceHostRules({
      url: "https://app.example.com/dashboard",
      type: "main_frame",
      cookieStoreId: "firefox-container-9",
      tabId: 11,
    });
    const entryId = getBlockedEntryId(redirect.redirectUrl);

    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [],
    });
    ctx.background.rebuildRuntime();

    const payload = await ctx.background.getBlockedPageContextPayload({
      entry: entryId,
    });

    assert.strictEqual(payload.ruleName, "Work only");
    assert.strictEqual(payload.mode, "blacklist");
    assert.strictEqual(payload.container.name, "Missing container");
    assert.deepStrictEqual(
      payload.allowedContainers.map((entry) => entry.name),
      ["Work", "Admin"],
    );
    assert.deepStrictEqual(
      payload.allowedContainers.map((entry) => entry.actionLabel),
      ["Continue in Work", "Continue in Admin"],
    );
    assert.deepStrictEqual(
      payload.allowedContainers.map((entry) => entry.ambiguous),
      [false, false],
    );
  } finally {
    ctx.cleanup();
  }
});

test("serves blocked-page payloads from persisted storage after memory is cleared", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    const entryId = await ctx.background.createBlockedPageEntry(
      {
        ruleId: "rule-1",
        ruleName: "Work only",
        mode: "blacklist",
        host: "app.example.com",
        cookieStoreId: "firefox-container-9",
        allowedContainerIdsForBlockedPage: ["firefox-container-1"],
      },
      {
        url: "https://app.example.com/dashboard",
        tabId: 11,
      },
    );

    await Promise.resolve();
    ctx.background.state.blockedPageEntries.clear();

    const payload = await ctx.background.getBlockedPageContextPayload({
      entry: entryId,
    });

    assert.strictEqual(payload.url, "https://app.example.com/dashboard");
    assert.deepStrictEqual(
      payload.allowedContainers.map((entry) => entry.name),
      ["Work"],
    );
  } finally {
    ctx.cleanup();
  }
});

test("persists concurrent blocked-page contexts under independent session keys", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    const entryIds = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        ctx.background.createBlockedPageEntry(
          {
            ruleId: `rule-${index}`,
            ruleName: `Rule ${index}`,
            mode: "blacklist",
            host: `host-${index}.example.com`,
            cookieStoreId: "firefox-container-9",
            allowedContainerIdsForBlockedPage: [],
          },
          {
            url: `https://host-${index}.example.com/`,
            tabId: index,
          },
        ),
      ),
    );

    assert.strictEqual(
      Object.keys(ctx.browserMock.storage.session.state).length,
      entryIds.length,
    );
    ctx.background.state.blockedPageEntries.clear();
    const entries = await Promise.all(
      entryIds.map((entryId) => ctx.background.getBlockedPageEntry(entryId)),
    );
    assert.deepStrictEqual(
      entries.map((entry) => entry.url).sort(),
      Array.from(
        { length: 25 },
        (_, index) => `https://host-${index}.example.com/`,
      ).sort(),
    );
  } finally {
    ctx.cleanup();
  }
});

test("purges invalid, stale and excess blocked-page session contexts", async () => {
  const now = 10_000;
  const prefix = "blockedContext:";
  const entry = (id, createdAt) => ({
    id,
    createdAt,
    tabId: 7,
    url: "https://example.com/",
    mode: "blacklist",
    blockedContainer: {
      cookieStoreId: "firefox-container-9",
      name: "Blocked",
    },
    allowedContainers: [],
  });
  const values = {
    unrelated: { value: true },
    [`${prefix}invalid`]: { id: 7 },
    [`${prefix}invalid-container`]: {
      ...entry("invalid-container", now),
      allowedContainers: [null],
    },
    [`${prefix}wrong-key`]: entry("different-id", now),
    [`${prefix}stale`]: entry("stale", now - 1_001),
    [`${prefix}oldest`]: entry("oldest", now - 500),
    [`${prefix}newest`]: entry("newest", now - 100),
  };
  const removals = [];
  const browser = {
    storage: {
      session: {
        async get() {
          return { ...values };
        },
        async remove(keys) {
          removals.push(keys);
          keys.forEach((key) => delete values[key]);
        },
      },
    },
  };
  const store = createBlockedPageStore({
    browser,
    constants: {
      BLOCKED_PAGE_ENTRY_TTL_MS: 1_000,
      BLOCKED_PAGE_MAX_ENTRIES: 1,
      BLOCKED_PAGE_STORAGE_PREFIX: prefix,
    },
    state: { blockedPageEntries: new Map() },
  });

  await store.cleanupPersistedEntries(now);

  assert.deepStrictEqual(removals, [[
      `${prefix}invalid`,
      `${prefix}invalid-container`,
      `${prefix}wrong-key`,
    `${prefix}stale`,
    `${prefix}oldest`,
  ]]);
  assert.deepStrictEqual(values.unrelated, { value: true });
  assert.deepStrictEqual(values[`${prefix}newest`], entry("newest", now - 100));
});

test("annotates blocked-page containers when live names are ambiguous", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
      {
        cookieStoreId: "firefox-container-2",
        name: "Work",
        color: "red",
        iconUrl: "work-2.svg",
      },
    ]);
    ctx.background.state.config = Shared.normalizeConfig({
      hostRules: [
        {
          id: "rule-1",
          name: "Work only",
          enabled: true,
          mode: "blacklist",
          patterns: ["app.example.com"],
          exceptions: ["firefox-container-1", "firefox-container-2"],
        },
      ],
    });
    ctx.background.rebuildRuntime();

    const redirect = await ctx.background.enforceHostRules({
      url: "https://app.example.com/dashboard",
      type: "main_frame",
      cookieStoreId: "firefox-container-9",
      tabId: 11,
    });
    const entryId = getBlockedEntryId(redirect.redirectUrl);
    const payload = await ctx.background.getBlockedPageContextPayload({
      entry: entryId,
    });

    assert.strictEqual(payload.allowedContainers[0].ambiguous, true);
    assert.strictEqual(payload.allowedContainers[0].technicalLabel, "container-1");
    assert.strictEqual(payload.allowedContainers[1].technicalLabel, "container-2");
  } finally {
    ctx.cleanup();
  }
});

test("marks allowed containers unavailable when they no longer exist", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    const entryId = await ctx.background.createBlockedPageEntry(
      {
        ruleId: "rule-1",
        ruleName: "Work only",
        mode: "blacklist",
        host: "app.example.com",
        cookieStoreId: "firefox-container-9",
        allowedContainerIdsForBlockedPage: ["firefox-container-1"],
      },
      {
        url: "https://app.example.com/dashboard",
        tabId: 12,
      },
    );

    ctx.background.setContainerCache([]);

    const payload = await ctx.background.getBlockedPageContextPayload({
      entry: entryId,
    });

    assert.deepStrictEqual(payload.allowedContainers, []);
    assert.deepStrictEqual(
      payload.unavailableAllowedContainers.map((entry) => entry.name),
      ["Work"],
    );
  } finally {
    ctx.cleanup();
  }
});

test("removes persisted blocked-page entries when the blocked tab closes", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
      },
    ]);
    const entryId = await ctx.background.createBlockedPageEntry(
      {
        ruleId: "rule-1",
        ruleName: "Work only",
        mode: "blacklist",
        host: "app.example.com",
        cookieStoreId: "firefox-container-9",
        allowedContainerIdsForBlockedPage: ["firefox-container-1"],
      },
      {
        url: "https://app.example.com/dashboard",
        tabId: 11,
      },
    );

    await ctx.background.removeBlockedPageEntriesForTab(11);

    const payload = await ctx.background.getBlockedPageContextPayload({
      entry: entryId,
    });

    assert.strictEqual(payload, null);
  } finally {
    ctx.cleanup();
  }
});

test("reopens blocked urls in the requested container by replacing the blocked tab", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    const entryId = await ctx.background.createBlockedPageEntry(
      {
        ruleId: "rule-1",
        ruleName: "Work only",
        mode: "blacklist",
        host: "example.com",
        cookieStoreId: "firefox-container-9",
        allowedContainerIdsForBlockedPage: ["firefox-container-1"],
      },
      {
        url: "https://example.com/dashboard",
        tabId: 7,
      },
    );

    await ctx.background.openBlockedUrlInContainer(
      {
        entry: entryId,
        cookieStoreId: "firefox-container-1",
      },
      {
        tab: {
          id: 7,
          url: "moz-extension://test/blocked/blocked.html?entry=test",
          windowId: 4,
          index: 2,
          pinned: true,
        },
      },
    );

    assert.deepStrictEqual(ctx.browserMock.tabs.created[0], {
      active: true,
      windowId: 4,
      index: 2,
      url: "https://example.com/dashboard",
      pinned: true,
      cookieStoreId: "firefox-container-1",
    });
    assert.deepStrictEqual(ctx.browserMock.tabs.removed, [7]);
  } finally {
    ctx.cleanup();
  }
});

test("keeps a blocked context when replacement cannot be completed", async () => {
  const ctx = loadBackgroundModule();

  try {
    const entryId = await createBlockedReopenEntry(ctx);
    const storageKey = `blockedContext:${entryId}`;
    ctx.browserMock.tabs.remove = async function removeWithFailure(tabId) {
      this.removed.push(tabId);
      if (tabId === 7) {
        throw new Error("Failed to close blocked tab");
      }
    };

    await assert.rejects(
      ctx.background.openBlockedUrlInContainer(
        { entry: entryId, cookieStoreId: "firefox-container-1" },
        createBlockedReopenSender(),
      ),
      /Failed to close blocked tab/,
    );

    assert.deepStrictEqual(ctx.browserMock.tabs.removed, [7, 99]);
    assert.strictEqual(ctx.background.state.blockedPageEntries.has(entryId), true);
    assert.ok(ctx.browserMock.storage.session.state[storageKey]);
  } finally {
    ctx.cleanup();
  }
});

test("completes tab replacement when consumed context cleanup fails", async () => {
  const ctx = loadBackgroundModule();
  const originalConsoleError = console.error;

  try {
    const entryId = await createBlockedReopenEntry(ctx);
    const storageKey = `blockedContext:${entryId}`;
    ctx.browserMock.storage.session.remove = async () => {
      throw new Error("Temporary storage failure");
    };
    console.error = () => undefined;

    const result = await ctx.background.openBlockedUrlInContainer(
      { entry: entryId, cookieStoreId: "firefox-container-1" },
      createBlockedReopenSender(),
    );

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(ctx.browserMock.tabs.removed, [7]);
    assert.strictEqual(ctx.background.state.blockedPageEntries.has(entryId), false);
    assert.ok(ctx.browserMock.storage.session.state[storageKey]);
  } finally {
    console.error = originalConsoleError;
    ctx.cleanup();
  }
});

test("keeps a blocked context when replacement tab creation fails", async () => {
  const ctx = loadBackgroundModule();

  try {
    const entryId = await createBlockedReopenEntry(ctx);
    ctx.browserMock.tabs.create = async () => {
      throw new Error("Failed to create replacement tab");
    };

    await assert.rejects(
      ctx.background.openBlockedUrlInContainer(
        { entry: entryId, cookieStoreId: "firefox-container-1" },
        createBlockedReopenSender(),
      ),
      /Failed to create replacement tab/,
    );

    assert.deepStrictEqual(ctx.browserMock.tabs.removed, []);
    assert.strictEqual(ctx.background.state.blockedPageEntries.has(entryId), true);
  } finally {
    ctx.cleanup();
  }
});

test("rejects reopening blocked urls in unauthorized containers", async () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ]);
    const entryId = await ctx.background.createBlockedPageEntry(
      {
        ruleId: "rule-1",
        ruleName: "Work only",
        mode: "blacklist",
        host: "example.com",
        cookieStoreId: "firefox-container-9",
        allowedContainerIdsForBlockedPage: ["firefox-container-1"],
      },
      {
        url: "https://example.com/dashboard",
        tabId: 7,
      },
    );

    await assert.rejects(
      ctx.background.openBlockedUrlInContainer(
        {
          entry: entryId,
          cookieStoreId: "firefox-container-2",
        },
        {
          tab: {
            id: 7,
            url: "moz-extension://test/blocked/blocked.html?entry=test",
            windowId: 4,
            index: 2,
            pinned: true,
          },
        },
      ),
      /not allowed/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("deduplicates only the same pending auto-reopen navigation", async () => {
  const state = {
    blockedPageEntries: new Map(),
  };
  const browser = {
    runtime: {
      getURL(targetPath) {
        return `moz-extension://test/${targetPath}`;
      },
    },
    tabs: {
      byId: new Map([
        [
          7,
          {
            id: 7,
            windowId: 4,
            index: 2,
            pinned: false,
          },
        ],
        [
          8,
          {
            id: 8,
            windowId: 4,
            index: 3,
            pinned: false,
          },
        ],
      ]),
      async get(tabId) {
        return this.byId.get(tabId) || null;
      },
      async create(details) {
        return {
          id: 99,
          ...details,
        };
      },
      async remove() {},
      async update() {},
    },
  };
  const blockedPageStore = createBlockedPageStore({
    browser,
    constants: {
      BLOCKED_PAGE_ENTRY_TTL_MS: 5 * 60 * 1000,
      BLOCKED_PAGE_MAX_ENTRIES: 200,
      BLOCKED_PAGE_PATH: "blocked/blocked.html",
      BLOCKED_PAGE_STORAGE_PREFIX: "blockedContext:",
    },
    containerCache: {
      isContainerAvailable(cookieStoreId) {
        return cookieStoreId === "firefox-container-1";
      },
      getContainerDescriptor(cookieStoreId) {
        return {
          cookieStoreId,
          name: "Work",
          color: "blue",
          iconUrl: "",
          missing: false,
        };
      },
      decorateContainerDescriptor(descriptor) {
        return descriptor;
      },
      getAmbiguousContainerIdSet() {
        return new Set();
      },
    },
    state,
    tabActions: createTabActions({ Shared, browser }),
  });

  const decision = {
    ruleId: "rule-1",
    ruleName: "Work only",
    mode: "blacklist",
    host: "example.com",
    cookieStoreId: "firefox-container-9",
    allowedContainerIdsForBlockedPage: ["firefox-container-1"],
  };
  const details = {
    url: "https://example.com/account",
    type: "main_frame",
    tabId: 7,
  };

  const firstAttempt = blockedPageStore.scheduleAutoReopenBlockedMainFrame(
    decision,
    details,
  );
  assert.ok(firstAttempt);
  assert.strictEqual(
    blockedPageStore.scheduleAutoReopenBlockedMainFrame(decision, details),
    false,
  );
  const independentAttempt =
    blockedPageStore.scheduleAutoReopenBlockedMainFrame(decision, {
      ...details,
      requestId: "independent-request",
      tabId: 8,
    });
  assert.ok(independentAttempt);

  await Promise.all([firstAttempt, independentAttempt]);

  const laterAttempt = blockedPageStore.scheduleAutoReopenBlockedMainFrame(
    decision,
    details,
  );
  assert.ok(laterAttempt);
  await laterAttempt;
});

test("validates tab placement separately from web page actions", () => {
  assert.deepStrictEqual(Shared.getTabPlacementValidation(null), {
    valid: false,
    reason: "No active browser tab found in the current window",
  });
  assert.deepStrictEqual(
    Shared.getTabPlacementValidation({
      active: true,
      url: "about:blank",
    }),
    {
      valid: true,
      reason: "",
    },
  );
});

test("captures shortcuts from supported key events", () => {
  assert.strictEqual(
    Shared.captureShortcutFromEventData({
      ctrlKey: true,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      key: "a",
      code: "KeyA",
    }),
    "Ctrl+Alt+A",
  );

  assert.strictEqual(
    Shared.captureShortcutFromEventData({
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      key: "&",
      code: "Digit1",
    }),
    "Ctrl+1",
  );

  assert.strictEqual(
    Shared.captureShortcutFromEventData({
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      key: ".",
      code: "Period",
    }),
    "Ctrl+Period",
  );

  assert.strictEqual(
    Shared.captureShortcutFromEventData({
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      key: "a",
      code: "KeyA",
    }),
    "",
  );
});

test("reports shortcut activation conflicts explicitly", () => {
  assert.strictEqual(
    Shared.getShortcutActivationIssue("Ctrl+Alt+A", "Ctrl+Alt+A"),
    "",
  );
  assert.strictEqual(
    Shared.getShortcutActivationIssue("Ctrl+Alt+A", ""),
    'Firefox did not activate "Ctrl+Alt+A". It likely conflicts with the browser or another add-on.',
  );
});

test("compiles runtime state for proxies, headers and PwnFox", () => {
  const runtime = Shared.compileRuntime(
    {
      proxies: [
        {
          id: "proxy-1",
          title: "Burp",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
          username: "user",
          password: "secret",
        },
      ],
      globalHeaders: [{ id: "g1", name: "X-Global", value: "1" }],
      containerSettings: {
        [Shared.FIREFOX_DEFAULT_CONTAINER]: {
          headers: [{ id: "d1", name: "X-Default", value: "yes" }],
        },
        "firefox-container-1": {
          proxyId: "proxy-1",
          headers: [{ id: "c1", name: "X-Scoped", value: "2" }],
          pwnFoxColorEnabled: true,
        },
      },
    },
    [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "toolbar",
        icon: "briefcase",
      },
    ],
  );

  assert.strictEqual(runtime.proxyRuntime.hasAnyAssignments, true);
  assert.strictEqual(runtime.headerRuntime.hasAnyWork, true);
  assert.strictEqual(runtime.proxyRuntime.hasAnyAuthAssignments, true);
  assert.deepStrictEqual(runtime.shortcutRuntime.containerIdBySlot, [
    Shared.FIREFOX_DEFAULT_CONTAINER,
    "firefox-container-1",
  ]);
  assert.deepStrictEqual(runtime.proxyRuntime.proxiedContainerIds, [
    "firefox-container-1",
  ]);
  assert.deepStrictEqual(
    runtime.proxyRuntime.planByContainerId["firefox-container-1"].requestInfo,
    { type: "http", host: "127.0.0.1", port: 8080 },
  );
  assert.strictEqual(
    runtime.proxyRuntime.planByContainerId[
      "firefox-container-1"
    ].bypassMatcher.matches(
      "GET",
      "example.com",
    ),
    false,
  );
  assert.deepStrictEqual(
    runtime.proxyRuntime.planByContainerId["firefox-container-1"].authCredentials,
    { username: "user", password: "secret" },
  );
  assert.deepStrictEqual(
    runtime.headerRuntime.planByContainerId[Shared.FIREFOX_DEFAULT_CONTAINER].headers,
    [
      { id: "g1", name: "X-Global", value: "1" },
      { id: "d1", name: "X-Default", value: "yes" },
    ],
  );
  assert.deepStrictEqual(
    runtime.headerRuntime.planByContainerId["firefox-container-1"].headers,
    [
      { name: "X-PwnFox-Color", value: "gray" },
      { id: "g1", name: "X-Global", value: "1" },
      { id: "c1", name: "X-Scoped", value: "2" },
    ],
  );
  assert.strictEqual(
    runtime.headerRuntime.planByContainerId["firefox-container-1"].compiledHeaders[0]
      .normalizedName,
    "x-pwnfox-color",
  );
});

test("does not mark proxy auth active without credentials", () => {
  const runtime = Shared.compileRuntime(
    {
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    },
    [],
  );

  assert.strictEqual(runtime.proxyRuntime.hasAnyAuthAssignments, false);
  assert.strictEqual(
    runtime.proxyRuntime.planByContainerId["firefox-container-1"].authCredentials,
    null,
  );
});

test("provides proxy auth for the default container", () => {
  const handlers = createRequestHandlers({
    Shared,
    blockedPageStore: {},
    constants: {},
    requestContextCache: {},
    state: {
      runtime: {
        proxyRuntime: {
          planByContainerId: {
            [Shared.FIREFOX_DEFAULT_CONTAINER]: {
              host: "127.0.0.1",
              port: 8080,
              type: "http",
              authCredentials: {
                username: "user",
                password: "secret",
              },
            },
          },
        },
      },
    },
  });

  assert.deepStrictEqual(
    handlers.onAuthRequired({
      isProxy: true,
      cookieStoreId: "",
      challenger: {
        host: "127.0.0.1",
        port: 8080,
      },
    }),
    {
      authCredentials: {
        username: "user",
        password: "secret",
      },
    },
  );
});

test("blocks containers assigned to incomplete proxies at runtime", () => {
  const runtime = Shared.compileRuntime(
    {
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "",
          port: 8080,
        },
      ],
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
        },
      },
    },
    [],
  );

  assert.strictEqual(runtime.proxyRuntime.hasAnyAssignments, false);
  assert.strictEqual(runtime.proxyRuntime.hasAnyInvalidAssignments, true);
  assert.deepStrictEqual(runtime.proxyRuntime.proxiedContainerIds, []);
  assert.deepStrictEqual(runtime.proxyRuntime.blockedContainerIds, [
    "firefox-container-1",
  ]);
  assert.deepStrictEqual(
    runtime.proxyRuntime.invalidAssignmentByContainerId["firefox-container-1"],
    {
      proxyId: "proxy-1",
      displayName: "http://:8080",
      reason:
        "This container is assigned to a draft proxy. Requests are blocked until that proxy is completed or removed.",
    },
  );
  assert.strictEqual(
    runtime.proxyRuntime.planByContainerId["firefox-container-1"],
    undefined,
  );
});

test("builds cookie query details for partitioned and isolated storage", () => {
  assert.deepStrictEqual(
    Shared.buildCookieQueryDetails(
      {
        url: "https://example.com/app",
        cookieStoreId: "firefox-container-2",
      },
      true,
    ),
    {
      url: "https://example.com/app",
      firstPartyDomain: null,
      storeId: "firefox-container-2",
      partitionKey: {},
    },
  );

  assert.deepStrictEqual(
    Shared.buildCookieQueryDetails(
      {
        url: "https://example.com/app",
        cookieStoreId: "firefox-container-2",
      },
      false,
    ),
    {
      url: "https://example.com/app",
      firstPartyDomain: null,
      storeId: "firefox-container-2",
    },
  );
});

test("builds cookie removal details including first-party and partition metadata", () => {
  assert.deepStrictEqual(
    Shared.buildCookieRemovalDetails(
      {
        domain: ".example.com",
        path: "/secure",
        secure: true,
        name: "session",
        firstPartyDomain: "",
        partitionKey: {
          topLevelSite: "https://example.com",
        },
      },
      "firefox-container-2",
    ),
    {
      url: "https://example.com/secure",
      name: "session",
      storeId: "firefox-container-2",
      firstPartyDomain: "",
      partitionKey: {
        topLevelSite: "https://example.com",
      },
    },
  );
});

test("removes cookies once using their exact storage identity", async () => {
  const cookies = [
    {
      domain: ".example.com",
      path: "/",
      secure: true,
      name: "session",
      firstPartyDomain: "",
      partitionKey: { topLevelSite: "https://example.com" },
    },
    {
      domain: ".example.com",
      path: "/",
      secure: true,
      name: "session",
      firstPartyDomain: "",
    },
  ];
  const getAllCalls = [];
  const removeCalls = [];
  const browserMock = {
    cookies: {
      async getAll(details) {
        getAllCalls.push(details);
        return cookies;
      },
      async remove(details) {
        removeCalls.push(details);
        return { ...details };
      },
    },
  };
  const tab = {
    url: "https://example.com/account",
    cookieStoreId: "firefox-container-2",
  };

  const result = await CookieActions.removeTabCookies(browserMock, tab);

  assert.deepStrictEqual(result, { matchedCount: 2, removedCount: 2 });
  assert.deepStrictEqual(getAllCalls, [
    {
      url: tab.url,
      firstPartyDomain: null,
      storeId: tab.cookieStoreId,
      partitionKey: {},
    },
  ]);
  assert.strictEqual(removeCalls.length, 2);
  assert.deepStrictEqual(removeCalls[0].partitionKey, cookies[0].partitionKey);
  assert.strictEqual("partitionKey" in removeCalls[1], false);
  assert.ok(removeCalls.every((details) => details.firstPartyDomain === ""));
});

test("reports null and rejected exact cookie removals without retrying", async () => {
  const cookies = [
    { domain: "example.com", path: "/", name: "missing" },
    { domain: "example.com", path: "/", name: "rejected" },
    { domain: "example.com", path: "/", name: "removed" },
  ];
  const removeCalls = [];
  const browserMock = {
    cookies: {
      async getAll() {
        return cookies;
      },
      async remove(details) {
        removeCalls.push(details);
        if (details.name === "missing") {
          return null;
        }
        if (details.name === "rejected") {
          throw new Error("rejected");
        }
        return details;
      },
    },
  };

  await assert.rejects(
    CookieActions.removeTabCookies(
      browserMock,
      { url: "https://example.com", cookieStoreId: "firefox-container-2" },
    ),
    /Removed 1 cookie, but failed to remove 2 cookies\./,
  );
  assert.strictEqual(removeCalls.length, cookies.length);
});

test("marks direct proxy plans that do not need per-request URL parsing", () => {
  const fastPlan = Shared.compileProxyPlan(
    Shared.normalizeProxy({
      id: "proxy-1",
      type: "http",
      host: "127.0.0.1",
      port: "8080",
      doNotProxyLocal: false,
      bypass: {
        optionsMethod: false,
        customHostsEnabled: false,
        customHosts: [],
      },
    }),
  );
  const guardedPlan = Shared.compileProxyPlan(
    Shared.normalizeProxy({
      id: "proxy-2",
      type: "http",
      host: "127.0.0.1",
      port: "8080",
      doNotProxyLocal: true,
    }),
  );

  assert.strictEqual(fastPlan.requiresRequestTarget, false);
  assert.strictEqual(guardedPlan.requiresRequestTarget, true);
  assert.strictEqual(fastPlan.bypassMatcher.hasMatchers, false);
});
