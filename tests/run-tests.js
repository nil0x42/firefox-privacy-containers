const assert = require("assert");
const fs = require("fs");
const Shared = require("../utils/shared.js");
const path = require("path");
let createBackgroundApp;
let createShortcutManager;
let createBlockedPageStore;
let createTabIndex;
let createTabActions;
let createRequestHandlers;
let createRequestContextCache;
let createRuntimeManager;

const tests = [];

const OPTIONS_CSS_PATH = path.join(__dirname, "..", "options", "app.css");

async function loadBackgroundTestModules() {
  ({ createBackgroundApp } = await import("../background/app.js"));
  ({ createShortcutManager } = await import("../background/shortcuts.js"));
  ({ createBlockedPageStore } = await import("../background/blocked-page-store.js"));
  ({ createTabIndex } = await import("../background/tab-index.js"));
  ({ createTabActions } = await import("../background/tab-actions.js"));
  ({ createRequestHandlers } = await import("../background/request-handlers.js"));
  ({ createRequestContextCache } = await import("../background/request-context-cache.js"));
  ({ createRuntimeManager } = await import("../background/runtime-manager.js"));
}

function parseHexColor(value) {
  const normalized = value.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
}

function getRelativeLuminance(hexColor) {
  const channels = parseHexColor(hexColor).map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
}

function getContrastRatio(firstColor, secondColor) {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function test(name, fn) {
  tests.push({ name, fn });
}

function testCases(cases, runCase) {
  for (const scenario of cases) {
    test(scenario.name, () => runCase(scenario));
  }
}

function createTabActionsBrowser(tabs) {
  return {
    tabs: {
      moves: [],
      updates: [],
      async query() {
        return tabs;
      },
      async move(tabId, details) {
        this.moves.push({ tabId, details });
      },
      async update(tabId, details) {
        this.updates.push({ tabId, details });
      },
    },
  };
}

function createReopenBrowser(activeTab, options = {}) {
  return {
    notifications: {
      created: [],
      async create(notificationId, details) {
        this.created.push({ notificationId, details });
      },
    },
    runtime: {
      getURL(pathname) {
        return `moz-extension://test/${pathname}`;
      },
    },
    tabs: {
      created: [],
      removed: [],
      async create(details) {
        this.created.push(details);
        if (options.createError) {
          throw options.createError;
        }
        return { id: 22, ...details };
      },
      async query() {
        return [activeTab];
      },
      async remove(tabId) {
        this.removed.push(tabId);
      },
    },
  };
}

test("declares a Firefox Manifest V3 event page without widening host access", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"),
  );

  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.background.persistent, undefined);
  assert.strictEqual(manifest.background.service_worker, undefined);
  assert.deepStrictEqual(manifest.background.scripts, ["background/app.js"]);
  assert.strictEqual(manifest.background.type, "module");
  assert.ok(manifest.action);
  assert.deepStrictEqual(manifest.host_permissions, ["<all_urls>"]);
  assert.strictEqual(manifest.permissions.includes("<all_urls>"), false);
  assert.ok(manifest.permissions.includes("webRequestBlocking"));
  assert.deepStrictEqual(manifest.web_accessible_resources, [
    {
      resources: [
        "blocked/blocked.html",
      ],
      matches: ["<all_urls>"],
    },
  ]);
  assert.strictEqual(manifest.browser_specific_settings.gecko.strict_min_version, "142.0");
  assert.deepStrictEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] },
  );
});

