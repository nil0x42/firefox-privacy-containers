import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Shared from "../utils/shared.js";
import IdentityChoices from "../options/contextual-identities.js";
import * as OptionsApp from "../options/app.js";
import { showNotification } from "../background/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OPTIONS_CSS_PATH = path.join(__dirname, "..", "options", "app.css");

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


test("replaces notifications by purpose", async () => {
  const created = [];
  const browser = {
    notifications: {
      async create(id, details) {
        created.push({ id, details });
      },
    },
    runtime: {
      getURL(pathname) {
        return `moz-extension://test/${pathname}`;
      },
    },
  };
  const options = {
    id: "shortcut-failure",
    title: "Shortcut failed",
    message: "First failure.",
  };

  await showNotification(browser, options);
  await showNotification(browser, { ...options, message: "Second failure." });

  assert.deepStrictEqual(created.map((entry) => entry.id), [
    "shortcut-failure",
    "shortcut-failure",
  ]);
});


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
  assert.deepStrictEqual(manifest.icons, {
    48: "res/icon-48.png",
    96: "res/icon-96.png",
    512: "res/icon.png",
  });
  assert.deepStrictEqual(manifest.action.default_icon, {
    48: "res/icon-48.png",
    96: "res/icon-96.png",
  });
  assert.deepStrictEqual(manifest.content_security_policy, {
    extension_pages: "script-src 'self'; object-src 'none'",
  });
  for (const [filename, expectedSize] of [
    ["icon-48.png", 48],
    ["icon-96.png", 96],
    ["icon.png", 512],
  ]) {
    const png = fs.readFileSync(path.join(__dirname, "..", "res", filename));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), expectedSize);
    assert.equal(png.readUInt32BE(20), expectedSize);
  }
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

test("uses Firefox identity choices when the browser exposes them", async () => {
  const colors = [
    { color: "cyan", colorCode: "#00aabb" },
    { color: "violet", colorCode: "#7744cc" },
  ];
  const icons = [{ icon: "briefcase", iconUrl: "resource://briefcase.svg" }];
  const choices = await IdentityChoices.getSupportedIdentityChoices({
    contextualIdentities: {
      async getSupportedColors() {
        return colors;
      },
      async getSupportedIcons() {
        return icons;
      },
    },
  });

  assert.deepStrictEqual(choices, { colors, icons });
});

test("renders Firefox-provided URLs for unknown container icons", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "options", "app.js"),
    "utf8",
  );
  const css = fs.readFileSync(OPTIONS_CSS_PATH, "utf8");

  assert.ok(source.includes("setIconGlyph(glyph, entry.icon, entry.iconUrl)"));
  assert.ok(source.includes("target.ownerDocument.createElement(\"img\")"));
  assert.ok(source.includes("image.alt = \"\""));
  assert.ok(css.includes(".container-identity-icon-glyph :is(svg, img)"));
  assert.ok(css.includes(".identity-token :is(svg, img)"));
});

test("falls back to Firefox 142 identity choices when discovery is unavailable", async () => {
  const missingApiChoices =
    await IdentityChoices.getSupportedIdentityChoices({ contextualIdentities: {} });
  assert.deepStrictEqual(missingApiChoices.colors, IdentityChoices.FALLBACK_COLORS);
  assert.deepStrictEqual(missingApiChoices.icons, IdentityChoices.FALLBACK_ICONS);

  const rejectedChoices = await IdentityChoices.getSupportedIdentityChoices({
    contextualIdentities: {
      async getSupportedColors() {
        throw new Error("disabled");
      },
      async getSupportedIcons() {
        return [];
      },
    },
  });
  assert.deepStrictEqual(rejectedChoices.colors, IdentityChoices.FALLBACK_COLORS);
  assert.deepStrictEqual(rejectedChoices.icons, IdentityChoices.FALLBACK_ICONS);
});

