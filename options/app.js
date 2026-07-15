const Shared = globalThis.PrivacyContainersShared;

const FALLBACK_COLOR_CHOICES = [
  { color: "red", colorCode: "#d1242f" },
  { color: "orange", colorCode: "#f18f01" },
  { color: "yellow", colorCode: "#ffd60a" },
  { color: "green", colorCode: "#2da44e" },
  { color: "blue", colorCode: "#218bff" },
  { color: "pink", colorCode: "#d63384" },
  { color: "purple", colorCode: "#8250df" },
  { color: "turquoise", colorCode: "#1fb6aa" },
  { color: "toolbar", colorCode: "#8c959f" },
];

const ICON_SVG_BY_NAME = {
  fingerprint:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v1a1 1 0 0 0 2 0V9a4 4 0 0 1 8 0v1a1 1 0 0 0 2 0V9a6 6 0 0 0-6-6Zm0 4a2 2 0 0 0-2 2v2.5a7.5 7.5 0 0 1-3.1 6.1 1 1 0 1 0 1.2 1.6A9.5 9.5 0 0 0 12 11.5V9a2 2 0 0 0 0-2Zm4 6a1 1 0 0 0-1 1 9.2 9.2 0 0 1-2.2 6 1 1 0 1 0 1.5 1.3A11.2 11.2 0 0 0 17 14a1 1 0 0 0-1-1Zm-8.4.7a1 1 0 0 0-1 1 10.6 10.6 0 0 1-.8 2.7 1 1 0 0 0 1.8.8 12.6 12.6 0 0 0 1-3.2 1 1 0 0 0-1-1.3Z" fill="currentColor"/></svg>',
  briefcase:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a2 2 0 0 0-2 2v2H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2h-2V6a2 2 0 0 0-2-2H9Zm6 4H9V6h6v2Zm6 6H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4ZM13 15v1a1 1 0 0 1-2 0v-1h2Z" fill="currentColor"/></svg>',
  dollar:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3a1 1 0 1 0-2 0v1.1A4.5 4.5 0 0 0 11 13h2a2.5 2.5 0 1 1 0 5H8a1 1 0 1 0 0 2h3v1a1 1 0 1 0 2 0v-1.1A4.5 4.5 0 0 0 13 11h-2a2.5 2.5 0 1 1 0-5h5a1 1 0 1 0 0-2h-3V3Z" fill="currentColor"/></svg>',
  cart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a1 1 0 0 0 0 2h1.3l1.7 7.4A2 2 0 0 0 9 16h7a2 2 0 0 0 1.9-1.5L19.7 8H8.4l-.3-1.3A2 2 0 0 0 6.1 5H4Zm5 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="currentColor"/></svg>',
  circle:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>',
  gift:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5A2.5 2.5 0 0 0 7 10h4V5H7.5Zm9 0H13v5h4a2.5 2.5 0 1 0-.5-5ZM4 12v7a2 2 0 0 0 2 2h5v-9H4Zm9 9h5a2 2 0 0 0 2-2v-7h-7v9Z" fill="currentColor"/></svg>',
  vacation:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 14 8-5v3h5.5a2.5 2.5 0 0 0 2.2-1.3l2.3-4.2a1 1 0 1 0-1.8-1l-2.3 4H11V7L3 2v12Zm8 2H8l-2 4h2l1.2-2.2H11V22h2v-4.2h1.8L16 20h2l-2-4h-3Z" fill="currentColor"/></svg>',
  food:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3a1 1 0 0 0-1 1v6a3 3 0 0 0 2 2.8V21a1 1 0 1 0 2 0v-8.2A3 3 0 0 0 12 10V4a1 1 0 1 0-2 0v5H9V4a1 1 0 1 0-2 0v5H6V4a1 1 0 0 0-1-1Zm10 0a1 1 0 0 0-1 1v7h-1a1 1 0 1 0 0 2h1v8a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1Z" fill="currentColor"/></svg>',
  fruit:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4c.7-1 1.9-2 4-2a1 1 0 1 1 0 2c-1.5 0-2.1.6-2.5 1.2A7 7 0 1 1 13 4Zm-1 3a5 5 0 1 0 5 5 5 5 0 0 0-5-5Z" fill="currentColor"/></svg>',
  pet:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm10 0a2 2 0 1 0-2-2 2 2 0 0 0 2 2ZM9.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm5 0A1.5 1.5 0 1 0 14.5 5a1.5 1.5 0 0 0 0 3ZM12 20c3.5 0 6-1.7 6-4.1 0-1.4-.8-2.8-2.2-3.8a4.9 4.9 0 0 0-7.6 0C6.8 13.1 6 14.5 6 15.9 6 18.3 8.5 20 12 20Z" fill="currentColor"/></svg>',
  tree:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 6.5 10H10l-3 4H11l-2 3h2v5h2v-5h2l-2-3h4l-3-4h3.5L12 2Z" fill="currentColor"/></svg>',
  chill:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5a1 1 0 0 1 1 1v5H7V6a1 1 0 0 1 1-1Zm8 0a1 1 0 0 1 1 1v5h-2V6a1 1 0 0 1 1-1ZM5 13h14v2h-1v3a2 2 0 0 1-2 2h-1v-4H9v4H8a2 2 0 0 1-2-2v-3H5v-2Z" fill="currentColor"/></svg>',
  fence:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h2v3h2V3h2v3h2V3h2v3h2V3h2v18h-2v-5h-2v5h-2v-5h-2v5H9v-5H7v5H5V3Zm2 5v2h2V8H7Zm4 0v2h2V8h-2Zm4 0v2h2V8h-2Z" fill="currentColor"/></svg>',
  default:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 2a7 7 0 1 1-7 7 7 7 0 0 1 7-7Z" fill="currentColor"/></svg>',
};

const TRASH_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9Z" fill="currentColor"/></svg>';
const CLEAR_ICON_SVG =
  '<svg viewBox="0 0 640 640" aria-hidden="true"><path d="M576 192C576 156.7 547.3 128 512 128L205.3 128C188.3 128 172 134.7 160 146.7L9.4 297.4C3.4 303.4 0 311.5 0 320C0 328.5 3.4 336.6 9.4 342.6L160 493.3C172 505.3 188.3 512 205.3 512L512 512C547.3 512 576 483.3 576 448L576 192zM284.1 252.1C293.5 242.7 308.7 242.7 318 252.1L351.9 286L385.8 252.1C395.2 242.7 410.4 242.7 419.7 252.1C429 261.5 429.1 276.7 419.7 286L385.8 319.9L419.7 353.8C429.1 363.2 429.1 378.4 419.7 387.7C410.3 397 395.1 397.1 385.8 387.7L351.9 353.8L318 387.7C308.6 397.1 293.4 397.1 284.1 387.7C274.8 378.3 274.7 363.1 284.1 353.8L318 319.9L284.1 286C274.7 276.6 274.7 261.4 284.1 252.1z" fill="currentColor"/></svg>';
const KEYBOARD_ICON_SVG =
  '<svg viewBox="0 0 640 640" aria-hidden="true"><path d="M96 128C60.7 128 32 156.7 32 192L32 448C32 483.3 60.7 512 96 512L544 512C579.3 512 608 483.3 608 448L608 192C608 156.7 579.3 128 544 128L96 128zM112 192L144 192C152.8 192 160 199.2 160 208L160 240C160 248.8 152.8 256 144 256L112 256C103.2 256 96 248.8 96 240L96 208C96 199.2 103.2 192 112 192zM96 304C96 295.2 103.2 288 112 288L144 288C152.8 288 160 295.2 160 304L160 336C160 344.8 152.8 352 144 352L112 352C103.2 352 96 344.8 96 336L96 304zM208 192L240 192C248.8 192 256 199.2 256 208L256 240C256 248.8 248.8 256 240 256L208 256C199.2 256 192 248.8 192 240L192 208C192 199.2 199.2 192 208 192zM192 304C192 295.2 199.2 288 208 288L240 288C248.8 288 256 295.2 256 304L256 336C256 344.8 248.8 352 240 352L208 352C199.2 352 192 344.8 192 336L192 304zM208 384L432 384C440.8 384 448 391.2 448 400L448 432C448 440.8 440.8 448 432 448L208 448C199.2 448 192 440.8 192 432L192 400C192 391.2 199.2 384 208 384zM288 208C288 199.2 295.2 192 304 192L336 192C344.8 192 352 199.2 352 208L352 240C352 248.8 344.8 256 336 256L304 256C295.2 256 288 248.8 288 240L288 208zM304 288L336 288C344.8 288 352 295.2 352 304L352 336C352 344.8 344.8 352 336 352L304 352C295.2 352 288 344.8 288 336L288 304C288 295.2 295.2 288 304 288zM384 208C384 199.2 391.2 192 400 192L432 192C440.8 192 448 199.2 448 208L448 240C448 248.8 440.8 256 432 256L400 256C391.2 256 384 248.8 384 240L384 208zM400 288L432 288C440.8 288 448 295.2 448 304L448 336C448 344.8 440.8 352 432 352L400 352C391.2 352 384 344.8 384 336L384 304C384 295.2 391.2 288 400 288zM480 208C480 199.2 487.2 192 496 192L528 192C536.8 192 544 199.2 544 208L544 240C544 248.8 536.8 256 528 256L496 256C487.2 256 480 248.8 480 240L480 208zM496 288L528 288C536.8 288 544 295.2 544 304L544 336C544 344.8 536.8 352 528 352L496 352C487.2 352 480 344.8 480 336L480 304C480 295.2 487.2 288 496 288z" fill="currentColor"/></svg>';
const MOVE_UP_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 6 11h4v8h4v-8h4l-6-6Z" fill="currentColor"/></svg>';
const MOVE_DOWN_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 19 6-6h-4V5h-4v8H6l6 6Z" fill="currentColor"/></svg>';
const ADD_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>';
const EYE_OPEN_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.2 0 9.3 3.7 10.8 6.5.2.3.2.7 0 1C21.3 15.3 17.2 19 12 19S2.7 15.3 1.2 12.5a1 1 0 0 1 0-1C2.7 8.7 6.8 5 12 5Zm0 2C8.1 7 4.8 9.6 3.3 12 4.8 14.4 8.1 17 12 17s7.2-2.6 8.7-5C19.2 9.6 15.9 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" fill="currentColor"/></svg>';
const EYE_CLOSED_ICON_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.3 2 18.7 18.7-1.4 1.4-3.1-3.1A12 12 0 0 1 12 19c-5.2 0-9.3-3.7-10.8-6.5a1 1 0 0 1 0-1 15 15 0 0 1 4.5-4.8L1.9 3.4 3.3 2Zm4 6.8A12.4 12.4 0 0 0 3.3 12C4.8 14.4 8.1 17 12 17c1.4 0 2.6-.3 3.8-.8l-2.2-2.2a4.5 4.5 0 0 1-5.6-5.6L7.3 8.8Zm4.2.2 3.5 3.5a2.5 2.5 0 0 0-3.5-3.5ZM12 5c5.2 0 9.3 3.7 10.8 6.5.2.3.2.7 0 1a15 15 0 0 1-3.8 4.3l-1.5-1.5c1.4-.9 2.5-2.1 3.2-3.3C19.2 9.6 15.9 7 12 7c-1 0-2 .2-2.9.5L7.4 5.8A11 11 0 0 1 12 5Z" fill="currentColor"/></svg>';

function createIcon(svgMarkup) {
  const iconDocument = new DOMParser().parseFromString(svgMarkup, "text/html");
  const icon = iconDocument.body.firstElementChild;
  if (
    !icon ||
    icon.localName !== "svg" ||
    icon.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    throw new Error("Invalid SVG icon markup");
  }
  return document.importNode(icon, true);
}

function setIcon(target, svgMarkup) {
  target.replaceChildren(createIcon(svgMarkup));
}
const HEADER_TEXTAREA_PLACEHOLDER = "X-Example: value\nX-Trace-Id: 12345";
const HOST_RULE_PATTERNS_PLACEHOLDER =
  "example.com\n*.corp.internal\ndev-*.tesla.com";
const STICKY_HEADER_SCROLL_GAP = 12;
const CONFIG_RELOAD_MESSAGE =
  "Configuration changed elsewhere. Click Refresh to reload it here.";
const CONFIG_RELOAD_CONFIRMATION =
  "Reload the latest configuration and discard local unsaved changes on this page?";
const FIREFOX_EXTERNAL_LINK_CONTAINER_PREF =
  "browser.link.force_default_user_context_id_for_external_opens";
const TAB_DEFINITIONS = Object.freeze([
  { id: "containers", title: "Containers" },
  { id: "proxies", title: "Proxies" },
  { id: "host-rules", title: "Host Rules" },
]);
const CARD_COLLECTIONS = Object.freeze({
  containers: Object.freeze({
    selector: ".container-card[data-cookie-store-id]",
    datasetKey: "cookieStoreId",
  }),
  proxies: Object.freeze({
    selector: ".proxy-card[data-proxy-id]",
    datasetKey: "proxyId",
  }),
  hostRules: Object.freeze({
    selector: ".host-rule-card[data-host-rule-id]",
    datasetKey: "hostRuleId",
  }),
});

function createWriterId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const state = {
  colorChoices: [],
  commands: [],
  config: Shared.createDefaultConfig(),
  containers: [],
  iconChoices: [],
  openContainerIdentityPopoverAnchorRect: null,
  openContainerIdentityPopoverCookieStoreId: "",
  openContainerIdentityPopoverPlacement: null,
  pendingInteractions: {
    containers: { reorder: null, scrollAnchor: null, insert: null },
    proxies: { reorder: null, scrollAnchor: null, insert: null },
    hostRules: { reorder: null, scrollAnchor: null, insert: null },
  },
  pendingIdentitySaves: new Map(),
  pendingSaveMessage: "Saved.",
  persistedConfig: Shared.createDefaultConfig(),
  persistedMeta: Shared.createConfigBundle(Shared.createDefaultConfig(), {}).meta,
  saveBlockedReason: "",
  draftVersion: 0,
  dirty: false,
  suppressSaveStatus: false,
  suppressCommandChangeEvents: 0,
  saveInFlight: false,
  savePromise: Promise.resolve(),
  saveTimer: 0,
  writerId: createWriterId("options"),
  pendingFocusRestore: null,
  dismissedStatusSignature: "",
  lastStatusSignature: "",
  statusIsError: false,
};

let containerIdentityPopoverFrame = 0;
let stickyHeaderMeasureFrame = 0;
let inputMeasureContext = null;
const CARD_TITLE_MIN_WIDTH = 112;
const CONTAINER_PROXY_PREFIX_LABEL = "Proxy";

function getOptionsAppRoot() {
  return document.getElementById("app");
}

function ensureTabLayoutRoot() {
  const app = getOptionsAppRoot();
  if (!app) {
    return null;
  }

  let layout = app.querySelector(":scope > .tab-layout");
  if (!layout) {
    layout = document.createElement("div");
    layout.className = "tab-layout";
    app.appendChild(layout);
  }

  return layout;
}

function captureActiveFieldFocus() {
  const active = document.activeElement;
  if (
    !active ||
    !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
  ) {
    state.pendingFocusRestore = null;
    return;
  }

  const focusId = active.dataset.focusId;
  if (!focusId) {
    state.pendingFocusRestore = null;
    return;
  }

  state.pendingFocusRestore = {
    focusId,
    selectionStart:
      typeof active.selectionStart === "number" ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function restorePendingFieldFocus() {
  const pending = state.pendingFocusRestore;
  state.pendingFocusRestore = null;

  if (!pending) {
    return null;
  }

  const target = document.querySelector(
    `[data-focus-id="${CSS.escape(pending.focusId)}"]`,
  );

  if (
    !target ||
    !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
  ) {
    return null;
  }

  target.focus({ preventScroll: true });

  if (
    typeof pending.selectionStart === "number" &&
    typeof pending.selectionEnd === "number"
  ) {
    target.setSelectionRange(pending.selectionStart, pending.selectionEnd);
  }

  return target;
}

function formatActiveCountLabel(count) {
  return `${count} active`;
}

function buildTabSummaries(config, containers) {
  const normalizedConfig = Shared.normalizeConfig(config);
  const visibleContainers = Array.isArray(containers) ? containers : [];
  const containerCount = Shared.getContainerSlots(visibleContainers).length;

  let proxyActiveCount = 0;
  let proxyDraftCount = 0;
  normalizedConfig.proxies.forEach((proxy) => {
    const status = Shared.getProxyStatus(proxy);
    if (status.isActivable) {
      proxyActiveCount += 1;
      return;
    }

    if (status.status === "incomplete") {
      proxyDraftCount += 1;
    }
  });

  let hostRuleActiveCount = 0;
  let hostRuleDraftCount = 0;
  normalizedConfig.hostRules.forEach((rule) => {
    const status = Shared.getHostRuleStatus(rule);
    if (status.isActivable) {
      hostRuleActiveCount += 1;
      return;
    }

    if (status.status === "incomplete") {
      hostRuleDraftCount += 1;
    }
  });

  const countsByTabId = {
    containers: {
      activeCount: containerCount,
      draftCount: 0,
    },
    proxies: {
      activeCount: proxyActiveCount,
      draftCount: proxyDraftCount,
    },
    "host-rules": {
      activeCount: hostRuleActiveCount,
      draftCount: hostRuleDraftCount,
    },
  };

  return TAB_DEFINITIONS.map((tab) => ({
    id: tab.id,
    title: tab.title,
    activeCount: countsByTabId[tab.id].activeCount,
    draftCount: countsByTabId[tab.id].draftCount,
    activeLabel: formatActiveCountLabel(countsByTabId[tab.id].activeCount),
  }));
}

function getTabSummaries() {
  return buildTabSummaries(state.config, state.containers);
}

function shouldShowExternalContainerGuessWarning(config, containers) {
  const normalizedConfig = Shared.normalizeConfig(config);
  const liveContainerIds = new Set(
    (Array.isArray(containers) ? containers : [])
      .map((container) => container && container.cookieStoreId)
      .filter(Boolean),
  );

  return normalizedConfig.hostRules.some((rule) => {
    if (!Shared.getHostRuleStatus(rule).isActivable) {
      return false;
    }

    const exceptionIds = new Set(rule.exceptions);
    const isDefaultBlocked =
      rule.mode === "blacklist"
        ? !exceptionIds.has(Shared.FIREFOX_DEFAULT_CONTAINER)
        : exceptionIds.has(Shared.FIREFOX_DEFAULT_CONTAINER);
    if (!isDefaultBlocked) {
      return false;
    }

    const allowedLiveContainerCount = Array.from(liveContainerIds).filter(
      (cookieStoreId) =>
        (rule.mode === "blacklist") === exceptionIds.has(cookieStoreId),
    ).length;
    return allowedLiveContainerCount >= 2;
  });
}

function getStickyHeaderElement() {
  return document.getElementById("sticky-header");
}

function syncStickyHeaderMetrics() {
  stickyHeaderMeasureFrame = 0;
  const header = getStickyHeaderElement();
  const headerRect = header ? header.getBoundingClientRect() : null;
  const headerOffset = headerRect
    ? Math.ceil(
        headerRect.height +
          (parseFloat(window.getComputedStyle(header).top || "0") || 0) +
          STICKY_HEADER_SCROLL_GAP,
      )
    : STICKY_HEADER_SCROLL_GAP;
  const statusTop = headerRect
    ? Math.ceil(headerRect.bottom + STICKY_HEADER_SCROLL_GAP)
    : STICKY_HEADER_SCROLL_GAP;
  document.documentElement.style.setProperty(
    "--sticky-header-offset",
    `${headerOffset}px`,
  );
  document.documentElement.style.setProperty(
    "--status-shell-top",
    `${statusTop}px`,
  );
}

function scheduleStickyHeaderMetrics() {
  if (stickyHeaderMeasureFrame) {
    return;
  }

  stickyHeaderMeasureFrame = window.requestAnimationFrame(() => {
    syncStickyHeaderMetrics();
  });
}

function revealElementBelowStickyHeader(target, behavior = "smooth") {
  if (!target) {
    return false;
  }

  const header = getStickyHeaderElement();
  const stickyBottom = header
    ? header.getBoundingClientRect().bottom
    : 0;
  const targetRect = target.getBoundingClientRect();
  const minimumTop = stickyBottom + STICKY_HEADER_SCROLL_GAP;
  const maximumBottom = window.innerHeight - STICKY_HEADER_SCROLL_GAP;
  const alreadyVisible =
    targetRect.top >= minimumTop && targetRect.bottom <= maximumBottom;

  if (alreadyVisible) {
    return false;
  }

  const nextScrollTop = Math.max(
    0,
    window.scrollY + targetRect.top - minimumTop,
  );
  window.scrollTo({
    top: nextScrollTop,
    behavior,
  });
  return true;
}

function keepElementClearOfStickyHeader(target) {
  if (!target) {
    return;
  }

  const header = getStickyHeaderElement();
  if (!header) {
    return;
  }

  const minimumTop = header.getBoundingClientRect().bottom + STICKY_HEADER_SCROLL_GAP;
  const rect = target.getBoundingClientRect();
  if (rect.top >= minimumTop) {
    return;
  }

  window.scrollBy(0, rect.top - minimumTop);
}

function getStatusSignature(message, isError, hasAction) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return "";
  }

  return `${isError ? "error" : "ok"}:${hasAction ? "action" : "plain"}:${text}`;
}

