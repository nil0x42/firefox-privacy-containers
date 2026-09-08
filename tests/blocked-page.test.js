import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createAllowedContainerButton } from "../blocked/blocked.js";

test("keeps the blocked URL visible without allowing direct navigation", async () => {
  const dom = new JSDOM("<!doctype html><p id=blocked-error hidden></p>", {
    url: "moz-extension://test/blocked/blocked.html?entry=blocked-1",
  });
  const sentMessages = [];
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.browser = {
    runtime: {
      async sendMessage(message) {
        sentMessages.push(message);
      },
    },
  };

  try {
    const blockedUrl = "https://example.com/private";
    const link = createAllowedContainerButton(
      {
        actionLabel: "Continue in Work",
        cookieStoreId: "firefox-container-1",
        name: "Work",
      },
      "blocked-1",
      blockedUrl,
    );
    document.body.appendChild(link);

    assert.strictEqual(link.href, blockedUrl);
    assert.strictEqual(link.draggable, false);

    const modifiedClick = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    assert.strictEqual(link.dispatchEvent(modifiedClick), false);
    assert.deepStrictEqual(sentMessages, []);

    const auxiliaryClick = new dom.window.MouseEvent("auxclick", {
      bubbles: true,
      button: 1,
      cancelable: true,
    });
    assert.strictEqual(link.dispatchEvent(auxiliaryClick), false);

    const contextMenu = new dom.window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    assert.strictEqual(link.dispatchEvent(contextMenu), false);

    const regularClick = new dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    assert.strictEqual(link.dispatchEvent(regularClick), false);
    await Promise.resolve();
    assert.deepStrictEqual(sentMessages, [
      {
        type: "open-blocked-url-in-container",
        entry: "blocked-1",
        cookieStoreId: "firefox-container-1",
      },
    ]);
  } finally {
    dom.window.close();
    delete globalThis.browser;
    delete globalThis.document;
    delete globalThis.window;
  }
});
