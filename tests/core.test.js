import assert from "node:assert";
import test from "node:test";
import Shared from "../utils/shared.js";
import ConfigTransfer from "../options/config-transfer.js";
import * as OptionsApp from "../options/app.js";
import { createShortcutManager } from "../background/shortcuts.js";
import { createTabIndex } from "../background/tab-index.js";
import { createTabActions } from "../background/tab-actions.js";
import { createRequestContextCache } from "../background/request-context-cache.js";
import { createRuntimeManager } from "../background/runtime-manager.js";
import { createConfigService } from "../background/config-service.js";
import {
  OPTIONS_UI_KEY,
  loadOptionsUi,
  saveOptionsUi,
} from "../domain/ui-state.js";

function testCases(cases, runCase) {
  for (const scenario of cases) {
    test(scenario.name, () => runCase(scenario));
  }
}

async function withMockBrowser(mock, task) {
  const previousBrowser = global.browser;
  if (mock.storage && !mock.runtime) {
    mock.runtime = {};
  }
  if (mock.storage && typeof mock.runtime?.sendMessage !== "function") {
    const configService = createConfigService({
      Shared,
      browser: mock,
      writerId: "test",
    });
    mock.runtime.sendMessage = async (message) => {
      if (message?.type === "config:get") {
        return { ok: true, bundle: await configService.getBundle() };
      }
      throw new Error(`Unexpected runtime message: ${message?.type || "unknown"}`);
    };
  }
  global.browser = mock;
  try {
    return await task();
  } finally {
    global.browser = previousBrowser;
  }
}

function createLocalStorageMock(initial = {}) {
  const values = { ...initial };
  return {
    values,
    async get(key) {
      if (Array.isArray(key)) {
        return Object.fromEntries(
          key
            .filter((entry) => Object.prototype.hasOwnProperty.call(values, entry))
            .map((entry) => [entry, values[entry]]),
        );
      }
      return { [key]: values[key] };
    },
    async set(entries) {
      Object.assign(values, entries);
    },
    async remove(key) {
      delete values[key];
    },
  };
}