test("avoids unsupported contextual identity APIs and HTML icon injection", () => {
  for (const filename of ["options/app.js", "popup/popup.js"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", filename), "utf8");
    assert.strictEqual(source.includes("innerHTML"), false);
    assert.strictEqual(source.includes("getSupportedColors"), false);
    assert.strictEqual(source.includes("getSupportedIcons"), false);
    assert.ok(source.includes('parseFromString(svgMarkup, "text/html")'));
    assert.ok(source.includes('namespaceURI !== "http://www.w3.org/2000/svg"'));
  }
});

test("keeps options color literals centralized in the root palette", () => {
  const css = fs.readFileSync(OPTIONS_CSS_PATH, "utf8");
  const html = fs.readFileSync(
    path.join(__dirname, "..", "options", "app.html"),
    "utf8",
  );
  const appScript = fs.readFileSync(
    path.join(__dirname, "..", "options", "app.js"),
    "utf8",
  );
  const rootMatch = css.match(/^:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(rootMatch, "Expected a :root color palette");

  const componentCss = css.slice(rootMatch[0].length);
  const rawColors = componentCss.match(
    /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi,
  );
  assert.deepStrictEqual(rawColors, null);
  assert.strictEqual(/#[0-9a-f]{3,8}\b|rgba?\(/i.test(html), false);
  assert.strictEqual(/rgba?\(/i.test(appScript), false);

  for (const legacyToken of [
    "--accent",
    "--accent-strong",
    "--card-strong",
    "--line",
    "--line-strong",
    "--muted",
    "--ok",
    "--warn",
    "--warn-soft",
  ]) {
    assert.strictEqual(css.includes(`var(${legacyToken})`), false);
  }
});

test("keeps critical UI palette pairs at accessible contrast", () => {
  const css = fs.readFileSync(OPTIONS_CSS_PATH, "utf8");
  const palette = new Map(
    Array.from(css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)).map(
      (match) => [match[1], match[2]],
    ),
  );
  const pairs = [
    ["--text", "--surface"],
    ["--text-muted", "--surface"],
    ["--text-disabled", "--surface-disabled"],
    ["--brand", "--surface"],
    ["--focus-ring", "--surface"],
    ["--container-accent-strong", "--surface"],
    ["--proxy-accent-strong", "--surface"],
    ["--global-accent-strong", "--surface"],
    ["--danger", "--surface"],
    ["--danger", "--danger-soft"],
    ["--success", "--surface"],
    ["--warning", "--surface"],
    ["--warning-strong", "--warning-soft"],
  ];

  for (const [foregroundToken, backgroundToken] of pairs) {
    const foreground = palette.get(foregroundToken);
    const background = palette.get(backgroundToken);
    assert.ok(foreground, `Missing ${foregroundToken}`);
    assert.ok(background, `Missing ${backgroundToken}`);
    assert.ok(
      getContrastRatio(foreground, background) >= 4.5,
      `${foregroundToken} must have 4.5:1 contrast against ${backgroundToken}`,
    );
  }
});

test("derives card motion colors from the active card context", () => {
  const {
    buildInsertKeyframes,
    buildReorderKeyframes,
  } = require("../options/app.js");
  const previousWindow = global.window;
  global.window = {
    getComputedStyle() {
      return {
        borderColor: "rgb(98, 88, 179)",
        boxShadow: "rgb(98, 88, 179) 4px 0px 0px 0px inset",
        getPropertyValue(name) {
          return name === "--context-accent" ? "#6258b3" : "";
        },
      };
    },
  };

  try {
    const card = {};
    const insertFrames = buildInsertKeyframes(card);
    const reorderFrames = buildReorderKeyframes(card, 10, 20, true);

    assert.strictEqual(insertFrames[0].borderColor, "#6258b3");
    assert.ok(insertFrames[0].boxShadow.includes("#6258b3"));
    assert.strictEqual(insertFrames.at(-1).borderColor, "rgb(98, 88, 179)");
    assert.strictEqual(reorderFrames[0].borderColor, "#6258b3");
    assert.ok(reorderFrames[0].boxShadow.includes("#6258b3"));
    assert.strictEqual(reorderFrames.at(-1).borderColor, "rgb(98, 88, 179)");
  } finally {
    global.window = previousWindow;
  }
});

test("normalizes host rules", () => {
  assert.strictEqual(
    Shared.normalizeHostRule("https://Sub.Example.com/path"),
    "sub.example.com",
  );
  assert.strictEqual(Shared.normalizeHostRule("example.com."), "example.com");
  assert.strictEqual(
    Shared.normalizeHostRule("wss://Sub.Example.com/socket"),
    "sub.example.com",
  );
});

test("matches exact hosts and subdomains", () => {
  assert.strictEqual(Shared.hostMatchesRule("example.com", "example.com"), true);
  assert.strictEqual(
    Shared.hostMatchesRule("api.example.com", "example.com"),
    true,
  );
  assert.strictEqual(
    Shared.hostMatchesRule("badexample.com", "example.com"),
    false,
  );
});

test("matches normalized hosts without re-normalizing rules", () => {
  assert.strictEqual(
    Shared.hostMatchesAnyNormalizedRule("api.example.com", ["example.com"]),
    true,
  );
  assert.strictEqual(
    Shared.hostMatchesAnyNormalizedRule("badexample.com", ["example.com"]),
    false,
  );
});

test("detects localhost and loopback hosts", () => {
  assert.strictEqual(Shared.isLoopbackHost("localhost"), true);
  assert.strictEqual(Shared.isLoopbackHost("api.localhost"), true);
  assert.strictEqual(Shared.isLoopbackHost("127.0.0.1"), true);
  assert.strictEqual(Shared.isLoopbackHost("127.42.7.9"), true);
  assert.strictEqual(Shared.isLoopbackHost("[::1]"), true);
  assert.strictEqual(Shared.isLoopbackHost("::1"), true);
  assert.strictEqual(Shared.isLoopbackHost("192.168.0.1"), false);
});

test("matches compiled normalized hosts without extra normalization", () => {
  const compiledRules = new Set(["example.com", "internal.test"]);

  assert.strictEqual(
    Shared.hostMatchesCompiledNormalizedHost("api.example.com", compiledRules),
    true,
  );
  assert.strictEqual(
    Shared.hostMatchesCompiledNormalizedHost("badexample.com", compiledRules),
    false,
  );
});

test("detects normalized loopback hosts", () => {
  assert.strictEqual(Shared.isLoopbackNormalizedHost("localhost"), true);
  assert.strictEqual(Shared.isLoopbackNormalizedHost("127.0.0.42"), true);
  assert.strictEqual(Shared.isLoopbackNormalizedHost("::1"), true);
  assert.strictEqual(Shared.isLoopbackNormalizedHost("example.com"), false);
});

test("parses request targets for http, https, ws and wss", () => {
  assert.deepStrictEqual(Shared.parseRequestTarget("https://example.com/a"), {
    protocol: "https:",
    host: "example.com",
  });
  assert.deepStrictEqual(Shared.parseRequestTarget("ws://example.com/socket"), {
    protocol: "ws:",
    host: "example.com",
  });
  assert.deepStrictEqual(Shared.parseRequestTarget("wss://example.com/socket"), {
    protocol: "wss:",
    host: "example.com",
  });
  assert.strictEqual(Shared.parseRequestTarget("ftp://example.com"), null);
  assert.strictEqual(Shared.parseRequestHost("https://example.com/a"), "example.com");
  assert.strictEqual(Shared.parseRequestHost("ftp://example.com"), "");
});

test("builds normalized request contexts once for runtime consumers", () => {
  assert.deepStrictEqual(
    Shared.buildRequestContext({
      url: "https://LOCALHOST:8443/path",
      method: "options",
    }),
    {
      cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
      method: "OPTIONS",
      normalizedHost: "localhost",
      target: {
        protocol: "https:",
        host: "localhost",
      },
      isLoopback: true,
      url: "https://LOCALHOST:8443/path",
    },
  );
});

test("normalizes proxies with socks DNS enabled by default", () => {
  const proxy = Shared.normalizeProxy({
    id: "proxy-1",
    type: "socks",
    host: "127.0.0.1",
    port: "1080",
  });

  assert.deepStrictEqual(proxy, {
    id: "proxy-1",
    title: "",
    type: "socks",
    host: "127.0.0.1",
    port: 1080,
    username: "",
    password: "",
    proxyDNS: true,
    doNotProxyLocal: true,
    bypass: Shared.createDefaultProxyBypass(),
  });
});

test("forces socks4 proxyDNS off and clears auth fields", () => {
  const proxy = Shared.normalizeProxy({
    id: "proxy-1",
    type: "socks4",
    host: "127.0.0.1",
    port: "1080",
    proxyDNS: true,
    username: "user",
    password: "secret",
  });

  assert.strictEqual(proxy.proxyDNS, false);
  assert.strictEqual(proxy.username, "");
  assert.strictEqual(proxy.password, "");
});

test("validates proxy settings and duplicate ids", () => {
  const valid = Shared.validateProxy({
    id: "proxy-1",
    type: "https",
    host: "127.0.0.1",
    port: "8080",
  });

  assert.strictEqual(valid.valid, true);

  const invalidConfig = Shared.validateConfig({
    proxies: [
      { id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 },
      { id: "proxy-1", type: "http", host: "127.0.0.2", port: 8081 },
    ],
  });

  assert.strictEqual(invalidConfig.valid, false);
  assert.ok(invalidConfig.errors.some((error) => error.includes("Duplicate proxy id")));

  const duplicateTitles = Shared.validateConfig({
    proxies: [
      { id: "proxy-1", title: "Burp", type: "http", host: "127.0.0.1", port: 8080 },
      { id: "proxy-2", title: "burp", type: "http", host: "127.0.0.2", port: 8081 },
    ],
  });

  assert.strictEqual(duplicateTitles.valid, false);
  assert.ok(
    duplicateTitles.errors.some((error) => error.includes("Duplicate proxy title")),
  );
});

test("allows incomplete proxy and host rule drafts in saved config", () => {
  const validation = Shared.validateConfig({
    proxies: [
      {
        id: "proxy-1",
        title: "Proxy 1",
        type: "http",
        host: "",
        port: 8080,
      },
    ],
    hostRules: [
      {
        id: "host-rule-1",
        name: "Host Rule 1",
        enabled: true,
        mode: "blacklist",
        patterns: [],
        exceptions: [],
      },
    ],
  });

  assert.strictEqual(validation.valid, true);
});

test("reports draft status for incomplete proxies and host rules", () => {
  const proxyStatus = Shared.getProxyStatus({
    id: "proxy-1",
    type: "http",
    host: "",
    port: 8080,
  });
  const hostRuleDraftStatus = Shared.getHostRuleStatus({
    id: "host-rule-1",
    enabled: true,
    patterns: [],
  });
  const hostRuleDisabledStatus = Shared.getHostRuleStatus({
    id: "host-rule-2",
    enabled: false,
    patterns: ["example.com"],
  });

  assert.strictEqual(proxyStatus.status, "incomplete");
  assert.strictEqual(proxyStatus.isActivable, false);
  assert.strictEqual(
    proxyStatus.reason,
    "Add a host to activate this proxy.",
  );
  assert.strictEqual(hostRuleDraftStatus.status, "incomplete");
  assert.strictEqual(hostRuleDraftStatus.isActivable, false);
  assert.strictEqual(
    hostRuleDraftStatus.reason,
    "Add at least one host pattern to activate this rule.",
  );
  assert.strictEqual(hostRuleDisabledStatus.status, "complete");
  assert.strictEqual(hostRuleDisabledStatus.isActivable, false);
});

test("builds tab summaries from visible containers and activable entries", () => {
  global.PrivacyContainersShared = Shared;
  delete require.cache[require.resolve("../options/app.js")];
  const { buildTabSummaries } = require("../options/app.js");

  try {
    const summaries = buildTabSummaries(
      {
        proxies: [
          {
            id: "proxy-1",
            type: "http",
            host: "127.0.0.1",
            port: 8080,
          },
          {
            id: "proxy-2",
            type: "http",
            host: "",
            port: 8081,
          },
        ],
        hostRules: [
          {
            id: "host-rule-1",
            enabled: true,
            patterns: ["example.com"],
          },
          {
            id: "host-rule-2",
            enabled: true,
            patterns: [],
          },
          {
            id: "host-rule-3",
            enabled: false,
            patterns: ["internal.example"],
          },
        ],
      },
      [
        {
          cookieStoreId: "firefox-container-1",
          name: "Work",
        },
        {
          cookieStoreId: "firefox-container-2",
          name: "Personal",
        },
      ],
    );

    assert.deepStrictEqual(summaries, [
      {
        id: "containers",
        title: "Containers",
        activeCount: 3,
        draftCount: 0,
        activeLabel: "3 active",
      },
      {
        id: "proxies",
        title: "Proxies",
        activeCount: 1,
        draftCount: 1,
        activeLabel: "1 active",
      },
      {
        id: "host-rules",
        title: "Host Rules",
        activeCount: 1,
        draftCount: 1,
        activeLabel: "1 active",
      },
    ]);
  } finally {
    delete require.cache[require.resolve("../options/app.js")];
    delete global.PrivacyContainersShared;
  }
});

test("maps the active tab to the header create action label", () => {
  global.PrivacyContainersShared = Shared;
  delete require.cache[require.resolve("../options/app.js")];
  const { getHeaderPrimaryActionDescriptor } = require("../options/app.js");

  try {
    assert.deepStrictEqual(getHeaderPrimaryActionDescriptor("containers"), {
      tabId: "containers",
      label: "Create new container",
    });
    assert.deepStrictEqual(getHeaderPrimaryActionDescriptor("proxies"), {
      tabId: "proxies",
      label: "Create new proxy",
    });
    assert.deepStrictEqual(getHeaderPrimaryActionDescriptor("host-rules"), {
      tabId: "host-rules",
      label: "Create new host rule",
    });
  } finally {
    delete require.cache[require.resolve("../options/app.js")];
    delete global.PrivacyContainersShared;
  }
});

test("reports internal shortcut conflicts explicitly", () => {
  global.PrivacyContainersShared = Shared;
  delete require.cache[require.resolve("../options/app.js")];
  const { getInternalShortcutConflictIssue } = require("../options/app.js");

  try {
    const commands = [
      {
        name: Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND,
        shortcut: "Ctrl+Alt+C",
        description: "Open a new tab in the current container",
      },
      {
        name: Shared.getOpenContainerSlotCommandName(1),
        shortcut: "Ctrl+Alt+W",
        description: "Open a new tab in Work",
      },
    ];
    const containers = [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
      },
    ];

    assert.strictEqual(
      getInternalShortcutConflictIssue(
        Shared.getReopenContainerSlotCommandName(1),
        "Ctrl+Alt+W",
        commands,
        containers,
      ),
      'Shortcut "Ctrl+Alt+W" is already used by "Open a new tab in Work".',
    );
    assert.strictEqual(
      getInternalShortcutConflictIssue(
        Shared.getOpenContainerSlotCommandName(1),
        "Ctrl+Alt+W",
        commands,
        containers,
      ),
      "",
    );
    assert.strictEqual(
      getInternalShortcutConflictIssue(
        Shared.getReopenContainerSlotCommandName(1),
        "",
        commands,
        containers,
      ),
      "",
    );
  } finally {
    delete require.cache[require.resolve("../options/app.js")];
    delete global.PrivacyContainersShared;
  }
});

test("builds internal shortcut conflict labels from slot assignments", () => {
  global.PrivacyContainersShared = Shared;
  delete require.cache[require.resolve("../options/app.js")];
  const { getInternalShortcutConflictIssue } = require("../options/app.js");

  try {
    const commands = [
      {
        name: Shared.getReopenContainerSlotCommandName(1),
        shortcut: "Ctrl+Alt+R",
      },
    ];
    const containers = [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
      },
    ];

    assert.strictEqual(
      getInternalShortcutConflictIssue(
        Shared.getOpenContainerSlotCommandName(2),
        "Ctrl+Alt+R",
        commands,
        containers,
      ),
      'Shortcut "Ctrl+Alt+R" is already used by "Reopen the current tab in Work".',
    );
  } finally {
    delete require.cache[require.resolve("../options/app.js")];
    delete global.PrivacyContainersShared;
  }
});

test("builds readable internal shortcut conflict labels for fixed tab commands", () => {
  global.PrivacyContainersShared = Shared;
  delete require.cache[require.resolve("../options/app.js")];
  const { getInternalShortcutConflictIssue } = require("../options/app.js");

  try {
    const conflictCases = [
      {
        name: Shared.GO_ONE_TAB_LEFT_COMMAND,
        shortcut: "Ctrl+Alt+Left",
        expected:
          'Shortcut "Ctrl+Alt+Left" is already used by "Go one tab to the left".',
      },
      {
        name: Shared.GO_ONE_TAB_RIGHT_COMMAND,
        shortcut: "Ctrl+Alt+Right",
        expected:
          'Shortcut "Ctrl+Alt+Right" is already used by "Go one tab to the right".',
      },
      {
        name: Shared.MOVE_TAB_LEFT_COMMAND,
        shortcut: "Ctrl+Shift+PageUp",
        expected:
          'Shortcut "Ctrl+Shift+PageUp" is already used by "Move tab left".',
      },
      {
        name: Shared.MOVE_TAB_RIGHT_COMMAND,
        shortcut: "Ctrl+Shift+PageDown",
        expected:
          'Shortcut "Ctrl+Shift+PageDown" is already used by "Move tab right".',
      },
      {
        name: Shared.TOGGLE_TAB_PINNED_COMMAND,
        shortcut: "Ctrl+Alt+P",
        expected:
          'Shortcut "Ctrl+Alt+P" is already used by "Pin/Unpin tab".',
      },
    ];

    conflictCases.forEach(({ name, shortcut, expected }) => {
      assert.strictEqual(
        getInternalShortcutConflictIssue(
          Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND,
          shortcut,
          [{ name, shortcut }],
          [],
        ),
        expected,
      );
    });
  } finally {
    delete require.cache[require.resolve("../options/app.js")];
    delete global.PrivacyContainersShared;
  }
});

test("preserves missing proxy references as blocking assignments", () => {
  const config = Shared.normalizeConfig({
    containerSettings: {
      "firefox-container-1": {
        proxyId: "missing-proxy",
      },
    },
  });
  const assignment = Shared.resolveProxyAssignment(
    config,
    "firefox-container-1",
  );

  assert.strictEqual(
    Shared.getAssignedProxyId(config, "firefox-container-1"),
    "missing-proxy",
  );
  assert.strictEqual(assignment.status, "invalid-reference");
  assert.strictEqual(assignment.isBlocking, true);
  assert.strictEqual(
    Shared.getEffectiveProxy(config, "firefox-container-1"),
    null,
  );
});

test("parses valid multiline headers", () => {
  const result = Shared.parseHeaderLines("X-One: 1\nX-Two: two:three");

  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(
    result.headers.map((header) => ({
      name: header.name,
      value: header.value,
    })),
    [
      { name: "X-One", value: "1" },
      { name: "X-Two", value: "two:three" },
    ],
  );
});

test("reports invalid multiline headers", () => {
  const result = Shared.parseHeaderLines("Bad Header: value\nX-Test value");

  assert.strictEqual(result.valid, false);
  assert.deepStrictEqual(result.errors, [
    { line: 1, message: "Header name is invalid" },
    { line: 2, message: 'Missing ":" separator' },
  ]);
});

test("formats headers back to multiline text", () => {
  const text = Shared.headersToMultilineText([
    {
      id: "header-1",
      name: "X-One",
      value: "1",
    },
    {
      id: "header-2",
      name: "X-Two",
      value: "two",
    },
  ]);

  assert.strictEqual(text, "X-One: 1\nX-Two: two");
});

test("merges request headers with scoped precedence in one pass", () => {
  const merged = Shared.mergeRequestHeaders(
    [
      { name: "X-Global", value: "old-global" },
      { name: "X-Scoped", value: "old-scoped-1" },
      { name: "X-Scoped", value: "old-scoped-2" },
      { name: "Accept", value: "*/*" },
    ],
    [
      { name: "X-PwnFox-Color", value: "cyan" },
      { name: "X-Global", value: "global" },
      { name: "X-Scoped", value: "scoped" },
    ],
  );

  assert.deepStrictEqual(merged, [
    { name: "X-Global", value: "global" },
    { name: "X-Scoped", value: "scoped" },
    { name: "Accept", value: "*/*" },
    { name: "X-PwnFox-Color", value: "cyan" },
  ]);
});

test("merges request headers with a compiled header plan", () => {
  const plan = Shared.compileHeaderPlan(
    [{ id: "g1", name: "X-Global", value: "global" }],
    [
      { id: "s1", name: "X-Scoped", value: "scoped" },
      { id: "s2", name: "X-Scoped", value: "scoped-last" },
    ],
    "cyan",
  );
  const merged = Shared.mergeRequestHeadersWithCompiledPlan(
    [
      { name: "X-Global", value: "old-global" },
      { name: "X-Scoped", value: "old-scoped-1" },
      { name: "X-Scoped", value: "old-scoped-2" },
      { name: "Accept", value: "*/*" },
    ],
    plan,
  );

  assert.deepStrictEqual(merged, [
    { name: "X-Global", value: "global" },
    { name: "X-Scoped", value: "scoped-last" },
    { name: "Accept", value: "*/*" },
    { name: "X-PwnFox-Color", value: "cyan" },
  ]);
});

test("merges request headers with a single compiled header plan", () => {
  const plan = Shared.compileHeaderPlan(
    [],
    [{ id: "s1", name: "X-Scoped", value: "scoped" }],
    "",
  );
  const merged = Shared.mergeRequestHeadersWithCompiledPlan(
    [
      { name: "X-Scoped", value: "old-scoped-1" },
      { name: "Accept", value: "*/*" },
      { name: "x-scoped", value: "old-scoped-2" },
    ],
    plan,
  );

  assert.deepStrictEqual(merged, [
    { name: "Accept", value: "*/*" },
    { name: "X-Scoped", value: "scoped" },
  ]);
});

test("appends a single compiled header plan when request has no match", () => {
  const plan = Shared.compileHeaderPlan(
    [],
    [{ id: "s1", name: "X-Scoped", value: "scoped" }],
    "",
  );
  const merged = Shared.mergeRequestHeadersWithCompiledPlan(
    [{ name: "Accept", value: "*/*" }],
    plan,
  );

  assert.deepStrictEqual(merged, [
    { name: "Accept", value: "*/*" },
    { name: "X-Scoped", value: "scoped" },
  ]);
});

test("merges request headers with a small compiled header plan", () => {
  const plan = Shared.compileHeaderPlan(
    [],
    [
      { id: "s1", name: "X-One", value: "one" },
      { id: "s2", name: "X-Two", value: "two" },
      { id: "s3", name: "X-Three", value: "three" },
    ],
    "",
  );
  const merged = Shared.mergeRequestHeadersWithCompiledPlan(
    [
      { name: "X-Two", value: "old-two-1" },
      { name: "Accept", value: "*/*" },
      { name: "x-two", value: "old-two-2" },
      { name: "X-One", value: "old-one" },
    ],
    plan,
  );

  assert.deepStrictEqual(merged, [
    { name: "Accept", value: "*/*" },
    { name: "X-Two", value: "two" },
    { name: "X-One", value: "one" },
    { name: "X-Three", value: "three" },
  ]);
});

test("maps supported PwnFox colors", () => {
  assert.strictEqual(Shared.getPwnFoxColorValue("turquoise"), "cyan");
  assert.strictEqual(Shared.getPwnFoxColorValue("purple"), "magenta");
  assert.strictEqual(Shared.getPwnFoxColorValue("toolbar"), "");
});

test("derives slot metadata from live container order", () => {
  const slots = Shared.getContainerSlots([
    {
      cookieStoreId: "firefox-container-1",
      name: "Work",
      color: "blue",
      icon: "briefcase",
    },
    {
      cookieStoreId: "firefox-container-2",
      name: "Shop",
      color: "orange",
      icon: "cart",
    },
  ]);

  assert.deepStrictEqual(
    slots.map((slot) => ({
      slot: slot.slot,
      id: slot.cookieStoreId,
      supportsShortcuts: slot.supportsShortcuts,
    })),
    [
      {
        slot: 0,
        id: Shared.FIREFOX_DEFAULT_CONTAINER,
        supportsShortcuts: true,
      },
      { slot: 1, id: "firefox-container-1", supportsShortcuts: true },
      { slot: 2, id: "firefox-container-2", supportsShortcuts: true },
    ],
  );
});

test("tracks proxy dependents by container name", () => {
  const config = Shared.normalizeConfig({
    proxies: [
      { id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 },
    ],
    containerSettings: {
      "firefox-container-1": { proxyId: "proxy-1" },
      "firefox-container-2": { proxyId: "proxy-1" },
    },
  });

  const names = Shared.getDependentContainerNames(
    config,
    [
      { cookieStoreId: "firefox-container-1", name: "Work" },
      { cookieStoreId: "firefox-container-2", name: "Shop" },
    ],
    "proxy-1",
  );

  assert.deepStrictEqual(names, ["Work", "Shop"]);
});

test("cleans removed container references", () => {
  const cleaned = Shared.cleanupRemovedContainer(
    {
      containerSettings: {
        "firefox-container-1": {
          proxyId: "proxy-1",
          headers: [{ id: "h1", name: "X-Test", value: "1" }],
        },
      },
    },
    "firefox-container-1",
  );

  assert.deepStrictEqual(cleaned.containerSettings, {});
});

test("cleans removed proxy references", () => {
  const cleaned = Shared.cleanupRemovedProxy(
    {
      proxies: [{ id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 }],
      containerSettings: {
        "firefox-container-1": { proxyId: "proxy-1" },
      },
    },
    "proxy-1",
  );

  assert.deepStrictEqual(cleaned.proxies, []);
  assert.strictEqual(
    cleaned.containerSettings["firefox-container-1"],
    undefined,
  );
});

test("accepts only reopenable tab urls", () => {
  assert.strictEqual(Shared.canReopenTabUrl("https://example.com"), true);
  assert.strictEqual(Shared.canReopenTabUrl("http://example.com"), true);
  assert.strictEqual(Shared.canReopenTabUrl("about:blank"), false);
  assert.strictEqual(Shared.canReopenTabUrl("file:///tmp/a.txt"), false);
});

test("validates actionable and reopenable active tabs", () => {
  assert.deepStrictEqual(
    Shared.getActionableTabValidation(null, "moz-extension://test/"),
    {
      valid: false,
      reason: "No active browser tab found in the current window",
    },
  );
  assert.deepStrictEqual(
    Shared.getActionableTabValidation(
      { active: true, url: "moz-extension://test/options/app.html" },
      "moz-extension://test/",
    ),
    {
      valid: false,
      reason: "The active tab is this extension page",
    },
  );
  assert.deepStrictEqual(
    Shared.getActionableTabValidation(
      { active: true, url: "about:blank" },
      "moz-extension://test/",
    ),
    {
      valid: false,
      reason: "The active tab is not an http or https page",
    },
  );
  assert.deepStrictEqual(
    Shared.getReopenableTabValidation(
      { active: true, url: "https://example.com" },
      "moz-extension://test/",
    ),
    {
      valid: true,
      reason: "",
    },
  );
});

test("builds cookie removal urls for domains and IPv6 hosts", () => {
  assert.strictEqual(
    Shared.buildCookieRemovalUrl({
      secure: true,
      domain: ".example.com",
      path: "/login",
    }),
    "https://example.com/login",
  );
  assert.strictEqual(
    Shared.buildCookieRemovalUrl({
      secure: false,
      domain: "2001:db8::1",
      path: "",
    }),
    "http://[2001:db8::1]/",
  );
  assert.strictEqual(
    Shared.buildCookieRemovalUrl({
      secure: true,
      domain: "[::1]",
    }),
    "https://[::1]/",
  );
});

test("supports proxy auth only for http and https proxies", () => {
  assert.strictEqual(Shared.supportsProxyAuth({ type: "http" }), true);
  assert.strictEqual(Shared.supportsProxyAuth({ type: "https" }), true);
  assert.strictEqual(Shared.supportsProxyAuth({ type: "socks" }), false);
  assert.strictEqual(Shared.supportsProxyAuth({ type: "socks4" }), false);
});

test("migrates legacy bypass settings onto each proxy", () => {
  const config = Shared.normalizeConfig({
    bypass: {
      optionsMethod: true,
      customEnabled: true,
      customHosts: ["internal.test"],
    },
    proxies: [
      { id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 },
    ],
  });

  assert.deepStrictEqual(config.proxies[0].bypass, {
    optionsMethod: true,
    customHostsEnabled: true,
    customHosts: Shared.uniqueSortedHosts(
      [...Shared.DEFAULT_TELEMETRY_HOSTS, "internal.test"],
      Shared.DEFAULT_TELEMETRY_HOSTS,
    ),
  });
});

test("keeps explicit custom bypass hosts exactly as saved", () => {
  const proxy = Shared.normalizeProxy({
    id: "proxy-1",
    type: "http",
    host: "127.0.0.1",
    port: "8080",
    bypass: {
      customHostsEnabled: true,
      customHosts: ["google.tk"],
    },
  });

  assert.deepStrictEqual(proxy.bypass, {
    optionsMethod: false,
    customHostsEnabled: true,
    customHosts: ["google.tk"],
  });
});

test("compiles bypass rules with exact host, subdomains and OPTIONS", () => {
  const matcher = Shared.compileBypassMatcher({
    optionsMethod: true,
    customHostsEnabled: true,
    customHosts: ["example.com", "internal.test"],
  });

  assert.strictEqual(matcher.matches("OPTIONS", "whatever.test"), true);
  assert.strictEqual(matcher.matches("GET", "example.com"), true);
  assert.strictEqual(matcher.matches("GET", "api.example.com"), true);
  assert.strictEqual(matcher.matches("GET", "internal.test"), true);
  assert.strictEqual(matcher.matches("GET", "api.internal.test"), true);
  assert.strictEqual(matcher.matches("GET", "other.test"), false);
});

test("normalizes config bundles and legacy config payloads", () => {
  const fromLegacy = Shared.normalizeConfigBundle({
    proxies: [{ id: "proxy-1", type: "http", host: "127.0.0.1", port: 8080 }],
  });
  const fromBundle = Shared.normalizeConfigBundle({
    meta: { revision: 3, writer: "test", updatedAt: "2024-01-01T00:00:00.000Z" },
    config: {
      proxies: [{ id: "proxy-2", type: "http", host: "127.0.0.2", port: 8081 }],
    },
  });

  assert.strictEqual(fromLegacy.meta.schemaVersion, Shared.CONFIG_SCHEMA_VERSION);
  assert.strictEqual(fromLegacy.meta.revision, 0);
  assert.strictEqual(fromBundle.meta.revision, 3);
  assert.strictEqual(fromBundle.meta.writer, "test");
  assert.strictEqual(fromBundle.config.proxies[0].id, "proxy-2");
});

test("normalizes host rule cards and enabled flags", () => {
  const rule = Shared.normalizeHostRuleCard({
    id: "rule-1",
    name: " Work only ",
    enabled: "false",
    mode: "whitelist",
    patterns: [" Example.com ", "*.Corp.Internal", "example.com"],
    exceptions: ["firefox-container-1", "firefox-container-1", "firefox-default"],
  });

  assert.deepStrictEqual(rule, {
    id: "rule-1",
    name: "Work only",
    enabled: false,
    mode: "whitelist",
    patterns: ["example.com", "*.corp.internal"],
    exceptions: ["firefox-container-1", "firefox-default"],
  });
});

test("parses host pattern lines and reports invalid lines", () => {
  const result = Shared.parseHostPatternLines(
    "Example.com\nhttps://bad.example/path\n*.corp.internal\ndev-*.tesla.com",
  );

  assert.strictEqual(result.valid, false);
  assert.deepStrictEqual(result.patterns, [
    "example.com",
    "*.corp.internal",
    "dev-*.tesla.com",
  ]);
  assert.deepStrictEqual(result.errors, [
    {
      line: 2,
      message: "Scheme is not allowed",
    },
  ]);
});

test("compiles host patterns for exact, suffix and internal wildcards", () => {
  const exact = Shared.compileHostPattern("www.google.com");
  const suffix = Shared.compileHostPattern("*.test.fr");
  const internal = Shared.compileHostPattern("dev-*.tesla.com");

  assert.strictEqual(exact.matchesNormalizedHost("www.google.com"), true);
  assert.strictEqual(exact.matchesNormalizedHost("api.www.google.com"), false);
  assert.strictEqual(suffix.matchesNormalizedHost("shop.test.fr"), true);
  assert.strictEqual(suffix.matchesNormalizedHost("test.fr"), false);
  assert.strictEqual(internal.matchesNormalizedHost("dev-api.tesla.com"), true);
  assert.strictEqual(internal.matchesNormalizedHost("dev.tesla.com"), false);
});

test("compiles host rule plans with exact and wildcard buckets", () => {
  const plan = Shared.compileHostRulePlan({
    id: "rule-1",
    name: "Buckets",
    enabled: true,
    mode: "blacklist",
    patterns: ["example.com", "*.corp.internal", "dev-*.tesla.com"],
    exceptions: [],
  });

  assert.deepStrictEqual(plan.exactPatterns, ["example.com"]);
  assert.strictEqual(plan.exactPatternsSet.has("example.com"), true);
  assert.strictEqual(plan.wildcardPatterns.length, 2);
  assert.strictEqual(plan.defaultDecision, "block");
});

test("decides blacklist and whitelist host rules with container exceptions", () => {
  const blacklist = Shared.compileHostRulePlan({
    id: "rule-1",
    name: "Blacklist",
    enabled: true,
    mode: "blacklist",
    patterns: ["example.com"],
    exceptions: ["firefox-container-1", Shared.FIREFOX_DEFAULT_CONTAINER],
  });
  const whitelist = Shared.compileHostRulePlan({
    id: "rule-2",
    name: "Whitelist",
    enabled: true,
    mode: "whitelist",
    patterns: ["admin.example.com"],
    exceptions: ["firefox-container-2"],
  });

  assert.strictEqual(blacklist.decideForContainer("firefox-container-1"), "allow");
  assert.strictEqual(
    blacklist.decideForContainer(Shared.FIREFOX_DEFAULT_CONTAINER),
    "allow",
  );
  assert.strictEqual(blacklist.decideForContainer("firefox-container-9"), "block");
  assert.strictEqual(whitelist.decideForContainer("firefox-container-9"), "allow");
  assert.strictEqual(whitelist.decideForContainer("firefox-container-2"), "block");
});

test("applies first matching host rule and ignores disabled cards at runtime", () => {
  const runtime = Shared.compileRuntime(
    {
      hostRules: [
        {
          id: "rule-1",
          name: "First",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
        {
          id: "rule-2",
          name: "Disabled override",
          enabled: false,
          mode: "whitelist",
          patterns: ["example.com"],
          exceptions: ["firefox-container-1"],
        },
        {
          id: "rule-3",
          name: "Last wins",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: ["firefox-container-1"],
        },
      ],
    },
    [],
  );
  const allowed = Shared.getHostRuleDecision(
    runtime.hostRuleRuntime,
    "example.com",
    "firefox-container-1",
  );
  const blocked = Shared.getHostRuleDecision(
    runtime.hostRuleRuntime,
    "example.com",
    "firefox-container-9",
  );
  const blockedFromNormalized = Shared.getHostRuleDecisionForNormalizedHost(
    runtime.hostRuleRuntime,
    "example.com",
    "firefox-container-9",
  );

  assert.strictEqual(runtime.hostRuleRuntime.hasAnyRules, true);
  assert.strictEqual(runtime.hostRuleRuntime.hasAnyEnabledRules, true);
  assert.strictEqual(runtime.hostRuleRuntime.orderedHostRulePlans.length, 2);
  assert.strictEqual(allowed.ruleId, "rule-1");
  assert.strictEqual(allowed.decision, "block");
  assert.strictEqual(blocked.ruleId, "rule-1");
  assert.strictEqual(blocked.decision, "block");
  assert.strictEqual(blockedFromNormalized.ruleId, "rule-1");
  assert.strictEqual(blockedFromNormalized.decision, "block");
});

test("prefers the first host-rule match across exact and wildcard indexes", () => {
  const runtime = Shared.compileRuntime(
    {
      hostRules: [
        {
          id: "rule-1",
          name: "Early exact",
          enabled: true,
          mode: "blacklist",
          patterns: ["app.example.com"],
          exceptions: [],
        },
        {
          id: "rule-2",
          name: "Later wildcard",
          enabled: true,
          mode: "whitelist",
          patterns: ["*.example.com"],
          exceptions: ["firefox-container-1"],
        },
        {
          id: "rule-3",
          name: "Latest exact",
          enabled: true,
          mode: "blacklist",
          patterns: ["app.example.com"],
          exceptions: ["firefox-container-1"],
        },
      ],
    },
    [],
  );

  const decision = Shared.getHostRuleDecisionForNormalizedHost(
    runtime.hostRuleRuntime,
    "app.example.com",
    "firefox-container-1",
  );

  assert.strictEqual(runtime.hostRuleRuntime.exactPlanIndexByHost.get("app.example.com"), 0);
  assert.strictEqual(decision.ruleId, "rule-1");
  assert.strictEqual(decision.decision, "block");
});

test("prefers an earlier wildcard over a later exact host rule", () => {
  const runtime = Shared.compileRuntime(
    {
      hostRules: [
        {
          id: "rule-1",
          name: "Early wildcard",
          enabled: true,
          mode: "whitelist",
          patterns: ["*.example.com"],
          exceptions: ["firefox-container-1"],
        },
        {
          id: "rule-2",
          name: "Later exact",
          enabled: true,
          mode: "blacklist",
          patterns: ["app.example.com"],
          exceptions: [],
        },
      ],
    },
    [],
  );

  const decision = Shared.getHostRuleDecisionForNormalizedHost(
    runtime.hostRuleRuntime,
    "app.example.com",
    "firefox-container-9",
  );

  assert.strictEqual(decision.ruleId, "rule-1");
  assert.strictEqual(decision.decision, "allow");
});

test("prefers an earlier fallback wildcard over later indexed matches", () => {
  const runtime = Shared.compileRuntime(
    {
      hostRules: [
        {
          id: "rule-1",
          name: "Early fallback",
          enabled: true,
          mode: "whitelist",
          patterns: ["dev-*"],
          exceptions: ["firefox-container-1"],
        },
        {
          id: "rule-2",
          name: "Later suffix wildcard",
          enabled: true,
          mode: "blacklist",
          patterns: ["*.example.com"],
          exceptions: [],
        },
        {
          id: "rule-3",
          name: "Later exact",
          enabled: true,
          mode: "blacklist",
          patterns: ["dev-api.example.com"],
          exceptions: [],
        },
      ],
    },
    [],
  );

  const decision = Shared.getHostRuleDecisionForNormalizedHost(
    runtime.hostRuleRuntime,
    "dev-api.example.com",
    "firefox-container-9",
  );

  assert.strictEqual(decision.ruleId, "rule-1");
  assert.strictEqual(decision.decision, "allow");
});

test("detects obvious overlaps across active host rules only", () => {
  const overlaps = Shared.detectPossibleHostRuleOverlapIds([
    {
      id: "rule-1",
      name: "Exact",
      enabled: true,
      mode: "blacklist",
      patterns: ["api.example.com"],
      exceptions: [],
    },
    {
      id: "rule-2",
      name: "Wildcard",
      enabled: true,
      mode: "blacklist",
      patterns: ["*.example.com"],
      exceptions: [],
    },
    {
      id: "rule-3",
      name: "Disabled duplicate",
      enabled: false,
      mode: "blacklist",
      patterns: ["api.example.com"],
      exceptions: [],
    },
  ]);

  assert.strictEqual(overlaps.has("rule-1"), true);
  assert.strictEqual(overlaps.has("rule-2"), true);
  assert.strictEqual(overlaps.has("rule-3"), false);
});

test("tracks missing containers and host rule dependents", () => {
  const config = Shared.normalizeConfig({
    hostRules: [
      {
        id: "rule-1",
        name: "Work sites",
        enabled: true,
        mode: "blacklist",
        patterns: ["work.example.com"],
        exceptions: ["firefox-container-1", "firefox-container-9"],
      },
    ],
  });
  const missing = Shared.getHostRuleMissingContainerRefs(config, [
    { cookieStoreId: "firefox-container-1", name: "Work" },
  ]);
  const dependents = Shared.getDependentHostRuleNames(
    config,
    "firefox-container-1",
  );

  assert.deepStrictEqual(missing, [
    {
      ruleId: "rule-1",
      ruleName: "Work sites",
      missingCookieStoreIds: ["firefox-container-9"],
    },
  ]);
  assert.deepStrictEqual(dependents, ["Work sites"]);
});

test("detects duplicate live container names and ambiguous host rule refs", () => {
  const config = Shared.normalizeConfig({
    hostRules: [
      {
        id: "rule-1",
        name: "Work sites",
        enabled: true,
        mode: "blacklist",
        patterns: ["work.example.com"],
        exceptions: ["firefox-container-1", "firefox-container-2"],
      },
    ],
  });
  const containers = [
    {
      cookieStoreId: "firefox-container-1",
      name: "Work",
      icon: "briefcase",
      color: "blue",
    },
    {
      cookieStoreId: "firefox-container-2",
      name: "Work",
      icon: "briefcase",
      color: "red",
    },
  ];

  const duplicateGroups = Shared.getDuplicateLiveContainerGroups(containers);
  const report = Shared.getContainerIntegrityReport(config, containers);

  assert.deepStrictEqual(duplicateGroups, [
    {
      normalizedName: "work",
      name: "Work",
      count: 2,
      containers: [
        {
          slot: 1,
          cookieStoreId: "firefox-container-1",
          technicalLabel: "container-1",
          name: "Work",
          icon: "briefcase",
          iconUrl: "",
          color: "blue",
          isDefault: false,
        },
        {
          slot: 2,
          cookieStoreId: "firefox-container-2",
          technicalLabel: "container-2",
          name: "Work",
          icon: "briefcase",
          iconUrl: "",
          color: "red",
          isDefault: false,
        },
      ],
    },
  ]);
  assert.deepStrictEqual(report.ambiguousContainerIds, [
    "firefox-container-1",
    "firefox-container-2",
  ]);
  assert.deepStrictEqual(report.ambiguousHostRuleRefs, [
    {
      ruleId: "rule-1",
      ruleName: "Work sites",
      ambiguousCookieStoreIds: [
        "firefox-container-1",
        "firefox-container-2",
      ],
    },
  ]);
});

test("tracks tabs by cookieStoreId in the extracted tab index module", () => {
  const state = {
    tabCookieStoreIdByTabId: new Map(),
    tabIdsByCookieStoreId: new Map(),
  };
  const tabIndex = createTabIndex({ state, Shared });

  assert.strictEqual(
    tabIndex.trackTab({ id: 1, cookieStoreId: "firefox-container-1" }),
    "firefox-container-1",
  );
  assert.strictEqual(
    tabIndex.trackTab({ id: 2, cookieStoreId: "" }),
    Shared.FIREFOX_DEFAULT_CONTAINER,
  );
  assert.strictEqual(tabIndex.getTrackedCookieStoreId(1), "firefox-container-1");
  assert.strictEqual(
    tabIndex.getTrackedCookieStoreId(2),
    Shared.FIREFOX_DEFAULT_CONTAINER,
  );

  tabIndex.trackTab({ id: 1, cookieStoreId: "firefox-container-2" });
  assert.strictEqual(tabIndex.getTrackedCookieStoreId(1), "firefox-container-2");
  assert.deepStrictEqual(
    Array.from(tabIndex.getTrackedTabIdsForCookieStoreId("firefox-container-2")),
    [1],
  );

  tabIndex.untrackTab(1);
  assert.strictEqual(tabIndex.getTrackedCookieStoreId(1), "");
  assert.strictEqual(
    tabIndex.getTrackedTabIdsForCookieStoreId("firefox-container-2"),
    null,
  );
});

test("queries firefox for the current active tab on shortcut actions", async () => {
  const browser = {
    tabs: {
      queried: 0,
      async query() {
        this.queried += 1;
        return [
          {
            active: true,
            cookieStoreId: "firefox-container-1",
            id: 7,
            index: 3,
            pinned: false,
            url: "https://example.com",
            windowId: 4,
          },
        ];
      },
    },
  };
  const tabActions = createTabActions({ Shared, browser });

  const tab = await tabActions.getCurrentBrowserTab();

  assert.strictEqual(browser.tabs.queried, 1);
  assert.strictEqual(tab.id, 7);
  assert.strictEqual(tab.windowId, 4);
});

test("returns null when firefox reports no active current-window tab", async () => {
  const browser = {
    tabs: {
      queried: 0,
      async query() {
        this.queried += 1;
        return [];
      },
    },
  };
  const tabActions = createTabActions({ Shared, browser });

  assert.strictEqual(await tabActions.getCurrentBrowserTab(), null);
  assert.strictEqual(browser.tabs.queried, 1);
});

test("reopens the current tab in another container from the queried active tab", async () => {
  const browser = {
    tabs: {
      created: [],
      queried: 0,
      removed: [],
      async create(details) {
        this.created.push(details);
        return {
          id: 99,
          ...details,
        };
      },
      async query() {
        this.queried += 1;
        return [
          {
            id: 11,
            active: true,
            cookieStoreId: "firefox-container-1",
            index: 5,
            pinned: true,
            url: "https://fresh.example.com",
            windowId: 2,
          },
        ];
      },
      async remove(tabId) {
        this.removed.push(tabId);
      },
    },
  };
  const tabActions = createTabActions({ Shared, browser });

  await tabActions.reopenCurrentTabInContainer("firefox-container-9");

  assert.strictEqual(browser.tabs.queried, 1);
  assert.deepStrictEqual(browser.tabs.created, [
    {
      active: true,
      cookieStoreId: "firefox-container-9",
      index: 6,
      pinned: true,
      url: "https://fresh.example.com",
      windowId: 2,
    },
  ]);
  assert.deepStrictEqual(browser.tabs.removed, [11]);
});

test("reopens blank tabs in the requested container without a URL", async () => {
  const activeTab = {
    id: 12,
    active: true,
    cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
    index: 1,
    pinned: false,
    url: "about:newtab",
    windowId: 2,
  };
  const browser = createReopenBrowser(activeTab);
  const tabActions = createTabActions({ Shared, browser });

  await tabActions.reopenCurrentTabInContainer("firefox-container-9");

  assert.deepStrictEqual(browser.tabs.created, [
    {
      active: true,
      cookieStoreId: "firefox-container-9",
      index: 2,
      pinned: false,
      windowId: 2,
    },
  ]);
  assert.deepStrictEqual(browser.tabs.removed, [12]);
  assert.deepStrictEqual(browser.notifications.created, []);

  activeTab.url = "about:blank";
  browser.tabs.created.length = 0;
  browser.tabs.removed.length = 0;

  await tabActions.reopenCurrentTabInContainer("firefox-container-9");

  assert.strictEqual(browser.tabs.created.length, 1);
  assert.strictEqual("url" in browser.tabs.created[0], false);
  assert.deepStrictEqual(browser.tabs.removed, [12]);
});

test("reopens other special URLs in the default container with a notice", async () => {
  const activeTab = {
    id: 13,
    active: true,
    cookieStoreId: "firefox-container-9",
    index: 2,
    pinned: true,
    url: "about:debugging#/runtime/this-firefox",
    windowId: 3,
  };
  const browser = createReopenBrowser(activeTab);
  const tabActions = createTabActions({ Shared, browser });

  assert.strictEqual(
    await tabActions.reopenCurrentTabInContainer("firefox-container-1"),
    true,
  );

  assert.deepStrictEqual(browser.tabs.created, [
    {
      active: true,
      index: 3,
      pinned: true,
      url: "about:debugging#/runtime/this-firefox",
      windowId: 3,
    },
  ]);
  assert.deepStrictEqual(browser.tabs.removed, [13]);
  assert.strictEqual(browser.notifications.created.length, 1);
  assert.deepStrictEqual(browser.notifications.created[0].details, {
    type: "basic",
    iconUrl: "moz-extension://test/res/icon.png",
    title: "Default container required",
    message: "This URL can only be opened in Firefox's default container.",
  });
});

test("leaves special URLs untouched when they cannot be moved to default", async () => {
  const activeTab = {
    id: 14,
    active: true,
    cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
    index: 3,
    pinned: false,
    url: "file:///tmp/example.txt",
    windowId: 4,
  };
  const browser = createReopenBrowser(activeTab);
  const tabActions = createTabActions({ Shared, browser });

  assert.strictEqual(
    await tabActions.reopenCurrentTabInContainer("firefox-container-1"),
    false,
  );
  assert.deepStrictEqual(browser.tabs.created, []);
  assert.deepStrictEqual(browser.tabs.removed, []);
  assert.strictEqual(browser.notifications.created.length, 1);

  activeTab.cookieStoreId = "firefox-container-9";
  browser.tabs.create = async () => {
    throw new Error("Illegal URL");
  };

  assert.strictEqual(
    await tabActions.reopenCurrentTabInContainer("firefox-container-1"),
    false,
  );
  assert.deepStrictEqual(browser.tabs.removed, []);
  assert.strictEqual(browser.notifications.created.length, 2);
});

testCases([
  {
    name: "goes one tab left using current window tab order",
    action: "goOneTabLeft",
    tabs: [
      { id: 1, index: 2, active: false, pinned: false },
      { id: 2, index: 0, active: false, pinned: true },
      { id: 3, index: 1, active: true, pinned: true },
    ],
    updates: [{ tabId: 2, details: { active: true } }],
  },
  {
    name: "goes one tab right using current window tab order",
    action: "goOneTabRight",
    tabs: [
      { id: 1, index: 2, active: false, pinned: false },
      { id: 2, index: 0, active: false, pinned: true },
      { id: 3, index: 1, active: true, pinned: true },
    ],
    updates: [{ tabId: 1, details: { active: true } }],
  },
  {
    name: "wraps left navigation from the first pinned tab to the last unpinned tab",
    action: "goOneTabLeft",
    tabs: [
      { id: 11, index: 0, active: true, pinned: true },
      { id: 12, index: 1, active: false, pinned: true },
      { id: 13, index: 2, active: false, pinned: false },
    ],
    updates: [{ tabId: 13, details: { active: true } }],
  },
  {
    name: "wraps right navigation from the last unpinned tab to the first pinned tab",
    action: "goOneTabRight",
    tabs: [
      { id: 21, index: 0, active: false, pinned: true },
      { id: 22, index: 1, active: false, pinned: true },
      { id: 23, index: 2, active: true, pinned: false },
    ],
    updates: [{ tabId: 21, details: { active: true } }],
  },
  {
    name: "moves an unpinned tab left within the unpinned group",
    action: "moveTabLeft",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: false, pinned: false },
      { id: 3, index: 2, active: true, pinned: false },
      { id: 4, index: 3, active: false, pinned: false },
    ],
    moves: [{ tabId: 3, details: { index: 1 } }],
  },
  {
    name: "moves an unpinned tab right within the unpinned group",
    action: "moveTabRight",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: true, pinned: false },
      { id: 3, index: 2, active: false, pinned: false },
      { id: 4, index: 3, active: false, pinned: false },
    ],
    moves: [{ tabId: 2, details: { index: 2 } }],
  },
  {
    name: "does not move an unpinned tab left into the pinned region",
    action: "moveTabLeft",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: true, pinned: false },
      { id: 3, index: 2, active: false, pinned: false },
    ],
    result: false,
    moves: [],
  },
  {
    name: "does not move an unpinned tab right past the last tab",
    action: "moveTabRight",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: false, pinned: false },
      { id: 3, index: 2, active: true, pinned: false },
    ],
    result: false,
    moves: [],
  },
  {
    name: "does not move a pinned tab right into the unpinned region",
    action: "moveTabRight",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: true, pinned: true },
      { id: 3, index: 2, active: false, pinned: false },
    ],
    result: false,
    moves: [],
  },
  {
    name: "moves a pinned tab left within the pinned region",
    action: "moveTabLeft",
    tabs: [
      { id: 1, index: 0, active: false, pinned: true },
      { id: 2, index: 1, active: true, pinned: true },
      { id: 3, index: 2, active: false, pinned: false },
    ],
    moves: [{ tabId: 2, details: { index: 0 } }],
  },
  {
    name: "pins the current active tab when it is not pinned",
    action: "toggleTabPinned",
    tabs: [{ id: 31, active: true, pinned: false }],
    updates: [{ tabId: 31, details: { pinned: true } }],
  },
  {
    name: "unpins the current active tab when it is pinned",
    action: "toggleTabPinned",
    tabs: [{ id: 32, active: true, pinned: true }],
    updates: [{ tabId: 32, details: { pinned: false } }],
  },
  {
    name: "does not toggle tab pinning when firefox reports no active current-window tab",
    action: "toggleTabPinned",
    tabs: [],
    result: false,
    updates: [],
  },
], async ({ action, moves = [], result, tabs, updates = [] }) => {
  const browser = createTabActionsBrowser(tabs);
  const actualResult = await createTabActions({ Shared, browser })[action]();

  if (result !== undefined) {
    assert.strictEqual(actualResult, result);
  }
  assert.deepStrictEqual(browser.tabs.moves, moves);
  assert.deepStrictEqual(browser.tabs.updates, updates);
});

