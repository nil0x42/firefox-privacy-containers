const Shared = globalThis.PrivacyContainersShared;

const WAND_ICON_SVG =
  '<svg viewBox="0 0 576 512" aria-hidden="true"><path d="M343 39.1C348.8 16.4 381.2 16.4 387 39.1L394.5 68.4C398.2 82.9 409.6 94.3 424.1 98L453.4 105.5C476.1 111.3 476.1 143.7 453.4 149.5L424.1 157C409.6 160.7 398.2 172.1 394.5 186.6L387 215.9C381.2 238.6 348.8 238.6 343 215.9L335.5 186.6C331.8 172.1 320.4 160.7 305.9 157L276.6 149.5C253.9 143.7 253.9 111.3 276.6 105.5L305.9 98C320.4 94.3 331.8 82.9 335.5 68.4L343 39.1zM496 0C504.8 0 512 7.2 512 16L512 64L560 64C568.8 64 576 71.2 576 80C576 88.8 568.8 96 560 96L512 96L512 144C512 152.8 504.8 160 496 160C487.2 160 480 152.8 480 144L480 96L432 96C423.2 96 416 88.8 416 80C416 71.2 423.2 64 432 64L480 64L480 16C480 7.2 487.2 0 496 0zM53.6 377.4L309.5 121.5C318.9 112.1 334.1 112.1 343.4 121.5L390.5 168.6C399.9 178 399.9 193.2 390.5 202.5L134.6 458.4C125.2 467.8 110 467.8 100.7 458.4L53.6 411.3C44.2 401.9 44.2 386.7 53.6 377.4zM19.7 445.3C31.7 433.3 51.1 433.3 63.1 445.3L66.7 448.9C78.7 460.9 78.7 480.3 66.7 492.3L50.3 508.7C42.1 516.9 30.4 521.4 18.8 520.9C8.4 520.4 0 512 0 501.6C-.5 490 4 478.3 12.2 470.1L28.6 453.7 19.7 445.3z" fill="currentColor"/></svg>';
const ERASER_ICON_SVG =
  '<svg viewBox="0 0 576 512" aria-hidden="true"><path d="M290.7 57.4C315.7 32.4 356.3 32.4 381.3 57.4L518.6 194.7C543.6 219.7 543.6 260.3 518.6 285.3L364 439.9C352 451.9 335.7 458.6 318.7 458.6L197.3 458.6C180.3 458.6 164 451.9 152 439.9L57.4 345.3C32.4 320.3 32.4 279.7 57.4 254.7L290.7 57.4zM333.3 102.7C326.7 96.1 315.9 96.1 309.3 102.7L192 220 355.9 383.9 473.3 266.6C479.9 260 479.9 249.2 473.3 242.6L333.3 102.7zM310.6 429.3L355.9 384 192 220 102.7 309.3C96.1 315.9 96.1 326.7 102.7 333.3L197.3 427.9C203.9 434.5 214.7 434.5 221.3 427.9L265.4 383.8 310.6 429.3zM352 480L544 480C561.7 480 576 494.3 576 512C576 529.7 561.7 544 544 544L352 544C334.3 544 320 529.7 320 512C320 494.3 334.3 480 352 480z" fill="currentColor"/></svg>';

const state = {
  actionNodesById: new Map(),
  isBusy: false,
  tab: null,
};

function setIcon(target, svgMarkup) {
  const svgDocument = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  target.replaceChildren(document.importNode(svgDocument.documentElement, true));
}