test("wires compact configuration transfer controls without duplicating UI pages", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "options", "app.html"),
    "utf8",
  );

  assert.ok(html.includes('id="config-transfer-actions"'));
  assert.ok(html.includes('id="config-import-input"'));
  assert.ok(html.includes('id="config-transfer-dialog"'));
  assert.ok(html.indexOf('src="config-transfer.js"') < html.indexOf('src="app.js"'));
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
  } = OptionsApp;
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
  const context = Shared.buildRequestContext({
    url: "https://LOCALHOST:8443/path",
    method: "options",
  });
  assert.strictEqual(context.targetParsed, false);
  Shared.ensureRequestTarget(context);
  assert.deepStrictEqual(
    context,
    {
      cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
      method: "OPTIONS",
      normalizedHost: "localhost",
      target: {
        protocol: "https:",
        host: "localhost",
      },
      targetParsed: true,
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

test("centralizes proxy DNS behavior for every proxy type", () => {
  const cases = [
    ["http", true, false, "http"],
    ["https", true, false, "https"],
    ["socks", true, true, "socks"],
    ["socks4", false, true, "socks4"],
    ["socks4a", true, true, "socks4"],
  ];

  for (const [type, defaultValue, editable, firefoxType] of cases) {
    const policy = Shared.getProxyTypePolicy(type);
    assert.strictEqual(policy.defaultValue, defaultValue);
    assert.strictEqual(policy.editable, editable);
    assert.strictEqual(policy.firefoxType, firefoxType);
  }
});

test("normalizes fixed proxy DNS values and preserves the SOCKS5 choice", () => {
  const cases = [
    { type: "http", proxyDNS: false, expected: true },
    { type: "https", proxyDNS: false, expected: true },
    { type: "socks4", proxyDNS: true, expected: false },
    { type: "socks4a", proxyDNS: false, expected: true },
    { type: "socks", proxyDNS: false, expected: false },
  ];

  for (const scenario of cases) {
    const proxy = Shared.normalizeProxy({
      id: `proxy-${scenario.type}`,
      type: scenario.type,
      host: "127.0.0.1",
      port: "1080",
      proxyDNS: scenario.proxyDNS,
      username: "user",
      password: "secret",
    });

    assert.strictEqual(proxy.proxyDNS, scenario.expected);
    if (Shared.isSocksProxyType(scenario.type)) {
      assert.strictEqual(proxy.username, "");
      assert.strictEqual(proxy.password, "");
    }
  }
});

test("maps SOCKS4 DNS choices to the matching UI type", () => {
  assert.strictEqual(
    Shared.getProxyTypeForDNSChoice("socks4", true),
    "socks4a",
  );
  assert.strictEqual(
    Shared.getProxyTypeForDNSChoice("socks4a", false),
    "socks4",
  );
  assert.strictEqual(
    Shared.getProxyTypeForDNSChoice("socks", false),
    "socks",
  );
});

test("adapts internal proxy types to Firefox request info", () => {
  const cases = [
    ["http", false, "http", undefined],
    ["https", false, "https", undefined],
    ["socks4", true, "socks4", false],
    ["socks4a", false, "socks4", true],
    ["socks", false, "socks", false],
  ];

  for (const [type, proxyDNS, firefoxType, firefoxProxyDNS] of cases) {
    const proxy = Shared.normalizeProxy({
      id: `proxy-${type}`,
      type,
      host: "127.0.0.1",
      port: "1080",
      proxyDNS,
    });
    const expected = {
      type: firefoxType,
      host: "127.0.0.1",
      port: 1080,
    };
    if (firefoxProxyDNS !== undefined) {
      expected.proxyDNS = firefoxProxyDNS;
    }
    assert.deepStrictEqual(Shared.asProxyRequestInfo(proxy), expected);
  }

  assert.deepStrictEqual(
    Shared.asProxyRequestInfo({
      type: "socks4a",
      host: "127.0.0.1",
      port: 1080,
      proxyDNS: false,
    }),
    {
      type: "socks4",
      host: "127.0.0.1",
      port: 1080,
      proxyDNS: true,
    },
  );
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
  const { buildTabSummaries } = OptionsApp;

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
  }
});

test("shows the external-link preference warning only for applicable Host Rules", () => {
  const { shouldShowExternalContainerGuessWarning } = OptionsApp;
  const containers = [
    { cookieStoreId: "firefox-container-1" },
    { cookieStoreId: "firefox-container-2" },
  ];
  const buildConfig = (overrides = {}) => ({
    hostRules: [
      {
        id: "host-rule-1",
        name: "External target",
        enabled: true,
        mode: "blacklist",
        patterns: ["example.com"],
        exceptions: ["firefox-container-1", "firefox-container-2"],
        ...overrides,
      },
    ],
  });

  try {
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(buildConfig(), containers),
      true,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({ exceptions: ["firefox-container-1"] }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({ enabled: false }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({ patterns: [] }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({
          mode: "whitelist",
          exceptions: [Shared.FIREFOX_DEFAULT_CONTAINER],
        }),
        containers,
      ),
      true,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({
          mode: "whitelist",
          exceptions: [
            Shared.FIREFOX_DEFAULT_CONTAINER,
            "firefox-container-1",
          ],
        }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({ mode: "whitelist", exceptions: [] }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({
          exceptions: [
            Shared.FIREFOX_DEFAULT_CONTAINER,
            "firefox-container-1",
            "firefox-container-2",
          ],
        }),
        containers,
      ),
      false,
    );
    assert.strictEqual(
      shouldShowExternalContainerGuessWarning(
        buildConfig({
          exceptions: ["firefox-container-1", "firefox-container-missing"],
        }),
        containers,
      ),
      false,
    );
  } finally {
  }
});

test("maps the active tab to the header create action label", () => {
  const { getHeaderPrimaryActionDescriptor } = OptionsApp;

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
  }
});

test("reports internal shortcut conflicts explicitly", () => {
  const { getInternalShortcutConflictIssue } = OptionsApp;

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
  }
});

test("builds internal shortcut conflict labels from slot assignments", () => {
  const { getInternalShortcutConflictIssue } = OptionsApp;

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
  }
});

