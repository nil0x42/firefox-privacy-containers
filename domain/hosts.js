import { FIREFOX_DEFAULT_CONTAINER } from "./containers.js";
import { normalizeText } from "./values.js";

const REQUEST_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);

export function normalizeHostRule(value) {
  let text = normalizeText(value).toLowerCase();
  if (!text) {
    return "";
  }

  try {
    const parsed = text.includes("://")
      ? new URL(text)
      : new URL(`http://${text}`);
    text = parsed.hostname || text;

    if (text.startsWith("[") && text.endsWith("]")) {
      text = text.slice(1, -1);
    }
  } catch (_) {
    text = text.split(/[/?#]/, 1)[0];

    if (text.includes("@")) {
      text = text.split("@").pop();
    }

    if (text.startsWith("[") && text.includes("]")) {
      text = text.slice(1, text.indexOf("]"));
    } else if ((text.match(/:/g) || []).length === 1) {
      text = text.split(":")[0];
    }
  }

  return text.replace(/\.+$/, "");
}

export function uniqueSortedHosts(values, fallback) {
  const source = Array.isArray(values) ? values : fallback || [];
  const hosts = [];
  const seen = new Set();

  source.forEach((value) => {
    const host = normalizeHostRule(value);
    if (!host || seen.has(host)) {
      return;
    }

    seen.add(host);
    hosts.push(host);
  });

  hosts.sort();
  return hosts;
}

export function parseRequestTarget(url) {
  try {
    const parsed = new URL(url);
    if (!REQUEST_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    const host = normalizeHostRule(parsed.hostname);
    if (!host) {
      return null;
    }

    return {
      protocol: parsed.protocol,
      host,
    };
  } catch (_) {
    return null;
  }
}

export function parseRequestHost(url) {
  const target = parseRequestTarget(url);
  return target ? target.host : "";
}

export function getEffectiveCookieStoreId(cookieStoreId) {
  return normalizeText(cookieStoreId) || FIREFOX_DEFAULT_CONTAINER;
}

export function buildRequestContext(requestDetails) {
  return {
    cookieStoreId: getEffectiveCookieStoreId(
      requestDetails && requestDetails.cookieStoreId,
    ),
    method: normalizeText(requestDetails && requestDetails.method).toUpperCase(),
    normalizedHost: "",
    target: null,
    targetParsed: false,
    isLoopback: false,
    url: normalizeText(requestDetails && requestDetails.url),
  };
}

export function ensureRequestTarget(context) {
  if (!context || context.targetParsed) {
    return context;
  }

  const target = parseRequestTarget(context.url);
  context.target = target;
  context.normalizedHost = target ? target.host : "";
  context.isLoopback = context.normalizedHost
    ? isLoopbackNormalizedHost(context.normalizedHost)
    : false;
  context.targetParsed = true;
  return context;
}

export function hostMatchesNormalizedRule(host, rule) {
  if (!host || !rule) {
    return false;
  }

  return host === rule || host.endsWith(`.${rule}`);
}

export function hostMatchesAnyNormalizedRule(host, rules) {
  return (rules || []).some((rule) => hostMatchesNormalizedRule(host, rule));
}

export function hostMatchesRule(host, rule) {
  return hostMatchesNormalizedRule(
    normalizeHostRule(host),
    normalizeHostRule(rule),
  );
}

export function hostMatchesAnyRule(host, rules) {
  return (rules || []).some((rule) => hostMatchesRule(host, rule));
}

export function isLoopbackNormalizedHost(normalizedHost) {
  if (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost === "::1" ||
    normalizedHost === "0:0:0:0:0:0:0:1"
  ) {
    return true;
  }

  if (!/^127(?:\.\d{1,3}){3}$/.test(normalizedHost)) {
    return false;
  }

  return normalizedHost
    .split(".")
    .every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
}

export function isLoopbackHost(host) {
  const normalizedHost = normalizeHostRule(host);
  return Boolean(
    normalizedHost && isLoopbackNormalizedHost(normalizedHost),
  );
}

export function createHostSuffixSet(rules) {
  return new Set(uniqueSortedHosts(rules, []));
}

export function hostMatchesCompiledNormalizedHost(normalizedHost, compiledRules) {
  if (!normalizedHost || !compiledRules.size) {
    return false;
  }

  if (compiledRules.has(normalizedHost)) {
    return true;
  }

  let index = normalizedHost.indexOf(".");
  while (index !== -1) {
    const suffix = normalizedHost.slice(index + 1);
    if (compiledRules.has(suffix)) {
      return true;
    }

    index = normalizedHost.indexOf(".", index + 1);
  }

  return false;
}