function loadOptionsAppTestModule() {
  return OptionsApp;
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

function createContainerReorderMock(options = {}) {
  const containers = [
    { cookieStoreId: "container-1" },
    { cookieStoreId: "container-2" },
  ];
  const shortcuts = new Map([
    ["command-1", "Alt+1"],
    ["command-2", "Alt+2"],
  ]);
  let shortcutFailurePending = Boolean(options.failShortcut);

  return {
    containers,
    shortcuts,
    contextualIdentities: {
      async move(cookieStoreIds, index) {
        if (Array.isArray(cookieStoreIds)) {
          if (options.failOrderRestore) {
            throw new Error("Order restore failed");
          }
          const byId = new Map(
            containers.map((container) => [container.cookieStoreId, container]),
          );
          containers.splice(
            0,
            containers.length,
            ...cookieStoreIds.map((cookieStoreId) => byId.get(cookieStoreId)),
          );
          return;
        }
        if (options.failInitialMove) {
          throw new Error("Container move failed");
        }

        const currentIndex = containers.findIndex(
          (container) => container.cookieStoreId === cookieStoreIds,
        );
        const [container] = containers.splice(currentIndex, 1);
        containers.splice(index, 0, container);
      },
      async query() {
        return containers.map((container) => ({ ...container }));
      },
    },
    commands: {
      async getAll() {
        return Array.from(shortcuts, ([name, shortcut]) => ({ name, shortcut }));
      },
      async update({ name, shortcut }) {
        if (
          shortcutFailurePending &&
          name === "command-2" &&
          shortcut === "Alt+1"
        ) {
          shortcutFailurePending = false;
          throw new Error("Shortcut update failed");
        }
        shortcuts.set(name, shortcut);
      },
    },
  };
}

function createContainerReorderTransactionOptions() {
  return {
    cookieStoreId: "container-2",
    firefoxMoveIndex: 0,
    originalOrder: ["container-1", "container-2"],
    expectedOrder: ["container-2", "container-1"],
    originalShortcuts: new Map([
      ["command-1", "Alt+1"],
      ["command-2", "Alt+2"],
    ]),
    targetShortcuts: new Map([
      ["command-1", "Alt+2"],
      ["command-2", "Alt+1"],
    ]),
  };
}

function createTransferFixture() {
  const containers = [
    {
      cookieStoreId: "firefox-container-1",
      name: "Work",
      color: "blue",
      icon: "briefcase",
    },
    {
      cookieStoreId: "firefox-container-2",
      name: "Personal",
      color: "green",
      icon: "fingerprint",
    },
  ];
  const commands = [
    { name: "open-container-1", shortcut: "Ctrl+1" },
    { name: "open-container-2", shortcut: "" },
  ];
  const config = Shared.normalizeConfig({
    proxies: [
      {
        id: "proxy-1",
        title: "Lab",
        type: "https",
        host: "proxy.example",
        port: 8443,
        username: "analyst",
        password: "secret",
      },
    ],
    containerSettings: {
      "firefox-container-1": { proxyId: "proxy-1" },
      [Shared.FIREFOX_DEFAULT_CONTAINER]: {
        headers: [{ name: "X-Default", value: "yes" }],
      },
    },
    hostRules: [
      {
        id: "host-rule-1",
        name: "Work only",
        enabled: true,
        mode: "whitelist",
        patterns: ["example.com"],
        exceptions: ["firefox-container-1"],
      },
    ],
    globalHeaders: [{ name: "X-Global", value: "yes" }],
    ui: { activeTab: "proxies" },
  });

  return {
    commands,
    config,
    containers,
    document: ConfigTransfer.createExportDocument(
      config,
      containers,
      commands,
      "2026-07-25T10:00:00.000Z",
      { sourceInstanceId: "instance-a", sourcePlatform: "linux" },
    ),
  };
}


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

test("refuses future and malformed stored configuration schemas", () => {
  assert.throws(
    () =>
      Shared.normalizeConfigBundle({
        meta: { schemaVersion: Shared.CONFIG_SCHEMA_VERSION + 1 },
        config: Shared.createDefaultConfig(),
      }),
    (error) => error.code === "CONFIG_VERSION_UNSUPPORTED",
  );
  assert.throws(
    () =>
      Shared.normalizeConfigBundle({
        meta: { schemaVersion: "3" },
        config: Shared.createDefaultConfig(),
      }),
    (error) => error.code === "CONFIG_INVALID",
  );
  assert.throws(
    () => Shared.normalizeConfigBundle("invalid"),
    (error) => error.code === "CONFIG_INVALID",
  );

  const malformedEnvelopes = [
    { meta: { schemaVersion: Shared.CONFIG_SCHEMA_VERSION + 1 } },
    { config: Shared.createDefaultConfig() },
    { meta: null, config: Shared.createDefaultConfig() },
    { meta: [], config: Shared.createDefaultConfig() },
    { meta: {}, config: null },
    { meta: {}, config: [] },
  ];
  malformedEnvelopes.forEach((value) => {
    assert.throws(
      () => Shared.normalizeConfigBundle(value),
      (error) => error.code === "CONFIG_INVALID",
    );
  });
});


test("serializes configuration writes and rejects stale revisions", async () => {
  const storage = createLocalStorageMock();
  const applied = [];
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
    prepareChange(bundle) {
      return {
        commit() {
          applied.push(bundle.meta.revision);
        },
        reconcile() {},
      };
    },
  });
  await service.initialize();
  const firstConfig = Shared.createDefaultConfig();
  firstConfig.globalHeaders.push({ name: "X-First", value: "1" });
  const staleConfig = Shared.createDefaultConfig();
  staleConfig.globalHeaders.push({ name: "X-Stale", value: "1" });

  const results = await Promise.allSettled([
    service.save(0, firstConfig),
    service.save(0, staleConfig),
  ]);
  assert.strictEqual(results[0].status, "fulfilled");
  assert.strictEqual(results[1].status, "rejected");
  assert.strictEqual(results[1].reason.code, "CONFIG_CONFLICT");
  assert.deepStrictEqual(applied, [1]);

  const nextConfig = Shared.clone(results[0].value.config);
  nextConfig.globalHeaders.push({ name: "X-Second", value: "2" });
  const nextBundle = await service.save(1, nextConfig);
  assert.strictEqual(nextBundle.meta.revision, 2);
  assert.deepStrictEqual(applied, [1, 2]);
});

test("prepares config changes before storage and isolates reconciliation failures", async () => {
  const initialBundle = Shared.createConfigBundle(Shared.createDefaultConfig(), {
    revision: 0,
  });
  const storage = createLocalStorageMock({ [Shared.CONFIG_KEY]: initialBundle });
  const storedRevisions = [];
  const set = storage.set;
  storage.set = async (entries) => {
    storedRevisions.push(entries[Shared.CONFIG_KEY].meta.revision);
    await set(entries);
  };
  let shouldFailPreparation = true;
  let committedRevision = 0;
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
    prepareChange(bundle) {
      if (shouldFailPreparation) {
        throw new Error("compile failed");
      }
      return {
        commit() {
          committedRevision = bundle.meta.revision;
        },
        async reconcile() {
          throw new Error("badge failed");
        },
      };
    },
  });
  await service.initialize();
  const nextConfig = Shared.createDefaultConfig();
  nextConfig.globalHeaders.push({ name: "X-Test", value: "1" });

  await assert.rejects(service.save(0, nextConfig), /compile failed/);
  assert.deepStrictEqual(storedRevisions, []);
  assert.strictEqual((await service.getBundle()).meta.revision, 0);

  shouldFailPreparation = false;
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...args) => {
    loggedErrors.push(args);
  };
  try {
    const saved = await service.save(0, nextConfig);
    assert.strictEqual(saved.meta.revision, 1);
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepStrictEqual(storedRevisions, [1]);
  assert.strictEqual(committedRevision, 1);
  assert.strictEqual(loggedErrors.length, 1);
  assert.strictEqual((await service.getBundle()).meta.revision, 1);
});

