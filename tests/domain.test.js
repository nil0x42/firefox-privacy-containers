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
