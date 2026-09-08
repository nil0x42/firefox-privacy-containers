import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createAllowedContainerButton, init } from "../blocked/blocked.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    globalThis.document.body.appendChild(link);

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

test("renders a validated blocked-page context as real destination links", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "blocked", "blocked.html"),
    "utf8",
  );
  const dom = new JSDOM(html, {
    url: "moz-extension://test/blocked/blocked.html?entry=blocked-2",
  });
  const documentValue = dom.window.document;
  const blockedUrl = "https://example.com/account";

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.browser = {
    runtime: {
      async sendMessage(message) {
        assert.deepStrictEqual(message, {
          type: "get-blocked-page-context",
          entry: "blocked-2",
        });
        return {
          context: {
            allowedContainers: [{
              actionLabel: "Continue in Work",
              cookieStoreId: "firefox-container-1",
              name: "Work",
            }],
            container: { name: "Personal" },
            entry: "blocked-2",
            host: "example.com",
            mode: "blacklist",
            ruleName: "Work only",
            unavailableAllowedContainers: [{ name: "Temporary" }],
            url: blockedUrl,
          },
        };
      },
    },
  };

  try {
    await init();

    assert.strictEqual(
      documentValue.getElementById("blocked-rule").textContent,
      "Work only",
    );
    assert.strictEqual(
      documentValue.getElementById("blocked-host").textContent,
      "example.com",
    );
    assert.strictEqual(
      documentValue.getElementById("blocked-url").value,
      blockedUrl,
    );
    assert.strictEqual(
      documentValue.getElementById("blocked-allowed-section").hidden,
      false,
    );
    const action = documentValue.querySelector(".blocked-action-button");
    assert.strictEqual(action.localName, "a");
    assert.strictEqual(action.href, blockedUrl);
    assert.strictEqual(action.textContent, "Continue in Work");
    assert.strictEqual(
      documentValue.getElementById("blocked-unavailable").textContent,
      "Unavailable right now: Temporary.",
    );
  } finally {
    dom.window.close();
    delete globalThis.browser;
    delete globalThis.document;
    delete globalThis.HTMLButtonElement;
    delete globalThis.HTMLInputElement;
    delete globalThis.window;
  }
});
