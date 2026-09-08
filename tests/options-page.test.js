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
    url: "moz-extension://test/options/app.html",
  });
  const documentValue = dom.window.document;
  const storageValues = {
    optionsUi: { activeTab: "containers" },
  };
  const bundle = Shared.createConfigBundle(Shared.createDefaultConfig(), {
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
      async getPlatformInfo() {
        return { os: "linux" };
      },
      async sendMessage(message) {
        if (message.type === "config:get") {
          return { ok: true, bundle };
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
