import Shared from "../../utils/shared.js";
import { getConfigBundle, saveConfigBundle } from "../../options/config-client.js";
import { removeTabCookies } from "../../popup/cookies.js";

const settings = await fetch(browser.runtime.getURL("tests/firefox/settings.json")).then((reply) => reply.json());
const passed = [];
const tabs = new Set();
let current = "initialization";

function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
  throw new Error(`Timed out: ${message}`);
}

async function test(name, task) {
  current = name;
  await task();
  passed.push(name);
}

async function save(change) {
  const bundle = await getConfigBundle();
  change(bundle.config);
  return saveConfigBundle(bundle.meta.revision, bundle.config);
}

async function createTab(url, cookieStoreId = "firefox-default") {
  const tab = await browser.tabs.create({ url, cookieStoreId, active: false });
  tabs.add(tab.id);
  return tab;
}

async function page(name, cookieStoreId) {
  const url = `${settings.target}/page?case=${name}`;
  const tab = await createTab(url, cookieStoreId);
  const request = await waitFor(async () => {
    const latest = await browser.tabs.get(tab.id);
    if (latest.url !== url || latest.status !== "complete") return null;
    const [result] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const node = document.getElementById("request");
        return node ? JSON.parse(node.textContent) : null;
      },
    });
    return result.result;
  }, `load ${name}`);
  return { tab: await browser.tabs.get(tab.id), request };
}

function extensionView(url) {
  return browser.extension.getViews().find((view) => view.location.href === url);
}

async function observations() {
  return fetch(`${settings.control}/requests`).then((reply) => reply.json());
}

