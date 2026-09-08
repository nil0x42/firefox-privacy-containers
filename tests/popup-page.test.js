import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { main } from "../popup/popup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const popupHtml = fs.readFileSync(
  path.join(__dirname, "..", "popup", "popup.html"),
  "utf8",
);

test("renders and runs popup actions for the active web tab", async () => {
  const dom = new JSDOM(popupHtml, {
    url: "moz-extension://test/popup/popup.html",
  });
  const documentValue = dom.window.document;
  const executedScripts = [];

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.browser = {
    runtime: {
      getURL: (value) => `moz-extension://test/${value}`,
      openOptionsPage: async () => undefined,
    },
    scripting: {
      async executeScript(details) {
        executedScripts.push(details);
      },
    },
    tabs: {
      async query() {
        return [{
          active: true,
          cookieStoreId: "firefox-container-1",
          id: 17,
          title: "Example page",
          url: "https://example.com/path",
        }];
      },
    },
  };

  try {
    await main();

    assert.strictEqual(
      documentValue.getElementById("target-title").textContent,
      "Example page",
    );
    assert.strictEqual(
      documentValue.getElementById("target-meta").textContent,
      "example.com",
    );

    const actionButtons = [
      ...documentValue.querySelectorAll(".action-trigger"),
    ];
    assert.strictEqual(actionButtons.length, 7);
    assert.strictEqual(actionButtons.every((button) => !button.disabled), true);

    actionButtons[0].click();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    assert.strictEqual(executedScripts.length, 1);
    assert.deepStrictEqual(executedScripts[0].target, { tabId: 17 });
    assert.strictEqual(typeof executedScripts[0].func, "function");
    assert.strictEqual(
      documentValue.getElementById("status").textContent,
      "Paste blocking bypassed for example.com.",
    );
    assert.strictEqual(actionButtons.every((button) => !button.disabled), true);
  } finally {
    dom.window.close();
    delete globalThis.browser;
    delete globalThis.document;
    delete globalThis.window;
  }
});
