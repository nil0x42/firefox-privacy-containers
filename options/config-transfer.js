(function (global) {
  const Shared =
    global.PrivacyContainersShared ||
    (typeof require === "function" ? require("../utils/shared.js") : null);
  const FORMAT_KIND = "firefox-privacy-containers-config";
  const FORMAT_VERSION = 1;
  const INSTANCE_KEY = "privacyContainersTransferInstanceId";
  const TRANSACTION_KEY = "privacyContainersImportTransaction";
  const TRANSACTION_VERSION = 1;

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function record(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function containerDescriptor(container, sourceIdKey = "sourceCookieStoreId") {
    return {
      [sourceIdKey]: text(
        container && (container.sourceCookieStoreId || container.cookieStoreId),
      ),
      name: typeof container?.name === "string" ? container.name : "",
      color: text(container && container.color),
      icon: text(container && container.icon),
    };
  }

  function validateConfigShape(config) {
    for (const key of ["proxies", "hostRules", "globalHeaders"]) {
      if (!Array.isArray(config[key]) || config[key].some((item) => !record(item))) {
        throw new Error(`The imported ${key} list is invalid.`);
      }
    }
    if (
      !record(config.containerSettings) ||
      Object.values(config.containerSettings).some((setting) => !record(setting)) ||
      !record(config.ui)
    ) {
      throw new Error("The imported configuration structure is invalid.");
    }
    const invalidProxy = config.proxies.find(
      (proxy) => !text(proxy.id) || !Shared.PROXY_TYPES.includes(text(proxy.type)),
    );
    if (invalidProxy) {
      throw new Error("The imported proxy list contains an invalid ID or type.");
    }
    if (
      config.hostRules.some(
        (rule) =>
          !text(rule.id) || !Shared.HOST_RULE_MODES.includes(text(rule.mode)),
      )
    ) {
      throw new Error("The imported Host Rule list contains an invalid ID or mode.");
    }
  }

  function createExportDocument(
    config,
    containers,
    commands,
    exportedAt,
    metadata = {},
  ) {
    return {
      kind: FORMAT_KIND,
      formatVersion: FORMAT_VERSION,
      exportedAt: exportedAt || new Date().toISOString(),
      sourceInstanceId: text(metadata.sourceInstanceId),
      sourcePlatform: text(metadata.sourcePlatform),
      containers: (containers || []).map((container) =>
        containerDescriptor(container),
      ),
      config: Shared.normalizeConfig(config),
      shortcuts: Object.fromEntries(
        (commands || []).map((command) => [
          command.name,
          typeof command.shortcut === "string" ? command.shortcut : "",
        ]),
      ),
    };
  }

  function parseImportDocument(value, options = {}) {
    if (!record(value)) {
      throw new Error("The selected file does not contain a JSON object.");
    }
    if (value.kind !== FORMAT_KIND) {
      throw new Error("This is not a Privacy Containers configuration file.");
    }
    if (value.formatVersion !== FORMAT_VERSION) {
      const detail =
        Number.isInteger(value.formatVersion) && value.formatVersion > FORMAT_VERSION
          ? " It was created by a newer add-on version."
          : "";
      throw new Error(`Unsupported configuration format version.${detail}`);
    }
    if (!Array.isArray(value.containers)) {
      throw new Error("The imported container list is invalid.");
    }
    if (!record(value.config)) {
      throw new Error("The imported configuration is invalid.");
    }
    validateConfigShape(value.config);

    const supportedColors = new Set(options.supportedColors || []);
    const supportedIcons = new Set(options.supportedIcons || []);
    const sourceIds = new Set();
    const containers = value.containers.map((container, index) => {
      const normalized = containerDescriptor(container);
      const label = `Imported container ${index + 1}`;
      if (!normalized.sourceCookieStoreId || !normalized.name.trim()) {
        throw new Error(`${label} has no valid ID or name.`);
      }
      if (sourceIds.has(normalized.sourceCookieStoreId)) {
        throw new Error(`Duplicate imported container ID: ${normalized.sourceCookieStoreId}`);
      }
      if (
        (supportedColors.size && !supportedColors.has(normalized.color)) ||
        (supportedIcons.size && !supportedIcons.has(normalized.icon))
      ) {
        throw new Error(`${label} uses an unsupported color or icon.`);
      }
      sourceIds.add(normalized.sourceCookieStoreId);
      return normalized;
    });

    const validation = Shared.validateConfig(value.config);
    if (!validation.valid) {
      throw new Error(`Invalid imported configuration: ${validation.errors.join(" ")}`);
    }

    const referencedIds = new Set([
      ...Object.keys(validation.config.containerSettings),
      ...validation.config.hostRules.flatMap((rule) => rule.exceptions),
    ]);
    referencedIds.delete(Shared.FIREFOX_DEFAULT_CONTAINER);
    const missingReference = Array.from(referencedIds).find(
      (cookieStoreId) => !sourceIds.has(cookieStoreId),
    );
    if (missingReference) {
      throw new Error(`Imported configuration references an unknown container: ${missingReference}`);
    }

    if (!record(value.shortcuts)) {
      throw new Error("The imported shortcut snapshot is invalid.");
    }
    const knownCommands = new Set(options.commandNames || []);
    const shortcuts = {};
    Object.entries(value.shortcuts).forEach(([name, shortcut]) => {
      if (!name || typeof shortcut !== "string") {
        throw new Error("The imported shortcut snapshot is invalid.");
      }
      if (knownCommands.size && !knownCommands.has(name)) {
        throw new Error(`Unknown imported shortcut command: ${name}`);
      }
      shortcuts[name] = shortcut;
    });

    return {
      kind: FORMAT_KIND,
      formatVersion: FORMAT_VERSION,
      exportedAt: text(value.exportedAt),
      sourceInstanceId: text(value.sourceInstanceId),
      sourcePlatform: text(value.sourcePlatform),
      containers,
      config: validation.config,
      shortcuts,
    };
  }

  function parseImportText(source, options) {
    let value;
    try {
      value = JSON.parse(source);
    } catch (_) {
      throw new Error("The selected file is not valid JSON.");
    }
    return parseImportDocument(value, options);
  }

  function analyzeContainerMatch(
    importedContainers,
    liveContainers,
    sourceInstanceId = "",
    currentInstanceId = "",
  ) {
    const imported = (importedContainers || []).map((container) =>
      containerDescriptor(container),
    );
    const live = (liveContainers || []).map((container) =>
      containerDescriptor(container, "cookieStoreId"),
    );
    if (!live.length) {
      return { mode: "empty", differences: [] };
    }

    const importedIds = imported.map((container) => container.sourceCookieStoreId);
    const liveIds = live.map((container) => container.cookieStoreId);
    const sameIdSet =
      importedIds.length === liveIds.length &&
      importedIds.every((cookieStoreId) => liveIds.includes(cookieStoreId));
    if (
      sourceInstanceId &&
      sourceInstanceId === currentInstanceId &&
      sameIdSet
    ) {
      return {
        mode: "same-profile",
        differences: describeContainerDifferences(imported, live),
      };
    }

    const exact =
      imported.length === live.length &&
      imported.every(
        (container, index) =>
          container.name === live[index].name &&
          container.color === live[index].color &&
          container.icon === live[index].icon,
      );
    if (exact) {
      return { mode: "exact", differences: [] };
    }

    return {
      mode: "mismatch",
      differences: describeContainerDifferences(imported, live),
    };
  }

  function describeContainerDifferences(imported, live) {
    const differences = [];
    if (imported.length !== live.length) {
      differences.push(
        `${imported.length} imported container${imported.length === 1 ? "" : "s"}, ${live.length} in Firefox`,
      );
    }
    const importedNames = imported.map((container) => container.name);
    const liveNames = live.map((container) => container.name);
    const sameNames =
      JSON.stringify([...importedNames].sort()) ===
      JSON.stringify([...liveNames].sort());
    if (sameNames) {
      if (importedNames.some((name, index) => name !== liveNames[index])) {
        differences.push("different order");
      }
    } else {
      differences.push("different names");
    }

    const appearanceKeys = (containers) =>
      containers
        .map(({ name, color, icon }) => `${name}\u0000${color}\u0000${icon}`)
        .sort();
    if (
      sameNames &&
      JSON.stringify(appearanceKeys(imported)) !==
        JSON.stringify(appearanceKeys(live))
    ) {
      differences.push("different colors or icons");
    }
    return differences;
  }

  function createContainerIdMap(importedContainers, targetContainers) {
    if ((importedContainers || []).length !== (targetContainers || []).length) {
      throw new Error("Cannot map imported containers to Firefox containers.");
    }
    return new Map(
      importedContainers.map((container, index) => [
        container.sourceCookieStoreId,
        targetContainers[index].cookieStoreId,
      ]),
    );
  }

  function createSameProfileIdMap(importedContainers, liveContainers) {
    const liveIds = new Set(
      (liveContainers || []).map((container) => container.cookieStoreId),
    );
    const entries = (importedContainers || []).map((container) => [
      container.sourceCookieStoreId,
      container.sourceCookieStoreId,
    ]);
    if (entries.some(([cookieStoreId]) => !liveIds.has(cookieStoreId))) {
      throw new Error("Imported containers no longer match this Firefox profile.");
    }
    return new Map(entries);
  }

  function getIncompatibleShortcutNames(shortcuts, sourcePlatform, targetPlatform) {
    if (!sourcePlatform || !targetPlatform || sourcePlatform === targetPlatform) {
      return [];
    }
    return Object.entries(shortcuts || {})
      .filter(([, shortcut]) =>
        targetPlatform !== "mac" && /(^|\+)(Command|MacCtrl)(\+|$)/.test(shortcut),
      )
      .map(([name]) => name);
  }

  function shortcutsMatch(first, second, platform) {
    const normalize = (shortcut) =>
      platform === "mac"
        ? text(shortcut)
            .split("+")
            .map((key) => key === "Ctrl" ? "Command" : key)
            .join("+")
        : text(shortcut);
    return normalize(first) === normalize(second);
  }

  function hasProxyCredentials(config) {
    return Shared.normalizeConfig(config).proxies.some(
      (proxy) => Boolean(proxy.username || proxy.password),
    );
  }

  function getRecoveryAction(transaction, bundle) {
    if (!transaction) {
      return "none";
    }
    if (transaction.version !== TRANSACTION_VERSION) {
      return "ambiguous";
    }
    if (transaction.phase === "creating") {
      return "rollback";
    }
    const importIsCurrent =
      bundle?.meta?.writer === transaction.writerId &&
      bundle.meta.revision === transaction.targetRevision;
    if (transaction.phase === "cleanup") {
      return importIsCurrent || !transaction.remainingOldContainers?.length
        ? "cleanup"
        : "abandon";
    }
    if (transaction.phase !== "commit-pending") {
      return "ambiguous";
    }
    if (importIsCurrent) {
      return "cleanup";
    }
    if (bundle?.meta?.revision === transaction.initialRevision) {
      return "rollback";
    }
    return "abandon";
  }

  function remapContainerId(cookieStoreId, containerIdMap) {
    if (cookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER) {
      return cookieStoreId;
    }
    const mapped = containerIdMap.get(cookieStoreId);
    if (!mapped) {
      throw new Error(`Cannot map imported container: ${cookieStoreId}`);
    }
    return mapped;
  }

  function remapConfig(config, containerIdMap, activeTab) {
    const normalized = Shared.normalizeConfig(config);
    return Shared.normalizeConfig({
      ...normalized,
      containerSettings: Object.fromEntries(
        Object.entries(normalized.containerSettings).map(([cookieStoreId, setting]) => [
          remapContainerId(cookieStoreId, containerIdMap),
          setting,
        ]),
      ),
      hostRules: normalized.hostRules.map((rule) => ({
        ...rule,
        exceptions: rule.exceptions.map((cookieStoreId) =>
          remapContainerId(cookieStoreId, containerIdMap),
        ),
      })),
      ui: { activeTab },
    });
  }

  function prepareUnlinkedConfig(config, activeTab) {
    const normalized = Shared.normalizeConfig(config);
    return Shared.normalizeConfig({
      ...normalized,
      containerSettings: {},
      hostRules: normalized.hostRules.map((rule) => ({
        ...rule,
        enabled: false,
        exceptions: [],
      })),
      ui: { activeTab },
    });
  }

  const api = {
    FORMAT_KIND,
    FORMAT_VERSION,
    INSTANCE_KEY,
    TRANSACTION_KEY,
    TRANSACTION_VERSION,
    analyzeContainerMatch,
    createContainerIdMap,
    createExportDocument,
    createSameProfileIdMap,
    getIncompatibleShortcutNames,
    getRecoveryAction,
    hasProxyCredentials,
    parseImportDocument,
    parseImportText,
    prepareUnlinkedConfig,
    remapConfig,
    shortcutsMatch,
  };

  global.PrivacyContainersConfigTransfer = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
