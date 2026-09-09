import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import Shared from "../utils/shared.js";
import { main } from "../options/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const optionsHtml = fs.readFileSync(
  path.join(__dirname, "..", "options", "app.html"),
  "utf8",
);

test("initializes the options page from Firefox-owned state", async () => {
  const dom = new JSDOM(optionsHtml, {
    pretendToBeVisual: true,
    url: "moz-extension://test/options/app.html#containers?focus=firefox-container-1",
  });
  const documentValue = dom.window.document;
  const storageValues = {
    optionsUi: { activeTab: "containers" },
  };
  const bundle = Shared.createConfigBundle({
    proxies: [{
      id: "proxy-1",
      title: "Burp",
      type: "http",
      host: "127.0.0.1",
      port: 8080,
    }],
    containerSettings: {
      "firefox-container-1": { proxyId: "proxy-1" },
    },
    hostRules: [{
      id: "host-rule-1",
      name: "Example sites",
      enabled: true,
      mode: "blacklist",
      patterns: ["example.com"],
      exceptions: ["firefox-container-1"],
    }],
  }, {
    revision: 4,
    writer: "background",
  });
  const containers = [{
    color: "blue",
    cookieStoreId: "firefox-container-1",
    icon: "briefcase",
    iconUrl: "resource://usercontext-content/briefcase.svg",
    name: "Work",
  }];
  let savedRevision = bundle.meta.revision;

  Object.defineProperty(dom.window.navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name, task) => task(),
    },
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    font: "",
    measureText: (value) => ({ width: String(value).length * 8 }),
  });
  dom.window.scrollTo = () => undefined;

  const previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  globalThis.window = dom.window;
  globalThis.document = documentValue;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.Node = dom.window.Node;
  globalThis.browser = {
    commands: {
      async getAll() {
        return [];
      },
      onChanged: { addListener() {} },
      async update() {},
    },
    contextualIdentities: {
      async getSupportedColors() {
        return [{ color: "blue", colorCode: "#218bff" }];
      },
      async getSupportedIcons() {
        return [{ icon: "briefcase", iconUrl: containers[0].iconUrl }];
      },
      async query() {
        return containers;
      },
    },
    runtime: {
      getURL(pathname) {
        return `moz-extension://test/${pathname}`;
      },
      async getPlatformInfo() {
        return { os: "linux" };
      },
      async sendMessage(message) {
        if (message.type === "config:get") {
          return { ok: true, bundle };
        }
        if (message.type === "config:save") {
          savedRevision += 1;
          return {
            ok: true,
            bundle: Shared.createConfigBundle(message.config, {
              revision: savedRevision,
              writer: "options",
            }),
          };
        }
        throw new Error(`Unexpected message: ${message.type}`);
      },
    },
    storage: {
      local: {
        async get(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requested
              .filter((key) => Object.hasOwn(storageValues, key))
              .map((key) => [key, storageValues[key]]),
          );
        },
        async remove(key) {
          delete storageValues[key];
        },
        async set(values) {
          Object.assign(storageValues, values);
        },
      },
      onChanged: { addListener() {} },
    },
  };

  try {
    await main();

    assert.strictEqual(documentValue.querySelectorAll(".tab-button").length, 3);
    assert.strictEqual(
      documentValue.querySelectorAll(".container-card").length,
      2,
    );
    assert.match(documentValue.getElementById("app").textContent, /Default container/);
    assert.strictEqual(
      [...documentValue.querySelectorAll(".card-title-input")]
        .some((input) => input.value === "Work"),
      true,
    );
    assert.strictEqual(
      documentValue.querySelectorAll("#config-transfer-actions button").length,
      2,
    );
    assert.strictEqual(
      documentValue
        .querySelector('[data-cookie-store-id="firefox-container-1"]')
        .classList.contains("is-navigation-target"),
      true,
    );

    const getTabButton = (title) => [...documentValue.querySelectorAll(".tab-button")]
      .find((button) => button.textContent.includes(title));
    getTabButton("Proxies").click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    assert.strictEqual(
      documentValue.querySelector(".tab-layout").dataset.activeTab,
      "proxies",
      documentValue.getElementById("status").textContent,
    );

    const proxyContainerLink = documentValue.querySelector(
      ".proxy-card .host-rule-tag-link",
    );
    assert.ok(proxyContainerLink, documentValue.querySelector(".proxy-card").textContent);
    assert.strictEqual(
      proxyContainerLink.href,
      "moz-extension://test/options/app.html#containers?focus=firefox-container-1",
    );
    const proxyCard = documentValue.querySelector(".proxy-card");
    const typeSelect = proxyCard.querySelector("select");
    typeSelect.value = "socks";
    typeSelect.dispatchEvent(new dom.window.Event("change"));
    const proxyToggles = [...proxyCard.querySelectorAll('input[type="checkbox"]')];
    proxyToggles.slice(0, 4).forEach((toggle) => {
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new dom.window.Event("change"));
    });
    typeSelect.value = "http";
    typeSelect.dispatchEvent(new dom.window.Event("change"));
    proxyToggles[0].checked = true;
    proxyToggles[0].dispatchEvent(new dom.window.Event("change"));
    const proxyHostInput = proxyCard.querySelector('input[placeholder="127.0.0.1"]');
    proxyHostInput.value = "";
    proxyHostInput.dispatchEvent(new dom.window.Event("input"));
    proxyHostInput.value = "127.0.0.1";
    proxyHostInput.dispatchEvent(new dom.window.Event("input"));
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    const modifiedClick = new dom.window.MouseEvent("click", {
      button: 0,
      cancelable: true,
      ctrlKey: true,
    });
    proxyContainerLink.onclick(modifiedClick);
    assert.strictEqual(modifiedClick.defaultPrevented, false);
    for (const modifier of ["metaKey", "shiftKey", "altKey"]) {
      const event = new dom.window.MouseEvent("click", {
        button: 0,
        cancelable: true,
        [modifier]: true,
      });
      proxyContainerLink.onclick(event);
      assert.strictEqual(event.defaultPrevented, false);
    }
    const nonPrimaryClick = new dom.window.MouseEvent("click", {
      button: 1,
      cancelable: true,
    });
    proxyContainerLink.onclick(nonPrimaryClick);
    assert.strictEqual(nonPrimaryClick.defaultPrevented, false);

    proxyContainerLink.click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    assert.strictEqual(
      documentValue.querySelector(".tab-layout").dataset.activeTab,
      "containers",
    );
    assert.strictEqual(
      documentValue
        .querySelector('[data-cookie-store-id="firefox-container-1"]')
        .classList.contains("is-navigation-target"),
      true,
    );

    getTabButton("Host Rules").click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    const exceptionLink = documentValue.querySelector(
      ".host-rule-exceptions .host-rule-tag-link",
    );
    const modeButtons = documentValue.querySelectorAll(".host-rule-mode-button");
    modeButtons[1].click();
    modeButtons[0].click();
    assert.strictEqual(exceptionLink.href, proxyContainerLink.href);
    assert.ok(
      exceptionLink.closest(".host-rule-tag").querySelector(".host-rule-tag-remove"),
    );
    exceptionLink.click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    assert.strictEqual(
      documentValue.querySelector(".tab-layout").dataset.activeTab,
      "containers",
    );

    getTabButton("Host Rules").click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    documentValue.querySelector(".host-rule-tag-remove").click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    assert.strictEqual(
      documentValue.querySelector(".host-rule-exceptions .host-rule-tag"),
      null,
    );

    dom.window.history.pushState(null, "", "#unknown?focus=missing");
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    dom.window.history.pushState(null, "", "#proxies?focus=missing");
    dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    assert.match(
      documentValue.getElementById("status").textContent,
      /no longer exists/,
    );

    Object.defineProperties(documentValue, {
      hidden: { configurable: true, value: true },
      visibilityState: { configurable: true, value: "hidden" },
    });
    const hiddenTargetLink = documentValue.querySelector(
      ".proxy-card .host-rule-tag-link",
    );
    hiddenTargetLink.click();
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 30);
    });
    dom.window.matchMedia = () => ({ matches: true });
    Object.defineProperties(documentValue, {
      hidden: { configurable: true, value: false },
      visibilityState: { configurable: true, value: "visible" },
    });
    documentValue.dispatchEvent(new dom.window.Event("visibilitychange"));
    assert.strictEqual(
      documentValue
        .querySelector('[data-cookie-store-id="firefox-container-1"]')
        .classList.contains("is-navigation-target"),
      true,
    );
  } finally {
    dom.window.close();
    delete globalThis.browser;
    delete globalThis.document;
    delete globalThis.HTMLElement;
    delete globalThis.HTMLButtonElement;
    delete globalThis.HTMLInputElement;
    delete globalThis.HTMLTextAreaElement;
    delete globalThis.Node;
    delete globalThis.window;
    if (previousNavigator) {
      Object.defineProperty(globalThis, "navigator", previousNavigator);
    } else {
      delete globalThis.navigator;
    }
  }
});