test("migrates the legacy active options tab before storing schema 4", async () => {
  const legacy = {
    meta: { schemaVersion: 3, revision: 7, writer: "options" },
    config: {
      ...Shared.createDefaultConfig(),
      ui: { activeTab: "host-rules" },
    },
  };
  const storage = createLocalStorageMock({ [Shared.CONFIG_KEY]: legacy });
  const writes = [];
  const set = storage.set;
  storage.set = async (entries) => {
    writes.push(entries);
    await set(entries);
  };
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
  });

  const bundle = await service.initialize();

  assert.strictEqual(bundle.meta.schemaVersion, 4);
  assert.strictEqual(bundle.config.ui, undefined);
  assert.deepStrictEqual(storage.values[OPTIONS_UI_KEY], {
    activeTab: "host-rules",
  });
  assert.strictEqual(storage.values[Shared.CONFIG_KEY].meta.schemaVersion, 4);
  assert.strictEqual(writes.length, 1);
  assert.deepStrictEqual(Object.keys(writes[0]).sort(), [
    OPTIONS_UI_KEY,
    Shared.CONFIG_KEY,
  ].sort());
});

test("validates stored configuration before writing migrations", async () => {
  const future = {
    meta: { schemaVersion: Shared.CONFIG_SCHEMA_VERSION + 1, revision: 9 },
    config: {
      ...Shared.createDefaultConfig(),
      ui: { activeTab: "host-rules" },
    },
  };
  const storage = createLocalStorageMock({ [Shared.CONFIG_KEY]: future });
  const writes = [];
  storage.set = async (entries) => {
    writes.push(entries);
  };
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
  });

  await assert.rejects(
    service.initialize(),
    (error) => error.code === "CONFIG_VERSION_UNSUPPORTED",
  );
  assert.deepStrictEqual(writes, []);

  const nullStorage = createLocalStorageMock({ [Shared.CONFIG_KEY]: null });
  const nullService = createConfigService({
    Shared,
    browser: { storage: { local: nullStorage } },
    writerId: "background",
  });
  await assert.rejects(
    nullService.initialize(),
    (error) => error.code === "CONFIG_INVALID",
  );
});

test("removes invalid stored header values during initialization", async () => {
  const stored = {
    meta: {
      schemaVersion: Shared.CONFIG_SCHEMA_VERSION,
      revision: 3,
      writer: "options",
    },
    config: {
      ...Shared.createDefaultConfig(),
      globalHeaders: [
        { id: "valid", name: "X-Valid", value: "yes" },
        { id: "invalid", name: "X-Invalid", value: "bad\rvalue" },
      ],
    },
  };
  const storage = createLocalStorageMock({ [Shared.CONFIG_KEY]: stored });
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
  });

  const bundle = await service.initialize();

  assert.deepStrictEqual(bundle.config.globalHeaders, [
    { id: "valid", name: "X-Valid", value: "yes" },
  ]);
  assert.deepStrictEqual(
    storage.values[Shared.CONFIG_KEY].config.globalHeaders,
    bundle.config.globalHeaders,
  );
});

test("retries transient configuration initialization failures", async () => {
  const storage = createLocalStorageMock();
  const get = storage.get;
  let reads = 0;
  storage.get = async (keys) => {
    reads += 1;
    if (reads === 1) {
      throw new Error("Temporary storage failure");
    }
    return get(keys);
  };
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
  });

  await assert.rejects(service.initialize(), /Temporary storage failure/);
  const bundle = await service.initialize();

  assert.strictEqual(reads, 2);
  assert.strictEqual(bundle.meta.schemaVersion, Shared.CONFIG_SCHEMA_VERSION);
});

test("caches permanent configuration initialization failures", async () => {
  const future = Shared.createConfigBundle(Shared.createDefaultConfig(), {});
  future.meta.schemaVersion = Shared.CONFIG_SCHEMA_VERSION + 1;
  const storage = createLocalStorageMock({ [Shared.CONFIG_KEY]: future });
  const get = storage.get;
  let reads = 0;
  storage.get = async (keys) => {
    reads += 1;
    return get(keys);
  };
  const service = createConfigService({
    Shared,
    browser: { storage: { local: storage } },
    writerId: "background",
  });

  await assert.rejects(
    service.initialize(),
    (error) => error.code === "CONFIG_VERSION_UNSUPPORTED",
  );
  await assert.rejects(
    service.initialize(),
    (error) => error.code === "CONFIG_VERSION_UNSUPPORTED",
  );
  assert.strictEqual(reads, 1);
});

test("stores the active options tab independently from routing config", async () => {
  const storage = createLocalStorageMock({
    [Shared.CONFIG_KEY]: Shared.createConfigBundle(Shared.createDefaultConfig(), {
      revision: 4,
    }),
  });
  const browserMock = { storage: { local: storage } };

  await saveOptionsUi(browserMock, { activeTab: "proxies" });

  assert.deepStrictEqual(await loadOptionsUi(browserMock), {
    activeTab: "proxies",
  });
  assert.strictEqual(storage.values[Shared.CONFIG_KEY].meta.revision, 4);
  storage.values[OPTIONS_UI_KEY] = { activeTab: "unknown" };
  assert.deepStrictEqual(await loadOptionsUi(browserMock), {
    activeTab: "containers",
  });
});

