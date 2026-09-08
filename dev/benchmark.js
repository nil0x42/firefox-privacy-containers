import { performance } from "node:perf_hooks";
import { createRequestContextCache } from "../background/request-context-cache.js";
import { createRequestHandlers } from "../background/request-handlers.js";
import { createBackgroundState } from "../background/state.js";
import Shared from "../utils/shared.js";

const iterations = 200000;
const containers = [
  {
    cookieStoreId: "firefox-container-1",
    name: "Proxied",
    color: "blue",
  },
];
const config = Shared.normalizeConfig({
  proxies: [
    {
      id: "proxy-1",
      type: "http",
      host: "127.0.0.1",
      port: 8080,
      bypass: {
        optionsMethod: false,
        customHostsEnabled: false,
        customHosts: [],
      },
    },
  ],
  containerSettings: {
    "firefox-container-1": {
      proxyId: "proxy-1",
      headers: [{ id: "scoped", name: "X-Scope", value: "work" }],
    },
  },
  globalHeaders: [{ id: "global", name: "X-Global", value: "1" }],
  hostRules: [
    {
      id: "rule-1",
      name: "Blocked host",
      enabled: true,
      mode: "blacklist",
      patterns: ["blocked.example.com"],
      exceptions: [],
    },
  ],
});
const state = createBackgroundState(Shared);
state.config = config;
state.runtime = Shared.compileRuntime(config, containers);
state.routingReady = true;
const requestContextCache = createRequestContextCache({ Shared, state });
const handlers = createRequestHandlers({
  Shared,
  state,
  requestContextCache,
  constants: {
    PROXY_CONNECTION_ISOLATION_PREFIX: "benchmark",
    PROXY_FAILOVER_TIMEOUT_SECONDS: 1,
  },
  blockedPageStore: {
    scheduleAutoReopenBlockedMainFrame() {
      return false;
    },
  },
  waitForRoutingReady() {
    return true;
  },
});

function measure(name, operation) {
  let checksum = 0;
  for (let index = 0; index < 10000; index += 1) {
    checksum = (checksum + operation(index)) >>> 0;
  }

  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    checksum = (checksum + operation(index)) >>> 0;
  }
  const duration = performance.now() - startedAt;
  const operationsPerSecond = Math.round((iterations / duration) * 1000);
  process.stdout.write(
    `${name}: ${duration.toFixed(2)} ms (${operationsPerSecond}/s, checksum ${checksum})\n`,
  );
}

function request(index, cookieStoreId, host = "example.com") {
  return {
    cookieStoreId,
    method: "GET",
    requestId: `request-${index}`,
    type: "xmlhttprequest",
    url: `https://${host}/resource/${index}`,
  };
}

measure("direct proxy routing", (index) => {
  return handlers.setProxy(
    request(index, Shared.FIREFOX_DEFAULT_CONTAINER),
  ) === null
    ? 1
    : 0;
});

measure("compiled proxy routing", (index) => {
  const result = handlers.setProxy(request(index, "firefox-container-1"));
  return result[0].port + result.length;
});

measure("exact host rule", (index) => {
  const result = handlers.enforceHostRules(
    request(index, Shared.FIREFOX_DEFAULT_CONTAINER, "blocked.example.com"),
  );
  return result.cancel ? 1 : 0;
});

measure("two-header merge", (index) => {
  const result = handlers.addHeaders({
    cookieStoreId: "firefox-container-1",
    requestHeaders: [
      { name: "Accept", value: "*/*" },
      { name: "X-Scope", value: String(index & 7) },
    ],
  });
  return result.requestHeaders.length;
});