function setStatus(message, isError) {
  const status = document.getElementById("status");
  const nextMessage = message || "";
  const hasAction = Boolean(state.saveBlockedReason);
  state.statusIsError = Boolean(nextMessage) && Boolean(isError);
  const signature = getStatusSignature(
    nextMessage,
    state.statusIsError,
    hasAction,
  );

  if (!signature) {
    state.lastStatusSignature = "";
    state.dismissedStatusSignature = "";
  } else if (signature !== state.lastStatusSignature) {
    state.lastStatusSignature = signature;
    state.dismissedStatusSignature = "";
  } else {
    state.lastStatusSignature = signature;
  }

  status.textContent = nextMessage;
  status.className = state.statusIsError ? "error" : nextMessage ? "ok" : "";
  syncStatusShell();
}

function clearStatus() {
  if (state.saveBlockedReason) {
    setStatus(state.saveBlockedReason, true);
    return;
  }

  setStatus("", false);
}

function syncStatusShell() {
  const shell = document.getElementById("status-shell");
  const actions = document.getElementById("status-actions");
  const status = document.getElementById("status");
  const refreshButton = document.getElementById("refresh-config");
  const dismissButton = document.getElementById("dismiss-status");
  if (!shell || !actions || !status || !refreshButton || !dismissButton) {
    return;
  }

  const hasAction = Boolean(state.saveBlockedReason);
  const hasMessage = Boolean(status.textContent);
  const signature = getStatusSignature(
    status.textContent,
    state.statusIsError,
    hasAction,
  );
  const isDismissed =
    Boolean(signature) && signature === state.dismissedStatusSignature;
  const isVisible = Boolean(signature) && !isDismissed;

  shell.classList.toggle("visible", isVisible);
  shell.classList.toggle("has-action", hasAction);
  shell.hidden = !isVisible;
  actions.hidden = !hasAction;
  refreshButton.hidden = !hasAction;
  refreshButton.disabled = state.saveInFlight;
  dismissButton.hidden = !hasMessage;
  scheduleStickyHeaderMetrics();
}

function setConfigReloadBlockedStatus() {
  state.saveBlockedReason = CONFIG_RELOAD_MESSAGE;
  setStatus(state.saveBlockedReason, true);
}

function createHelp(text) {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "help-button";
  help.textContent = "?";
  help.title = text;
  help.setAttribute("aria-label", text);
  help.onclick = (event) => {
    event.preventDefault();
  };
  return help;
}

function createField(labelText, control, helpText, options = {}) {
  const { layout = "stacked", compact = false } = options;
  const wrapper = document.createElement("div");
  wrapper.className = "form-field field";
  if (layout === "inline") {
    wrapper.classList.add("is-inline");
  }
  if (compact) {
    wrapper.classList.add("is-compact");
  }

  const top = document.createElement("span");
  top.className = "field-label";

  const title = document.createElement("span");
  title.textContent = labelText;
  top.appendChild(title);

  if (helpText) {
    top.appendChild(createHelp(helpText));
  }

  wrapper.appendChild(top);
  wrapper.appendChild(control);
  return wrapper;
}

function createButton(label, handler, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.onclick = async () => {
    clearStatus();

    try {
      await handler();
    } catch (error) {
      setStatus(error.message, true);
    }
  };
  return button;
}

function createIconButton(title, svgMarkup, handler, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "icon-button";
  button.classList.add("card-top-actionable");
  button.title = title;
  button.setAttribute("aria-label", title);
  setIcon(button, svgMarkup);
  button.onclick = async (event) => {
    clearStatus();

    try {
      await handler(event);
    } catch (error) {
      setStatus(error.message, true);
    }
  };
  return button;
}

function createCardHeaderMain(className) {
  const main = document.createElement("div");
  main.className = className ? `card-header-main ${className}` : "card-header-main";
  return main;
}

function createCardHeaderTitleRow() {
  const row = document.createElement("div");
  row.className = "card-header-title-row";
  return row;
}

function createCardHeaderActions() {
  const actions = document.createElement("div");
  actions.className = "card-header-actions";
  return actions;
}

function createCardTopInfo(options) {
  const info = document.createElement("div");
  info.className = "card-top-info";

  if (options && options.tone) {
    info.classList.add(`is-${options.tone}`);
  }

  const message = document.createElement("p");
  message.className = "card-top-info-message";

  if (options && options.wrap === false) {
    message.classList.add("is-nowrap");
  } else {
    message.classList.add("is-wrap");
  }

  info.appendChild(message);
  return {
    root: info,
    message,
  };
}

function createCardTitleInput(value, placeholder, options) {
  const input = createInput(value, placeholder);
  input.className = "card-title-input card-top-actionable";

  if (options && options.fill) {
    input.classList.add("card-title-input-fill");
  }

  if (options && options.persistentActive) {
    input.classList.add("card-top-persistent-active");
  }

  if (options && options.focusId) {
    input.dataset.focusId = options.focusId;
  }

  if (options && options.autoWidthMin) {
    input.dataset.cardTitleAutoWidthMin = String(options.autoWidthMin);
  }

  if (options && options.disabled) {
    input.disabled = true;
  }

  return input;
}

function syncCardTitleInputWidth(input, fallbackText) {
  if (!input) {
    return;
  }

  const minimumWidth = Number(input.dataset.cardTitleAutoWidthMin || "0");
  if (!minimumWidth) {
    return;
  }

  syncAutoWidthTextInput(input, fallbackText, minimumWidth);
}

function createPasswordField(value, placeholder) {
  const input = createInput(value, placeholder, "password");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "password-toggle-button";
  toggle.setAttribute("aria-label", "Show password");
  toggle.title = "Show password";
  setIcon(toggle, EYE_OPEN_ICON_SVG);

  const sync = () => {
    const isVisible = input.type === "text";
    setIcon(toggle, isVisible ? EYE_CLOSED_ICON_SVG : EYE_OPEN_ICON_SVG);
    toggle.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
    toggle.title = isVisible ? "Hide password" : "Show password";
  };

  toggle.onclick = () => {
    if (toggle.disabled) {
      return;
    }

    input.type = input.type === "password" ? "text" : "password";
    sync();
  };

  const wrapper = document.createElement("div");
  wrapper.className = "password-input-wrap";
  wrapper.appendChild(input);
  wrapper.appendChild(toggle);
  sync();

  return {
    input,
    root: wrapper,
    resetVisibility: () => {
      input.type = "password";
      sync();
    },
    setDisabled: (disabled) => {
      toggle.disabled = disabled;
      if (disabled) {
        input.type = "password";
      }
      sync();
    },
  };
}

function createPanel(title, subtitle) {
  const panel = document.createElement("section");
  panel.className = "panel";

  const heading = document.createElement("h2");
  heading.textContent = title;
  panel.appendChild(heading);

  if (subtitle) {
    const description = document.createElement("p");
    description.className = "panel-subtitle";
    description.textContent = subtitle;
    panel.appendChild(description);
  }

  return panel;
}

function createInput(value, placeholder, type) {
  const input = document.createElement("input");
  input.type = type || "text";
  input.value = value || "";
  if (placeholder) {
    input.placeholder = placeholder;
  }
  return input;
}

function createTextarea(value, rows) {
  const textarea = document.createElement("textarea");
  textarea.className = "textarea-field-control";
  textarea.value = value || "";
  if (rows) {
    textarea.rows = rows;
  }
  return textarea;
}

function syncAutoWidthTextInput(input, fallbackText, minimumWidth = 136) {
  if (!input) {
    return;
  }

  if (!inputMeasureContext) {
    inputMeasureContext = document.createElement("canvas").getContext("2d");
  }

  if (!inputMeasureContext) {
    input.style.width = `${minimumWidth}px`;
    return;
  }

  const computed = window.getComputedStyle(input);
  inputMeasureContext.font = computed.font;
  const text = input.value || fallbackText || input.placeholder || "";
  const metricsWidth = inputMeasureContext.measureText(text).width;
  const paddingLeft = parseFloat(computed.paddingLeft || "0") || 0;
  const paddingRight = parseFloat(computed.paddingRight || "0") || 0;
  const borderLeft = parseFloat(computed.borderLeftWidth || "0") || 0;
  const borderRight = parseFloat(computed.borderRightWidth || "0") || 0;
  const nextWidth = Math.ceil(
    Math.max(
      minimumWidth,
      metricsWidth + paddingLeft + paddingRight + borderLeft + borderRight + 8,
    ),
  );

  input.style.width = `${nextWidth}px`;
}

function createCheckbox(checked) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  return input;
}

function createSelect(options, selectedValue) {
  const select = document.createElement("select");

  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.selected = optionData.value === selectedValue;
    select.appendChild(option);
  });

  return select;
}

function getProxyTypeLabel(type) {
  switch (type) {
    case "http":
      return "HTTP";
    case "https":
      return "HTTPS";
    case "socks":
      return "SOCKS5";
    case "socks4":
      return "SOCKS4";
    default:
      return "Proxy";
  }
}

function getProxyEndpointLabel(proxy) {
  if (!proxy) {
    return "";
  }

  const protocol = proxy.type === "socks" ? "socks5" : proxy.type;
  return `${protocol}://${proxy.host}:${proxy.port}`;
}