const TAB_ACTIONS = [
  {
    id: "allow-paste",
    kind: "unlock",
    label: "Bypass blocked paste",
    description: "Allow paste handlers to stop blocking clipboard paste.",
    help:
      "Acts on the current top-level page only. It does not inspect nested cross-origin frames.",
    run: (tab) => executeOnTab(tab, allowPasteOnPage),
    success: () => "Paste blocking bypassed",
  },
  {
    id: "allow-select",
    kind: "unlock",
    label: "Bypass blocked text selection",
    description: "Restore text selection when the page blocks it.",
    help:
      "Acts on the current top-level page only. It does not inspect nested cross-origin frames.",
    run: (tab) => executeOnTab(tab, allowSelectOnPage),
    success: () => "Text selection blocking bypassed",
  },
  {
    id: "enable-inputs",
    kind: "unlock",
    label: "Enable disabled inputs",
    description: "Re-enable disabled form fields on the page.",
    help:
      "Acts on disabled elements found in the current top-level document only.",
    run: (tab) => executeOnTab(tab, enableInputsOnPage),
    success: () => "Disabled inputs enabled",
  },
  {
    id: "clear-local",
    kind: "clear",
    label: "Clear local storage",
    description: "Delete localStorage for the active page.",
    help:
      "Clears localStorage in the current top-level document only. Other origins or nested frames are not included.",
    run: (tab) => executeOnTab(tab, clearLocalStorageOnPage),
    success: () => "Local storage cleared",
  },
  {
    id: "clear-session",
    kind: "clear",
    label: "Clear session storage",
    description: "Delete sessionStorage for the active page.",
    help:
      "Clears sessionStorage in the current top-level document only. Other origins or nested frames are not included.",
    run: (tab) => executeOnTab(tab, clearSessionStorageOnPage),
    success: () => "Session storage cleared",
  },
  {
    id: "clear-cookies",
    kind: "clear",
    label: "Clear cookies",
    description: "Delete cookies for the active page in its container store.",
    help:
      "Clears cookies matched from the active page URL in the current cookie store. It is not a full multi-origin browser cleanup.",
    run: (tab) => removeTabCookies(tab),
    success: () => "Cookies cleared",
  },
  {
    id: "clear-all",
    kind: "clear",
    label: "Clear local/session storage + cookies",
    description: "Delete local storage, session storage and cookies together.",
    help:
      "Combines top-level local/session storage cleanup with cookie removal for the active page URL and cookie store.",
    run: async (tab) => {
      await executeOnTab(tab, clearAllStorageOnPage);
      await removeTabCookies(tab);
    },
    success: () => "Local storage, session storage and cookies cleared",
  },
];

function getHostname(url) {
  try {
    return new URL(url).hostname || url;
  } catch (_) {
    return String(url || "");
  }
}

function getTargetLabel(tab) {
  return getHostname(tab.url || "") || "this tab";
}

function showStatus(message, isError) {
  const status = document.getElementById("status");
  status.hidden = !message;
  status.className = isError ? "status error" : "status ok";
  status.textContent = message || "";
}

function createHelpButton(text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "help-button";
  button.textContent = "?";
  button.title = text;
  button.setAttribute("aria-label", text);
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return button;
}

function getActionHelpText(action) {
  return [action.description, action.help].filter(Boolean).join(" ");
}

function getActionIconMarkup(action) {
  return action.kind === "unlock" ? WAND_ICON_SVG : ERASER_ICON_SVG;
}

async function getActiveBrowserTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  const validation = Shared.getActionableTabValidation(
    tab,
    browser.runtime.getURL(""),
  );
  if (!validation.valid) {
    return null;
  }

  return tab;
}

function executeOnTab(tab, fn) {
  return browser.scripting.executeScript({
    target: {
      tabId: tab.id,
    },
    func: fn,
  });
}

function omitObjectField(object, key) {
  const next = { ...object };
  delete next[key];
  return next;
}

function getCookieLookupAttempts(tab) {
  return [
    Shared.buildCookieQueryDetails(tab, true),
    Shared.buildCookieQueryDetails(tab, false),
    {
      url: tab.url,
      storeId: tab.cookieStoreId,
    },
  ];
}

