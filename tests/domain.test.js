import assert from "node:assert/strict";
import test from "node:test";
import {
  FIREFOX_DEFAULT_CONTAINER,
  getContainerSlots,
} from "../domain/containers.js";
import {
  buildCookieQueryDetails,
  buildCookieRemovalDetails,
} from "../domain/cookies.js";
import {
  OPEN_CURRENT_CONTAINER_TAB_COMMAND,
  captureShortcutFromEventData,
  getFixedShortcutCommandDescription,
} from "../domain/shortcuts.js";
import {
  canReopenTabUrl,
  getActionableTabValidation,
} from "../domain/tabs.js";
import {
  buildOptionsTargetHash,
  buildOptionsTargetUrl,
  parseOptionsTarget,
  shouldHandleOptionsLinkClick,
} from "../domain/ui-state.js";
import Shared from "../utils/shared.js";

test("container slots keep the Firefox default identity first", () => {
  const slots = getContainerSlots([
    { cookieStoreId: "firefox-container-2", name: "Work" },
  ]);
  assert.equal(slots[0].cookieStoreId, FIREFOX_DEFAULT_CONTAINER);
  assert.equal(slots[1].cookieStoreId, "firefox-container-2");
});

test("cookie details preserve the exact storage identity", () => {
  const tab = {
    url: "https://example.com/",
    cookieStoreId: "firefox-container-2",
  };
  assert.deepEqual(buildCookieQueryDetails(tab, true), {
    url: tab.url,
    firstPartyDomain: null,
    storeId: tab.cookieStoreId,
    partitionKey: {},
  });
  assert.deepEqual(
    buildCookieRemovalDetails(
      {
        domain: ".example.com",
        path: "/account",
        name: "session",
        secure: true,
        firstPartyDomain: "",
        partitionKey: { topLevelSite: "https://example.com" },
      },
      tab.cookieStoreId,
    ),
    {
      url: "https://example.com/account",
      name: "session",
      storeId: tab.cookieStoreId,
      firstPartyDomain: "",
      partitionKey: { topLevelSite: "https://example.com" },
    },
  );
});

test("shortcut semantics are independent from UI code", () => {
  assert.equal(
    getFixedShortcutCommandDescription(OPEN_CURRENT_CONTAINER_TAB_COMMAND),
    "Open a new tab in the current container",
  );
  assert.equal(
    captureShortcutFromEventData({ code: "KeyK", key: "k", ctrlKey: true }),
    "Ctrl+K",
  );
});

test("tab rules accept only actionable web pages", () => {
  assert.equal(canReopenTabUrl("https://example.com/"), true);
  assert.equal(canReopenTabUrl("about:config"), false);
  assert.deepEqual(
    getActionableTabValidation(
      { active: true, url: "moz-extension://test/options.html" },
      "moz-extension://test/",
    ),
    { valid: false, reason: "The active tab is this extension page" },
  );
});

test("options targets round-trip stable card identifiers", () => {
  const targetId = "firefox-container-2 & work";
  const hash = buildOptionsTargetHash("containers", targetId);
  assert.equal(hash, "#containers?focus=firefox-container-2+%26+work");
  assert.deepEqual(parseOptionsTarget(hash), {
    tabId: "containers",
    targetId,
  });
  assert.equal(parseOptionsTarget("#unknown?focus=proxy-1"), null);
  assert.equal(
    buildOptionsTargetUrl(
      { runtime: { getURL: (path) => `moz-extension://test/${path}` } },
      "proxies",
      "proxy-1",
    ),
    "moz-extension://test/options/app.html#proxies?focus=proxy-1",
  );
  assert.equal(shouldHandleOptionsLinkClick({ button: 0 }), true);
  for (const event of [
    null,
    { button: 1 },
    { button: 0, ctrlKey: true },
    { button: 0, metaKey: true },
    { button: 0, shiftKey: true },
    { button: 0, altKey: true },
  ]) {
    assert.equal(shouldHandleOptionsLinkClick(event), false);
  }
});

test("compiled proxy routing exposes the same effective route to the UI", () => {
  const config = Shared.normalizeConfig({
    proxies: [{
      id: "proxy-1",
      title: "Local proxy",
      type: "http",
      host: "127.0.0.1",
      port: 8080,
      doNotProxyLocal: true,
      bypass: {
        customHostsEnabled: true,
        customHosts: ["example.com"],
      },
    }],
    containerSettings: {
      "firefox-container-1": { proxyId: "proxy-1" },
    },
  });
  const runtime = Shared.compileProxyRuntime(config);
  const route = (url) => Shared.resolveCompiledProxyRoute(
    runtime,
    Shared.buildRequestContext({
      cookieStoreId: "firefox-container-1",
      method: "GET",
      url,
    }),
  );

  assert.equal(route("https://mozilla.org/").kind, "proxy");
  assert.equal(route("https://example.com/").reason, "custom-host");
  assert.equal(route("http://localhost/").reason, "local-host");
  assert.deepEqual(
    Shared.resolveCompiledProxyRoute(
      runtime,
      Shared.buildRequestContext({
        cookieStoreId: FIREFOX_DEFAULT_CONTAINER,
        method: "GET",
        url: "https://example.com/",
      }),
    ).kind,
    "direct",
  );
});