test("exports a versioned portable configuration including secrets and shortcuts", () => {
  const fixture = createTransferFixture();

  assert.strictEqual(fixture.document.kind, ConfigTransfer.FORMAT_KIND);
  assert.strictEqual(fixture.document.formatVersion, ConfigTransfer.FORMAT_VERSION);
  assert.strictEqual(fixture.document.exportedAt, "2026-07-25T10:00:00.000Z");
  assert.strictEqual(fixture.document.sourceInstanceId, "instance-a");
  assert.strictEqual(fixture.document.sourcePlatform, "linux");
  assert.deepStrictEqual(fixture.document.containers[0], {
    sourceCookieStoreId: "firefox-container-1",
    name: "Work",
    color: "blue",
    icon: "briefcase",
  });
  assert.strictEqual(fixture.document.config.proxies[0].password, "secret");
  assert.deepStrictEqual(fixture.document.shortcuts, {
    "open-container-1": "Ctrl+1",
    "open-container-2": "",
  });
  assert.strictEqual(fixture.document.meta, undefined);
});

test("validates imported configuration envelopes and container references", () => {
  const fixture = createTransferFixture();
  const options = {
    supportedColors: ["blue", "green"],
    supportedIcons: ["briefcase", "fingerprint"],
    commandNames: fixture.commands.map((command) => command.name),
  };
  const parsed = ConfigTransfer.parseImportText(
    JSON.stringify(fixture.document),
    options,
  );

  assert.deepStrictEqual(parsed, fixture.document);
  assert.throws(
    () => ConfigTransfer.parseImportText("not json", options),
    /not valid JSON/,
  );
  assert.throws(
    () =>
      ConfigTransfer.parseImportDocument(
        { ...fixture.document, formatVersion: ConfigTransfer.FORMAT_VERSION + 1 },
        options,
      ),
    /newer add-on version/,
  );
  assert.throws(
    () => ConfigTransfer.parseImportDocument({ ...fixture.document, config: null }, options),
    /configuration is invalid/,
  );
  assert.throws(
    () =>
      ConfigTransfer.parseImportDocument(
        {
          ...fixture.document,
          config: { ...fixture.document.config, proxies: "invalid" },
        },
        options,
      ),
    /proxies list is invalid/,
  );

  const unknownReference = Shared.clone(fixture.document);
  unknownReference.config.containerSettings["firefox-container-99"] = {
    proxyId: "proxy-1",
  };
  assert.throws(
    () => ConfigTransfer.parseImportDocument(unknownReference, options),
    /unknown container/,
  );
});

test("rejects invalid header values before saving or importing configuration", () => {
  const config = Shared.createDefaultConfig();
  config.globalHeaders = [
    { id: "global", name: "X-Test", value: "one\r\nX-Injected: yes" },
  ];
  config.containerSettings = {
    "firefox-container-1": {
      headers: [{ id: "scoped", name: "X-Test", value: "bad\0value" }],
    },
  };

  const validation = Shared.validateConfig(config);
  assert.strictEqual(validation.valid, false);
  assert.deepStrictEqual(validation.errors, [
    "Global header 1 contains invalid control characters.",
    "Container firefox-container-1 header 1 contains invalid control characters.",
  ]);

  const fixture = createTransferFixture();
  fixture.document.config.globalHeaders[0].value = "bad\rvalue";
  assert.throws(
    () =>
      ConfigTransfer.parseImportDocument(fixture.document, {
        supportedColors: ["blue", "green"],
        supportedIcons: ["briefcase", "fingerprint"],
        commandNames: fixture.commands.map((command) => command.name),
      }),
    /invalid control characters/,
  );
});

test("matches imported containers by ordered visible identity rather than local IDs", () => {
  const fixture = createTransferFixture();
  const sameAppearance = fixture.containers.map((container, index) => ({
    ...container,
    cookieStoreId: `firefox-container-${index + 20}`,
  }));

  assert.strictEqual(
    ConfigTransfer.analyzeContainerMatch(
      fixture.document.containers,
      sameAppearance,
    ).mode,
    "exact",
  );
  assert.strictEqual(
    ConfigTransfer.analyzeContainerMatch(fixture.document.containers, []).mode,
    "empty",
  );
  assert.deepStrictEqual(
    ConfigTransfer.analyzeContainerMatch(
      fixture.document.containers,
      [...sameAppearance].reverse(),
    ),
    { mode: "mismatch", differences: ["different order"] },
  );
  assert.strictEqual(
    ConfigTransfer.analyzeContainerMatch(fixture.document.containers, [
      { ...sameAppearance[0], name: "Renamed" },
    ]).mode,
    "mismatch",
  );
});