test("builds readable internal shortcut conflict labels for fixed tab commands", () => {
  const { getInternalShortcutConflictIssue } = OptionsApp;

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

test("rejects control characters in header values", () => {
  for (const value of ["value\rrest", "value\0rest", "value\x1frest", "value\x7frest"]) {
    const result = Shared.parseHeaderLines(`X-Test: ${value}`);

    assert.strictEqual(result.valid, false);
    assert.deepStrictEqual(result.errors, [
      {
        line: 1,
        message: "Header value contains invalid control characters",
      },
    ]);
  }

  assert.strictEqual(Shared.parseHeaderLines("X-Test: \tvalue").valid, true);
  assert.strictEqual(Shared.parseHeaderLines("X-Test:").valid, true);
});

test("drops invalid header values during defensive normalization", () => {
  assert.deepStrictEqual(
    Shared.normalizeHeaderEntries([
      { id: "valid", name: "X-Valid", value: "yes" },
      { id: "invalid", name: "X-Invalid", value: "one\r\nX-Injected: yes" },
    ]),
    [{ id: "valid", name: "X-Valid", value: "yes" }],
  );
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

test("maps Firefox container colors to PwnFox header values", () => {
  assert.strictEqual(Shared.getPwnFoxColorValue("turquoise"), "cyan");
  assert.strictEqual(Shared.getPwnFoxColorValue("cyan"), "cyan");
  assert.strictEqual(Shared.getPwnFoxColorValue("purple"), "magenta");
  assert.strictEqual(Shared.getPwnFoxColorValue("violet"), "magenta");
  assert.strictEqual(Shared.getPwnFoxColorValue("pink"), "pink");
  assert.strictEqual(Shared.getPwnFoxColorValue("toolbar"), "gray");
  assert.strictEqual(Shared.getPwnFoxColorValue("gray"), "gray");
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
  assert.strictEqual(Shared.supportsProxyAuth({ type: "socks4a" }), false);
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