test("reuses and promotes entries in the extracted request context cache module", () => {
  const state = {
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
  const originalBuildRequestContext = Shared.buildRequestContext;
  let callCount = 0;

  Shared.buildRequestContext = (details) => {
    callCount += 1;
    return originalBuildRequestContext(details);
  };

  try {
    const first = requestContextCache.getRequestContext({
      url: "https://example.com/a",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "req-1",
    });
    const second = requestContextCache.getRequestContext({
      url: "https://example.com/b",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "req-2",
    });
    const promoted = requestContextCache.getRequestContext({
      url: "https://example.com/a",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "req-1",
    });

    assert.strictEqual(callCount, 2);
    assert.deepStrictEqual(promoted, first);
    assert.deepStrictEqual(
      state.requestContextCachePrimary.context,
      first,
    );
    assert.deepStrictEqual(
      state.requestContextCacheSecondary.context,
      second,
    );
  } finally {
    Shared.buildRequestContext = originalBuildRequestContext;
  }
});

test("rebuilds selected runtime slices in the extracted runtime manager module", () => {
  const state = {
    config: Shared.normalizeConfig({
      proxies: [
        {
          id: "proxy-1",
          type: "http",
          host: "127.0.0.1",
          port: 8080,
        },
      ],
      globalHeaders: [{ id: "g1", name: "X-Test", value: "1" }],
      hostRules: [
        {
          id: "rule-1",
          enabled: true,
          mode: "blacklist",
          patterns: ["example.com"],
          exceptions: [],
        },
      ],
    }),
    configMeta: { revision: 1, writer: "", updatedAt: "" },
    containers: [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "blue",
        iconUrl: "work.svg",
      },
    ],
    runtime: Shared.compileRuntime(Shared.createDefaultConfig(), []),
  };
  let syncCalls = 0;
  const runtimeManager = createRuntimeManager({
    Shared,
    state,
    syncNetworkListeners() {
      syncCalls += 1;
    },
  });

  runtimeManager.refreshRuntimeParts(["proxy", "hostRules"]);

  assert.strictEqual(syncCalls, 1);
  assert.strictEqual(state.runtime.proxyRuntime.hasAnyAssignments, false);
  assert.strictEqual(state.runtime.headerRuntime.hasAnyWork, false);
  assert.strictEqual(state.runtime.hostRuleRuntime.hasAnyEnabledRules, true);

  runtimeManager.refreshRuntimeParts(["headers", "shortcuts"]);
  assert.strictEqual(syncCalls, 2);
  assert.strictEqual(state.runtime.headerRuntime.hasAnyWork, true);
  assert.deepStrictEqual(state.runtime.shortcutRuntime.containerIdBySlot, [
    Shared.FIREFOX_DEFAULT_CONTAINER,
    "firefox-container-1",
  ]);
});