test("recognizes changed containers from the same Firefox profile by stable IDs", () => {
  const fixture = createTransferFixture();
  const changed = [
    { ...fixture.containers[1], name: "Private", color: "purple" },
    { ...fixture.containers[0], icon: "circle" },
  ];
  const match = ConfigTransfer.analyzeContainerMatch(
    fixture.document.containers,
    changed,
    "instance-a",
    "instance-a",
  );

  assert.strictEqual(match.mode, "same-profile");
  assert.deepStrictEqual(
    ConfigTransfer.createSameProfileIdMap(
      fixture.document.containers,
      changed,
    ),
    new Map([
      ["firefox-container-1", "firefox-container-1"],
      ["firefox-container-2", "firefox-container-2"],
    ]),
  );
  assert.strictEqual(
    ConfigTransfer.analyzeContainerMatch(
      fixture.document.containers,
      changed,
      "instance-a",
      "instance-b",
    ).mode,
    "mismatch",
  );
});

test("warns about export secrets only when proxy credentials are present", () => {
  const fixture = createTransferFixture();
  const withoutCredentials = Shared.clone(fixture.config);
  withoutCredentials.proxies[0].username = "";
  withoutCredentials.proxies[0].password = "";

  assert.strictEqual(ConfigTransfer.hasProxyCredentials(fixture.config), true);
  assert.strictEqual(
    ConfigTransfer.hasProxyCredentials(withoutCredentials),
    false,
  );
});

test("detects only shortcut modifiers incompatible with the target OS", () => {
  const shortcuts = {
    "open-container-1": "Command+Shift+1",
    "open-container-2": "Ctrl+2",
    "open-container-3": "MacCtrl+3",
  };

  assert.deepStrictEqual(
    ConfigTransfer.getIncompatibleShortcutNames(shortcuts, "mac", "linux"),
    ["open-container-1", "open-container-3"],
  );
  assert.deepStrictEqual(
    ConfigTransfer.getIncompatibleShortcutNames(shortcuts, "mac", "mac"),
    [],
  );
  assert.deepStrictEqual(
    ConfigTransfer.getIncompatibleShortcutNames(shortcuts, "linux", "mac"),
    [],
  );
  assert.strictEqual(
    ConfigTransfer.shortcutsMatch("Ctrl+Shift+A", "Command+Shift+A", "mac"),
    true,
  );
  assert.strictEqual(
    ConfigTransfer.shortcutsMatch("Ctrl+Shift+A", "Command+Shift+A", "linux"),
    false,
  );
});

test("chooses only recovery actions proven safe by the imported revision", () => {
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "commit-pending",
    writerId: "writer-a",
    initialRevision: 4,
    targetRevision: 5,
    remainingOldContainers: [{ cookieStoreId: "old-1" }],
  };
  const importedBundle = { meta: { writer: "writer-a", revision: 5 } };

  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(transaction, importedBundle),
    "cleanup",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      transaction,
      { meta: { writer: "writer-b", revision: 4 } },
    ),
    "rollback",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      transaction,
      { meta: { writer: "writer-b", revision: 6 } },
    ),
    "abandon",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      { ...transaction, phase: "creating" },
      importedBundle,
    ),
    "rollback",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      { ...transaction, phase: "cleanup" },
      { meta: { writer: "writer-b", revision: 6 } },
    ),
    "abandon",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      { ...transaction, phase: "cleanup", remainingOldContainers: [] },
      { meta: { writer: "writer-b", revision: 6 } },
    ),
    "cleanup",
  );
  assert.strictEqual(
    ConfigTransfer.getRecoveryAction(
      { ...transaction, version: ConfigTransfer.TRANSACTION_VERSION + 1 },
      importedBundle,
    ),
    "ambiguous",
  );
});

test("updates same-profile containers in place and can roll them back", async () => {
  const { applySameProfileContainers } = loadOptionsAppTestModule();
  const containers = createTransferFixture().containers.map((entry) => ({ ...entry }));
  const imported = [
    {
      sourceCookieStoreId: "firefox-container-2",
      name: "Private",
      color: "purple",
      icon: "fingerprint",
    },
    {
      sourceCookieStoreId: "firefox-container-1",
      name: "Work",
      color: "blue",
      icon: "circle",
    },
  ];
  const removed = [];
  const mock = {
    contextualIdentities: {
      async update(cookieStoreId, details) {
        Object.assign(
          containers.find((entry) => entry.cookieStoreId === cookieStoreId),
          details,
        );
      },
      async move(cookieStoreIds) {
        const order = Array.isArray(cookieStoreIds) ? cookieStoreIds : [cookieStoreIds];
        containers.sort(
          (left, right) =>
            order.indexOf(left.cookieStoreId) - order.indexOf(right.cookieStoreId),
        );
      },
      async query() {
        return containers.map((entry) => ({ ...entry }));
      },
      async remove(cookieStoreId) {
        removed.push(cookieStoreId);
      },
    },
  };

  await withMockBrowser(mock, async () => {
    const rollback = await applySameProfileContainers(
      imported,
      createTransferFixture().containers,
    );
    assert.deepStrictEqual(
      containers.map(({ cookieStoreId, name, color, icon }) => ({
        cookieStoreId,
        name,
        color,
        icon,
      })),
      imported.map(({ sourceCookieStoreId, name, color, icon }) => ({
        cookieStoreId: sourceCookieStoreId,
        name,
        color,
        icon,
      })),
    );
    await rollback();
  });

  assert.deepStrictEqual(containers, createTransferFixture().containers);
  assert.deepStrictEqual(removed, []);
});

