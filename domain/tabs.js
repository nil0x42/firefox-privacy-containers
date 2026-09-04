import { normalizeText } from "./values.js";

export const BLOCKED_REOPEN_PREFIXES = [
  "about:",
  "moz-extension:",
  "chrome:",
  "resource:",
  "file:",
  "view-source:",
];

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function isActionableTabUrl(url) {
  const value = normalizeText(url);
  if (!value) {
    return false;
  }
  try {
    return WEB_PROTOCOLS.has(new URL(value).protocol);
  } catch (_) {
    return false;
  }
}

export function isExtensionTabUrl(url, extensionOrigin) {
  const value = normalizeText(url);
  const origin = normalizeText(extensionOrigin);
  return Boolean(value && origin && value.startsWith(origin));
}

export function getActionableTabValidation(tab, extensionOrigin) {
  if (!tab?.active) {
    return {
      valid: false,
      reason: "No active browser tab found in the current window",
    };
  }
  if (isExtensionTabUrl(tab.url, extensionOrigin)) {
    return { valid: false, reason: "The active tab is this extension page" };
  }
  if (!isActionableTabUrl(tab.url)) {
    return {
      valid: false,
      reason: "The active tab is not an http or https page",
    };
  }
  return { valid: true, reason: "" };
}

export function getTabPlacementValidation(tab) {
  return tab?.active
    ? { valid: true, reason: "" }
    : {
        valid: false,
        reason: "No active browser tab found in the current window",
      };
}

export function canReopenTabUrl(url) {
  const value = normalizeText(url);
  if (!value) {
    return false;
  }
  const lowerValue = value.toLowerCase();
  if (BLOCKED_REOPEN_PREFIXES.some((prefix) => lowerValue.startsWith(prefix))) {
    return false;
  }
  try {
    return WEB_PROTOCOLS.has(new URL(value).protocol);
  } catch (_) {
    return false;
  }
}

export function getReopenableTabValidation(tab, extensionOrigin) {
  const actionable = getActionableTabValidation(tab, extensionOrigin);
  if (!actionable.valid) {
    return actionable;
  }
  return canReopenTabUrl(tab.url)
    ? actionable
    : {
        valid: false,
        reason: "The active tab URL cannot be reopened in another container",
      };
}