test("refreshes fixed shortcut command descriptions including tab commands", async () => {
  const updates = [];
  const shortcutManager = createShortcutManager({
    Shared,
    state: {
      runtime: {
        shortcutRuntime: {
          containerIdBySlot: Array.from(
            { length: Shared.SHORTCUT_SLOT_COUNT },
            () => "",
          ),
        },
      },
      commandDescriptionByName: new Map(),
    },
    browser: {
      commands: {
        async update(update) {
          updates.push(update);
        },
      },
    },
    containerCache: {
      getContainerName(containerId) {
        return containerId || "";
      },
    },
    tabActions: {},
  });

  await shortcutManager.refreshCommandDescriptions();

  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND &&
        update.description === "Open a new tab in the current container",
    ),
  );
  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.GO_ONE_TAB_LEFT_COMMAND &&
        update.description === "Go one tab to the left",
    ),
  );
  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.GO_ONE_TAB_RIGHT_COMMAND &&
        update.description === "Go one tab to the right",
    ),
  );
  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.MOVE_TAB_LEFT_COMMAND &&
        update.description === "Move tab left",
    ),
  );
  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.MOVE_TAB_RIGHT_COMMAND &&
        update.description === "Move tab right",
    ),
  );
  assert.ok(
    updates.some(
      (update) =>
        update.name === Shared.TOGGLE_TAB_PINNED_COMMAND &&
        update.description === "Pin/Unpin tab",
    ),
  );
});