async function getTabCookies(tab) {
  let lastError = null;

  for (const details of getCookieLookupAttempts(tab)) {
    try {
      return await browser.cookies.getAll(details);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to read cookies for this tab.");
}

function getCookieRemovalAttempts(cookie, tab) {
  const fullDetails = Shared.buildCookieRemovalDetails(cookie, tab.cookieStoreId);
  const attempts = [fullDetails];

  if (fullDetails.partitionKey) {
    attempts.push(omitObjectField(fullDetails, "partitionKey"));
  }

  if (Object.prototype.hasOwnProperty.call(fullDetails, "firstPartyDomain")) {
    attempts.push(omitObjectField(fullDetails, "firstPartyDomain"));
  }

  if (
    fullDetails.partitionKey &&
    Object.prototype.hasOwnProperty.call(fullDetails, "firstPartyDomain")
  ) {
    attempts.push(
      omitObjectField(
        omitObjectField(fullDetails, "partitionKey"),
        "firstPartyDomain",
      ),
    );
  }

  const seen = new Set();
  return attempts.filter((details) => {
    const key = JSON.stringify(details);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function removeCookieWithFallbacks(cookie, tab) {
  let lastError = null;

  for (const details of getCookieRemovalAttempts(cookie, tab)) {
    try {
      return await browser.cookies.remove(details);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Failed to remove cookie "${cookie.name}".`);
}

async function removeTabCookies(tab) {
  const cookies = await getTabCookies(tab);

  const results = await Promise.allSettled(
    cookies.map((cookie) => removeCookieWithFallbacks(cookie, tab)),
  );

  const failures = results.filter((result) => result.status === "rejected");
  const missingRemovals = results.filter(
    (result) => result.status === "fulfilled" && !result.value,
  );
  const removedCount = results.filter(
    (result) => result.status === "fulfilled" && result.value,
  ).length;

  if (failures.length) {
    const summary = removedCount
      ? `Removed ${removedCount} cookie${removedCount > 1 ? "s" : ""}, but `
      : "";
    throw new Error(
      `${summary}failed to remove ${failures.length} cookie${failures.length > 1 ? "s" : ""}.`,
    );
  }

  return {
    matchedCount: cookies.length,
    missingCount: missingRemovals.length,
    removedCount,
  };
}

function allowPasteOnPage() {
  if (window.__privacyContainersAllowPaste) {
    return;
  }

  const handler = (event) => {
    if (event.type === "beforeinput" && event.inputType !== "insertFromPaste") {
      return;
    }

    event.stopImmediatePropagation();
  };

  window.__privacyContainersAllowPaste = handler;
  ["beforeinput", "paste"].forEach((type) => {
    document.addEventListener(type, handler, true);
  });
}

function allowSelectOnPage() {
  if (!window.__privacyContainersAllowSelect) {
    const handler = (event) => {
      event.stopImmediatePropagation();
    };

    window.__privacyContainersAllowSelect = handler;
    document.addEventListener("selectstart", handler, true);
  }

  if (!document.getElementById("__privacy-containers-user-select")) {
    const style = document.createElement("style");
    style.id = "__privacy-containers-user-select";
    style.textContent = `
      * {
        user-select: auto !important;
        -webkit-user-select: auto !important;
        -moz-user-select: auto !important;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function enableInputsOnPage() {
  document.querySelectorAll(":disabled").forEach((element) => {
    element.disabled = false;
  });
}

function clearLocalStorageOnPage() {
  localStorage.clear();
}

function clearSessionStorageOnPage() {
  sessionStorage.clear();
}

function clearAllStorageOnPage() {
  sessionStorage.clear();
  localStorage.clear();
}

function renderTarget() {
  const title = document.getElementById("target-title");
  const meta = document.getElementById("target-meta");

  if (!state.tab) {
    title.textContent = "No active web tab available";
    meta.textContent =
      "Switch to an http or https tab, then click the add-on icon again.";
    return;
  }

  title.textContent = state.tab.title || getTargetLabel(state.tab);
  meta.textContent = getTargetLabel(state.tab);
}

async function runAction(action) {
  if (!state.tab || state.isBusy) {
    return;
  }

  state.isBusy = true;
  syncActionAvailability();
  showStatus("", false);

  try {
    await action.run(state.tab);
    const label = getTargetLabel(state.tab);
    const message = `${action.success(state.tab)} for ${label}.`;
    showStatus(message, false);
  } catch (error) {
    const message = error && error.message
      ? error.message
      : "Action failed on this tab.";
    showStatus(message, true);
  } finally {
    state.isBusy = false;
    syncActionAvailability();
  }
}

function syncActionAvailability() {
  state.actionNodesById.forEach((node) => {
    node.disabled = !state.tab || state.isBusy;
  });
}

function renderActions() {
  const root = document.getElementById("action-list");
  if (root.childElementCount === TAB_ACTIONS.length) {
    syncActionAvailability();
    return;
  }

  state.actionNodesById.clear();
  root.textContent = "";

  TAB_ACTIONS.forEach((action) => {
    const row = document.createElement("div");
    row.className = "action-row";

    const label = document.createElement("button");
    label.type = "button";
    label.className = `action-trigger action-trigger-${action.kind}`;
    label.disabled = !state.tab || state.isBusy;
    label.onclick = () => {
      runAction(action).catch(() => undefined);
    };
    const icon = document.createElement("span");
    icon.className = "action-trigger-icon";
    setIcon(icon, getActionIconMarkup(action));
    label.appendChild(icon);

    const text = document.createElement("span");
    text.className = "action-trigger-text";
    text.textContent = action.label;
    label.appendChild(text);

    row.appendChild(label);
    row.appendChild(createHelpButton(getActionHelpText(action)));
    root.appendChild(row);
    state.actionNodesById.set(action.id, label);
  });

  syncActionAvailability();
}

function bindEvents() {
  document.getElementById("open-settings").onclick = async () => {
    await browser.runtime.openOptionsPage();
    window.close();
  };
}

async function main() {
  bindEvents();
  state.tab = await getActiveBrowserTab();
  renderTarget();
  renderActions();
}

main().catch((error) => {
  showStatus(error.message || "Failed to initialize popup.", true);
});