test("commits container order and shortcut changes as one transaction", async () => {
  const { applyContainerReorderTransaction } = loadOptionsAppTestModule();
  const mock = createContainerReorderMock();

  const result = await withMockBrowser(mock, () =>
    applyContainerReorderTransaction(createContainerReorderTransactionOptions()),
  );

  assert.strictEqual(result.committed, true);
  assert.strictEqual(result.mutationAttempted, true);
  assert.deepStrictEqual(
    mock.containers.map((container) => container.cookieStoreId),
    ["container-2", "container-1"],
  );
  assert.deepStrictEqual(mock.shortcuts, new Map([
    ["command-1", "Alt+2"],
    ["command-2", "Alt+1"],
  ]));
});

test("does not reorder after concurrent container or shortcut changes", async () => {
  const { applyContainerReorderTransaction } = loadOptionsAppTestModule();
  const mock = createContainerReorderMock();
  mock.shortcuts.set("command-1", "Alt+3");

  const result = await withMockBrowser(mock, () =>
    applyContainerReorderTransaction(createContainerReorderTransactionOptions()),
  );

  assert.strictEqual(result.committed, false);
  assert.strictEqual(result.mutationAttempted, false);
  assert.deepStrictEqual(
    mock.containers.map((container) => container.cookieStoreId),
    ["container-1", "container-2"],
  );
  assert.strictEqual(mock.shortcuts.get("command-1"), "Alt+3");
});

test("keeps the original state when the container move fails", async () => {
  const { applyContainerReorderTransaction } = loadOptionsAppTestModule();
  const mock = createContainerReorderMock({ failInitialMove: true });

  const result = await withMockBrowser(mock, () =>
    applyContainerReorderTransaction(createContainerReorderTransactionOptions()),
  );

  assert.strictEqual(result.committed, false);
  assert.strictEqual(result.restored, true);
  assert.deepStrictEqual(
    mock.containers.map((container) => container.cookieStoreId),
    ["container-1", "container-2"],
  );
  assert.deepStrictEqual(mock.shortcuts, new Map([
    ["command-1", "Alt+1"],
    ["command-2", "Alt+2"],
  ]));
});

test("restores container order and shortcuts after a failed reorder", async () => {
  const { applyContainerReorderTransaction } = loadOptionsAppTestModule();
  const mock = createContainerReorderMock({ failShortcut: true });

  const result = await withMockBrowser(mock, () =>
    applyContainerReorderTransaction(createContainerReorderTransactionOptions()),
  );

  assert.strictEqual(result.committed, false);
  assert.strictEqual(result.restored, true);
  assert.deepStrictEqual(
    mock.containers.map((container) => container.cookieStoreId),
    ["container-1", "container-2"],
  );
  assert.deepStrictEqual(mock.shortcuts, new Map([
    ["command-1", "Alt+1"],
    ["command-2", "Alt+2"],
  ]));
});

test("reports an incomplete container reorder restoration", async () => {
  const { applyContainerReorderTransaction } = loadOptionsAppTestModule();
  const mock = createContainerReorderMock({
    failShortcut: true,
    failOrderRestore: true,
  });

  const result = await withMockBrowser(mock, () =>
    applyContainerReorderTransaction(createContainerReorderTransactionOptions()),
  );

  assert.strictEqual(result.committed, false);
  assert.strictEqual(result.restored, false);
  assert.deepStrictEqual(
    mock.containers.map((container) => container.cookieStoreId),
    ["container-2", "container-1"],
  );
});

test("imports shortcuts independently and restores only rejected assignments", async () => {
  const { importShortcutSnapshot } = loadOptionsAppTestModule();
  const shortcuts = new Map([
    ["command-a", "Alt+A"],
    ["command-b", "Alt+B"],
  ]);
  const mock = {
    commands: {
      async getAll() {
        return Array.from(shortcuts, ([name, shortcut]) => ({ name, shortcut }));
      },
      async update({ name, shortcut }) {
        if (name === "command-b" && shortcut === "Ctrl+B") {
          throw new Error("Shortcut rejected");
        }
        shortcuts.set(name, shortcut);
      },
    },
  };

  const result = await withMockBrowser(mock, () =>
    importShortcutSnapshot({ "command-a": "Ctrl+A", "command-b": "Ctrl+B" }),
  );

  assert.deepStrictEqual(result, {
    failedNames: ["command-b"],
    restoreFailedNames: [],
  });
  assert.deepStrictEqual(shortcuts, new Map([
    ["command-a", "Ctrl+A"],
    ["command-b", "Alt+B"],
  ]));
});

