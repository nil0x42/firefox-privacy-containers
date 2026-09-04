const OPTIONS_UI_KEY = "optionsUi";
const TABS = new Set(["containers", "proxies", "host-rules"]);

function normalizeActiveTab(value) {
  return TABS.has(value) ? value : "containers";
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

export { OPTIONS_UI_KEY, loadOptionsUi, normalizeActiveTab, saveOptionsUi };
