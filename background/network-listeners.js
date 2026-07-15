export function createNetworkListenerManager(deps) {
    const { state, browser, Shared, requestHandlers } = deps;

    function addListenerOnce(target, key, listener, filter, extraInfoSpec) {
      if (state.listeners[key]) {
        return;
      }

      if (extraInfoSpec) {
        target.addListener(listener, filter, extraInfoSpec);
      } else {
        target.addListener(listener, filter);
      }

      state.listeners[key] = true;
    }

    function getNetworkListenerFilterCandidates() {
      return [
        Shared.NETWORK_REQUEST_URL_PATTERNS,
        ["http://*/*", "https://*/*"],
        Shared.REQUEST_URL_PATTERNS,
      ];
    }

    function addNetworkListenerOnce(target, key, listener, extraInfoSpec) {
      if (state.listeners[key]) {
        return;
      }

      const candidates = state.networkListenerPatternsByKey[key]
        ? [state.networkListenerPatternsByKey[key]]
        : getNetworkListenerFilterCandidates();
      let lastError = null;

      candidates.some((patterns) => {
        try {
          addListenerOnce(target, key, listener, { urls: patterns }, extraInfoSpec);
          state.networkListenerPatternsByKey[key] = patterns.slice();
          return true;
        } catch (error) {
          lastError = error;
          return false;
        }
      });

      if (!state.listeners[key] && lastError) {
        throw lastError;
      }
    }

    function syncNetworkListeners() {
      // Persistent event-page registration requires unconditional startup binds.
      addNetworkListenerOnce(
        browser.proxy.onRequest,
        "proxy",
        requestHandlers.setProxy,
      );
      addNetworkListenerOnce(
        browser.webRequest.onBeforeSendHeaders,
        "headers",
        requestHandlers.addHeaders,
        ["blocking", "requestHeaders"],
      );
      addNetworkListenerOnce(
        browser.webRequest.onAuthRequired,
        "auth",
        requestHandlers.onAuthRequired,
        ["blocking"],
      );
      addNetworkListenerOnce(
        browser.webRequest.onBeforeRequest,
        "hostRules",
        requestHandlers.enforceHostRules,
        ["blocking"],
      );
    }

    return {
      syncNetworkListeners,
    };
  }