test("rolls back containers left by an interrupted pre-commit import", async () => {
  const { rollbackImportTransaction } = loadOptionsAppTestModule();
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "creating",
    createdContainers: [
      { cookieStoreId: "new-1" },
      { cookieStoreId: "new-2" },
    ],
  };
  const storage = createLocalStorageMock({
    [ConfigTransfer.TRANSACTION_KEY]: transaction,
  });
  const removed = [];
  const existing = new Set(["new-1", "new-2"]);
  const result = await withMockBrowser(
    {
      storage: { local: storage },
      contextualIdentities: {
        async query() {
          return Array.from(existing, (cookieStoreId) => ({ cookieStoreId }));
        },
        async remove(cookieStoreId) {
          removed.push(cookieStoreId);
          existing.delete(cookieStoreId);
        },
      },
    },
    () => rollbackImportTransaction(transaction),
  );

  assert.strictEqual(result.complete, true);
  assert.deepStrictEqual(removed, ["new-1", "new-2"]);
  assert.strictEqual(storage.values[ConfigTransfer.TRANSACTION_KEY], undefined);
});

test("journals partial post-commit cleanup and resumes only remaining containers", async () => {
  const { cleanupImportTransaction } = loadOptionsAppTestModule();
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "cleanup",
    writerId: "writer-a",
    targetRevision: 5,
    remainingOldContainers: [
      { cookieStoreId: "old-1", name: "Old one" },
      { cookieStoreId: "old-2", name: "Old two" },
    ],
    shortcuts: null,
  };
  const storage = createLocalStorageMock({
    [Shared.CONFIG_KEY]: Shared.createConfigBundle(Shared.createDefaultConfig(), {
      writer: "writer-a",
      revision: 5,
    }),
    [ConfigTransfer.TRANSACTION_KEY]: transaction,
  });
  const removed = [];
  const existing = new Set(["old-1", "old-2"]);
  let rejectSecond = true;
  const mock = {
    storage: { local: storage },
    contextualIdentities: {
      async query() {
        return Array.from(existing, (cookieStoreId) => ({ cookieStoreId }));
      },
      async remove(cookieStoreId) {
        if (cookieStoreId === "old-2" && rejectSecond) {
          throw new Error("Container busy");
        }
        removed.push(cookieStoreId);
        existing.delete(cookieStoreId);
      },
    },
  };

  await withMockBrowser(mock, async () => {
    const partial = await cleanupImportTransaction(transaction);
    assert.strictEqual(partial.complete, false);
    assert.deepStrictEqual(
      transaction.remainingOldContainers.map((entry) => entry.cookieStoreId),
      ["old-2"],
    );
    rejectSecond = false;
    const resumed = await cleanupImportTransaction(transaction);
    assert.strictEqual(resumed.complete, true);
  });

  assert.deepStrictEqual(removed, ["old-1", "old-2"]);
  assert.strictEqual(storage.values[ConfigTransfer.TRANSACTION_KEY], undefined);
});

test("stops destructive cleanup after a concurrent configuration change", async () => {
  const { cleanupImportTransaction } = loadOptionsAppTestModule();
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "cleanup",
    writerId: "writer-a",
    targetRevision: 5,
    remainingOldContainers: [{ cookieStoreId: "old-1", name: "Old one" }],
    shortcuts: null,
  };
  const storage = createLocalStorageMock({
    [Shared.CONFIG_KEY]: Shared.createConfigBundle(Shared.createDefaultConfig(), {
      writer: "writer-b",
      revision: 6,
    }),
    [ConfigTransfer.TRANSACTION_KEY]: transaction,
  });
  const removed = [];
  const result = await withMockBrowser(
    {
      storage: { local: storage },
      contextualIdentities: {
        async query() {
          return [{ cookieStoreId: "old-1" }];
        },
        async remove(cookieStoreId) {
          removed.push(cookieStoreId);
        },
      },
    },
    () => cleanupImportTransaction(transaction),
  );

  assert.strictEqual(result.complete, false);
  assert.strictEqual(result.unsafe, true);
  assert.deepStrictEqual(removed, []);
  assert.strictEqual(
    storage.values[ConfigTransfer.TRANSACTION_KEY],
    transaction,
  );
});

test("abandons an interrupted cleanup cleanly after concurrent changes", async () => {
  const { recoverImportTransaction } = loadOptionsAppTestModule();
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "cleanup",
    writerId: "writer-a",
    targetRevision: 5,
    remainingOldContainers: [{ cookieStoreId: "old-1" }],
  };
  const storage = createLocalStorageMock({
    [Shared.CONFIG_KEY]: Shared.createConfigBundle(Shared.createDefaultConfig(), {
      writer: "writer-b",
      revision: 6,
    }),
    [ConfigTransfer.TRANSACTION_KEY]: transaction,
  });
  const result = await withMockBrowser(
    { storage: { local: storage } },
    () => recoverImportTransaction(transaction, { interactive: false }),
  );

  assert.strictEqual(result.action, "abandon");
  assert.strictEqual(result.complete, true);
  assert.strictEqual(storage.values[ConfigTransfer.TRANSACTION_KEY], undefined);
});

