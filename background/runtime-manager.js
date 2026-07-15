export function createRuntimeManager(deps) {
    const {
      state,
      Shared,
      syncNetworkListeners,
      onRoutingReady = () => undefined,
    } = deps;

    function sortEntriesByKey(entries) {
      return entries
        .slice()
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    }

    function buildProxyRuntimeConfigSignature(normalizedConfig) {
      return JSON.stringify({
        proxies: normalizedConfig.proxies,
        assignments: sortEntriesByKey(
          Object.entries(normalizedConfig.containerSettings)
            .map(([cookieStoreId, setting]) => [cookieStoreId, setting.proxyId || ""])
            .filter(([, proxyId]) => Boolean(proxyId)),
        ),
      });
    }

    function buildHeaderRuntimeConfigSignature(normalizedConfig) {
      return JSON.stringify({
        globalHeaders: normalizedConfig.globalHeaders,
        containerHeaders: sortEntriesByKey(
          Object.entries(normalizedConfig.containerSettings)
            .map(([cookieStoreId, setting]) => [
              cookieStoreId,
              {
                headers: setting.headers,
                pwnFoxColorEnabled: Boolean(setting.pwnFoxColorEnabled),
              },
            ])
            .filter(
              ([, setting]) =>
                setting.pwnFoxColorEnabled ||
                (setting.headers && setting.headers.length > 0),
            ),
        ),
      });
    }

    function buildHostRuleRuntimeConfigSignature(normalizedConfig) {
      return JSON.stringify(normalizedConfig.hostRules);
    }

    function getConfigRuntimePartsToRefresh(previousConfig, nextConfig) {
      const previousNormalized = Shared.normalizeConfig(previousConfig);
      const nextNormalized = Shared.normalizeConfig(nextConfig);
      const parts = [];

      if (
        buildProxyRuntimeConfigSignature(previousNormalized) !==
        buildProxyRuntimeConfigSignature(nextNormalized)
      ) {
        parts.push("proxy");
      }

      if (
        buildHeaderRuntimeConfigSignature(previousNormalized) !==
        buildHeaderRuntimeConfigSignature(nextNormalized)
      ) {
        parts.push("headers");
      }

      if (
        buildHostRuleRuntimeConfigSignature(previousNormalized) !==
        buildHostRuleRuntimeConfigSignature(nextNormalized)
      ) {
        parts.push("hostRules");
      }

      return parts;
    }

    function refreshRuntimeParts(parts) {
      const partSet = new Set(Array.isArray(parts) ? parts : [parts]);

      if (partSet.has("proxy")) {
        state.runtime.proxyRuntime = Shared.compileProxyRuntime(state.config);
      }

      if (partSet.has("headers")) {
        state.runtime.headerRuntime = Shared.compileHeaderRuntime(
          state.config,
          state.containers,
        );
      }

      if (partSet.has("hostRules")) {
        state.runtime.hostRuleRuntime = Shared.compileHostRuleRuntime(state.config);
      }

      if (partSet.has("shortcuts")) {
        state.runtime.shortcutRuntime = Shared.compileShortcutRuntime(
          state.containers,
        );
      }

      syncNetworkListeners();
    }

    function rebuildRuntime() {
      refreshRuntimeParts(["proxy", "headers", "hostRules", "shortcuts"]);
      onRoutingReady();
    }

    function applyConfigBundle(bundle) {
      const normalizedBundle = Shared.normalizeConfigBundle(bundle);
      state.config = normalizedBundle.config;
      state.configMeta = normalizedBundle.meta;
    }

    return {
      applyConfigBundle,
      getConfigRuntimePartsToRefresh,
      rebuildRuntime,
      refreshRuntimeParts,
    };
  }
