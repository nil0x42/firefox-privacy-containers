import {
  FIREFOX_DEFAULT_CONTAINER,
  createContainerLookup,
  getContainerIdForSlot,
  getContainerSlot,
  getContainerSlots,
  getContainerTechnicalLabel,
  getDuplicateLiveContainerGroups,
  normalizeContainerIdentityName,
  normalizeContainerName,
} from "../domain/containers.js";
import {
  buildCookieQueryDetails,
  buildCookieRemovalDetails,
  buildCookieRemovalUrl,
} from "../domain/cookies.js";
import {
  GO_ONE_TAB_LEFT_COMMAND,
  GO_ONE_TAB_RIGHT_COMMAND,
  MOVE_TAB_LEFT_COMMAND,
  MOVE_TAB_RIGHT_COMMAND,
  OPEN_CONTAINER_SLOT_COMMAND_PREFIX,
  OPEN_CURRENT_CONTAINER_TAB_COMMAND,
  REOPEN_CONTAINER_SLOT_COMMAND_PREFIX,
  SHORTCUT_SLOT_COUNT,
  TOGGLE_TAB_PINNED_COMMAND,
  captureShortcutFromEventData,
  getFixedShortcutCommandDescription,
  getOpenContainerSlotCommandName,
  getReopenContainerSlotCommandName,
  getShortcutActivationIssue,
  getSlotNumberFromCommandName,
  isOpenContainerSlotCommand,
  isReopenContainerSlotCommand,
  normalizeShortcutKey,
} from "../domain/shortcuts.js";
import {
  clone,
  isRecord,
  normalizeBoolean,
  normalizeText,
} from "../domain/values.js";
import { createId } from "../domain/ids.js";
import {
  buildRequestContext,
  createHostSuffixSet,
  ensureRequestTarget,
  getEffectiveCookieStoreId,
  hostMatchesAnyNormalizedRule,
  hostMatchesAnyRule,
  hostMatchesCompiledNormalizedHost,
  hostMatchesNormalizedRule,
  hostMatchesRule,
  isLoopbackHost,
  isLoopbackNormalizedHost,
  normalizeHostRule,
  parseRequestHost,
  parseRequestTarget,
  uniqueSortedHosts,
} from "../domain/hosts.js";
import {
  BLOCKED_REOPEN_PREFIXES,
  canReopenTabUrl,
  getActionableTabValidation,
  getReopenableTabValidation,
  getTabPlacementValidation,
  isActionableTabUrl,
  isExtensionTabUrl,
} from "../domain/tabs.js";

  const CONFIG_KEY = "config";
  const CONFIG_SCHEMA_VERSION = 4;
  const NETWORK_REQUEST_URL_PATTERNS = [
    "http://*/*",
    "https://*/*",
    "ws://*/*",
    "wss://*/*",
  ];
  const PROXY_TYPE_POLICIES = Object.freeze({
    http: Object.freeze({
      defaultValue: true,
      editable: false,
      preserveProxyDNS: false,
      firefoxType: "http",
      socksFamily: false,
    }),
    https: Object.freeze({
      defaultValue: true,
      editable: false,
      preserveProxyDNS: false,
      firefoxType: "https",
      socksFamily: false,
    }),
    socks: Object.freeze({
      defaultValue: true,
      editable: true,
      preserveProxyDNS: true,
      firefoxType: "socks",
      socksFamily: true,
    }),
    socks4: Object.freeze({
      defaultValue: false,
      editable: true,
      preserveProxyDNS: false,
      firefoxType: "socks4",
      socksFamily: true,
    }),
    socks4a: Object.freeze({
      defaultValue: true,
      editable: true,
      preserveProxyDNS: false,
      firefoxType: "socks4",
      socksFamily: true,
    }),
  });
  const INVALID_PROXY_TYPE_POLICY = Object.freeze({
    defaultValue: false,
    editable: false,
    preserveProxyDNS: false,
    firefoxType: "",
    socksFamily: false,
  });
  const PROXY_TYPES = Object.freeze(Object.keys(PROXY_TYPE_POLICIES));
  const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
  const HOST_RULE_MODES = ["blacklist", "whitelist"];
  const FIREFOX_TO_PWNFOX_COLORS = {
    blue: "blue",
    turquoise: "cyan",
    cyan: "cyan",
    green: "green",
    yellow: "yellow",
    orange: "orange",
    red: "red",
    pink: "pink",
    purple: "magenta",
    violet: "magenta",
    toolbar: "gray",
    gray: "gray",
  };
  const DEFAULT_TELEMETRY_HOSTS = [
    "firefox-settings-attachments.cdn.mozilla.net",
    "detectportal.firefox.com",
    "contile.services.mozilla.com",
    "firefox.settings.services.mozilla.com",
    "classify-client.services.mozilla.com",
    "safebrowsing.googleapis.com",
    "www.google-analytics.com",
    "geller-pa.googleapis.com",
    "graph.facebook.com",
    "pubsub.googleapis.com",
    "www.googletagmanager.com",
    "content-autofill.googleapis.com",
    "www.googleapis.com",
    "analytics.google.com",
    "googleads.g.doubleclick.net",
    "analytics.twitter.com",
    "analytics.tiktok.com",
    "fonts.googleapis.com",
    "adservice.google.com",
    "doubleclick.net",
    "bat.bing.com",
    "connect.facebook.net",
    "googletagmanager.com",
    "s.clarity.ms",
    "tr.snapchat.com",
    "s.amazon-adsystem.com",
    "sdk.split.io",
    "hotjar.io",
    "mixpanel.com",
    "hotjar.com",
    "i.ytimg.com",
    "ads.mozilla.org",
    "ads-img.mozilla.org",
    "versioncheck-bg.addons.mozilla.org",
    "services.addons.mozilla.org",
  ];
  function normalizeHostRuleName(value) {
    return normalizeText(value);
  }

  function normalizeHostRuleEnabled(value) {
    return normalizeBoolean(value, true);
  }

  function normalizeHostRuleMode(value) {
    const mode = normalizeText(value).toLowerCase();
    return HOST_RULE_MODES.includes(mode) ? mode : "blacklist";
  }

  function createHostRuleId() {
    return createId("host-rule");
  }

  function normalizeProxyHost(value) {
    return normalizeHostRule(value);
  }

  function validateHostPattern(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
      return {
        pattern: "",
        error: "Host pattern is required",
      };
    }

    if (text.includes("://")) {
      return {
        pattern: "",
        error: "Scheme is not allowed",
      };
    }

    if (/[/?#]/.test(text)) {
      return {
        pattern: "",
        error: "Path and query are not allowed",
      };
    }

    if (text.includes("@")) {
      return {
        pattern: "",
        error: "User info is not allowed",
      };
    }

    if (/\s/.test(text)) {
      return {
        pattern: "",
        error: "Whitespace is not allowed",
      };
    }

    if (text.startsWith(".")) {
      return {
        pattern: "",
        error: "Host pattern cannot start with a dot",
      };
    }

    if (text.includes("*")) {
      if (
        text.includes("[") ||
        text.includes("]") ||
        text.includes(":")
      ) {
        return {
          pattern: "",
          error: "Ports and IPv6 are not supported in host globs",
        };
      }

      if (
        text.endsWith(".") ||
        text.includes("..") ||
        !/[a-z0-9]/.test(text) ||
        !/^[a-z0-9.*-]+$/.test(text)
      ) {
        return {
          pattern: "",
          error: "Host glob format is invalid",
        };
      }

      return {
        pattern: text,
        error: "",
      };
    }

    if ((text.match(/:/g) || []).length === 1 && !text.startsWith("[")) {
      return {
        pattern: "",
        error: "Port is not allowed",
      };
    }

    const normalized = normalizeHostRule(text);
    if (!normalized || normalized.includes("*")) {
      return {
        pattern: "",
        error: "Hostname is invalid",
      };
    }

    return {
      pattern: normalized,
      error: "",
    };
  }

  function normalizeHostPattern(value) {
    return validateHostPattern(value).pattern;
  }

  function parseHostPatternLines(text) {
    const input = String(text || "");
    const patterns = [];
    const errors = [];
    const seen = new Set();

    input.split(/\r?\n/).forEach((rawLine, lineIndex) => {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        return;
      }

      const validation = validateHostPattern(trimmed);
      if (!validation.pattern) {
        errors.push({
          line: lineIndex + 1,
          message: validation.error,
        });
        return;
      }

      if (seen.has(validation.pattern)) {
        return;
      }

      seen.add(validation.pattern);
      patterns.push(validation.pattern);
    });

    return {
      patterns,
      errors,
      valid: errors.length === 0,
    };
  }

  function normalizeHostRulePatterns(value) {
    if (typeof value === "string") {
      return parseHostPatternLines(value).patterns;
    }

    const source = Array.isArray(value) ? value : [];
    const patterns = [];
    const seen = new Set();

    source.forEach((entry) => {
      const normalized = normalizeHostPattern(entry);
      if (!normalized || seen.has(normalized)) {
        return;
      }

      seen.add(normalized);
      patterns.push(normalized);
    });

    return patterns;
  }

  function normalizeHostRuleExceptions(value) {
    const source = Array.isArray(value) ? value : [];
    const exceptions = [];
    const seen = new Set();

    source.forEach((entry) => {
      const cookieStoreId = normalizeText(entry);
      if (!cookieStoreId || seen.has(cookieStoreId)) {
        return;
      }

      seen.add(cookieStoreId);
      exceptions.push(cookieStoreId);
    });

    return exceptions;
  }

  function normalizeHostRuleCard(rule, fallbackId) {
    const source = rule && typeof rule === "object" ? rule : {};
    return {
      id: normalizeText(source.id) || fallbackId || createHostRuleId(),
      name: normalizeHostRuleName(source.name),
      enabled: normalizeHostRuleEnabled(source.enabled),
      mode: normalizeHostRuleMode(source.mode),
      patterns: normalizeHostRulePatterns(source.patterns),
      exceptions: normalizeHostRuleExceptions(source.exceptions),
    };
  }

  function normalizeHostRules(value) {
    const source = Array.isArray(value) ? value : [];
    return source.map((rule, index) =>
      normalizeHostRuleCard(rule, `host-rule-${index + 1}`),
    );
  }

  function validateHostRule(rule, label) {
    const normalized = normalizeHostRuleCard(rule);
    const prefix = label || normalized.name || normalized.id;
    const errors = [];

    if (!normalized.name) {
      errors.push(`${prefix}: name is required`);
    }

    if (!normalized.patterns.length) {
      errors.push(`${prefix}: at least one host pattern is required`);
    }

    return {
      rule: normalized,
      errors,
      valid: errors.length === 0,
    };
  }

  function normalizePort(value) {
    const text = normalizeText(value);
    if (!/^\d+$/.test(text)) {
      return null;
    }

    const port = Number(text);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }

    return port;
  }

  function normalizeProxyType(value) {
    const type = normalizeText(value).toLowerCase();
    return PROXY_TYPES.includes(type) ? type : "";
  }

  function getProxyTypePolicy(value) {
    const type = normalizeProxyType(value);
    return PROXY_TYPE_POLICIES[type] || INVALID_PROXY_TYPE_POLICY;
  }

  function normalizeProxyDNS(type, value) {
    const policy = getProxyTypePolicy(type);
    return policy.preserveProxyDNS
      ? normalizeBoolean(value, policy.defaultValue)
      : policy.defaultValue;
  }

  function getProxyTypeForDNSChoice(value, proxyDNS) {
    const type = normalizeProxyType(value);
    if (type === "socks4" || type === "socks4a") {
      return proxyDNS ? "socks4a" : "socks4";
    }

    return type;
  }

  function normalizeProxyId(value) {
    const proxyId = normalizeText(value);
    return proxyId === "direct" ? "" : proxyId;
  }

  function normalizeProxyTitleKey(value) {
    return normalizeText(value).toLowerCase();
  }

  function isSocksProxyType(type) {
    return getProxyTypePolicy(type).socksFamily;
  }

  function createProxyId() {
    return createId("proxy");
  }

  function normalizeProxy(proxy, fallbackId) {
    const type = normalizeProxyType(proxy && proxy.type);
    const id = normalizeText(proxy && proxy.id) || fallbackId || createProxyId();
    const isSocks = isSocksProxyType(type);

    return {
      id,
      title: normalizeText(proxy && proxy.title),
      type,
      host: normalizeProxyHost(proxy && proxy.host),
      port: normalizePort(proxy && proxy.port),
      username: isSocks ? "" : normalizeText(proxy && proxy.username),
      password: isSocks ? "" : normalizeText(proxy && proxy.password),
      proxyDNS: normalizeProxyDNS(type, proxy && proxy.proxyDNS),
      doNotProxyLocal: normalizeBoolean(proxy && proxy.doNotProxyLocal, true),
      bypass: normalizeProxyBypass(proxy && proxy.bypass, proxy && proxy.legacyBypass),
    };
  }

  function validateProxy(proxy, label) {
    const normalized = normalizeProxy(proxy);
    const prefix = label || normalized.title || normalized.id;
    const errors = [];

    if (!normalized.type) {
      errors.push(`${prefix}: proxy type is required`);
    }

    if (!normalized.host) {
      errors.push(`${prefix}: host is required`);
    }

    if (normalized.port == null) {
      errors.push(`${prefix}: port must be an integer between 1 and 65535`);
    }

    return {
      proxy: normalized,
      errors,
      valid: errors.length === 0,
    };
  }

  function isUsableProxy(proxy) {
    return Boolean(
      proxy &&
        normalizeProxyType(proxy.type) &&
        proxy.host &&
        Number.isInteger(proxy.port),
    );
  }

  function formatStatusFieldList(items) {
    if (!items.length) {
      return "";
    }

    if (items.length === 1) {
      return items[0];
    }

    if (items.length === 2) {
      return `${items[0]} and ${items[1]}`;
    }

    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }

  function getProxyStatus(proxy) {
    const normalized = normalizeProxy(proxy);
    const missing = [];

    if (!normalized.type) {
      missing.push("a proxy type");
    }

    if (!normalized.host) {
      missing.push("a host");
    }

    if (normalized.port == null) {
      missing.push("a valid port");
    }

    const isComplete = missing.length === 0;
    return {
      status: isComplete ? "complete" : "incomplete",
      isComplete,
      isActivable: isComplete,
      missing,
      reason: isComplete
        ? ""
        : `Add ${formatStatusFieldList(missing)} to activate this proxy.`,
    };
  }

  function getHostRuleStatus(rule) {
    const normalized = normalizeHostRuleCard(rule);
    const compiledPatterns = normalized.patterns
      .map((pattern) => compileHostPattern(pattern))
      .filter(Boolean);
    const isComplete = compiledPatterns.length > 0;

    return {
      status: isComplete ? "complete" : "incomplete",
      isComplete,
      isActivable: normalized.enabled && isComplete,
      compiledPatternCount: compiledPatterns.length,
      reason: isComplete
        ? normalized.enabled
          ? ""
          : "This rule is saved but disabled."
        : "Add at least one host pattern to activate this rule.",
    };
  }

  function normalizeHeaderName(value) {
    const name = normalizeText(value);
    return HEADER_NAME_PATTERN.test(name) ? name : "";
  }

  function normalizeHeaderValue(value) {
    return value == null ? "" : String(value);
  }

  function createHeaderId(prefix) {
    return createId(prefix || "header");
  }

  function normalizeHeaderEntry(entry, fallbackId) {
    const name = normalizeHeaderName(entry && entry.name);
    if (!name) {
      return null;
    }

    return {
      id: normalizeText(entry && entry.id) || fallbackId || createHeaderId(),
      name,
      value: normalizeHeaderValue(entry && entry.value),
    };
  }

  function normalizeHeaderEntries(value, prefix) {
    const source = Array.isArray(value) ? value : [];
    const headers = [];

    source.forEach((entry, index) => {
      const normalized = normalizeHeaderEntry(
        entry,
        `${prefix || "header"}-${index + 1}`,
      );
      if (normalized) {
        headers.push(normalized);
      }
    });

    return headers;
  }

  function headersToMultilineText(headers) {
    return normalizeHeaderEntries(headers)
      .map((header) => `${header.name}: ${header.value}`)
      .join("\n");
  }

  function parseHeaderLines(text, existingHeaders, prefix) {
    const input = String(text || "");
    const currentHeaders = normalizeHeaderEntries(existingHeaders, prefix);
    const headers = [];
    const errors = [];
    let headerIndex = 0;

    input.split(/\r?\n/).forEach((rawLine, lineIndex) => {
      if (!rawLine.trim()) {
        return;
      }

      const separatorIndex = rawLine.indexOf(":");
      if (separatorIndex === -1) {
        errors.push({
          line: lineIndex + 1,
          message: 'Missing ":" separator',
        });
        return;
      }

      const name = normalizeHeaderName(rawLine.slice(0, separatorIndex));
      if (!name) {
        errors.push({
          line: lineIndex + 1,
          message: "Header name is invalid",
        });
        return;
      }

      const rawValue = rawLine.slice(separatorIndex + 1);
      const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
      const previous = currentHeaders[headerIndex];

      headers.push({
        id: previous && previous.id ? previous.id : createHeaderId(prefix),
        name,
        value,
      });
      headerIndex += 1;
    });

    return {
      headers,
      errors,
      valid: errors.length === 0,
    };
  }

  function createDefaultContainerSetting() {
    return {
      proxyId: "",
      headers: [],
      pwnFoxColorEnabled: false,
    };
  }

  function createDefaultProxyBypass() {
    return {
      optionsMethod: false,
      customHostsEnabled: false,
      customHosts: uniqueSortedHosts(DEFAULT_TELEMETRY_HOSTS, []),
    };
  }
  function normalizeProxyBypass(value, legacyBypass) {
    const defaults = createDefaultProxyBypass();
    const source = value && typeof value === "object" ? value : {};
    const legacy = legacyBypass && typeof legacyBypass === "object" ? legacyBypass : {};
    const sourceCustomHosts = Array.isArray(source.customHosts)
      ? source.customHosts
      : null;
    const legacyCustomHosts = Array.isArray(legacy.customHosts)
      ? legacy.customHosts
      : null;

    return {
      optionsMethod: normalizeBoolean(
        source.optionsMethod,
        normalizeBoolean(legacy.optionsMethod, defaults.optionsMethod),
      ),
      customHostsEnabled: normalizeBoolean(
        source.customHostsEnabled,
        normalizeBoolean(legacy.customEnabled, defaults.customHostsEnabled),
      ),
      customHosts: uniqueSortedHosts(
        sourceCustomHosts ||
          (legacyCustomHosts
            ? [...defaults.customHosts, ...legacyCustomHosts]
            : defaults.customHosts),
        defaults.customHosts,
      ),
    };
  }

  function normalizeContainerSetting(setting) {
    const source = setting && typeof setting === "object" ? setting : {};
    return {
      proxyId: normalizeProxyId(source.proxyId),
      headers: normalizeHeaderEntries(source.headers, "container-header"),
      pwnFoxColorEnabled: normalizeBoolean(source.pwnFoxColorEnabled, false),
    };
  }

  function hasContainerSettingData(setting) {
    return Boolean(
      setting.proxyId || setting.headers.length || setting.pwnFoxColorEnabled,
    );
  }

  function normalizeContainerSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const result = {};

    Object.keys(source).forEach((cookieStoreId) => {
      const normalizedCookieStoreId = normalizeText(cookieStoreId);
      if (!normalizedCookieStoreId) {
        return;
      }

      const setting = normalizeContainerSetting(source[cookieStoreId]);
      if (hasContainerSettingData(setting)) {
        result[normalizedCookieStoreId] = setting;
      }
    });

    return result;
  }

  function createDefaultConfig() {
    return {
      proxies: [],
      containerSettings: {},
      hostRules: [],
      globalHeaders: [],
    };
  }

  function normalizeConfig(rawConfig) {
    const raw = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    const legacyBypass = raw.bypass && typeof raw.bypass === "object" ? raw.bypass : {};
    const proxies = Array.isArray(raw.proxies)
      ? raw.proxies.map((proxy, index) =>
          normalizeProxy(
            {
              ...proxy,
              legacyBypass,
            },
            `proxy-${index + 1}`,
          ),
        )
      : [];
    const proxyIds = new Set(proxies.map((proxy) => proxy.id));

    return {
      proxies,
      containerSettings: normalizeContainerSettings(raw.containerSettings, proxyIds),
      hostRules: normalizeHostRules(raw.hostRules),
      globalHeaders: normalizeHeaderEntries(raw.globalHeaders, "global-header"),
    };
  }

  function validateConfig(config) {
    const normalized = normalizeConfig(config);
    const errors = [];
    const proxyIds = new Set();
    const proxyTitles = new Set();
    const hostRuleIds = new Set();

    // The options UI persists newly created cards before required fields are filled in.
    // Save-time validation therefore enforces identity collisions only; per-card editors
    // still use validateProxy/validateHostRule for inline feedback.
    normalized.proxies.forEach((proxy) => {
      if (proxyIds.has(proxy.id)) {
        errors.push(`Duplicate proxy id: ${proxy.id}`);
      } else {
        proxyIds.add(proxy.id);
      }

      if (proxy.title) {
        const normalizedTitle = normalizeProxyTitleKey(proxy.title);
        if (proxyTitles.has(normalizedTitle)) {
          errors.push(`Duplicate proxy title: ${proxy.title}`);
        } else {
          proxyTitles.add(normalizedTitle);
        }
      }
    });

    normalized.hostRules.forEach((rule) => {
      if (hostRuleIds.has(rule.id)) {
        errors.push(`Duplicate host rule id: ${rule.id}`);
      } else {
        hostRuleIds.add(rule.id);
      }
    });

    return {
      config: normalized,
      errors,
      valid: errors.length === 0,
    };
  }

  function getPwnFoxColorValue(firefoxColor) {
    return FIREFOX_TO_PWNFOX_COLORS[normalizeText(firefoxColor)] || "";
  }

  function isSupportedPwnFoxColor(firefoxColor) {
    return Boolean(getPwnFoxColorValue(firefoxColor));
  }

  function getProxyById(config, proxyId) {
    if (!proxyId) {
      return null;
    }

    const proxies = config && Array.isArray(config.proxies) ? config.proxies : [];
    return proxies.find((proxy) => proxy.id === proxyId) || null;
  }

  function getContainerSetting(config, cookieStoreId) {
    const settings =
      config && config.containerSettings && typeof config.containerSettings === "object"
        ? config.containerSettings
        : {};

    return normalizeContainerSetting(settings[cookieStoreId]);
  }

  function getAssignedProxyId(config, cookieStoreId) {
    return getContainerSetting(config, cookieStoreId).proxyId;
  }

  function getAssignedProxy(config, cookieStoreId) {
    return getProxyById(config, getAssignedProxyId(config, cookieStoreId));
  }

  function resolveProxyAssignment(config, cookieStoreId) {
    const proxyId = getAssignedProxyId(config, cookieStoreId);
    if (!proxyId) {
      return {
        status: "absent",
        proxyId: "",
        proxy: null,
        proxyStatus: null,
        isBlocking: false,
        displayName: "Direct",
        reason: "",
      };
    }

    const proxy = getProxyById(config, proxyId);
    if (!proxy) {
      return {
        status: "invalid-reference",
        proxyId,
        proxy: null,
        proxyStatus: null,
        isBlocking: true,
        displayName: proxyId,
        reason:
          "This container still references a proxy that no longer exists. Requests are blocked until you remove or replace it.",
      };
    }

    const proxyStatus = getProxyStatus(proxy);
    if (!proxyStatus.isActivable) {
      return {
        status: "invalid-reference",
        proxyId,
        proxy,
        proxyStatus,
        isBlocking: true,
        displayName: getProxyDisplayName(proxy),
        reason:
          "This container is assigned to a draft proxy. Requests are blocked until that proxy is completed or removed.",
      };
    }

    return {
      status: "valid",
      proxyId,
      proxy,
      proxyStatus,
      isBlocking: false,
      displayName: getProxyDisplayName(proxy),
      reason: "",
    };
  }

  function getEffectiveProxy(config, cookieStoreId) {
    const assignment = resolveProxyAssignment(config, cookieStoreId);
    return assignment.status === "valid" ? assignment.proxy : null;
  }

  function supportsProxyAuth(proxy) {
    return proxy && (proxy.type === "http" || proxy.type === "https");
  }

  function getProxyBypass(proxy) {
    return normalizeProxyBypass(proxy && proxy.bypass);
  }

  function asProxyRequestInfo(proxy) {
    if (!isUsableProxy(proxy)) {
      return null;
    }

    const proxyTypePolicy = getProxyTypePolicy(proxy.type);

    const result = {
      type: proxyTypePolicy.firefoxType,
      host: proxy.host,
      port: proxy.port,
    };

    if (proxyTypePolicy.socksFamily) {
      result.proxyDNS = normalizeProxyDNS(proxy.type, proxy.proxyDNS);
    }

    return result;
  }

  function getProxyDisplayName(proxy) {
    if (!proxy) {
      return "Direct";
    }

    return proxy.title || `${proxy.type}://${proxy.host}:${proxy.port}`;
  }

  function compileHostPattern(pattern) {
    const normalizedPattern = normalizeHostPattern(pattern);
    if (!normalizedPattern) {
      return null;
    }

    if (!normalizedPattern.includes("*")) {
      return {
        pattern: normalizedPattern,
        hasWildcard: false,
        matchesNormalizedHost(normalizedHost) {
          return normalizedHost === normalizedPattern;
        },
        matches(host) {
          return this.matchesNormalizedHost(normalizeHostRule(host));
        },
      };
    }

    const parts = normalizedPattern.split("*");
    const startsWithWildcard = normalizedPattern.startsWith("*");
    const endsWithWildcard = normalizedPattern.endsWith("*");

    return {
      pattern: normalizedPattern,
      hasWildcard: true,
      parts: parts.slice(),
      startsWithWildcard,
      endsWithWildcard,
      matchesNormalizedHost(normalizedHost) {
        if (!normalizedHost) {
          return false;
        }

        if (
          !startsWithWildcard &&
          parts[0] &&
          !normalizedHost.startsWith(parts[0])
        ) {
          return false;
        }

        if (
          !endsWithWildcard &&
          parts[parts.length - 1] &&
          !normalizedHost.endsWith(parts[parts.length - 1])
        ) {
          return false;
        }

        let position = 0;

        for (let index = 0; index < parts.length; index += 1) {
          const part = parts[index];
          if (!part) {
            continue;
          }

          const matchIndex = normalizedHost.indexOf(part, position);
          if (matchIndex === -1) {
            return false;
          }

          if (index === 0 && !startsWithWildcard && matchIndex !== 0) {
            return false;
          }

          position = matchIndex + part.length;
        }

        return true;
      },
      matches(host) {
        return this.matchesNormalizedHost(normalizeHostRule(host));
      },
    };
  }

  function compileHostRulePlan(rule) {
    const normalized = normalizeHostRuleCard(rule);
    const compiledPatterns = [];
    const exactPatterns = [];
    const wildcardPatterns = [];

    normalized.patterns.forEach((pattern) => {
      const compiledPattern = compileHostPattern(pattern);
      if (!compiledPattern) {
        return;
      }

      compiledPatterns.push(compiledPattern);
      if (compiledPattern.hasWildcard) {
        wildcardPatterns.push(compiledPattern);
      } else {
        exactPatterns.push(compiledPattern.pattern);
      }
    });

    const exactPatternsSet = new Set(exactPatterns);
    const exceptionSet = new Set(normalized.exceptions);
    const defaultDecision = normalized.mode === "blacklist" ? "block" : "allow";

    return {
      id: normalized.id,
      name: normalized.name,
      enabled: normalized.enabled,
      mode: normalized.mode,
      compiledPatterns,
      exactPatterns,
      exactPatternsSet,
      wildcardPatterns,
      exceptionSet,
      defaultDecision,
      allowedContainerIdsForBlockedPage:
        normalized.mode === "blacklist" ? normalized.exceptions.slice() : [],
      matchesHost(host) {
        return this.matchesNormalizedHost(normalizeHostRule(host));
      },
      matchesNormalizedHost(normalizedHost) {
        if (!normalizedHost || !compiledPatterns.length) {
          return false;
        }

        if (exactPatternsSet.has(normalizedHost)) {
          return true;
        }

        for (let index = 0; index < wildcardPatterns.length; index += 1) {
          if (wildcardPatterns[index].matchesNormalizedHost(normalizedHost)) {
            return true;
          }
        }

        return false;
      },
      decideForContainer(cookieStoreId) {
        const effectiveCookieStoreId =
          normalizeText(cookieStoreId) || FIREFOX_DEFAULT_CONTAINER;
        if (!exceptionSet.has(effectiveCookieStoreId)) {
          return defaultDecision;
        }

        return defaultDecision === "block" ? "allow" : "block";
      },
    };
  }

  function hostPatternsObviouslyOverlap(compiledPatternA, compiledPatternB) {
    if (!compiledPatternA || !compiledPatternB) {
      return false;
    }

    if (compiledPatternA.pattern === compiledPatternB.pattern) {
      return true;
    }

    if (!compiledPatternA.hasWildcard && compiledPatternB.hasWildcard) {
      return compiledPatternB.matchesNormalizedHost(compiledPatternA.pattern);
    }

    if (compiledPatternA.hasWildcard && !compiledPatternB.hasWildcard) {
      return compiledPatternA.matchesNormalizedHost(compiledPatternB.pattern);
    }

    return false;
  }

  function detectPossibleHostRuleOverlapIds(hostRules) {
    const activeRules = normalizeHostRules(hostRules).filter((rule) =>
      getHostRuleStatus(rule).isActivable,
    );
    const overlapIds = new Set();
    const compiledEntries = activeRules.map((rule) => ({
      rule,
      compiledPatterns: rule.patterns
        .map((pattern) => compileHostPattern(pattern))
        .filter(Boolean),
    }));

    for (let leftIndex = 0; leftIndex < compiledEntries.length; leftIndex += 1) {
      const left = compiledEntries[leftIndex];

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < compiledEntries.length;
        rightIndex += 1
      ) {
        const right = compiledEntries[rightIndex];
        const overlaps = left.compiledPatterns.some((leftPattern) =>
          right.compiledPatterns.some((rightPattern) =>
            hostPatternsObviouslyOverlap(leftPattern, rightPattern),
          ),
        );

        if (!overlaps) {
          continue;
        }

        overlapIds.add(left.rule.id);
        overlapIds.add(right.rule.id);
      }
    }

    return overlapIds;
  }

  function getWildcardPatternRequiredSuffix(compiledPattern) {
    if (
      !compiledPattern ||
      !compiledPattern.hasWildcard ||
      compiledPattern.endsWithWildcard
    ) {
      return "";
    }

    for (let index = compiledPattern.parts.length - 1; index >= 0; index -= 1) {
      if (compiledPattern.parts[index]) {
        return compiledPattern.parts[index];
      }
    }

    return "";
  }

  function createWildcardPatternTrieNode() {
    return {
      children: null,
      entries: null,
      minEntryIndex: Infinity,
    };
  }

  function addWildcardPatternEntryToSuffixTrie(rootNode, requiredSuffix, entry) {
    let node = rootNode;

    for (let index = requiredSuffix.length - 1; index >= 0; index -= 1) {
      const character = requiredSuffix[index];
      if (!node.children) {
        node.children = Object.create(null);
      }

      if (!node.children[character]) {
        node.children[character] = createWildcardPatternTrieNode();
      }

      node = node.children[character];
    }

    if (!node.entries) {
      node.entries = [];
    }

    node.entries.push(entry);
    if (entry.index < node.minEntryIndex) {
      node.minEntryIndex = entry.index;
    }
  }

  function findFirstMatchingWildcardEntry(entries, normalizedHost, winningIndex) {
    if (!Array.isArray(entries) || !entries.length || entries[0].index >= winningIndex) {
      return null;
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.index >= winningIndex) {
        break;
      }

      if (entry.pattern.matchesNormalizedHost(normalizedHost)) {
        return entry;
      }
    }

    return null;
  }

  function findFirstMatchingWildcardEntryFromSuffixTrie(
    rootNode,
    normalizedHost,
    winningIndex,
  ) {
    if (!rootNode || !normalizedHost) {
      return null;
    }

    let node = rootNode;
    let firstEntry = null;
    let firstIndex = winningIndex;

    for (let index = normalizedHost.length - 1; index >= 0; index -= 1) {
      if (!node.children) {
        break;
      }

      node = node.children[normalizedHost[index]];
      if (!node) {
        break;
      }

      if (node.minEntryIndex >= firstIndex) {
        continue;
      }

      const matchingEntry = findFirstMatchingWildcardEntry(
        node.entries,
        normalizedHost,
        firstIndex,
      );
      if (!matchingEntry) {
        continue;
      }

      firstEntry = matchingEntry;
      firstIndex = matchingEntry.index;
      if (firstIndex === 0) {
        break;
      }
    }

    return firstEntry;
  }

  function getHostRuleDecisionForNormalizedHost(
    hostRuleRuntime,
    normalizedHost,
    cookieStoreId,
  ) {
    if (!hostRuleRuntime || !normalizedHost || !hostRuleRuntime.hasAnyEnabledRules) {
      return null;
    }

    const orderedPlans = hostRuleRuntime.orderedHostRulePlans;
    const effectiveCookieStoreId = getEffectiveCookieStoreId(cookieStoreId);
    let winningPlan = null;
    let winningIndex = Infinity;

    if (hostRuleRuntime.exactPlanIndexByHost.has(normalizedHost)) {
      winningIndex = hostRuleRuntime.exactPlanIndexByHost.get(normalizedHost);
      winningPlan = orderedPlans[winningIndex] || null;
    }

    const suffixTrieMatch = findFirstMatchingWildcardEntryFromSuffixTrie(
      hostRuleRuntime.suffixWildcardPatternTrieRoot,
      normalizedHost,
      winningIndex,
    );
    if (suffixTrieMatch) {
      winningIndex = suffixTrieMatch.index;
      winningPlan = suffixTrieMatch.plan;
    }

    const fallbackMatch = findFirstMatchingWildcardEntry(
      hostRuleRuntime.fallbackWildcardPatternEntries,
      normalizedHost,
      winningIndex,
    );
    if (fallbackMatch) {
      winningIndex = fallbackMatch.index;
      winningPlan = fallbackMatch.plan;
    }

    if (!winningPlan) {
      return null;
    }

    const winningDecision = winningPlan.decideForContainer(effectiveCookieStoreId);

    return {
      host: normalizedHost,
      cookieStoreId: effectiveCookieStoreId,
      ruleId: winningPlan.id,
      ruleName: winningPlan.name,
      mode: winningPlan.mode,
      decision: winningDecision,
      allowedContainerIdsForBlockedPage:
        winningPlan.allowedContainerIdsForBlockedPage,
      plan: winningPlan,
    };
  }

  function getHostRuleDecision(hostRuleRuntime, host, cookieStoreId) {
    return getHostRuleDecisionForNormalizedHost(
      hostRuleRuntime,
      normalizeHostRule(host),
      cookieStoreId,
    );
  }

  function compileBypassMatcher(bypass) {
    const normalizedBypass = normalizeProxyBypass(bypass);
    const customRules = createHostSuffixSet(normalizedBypass.customHosts);
    const hasCustomHostRules =
      normalizedBypass.customHostsEnabled && customRules.size > 0;

    return {
      hasMatchers: normalizedBypass.optionsMethod || hasCustomHostRules,
      optionsMethod: normalizedBypass.optionsMethod,
      customHostsEnabled: normalizedBypass.customHostsEnabled,
      customHosts: Array.from(customRules),
      matches(method, host) {
        if (normalizedBypass.optionsMethod && method === "OPTIONS") {
          return true;
        }

        return Boolean(
          hasCustomHostRules && hostMatchesCompiledNormalizedHost(host, customRules),
        );
      },
      matchesNormalizedHost(method, normalizedHost) {
        return this.matches(method, normalizedHost);
      },
    };
  }

  function dedupeCompiledHeaders(headers) {
    const input = Array.isArray(headers) ? headers : [];
    const deduped = [];
    const seenNames = new Set();

    for (let index = input.length - 1; index >= 0; index -= 1) {
      const header = input[index];
      if (!header || typeof header.name !== "string") {
        continue;
      }

      const normalizedName = header.name.toLowerCase();
      if (seenNames.has(normalizedName)) {
        continue;
      }

      seenNames.add(normalizedName);
      deduped.push({ ...header });
    }

    deduped.reverse();
    return deduped;
  }

  function compileHeaderPlan(globalHeaders, scopedHeaders, pwnFoxValue) {
    const headers = [];

    if (pwnFoxValue) {
      headers.push({
        name: "X-PwnFox-Color",
        value: pwnFoxValue,
      });
    }

    headers.push(...globalHeaders, ...scopedHeaders);

    const dedupedHeaders = dedupeCompiledHeaders(headers);
    if (!dedupedHeaders.length) {
      return null;
    }

    const compiledHeaders = dedupedHeaders.map((header) => ({
      ...header,
      normalizedName: header.name.toLowerCase(),
    }));
    const headerNameSet = new Set();
    const headerByNormalizedName = new Map();

    compiledHeaders.forEach((header) => {
      headerNameSet.add(header.normalizedName);
      headerByNormalizedName.set(header.normalizedName, header);
    });

    const headerCount = compiledHeaders.length;
    return {
      headers: dedupedHeaders,
      compiledHeaders,
      headerCount,
      headerNameSet,
      headerByNormalizedName,
      singleHeader: headerCount === 1 ? compiledHeaders[0] : null,
      smallCompiledHeaders: headerCount <= 3 ? compiledHeaders : null,
    };
  }

  function normalizeRequestHeaderName(header) {
    return header && typeof header.name === "string"
      ? header.name.toLowerCase()
      : "";
  }

  function copyCompiledHeader(header) {
    return {
      name: header.name,
      value: header.value,
    };
  }

  function copyCompiledHeaders(headers) {
    return (Array.isArray(headers) ? headers : []).map(copyCompiledHeader);
  }

  function mergeRequestHeadersWithSingleCompiledHeader(baseHeaders, compiledHeader) {
    let lastRelevantIndex = -1;

    for (let index = 0; index < baseHeaders.length; index += 1) {
      if (
        normalizeRequestHeaderName(baseHeaders[index]) ===
        compiledHeader.normalizedName
      ) {
        lastRelevantIndex = index;
      }
    }

    if (lastRelevantIndex === -1) {
      return baseHeaders.slice().concat(copyCompiledHeader(compiledHeader));
    }

    const merged = [];
    for (let index = 0; index < baseHeaders.length; index += 1) {
      const header = baseHeaders[index];
      if (
        normalizeRequestHeaderName(header) !== compiledHeader.normalizedName
      ) {
        merged.push(header);
        continue;
      }

      if (index !== lastRelevantIndex) {
        continue;
      }

      merged.push({
        ...header,
        name: compiledHeader.name,
        value: compiledHeader.value,
      });
    }

    return merged;
  }

  function getSmallCompiledHeaderIndex(compiledHeaders, normalizedName) {
    if (!normalizedName) {
      return -1;
    }

    for (let index = 0; index < compiledHeaders.length; index += 1) {
      if (compiledHeaders[index].normalizedName === normalizedName) {
        return index;
      }
    }

    return -1;
  }

  function mergeRequestHeadersWithSmallCompiledHeaders(baseHeaders, compiledHeaders) {
    const lastRelevantIndices = new Array(compiledHeaders.length).fill(-1);
    let hasAnyRelevantHeaders = false;

    for (let index = 0; index < baseHeaders.length; index += 1) {
      const compiledHeaderIndex = getSmallCompiledHeaderIndex(
        compiledHeaders,
        normalizeRequestHeaderName(baseHeaders[index]),
      );

      if (compiledHeaderIndex === -1) {
        continue;
      }

      lastRelevantIndices[compiledHeaderIndex] = index;
      hasAnyRelevantHeaders = true;
    }

    if (!hasAnyRelevantHeaders) {
      return baseHeaders.slice().concat(copyCompiledHeaders(compiledHeaders));
    }

    const merged = [];
    for (let index = 0; index < baseHeaders.length; index += 1) {
      const header = baseHeaders[index];
      const compiledHeaderIndex = getSmallCompiledHeaderIndex(
        compiledHeaders,
        normalizeRequestHeaderName(header),
      );

      if (compiledHeaderIndex === -1) {
        merged.push(header);
        continue;
      }

      if (lastRelevantIndices[compiledHeaderIndex] !== index) {
        continue;
      }

      const overrideHeader = compiledHeaders[compiledHeaderIndex];
      merged.push({
        ...header,
        name: overrideHeader.name,
        value: overrideHeader.value,
      });
    }

    for (let index = 0; index < compiledHeaders.length; index += 1) {
      if (lastRelevantIndices[index] !== -1) {
        continue;
      }

      merged.push(copyCompiledHeader(compiledHeaders[index]));
    }

    return merged;
  }

  function mergeRequestHeadersWithCompiledPlan(requestHeaders, compiledPlan) {
    if (!compiledPlan || !compiledPlan.headers.length) {
      return Array.isArray(requestHeaders) ? requestHeaders.slice() : [];
    }

    const baseHeaders = Array.isArray(requestHeaders) ? requestHeaders : [];
    if (!baseHeaders.length) {
      return copyCompiledHeaders(compiledPlan.compiledHeaders || compiledPlan.headers);
    }

    if (compiledPlan.singleHeader) {
      return mergeRequestHeadersWithSingleCompiledHeader(
        baseHeaders,
        compiledPlan.singleHeader,
      );
    }

    if (compiledPlan.smallCompiledHeaders) {
      return mergeRequestHeadersWithSmallCompiledHeaders(
        baseHeaders,
        compiledPlan.smallCompiledHeaders,
      );
    }

    const lastRelevantIndexByName = new Map();
    for (let index = 0; index < baseHeaders.length; index += 1) {
      const header = baseHeaders[index];
      const normalizedName = normalizeRequestHeaderName(header);
      if (normalizedName && compiledPlan.headerNameSet.has(normalizedName)) {
        lastRelevantIndexByName.set(normalizedName, index);
      }
    }

    if (!lastRelevantIndexByName.size) {
      return baseHeaders
        .slice()
        .concat(copyCompiledHeaders(compiledPlan.compiledHeaders || compiledPlan.headers));
    }

    const merged = [];
    for (let index = 0; index < baseHeaders.length; index += 1) {
      const header = baseHeaders[index];
      const normalizedName = normalizeRequestHeaderName(header);

      if (!normalizedName || !compiledPlan.headerNameSet.has(normalizedName)) {
        merged.push(header);
        continue;
      }

      if (lastRelevantIndexByName.get(normalizedName) !== index) {
        continue;
      }

      const overrideHeader =
        compiledPlan.headerByNormalizedName.get(normalizedName);
      merged.push({
        ...header,
        name: overrideHeader.name,
        value: overrideHeader.value,
      });
    }

    const compiledHeaders = compiledPlan.compiledHeaders || compiledPlan.headers;
    compiledHeaders.forEach((header) => {
      if (lastRelevantIndexByName.has(header.normalizedName)) {
        return;
      }

      merged.push(copyCompiledHeader(header));
    });
    return merged;
  }

  function mergeRequestHeaders(requestHeaders, overrideHeaders) {
    return mergeRequestHeadersWithCompiledPlan(
      requestHeaders,
      compileHeaderPlan([], overrideHeaders, ""),
    );
  }

  function compileProxyPlan(proxy) {
    if (!isUsableProxy(proxy)) {
      return null;
    }

    const bypassMatcher = compileBypassMatcher(proxy.bypass);
    const authCredentials =
      supportsProxyAuth(proxy) && (proxy.username || proxy.password)
        ? {
            username: proxy.username || "",
            password: proxy.password || "",
          }
        : null;

    return {
      proxyId: proxy.id,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      requestInfo: asProxyRequestInfo(proxy),
      bypassMatcher,
      doNotProxyLocal: proxy.doNotProxyLocal,
      authCredentials,
      requiresRequestTarget: proxy.doNotProxyLocal || bypassMatcher.hasMatchers,
    };
  }

  function collectRelevantRuntimeContainerIds(normalizedConfig, containerLookup) {
    return new Set([
      FIREFOX_DEFAULT_CONTAINER,
      ...Object.keys(containerLookup || {}),
      ...Object.keys(
        normalizedConfig && normalizedConfig.containerSettings
          ? normalizedConfig.containerSettings
          : {},
      ),
    ]);
  }

  function collectRelevantRoutedContainerIds(normalizedConfig) {
    return new Set([
      FIREFOX_DEFAULT_CONTAINER,
      ...Object.keys(
        normalizedConfig && normalizedConfig.containerSettings
          ? normalizedConfig.containerSettings
          : {},
      ),
    ]);
  }

  function compileProxyRuntime(config, options) {
    const normalized =
      options && options.normalizedConfig ? options.normalizedConfig : normalizeConfig(config);
    const relevantContainerIds =
      options && options.relevantContainerIds
        ? options.relevantContainerIds
        : collectRelevantRoutedContainerIds(normalized);
    const compiledProxyPlanByProxyId = {};
    const proxyRuntime = {
      planByContainerId: {},
      invalidAssignmentByContainerId: {},
      proxiedContainerIds: [],
      blockedContainerIds: [],
      hasAnyAssignments: false,
      hasAnyInvalidAssignments: false,
      hasAnyAuthAssignments: false,
    };
    let hasAnyAuthProxyAssignments = false;

    relevantContainerIds.forEach((cookieStoreId) => {
      const assignment = resolveProxyAssignment(normalized, cookieStoreId);
      const proxy = assignment.proxy;

      if (assignment.status === "valid" && proxy) {
        if (!compiledProxyPlanByProxyId[proxy.id]) {
          compiledProxyPlanByProxyId[proxy.id] = compileProxyPlan(proxy);
        }

        const proxyPlan = compiledProxyPlanByProxyId[proxy.id];
        if (proxyPlan) {
          proxyRuntime.planByContainerId[cookieStoreId] = proxyPlan;
          proxyRuntime.proxiedContainerIds.push(cookieStoreId);

          if (proxyPlan.authCredentials) {
            hasAnyAuthProxyAssignments = true;
          }
        }
      } else if (assignment.status === "invalid-reference") {
        proxyRuntime.invalidAssignmentByContainerId[cookieStoreId] = {
          proxyId: assignment.proxyId,
          displayName: assignment.displayName,
          reason: assignment.reason,
        };
        proxyRuntime.blockedContainerIds.push(cookieStoreId);
      }
    });

    proxyRuntime.hasAnyAssignments = proxyRuntime.proxiedContainerIds.length > 0;
    proxyRuntime.hasAnyInvalidAssignments =
      proxyRuntime.blockedContainerIds.length > 0;
    proxyRuntime.hasAnyAuthAssignments = hasAnyAuthProxyAssignments;
    return proxyRuntime;
  }

  function compileHeaderRuntime(config, containers, options) {
    const normalized =
      options && options.normalizedConfig ? options.normalizedConfig : normalizeConfig(config);
    const containerLookup =
      options && options.containerLookup
        ? options.containerLookup
        : createContainerLookup(containers);
    const relevantContainerIds =
      options && options.relevantContainerIds
        ? options.relevantContainerIds
        : collectRelevantRuntimeContainerIds(normalized, containerLookup);
    const headerRuntime = {
      planByContainerId: {},
      hasAnyWork: false,
    };

    relevantContainerIds.forEach((cookieStoreId) => {
      const setting = getContainerSetting(normalized, cookieStoreId);
      let pwnFoxValue = "";

      if (
        setting.pwnFoxColorEnabled &&
        cookieStoreId !== FIREFOX_DEFAULT_CONTAINER &&
        containerLookup[cookieStoreId]
      ) {
        pwnFoxValue = getPwnFoxColorValue(containerLookup[cookieStoreId].color);
      }

      const headerPlan = compileHeaderPlan(
        normalized.globalHeaders,
        setting.headers,
        pwnFoxValue,
      );
      if (headerPlan) {
        headerRuntime.planByContainerId[cookieStoreId] = headerPlan;
      }
    });

    headerRuntime.hasAnyWork =
      Object.keys(headerRuntime.planByContainerId).length > 0;
    return headerRuntime;
  }

  function compileHostRuleRuntime(config, options) {
    const normalized =
      options && options.normalizedConfig ? options.normalizedConfig : normalizeConfig(config);
    const hostRuleRuntime = {
      orderedHostRulePlans: [],
      exactPlanIndexByHost: new Map(),
      suffixWildcardPatternTrieRoot: createWildcardPatternTrieNode(),
      fallbackWildcardPatternEntries: [],
      hasAnyRules: normalized.hostRules.length > 0,
      hasAnyEnabledRules: false,
    };

    normalized.hostRules.forEach((rule) => {
      if (!getHostRuleStatus(rule).isActivable) {
        return;
      }

      const plan = compileHostRulePlan(rule);
      if (!plan.compiledPatterns.length) {
        return;
      }

      const index = hostRuleRuntime.orderedHostRulePlans.length;
      hostRuleRuntime.orderedHostRulePlans.push(plan);
      plan.exactPatterns.forEach((pattern) => {
        if (!hostRuleRuntime.exactPlanIndexByHost.has(pattern)) {
          hostRuleRuntime.exactPlanIndexByHost.set(pattern, index);
        }
      });
      plan.wildcardPatterns.forEach((pattern) => {
        const entry = { plan, index, pattern };
        const requiredSuffix = getWildcardPatternRequiredSuffix(pattern);

        if (!requiredSuffix) {
          hostRuleRuntime.fallbackWildcardPatternEntries.push(entry);
          return;
        }

        addWildcardPatternEntryToSuffixTrie(
          hostRuleRuntime.suffixWildcardPatternTrieRoot,
          requiredSuffix,
          entry,
        );
      });
    });

    hostRuleRuntime.hasAnyEnabledRules =
      hostRuleRuntime.orderedHostRulePlans.length > 0;
    return hostRuleRuntime;
  }

  function compileShortcutRuntime(containers) {
    return {
      containerIdBySlot: getContainerSlots(containers).map(
        (slotEntry) => slotEntry.cookieStoreId,
      ),
    };
  }

  function compileRuntime(config, containers) {
    const normalized = normalizeConfig(config);
    const containerLookup = createContainerLookup(containers);
    const relevantContainerIds = collectRelevantRuntimeContainerIds(
      normalized,
      containerLookup,
    );
    const proxyRuntime = compileProxyRuntime(normalized, {
      normalizedConfig: normalized,
      relevantContainerIds: collectRelevantRoutedContainerIds(normalized),
    });
    const headerRuntime = compileHeaderRuntime(normalized, containers, {
      normalizedConfig: normalized,
      containerLookup,
      relevantContainerIds,
    });
    const hostRuleRuntime = compileHostRuleRuntime(normalized, {
      normalizedConfig: normalized,
    });
    const shortcutRuntime = compileShortcutRuntime(containers);

    return {
      proxyRuntime,
      headerRuntime,
      hostRuleRuntime,
      shortcutRuntime,
    };
  }

  function cleanupRemovedContainer(config, cookieStoreId) {
    const normalized = normalizeConfig(config);
    delete normalized.containerSettings[cookieStoreId];
    return normalizeConfig(normalized);
  }

  function cleanupRemovedProxy(config, proxyId) {
    const normalized = normalizeConfig(config);
    normalized.proxies = normalized.proxies.filter((proxy) => proxy.id !== proxyId);

    Object.keys(normalized.containerSettings).forEach((cookieStoreId) => {
      if (normalized.containerSettings[cookieStoreId].proxyId === proxyId) {
        normalized.containerSettings[cookieStoreId] = {
          ...normalized.containerSettings[cookieStoreId],
          proxyId: "",
        };
      }
    });

    return normalizeConfig(normalized);
  }

  function getDependentContainerNames(config, containers, proxyId) {
    if (!proxyId) {
      return [];
    }

    const normalized = normalizeConfig(config);
    return getContainerSlots(containers)
      .filter(
        (slotEntry) =>
          getAssignedProxyId(normalized, slotEntry.cookieStoreId) === proxyId,
      )
      .map((slotEntry) => slotEntry.name);
  }

  function getDependentHostRuleNames(config, cookieStoreId) {
    if (!cookieStoreId) {
      return [];
    }

    const normalized = normalizeConfig(config);
    return normalized.hostRules
      .filter((rule) => rule.exceptions.includes(cookieStoreId))
      .map((rule, index) => rule.name || `Host Rule ${index + 1}`);
  }

  function getHostRuleMissingContainerRefs(config, containers) {
    const normalized = normalizeConfig(config);
    const knownContainerIds = new Set(
      getContainerSlots(containers).map((slotEntry) => slotEntry.cookieStoreId),
    );

    return normalized.hostRules
      .map((rule, index) => {
        const missingCookieStoreIds = rule.exceptions.filter(
          (cookieStoreId) => !knownContainerIds.has(cookieStoreId),
        );

        if (!missingCookieStoreIds.length) {
          return null;
        }

        return {
          ruleId: rule.id,
          ruleName: rule.name || `Host Rule ${index + 1}`,
          missingCookieStoreIds,
        };
      })
      .filter(Boolean);
  }

  function getHostRuleAmbiguousContainerRefs(config, containers) {
    const normalized = normalizeConfig(config);
    const ambiguousContainerIds = new Set(
      getDuplicateLiveContainerGroups(containers).flatMap((entry) =>
        entry.containers.map((container) => container.cookieStoreId),
      ),
    );

    return normalized.hostRules
      .map((rule, index) => {
        const ambiguousCookieStoreIds = rule.exceptions.filter((cookieStoreId) =>
          ambiguousContainerIds.has(cookieStoreId),
        );

        if (!ambiguousCookieStoreIds.length) {
          return null;
        }

        return {
          ruleId: rule.id,
          ruleName: rule.name || `Host Rule ${index + 1}`,
          ambiguousCookieStoreIds,
        };
      })
      .filter(Boolean);
  }

  function getContainerIntegrityReport(config, containers) {
    const duplicateNameGroups = getDuplicateLiveContainerGroups(containers);
    const ambiguousContainerIds = duplicateNameGroups.flatMap((entry) =>
      entry.containers.map((container) => container.cookieStoreId),
    );

    return {
      duplicateNameGroups,
      ambiguousContainerIds,
      missingHostRuleRefs: getHostRuleMissingContainerRefs(config, containers),
      ambiguousHostRuleRefs: getHostRuleAmbiguousContainerRefs(config, containers),
    };
  }

  function createConfigBundle(config, meta) {
    const normalizedConfig = normalizeConfig(config);
    const sourceMeta = isRecord(meta) ? meta : {};

    return {
      meta: {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        revision: Number.isInteger(sourceMeta.revision) && sourceMeta.revision >= 0
          ? sourceMeta.revision
          : 0,
        updatedAt: normalizeText(sourceMeta.updatedAt) || "",
        writer: normalizeText(sourceMeta.writer),
      },
      config: normalizedConfig,
    };
  }

  function isConfigBundle(value) {
    return Boolean(
      isRecord(value) && isRecord(value.meta) && isRecord(value.config),
    );
  }

  function createConfigError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function normalizeConfigBundle(value) {
    if (!isRecord(value)) {
      throw createConfigError(
        "CONFIG_INVALID",
        "The stored configuration is not a valid object.",
      );
    }

    const hasEnvelopeFields =
      Object.hasOwn(value, "meta") || Object.hasOwn(value, "config");
    if (hasEnvelopeFields && !isConfigBundle(value)) {
      throw createConfigError(
        "CONFIG_INVALID",
        "The stored configuration envelope is incomplete or invalid.",
      );
    }

    if (hasEnvelopeFields) {
      const schemaVersion = value.meta.schemaVersion;
      if (
        schemaVersion !== undefined &&
        (!Number.isInteger(schemaVersion) || schemaVersion < 0)
      ) {
        throw createConfigError(
          "CONFIG_INVALID",
          "The stored configuration has an invalid schema version.",
        );
      }
      if (schemaVersion > CONFIG_SCHEMA_VERSION) {
        throw createConfigError(
          "CONFIG_VERSION_UNSUPPORTED",
          `Configuration schema ${schemaVersion} is newer than supported schema ${CONFIG_SCHEMA_VERSION}.`,
        );
      }
      return createConfigBundle(value.config, value.meta);
    }

    return createConfigBundle(value, {});
  }

  const api = {
    BLOCKED_REOPEN_PREFIXES,
    CONFIG_KEY,
    CONFIG_SCHEMA_VERSION,
    DEFAULT_TELEMETRY_HOSTS: uniqueSortedHosts(DEFAULT_TELEMETRY_HOSTS, []),
    FIREFOX_DEFAULT_CONTAINER,
    FIREFOX_TO_PWNFOX_COLORS: { ...FIREFOX_TO_PWNFOX_COLORS },
    GO_ONE_TAB_LEFT_COMMAND,
    GO_ONE_TAB_RIGHT_COMMAND,
    HEADER_NAME_PATTERN,
    HOST_RULE_MODES: HOST_RULE_MODES.slice(),
    MOVE_TAB_LEFT_COMMAND,
    MOVE_TAB_RIGHT_COMMAND,
    OPEN_CONTAINER_SLOT_COMMAND_PREFIX,
    OPEN_CURRENT_CONTAINER_TAB_COMMAND,
    PROXY_TYPES,
    REOPEN_CONTAINER_SLOT_COMMAND_PREFIX,
    NETWORK_REQUEST_URL_PATTERNS: NETWORK_REQUEST_URL_PATTERNS.slice(),
    SHORTCUT_SLOT_COUNT,
    TOGGLE_TAB_PINNED_COMMAND,
    asProxyRequestInfo,
    cleanupRemovedContainer,
    cleanupRemovedProxy,
    clone,
    compileBypassMatcher,
    compileHeaderPlan,
    compileHeaderRuntime,
    compileHostPattern,
    compileHostRulePlan,
    compileHostRuleRuntime,
    compileProxyRuntime,
    compileRuntime,
    createConfigBundle,
    createDefaultConfig,
    createDefaultContainerSetting,
    createDefaultProxyBypass,
    createHeaderId,
    createHostRuleId,
    compileProxyPlan,
    compileShortcutRuntime,
    createProxyId,
    detectPossibleHostRuleOverlapIds,
    buildCookieQueryDetails,
    buildCookieRemovalDetails,
    buildRequestContext,
    ensureRequestTarget,
    getAssignedProxy,
    getAssignedProxyId,
    getContainerIdForSlot,
    getContainerIntegrityReport,
    getContainerSetting,
    getContainerSlot,
    getContainerSlots,
    getContainerTechnicalLabel,
    getDependentContainerNames,
    getDuplicateLiveContainerGroups,
    getDependentHostRuleNames,
    getEffectiveCookieStoreId,
    getEffectiveProxy,
    getFixedShortcutCommandDescription,
    getHostRuleStatus,
    getHostRuleDecision,
    getHostRuleDecisionForNormalizedHost,
    getHostRuleAmbiguousContainerRefs,
    getHostRuleMissingContainerRefs,
    getOpenContainerSlotCommandName,
    getActionableTabValidation,
    getTabPlacementValidation,
    getProxyById,
    getProxyBypass,
    getProxyDisplayName,
    getProxyTypeForDNSChoice,
    getProxyTypePolicy,
    getProxyStatus,
    getPwnFoxColorValue,
    getReopenContainerSlotCommandName,
    resolveProxyAssignment,
    getShortcutActivationIssue,
    getSlotNumberFromCommandName,
    headersToMultilineText,
    hostMatchesAnyNormalizedRule,
    hostMatchesAnyRule,
    hostMatchesCompiledNormalizedHost,
    hostMatchesNormalizedRule,
    hostMatchesRule,
    isActionableTabUrl,
    isConfigBundle,
    isExtensionTabUrl,
    isLoopbackHost,
    isLoopbackNormalizedHost,
    isRecord,
    isOpenContainerSlotCommand,
    isReopenContainerSlotCommand,
    isSocksProxyType,
    isSupportedPwnFoxColor,
    isUsableProxy,
    mergeRequestHeadersWithCompiledPlan,
    mergeRequestHeaders,
    normalizeConfig,
    normalizeConfigBundle,
    normalizeContainerIdentityName,
    normalizeContainerName,
    normalizeHeaderEntries,
    normalizeHeaderName,
    normalizeHostPattern,
    normalizeHostRuleCard,
    normalizeHostRuleEnabled,
    normalizeHostRuleExceptions,
    normalizeHostRuleMode,
    normalizeHostRuleName,
    normalizeHostRulePatterns,
    normalizeHostRules,
    normalizeHeaderValue,
    normalizeHostRule,
    normalizePort,
    normalizeProxy,
    normalizeProxyBypass,
    normalizeProxyHost,
    normalizeShortcutKey,
    normalizeProxyId,
    normalizeProxyTitleKey,
    normalizeProxyType,
    parseHostPatternLines,
    parseHeaderLines,
    parseRequestHost,
    parseRequestTarget,
    captureShortcutFromEventData,
    supportsProxyAuth,
    uniqueSortedHosts,
    validateConfig,
    validateHostPattern,
    validateHostRule,
    validateProxy,
    canReopenTabUrl,
    buildCookieRemovalUrl,
    getReopenableTabValidation,
  };

export default api;