test("treats already removed journal entries as completed cleanup", async () => {
  const { cleanupImportTransaction } = loadOptionsAppTestModule();
  const transaction = {
    version: ConfigTransfer.TRANSACTION_VERSION,
    phase: "cleanup",
    writerId: "writer-a",
    targetRevision: 5,
    remainingOldContainers: [{ cookieStoreId: "already-removed" }],
    shortcuts: null,
  };
  const storage = createLocalStorageMock({
    [Shared.CONFIG_KEY]: Shared.createConfigBundle(Shared.createDefaultConfig(), {
      writer: "writer-a",
      revision: 5,
    }),
    [ConfigTransfer.TRANSACTION_KEY]: transaction,
  });
  const result = await withMockBrowser(
    {
      storage: { local: storage },
      contextualIdentities: { async query() { return []; } },
    },
    () => cleanupImportTransaction(transaction),
  );

  assert.strictEqual(result.complete, true);
  assert.strictEqual(storage.values[ConfigTransfer.TRANSACTION_KEY], undefined);
});

test("remaps imported associations to live IDs while preserving Firefox Default", () => {
  const fixture = createTransferFixture();
  const targetContainers = fixture.containers.map((container, index) => ({
    ...container,
    cookieStoreId: `firefox-container-${index + 20}`,
  }));
  const idMap = ConfigTransfer.createContainerIdMap(
    fixture.document.containers,
    targetContainers,
  );
  const remapped = ConfigTransfer.remapConfig(
    fixture.document.config,
    idMap,
    "containers",
  );

  assert.ok(remapped.containerSettings["firefox-container-20"]);
  assert.ok(remapped.containerSettings[Shared.FIREFOX_DEFAULT_CONTAINER]);
  assert.strictEqual(remapped.containerSettings["firefox-container-1"], undefined);
  assert.deepStrictEqual(remapped.hostRules[0].exceptions, ["firefox-container-20"]);
  assert.strictEqual(remapped.ui, undefined);
});

test("prepares a safe association-free import without discarding reusable config", () => {
  const fixture = createTransferFixture();
  const unlinked = ConfigTransfer.prepareUnlinkedConfig(
    fixture.document.config,
    "host-rules",
  );

  assert.deepStrictEqual(unlinked.containerSettings, {});
  assert.strictEqual(unlinked.hostRules[0].enabled, false);
  assert.deepStrictEqual(unlinked.hostRules[0].exceptions, []);
  assert.deepStrictEqual(unlinked.proxies, fixture.document.config.proxies);
  assert.deepStrictEqual(unlinked.globalHeaders, fixture.document.config.globalHeaders);
  assert.strictEqual(unlinked.ui, undefined);
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

test("removes a replacement tab when the source tab cannot be closed", async () => {
  const activeTab = {
    id: 11,
    active: true,
    cookieStoreId: "firefox-container-1",
    index: 5,
    pinned: true,
    url: "https://fresh.example.com",
    windowId: 2,
  };
  const browser = createReopenBrowser(activeTab);
  browser.tabs.remove = async function removeWithFailure(tabId) {
    this.removed.push(tabId);
    if (tabId === activeTab.id) {
      throw new Error("Failed to close source tab");
    }
  };
  const tabActions = createTabActions({ Shared, browser });

  await assert.rejects(
    tabActions.reopenCurrentTabInContainer("firefox-container-9"),
    /Failed to close source tab/,
  );
  assert.deepStrictEqual(browser.tabs.removed, [11, 22]);
});

test("reports an incomplete tab replacement rollback", async () => {
  const activeTab = {
    id: 11,
    active: true,
    cookieStoreId: "firefox-container-1",
    index: 5,
    pinned: false,
    url: "https://fresh.example.com",
    windowId: 2,
  };
  const browser = createReopenBrowser(activeTab);
  browser.tabs.remove = async function removeWithFailure(tabId) {
    this.removed.push(tabId);
    throw new Error(`Failed to close tab ${tabId}`);
  };
  const tabActions = createTabActions({ Shared, browser });

  await assert.rejects(
    tabActions.reopenCurrentTabInContainer("firefox-container-9"),
    (error) => error.code === "TAB_REPLACEMENT_ROLLBACK_FAILED",
  );
  assert.deepStrictEqual(browser.tabs.removed, [11, 22]);
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
  const requestContextCache = createRequestContextCache({ state });
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

  assert.strictEqual(promoted, first);
  assert.strictEqual(state.requestContextCachePrimary.context, first);
  assert.strictEqual(state.requestContextCacheSecondary.context, second);
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
  const runtimeManager = createRuntimeManager({
    Shared,
    state,
  });

  runtimeManager.refreshRuntimeParts(["proxy", "hostRules"]);

  assert.strictEqual(state.runtime.proxyRuntime.hasAnyAssignments, false);
  assert.strictEqual(state.runtime.headerRuntime.hasAnyWork, false);
  assert.strictEqual(state.runtime.hostRuleRuntime.hasAnyEnabledRules, true);

  runtimeManager.refreshRuntimeParts(["headers", "shortcuts"]);
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
    },
    browser: {
      commands: {
        async getAll() {
          return [];
        },
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
