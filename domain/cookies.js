import { clone, normalizeText } from "./values.js";

export function buildCookieRemovalUrl(cookie) {
  const domain = normalizeText(cookie?.domain).replace(/^\./, "");
  if (!domain) {
    return "";
  }

  const host =
    domain.includes(":") && !domain.startsWith("[") && !domain.endsWith("]")
      ? `[${domain}]`
      : domain;
  const path = normalizeText(cookie?.path) || "/";
  return `${cookie?.secure ? "https" : "http"}://${host}${
    path.startsWith("/") ? path : `/${path}`
  }`;
}

export function buildCookieQueryDetails(tab, includePartitioned) {
  const details = {
    url: normalizeText(tab?.url),
    firstPartyDomain: null,
  };
  const storeId = normalizeText(tab?.cookieStoreId);
  if (storeId) {
    details.storeId = storeId;
  }

  if (includePartitioned) {
    details.partitionKey = {};
  }

  return details;
}

export function buildCookieRemovalDetails(cookie, storeId) {
  const details = {
    url: buildCookieRemovalUrl(cookie),
    name: normalizeText(cookie?.name),
  };

  const normalizedStoreId = normalizeText(storeId);
  if (normalizedStoreId) {
    details.storeId = normalizedStoreId;
  }

  if (cookie && Object.hasOwn(cookie, "firstPartyDomain")) {
    details.firstPartyDomain = cookie.firstPartyDomain;
  }

  if (cookie?.partitionKey && typeof cookie.partitionKey === "object") {
    details.partitionKey = clone(cookie.partitionKey);
  }

  return details;
}
