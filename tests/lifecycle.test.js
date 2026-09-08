import assert from "node:assert/strict";
import test from "node:test";
import { createLifecycleController } from "../background/lifecycle.js";
import Shared from "../utils/shared.js";

test("removing a container does not rebuild configuration runtime twice", async () => {
  const cookieStoreId = "firefox-container-1";
  const config = Shared.normalizeConfig({
    containerSettings: {
      [cookieStoreId]: {
        proxyId: "proxy-1",
      },
    },
    proxies: [{
      host: "127.0.0.1",
      id: "proxy-1",
      port: 8080,
      type: "http",
    }],
  });
  const state = {
    config,
    configMeta: { revision: 1 },
    runtime: {
      proxyRuntime: {
        blockedContainerIds: [],
        proxiedContainerIds: [cookieStoreId],
      },
      shortcutRuntime: {
        containerIdBySlot: [
          Shared.FIREFOX_DEFAULT_CONTAINER,
          cookieStoreId,
        ],
      },
    },
  };
  const refreshedParts = [];
  let refreshedCommandDescriptions = 0;

  const lifecycle = createLifecycleController({
    Shared,
    badges: {
      async updateBadgesForContainers() {},
    },
    browser: {},
    configService: {
      async mutate(mutator) {
        state.config = mutator(Shared.clone(state.config));
        return { config: state.config };
      },
    },
    containerCache: {
      removeContainerFromCache(id) {
        assert.strictEqual(id, cookieStoreId);
      },
    },
    runtimeManager: {
      refreshRuntimeParts(parts) {
        refreshedParts.push(parts);
        state.runtime.shortcutRuntime = {
          containerIdBySlot: [Shared.FIREFOX_DEFAULT_CONTAINER],
        };
      },
    },
    shortcuts: {
      async refreshCommandDescriptions() {
        refreshedCommandDescriptions += 1;
      },
    },
    state,
    tabIndex: {},
  });

  await lifecycle.handleContainerRemoved(cookieStoreId);

  assert.strictEqual(state.config.containerSettings[cookieStoreId], undefined);
  assert.deepStrictEqual(refreshedParts, [["shortcuts"]]);
  assert.strictEqual(refreshedCommandDescriptions, 1);
});