test("dispatches each fixed tab command to the matching tab action", async () => {
  const calls = [];
  const shortcutManager = createShortcutManager({
    Shared,
    state: {
      runtime: {
        shortcutRuntime: {
          containerIdBySlot: Array.from(
            { length: Shared.SHORTCUT_SLOT_COUNT },
            () => "",
          ),
        },
      },
      commandDescriptionByName: new Map(),
    },
    browser: {},
    containerCache: {
      getContainerName() {
        return "";
      },
    },
    tabActions: {
      async openCurrentContainerTab() {
        calls.push("openCurrentContainerTab");
      },
      async goOneTabLeft() {
        calls.push("goOneTabLeft");
      },
      async goOneTabRight() {
        calls.push("goOneTabRight");
      },
      async moveTabLeft() {
        calls.push("moveTabLeft");
      },
      async moveTabRight() {
        calls.push("moveTabRight");
      },
      async toggleTabPinned() {
        calls.push("toggleTabPinned");
      },
    },
  });

  await shortcutManager.handleCommand(Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND);
  await shortcutManager.handleCommand(Shared.GO_ONE_TAB_LEFT_COMMAND);
  await shortcutManager.handleCommand(Shared.GO_ONE_TAB_RIGHT_COMMAND);
  await shortcutManager.handleCommand(Shared.MOVE_TAB_LEFT_COMMAND);
  await shortcutManager.handleCommand(Shared.MOVE_TAB_RIGHT_COMMAND);
  await shortcutManager.handleCommand(Shared.TOGGLE_TAB_PINNED_COMMAND);

  assert.deepStrictEqual(calls, [
    "openCurrentContainerTab",
    "goOneTabLeft",
    "goOneTabRight",
    "moveTabLeft",
    "moveTabRight",
    "toggleTabPinned",
  ]);
});

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