function createProxyPickerEntry(proxy) {
  const proxyStatus = Shared.getProxyStatus(proxy);
  const endpoint = getProxyEndpointLabel(proxy);
  const fallbackTitle = proxyStatus.isActivable
    ? endpoint
    : proxy.title || `${getProxyTypeLabel(proxy.type)} draft`;

  return {
    proxyId: proxy.id,
    title: proxy.title || fallbackTitle,
    detail: proxyStatus.isActivable
      ? proxy.title
        ? endpoint
        : `${getProxyTypeLabel(proxy.type)} proxy`
      : proxyStatus.reason,
    kind: proxyStatus.isActivable ? "proxy" : "draft",
    selectable: proxyStatus.isActivable,
    searchText: [
      proxy.title,
      proxy.type,
      proxy.host,
      String(proxy.port || ""),
      endpoint,
      Shared.getProxyDisplayName(proxy),
      proxyStatus.reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function getProxyPickerEntries(selectedProxyId) {
  const entries = [
    {
      proxyId: "",
      title: "No proxy",
      detail: "Direct connection. Requests stay untouched.",
      kind: "direct",
      selectable: true,
      searchText: "no proxy direct none off disabled bypass",
    },
    ...state.config.proxies.map((proxy) => createProxyPickerEntry(proxy)),
  ];

  if (
    selectedProxyId &&
    !state.config.proxies.some((proxy) => proxy.id === selectedProxyId)
  ) {
    entries.push({
      proxyId: selectedProxyId,
      title: "Missing proxy",
      detail: `Saved reference "${selectedProxyId}" no longer exists. Requests are blocked until fixed or removed.`,
      kind: "invalid",
      selectable: false,
      searchText: `missing proxy invalid ${selectedProxyId}`.toLowerCase(),
    });
  }

  return entries;
}

function shouldShowContainerProxyPrefix(entry) {
  return entry?.kind !== "direct";
}

function createContainerProxyEntryCopy(className) {
  const copy = document.createElement("span");
  copy.className = className;

  const mainRow = document.createElement("span");
  mainRow.className = "container-proxy-entry-main-row";
  copy.appendChild(mainRow);

  const prefix = document.createElement("span");
  prefix.className = "container-proxy-entry-prefix";
  prefix.textContent = CONTAINER_PROXY_PREFIX_LABEL;
  mainRow.appendChild(prefix);

  const title = document.createElement("span");
  title.className = "container-proxy-entry-title";
  mainRow.appendChild(title);

  const detail = document.createElement("span");
  detail.className = "container-proxy-entry-detail";
  copy.appendChild(detail);

  return {
    root: copy,
    prefix,
    title,
    detail,
  };
}

function syncContainerProxyEntryCopy(parts, entry) {
  const showPrefix = shouldShowContainerProxyPrefix(entry);
  parts.prefix.hidden = !showPrefix;
  parts.root.classList.toggle("has-prefix", showPrefix);
  parts.title.textContent = entry.title;
  parts.title.title = entry.title;
  parts.detail.textContent = entry.detail;
  parts.detail.title = entry.detail;
}

function syncContainerProxyTriggerState(trigger, entry) {
  trigger.classList.toggle("is-direct", entry.kind === "direct");
  trigger.classList.toggle("has-proxy", entry.kind === "proxy");
  trigger.classList.toggle("is-draft", entry.kind === "draft");
  trigger.classList.toggle("is-invalid", entry.kind === "invalid");
}

function syncContainerProxyOptionState(option, entry) {
  option.classList.toggle("is-direct-option", entry.kind === "direct");
  option.classList.toggle("is-draft-option", entry.kind === "draft");
  option.classList.toggle("is-invalid-option", entry.kind === "invalid");
  option.classList.toggle("is-unavailable-option", !entry.selectable);
}

function createContainerProxyPicker(selectedProxyId, onChange) {
  const picker = document.createElement("div");
  picker.className = "picker-shell container-proxy-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "container-proxy-trigger";
  trigger.setAttribute("aria-label", "Select proxy for this container");
  trigger.setAttribute("aria-haspopup", "listbox");
  picker.appendChild(trigger);

  const triggerCopy = createContainerProxyEntryCopy("container-proxy-trigger-copy");
  trigger.appendChild(triggerCopy.root);

  const triggerSide = document.createElement("span");
  triggerSide.className = "container-proxy-trigger-side";
  trigger.appendChild(triggerSide);

  const triggerIcon = document.createElement("span");
  triggerIcon.className = "container-proxy-trigger-icon";
  setIcon(triggerIcon, MOVE_DOWN_ICON_SVG);
  triggerSide.appendChild(triggerIcon);

  const panel = document.createElement("div");
  panel.className = "picker-popover";
  picker.appendChild(panel);

  const searchBar = document.createElement("div");
  searchBar.className = "picker-toolbar";
  panel.appendChild(searchBar);

  const searchInput = createInput("", "Search proxies...");
  searchInput.className = "picker-search-input";
  searchInput.autocomplete = "off";
  searchInput.spellcheck = false;
  searchInput.setAttribute("aria-label", "Search proxies");
  searchBar.appendChild(searchInput);

  const createProxyButton = createButton("Create new proxy", async () => {
    setOpen(false);
    try {
      await createProxyAndFocus({ activateTab: true });
    } catch (error) {
      setStatus(error.message, true);
    }
  });
  createProxyButton.classList.add("picker-create-button");
  searchBar.appendChild(createProxyButton);

  const optionList = document.createElement("div");
  const listboxId = `container-proxy-list-${selectedProxyId || "direct"}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  optionList.className = "picker-option-list";
  optionList.id = listboxId;
  optionList.setAttribute("role", "listbox");
  panel.appendChild(optionList);

  let currentProxyId = selectedProxyId || "";
  let activeProxyId = currentProxyId;
  let isOpen = false;
  let activeOptionNode = null;
  let visibleEntries = [];
  const optionByProxyId = new Map();

  function getCurrentEntry() {
    return (
      getProxyPickerEntries(currentProxyId).find(
        (item) => item.proxyId === currentProxyId,
      ) || getProxyPickerEntries(currentProxyId)[0]
    );
  }


  function handleDocumentPointerDown(event) {
    if (!picker.contains(event.target)) {
      setOpen(false);
    }
  }

  function getVisibleEntries() {
    const entries = getProxyPickerEntries(currentProxyId);
    const filterNeedle = searchInput.value.trim().toLowerCase();
    if (!filterNeedle) {
      return entries;
    }

    return entries.filter(
      (entry) =>
        entry.kind === "direct" ||
        entry.title.toLowerCase().includes(filterNeedle) ||
        entry.detail.toLowerCase().includes(filterNeedle) ||
        entry.searchText.includes(filterNeedle),
    );
  }

  function ensureActiveEntry(entries) {
    visibleEntries = entries;
    if (!entries.length) {
      activeProxyId = "";
      searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    if (!entries.some((entry) => entry.proxyId === activeProxyId)) {
      activeProxyId = entries.some((entry) => entry.proxyId === currentProxyId)
        ? currentProxyId
        : (entries.find((entry) => entry.selectable) || entries[0]).proxyId;
    }
  }

  function syncTrigger() {
    const entry = getCurrentEntry();
    syncContainerProxyTriggerState(trigger, entry);
    syncContainerProxyEntryCopy(triggerCopy, entry);
  }

  function syncActiveOptionDom() {
    if (activeOptionNode) {
      activeOptionNode.classList.remove("is-active");
    }

    activeOptionNode = optionByProxyId.get(activeProxyId || "") || null;
    if (activeOptionNode) {
      activeOptionNode.classList.add("is-active");
      searchInput.setAttribute("aria-activedescendant", activeOptionNode.id);
    } else {
      searchInput.removeAttribute("aria-activedescendant");
    }
  }

  function renderOptions() {
    const entries = getVisibleEntries();
    ensureActiveEntry(entries);

    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    trigger.setAttribute("aria-controls", listboxId);
    optionList.textContent = "";
    optionByProxyId.clear();
    activeOptionNode = null;

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = "No matching proxies";
      optionList.appendChild(empty);
      searchInput.removeAttribute("aria-activedescendant");
      return;
    }

    entries.forEach((entry) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className =
        entry.proxyId === activeProxyId
          ? "container-proxy-option is-active"
          : "container-proxy-option";
      syncContainerProxyOptionState(option, entry);
      option.id = `${listboxId}-${entry.proxyId || "direct"}`;
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        entry.proxyId === currentProxyId ? "true" : "false",
      );
      option.setAttribute("aria-disabled", entry.selectable ? "false" : "true");
      option.disabled = !entry.selectable;

      const copy = createContainerProxyEntryCopy("container-proxy-option-copy");
      syncContainerProxyEntryCopy(copy, entry);
      option.appendChild(copy.root);

      const marker = document.createElement("span");
      marker.className = "container-proxy-option-marker";
      marker.textContent =
        entry.proxyId === currentProxyId
          ? entry.selectable
            ? "Selected"
            : "Blocking"
          : entry.selectable
            ? ""
            : "Unavailable";
      option.appendChild(marker);

      option.onmousedown = (event) => {
        event.preventDefault();
      };
      option.onmouseenter = () => {
        activeProxyId = entry.proxyId;
        syncActiveOptionDom();
      };
      option.onclick = () => {
        if (!entry.selectable) {
          return;
        }
        if (currentProxyId !== entry.proxyId) {
          currentProxyId = entry.proxyId;
          onChange(currentProxyId);
        }
        setOpen(false);
        syncTrigger();
        trigger.focus();
      };

      optionList.appendChild(option);
      optionByProxyId.set(entry.proxyId || "", option);
    });

    syncActiveOptionDom();
  }

  function setOpen(nextOpen, seedValue) {
    isOpen = Boolean(nextOpen);
    picker.classList.toggle("is-open", isOpen);
    if (isOpen) {
      window.addEventListener("pointerdown", handleDocumentPointerDown, true);
    } else {
      window.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    }
    if (!isOpen) {
      searchInput.value = "";
      activeProxyId = currentProxyId;
    } else if (typeof seedValue === "string") {
      searchInput.value = seedValue;
      activeProxyId = currentProxyId;
    }
    renderOptions();
  }

  function moveActiveProxy(step) {
    const entries = visibleEntries;
    if (!entries.length) {
      activeProxyId = "";
      syncActiveOptionDom();
      return;
    }

    const currentIndex = entries.findIndex((entry) => entry.proxyId === activeProxyId);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = (baseIndex + step + entries.length) % entries.length;
    activeProxyId = entries[nextIndex].proxyId;
    syncActiveOptionDom();
  }

  function selectActiveProxy() {
    const entries = visibleEntries;
    if (!entries.length) {
      return;
    }

    const entry =
      entries.find((item) => item.proxyId === activeProxyId) || entries[0];
    if (!entry.selectable) {
      return;
    }
    if (currentProxyId !== entry.proxyId) {
      currentProxyId = entry.proxyId;
      onChange(currentProxyId);
    }
    setOpen(false);
    syncTrigger();
    trigger.focus();
  }

  trigger.onclick = () => {
    setOpen(!isOpen);
    if (!isOpen) {
      searchInput.focus();
    }
  };

  trigger.onkeydown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (event.key === "ArrowUp") {
        moveActiveProxy(-1);
      }
      searchInput.focus();
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(!isOpen);
      if (!isOpen) {
        searchInput.focus();
      }
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setOpen(true, event.key);
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
  };

  searchInput.oninput = () => {
    activeProxyId = "";
    renderOptions();
  };

  searchInput.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveProxy(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveProxy(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      const entries = visibleEntries;
      if (entries.length) {
        activeProxyId = entries[0].proxyId;
        syncActiveOptionDom();
      }
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const entries = visibleEntries;
      if (entries.length) {
        activeProxyId = entries[entries.length - 1].proxyId;
        syncActiveOptionDom();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectActiveProxy();
    }
  };

  picker.onfocusout = () => {
    window.setTimeout(() => {
      if (!picker.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 0);
  };

  syncTrigger();
  renderOptions();
  return {
    root: picker,
    getValue: () => currentProxyId,
  };
}

function createNote(text, className) {
  const note = document.createElement("p");
  note.className = className || "muted";
  note.textContent = text;
  return note;
}

function createEmptyState(title, description) {
  const state = document.createElement("section");
  state.className = "empty-state";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const copy = document.createElement("p");
  copy.textContent = description;

  state.append(heading, copy);
  return state;
}

function createCardKindBadge(label) {
  const badge = document.createElement("span");
  badge.className = "identity-badge card-kind-badge";
  badge.textContent = label;
  return badge;
}

function createStatusBadge(label, tone) {
  const badge = document.createElement("span");
  badge.className = "identity-badge";
  if (tone === "draft") {
    badge.classList.add("draft-status-badge");
  } else if (tone === "invalid") {
    badge.classList.add("invalid-status-badge");
  }
  badge.textContent = label;
  return badge;
}

function createStatusNote(text, tone, hidden = true) {
  const note = createNote(text || "", "status-note");
  if (tone) {
    note.classList.add(`is-${tone}`);
  }
  note.hidden = hidden;
  return note;
}

function syncStatusNote(note, tone, text, hidden) {
  note.className = tone ? `status-note is-${tone}` : "status-note";
  note.textContent = text || "";
  note.hidden = Boolean(hidden);
}

function syncStatusBadgeSlot(slot, label, tone, isVisible) {
  slot.textContent = "";
  if (!isVisible) {
    return;
  }

  slot.appendChild(createStatusBadge(label, tone));
}

function normalizeVisibleContainerName(value) {
  return Shared.normalizeContainerIdentityName(value);
}

function findContainerNameConflict(name, excludedCookieStoreId) {
  const normalizedName = normalizeVisibleContainerName(name);
  if (!normalizedName) {
    return null;
  }

  return (
    Shared.getContainerSlots(state.containers).find((slotEntry) => {
      if (slotEntry.cookieStoreId === excludedCookieStoreId) {
        return false;
      }

      return normalizeVisibleContainerName(slotEntry.name) === normalizedName;
    }) || null
  );
}

function getCurrentLiveContainer(cookieStoreId) {
  return (
    state.containers.find((container) => container.cookieStoreId === cookieStoreId) ||
    null
  );
}

function canKeepContainerVisibleName(cookieStoreId, name) {
  const current = getCurrentLiveContainer(cookieStoreId);
  if (!current) {
    return false;
  }

  return (
    normalizeVisibleContainerName(current.name) ===
    normalizeVisibleContainerName(name)
  );
}

function setPendingFieldFocus(focusId, selectionStart, selectionEnd) {
  state.pendingFocusRestore = {
    focusId,
    selectionStart:
      typeof selectionStart === "number" ? selectionStart : null,
    selectionEnd: typeof selectionEnd === "number" ? selectionEnd : null,
  };
}

function queuePendingCardInsert(collection, itemId, focusId, titleValue) {
  state.pendingInteractions[collection].insert = itemId ? { itemId } : null;
  const selectionEnd = typeof titleValue === "string" ? titleValue.length : null;
  setPendingFieldFocus(focusId, 0, selectionEnd);
}

function createAvailableNumberedName(prefix, existingCount, hasConflict) {
  let nextNumber = existingCount + 1;

  while (hasConflict(`${prefix} ${nextNumber}`)) {
    nextNumber += 1;
  }

  return `${prefix} ${nextNumber}`;
}

function findHostRuleNameConflict(name, excludedRuleId) {
  const normalizedName = Shared.normalizeHostRuleName(name).toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return (
    state.config.hostRules.find((rule) => {
      if (rule.id === excludedRuleId) {
        return false;
      }

      return Shared.normalizeHostRuleName(rule.name).toLowerCase() === normalizedName;
    }) || null
  );
}

function getNextContainerGeneratedName() {
  return createAvailableNumberedName("Container", state.containers.length, (name) =>
    Boolean(findContainerNameConflict(name, "")),
  );
}

function getNextProxyGeneratedTitle() {
  return createAvailableNumberedName("Proxy", state.config.proxies.length, (title) =>
    Boolean(findProxyTitleConflict(title, "")),
  );
}

function getNextHostRuleGeneratedName() {
  return createAvailableNumberedName(
    "Host Rule",
    state.config.hostRules.length,
    (name) => Boolean(findHostRuleNameConflict(name, "")),
  );
}

function pickRandomPropertyValue(entries, key, fallbackValue) {
  if (!Array.isArray(entries) || !entries.length) {
    return fallbackValue;
  }

  const entry = entries[Math.floor(Math.random() * entries.length)];
  return entry && entry[key] ? entry[key] : fallbackValue;
}

function createContainerIntegrityAlert(title, subtitle, items) {
  const panel = createPanel(title, subtitle);
  panel.classList.add("integrity-alert-panel");

  const list = document.createElement("div");
  list.className = "integrity-alert-list";

  items.forEach((item) => {
    list.appendChild(createNote(item, "integrity-alert-item"));
  });

  panel.appendChild(list);
  return panel;
}

function syncFirefoxExternalLinkWarning() {
  const panel = document.getElementById("firefox-external-link-warning");
  if (!panel) {
    return;
  }

  panel.hidden = !shouldShowExternalContainerGuessWarning(
    state.config,
    state.containers,
  );
}

function createFirefoxExternalLinkWarning() {
  const panel = createPanel(
    "Firefox may preselect a container for external links",
    "This notice appears because an active Host Rule blocks Firefox Default while allowing multiple containers.",
  );
  panel.id = "firefox-external-link-warning";
  panel.classList.add("integrity-alert-panel");

  const content = document.createElement("div");
  content.className = "integrity-alert-list";

  const explanation = createNote(
    "Firefox has its own container-guessing behavior for links opened from another application. This is a Firefox choice: you can keep its automatic session reuse or prefer predictable Host Rule selection.",
    "integrity-alert-item",
  );

  const instructions = document.createElement("p");
  instructions.className = "integrity-alert-item";
  instructions.append(
    "For predictable Host Rules, open ",
  );
  const aboutConfig = document.createElement("code");
  aboutConfig.textContent = "about:config";
  instructions.append(
    aboutConfig,
    " manually, search for ",
  );

  const preferenceButton = document.createElement("button");
  preferenceButton.type = "button";
  preferenceButton.className = "subtle-button firefox-pref-copy-button";
  preferenceButton.title = "Copy preference name";
  preferenceButton.setAttribute("aria-label", `Copy ${FIREFOX_EXTERNAL_LINK_CONTAINER_PREF}`);
  const preferenceCode = document.createElement("code");
  preferenceCode.textContent = FIREFOX_EXTERNAL_LINK_CONTAINER_PREF;
  preferenceButton.appendChild(preferenceCode);
  preferenceButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(FIREFOX_EXTERNAL_LINK_CONTAINER_PREF);
      setStatus("Firefox preference name copied to the clipboard.", false);
    } catch (_) {
      setStatus("Could not copy the Firefox preference name.", true);
    }
  };
  instructions.append(preferenceButton, ", then choose the behavior you want:");

  const trueBehavior = document.createElement("p");
  trueBehavior.className = "integrity-alert-item";
  const trueValue = document.createElement("code");
  trueValue.textContent = "true";
  trueBehavior.append(
    trueValue,
    " — recommended for this configuration: ",
    "External links start in Firefox Default. Privacy Containers can then show its blocked page and let you choose among the allowed containers.",
  );

  const falseBehavior = document.createElement("p");
  falseBehavior.className = "integrity-alert-item";
  const falseValue = document.createElement("code");
  falseValue.textContent = "false";
  falseBehavior.append(
    falseValue,
    " — Firefox container guessing: ",
    "Firefox may reuse the container with the most open tabs for the same exact host. If that container is allowed, the Host Rule chooser is not shown.",
  );

  content.append(explanation, instructions, trueBehavior, falseBehavior);
  panel.appendChild(content);
  panel.hidden = !shouldShowExternalContainerGuessWarning(
    state.config,
    state.containers,
  );
  return panel;
}

function createContainerReferenceTag({
  name,
  cookieStoreId,
  color,
  icon,
  iconUrl,
  technicalLabel,
  ambiguous = false,
  missing = false,
  removable = false,
  removeLabel,
  onRemove,
  className,
}) {
  const tag = document.createElement("span");
  tag.className = missing ? "host-rule-tag missing" : "host-rule-tag";
  if (className) {
    tag.classList.add(className);
  }

  if (color) {
    tag.style.setProperty("--tag-accent", getColorCode(color));
  } else {
    tag.style.removeProperty("--tag-accent");
  }

  if (iconUrl) {
    const image = document.createElement("img");
    image.className = "host-rule-tag-icon";
    image.src = iconUrl;
    image.alt = "";
    tag.appendChild(image);
  } else if (icon) {
    const badge = document.createElement("span");
    badge.className = "host-rule-tag-icon host-rule-tag-glyph";
    badge.style.color =
      cookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER
        ? "var(--accent-strong)"
        : color
          ? getColorCode(color)
          : "var(--muted)";
    setIconGlyph(badge, icon);
    tag.appendChild(badge);
  }

  if ((ambiguous || missing) && technicalLabel) {
    tag.title = `Firefox container ID: ${technicalLabel}`;
  }

  const text = document.createElement("span");
  text.className = "host-rule-tag-text";
  text.textContent = name;
  tag.appendChild(text);

  if (ambiguous && technicalLabel) {
    const chip = document.createElement("span");
    chip.className = "host-rule-tag-flag";
    chip.textContent = `ID: ${technicalLabel}`;
    tag.appendChild(chip);
  }

  if (removable && typeof onRemove === "function") {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "host-rule-tag-remove";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", removeLabel || `Remove ${name}`);
    removeButton.onclick = onRemove;
    tag.appendChild(removeButton);
  }

  return tag;
}

function createCompactInlineField(labelText, control, helpText) {
  const field = createField(labelText, control, helpText, {
    layout: "inline",
    compact: true,
  });
  field.classList.add("proxy-inline-field");
  field.querySelector(".field-label").classList.add("proxy-inline-field-label");
  return field;
}

function createProxyDualRow(leftField, rightField) {
  const row = document.createElement("div");
  row.className = "proxy-dual-row";
  row.appendChild(leftField);
  row.appendChild(rightField);
  return row;
}

function createProxyBypassBlock(checkbox, textarea, helpText) {
  const block = document.createElement("div");
  block.className = "textarea-field proxy-bypass-block";

  const header = document.createElement("label");
  header.className = "proxy-bypass-header";
  header.appendChild(checkbox);

  const title = document.createElement("span");
  title.className = "proxy-bypass-title";
  title.textContent = "Bypass custom host list";
  header.appendChild(title);

  if (helpText) {
    header.appendChild(createHelp(helpText));
  }

  block.appendChild(header);
  block.appendChild(textarea);

  function sync() {
    const enabled = checkbox.checked;
    block.classList.toggle("enabled", enabled);
    textarea.disabled = !enabled;
  }

  checkbox.addEventListener("change", sync);
  sync();

  return {
    root: block,
    sync,
  };
}

function createContainerHeadersBlock({
  titleText,
  textarea,
  headersHelpText,
  pwnFoxCheckbox,
  pwnFoxHelpText,
  showPwnFoxToggle,
  getPwnFoxColorLabel,
}) {
  const block = document.createElement("div");
  block.className = "textarea-field container-headers-block";

  const header = document.createElement("div");
  header.className = "container-headers-block-header";
  block.appendChild(header);

  const heading = document.createElement("div");
  heading.className = "container-headers-block-heading";

  const headingTitle = document.createElement("span");
  headingTitle.className = "container-headers-block-title";
  headingTitle.textContent = titleText || "Custom headers";
  heading.appendChild(headingTitle);

  if (headersHelpText) {
    heading.appendChild(createHelp(headersHelpText));
  }

  header.appendChild(heading);

  let pwnFoxToggle = null;
  let pwnFoxValue = null;

  if (showPwnFoxToggle && pwnFoxCheckbox) {
    const pwnFoxCopy = document.createElement("span");
    pwnFoxCopy.className = "container-headers-pwnfox-copy";

    const pwnFoxLabel = document.createElement("span");
    pwnFoxLabel.className = "container-headers-pwnfox-label";
    pwnFoxLabel.textContent = "Send X-PwnFox-Color:";
    pwnFoxCopy.appendChild(pwnFoxLabel);

    pwnFoxValue = document.createElement("span");
    pwnFoxValue.className = "container-headers-pwnfox-value";
    pwnFoxCopy.appendChild(pwnFoxValue);

    pwnFoxToggle = createToggleControl(pwnFoxCheckbox, {
      className: "container-headers-pwnfox-toggle",
      content: [pwnFoxCopy],
      helpText: pwnFoxHelpText,
    });

    header.appendChild(pwnFoxToggle);
  }

  textarea.classList.add("container-headers-textarea");
  block.appendChild(textarea);

  function sync() {
    const enabled = Boolean(showPwnFoxToggle && pwnFoxCheckbox?.checked);
    block.classList.toggle("has-pwnfox-toggle", Boolean(pwnFoxToggle));
    block.classList.toggle("is-pwnfox-enabled", enabled);
    if (pwnFoxToggle) {
      pwnFoxToggle.classList.toggle("is-enabled", enabled);
    }
    if (pwnFoxValue) {
      pwnFoxValue.textContent = String(getPwnFoxColorLabel?.() || "default").toLowerCase();
    }
  }

  pwnFoxCheckbox?.addEventListener("change", sync);
  sync();

  return {
    root: block,
    sync,
  };
}

function createToggleControl(checkbox, { className, content = [], helpText } = {}) {
  const wrapper = document.createElement("label");
  wrapper.className = `toggle-control ${className || ""}`.trim();

  wrapper.appendChild(checkbox);
  content.forEach((node) => wrapper.appendChild(node));

  if (helpText) {
    wrapper.appendChild(createHelp(helpText));
  }

  return wrapper;
}

function createToggleOption(labelText, checkbox, helpText) {
  const copy = document.createElement("span");
  copy.className = "toggle-option-copy";
  copy.textContent = labelText;

  return createToggleControl(checkbox, {
    className: "toggle-option",
    content: [copy],
    helpText,
  });
}

function syncShortcutCaptureField(input, clearButton, shortcutValue) {
  const value = shortcutValue || "";
  input.value = value;
  input.parentElement?.classList.toggle("is-empty", !value);
  clearButton.disabled = !value;
}

function formatChoiceLabel(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getIconSvgMarkup(icon) {
  return ICON_SVG_BY_NAME[icon] || ICON_SVG_BY_NAME.circle;
}

function setIconGlyph(target, icon) {
  setIcon(target, getIconSvgMarkup(icon || "circle"));
}

function isContainerAppearanceEditable(container) {
  return Boolean(
    container &&
      !container.isDefault &&
      container.cookieStoreId !== Shared.FIREFOX_DEFAULT_CONTAINER,
  );
}

function createContainerIdentityPopover(
  selectedIcon,
  selectedColor,
  onColorChange,
  onIconChange,
) {
  const root = document.createElement("div");
  root.className = "container-identity-popover";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Container appearance");

  const title = document.createElement("div");
  title.className = "container-identity-popover-title";
  title.textContent = "Container appearance";
  root.appendChild(title);

  const colorSection = document.createElement("section");
  colorSection.className = "container-identity-popover-section";
  const colorLabel = document.createElement("div");
  colorLabel.className = "container-identity-popover-label";
  colorLabel.textContent = "Color";
  colorSection.appendChild(colorLabel);

  const colorGrid = document.createElement("div");
  colorGrid.className = "container-identity-color-grid";
  colorSection.appendChild(colorGrid);
  root.appendChild(colorSection);

  const iconSection = document.createElement("section");
  iconSection.className = "container-identity-popover-section";
  const iconLabel = document.createElement("div");
  iconLabel.className = "container-identity-popover-label";
  iconLabel.textContent = "Icon";
  iconSection.appendChild(iconLabel);

  const iconGrid = document.createElement("div");
  iconGrid.className = "container-identity-icon-grid";
  iconSection.appendChild(iconGrid);
  root.appendChild(iconSection);

  const colorButtons = [];
  const iconButtons = [];
  let currentColor = selectedColor;
  let currentIcon = selectedIcon;

  function syncColor(nextColor) {
    currentColor = nextColor;
    colorButtons.forEach(({ button, value }) => {
      const selected = value === currentColor;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function syncIcon(nextIcon) {
    currentIcon = nextIcon;
    iconButtons.forEach(({ button, value }) => {
      const selected = value === currentIcon;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  state.colorChoices.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "container-identity-color-option";
    button.title = formatChoiceLabel(entry.color);
    button.setAttribute("aria-label", formatChoiceLabel(entry.color));

    const swatch = document.createElement("span");
    swatch.className = "container-identity-color-swatch";
    swatch.style.backgroundColor = entry.colorCode || getColorCode(entry.color);

    button.appendChild(swatch);
    button.onclick = () => {
      syncColor(entry.color);
      onColorChange(entry.color);
    };

    colorButtons.push({ button, value: entry.color });
    colorGrid.appendChild(button);
  });

  state.iconChoices.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "container-identity-icon-option";
    button.title = formatChoiceLabel(entry.icon);
    button.setAttribute("aria-label", formatChoiceLabel(entry.icon));

    const glyph = document.createElement("span");
    glyph.className = "container-identity-icon-glyph";
    setIconGlyph(glyph, entry.icon);

    button.appendChild(glyph);
    button.onclick = () => {
      syncIcon(entry.icon);
      onIconChange(entry.icon);
    };

    iconButtons.push({ button, value: entry.icon });
    iconGrid.appendChild(button);
  });

  syncColor(selectedColor);
  syncIcon(selectedIcon);

  return {
    root,
    syncSelection(nextIcon, nextColor) {
      if (typeof nextColor === "string") {
        syncColor(nextColor);
      }
      if (typeof nextIcon === "string") {
        syncIcon(nextIcon);
      }
    },
  };
}

function getContainerIdentityElements(cookieStoreId) {
  if (!cookieStoreId) {
    return null;
  }

  const card = document.querySelector(
    `.container-card[data-cookie-store-id="${CSS.escape(cookieStoreId)}"]`,
  );
  if (!card) {
    return null;
  }

  return {
    card,
    main: card.querySelector(".card-header-main"),
    trigger: card.querySelector(".identity-trigger"),
    popover: card.querySelector(".container-identity-popover"),
  };
}

function syncContainerIdentityPopoverDomState(elements, isOpen) {
  if (!elements) {
    return;
  }

  elements.card?.classList.toggle("has-open-container-identity-popover", isOpen);
  elements.main?.classList.toggle("has-open-popover", isOpen);

  if (elements.trigger) {
    elements.trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  if (elements.popover) {
    elements.popover.hidden = !isOpen;
    elements.popover.classList.toggle("is-open", isOpen);

    if (!isOpen) {
      elements.popover.classList.remove("is-above");
      elements.popover.style.removeProperty("--identity-popover-shift-x");
    }
  }
}

function scheduleContainerIdentityPopoverReposition() {
  if (containerIdentityPopoverFrame) {
    return;
  }

  containerIdentityPopoverFrame = window.requestAnimationFrame(() => {
    repositionOpenContainerIdentityPopover();
  });
}

function repositionOpenContainerIdentityPopover() {
  containerIdentityPopoverFrame = 0;

  const cookieStoreId = state.openContainerIdentityPopoverCookieStoreId;
  if (!cookieStoreId) {
    state.openContainerIdentityPopoverAnchorRect = null;
    return;
  }

  const elements = getContainerIdentityElements(cookieStoreId);
  if (!elements || !elements.trigger || !elements.popover) {
    closeContainerIdentityPopover();
    return;
  }

  if (elements.popover.hidden) {
    syncContainerIdentityPopoverDomState(elements, true);
  }

  const triggerRect = elements.trigger.getBoundingClientRect();
  const popoverRect = elements.popover.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const horizontalPadding = 12;
  const verticalPadding = 12;
  const idealLeft =
    triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
  const minLeft = horizontalPadding;
  const maxLeft = Math.max(horizontalPadding, viewportWidth - horizontalPadding - popoverRect.width);
  const clampedLeft = Math.min(Math.max(idealLeft, minLeft), maxLeft);
  const shiftX = clampedLeft - idealLeft;

  const availableAbove = triggerRect.top - verticalPadding;
  const availableBelow = viewportHeight - verticalPadding - triggerRect.bottom;
  const shouldPlaceAbove =
    availableBelow < popoverRect.height && availableAbove > availableBelow;

  elements.popover.style.setProperty(
    "--identity-popover-shift-x",
    `${Math.round(shiftX)}px`,
  );
  elements.popover.classList.toggle("is-above", shouldPlaceAbove);
  state.openContainerIdentityPopoverPlacement = shouldPlaceAbove
    ? "above"
    : "below";
  state.openContainerIdentityPopoverAnchorRect = {
    top: triggerRect.top,
    right: triggerRect.right,
    bottom: triggerRect.bottom,
    left: triggerRect.left,
    width: triggerRect.width,
    height: triggerRect.height,
  };
}

function openContainerIdentityPopover(cookieStoreId) {
  if (!cookieStoreId || state.openContainerIdentityPopoverCookieStoreId === cookieStoreId) {
    scheduleContainerIdentityPopoverReposition();
    return;
  }

  const openElements = getContainerIdentityElements(
    state.openContainerIdentityPopoverCookieStoreId,
  );
  syncContainerIdentityPopoverDomState(openElements, false);

  state.openContainerIdentityPopoverCookieStoreId = cookieStoreId;
  state.openContainerIdentityPopoverPlacement = null;
  const nextElements = getContainerIdentityElements(cookieStoreId);
  syncContainerIdentityPopoverDomState(nextElements, true);
  scheduleContainerIdentityPopoverReposition();
}

function closeContainerIdentityPopover(options) {
  const restoreFocus = Boolean(options && options.restoreFocus);
  const cookieStoreId = state.openContainerIdentityPopoverCookieStoreId;
  if (!cookieStoreId) {
    return;
  }

  if (containerIdentityPopoverFrame) {
    window.cancelAnimationFrame(containerIdentityPopoverFrame);
    containerIdentityPopoverFrame = 0;
  }

  const elements = getContainerIdentityElements(cookieStoreId);
  state.openContainerIdentityPopoverCookieStoreId = "";
  state.openContainerIdentityPopoverAnchorRect = null;
  state.openContainerIdentityPopoverPlacement = null;
  syncContainerIdentityPopoverDomState(elements, false);

  if (restoreFocus && elements?.trigger) {
    elements.trigger.focus({ preventScroll: true });
  }
}

function toggleContainerIdentityPopover(cookieStoreId) {
  if (state.openContainerIdentityPopoverCookieStoreId === cookieStoreId) {
    closeContainerIdentityPopover({ restoreFocus: true });
    return;
  }

  openContainerIdentityPopover(cookieStoreId);
}

function syncOpenContainerIdentityPopoverAfterRender() {
  const cookieStoreId = state.openContainerIdentityPopoverCookieStoreId;
  if (!cookieStoreId) {
    return;
  }

  const elements = getContainerIdentityElements(cookieStoreId);
  if (!elements || !elements.trigger || !elements.popover) {
    closeContainerIdentityPopover();
    return;
  }

  syncContainerIdentityPopoverDomState(elements, true);
  elements.popover.classList.toggle(
    "is-above",
    state.openContainerIdentityPopoverPlacement === "above",
  );
  scheduleContainerIdentityPopoverReposition();
}

function getCommandByName(commandName) {
  return state.commands.find((command) => command.name === commandName) || null;
}

function getCommandShortcut(commandName) {
  return getCommandByName(commandName)?.shortcut || "";
}

function normalizeShortcutValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getCommandConflictLabel(
  commandName,
  commands = state.commands,
  containers = state.containers,
) {
  const description = (commands || []).find((command) => command.name === commandName)
    ?.description;
  if (typeof description === "string" && description.trim()) {
    return description.trim();
  }

  const fixedDescription = Shared.getFixedShortcutCommandDescription(commandName);
  if (fixedDescription) {
    return fixedDescription;
  }

  const slot = Shared.getSlotNumberFromCommandName(commandName);
  const slotEntry = Shared.getContainerSlot(containers, slot);
  const containerLabel = slotEntry?.name || `container slot ${slot}`;

  if (Shared.isOpenContainerSlotCommand(commandName)) {
    return `Open a new tab in ${containerLabel}`;
  }

  if (Shared.isReopenContainerSlotCommand(commandName)) {
    return `Reopen the current tab in ${containerLabel}`;
  }

  return "another Privacy Containers shortcut";
}

function getInternalShortcutConflictIssue(
  commandName,
  shortcut,
  commands = state.commands,
  containers = state.containers,
) {
  const requestedShortcut = normalizeShortcutValue(shortcut);
  if (!requestedShortcut) {
    return "";
  }

  const conflictingCommand = (commands || []).find(
    (command) =>
      command &&
      command.name !== commandName &&
      normalizeShortcutValue(command.shortcut) === requestedShortcut,
  );
  if (!conflictingCommand) {
    return "";
  }

  const conflictLabel = getCommandConflictLabel(
    conflictingCommand.name,
    commands,
    containers,
  );
  return `Shortcut "${requestedShortcut}" is already used by "${conflictLabel}".`;
}

function ensureContainerSetting(cookieStoreId) {
  if (!state.config.containerSettings[cookieStoreId]) {
    state.config.containerSettings[cookieStoreId] =
      Shared.createDefaultContainerSetting();
  }

  return state.config.containerSettings[cookieStoreId];
}

function pruneContainerSetting(cookieStoreId) {
  const setting = state.config.containerSettings[cookieStoreId];
  if (!setting) {
    return;
  }

  if (!setting.proxyId && !setting.headers.length && !setting.pwnFoxColorEnabled) {
    delete state.config.containerSettings[cookieStoreId];
  }
}

function findProxyTitleConflict(title, excludedProxyId) {
  const normalizedTitle = Shared.normalizeProxyTitleKey(title);
  if (!normalizedTitle) {
    return null;
  }

  return (
    state.config.proxies.find((proxy) => {
      if (proxy.id === excludedProxyId) {
        return false;
      }

      return Shared.normalizeProxyTitleKey(proxy.title) === normalizedTitle;
    }) || null
  );
}

async function createContainerAndFocus() {
  const title = getNextContainerGeneratedName();
  const icon = pickRandomPropertyValue(
    state.iconChoices,
    "icon",
    Shared.CONTEXTUAL_ICONS[0] || "circle",
  );
  const color = pickRandomPropertyValue(
    state.colorChoices,
    "color",
    FALLBACK_COLOR_CHOICES[0]?.color || "blue",
  );

  const created = await browser.contextualIdentities.create({
    name: title,
    icon,
    color,
  });
  await refreshState({ preserveDraft: true });

  const cookieStoreId =
    created?.cookieStoreId ||
    state.containers.find(
      (container) =>
        normalizeVisibleContainerName(container.name) ===
        normalizeVisibleContainerName(title),
    )?.cookieStoreId ||
    "";

  if (cookieStoreId) {
    queuePendingCardInsert(
      "containers",
      cookieStoreId,
      `container-name:${cookieStoreId}`,
      title,
    );
  }

  renderShell();
  await renderActiveTabContent();
  setStatus("Container created.", false);
}

async function commitConfigCollectionMutation({
  nextConfig,
  message,
  renderShellAfter = false,
}) {
  const previousConfig = state.config;
  state.config = nextConfig;

  try {
    await persistConfigNow(message);
    if (renderShellAfter) {
      renderShell();
    }
    await renderActiveTabContent();
  } catch (error) {
    state.config = previousConfig;
    throw error;
  }
}

async function insertConfigCollectionItem({
  collection,
  item,
  position,
  focusId,
  focusValue,
  message,
  activeTab = "",
}) {
  const items = state.config[collection];
  const nextItems =
    position === "start" ? [item, ...items] : [...items, item];
  const nextConfig = {
    ...state.config,
    [collection]: nextItems,
    ui: activeTab
      ? { ...state.config.ui, activeTab }
      : state.config.ui,
  };

  queuePendingCardInsert(collection, item.id, focusId, focusValue);

  try {
    await commitConfigCollectionMutation({
      nextConfig,
      message,
      renderShellAfter: true,
    });
  } catch (error) {
    state.pendingInteractions[collection].insert = null;
    state.pendingFocusRestore = null;
    throw error;
  }

  setStatus(message, false);
}

async function moveConfigCollectionItem({
  collection,
  itemId,
  direction,
  card,
  event,
  message,
}) {
  const items = state.config[collection];
  const index = items.findIndex((item) => item.id === itemId);
  const targetIndex = index + direction;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) {
    return false;
  }

  captureReorderScrollAnchor(collection, card, itemId, event);
  captureReorderSnapshot(collection, itemId);

  const nextItems = items.slice();
  const [movedItem] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  await commitConfigCollectionMutation({
    nextConfig: { ...state.config, [collection]: nextItems },
    message,
  });
  return true;
}

function appendCollectionMoveActions(
  headerActions,
  { index, totalItems, onMove },
) {
  const directions = [
    {
      title: "Move up",
      icon: MOVE_UP_ICON_SVG,
      direction: -1,
      disabled: index === 0,
    },
    {
      title: "Move down",
      icon: MOVE_DOWN_ICON_SVG,
      direction: 1,
      disabled: index >= totalItems - 1,
    },
  ];

  directions.forEach(({ title, icon, direction, disabled }) => {
    const button = createIconButton(title, icon, async (event) => {
      await onMove(direction, event);
    });
    button.disabled = disabled;
    headerActions.appendChild(button);
  });
}

async function moveContainerCard({ slotEntry, index, direction, card, event }) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.containers.length) {
    return false;
  }

  const sourceSlot = slotEntry.slot;
  const targetSlot = sourceSlot + direction;
  const movedContainer =
    direction < 0 ? slotEntry : state.containers[targetIndex];
  const firefoxMoveIndex = direction < 0 ? targetIndex : index;
  captureReorderScrollAnchor("containers", card, slotEntry.cookieStoreId, event);
  captureReorderSnapshot("containers", slotEntry.cookieStoreId);

  try {
    await browser.contextualIdentities.move(
      movedContainer.cookieStoreId,
      firefoxMoveIndex,
    );
    const shortcutResult = await swapShortcutAssignmentsBetweenSlots(
      sourceSlot,
      targetSlot,
    );
    await notifyBackgroundContainersChanged();
    await refreshState();
    await renderActiveTabContent();
    setStatus(shortcutResult.message, false);
  } catch (error) {
    try {
      await withSuppressedCommandChangeEvents(async () => {
        await browser.contextualIdentities.move(slotEntry.cookieStoreId, index);
      });
      await notifyBackgroundContainersChanged();
    } catch (_) {
      // Preserve the original failure message below.
    }
    await refreshState();
    await renderActiveTabContent();
    setStatus(
      error && error.message
        ? `${error.message} The move was reverted.`
        : "Failed to move container. The move was reverted.",
      true,
    );
  }

  return true;
}

async function createProxyAndFocus(options) {
  const activateTab = Boolean(options && options.activateTab);
  const title = getNextProxyGeneratedTitle();
  const proxy = Shared.normalizeProxy({
    id: Shared.createProxyId(),
    title,
    type: "http",
    host: "",
    port: 8080,
    username: "",
    password: "",
    proxyDNS: false,
    doNotProxyLocal: true,
    bypass: Shared.createDefaultProxyBypass(),
  });

  await insertConfigCollectionItem({
    collection: "proxies",
    item: proxy,
    position: "end",
    focusId: `proxy-title:${proxy.id}`,
    focusValue: title,
    message: "Proxy created.",
    activeTab: activateTab ? "proxies" : "",
  });
}

async function createHostRuleAndFocus() {
  const title = getNextHostRuleGeneratedName();
  const rule = Shared.normalizeHostRuleCard({
    id: Shared.createHostRuleId(),
    name: title,
    enabled: true,
    mode: "blacklist",
    patterns: [],
    exceptions: [],
  });

  await insertConfigCollectionItem({
    collection: "hostRules",
    item: rule,
    position: "start",
    focusId: `host-rule-name:${rule.id}`,
    focusValue: title,
    message: "Host Rule created.",
  });
}

function setPersistedBundle(bundle) {
  const normalizedBundle = Shared.normalizeConfigBundle(bundle);
  state.persistedConfig = normalizedBundle.config;
  state.persistedMeta = normalizedBundle.meta;
}

function syncDraftWithPersistedBundle(bundle) {
  setPersistedBundle(bundle);
  state.config = Shared.clone(state.persistedConfig);
  state.draftVersion += 1;
  state.dirty = false;
  state.saveBlockedReason = "";
}

function markDraftDirty() {
  state.dirty = true;
  state.draftVersion += 1;
}

async function refreshState(options) {
  const preserveDraft = Boolean(options && options.preserveDraft);
  const [bundle, containers, commands, colorChoices, iconChoices] =
    await Promise.all([
      Shared.loadConfigBundle(),
      browser.contextualIdentities.query({}),
      browser.commands.getAll ? browser.commands.getAll() : Promise.resolve([]),
      Promise.resolve(FALLBACK_COLOR_CHOICES),
      Promise.resolve(Shared.CONTEXTUAL_ICONS.map((icon) => ({ icon }))),
    ]);

  if (!preserveDraft || (!state.dirty && !state.saveInFlight)) {
    syncDraftWithPersistedBundle(bundle);
  } else {
    setPersistedBundle(bundle);
  }
  state.containers = containers;
  state.commands = commands;
  state.colorChoices = colorChoices;
  state.iconChoices = iconChoices;
}

async function refreshCommands() {
  state.commands = browser.commands.getAll
    ? await browser.commands.getAll()
    : [];
}

async function notifyBackgroundContainersChanged() {
  if (!browser.runtime || !browser.runtime.sendMessage) {
    return;
  }

  const response = await browser.runtime.sendMessage({
    type: "containers-changed",
  });

  if (!response || response.ok !== true) {
    throw new Error("Failed to refresh background container shortcuts.");
  }
}

function slotSupportsCommands(slot) {
  return Number.isInteger(slot) && slot >= 0 && slot < Shared.SHORTCUT_SLOT_COUNT;
}

function getSlotCommandNames(slot) {
  return [
    Shared.getOpenContainerSlotCommandName(slot),
    Shared.getReopenContainerSlotCommandName(slot),
  ];
}

function getCommandShortcutSnapshot(commandNames, commands) {
  const commandsByName = new Map(
    (commands || []).map((command) => [command.name, command.shortcut || ""]),
  );

  return new Map(
    commandNames.map((name) => [name, commandsByName.get(name) || ""]),
  );
}

function buildSwappedShortcutSnapshot(slotA, slotB, currentShortcuts) {
  const [openA, reopenA] = getSlotCommandNames(slotA);
  const [openB, reopenB] = getSlotCommandNames(slotB);

  return new Map([
    [openA, currentShortcuts.get(openB) || ""],
    [reopenA, currentShortcuts.get(reopenB) || ""],
    [openB, currentShortcuts.get(openA) || ""],
    [reopenB, currentShortcuts.get(reopenA) || ""],
  ]);
}

async function withSuppressedCommandChangeEvents(task) {
  state.suppressCommandChangeEvents += 1;

  try {
    return await task();
  } finally {
    state.suppressCommandChangeEvents = Math.max(
      0,
      state.suppressCommandChangeEvents - 1,
    );
  }
}

async function applyShortcutSnapshot(targetShortcuts) {
  const commandNames = Array.from(targetShortcuts.keys());
  const currentShortcuts = getCommandShortcutSnapshot(
    commandNames,
    await browser.commands.getAll(),
  );
  const changedNames = commandNames.filter(
    (name) => (currentShortcuts.get(name) || "") !== (targetShortcuts.get(name) || ""),
  );

  for (const name of changedNames) {
    if (!currentShortcuts.get(name)) {
      continue;
    }

    await browser.commands.update({
      name,
      shortcut: "",
    });
  }

  for (const name of changedNames) {
    const shortcut = targetShortcuts.get(name) || "";
    if (!shortcut) {
      continue;
    }

    await browser.commands.update({
      name,
      shortcut,
    });
  }

  const activeShortcuts = getCommandShortcutSnapshot(
    commandNames,
    await browser.commands.getAll(),
  );

  const mismatch = changedNames.find(
    (name) => (activeShortcuts.get(name) || "") !== (targetShortcuts.get(name) || ""),
  );

  if (mismatch) {
    throw new Error("Firefox did not apply the moved shortcuts cleanly.");
  }

  return changedNames.length > 0;
}

async function swapShortcutAssignmentsBetweenSlots(slotA, slotB) {
  const slotASupportsCommands = slotSupportsCommands(slotA);
  const slotBSupportsCommands = slotSupportsCommands(slotB);

  if (!slotASupportsCommands && !slotBSupportsCommands) {
    return {
      message: "Container moved.",
    };
  }

  if (!slotASupportsCommands || !slotBSupportsCommands) {
    return {
      message:
        `Container moved. Shortcut assignments only follow moves within the first ${Shared.SHORTCUT_SLOT_COUNT} positions.`,
    };
  }

  if (!browser.commands || !browser.commands.getAll || !browser.commands.update) {
    return {
      message: "Container moved.",
    };
  }

  const commandNames = [...getSlotCommandNames(slotA), ...getSlotCommandNames(slotB)];
  const currentShortcuts = getCommandShortcutSnapshot(
    commandNames,
    await browser.commands.getAll(),
  );
  const targetShortcuts = buildSwappedShortcutSnapshot(
    slotA,
    slotB,
    currentShortcuts,
  );
  const changedNames = commandNames.filter(
    (name) => (currentShortcuts.get(name) || "") !== (targetShortcuts.get(name) || ""),
  );

  if (!changedNames.length) {
    return {
      message: "Container moved.",
    };
  }

  try {
    await withSuppressedCommandChangeEvents(() =>
      applyShortcutSnapshot(targetShortcuts),
    );
  } catch (error) {
    try {
      await withSuppressedCommandChangeEvents(() =>
        applyShortcutSnapshot(currentShortcuts),
      );
    } catch (_) {
      throw new Error("Failed to swap moved shortcuts and restore the previous state.");
    }

    throw error;
  }

  return {
    message: "Container moved.",
  };
}

function scheduleConfigSave(delay, message) {
  state.pendingSaveMessage = message || "Saved.";
  state.suppressSaveStatus = false;
  markDraftDirty();

  if (state.saveBlockedReason) {
    setStatus(state.saveBlockedReason, true);
    return;
  }

  setStatus("Saving...", false);

  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
  }

  if (delay <= 0) {
    state.saveTimer = 0;
    flushConfigSave().catch((error) => {
      setStatus(error.message, true);
    });
    return;
  }

  state.saveTimer = window.setTimeout(() => {
    flushConfigSave().catch((error) => {
      setStatus(error.message, true);
    });
  }, delay);
}

async function flushConfigSave() {
  if (state.saveBlockedReason) {
    throw new Error(state.saveBlockedReason);
  }

  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = 0;
  }

  if (state.saveInFlight) {
    await state.savePromise;
    if (state.dirty) {
      return flushConfigSave();
    }
    return state.savePromise;
  }

  if (!state.dirty) {
    return state.savePromise;
  }

  state.saveInFlight = true;
  const snapshot = Shared.clone(state.config);
  const expectedRevision = state.persistedMeta.revision;
  const requestedDraftVersion = state.draftVersion;
  const successMessage = state.pendingSaveMessage;
  const suppressSaveStatus = state.suppressSaveStatus;
  if (!suppressSaveStatus) {
    setStatus("Saving...", false);
  }
  state.dirty = false;

  state.savePromise = Shared.saveConfigBundle(
    expectedRevision,
    snapshot,
    state.writerId,
  )
    .then((savedBundle) => {
      setPersistedBundle(savedBundle);

      if (state.draftVersion === requestedDraftVersion) {
        state.config = Shared.clone(savedBundle.config);
      }

      if (suppressSaveStatus) {
        clearStatus();
      } else if (state.draftVersion === requestedDraftVersion && !state.dirty) {
        setStatus(successMessage, false);
      } else {
        setStatus("Saving...", false);
      }
    })
    .catch((error) => {
      if (error && error.code === "CONFIG_CONFLICT") {
        setConfigReloadBlockedStatus();
      }

      state.dirty = true;
      throw error;
    })
    .finally(() => {
      state.saveInFlight = false;
      state.suppressSaveStatus = false;
    });

  await state.savePromise;

  if (state.dirty) {
    return flushConfigSave();
  }

  return state.savePromise;
}

function getOrCreatePendingIdentitySave(cookieStoreId) {
  if (!state.pendingIdentitySaves.has(cookieStoreId)) {
    state.pendingIdentitySaves.set(cookieStoreId, {
      draft: null,
      promise: Promise.resolve(),
      timer: 0,
    });
  }

  return state.pendingIdentitySaves.get(cookieStoreId);
}

function cancelPendingIdentitySave(cookieStoreId) {
  const entry = state.pendingIdentitySaves.get(cookieStoreId);
  if (!entry) {
    return Promise.resolve();
  }

  if (entry.timer) {
    window.clearTimeout(entry.timer);
    entry.timer = 0;
  }

  return entry.promise.catch(() => undefined);
}

async function renderActiveTabContentPreservingScrollPosition() {
  // Rebuilding the focused color picker can make Firefox adjust the viewport.
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  await renderActiveTabContent();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  window.scrollTo(scrollX, scrollY);
  scheduleContainerIdentityPopoverReposition();
}

function discardPendingIdentitySaves() {
  state.pendingIdentitySaves.forEach((entry) => {
    if (entry.timer) {
      window.clearTimeout(entry.timer);
      entry.timer = 0;
    }
  });
  state.pendingIdentitySaves.clear();
}

function commitContainerIdentitySave(cookieStoreId, entry, draft) {
  entry.promise = entry.promise
    .catch(() => undefined)
    .then(async () => {
      captureActiveFieldFocus();
      await browser.contextualIdentities.update(cookieStoreId, draft);
      await refreshState({ preserveDraft: true });
      await renderActiveTabContentPreservingScrollPosition();
    })
    .finally(() => {
      if (!entry.timer && entry.draft === draft) {
        state.pendingIdentitySaves.delete(cookieStoreId);
      }
    });

  return entry.promise;
}

function scheduleContainerIdentitySave(cookieStoreId, draft, delay) {
  const entry = getOrCreatePendingIdentitySave(cookieStoreId);
  entry.draft = draft;

  if (entry.timer) {
    window.clearTimeout(entry.timer);
  }

  entry.timer = window.setTimeout(() => {
    entry.timer = 0;
    commitContainerIdentitySave(cookieStoreId, entry, entry.draft).catch((error) => {
      setStatus(error.message, true);
    });
  }, delay);
}

async function flushPendingIdentitySaves() {
  const tasks = [];

  state.pendingIdentitySaves.forEach((entry, cookieStoreId) => {
    if (entry.timer) {
      window.clearTimeout(entry.timer);
      entry.timer = 0;
      tasks.push(commitContainerIdentitySave(cookieStoreId, entry, entry.draft));
      return;
    }

    tasks.push(entry.promise);
  });

  await Promise.all(tasks);
}

async function persistConfigNow(message, options) {
  markDraftDirty();
  state.pendingSaveMessage = message || "Saved.";
  state.suppressSaveStatus = Boolean(options && options.silentStatus);

  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = 0;
  }

  await flushConfigSave();
}

function discardPendingConfigDraft() {
  if (state.saveTimer) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = 0;
  }

  state.dirty = false;
  state.saveBlockedReason = "";
}

async function reloadPersistedState() {
  const hasUnsavedChanges =
    state.dirty || state.saveInFlight || state.pendingIdentitySaves.size > 0;
  if (hasUnsavedChanges && !window.confirm(CONFIG_RELOAD_CONFIRMATION)) {
    return false;
  }

  discardPendingIdentitySaves();
  discardPendingConfigDraft();
  await refreshState();
  renderShell();
  await renderActiveTabContent();
  setStatus("Latest configuration loaded.", false);
  return true;
}

async function updateCommandShortcut(commandName, shortcut, message) {
  await refreshCommands();
  const internalConflictIssue = getInternalShortcutConflictIssue(
    commandName,
    shortcut,
  );
  if (internalConflictIssue) {
    throw new Error(
      `${internalConflictIssue} Assign a different combination or clear the other shortcut first.`,
    );
  }

  await browser.commands.update({
    name: commandName,
    shortcut,
  });
  await refreshCommands();
  const activeShortcut = getCommandShortcut(commandName);
  const activationIssue = Shared.getShortcutActivationIssue(
    shortcut,
    activeShortcut,
  );
  syncVisibleShortcutFields();

  if (activationIssue) {
    throw new Error(
      `${activationIssue} Try another combination or use Shortcut settings.`,
    );
  }

  setStatus(message, false);
  return activeShortcut;
}

function getHeaderPrimaryActionDescriptor(activeTab = state.config.ui.activeTab) {
  switch (activeTab) {
    case "proxies":
      return {
        tabId: "proxies",
        label: "Create new proxy",
      };
    case "host-rules":
      return {
        tabId: "host-rules",
        label: "Create new host rule",
      };
    case "containers":
    default:
      return {
        tabId: "containers",
        label: "Create new container",
      };
  }
}

async function runHeaderPrimaryAction(activeTab) {
  switch (activeTab) {
    case "proxies":
      await createProxyAndFocus();
      return;
    case "host-rules":
      await createHostRuleAndFocus();
      return;
    case "containers":
    default:
      await createContainerAndFocus();
  }
}

function renderHeaderPrimaryAction() {
  const slot = document.getElementById("header-primary-action-slot");
  if (!slot) {
    return;
  }

  const descriptor = getHeaderPrimaryActionDescriptor();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-primary-action";
  button.setAttribute("aria-label", descriptor.label);
  const icon = document.createElement("span");
  icon.className = "header-primary-action-icon";
  icon.setAttribute("aria-hidden", "true");
  setIcon(icon, ADD_ICON_SVG);
  button.appendChild(icon);
  const copy = document.createElement("span");
  copy.className = "header-primary-action-copy";
  const caption = document.createElement("span");
  caption.className = "header-primary-action-caption";
  caption.textContent = "Active tab action";
  const label = document.createElement("span");
  label.className = "header-primary-action-label";
  label.textContent = descriptor.label;
  copy.append(caption, label);
  button.appendChild(copy);
  button.onclick = async () => {
    clearStatus();

    try {
      await runHeaderPrimaryAction(descriptor.tabId);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  slot.textContent = "";
  slot.appendChild(button);
}

function renderTabNav() {
  const nav = document.getElementById("tab-nav");
  nav.textContent = "";

  getTabSummaries().forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      state.config.ui.activeTab === item.id ? "tab-button active" : "tab-button";
    button.setAttribute(
      "aria-label",
      item.draftCount
        ? `${item.title}, ${item.activeLabel}, ${item.draftCount} draft${item.draftCount === 1 ? "" : "s"}`
        : `${item.title}, ${item.activeLabel}`,
    );

    const copy = document.createElement("span");
    copy.className = "tab-button-copy";

    const title = document.createElement("span");
    title.className = "tab-button-title";
    title.textContent = item.title;
    copy.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "tab-button-meta";
    meta.appendChild(document.createTextNode(item.activeLabel));

    if (item.draftCount > 0) {
      const draftMeta = document.createElement("span");
      draftMeta.className = "tab-button-drafts";
      draftMeta.textContent = `(+${item.draftCount} draft${item.draftCount === 1 ? "" : "s"})`;
      meta.appendChild(draftMeta);
    }

    copy.appendChild(meta);
    button.appendChild(copy);
    button.onclick = async () => {
      state.config.ui.activeTab = item.id;
      try {
        await persistConfigNow("", { silentStatus: true });
        await refreshState();
        renderShell();
        await renderActiveTabContent();
      } catch (error) {
        setStatus(error.message, true);
      }
    };
    nav.appendChild(button);
  });

  renderHeaderPrimaryAction();
  scheduleStickyHeaderMetrics();
}

function createShortcutEntry(label, commandName, helpText) {
  const row = document.createElement("div");
  row.className = "shortcut-entry";
  row.dataset.commandName = commandName;

  const title = document.createElement("div");
  title.className = "shortcut-entry-label";

  const icon = document.createElement("span");
  icon.className = "shortcut-entry-icon";
  setIcon(icon, KEYBOARD_ICON_SVG);
  title.appendChild(icon);

  const text = document.createElement("span");
  text.className = "shortcut-entry-text";
  text.textContent = label;
  title.appendChild(text);

  if (helpText) {
    title.appendChild(createHelp(helpText));
  }

  const inputWrap = document.createElement("div");
  inputWrap.className = "shortcut-input-wrap";

  const input = createInput("", "Press shortcut");
  input.className = "shortcut-capture compact-shortcut-input";
  input.dataset.commandName = commandName;
  input.readOnly = true;
  input.onkeydown = (event) => {
    event.preventDefault();

    if (event.key === "Escape") {
      input.blur();
      syncShortcutCaptureField(input, clearButton, getCommandShortcut(commandName));
      return;
    }

    const shortcutValue = Shared.captureShortcutFromEventData(event);
    if (!shortcutValue) {
      setStatus(
        "Shortcut capture requires Ctrl, Alt or Command plus a supported key.",
        true,
      );
      return;
    }

    updateCommandShortcut(commandName, shortcutValue, "Shortcut updated.")
      .then((activeShortcut) => {
        syncShortcutCaptureField(input, clearButton, activeShortcut);
      })
      .catch((error) => {
        syncShortcutCaptureField(input, clearButton, getCommandShortcut(commandName));
        setStatus(error.message, true);
      });
  };

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "shortcut-clear-button";
  clearButton.dataset.commandName = commandName;
  clearButton.title = "Reset shortcut";
  clearButton.setAttribute("aria-label", "Reset shortcut");
  setIcon(clearButton, CLEAR_ICON_SVG);
  clearButton.onclick = async () => {
    const activeShortcut = await updateCommandShortcut(
      commandName,
      "",
      "Shortcut cleared.",
    );
    syncShortcutCaptureField(input, clearButton, activeShortcut);
  };

  inputWrap.appendChild(input);
  inputWrap.appendChild(clearButton);
  syncShortcutCaptureField(input, clearButton, getCommandShortcut(commandName));
  row.appendChild(title);
  row.appendChild(inputWrap);
  return row;
}

function syncVisibleShortcutFields(root) {
  const scope = root || document;
  scope.querySelectorAll(".shortcut-entry[data-command-name]").forEach((row) => {
    const commandName = row.dataset.commandName || "";
    const input = row.querySelector(".shortcut-capture");
    const clearButton = row.querySelector(".shortcut-clear-button");
    if (!(input instanceof HTMLInputElement) || !(clearButton instanceof HTMLElement)) {
      return;
    }

    syncShortcutCaptureField(input, clearButton, getCommandShortcut(commandName));
  });
}

function createIntrinsicStackGroup(className) {
  const group = document.createElement("div");
  group.className = className
    ? `intrinsic-stack-group ${className}`
    : "intrinsic-stack-group";
  return group;
}

function captureReorderScrollAnchor(collection, card, itemId, event) {
  const pending = state.pendingInteractions[collection];
  if (!card || !itemId || !event) {
    pending.scrollAnchor = null;
    return;
  }

  const rect = card.getBoundingClientRect();
  pending.scrollAnchor = {
    itemId,
    pointerClientY: event.clientY,
    pointerOffsetY: event.clientY - rect.top,
  };
}

function captureReorderSnapshot(collection, movedItemId) {
  const { selector, datasetKey } = CARD_COLLECTIONS[collection];
  const pending = state.pendingInteractions[collection];
  const cards = Array.from(
    document.querySelectorAll(selector),
  );

  if (!cards.length || !movedItemId) {
    pending.reorder = null;
    return;
  }

  pending.reorder = {
    movedItemId,
    positionsById: new Map(
      cards.map((card) => [
        card.dataset[datasetKey],
        {
          top: card.getBoundingClientRect().top,
          left: card.getBoundingClientRect().left,
        },
      ]),
    ),
  };
}

async function restorePendingReorderScrollAnchor(collection) {
  const { selector, datasetKey } = CARD_COLLECTIONS[collection];
  const pending = state.pendingInteractions[collection];
  const anchor = pending.scrollAnchor;
  if (!anchor) {
    return;
  }

  pending.scrollAnchor = null;

  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const target = Array.from(document.querySelectorAll(selector)).find(
    (element) => element.dataset[datasetKey] === anchor.itemId,
  );
  if (!target) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const deltaY = rect.top + anchor.pointerOffsetY - anchor.pointerClientY;
  if (Math.abs(deltaY) >= 1) {
    window.scrollBy(0, deltaY);
  }

  keepElementClearOfStickyHeader(target);
}

function getCardAnimationColors(card) {
  const computed = window.getComputedStyle(card);
  const contextAccent =
    computed.getPropertyValue("--context-accent").trim() || computed.borderColor;
  return {
    accent: contextAccent,
    restingBorder: computed.borderColor,
    restingShadow: computed.boxShadow === "none" ? "" : computed.boxShadow,
  };
}

function buildReorderKeyframes(card, deltaX, deltaY, isMovedCard) {
  const colors = getCardAnimationColors(card);
  return [
    {
      transform: `translate(${deltaX}px, ${deltaY}px)`,
      boxShadow: isMovedCard
        ? `0 10px 24px color-mix(in srgb, ${colors.accent} 18%, transparent)`
        : colors.restingShadow,
      borderColor: isMovedCard ? colors.accent : colors.restingBorder,
    },
    {
      transform: "translate(0, 0)",
      boxShadow: colors.restingShadow,
      borderColor: colors.restingBorder,
    },
  ];
}

function buildInsertKeyframes(card) {
  const colors = getCardAnimationColors(card);
  const restingShadowSuffix = colors.restingShadow
    ? `, ${colors.restingShadow}`
    : "";

  return [
    {
      opacity: 0.45,
      transform: "translateY(16px)",
      boxShadow: `0 10px 24px color-mix(in srgb, ${colors.accent} 12%, transparent)`,
      borderColor: colors.accent,
    },
    {
      opacity: 1,
      transform: "translateY(0)",
      boxShadow: `0 0 0 1px color-mix(in srgb, ${colors.accent} 24%, transparent)${restingShadowSuffix}`,
      borderColor: colors.accent,
    },
    {
      opacity: 1,
      transform: "translateY(0)",
      boxShadow: colors.restingShadow,
      borderColor: colors.restingBorder,
    },
  ];
}

async function playPendingReorderAnimation(collection) {
  const { selector, datasetKey } = CARD_COLLECTIONS[collection];
  const pending = state.pendingInteractions[collection];
  const reorder = pending.reorder;
  if (!reorder) {
    return;
  }

  pending.reorder = null;

  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const cards = Array.from(document.querySelectorAll(selector));

  cards.forEach((card) => {
    const previous = reorder.positionsById.get(card.dataset[datasetKey]);
    if (!previous || !card.animate) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const deltaX = previous.left - rect.left;
    const deltaY = previous.top - rect.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
      return;
    }

    card.animate(
      buildReorderKeyframes(
        card,
        deltaX,
        deltaY,
        card.dataset[datasetKey] === reorder.movedItemId,
      ),
      {
        duration: 210,
        easing: "cubic-bezier(0.22, 0.9, 0.26, 1)",
      },
    );
  });
}

async function playPendingInsertEffects(collection) {
  const { selector, datasetKey } = CARD_COLLECTIONS[collection];
  const pendingInteraction = state.pendingInteractions[collection];
  const pending = pendingInteraction.insert;
  if (!pending) {
    return false;
  }

  pendingInteraction.insert = null;

  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const target = Array.from(document.querySelectorAll(selector)).find(
    (element) => element.dataset[datasetKey] === pending.itemId,
  );
  if (!target) {
    return false;
  }

  revealElementBelowStickyHeader(target, "smooth");

  if (target.animate) {
    target.animate(buildInsertKeyframes(target), {
      duration: 480,
      easing: "cubic-bezier(0.22, 0.9, 0.26, 1)",
    });
  }

  const focusedField = restorePendingFieldFocus();
  if (
    focusedField instanceof HTMLInputElement &&
    focusedField.classList.contains("card-title-input")
  ) {
    syncCardTitleInputWidth(focusedField, focusedField.placeholder);
  }

  return Boolean(focusedField);
}

function renderGlobalOptions(root) {
  const panel = createPanel(
    "Global Options",
    "Shortcuts and headers that apply everywhere.",
  );
  panel.classList.add("special-panel", "global-options-panel");

  const textarea = createTextarea(
    Shared.headersToMultilineText(state.config.globalHeaders),
    5,
  );
  textarea.placeholder = HEADER_TEXTAREA_PLACEHOLDER;
  const headersBlock = createContainerHeadersBlock({
    titleText: "Global headers",
    textarea,
    headersHelpText: "These headers are sent on every request from every container.",
    showPwnFoxToggle: false,
  });

  const layout = document.createElement("div");
  layout.className = "config-grid global-options-grid";

  const shortcutColumns = [
    [
      {
        label: "Open a new tab on the current container",
        commandName: Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND,
        helpText:
          "Open a blank tab next to the current one, reusing the active tab container.",
      },
      {
        label: "Go one tab to the left",
        commandName: Shared.GO_ONE_TAB_LEFT_COMMAND,
        helpText: "Activate the previous tab in the current window and wrap at the edge.",
      },
      {
        label: "Go one tab to the right",
        commandName: Shared.GO_ONE_TAB_RIGHT_COMMAND,
        helpText: "Activate the next tab in the current window and wrap at the edge.",
      },
    ],
    [
      {
        label: "Pin/Unpin tab",
        commandName: Shared.TOGGLE_TAB_PINNED_COMMAND,
        helpText: "Toggle pinning for the active tab in the current window.",
      },
      {
        label: "Move tab right",
        commandName: Shared.MOVE_TAB_RIGHT_COMMAND,
        helpText:
          "Move the active tab one position right within its pinned or unpinned group.",
      },
      {
        label: "Move tab left",
        commandName: Shared.MOVE_TAB_LEFT_COMMAND,
        helpText:
          "Move the active tab one position left within its pinned or unpinned group.",
      },
    ],
  ];

  shortcutColumns.forEach((entries, index) => {
    const column = document.createElement("div");
    column.className = "config-column global-options-column global-options-shortcuts-column";
    const shortcutGroup = createIntrinsicStackGroup("shortcut-list");
    entries.forEach((entry) => {
      shortcutGroup.appendChild(
        createShortcutEntry(entry.label, entry.commandName, entry.helpText),
      );
    });
    column.appendChild(shortcutGroup);
    layout.appendChild(column);
  });

  const headersColumn = document.createElement("div");
  headersColumn.className =
    "config-column config-side global-options-column global-options-headers-column";
  const sidePanel = document.createElement("div");
  sidePanel.className = "container-side-panel global-options-side-panel";
  sidePanel.appendChild(headersBlock.root);
  headersColumn.appendChild(sidePanel);
  layout.appendChild(headersColumn);

  panel.appendChild(layout);

  const error = createNote("", "inline-error");
  error.hidden = true;
  panel.appendChild(error);

  bindHeaderTextarea(
    textarea,
    () => state.config.globalHeaders,
    (headers) => {
      state.config.globalHeaders = headers;
    },
    error,
    "global-header",
  );

  root.appendChild(panel);
}

function formatHeaderErrors(errors) {
  const lastError = Array.isArray(errors) ? errors[errors.length - 1] : null;
  if (!lastError) {
    return "";
  }

  return `Line ${lastError.line}: ${lastError.message}`;
}

function bindHeaderTextarea(
  textarea,
  currentHeaders,
  applyHeaders,
  errorNode,
  prefix,
  onLayoutChange,
) {
  textarea.oninput = () => {
    const result = Shared.parseHeaderLines(textarea.value, currentHeaders(), prefix);

    if (!result.valid) {
      errorNode.textContent = formatHeaderErrors(result.errors);
      errorNode.hidden = false;
      if (typeof onLayoutChange === "function") {
        onLayoutChange();
      }
      return;
    }

    errorNode.hidden = true;
    errorNode.textContent = "";
    if (typeof onLayoutChange === "function") {
      onLayoutChange();
    }
    applyHeaders(result.headers);
    scheduleConfigSave(400, "Headers saved.");
  };
}

function getColorCode(color) {
  return (
    state.colorChoices.find((entry) => entry.color === color)?.colorCode || "#9aa4b2"
  );
}

function appendContainerShortcutControls(slotEntry, group, root) {
  if (!slotEntry.supportsShortcuts) {
    root.appendChild(
      createNote(
        "Per-container keyboard shortcuts are available for the first 30 container shortcuts only.",
      ),
    );
    return;
  }

  group.appendChild(
    createShortcutEntry(
      "Open a new tab on this container",
      Shared.getOpenContainerSlotCommandName(slotEntry.slot),
      "Opens a blank tab next to the active tab and assigns this container.",
    ),
  );
  group.appendChild(
    createShortcutEntry(
      "Reopen current tab on this container",
      Shared.getReopenContainerSlotCommandName(slotEntry.slot),
      "Reopens web pages and blank tabs in this container. Other URLs stay in Firefox's default container.",
    ),
  );
}

function createContainerCard(
  slotEntry,
  index,
  totalCustomContainers,
  ambiguousContainerIds,
) {
  const isDefault = slotEntry.isDefault;
  const appearanceEditable = isContainerAppearanceEditable(slotEntry);
  const setting = Shared.getContainerSetting(state.config, slotEntry.cookieStoreId);
  const proxyAssignment = Shared.resolveProxyAssignment(
    state.config,
    slotEntry.cookieStoreId,
  );
  const isAmbiguous = ambiguousContainerIds.has(slotEntry.cookieStoreId);
  const card = document.createElement("article");
  card.className = "editor-card container-card";
  card.dataset.cookieStoreId = slotEntry.cookieStoreId;

  const header = document.createElement("div");
  header.className = "card-top";

  const main = createCardHeaderMain("card-header-main-fill");
  const identityVisual = document.createElement("div");
  identityVisual.className = "identity-visual";
  const identityToken = document.createElement("span");
  identityToken.className = appearanceEditable
    ? "identity-token card-top-actionable card-top-persistent-active"
    : "identity-token";
  let identityTrigger = null;

  if (appearanceEditable) {
    identityTrigger = document.createElement("button");
    identityTrigger.type = "button";
    identityTrigger.className = "identity-trigger";
    identityTrigger.title = "Edit container appearance";
    identityTrigger.setAttribute(
      "aria-label",
      `Edit appearance for ${slotEntry.name}`,
    );
    identityTrigger.setAttribute("aria-haspopup", "dialog");
    identityTrigger.setAttribute("aria-expanded", "false");
    identityTrigger.appendChild(identityToken);
    identityVisual.appendChild(identityTrigger);
  } else {
    identityVisual.appendChild(identityToken);
  }
  main.appendChild(identityVisual);

  const titleRow = createCardHeaderTitleRow();
  const nameInput = createCardTitleInput(slotEntry.name, "Container name", {
    focusId: isDefault ? "" : `container-name:${slotEntry.cookieStoreId}`,
    autoWidthMin: CARD_TITLE_MIN_WIDTH,
    persistentActive: appearanceEditable,
    disabled: isDefault,
  });
  titleRow.appendChild(nameInput);
  main.appendChild(titleRow);
  header.appendChild(main);

  const headerActions = createCardHeaderActions();

  if (isDefault) {
    const badge = document.createElement("span");
    badge.className = "identity-badge";
    badge.textContent = "Default container";
    headerActions.appendChild(badge);
  }

  if (isAmbiguous) {
    const badge = document.createElement("span");
    badge.className = "identity-badge duplicate-name-badge";
    badge.textContent = "Duplicate name";
    badge.title = `Firefox container ID: ${Shared.getContainerTechnicalLabel(
      slotEntry.cookieStoreId,
    )}`;
    headerActions.appendChild(badge);
  }

  headerActions.appendChild(createCardKindBadge("Container"));
  if (proxyAssignment.status === "invalid-reference") {
    headerActions.appendChild(createStatusBadge("Proxy blocked", "invalid"));
  }

  if (!isDefault) {
    appendCollectionMoveActions(headerActions, {
      index,
      totalItems: totalCustomContainers,
      onMove: (direction, event) =>
        moveContainerCard({ slotEntry, index, direction, card, event }),
    });

    headerActions.appendChild(
      createIconButton("Delete container", TRASH_ICON_SVG, async () => {
        const hostRuleDependents = Shared.getDependentHostRuleNames(
          state.config,
          slotEntry.cookieStoreId,
        );
        if (hostRuleDependents.length) {
          throw new Error(
            `Cannot delete "${slotEntry.name}" yet. Remove it from these Host Rules first: ${hostRuleDependents.join(", ")}`,
          );
        }

        if (!window.confirm(`Delete container "${slotEntry.name}"?`)) {
          return;
        }

        await cancelPendingIdentitySave(slotEntry.cookieStoreId);
        await flushConfigSave();
        await browser.contextualIdentities.remove(slotEntry.cookieStoreId);
        await refreshState();
        renderShell();
        await renderActiveTabContent();
        setStatus("Container deleted.", false);
      }, "icon-button danger-icon-button"),
    );
  }

  header.appendChild(headerActions);

  card.appendChild(header);

  const proxyPicker = createContainerProxyPicker(setting.proxyId, (nextProxyId) => {
    const nextSetting = ensureContainerSetting(slotEntry.cookieStoreId);
    nextSetting.proxyId = nextProxyId;
    pruneContainerSetting(slotEntry.cookieStoreId);
    scheduleConfigSave(0, "Container saved.");
  });
  const headersTextarea = createTextarea(
    Shared.headersToMultilineText(setting.headers),
    4,
  );
  headersTextarea.placeholder = HEADER_TEXTAREA_PLACEHOLDER;
  const pwnFoxToggle = createCheckbox(setting.pwnFoxColorEnabled);
  pwnFoxToggle.disabled = isDefault;
  let selectedIcon = slotEntry.icon || state.iconChoices[0]?.icon || "";
  let selectedColor = slotEntry.color || state.colorChoices[0]?.color || "";
  let headersBlock = null;
  const identityPopoverController = appearanceEditable
    ? createContainerIdentityPopover(
        selectedIcon,
        selectedColor,
        (value) => {
          selectedColor = value;
          updateIdentityPreview();
          saveIdentity(0);
        },
        (value) => {
          selectedIcon = value;
          updateIdentityPreview();
          saveIdentity(0);
        },
      )
    : null;

  if (identityPopoverController) {
    identityVisual.appendChild(identityPopoverController.root);
  }

  function updateIdentityPreview() {
    setIconGlyph(identityToken, selectedIcon || slotEntry.icon || "default");
    identityToken.style.color = isDefault
      ? "var(--accent-strong)"
      : getColorCode(selectedColor);
    identityPopoverController?.syncSelection(selectedIcon, selectedColor);
    headersBlock?.sync();
  }

  if (identityPopoverController && identityTrigger) {
    identityTrigger.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleContainerIdentityPopover(slotEntry.cookieStoreId);
    };

    if (state.openContainerIdentityPopoverCookieStoreId === slotEntry.cookieStoreId) {
      syncContainerIdentityPopoverDomState(
        {
          card,
          main,
          trigger: identityTrigger,
          popover: identityPopoverController.root,
        },
        true,
      );
    }
  }

  const configGrid = document.createElement("div");
  configGrid.className = "config-grid container-config-grid";

  const leftColumn = document.createElement("div");
  leftColumn.className = "config-column config-main container-config-main";

  const rightColumn = document.createElement("div");
  rightColumn.className = "config-column config-side container-config-headers";

  const leftStack = document.createElement("div");
  leftStack.className = "container-field-stack compact-field-stack";

  const proxyShortcutGroup = createIntrinsicStackGroup(
    "container-proxy-shortcut-group shortcut-list",
  );
  proxyShortcutGroup.appendChild(proxyPicker.root);
  leftStack.appendChild(proxyShortcutGroup);
  appendContainerShortcutControls(slotEntry, proxyShortcutGroup, leftStack);

  if (proxyAssignment.status === "invalid-reference") {
    leftStack.appendChild(createStatusNote(proxyAssignment.reason, "invalid", false));
  }
  leftColumn.appendChild(leftStack);

  const sidePanel = document.createElement("div");
  sidePanel.className = "container-side-panel";

  headersBlock = createContainerHeadersBlock({
    textarea: headersTextarea,
    headersHelpText:
      "These headers are added on requests sent from this container.",
    pwnFoxCheckbox: pwnFoxToggle,
    pwnFoxHelpText:
      "Add the PwnFox-compatible X-PwnFox-Color header using the selected container color.",
    showPwnFoxToggle: !isDefault,
    getPwnFoxColorLabel: () => selectedColor || slotEntry.color || "default",
  });
  sidePanel.appendChild(headersBlock.root);

  rightColumn.appendChild(sidePanel);

  configGrid.appendChild(leftColumn);
  configGrid.appendChild(rightColumn);
  card.appendChild(configGrid);

  const identityError = createNote("", "inline-error");
  identityError.hidden = true;
  leftColumn.appendChild(identityError);

  const headersError = createNote("", "inline-error");
  headersError.hidden = true;
  sidePanel.appendChild(headersError);

  function saveIdentity(delay) {
    const normalizedName = Shared.normalizeContainerName(nameInput.value);
    if (!normalizedName) {
      identityError.textContent = "Container name is required.";
      identityError.hidden = false;
      return;
    }

    const conflict = findContainerNameConflict(normalizedName, slotEntry.cookieStoreId);
    if (conflict && !canKeepContainerVisibleName(slotEntry.cookieStoreId, normalizedName)) {
      identityError.textContent = `Container name already used by "${conflict.name}".`;
      identityError.hidden = false;
      return;
    }

    identityError.hidden = true;
    identityError.textContent = "";
    slotEntry.name = normalizedName;
    slotEntry.icon = selectedIcon;
    slotEntry.color = selectedColor;
    updateIdentityPreview();

    scheduleContainerIdentitySave(
      slotEntry.cookieStoreId,
      {
        name: normalizedName,
        icon: selectedIcon,
        color: selectedColor,
      },
      delay,
    );
  }

  if (!isDefault) {
    nameInput.oninput = () => {
      syncCardTitleInputWidth(nameInput, nameInput.placeholder);
      saveIdentity(500);
    };
  }

  bindHeaderTextarea(
    headersTextarea,
    () => Shared.getContainerSetting(state.config, slotEntry.cookieStoreId).headers,
    (headers) => {
      const nextSetting = ensureContainerSetting(slotEntry.cookieStoreId);
      nextSetting.headers = headers;
      pruneContainerSetting(slotEntry.cookieStoreId);
    },
    headersError,
    `container-${slotEntry.cookieStoreId}-header`,
  );

  pwnFoxToggle.onchange = () => {
    const nextSetting = ensureContainerSetting(slotEntry.cookieStoreId);
    nextSetting.pwnFoxColorEnabled = pwnFoxToggle.checked;
    pruneContainerSetting(slotEntry.cookieStoreId);
    scheduleConfigSave(0, "Container saved.");
  };

  window.requestAnimationFrame(() => {
    if (nameInput.isConnected) {
      syncCardTitleInputWidth(nameInput, nameInput.placeholder || slotEntry.name);
    }
  });

  updateIdentityPreview();
  return card;
}

function renderContainersList(root, containerIntegrity) {
  const slots = Shared.getContainerSlots(state.containers);
  const ambiguousContainerIds = new Set(containerIntegrity.ambiguousContainerIds);

  root.appendChild(
    createContainerCard(
      slots[0],
      0,
      state.containers.length,
      ambiguousContainerIds,
    ),
  );

  state.containers.forEach((container, index) => {
    root.appendChild(
      createContainerCard(
        slots[index + 1],
        index,
        state.containers.length,
        ambiguousContainerIds,
      ),
    );
  });
}

function renderContainersTab(root, containerIntegrity) {
  renderGlobalOptions(root);
  if (containerIntegrity.duplicateNameGroups.length) {
    root.appendChild(
      createContainerIntegrityAlert(
        "Duplicate container names",
        `${containerIntegrity.duplicateNameGroups.length} live Firefox name collision${containerIntegrity.duplicateNameGroups.length > 1 ? "s were" : " was"} detected. The add-on keeps using stable container IDs internally.`,
        containerIntegrity.duplicateNameGroups.map(
          (group) =>
            `${group.name}: ${group.count} live Firefox containers currently share this name.`,
        ),
      ),
    );
  }

  renderContainersList(root, containerIntegrity);
}

function createProxyDependencyNote(proxyId, containerIntegrity) {
  const ambiguousContainerIds = new Set(containerIntegrity.ambiguousContainerIds);
  const dependents = Shared.getContainerSlots(state.containers)
    .filter(
      (slotEntry) =>
        Shared.getAssignedProxyId(state.config, slotEntry.cookieStoreId) === proxyId,
    )
    .map((slotEntry) => ({
      cookieStoreId: slotEntry.cookieStoreId,
      name: slotEntry.name,
      color: slotEntry.color,
      icon: slotEntry.icon,
      iconUrl: slotEntry.iconUrl,
      ambiguous: ambiguousContainerIds.has(slotEntry.cookieStoreId),
      technicalLabel: Shared.getContainerTechnicalLabel(slotEntry.cookieStoreId),
    }));

  if (!dependents.length) {
    return {
      inUse: false,
      message: "Not assigned to any container",
      containers: [],
    };
  }

  const count = dependents.length;
  return {
    inUse: true,
    message: `Currently used by ${count} container${count > 1 ? "s" : ""}`,
    containers: dependents,
  };
}

function createProxyCard(proxy, index, totalProxies, containerIntegrity) {
  let draft = {
    id: proxy.id,
    title: proxy.title,
    type: proxy.type,
    host: proxy.host,
    port: String(proxy.port || ""),
    username: proxy.username,
    password: proxy.password,
    proxyDNS: proxy.proxyDNS,
    doNotProxyLocal: proxy.doNotProxyLocal,
    bypass: Shared.getProxyBypass(proxy),
  };

  const card = document.createElement("article");
  card.className = "editor-card proxy-card";
  card.dataset.proxyId = proxy.id;

  const header = document.createElement("div");
  header.className = "card-top";

  const main = createCardHeaderMain();
  const titleRow = createCardHeaderTitleRow();
  const titleInput = createCardTitleInput(
    draft.title,
    Shared.getProxyDisplayName(proxy),
    {
      focusId: `proxy-title:${proxy.id}`,
      autoWidthMin: CARD_TITLE_MIN_WIDTH,
    },
  );
  titleRow.appendChild(titleInput);
  main.appendChild(titleRow);
  header.appendChild(main);
  const typeSelect = createSelect(
    [
      { value: "http", label: "HTTP" },
      { value: "https", label: "HTTPS" },
      { value: "socks", label: "SOCKS5" },
      { value: "socks4", label: "SOCKS4" },
    ],
    draft.type,
  );
  const hostInput = createInput(draft.host, "127.0.0.1");
  const portInput = createInput(draft.port, "8080");
  const usernameInput = createInput(draft.username, "Username");
  const passwordField = createPasswordField(draft.password, "Password");
  const passwordInput = passwordField.input;
  const proxyDnsInput = createCheckbox(draft.proxyDNS);
  const localBypassInput = createCheckbox(draft.doNotProxyLocal);
  const optionsBypassInput = createCheckbox(draft.bypass.optionsMethod);
  const customHostsEnabledInput = createCheckbox(draft.bypass.customHostsEnabled);
  const customHostsTextarea = createTextarea(draft.bypass.customHosts.join("\n"), 6);
  customHostsTextarea.placeholder = "One hostname per line";

  const dependencyNote = createProxyDependencyNote(proxy.id, containerIntegrity);
  const headerActions = createCardHeaderActions();
  const dependencyTitle = dependencyNote.message;
  headerActions.appendChild(createCardKindBadge("Proxy"));
  const statusBadgeSlot = document.createElement("span");
  headerActions.appendChild(statusBadgeSlot);

  appendCollectionMoveActions(headerActions, {
    index,
    totalItems: totalProxies,
    onMove: (direction, event) =>
      moveConfigCollectionItem({
        collection: "proxies",
        itemId: proxy.id,
        direction,
        card,
        event,
        message: "Proxy moved.",
      }),
  });

  const deleteButton = createIconButton(
    "Delete proxy",
    TRASH_ICON_SVG,
    async () => {
      if (!window.confirm(`Delete proxy "${Shared.getProxyDisplayName(proxy)}"?`)) {
        return;
      }
      await commitConfigCollectionMutation({
        nextConfig: Shared.cleanupRemovedProxy(state.config, proxy.id),
        message: "Proxy deleted.",
        renderShellAfter: true,
      });
    },
    "icon-button danger-icon-button",
  );
  deleteButton.title = dependencyTitle;
  deleteButton.setAttribute("aria-label", dependencyTitle);
  deleteButton.disabled = dependencyNote.inUse;
  headerActions.appendChild(deleteButton);

  const usageInfo = createCardTopInfo({
    tone: dependencyNote.inUse ? "" : "muted",
    wrap: false,
  });
  usageInfo.message.textContent = dependencyNote.message;

  if (dependencyNote.containers.length) {
    const usageTags = document.createElement("div");
    usageTags.className = "card-top-info-tags";
    dependencyNote.containers.forEach((container) => {
      usageTags.appendChild(
        createContainerReferenceTag({
          name: container.name,
          cookieStoreId: container.cookieStoreId,
          color: container.color,
          icon: container.icon,
          iconUrl: container.iconUrl,
          ambiguous: container.ambiguous,
          technicalLabel: container.technicalLabel,
          className: "card-top-info-tag",
        }),
      );
    });
    usageInfo.root.appendChild(usageTags);
  }

  header.appendChild(usageInfo.root);
  header.appendChild(headerActions);
  card.appendChild(header);

  window.requestAnimationFrame(() => {
    if (!titleInput.isConnected) {
      return;
    }

    syncCardTitleInputWidth(
      titleInput,
      titleInput.placeholder || Shared.getProxyDisplayName(proxy),
    );
  });

  const configGrid = document.createElement("div");
  configGrid.className = "config-grid proxy-config-grid";

  const mainColumn = document.createElement("div");
  mainColumn.className = "config-column config-main proxy-config-main";
  mainColumn.appendChild(
    createCompactInlineField(
      "Type",
      typeSelect,
      "HTTP and HTTPS proxies support credentials. SOCKS5 supports Proxy DNS.",
    ),
  );
  mainColumn.appendChild(
    createProxyDualRow(
      createCompactInlineField(
        "Host",
        hostInput,
        "Hostname or IP address of the proxy server.",
      ),
      createCompactInlineField(
        "Port",
        portInput,
        "TCP port of the proxy server.",
      ),
    ),
  );
  mainColumn.appendChild(
    createProxyDualRow(
      createCompactInlineField(
        "Username",
        usernameInput,
        "Used only for HTTP and HTTPS proxy authentication (optional).",
      ),
      createCompactInlineField(
        "Password",
        passwordField.root,
        "Stored locally in Firefox and used only for HTTP and HTTPS proxy authentication (optional).",
      ),
    ),
  );

  const sideColumn = document.createElement("div");
  sideColumn.className = "config-column config-side proxy-config-side";

  const toggleList = document.createElement("div");
  toggleList.className = "proxy-toggle-list";
  const proxyDnsToggle = createToggleOption(
    "Proxy DNS",
    proxyDnsInput,
    "When enabled on SOCKS5, DNS lookups are sent through the proxy.",
  );
  proxyDnsToggle.classList.add("proxy-compact-toggle");
  toggleList.appendChild(proxyDnsToggle);
  const localBypassToggle = createToggleOption(
    "Bypass localhost and loopback",
    localBypassInput,
    "When enabled, requests to localhost, *.localhost, 127.0.0.0/8 and ::1 stay direct.",
  );
  localBypassToggle.classList.add("proxy-compact-toggle");
  toggleList.appendChild(localBypassToggle);
  const optionsBypassToggle = createToggleOption(
    "Bypass OPTIONS requests",
    optionsBypassInput,
    "Skips this proxy for every HTTP OPTIONS request. Useful when preflight traffic must stay direct.",
  );
  optionsBypassToggle.classList.add("proxy-compact-toggle");
  toggleList.appendChild(optionsBypassToggle);
  mainColumn.appendChild(toggleList);

  const bypassBlock = createProxyBypassBlock(
    customHostsEnabledInput,
    customHostsTextarea,
    "One hostname per line. New proxies start with telemetry hosts here, but you can edit it as you wish.",
  );
  sideColumn.appendChild(bypassBlock.root);

  configGrid.appendChild(mainColumn);
  configGrid.appendChild(sideColumn);
  card.appendChild(configGrid);

  const error = createNote("", "inline-error");
  error.hidden = true;
  card.appendChild(error);

  const statusNote = createStatusNote("", "draft");
  card.appendChild(statusNote);

  function syncProxyStatus(proxyValue) {
    const proxyStatus = Shared.getProxyStatus(proxyValue);
    syncStatusBadgeSlot(
      statusBadgeSlot,
      "Draft",
      "draft",
      !proxyStatus.isActivable,
    );
    if (!proxyStatus.isActivable) {
      const blockedCount = dependencyNote.containers.length;
      const impact =
        blockedCount > 0
          ? ` ${blockedCount} assigned container${blockedCount > 1 ? "s are" : " is"} blocked until this proxy is completed or removed.`
          : "";
      syncStatusNote(
        statusNote,
        "draft",
        `${proxyStatus.reason}${impact}`,
        false,
      );
    } else {
      syncStatusNote(statusNote, "draft", "", true);
    }
  }

  function syncProxyFields(previousType) {
    const isSocks = Shared.isSocksProxyType(typeSelect.value);
    const isSocks4 = typeSelect.value === "socks4";
    const switchedToSocks5 =
      typeSelect.value === "socks" && !Shared.isSocksProxyType(previousType);

    if (isSocks) {
      draft.username = "";
      draft.password = "";
      usernameInput.value = "";
      passwordInput.value = "";
    }

    if (isSocks4) {
      draft.proxyDNS = false;
      proxyDnsInput.checked = false;
    } else if (switchedToSocks5) {
      draft.proxyDNS = true;
      proxyDnsInput.checked = true;
    } else if (typeSelect.value !== "socks") {
      draft.proxyDNS = false;
      proxyDnsInput.checked = false;
    }

    proxyDnsInput.disabled = typeSelect.value !== "socks";
    usernameInput.disabled = isSocks;
    passwordInput.disabled = isSocks;
    passwordField.setDisabled(isSocks);
    passwordField.resetVisibility();
    proxyDnsToggle.classList.toggle("disabled", proxyDnsInput.disabled);
  }

  function applyDraft(delay) {
    const titleConflict = findProxyTitleConflict(draft.title, draft.id);
    if (titleConflict) {
      error.hidden = false;
      error.textContent = `Proxy title already used by "${Shared.getProxyDisplayName(titleConflict)}".`;
      return;
    }

    const nextProxy = Shared.normalizeProxy({
      id: draft.id,
      title: draft.title,
      type: draft.type,
      host: draft.host,
      port: draft.port,
      username: draft.username,
      password: draft.password,
      proxyDNS: draft.proxyDNS,
      doNotProxyLocal: draft.doNotProxyLocal,
      bypass: {
        optionsMethod: draft.bypass.optionsMethod,
        customHostsEnabled: draft.bypass.customHostsEnabled,
        customHosts: Shared.uniqueSortedHosts(
          draft.bypass.customHosts,
          [],
        ),
      },
    });

    error.hidden = true;
    error.textContent = "";
    titleInput.placeholder = Shared.getProxyDisplayName(nextProxy);
    syncCardTitleInputWidth(
      titleInput,
      Shared.getProxyDisplayName(nextProxy),
    );
    syncProxyStatus(nextProxy);
    const proxyIndex = state.config.proxies.findIndex(
      (entry) => entry.id === proxy.id,
    );
    if (proxyIndex !== -1) {
      state.config.proxies[proxyIndex] = nextProxy;
    }
    scheduleConfigSave(delay, "Proxy saved.");
  }

  titleInput.oninput = () => {
    draft.title = titleInput.value;
    syncCardTitleInputWidth(titleInput, titleInput.placeholder);
    applyDraft(250);
  };
  hostInput.oninput = () => {
    draft.host = hostInput.value;
    applyDraft(250);
  };
  portInput.oninput = () => {
    draft.port = portInput.value;
    applyDraft(250);
  };
  usernameInput.oninput = () => {
    draft.username = usernameInput.value;
    applyDraft(250);
  };
  passwordInput.oninput = () => {
    draft.password = passwordInput.value;
    applyDraft(250);
  };
  proxyDnsInput.onchange = () => {
    draft.proxyDNS = proxyDnsInput.checked;
    applyDraft(0);
  };
  localBypassInput.onchange = () => {
    draft.doNotProxyLocal = localBypassInput.checked;
    applyDraft(0);
  };
  optionsBypassInput.onchange = () => {
    draft.bypass.optionsMethod = optionsBypassInput.checked;
    applyDraft(0);
  };
  customHostsEnabledInput.onchange = () => {
    draft.bypass.customHostsEnabled = customHostsEnabledInput.checked;
    applyDraft(0);
  };
  customHostsTextarea.oninput = () => {
    draft.bypass.customHosts = Shared.uniqueSortedHosts(
      customHostsTextarea.value.split(/\r?\n/),
      [],
    );
    applyDraft(400);
  };
  typeSelect.onchange = () => {
    const previousType = draft.type;
    draft.type = typeSelect.value;
    syncProxyFields(previousType);
    applyDraft(0);
  };

  syncProxyFields(draft.type);
  syncProxyStatus(proxy);
  return card;
}

function renderProxiesTab(root, containerIntegrity) {
  const intro = createNote(
    "Create reusable proxies here. Each proxy can then be assigned to multiple containers from the Containers tab.",
    "tab-intro",
  );
  root.appendChild(intro);

  if (containerIntegrity.duplicateNameGroups.length) {
    root.appendChild(
      createContainerIntegrityAlert(
        "Container name collisions",
        "Some live Firefox containers currently share the same visible name. Proxy assignments stay correct because the add-on still resolves them by stable container ID.",
        containerIntegrity.duplicateNameGroups.map(
          (group) =>
            `${group.name}: ${group.count} live Firefox containers currently share this name.`,
        ),
      ),
    );
  }

  if (!state.config.proxies.length) {
    root.appendChild(
      createEmptyState(
        "No proxies yet",
        "Create a reusable route here, then assign it to any container when you need it.",
      ),
    );
  } else {
    state.config.proxies.forEach((proxy, index) => {
      root.appendChild(
        createProxyCard(
          proxy,
          index,
          state.config.proxies.length,
          containerIntegrity,
        ),
      );
    });
  }
}

function getHostRuleContainerChoices(containerIntegrity) {
  const ambiguousContainerIds = new Set(containerIntegrity.ambiguousContainerIds);
  return Shared.getContainerSlots(state.containers).map((slotEntry) => ({
    cookieStoreId: slotEntry.cookieStoreId,
    name: slotEntry.name,
    color: slotEntry.color,
    icon: slotEntry.icon,
    iconUrl: slotEntry.iconUrl,
    isDefault: slotEntry.isDefault,
    ambiguous: ambiguousContainerIds.has(slotEntry.cookieStoreId),
    technicalLabel: Shared.getContainerTechnicalLabel(slotEntry.cookieStoreId),
  }));
}

function createHostRuleCard(
  rule,
  index,
  totalRules,
  overlapIds,
  missingRefsByRuleId,
  ambiguousContainerIds,
  containerChoices,
  containerChoiceById,
) {
  const card = document.createElement("article");
  card.className = "editor-card host-rule-card";
  card.dataset.hostRuleId = rule.id;

  const header = document.createElement("div");
  header.className = "card-top";

  const main = createCardHeaderMain();
  const titleRow = createCardHeaderTitleRow();
  const nameInput = createCardTitleInput(rule.name, "Customer Portal", {
    focusId: `host-rule-name:${rule.id}`,
    autoWidthMin: CARD_TITLE_MIN_WIDTH,
  });
  titleRow.appendChild(nameInput);
  main.appendChild(titleRow);
  header.appendChild(main);

  const summary = createCardTopInfo();
  const summaryMessage = summary.message;
  const summaryPrefix = document.createElement("span");
  const summaryAction = document.createElement("span");
  summaryAction.className = "card-top-info-action";
  const summarySuffix = document.createElement("span");
  summaryMessage.appendChild(summaryPrefix);
  summaryMessage.appendChild(summaryAction);
  summaryMessage.appendChild(summarySuffix);
  header.appendChild(summary.root);

  const headerActions = createCardHeaderActions();

  const enabledToggle = createCheckbox(rule.enabled);
  enabledToggle.className = "switch-toggle-input";
  const enabledTrack = document.createElement("span");
  enabledTrack.className = "switch-toggle-track";
  const enabledText = document.createElement("span");
  enabledText.className = "switch-toggle-text";
  const enabledToggleLabel = createToggleControl(enabledToggle, {
    className: "switch-toggle card-top-actionable",
    content: [enabledTrack, enabledText],
  });
  headerActions.appendChild(createCardKindBadge("Host Rule"));
  const statusBadgeSlot = document.createElement("span");
  headerActions.appendChild(statusBadgeSlot);
  headerActions.appendChild(enabledToggleLabel);

  appendCollectionMoveActions(headerActions, {
    index,
    totalItems: totalRules,
    onMove: (direction, event) =>
      moveConfigCollectionItem({
        collection: "hostRules",
        itemId: rule.id,
        direction,
        card,
        event,
        message: "Host Rule moved.",
      }),
  });

  headerActions.appendChild(
    createIconButton(
      "Delete Host Rule",
      TRASH_ICON_SVG,
      async () => {
        if (!window.confirm(`Delete Host Rule "${rule.name}"?`)) {
          return;
        }
        await commitConfigCollectionMutation({
          nextConfig: {
            ...state.config,
            hostRules: state.config.hostRules.filter((entry) => entry.id !== rule.id),
          },
          message: "Host Rule deleted.",
          renderShellAfter: true,
        });
      },
      "icon-button danger-icon-button",
    ),
  );

  header.appendChild(headerActions);
  card.appendChild(header);

  window.requestAnimationFrame(() => {
    if (!nameInput.isConnected) {
      return;
    }

    syncCardTitleInputWidth(
      nameInput,
      nameInput.placeholder || rule.name,
    );
  });

  const body = document.createElement("div");
  body.className = "host-rule-card-body";

  const configGrid = document.createElement("div");
  configGrid.className = "config-grid host-rule-config-grid";

  const controlsColumn = document.createElement("div");
  controlsColumn.className = "config-column host-rule-card-column";

  const patternsColumn = document.createElement("div");
  patternsColumn.className = "config-column host-rule-card-column";

  const modeSegment = document.createElement("div");
  modeSegment.className = "host-rule-mode-segment";

  const blacklistButton = document.createElement("button");
  blacklistButton.type = "button";
  blacklistButton.textContent = "Block by default";

  const whitelistButton = document.createElement("button");
  whitelistButton.type = "button";
  whitelistButton.textContent = "Allow by default";

  modeSegment.appendChild(blacklistButton);
  modeSegment.appendChild(whitelistButton);
  controlsColumn.appendChild(createField("Default action", modeSegment));

  const patternsTextarea = createTextarea(rule.patterns.join("\n"), 5);
  patternsTextarea.placeholder = HOST_RULE_PATTERNS_PLACEHOLDER;
  const patternsField = createField(
    "Host patterns",
    patternsTextarea,
    "One hostname-only glob per line. Matching is case-insensitive and only applies to the request hostname.",
  );
  patternsField.classList.add("textarea-field", "host-rule-patterns-field");
  patternsColumn.appendChild(patternsField);

  const exceptionsSection = document.createElement("div");
  exceptionsSection.className = "host-rule-exceptions";

  const exceptionPicker = document.createElement("div");
  exceptionPicker.className = "picker-shell";

  const exceptionControl = document.createElement("div");
  exceptionControl.className = "picker-token-control";

  const exceptionFilterInput = createInput("", "Add container exceptions...");
  exceptionFilterInput.className = "picker-search-input picker-token-input";
  exceptionFilterInput.autocomplete = "off";
  exceptionFilterInput.spellcheck = false;
  exceptionFilterInput.setAttribute("aria-label", "Add container exceptions");

  const exceptionMenu = document.createElement("div");
  exceptionMenu.className = "picker-popover";
  const exceptionOptionList = document.createElement("div");
  exceptionOptionList.className = "picker-option-list";

  exceptionControl.appendChild(exceptionFilterInput);
  exceptionPicker.appendChild(exceptionControl);
  exceptionMenu.appendChild(exceptionOptionList);
  exceptionPicker.appendChild(exceptionMenu);
  exceptionsSection.appendChild(exceptionPicker);

  controlsColumn.appendChild(
    createField(
      "Exceptions",
      exceptionsSection,
      "Exceptions invert the default action for the selected containers.",
    ),
  );

  configGrid.appendChild(controlsColumn);
  configGrid.appendChild(patternsColumn);
  body.appendChild(configGrid);

  const error = createNote("", "inline-error");
  error.hidden = true;
  body.appendChild(error);

  const statusNote = createStatusNote("", "draft");
  body.appendChild(statusNote);

  card.appendChild(body);

  let draft = Shared.clone(rule);
  let selectedExceptionId = "";
  let exceptionMenuOpen = false;

  function handleExceptionPickerPointerDown(event) {
    if (!exceptionPicker.contains(event.target)) {
      setExceptionMenuOpen(false);
    }
  }

  function focusExceptionInput() {
    if (enabledToggle.checked) {
      exceptionFilterInput.focus();
    }
  }

  function getCurrentMissingExceptionIds() {
    return draft.exceptions.filter(
      (cookieStoreId) => !containerChoiceById.has(cookieStoreId),
    );
  }

  function getCurrentAmbiguousExceptionIds() {
    return draft.exceptions.filter((cookieStoreId) =>
      ambiguousContainerIds.has(cookieStoreId),
    );
  }

  function getAvailableExceptionChoices() {
    const filterNeedle = exceptionFilterInput.value.trim().toLowerCase();
    return containerChoices
      .filter((entry) => !draft.exceptions.includes(entry.cookieStoreId))
      .filter((entry) => {
        if (!filterNeedle) {
          return true;
        }

        return (
          entry.name.toLowerCase().includes(filterNeedle) ||
          (entry.ambiguous &&
            entry.technicalLabel.toLowerCase().includes(filterNeedle))
        );
      });
  }

  function getSelectedExceptionIndex(availableChoices) {
    return availableChoices.findIndex(
      (entry) => entry.cookieStoreId === selectedExceptionId,
    );
  }

  function ensureSelectedException(availableChoices) {
    if (!availableChoices.length) {
      selectedExceptionId = "";
      return;
    }

    if (getSelectedExceptionIndex(availableChoices) === -1) {
      selectedExceptionId = availableChoices[0].cookieStoreId;
    }
  }

  function moveSelectedException(step) {
    const availableChoices = getAvailableExceptionChoices();
    if (!availableChoices.length) {
      selectedExceptionId = "";
      renderExceptionMenu();
      return;
    }

    const currentIndex = getSelectedExceptionIndex(availableChoices);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex =
      (baseIndex + step + availableChoices.length) % availableChoices.length;
    selectedExceptionId = availableChoices[nextIndex].cookieStoreId;
    renderExceptionMenu();
  }

  function addSelectedException() {
    if (!selectedExceptionId) {
      return false;
    }

    draft.exceptions = Shared.normalizeHostRuleExceptions([
      ...draft.exceptions,
      selectedExceptionId,
    ]);

    if (!applyDraft(0, "Host Rule saved.")) {
      return false;
    }

    selectedExceptionId = "";
    exceptionFilterInput.value = "";
    setExceptionMenuOpen(true);
    renderExceptionControl();
    renderExceptionMenu();
    syncCardState();
    focusExceptionInput();
    return true;
  }

  function removeException(cookieStoreId) {
    draft.exceptions = draft.exceptions.filter((entry) => entry !== cookieStoreId);
    if (!applyDraft(0, "Host Rule saved.")) {
      return false;
    }

    setExceptionMenuOpen(true);
    renderExceptionControl();
    renderExceptionMenu();
    syncCardState();
    focusExceptionInput();
    return true;
  }

  function syncExceptionPlaceholder() {
    exceptionFilterInput.placeholder = draft.exceptions.length
      ? "Add more..."
      : "Add container exceptions...";
  }

  function setExceptionMenuOpen(isOpen) {
    exceptionMenuOpen = Boolean(isOpen);
    exceptionPicker.classList.toggle("is-open", exceptionMenuOpen);
    if (exceptionMenuOpen) {
      window.addEventListener(
        "pointerdown",
        handleExceptionPickerPointerDown,
        true,
      );
    } else {
      window.removeEventListener(
        "pointerdown",
        handleExceptionPickerPointerDown,
        true,
      );
    }
  }

  function updateModeButtons() {
    const isBlacklist = draft.mode === "blacklist";
    blacklistButton.className = isBlacklist
      ? "host-rule-mode-button active"
      : "host-rule-mode-button";
    whitelistButton.className = !isBlacklist
      ? "host-rule-mode-button active"
      : "host-rule-mode-button";
    summary.root.classList.toggle("is-blacklist", isBlacklist);
    summary.root.classList.toggle("is-whitelist", !isBlacklist);
    summaryPrefix.textContent = "Matching hosts are ";
    summaryAction.textContent = isBlacklist ? "blocked" : "allowed";
    summaryAction.className = isBlacklist
      ? "card-top-info-action is-blocked"
      : "card-top-info-action is-allowed";
    summarySuffix.textContent = " everywhere except the selected containers.";
  }

  function syncCardState() {
    const missingExceptionIds = getCurrentMissingExceptionIds();
    const isDisabled = !enabledToggle.checked;
    const ruleStatus = Shared.getHostRuleStatus({
      ...draft,
      enabled: enabledToggle.checked,
      patterns: Shared.normalizeHostRulePatterns(patternsTextarea.value),
    });
    card.classList.toggle("is-blacklist", draft.mode === "blacklist");
    card.classList.toggle("is-whitelist", draft.mode === "whitelist");
    card.classList.toggle("is-disabled", isDisabled);
    card.classList.toggle("has-missing-exceptions", missingExceptionIds.length > 0);
    enabledText.textContent = isDisabled ? "Disabled" : "Enabled";
    enabledText.classList.toggle("is-disabled", isDisabled);
    enabledToggleLabel.classList.toggle("is-disabled", isDisabled);
    syncStatusBadgeSlot(
      statusBadgeSlot,
      "Draft",
      "draft",
      ruleStatus.status === "incomplete",
    );
    syncStatusNote(
      statusNote,
      "draft",
      ruleStatus.status === "incomplete" ? ruleStatus.reason : "",
      ruleStatus.status !== "incomplete",
    );
    nameInput.disabled = isDisabled;
    body
      .querySelectorAll("input, textarea, button")
      .forEach((control) => {
        control.disabled = isDisabled;
      });
    updateModeButtons();
    exceptionFilterInput.disabled = isDisabled;
    if (isDisabled) {
      setExceptionMenuOpen(false);
    }
  }

  function renderExceptionControl() {
    const missingExceptionIds = new Set(getCurrentMissingExceptionIds());

    exceptionControl.textContent = "";
    draft.exceptions.forEach((cookieStoreId) => {
      const container = containerChoiceById.get(cookieStoreId) || null;
      const tag = createContainerReferenceTag({
        name: container ? container.name : "Missing container",
        cookieStoreId,
        color: container && container.color,
        icon: container && container.icon,
        iconUrl: container && container.iconUrl,
        technicalLabel:
          (container && container.technicalLabel) ||
          Shared.getContainerTechnicalLabel(cookieStoreId),
        ambiguous: Boolean(container && container.ambiguous),
        missing: missingExceptionIds.has(cookieStoreId),
        removable: true,
        removeLabel: `Remove ${container ? container.name : cookieStoreId}`,
        onRemove: () => {
          removeException(cookieStoreId);
        },
        className: "picker-token-tag",
      });
      exceptionControl.appendChild(tag);
    });

    syncExceptionPlaceholder();
    exceptionControl.appendChild(exceptionFilterInput);
  }

  function renderExceptionMenu() {
    const availableChoices = getAvailableExceptionChoices();
    ensureSelectedException(availableChoices);

    exceptionOptionList.textContent = "";
    if (availableChoices.length) {
      availableChoices.forEach((entry) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className =
          entry.cookieStoreId === selectedExceptionId
            ? "picker-option is-selected"
            : "picker-option";
        option.setAttribute("aria-pressed", entry.cookieStoreId === selectedExceptionId);

        const optionName = document.createElement("span");
        optionName.className = "picker-option-primary";
        optionName.textContent = entry.name;
        option.appendChild(optionName);

        const optionMeta = document.createElement("span");
        optionMeta.className = "picker-option-secondary";
        optionMeta.textContent = entry.ambiguous
          ? `ID: ${entry.technicalLabel}`
          : entry.isDefault
            ? "Default container"
            : "Firefox container";
        if (entry.technicalLabel) {
          option.title = `Firefox container ID: ${entry.technicalLabel}`;
        }
        option.appendChild(optionMeta);

        option.onmousedown = (event) => {
          event.preventDefault();
        };
        option.onclick = () => {
          selectedExceptionId = entry.cookieStoreId;
          addSelectedException();
        };

        exceptionOptionList.appendChild(option);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = exceptionFilterInput.value.trim()
        ? "No matching containers"
        : "No more containers";
      exceptionOptionList.appendChild(empty);
    }

    syncCardState();
  }

  function showValidationError(messages) {
    error.hidden = false;
    error.textContent = Array.isArray(messages)
      ? messages.join(" ")
      : String(messages || "");
  }

  function clearValidationError() {
    error.hidden = true;
    error.textContent = "";
  }

  function applyDraft(delay, message) {
    const parsedPatterns = Shared.parseHostPatternLines(patternsTextarea.value);
    if (!parsedPatterns.valid) {
      showValidationError(formatHeaderErrors(parsedPatterns.errors));
      return false;
    }

    const nextRule = Shared.normalizeHostRuleCard(
      {
        ...draft,
        id: rule.id,
        name: nameInput.value,
        enabled: enabledToggle.checked,
        patterns: parsedPatterns.patterns,
      },
      rule.id,
    );
    const targetIndex = state.config.hostRules.findIndex(
      (entry) => entry.id === rule.id,
    );
    if (targetIndex === -1) {
      showValidationError(["This Host Rule no longer exists in the current draft."]);
      return false;
    }

    clearValidationError();
    draft = Shared.clone(nextRule);
    state.config.hostRules[targetIndex] = nextRule;
    scheduleConfigSave(delay, message || "Host Rule saved.");
    syncFirefoxExternalLinkWarning();
    syncCardState();
    return true;
  }

  nameInput.oninput = () => {
    draft.name = nameInput.value;
    syncCardTitleInputWidth(nameInput, nameInput.placeholder);
    applyDraft(250, "Host Rule saved.");
  };

  patternsTextarea.oninput = () => {
    applyDraft(350, "Host Rule saved.");
  };

  enabledToggle.onchange = () => {
    draft.enabled = enabledToggle.checked;
    if (!applyDraft(0, "Host Rule saved.")) {
      enabledToggle.checked = !enabledToggle.checked;
      draft.enabled = enabledToggle.checked;
      return;
    }

    syncCardState();
  };

  blacklistButton.onclick = () => {
    draft.mode = "blacklist";
    if (!applyDraft(0, "Host Rule saved.")) {
      return;
    }

    syncCardState();
    renderExceptionMenu();
  };

  whitelistButton.onclick = () => {
    draft.mode = "whitelist";
    if (!applyDraft(0, "Host Rule saved.")) {
      return;
    }

    syncCardState();
    renderExceptionMenu();
  };

  exceptionFilterInput.oninput = () => {
    selectedExceptionId = "";
    setExceptionMenuOpen(true);
    renderExceptionMenu();
  };

  exceptionFilterInput.onfocus = () => {
    if (!enabledToggle.checked) {
      return;
    }

    setExceptionMenuOpen(true);
    renderExceptionMenu();
  };

  exceptionPicker.onfocusout = () => {
    window.setTimeout(() => {
      if (!exceptionPicker.contains(document.activeElement)) {
        setExceptionMenuOpen(false);
      }
    }, 0);
  };

  exceptionFilterInput.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setExceptionMenuOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setExceptionMenuOpen(true);
      moveSelectedException(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setExceptionMenuOpen(true);
      moveSelectedException(-1);
      return;
    }

    if (
      event.key === "Backspace" &&
      !exceptionFilterInput.value &&
      draft.exceptions.length
    ) {
      event.preventDefault();
      removeException(draft.exceptions[draft.exceptions.length - 1]);
      return;
    }

    if (event.key !== "Enter" || !selectedExceptionId) {
      return;
    }

    event.preventDefault();
    addSelectedException();
  };

  exceptionControl.onclick = (event) => {
    if (event.target instanceof HTMLButtonElement) {
      return;
    }

    setExceptionMenuOpen(true);
    focusExceptionInput();
  };

  renderExceptionControl();
  renderExceptionMenu();
  updateModeButtons();
  syncCardState();
  return card;
}

function renderHostRulesTab(root, containerIntegrity) {
  const containerChoices = getHostRuleContainerChoices(containerIntegrity);
  const containerChoiceById = new Map(
    containerChoices.map((entry) => [entry.cookieStoreId, entry]),
  );

  root.appendChild(createFirefoxExternalLinkWarning());

  root.appendChild(
    createNote(
      "Rules are evaluated top to bottom; the first matching card wins.",
      "tab-intro",
    ),
  );

  const missingRefs = containerIntegrity.missingHostRuleRefs;
  if (missingRefs.length) {
    root.appendChild(
      createContainerIntegrityAlert(
        "Missing containers",
        `${missingRefs.length} Host Rule${missingRefs.length > 1 ? "s still reference containers that no longer exist." : " still references a container that no longer exists."}`,
        missingRefs.map(
          (entry) =>
            `${entry.ruleName}: ${entry.missingCookieStoreIds
              .map((cookieStoreId) => Shared.getContainerTechnicalLabel(cookieStoreId))
              .join(", ")}`,
        ),
      ),
    );
  }

  if (containerIntegrity.ambiguousHostRuleRefs.length) {
    root.appendChild(
      createContainerIntegrityAlert(
        "Ambiguous container names",
        "Some Host Rule exceptions point to live Firefox containers that currently share the same visible name.",
        containerIntegrity.ambiguousHostRuleRefs.map(
          (entry) =>
            `${entry.ruleName}: ${entry.ambiguousCookieStoreIds
              .map((cookieStoreId) => Shared.getContainerTechnicalLabel(cookieStoreId))
              .join(", ")}`,
        ),
      ),
    );
  }

  if (!state.config.hostRules.length) {
    root.appendChild(
      createEmptyState(
        "No Host Rules yet",
        "Create one from the action above to decide which containers may reach a specific host.",
      ),
    );
  } else {
    const overlapIds = Shared.detectPossibleHostRuleOverlapIds(
      state.config.hostRules,
    );
    const missingRefsByRuleId = new Map(
      missingRefs.map((entry) => [entry.ruleId, entry]),
    );
    const ambiguousContainerIds = new Set(containerIntegrity.ambiguousContainerIds);

    state.config.hostRules.forEach((rule, index) => {
      root.appendChild(
        createHostRuleCard(
          rule,
          index,
          state.config.hostRules.length,
          overlapIds,
          missingRefsByRuleId,
          ambiguousContainerIds,
          containerChoices,
          containerChoiceById,
        ),
      );
    });
  }
}

async function render() {
  renderShell();
  await renderActiveTabContent();
}

function renderShell() {
  renderTabNav();
  syncStatusShell();
}

async function renderActiveTabContent() {
  const layout = ensureTabLayoutRoot();
  if (!layout) {
    return;
  }
  layout.dataset.activeTab = state.config.ui.activeTab;
  layout.textContent = "";
  const containerIntegrity = Shared.getContainerIntegrityReport(
    state.config,
    state.containers,
  );

  if (state.config.ui.activeTab === "containers") {
    renderContainersTab(layout, containerIntegrity);
  } else if (state.config.ui.activeTab === "proxies") {
    renderProxiesTab(layout, containerIntegrity);
  } else if (state.config.ui.activeTab === "host-rules") {
    renderHostRulesTab(layout, containerIntegrity);
  }

  syncStickyHeaderMetrics();
  const collections = Object.keys(CARD_COLLECTIONS);
  for (const collection of collections) {
    await restorePendingReorderScrollAnchor(collection);
  }
  for (const collection of collections) {
    await playPendingReorderAnimation(collection);
  }
  let restoredInsertedField = false;
  for (const collection of collections) {
    if (await playPendingInsertEffects(collection)) {
      restoredInsertedField = true;
      break;
    }
  }

  if (!restoredInsertedField) {
    restorePendingFieldFocus();
  }

  syncOpenContainerIdentityPopoverAfterRender();
}

function bindEvents() {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[Shared.CONFIG_KEY]) {
      return;
    }

    const nextBundle = changes[Shared.CONFIG_KEY].newValue;
    if (!nextBundle || !Shared.isConfigBundle(nextBundle)) {
      return;
    }

    if (
      nextBundle.meta.writer === state.writerId &&
      nextBundle.meta.revision <= state.persistedMeta.revision
    ) {
      return;
    }

    if (!state.dirty && !state.saveInFlight) {
      syncDraftWithPersistedBundle(nextBundle);
      render().catch((error) => setStatus(error.message, true));
      return;
    }

    if (nextBundle.meta.revision > state.persistedMeta.revision) {
      setPersistedBundle(nextBundle);
      setConfigReloadBlockedStatus();
    }
  });

  if (browser.commands && browser.commands.onChanged) {
    browser.commands.onChanged.addListener(() => {
      if (state.suppressCommandChangeEvents > 0) {
        return;
      }

      refreshCommands()
        .then(() => {
          syncVisibleShortcutFields();
        })
        .catch((error) => setStatus(error.message, true));
    });
  }

  window.addEventListener("pagehide", () => {
    closeContainerIdentityPopover();
    flushPendingIdentitySaves().catch(() => undefined);
    flushConfigSave().catch(() => undefined);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.openContainerIdentityPopoverCookieStoreId) {
      return;
    }

    event.preventDefault();
    closeContainerIdentityPopover({ restoreFocus: true });
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const cookieStoreId = state.openContainerIdentityPopoverCookieStoreId;
      if (!cookieStoreId) {
        return;
      }

      const elements = getContainerIdentityElements(cookieStoreId);
      if (!elements || !elements.trigger || !elements.popover) {
        closeContainerIdentityPopover();
        return;
      }

      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        elements.trigger.contains(event.target) ||
        elements.popover.contains(event.target)
      ) {
        return;
      }

      closeContainerIdentityPopover();
    },
    true,
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") {
      return;
    }

    closeContainerIdentityPopover();
    flushPendingIdentitySaves().catch(() => undefined);
    flushConfigSave().catch(() => undefined);
  });

  const handleWindowResize = () => {
    scheduleContainerIdentityPopoverReposition();
    scheduleStickyHeaderMetrics();
  };

  window.addEventListener("scroll", scheduleContainerIdentityPopoverReposition, true);
  window.addEventListener("resize", handleWindowResize);

  document.getElementById("dismiss-status").onclick = () => {
    if (!state.lastStatusSignature) {
      return;
    }

    state.dismissedStatusSignature = state.lastStatusSignature;
    syncStatusShell();
  };
  document.getElementById("refresh-config").onclick = () => {
    reloadPersistedState().catch((error) => setStatus(error.message, true));
  };
}

async function main() {
  bindEvents();
  await refreshState();
  await render();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildInsertKeyframes,
    buildReorderKeyframes,
    buildTabSummaries,
    getHeaderPrimaryActionDescriptor,
    getInternalShortcutConflictIssue,
    shouldShowExternalContainerGuessWarning,
  };
} else {
  main().catch((error) => {
    setStatus(error.message, true);
  });
}