try {
  const admin = await browser.contextualIdentities.create({ name: "Test admin", color: "blue", icon: "fingerprint" });
  const user = await browser.contextualIdentities.create({ name: "Test user", color: "orange", icon: "briefcase" });

  await test("configuration persists and rejects stale writes", async () => {
    const previous = await getConfigBundle();
    const config = Shared.createDefaultConfig();
    config.proxies = [{ id: "test-proxy", title: "Local test proxy", type: "http", host: "127.0.0.1", port: settings.proxyPort, doNotProxyLocal: false }];
    config.globalHeaders = [{ name: "X-Test-Global", value: "global" }, { name: "X-Test-Role", value: "global" }];
    config.containerSettings = {
      [admin.cookieStoreId]: { proxyId: "test-proxy", headers: [{ name: "X-Test-Role", value: "admin" }], pwnFoxColorEnabled: true },
      [user.cookieStoreId]: { headers: [{ name: "X-Test-Role", value: "user" }] },
    };
    const saved = await saveConfigBundle(previous.meta.revision, config);
    const stored = await browser.storage.local.get(Shared.CONFIG_KEY);
    equal(stored[Shared.CONFIG_KEY].meta.revision, saved.meta.revision, "persisted revision");
    equal(stored[Shared.CONFIG_KEY].config.proxies[0].port, settings.proxyPort, "persisted proxy");
    let rejected = false;
    try {
      await saveConfigBundle(previous.meta.revision, config);
    } catch (error) {
      equal(error.code, "CONFIG_CONFLICT", "stale save error");
      rejected = true;
    }
    equal(rejected, true, "stale write rejected");
  });

  await test("container cookies stay separate on real requests", async () => {
    for (const [container, value] of [[admin, "admin"], [user, "user"]]) {
      await browser.cookies.set({ url: settings.target, name: "session", value, storeId: container.cookieStoreId });
    }
    const first = await page("admin-session", admin.cookieStoreId);
    const second = await page("user-session", user.cookieStoreId);
    equal(first.request.headers.cookie, "session=admin", "admin cookies");
    equal(second.request.headers.cookie, "session=user", "user cookies");
    equal((await page("default-session")).request.headers.cookie, undefined, "default cookies");
  });

  await test("global and per-container headers reach the server", async () => {
    const { request } = await page("headers", admin.cookieStoreId);
    equal(request.headers["x-test-global"], "global", "global header");
    equal(request.headers["x-test-role"], "admin", "container override");
    equal(request.headers["x-pwnfox-color"], "blue", "PwnFox header");
    const direct = await page("default-headers");
    equal(direct.request.headers["x-test-role"], "global", "default header");
    equal(direct.request.headers["x-pwnfox-color"], undefined, "no PwnFox header outside admin");
  });

  await test("only the assigned container uses the HTTP proxy", async () => {
    equal((await page("proxied", admin.cookieStoreId)).request.route, "http", "assigned route");
    equal((await page("direct", user.cookieStoreId)).request.route, "direct", "unassigned route");
  });

  await test("localhost bypass takes effect immediately", async () => {
    await save((config) => { config.proxies[0].doNotProxyLocal = true; });
    equal((await page("bypassed", admin.cookieStoreId)).request.route, "direct", "localhost bypass");
    await save((config) => { config.proxies[0].doNotProxyLocal = false; });
    equal((await page("bypass-disabled", admin.cookieStoreId)).request.route, "http", "restored proxy");
  });

  await test("unavailable proxy never falls back to direct", async () => {
    await save((config) => { config.proxies[0].port = 1; });
    const url = `${settings.target}/page?case=proxy-down`;
    let failure;
    const listener = (details) => { if (details.url === url) failure = details.error; };
    browser.webRequest.onErrorOccurred.addListener(listener, { urls: ["<all_urls>"] });
    try {
      await createTab(url, admin.cookieStoreId);
      await waitFor(() => failure, "proxy failure event");
      equal((await observations()).some((request) => request.url.includes("case=proxy-down")), false, "no direct leak");
    } finally {
      browser.webRequest.onErrorOccurred.removeListener(listener);
      await save((config) => { config.proxies[0].port = settings.proxyPort; });
    }
  });

  let blocked;
  let blockedUrl;
  await test("Host Rules block navigation before reaching the server", async () => {
    await save((config) => {
      config.hostRules = [{ id: "test-rule", name: "Test target", enabled: true, mode: "blacklist", patterns: ["localhost"], exceptions: [admin.cookieStoreId, user.cookieStoreId] }];
    });
    blockedUrl = `${settings.target}/page?case=host-blocked`;
    blocked = await createTab(blockedUrl);
    const view = await waitFor(async () => {
      const tab = await browser.tabs.get(blocked.id);
      if (!tab.url?.startsWith(browser.runtime.getURL("blocked/blocked.html"))) return null;
      const candidate = extensionView(tab.url);
      return candidate?.document.querySelectorAll(".blocked-action-button").length === 2 && candidate;
    }, "blocked page and container choices");
    equal(view.document.getElementById("blocked-url").value, blockedUrl, "original URL on blocked page");
    equal((await observations()).some((request) => request.url.includes("case=host-blocked")), false, "blocked request did not reach server");
  });

  await test("blocked links reopen in an allowed container", async () => {
    const tab = await browser.tabs.get(blocked.id);
    const view = extensionView(tab.url);
    const link = [...view.document.querySelectorAll(".blocked-action-button")].find((node) => node.textContent.includes("Test user"));
    equal(Boolean(link), true, "allowed user link");
    link.click();
    const reopened = await waitFor(async () => (await browser.tabs.query({})).find((entry) => entry.url === blockedUrl && entry.cookieStoreId === user.cookieStoreId && entry.status === "complete"), "reopened tab");
    tabs.add(reopened.id);
    await waitFor(async () => (await observations()).some((request) => request.url.includes("case=host-blocked") && request.headers["x-test-role"] === "user"), "reopened request");
    equal((await browser.tabs.query({})).some((entry) => entry.id === blocked.id), false, "original blocked tab removed");
  });

  await test("cookie cleanup preserves other containers", async () => {
    const { tab } = await page("clear-cookies", admin.cookieStoreId);
    const removed = await removeTabCookies(browser, tab);
    equal(removed.removedCount, 1, "admin cookie removed");
    equal((await page("cleared", admin.cookieStoreId)).request.headers.cookie, undefined, "admin session cleared");
    equal((await page("preserved", user.cookieStoreId)).request.headers.cookie, "session=user", "user session preserved");
  });

  await test("options page renders saved settings and navigates sections", async () => {
    const url = browser.runtime.getURL("options/app.html");
    await createTab(url);
    const view = await waitFor(() => {
      const candidate = extensionView(url);
      return candidate?.document.querySelector(`[data-cookie-store-id="${admin.cookieStoreId}"]`) && candidate;
    }, "options container cards");
    equal([...view.document.querySelectorAll(".card-title-input")].some((input) => input.value === "Test admin"), true, "live container name");
    for (const [title, section, selector] of [["Proxies", "proxies", ".proxy-card"], ["Host Rules", "host-rules", ".host-rule-card"]]) {
      const button = [...view.document.querySelectorAll(".tab-button")].find((node) => node.textContent.includes(title));
      equal(Boolean(button), true, `${title} tab`);
      button.click();
      await waitFor(() => view.document.querySelector(".tab-layout")?.dataset.activeTab === section && view.document.querySelector(selector), `${title} saved settings`);
    }
  });

  const info = await browser.runtime.getBrowserInfo();
  await fetch(`${settings.control}/result`, { method: "POST", body: JSON.stringify({ passed, firefox: info.version }) });
} catch (error) {
  await fetch(`${settings.control}/result`, { method: "POST", body: JSON.stringify({ passed, error: `${current}: ${error.message}\n${error.stack}` }) });
} finally {
  await Promise.allSettled([...tabs].map((id) => browser.tabs.remove(id)));
}