function loadBackgroundModule() {
  const storageLocalState = {};
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
      onMessage: {
        addListener() {},
      },
    },
    storage: {
      onChanged: {
        addListener() {},
      },
      local: {
        state: storageLocalState,
        get: async function get(keys) {
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
        set: async function set(values) {
          Object.assign(this.state, values);
        },
      },
    },
    contextualIdentities: {
      onCreated: {
        addListener() {},
      },
      onRemoved: {
        addListener() {},
      },
      onUpdated: {
        addListener() {},
      },
      query: async () => [],
    },
    commands: {
      onCommand: {
        addListener() {},
      },
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
      onActivated: {
        addListener() {},
      },
      onCreated: {
        addListener() {},
      },
      onRemoved: {
        addListener() {},
      },
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

test("registers onBeforeRequest only when enabled host rules exist", () => {
  const ctx = loadBackgroundModule();

  try {
    ctx.background.setContainerCache([]);
    ctx.background.state.config = Shared.normalizeConfig({ hostRules: [] });
    ctx.background.rebuildRuntime();
    assert.strictEqual(ctx.browserMock.webRequest.onBeforeRequest.listeners.length, 0);

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
    assert.strictEqual(ctx.browserMock.webRequest.onBeforeRequest.listeners.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("blocks requests when a container references an invalid proxy", () => {
  const ctx = loadBackgroundModule();

  try {
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

test("redirects blocked main_frame requests and cancels subresources", () => {
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

    const redirect = ctx.background.enforceHostRules({
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

    const result = ctx.background.enforceHostRules({
      url: "https://example.com/account",
      type: "main_frame",
      cookieStoreId: "firefox-container-9",
      tabId: 7,
    });

    assert.deepStrictEqual(result, { cancel: true });

    await new Promise((resolve) => setImmediate(resolve));

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

test("reuses cached request contexts across runtime listeners for the same request", () => {
  const ctx = loadBackgroundModule();
  const originalBuildRequestContext = Shared.buildRequestContext;
  let callCount = 0;

  Shared.buildRequestContext = (details) => {
    callCount += 1;
    return originalBuildRequestContext(details);
  };

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
    ctx.background.enforceHostRules({
      url: "https://example.com/app",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });

    assert.strictEqual(callCount, 1);
  } finally {
    Shared.buildRequestContext = originalBuildRequestContext;
    ctx.cleanup();
  }
});

test("keeps the previous request context hot across one interleaved request", () => {
  const ctx = loadBackgroundModule();
  const originalBuildRequestContext = Shared.buildRequestContext;
  let callCount = 0;

  Shared.buildRequestContext = (details) => {
    callCount += 1;
    return originalBuildRequestContext(details);
  };

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
    ctx.background.setProxy({
      url: "https://example.com/other",
      method: "GET",
      cookieStoreId: "firefox-container-1",
      requestId: "request-2",
    });
    ctx.background.enforceHostRules({
      url: "https://example.com/app",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-1",
    });
    ctx.background.enforceHostRules({
      url: "https://example.com/other",
      method: "GET",
      type: "script",
      cookieStoreId: "firefox-container-1",
      requestId: "request-2",
    });

    assert.strictEqual(callCount, 2);
  } finally {
    Shared.buildRequestContext = originalBuildRequestContext;
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

    const redirect = ctx.background.enforceHostRules({
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
    const entryId = ctx.background.createBlockedPageEntry(
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

    const redirect = ctx.background.enforceHostRules({
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
    const entryId = ctx.background.createBlockedPageEntry(
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
    const entryId = ctx.background.createBlockedPageEntry(
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
    ctx.background.removeBlockedPageEntriesForTab(11);
    await Promise.resolve();

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
    const entryId = ctx.background.createBlockedPageEntry(
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
    const entryId = ctx.background.createBlockedPageEntry(
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

test("suppresses repeated auto-reopen attempts for the same target and url", async () => {
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
    Shared,
    browser,
    constants: {
      BLOCKED_PAGE_ENTRY_TTL_MS: 5 * 60 * 1000,
      BLOCKED_PAGE_MAX_ENTRIES: 200,
      BLOCKED_PAGE_PATH: "blocked/blocked.html",
      BLOCKED_PAGE_STORAGE_KEY: "blockedPageEntries",
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
    requestContextCache: {
      normalizeMessageText(value) {
        return value == null ? "" : String(value).trim();
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

  assert.strictEqual(
    blockedPageStore.scheduleAutoReopenBlockedMainFrame(decision, details),
    true,
  );
  assert.strictEqual(
    blockedPageStore.scheduleAutoReopenBlockedMainFrame(decision, details),
    false,
  );
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
        color: "turquoise",
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
      { name: "X-PwnFox-Color", value: "cyan" },
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

async function run() {
  await loadBackgroundTestModules();
  for (const entry of tests) {
    try {
      await entry.fn();
      process.stdout.write(`ok - ${entry.name}\n`);
    } catch (error) {
      process.stderr.write(`not ok - ${entry.name}\n${error.stack}\n`);
      process.exitCode = 1;
    }
  }
}

run().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
