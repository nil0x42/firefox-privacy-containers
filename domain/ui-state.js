const OPTIONS_UI_KEY = "optionsUi";
const TABS = new Set(["containers", "proxies", "host-rules"]);
const OPTIONS_PAGE_PATH = "options/app.html";

function normalizeActiveTab(value) {
  return TABS.has(value) ? value : "containers";
}

function buildOptionsTargetHash(tabId, targetId = "") {
  const normalizedTabId = normalizeActiveTab(tabId);
  const params = new URLSearchParams();
  if (targetId) {
    params.set("focus", String(targetId));
  }

  const query = params.toString();
  return `#${normalizedTabId}${query ? `?${query}` : ""}`;
}

function buildOptionsTargetUrl(browserApi, tabId, targetId = "") {
  return `${browserApi.runtime.getURL(OPTIONS_PAGE_PATH)}${buildOptionsTargetHash(
    tabId,
    targetId,
  )}`;
}

function parseOptionsTarget(hash) {
  const value = String(hash || "").replace(/^#/, "");
  const separatorIndex = value.indexOf("?");
  const tabId = separatorIndex === -1 ? value : value.slice(0, separatorIndex);
  if (!TABS.has(tabId)) {
    return null;
  }

  const query = separatorIndex === -1 ? "" : value.slice(separatorIndex + 1);
  return {
    tabId,
    targetId: new URLSearchParams(query).get("focus") || "",
  };
}

function shouldHandleOptionsLinkClick(event) {
  return Boolean(
    event &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey,
  );
}

async function loadOptionsUi(browserApi) {
  const stored = (await browserApi.storage.local.get(OPTIONS_UI_KEY))[
    OPTIONS_UI_KEY
  ];
  return { activeTab: normalizeActiveTab(stored?.activeTab) };
}

function saveOptionsUi(browserApi, state) {
  return browserApi.storage.local.set({
    [OPTIONS_UI_KEY]: { activeTab: normalizeActiveTab(state?.activeTab) },
  });
}

export {
  OPTIONS_PAGE_PATH,
  OPTIONS_UI_KEY,
  buildOptionsTargetHash,
  buildOptionsTargetUrl,
  loadOptionsUi,
  normalizeActiveTab,
  parseOptionsTarget,
  saveOptionsUi,
  shouldHandleOptionsLinkClick,
};
