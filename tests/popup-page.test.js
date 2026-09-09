import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { main } from "../popup/popup.js";
import Shared from "../utils/shared.js";

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
  let cookieEntries = [{ name: "one" }, { name: "two" }];
  const createdTabs = [];
  const executedScripts = [];
  const bundle = Shared.createConfigBundle({
    proxies: [{
      id: "proxy-1",
      title: "Burp",
      type: "http",
      host: "127.0.0.1",
      port: 8080,
      bypass: {
        customHostsEnabled: true,
        customHosts: ["example.com"],
      },
    }],
    containerSettings: {
      "firefox-container-1": {
        proxyId: "proxy-1",
        headers: [
          { id: "container-header-1", name: "X-Scope", value: "work" },
          { id: "container-header-2", name: "X-Shared", value: "container" },
        ],
        pwnFoxColorEnabled: true,
      },
    },
    globalHeaders: [
      { id: "global-header-1", name: "X-Shared", value: "global" },
    ],
    hostRules: [{
      id: "host-rule-1",
      name: "Example sites",
      enabled: true,
      mode: "blacklist",
      patterns: ["example.com"],
      exceptions: ["firefox-container-1"],
    }],
  }, { revision: 2, writer: "test" });
  const containers = [{
    color: "blue",
    cookieStoreId: "firefox-container-1",
    icon: "briefcase",
    iconUrl: "resource://usercontext-content/briefcase.svg",
    name: "Work",
  }];

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.browser = {
    runtime: {
      getURL: (value) => `moz-extension://test/${value}`,
      openOptionsPage: async () => undefined,
      async sendMessage(message) {
        if (message.type === "config:get") {
          return { ok: true, bundle };
        }
        throw new Error(`Unexpected message: ${message.type}`);
      },
    },
    contextualIdentities: {
      async query() {
        return containers;
      },
    },
    cookies: {
      async getAll() {
        return cookieEntries;
      },
      async remove() {
        cookieEntries = cookieEntries.slice(1);
        return {};
      },
    },
    scripting: {
      async executeScript(details) {
        executedScripts.push(details);
      },
    },
    tabs: {
      async create(details) {
        createdTabs.push(details);
        return { id: 18, ...details };
      },
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
    assert.match(documentValue.getElementById("tab-context").textContent, /Work/);
    assert.match(documentValue.getElementById("tab-context").textContent, /Burp/);
    assert.match(
      documentValue.getElementById("tab-context").textContent,
      /Direct — host bypass via Burp/,
    );
    assert.match(
      documentValue.getElementById("tab-context").textContent,
      /HTTP · 127\.0\.0\.1:8080/,
    );
    assert.match(
      documentValue.getElementById("tab-context").textContent,
      /Example sitesAllowed/,
    );
    assert.match(documentValue.getElementById("tab-context").textContent, /Cookies2/);
    const headers = documentValue.querySelector(".context-headers");
    assert.match(headers.textContent, /Headers · 3/);
    assert.match(headers.textContent, /X-Shared:container/);
    assert.doesNotMatch(headers.textContent, /X-Shared:global/);
    assert.match(headers.textContent, /X-PwnFox-Color:blue/);

    const containerLink = documentValue.querySelector(
      '.context-link[href*="#containers"]',
    );
    containerLink.click();
    containerLink.onclick(new dom.window.MouseEvent("click", {
      button: 0,
      ctrlKey: true,
    }));
    containerLink.onauxclick(new dom.window.MouseEvent("auxclick", {
      button: 1,
    }));
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    assert.strictEqual(createdTabs.length, 3);
    createdTabs.forEach((details) => {
      assert.deepStrictEqual(details, {
        active: false,
        url: "moz-extension://test/options/app.html#containers?focus=firefox-container-1",
      });
    });
    assert.strictEqual(documentValue.getElementById("tab-context").isConnected, true);

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

    actionButtons[5].click();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    assert.match(documentValue.getElementById("tab-context").textContent, /Cookies0/);
  } finally {
    dom.window.close();
    delete globalThis.browser;
    delete globalThis.document;
    delete globalThis.window;
  }
});
