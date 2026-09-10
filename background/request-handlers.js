import {
  ensureRequestTarget,
  getEffectiveCookieStoreId,
  normalizeHostRule,
} from "../domain/hosts.js";
import { mergeRequestHeadersWithCompiledPlan } from "../domain/headers.js";

export function createRequestHandlers(deps) {
    const {
      state,
      Shared,
      constants,
      requestContextCache,
      blockedPageStore,
      waitForRoutingReady,
    } = deps;

    const ROUTE_DIRECT = "direct";
    const ROUTE_PROXY = "proxy";
    const ROUTE_BLOCKED = "blocked";

    function createBlockedRoute(context) {
      return { kind: ROUTE_BLOCKED, context };
    }

    function getRoutingCookieStoreId(requestDetails, context) {
      if (
        requestDetails &&
        typeof requestDetails.cookieStoreId === "string" &&
        requestDetails.cookieStoreId.trim()
      ) {
        return context.cookieStoreId;
      }

      const tabId = requestDetails && requestDetails.tabId;
      if (Number.isInteger(tabId) && tabId >= 0) {
        return state.tabCookieStoreIdByTabId.get(tabId) || "";
      }

      return context.cookieStoreId;
    }

    function resolveProxyRoute(requestDetails, runtime = state.runtime) {
      const cachedContext = requestContextCache.getRequestContext(requestDetails);
      const cookieStoreId = getRoutingCookieStoreId(
        requestDetails,
        cachedContext,
      );
      if (!cookieStoreId) {
        return createBlockedRoute(cachedContext);
      }
      const context =
        cookieStoreId === cachedContext.cookieStoreId
          ? cachedContext
          : { ...cachedContext, cookieStoreId };
      return Shared.resolveCompiledProxyRoute(runtime.proxyRuntime, context);
    }

    function safelyResolveProxyRoute(requestDetails, runtime = state.runtime) {
      try {
        return resolveProxyRoute(requestDetails, runtime);
      } catch (error) {
        console.error(
          "Failed to resolve a proxy route; blocking the request",
          error,
        );
        return createBlockedRoute(null);
      }
    }

    function createProxyConnectionIsolationKey(route) {
      return [
        constants.PROXY_CONNECTION_ISOLATION_PREFIX,
        route.context.cookieStoreId,
        route.plan.proxyId,
      ].join(":");
    }

    function createTerminalProxyResult(route) {
      return [
        {
          ...route.plan.requestInfo,
          failoverTimeout: constants.PROXY_FAILOVER_TIMEOUT_SECONDS,
          connectionIsolationKey: createProxyConnectionIsolationKey(route),
        },
        null,
      ];
    }

    function createFailClosedProxyResult() {
      // onBeforeRequest cancels this route; loopback is the terminal safety net.
      return [
        {
          type: "http",
          host: "127.0.0.1",
          port: 1,
          failoverTimeout: constants.PROXY_FAILOVER_TIMEOUT_SECONDS,
          connectionIsolationKey: `${constants.PROXY_CONNECTION_ISOLATION_PREFIX}:blocked`,
        },
        null,
      ];
    }

    function routeToProxyResult(route) {
      if (route.kind === ROUTE_DIRECT) {
        // `null` explicitly removes Firefox's pre-existing proxy chain.
        return null;
      }
      if (route.kind === ROUTE_PROXY) {
        return createTerminalProxyResult(route);
      }
      return createFailClosedProxyResult();
    }

    function safelyCreateProxyResult(requestDetails) {
      try {
        return routeToProxyResult(safelyResolveProxyRoute(requestDetails));
      } catch (error) {
        console.error(
          "Failed to build a proxy route; blocking the request",
          error,
        );
        return createFailClosedProxyResult();
      }
    }

    function setProxy(requestDetails) {
      if (state.routingReady) {
        return safelyCreateProxyResult(requestDetails);
      }

      try {
        return Promise.resolve(waitForRoutingReady()).then(
          (isReady) =>
            isReady && state.routingReady
              ? safelyCreateProxyResult(requestDetails)
              : createFailClosedProxyResult(),
          () => createFailClosedProxyResult(),
        );
      } catch (error) {
        console.error(
          "Failed to wait for proxy routing; blocking the request",
          error,
        );
        return createFailClosedProxyResult();
      }
    }

    function addHeaders(requestDetails) {
      const runtime = state.runtime;
      const cookieStoreId = getEffectiveCookieStoreId(
        requestDetails.cookieStoreId,
      );
      const plan = runtime.headerRuntime.planByContainerId[cookieStoreId];
      if (!plan) {
        return {};
      }

      return {
        requestHeaders: mergeRequestHeadersWithCompiledPlan(
          requestDetails.requestHeaders,
          plan,
        ),
      };
    }

    function proxyChallengeMatches(details, plan) {
      const proxyInfo = details.proxyInfo;
      if (proxyInfo) {
        return (
          normalizeHostRule(proxyInfo.host) === plan.host &&
          Number(proxyInfo.port) === plan.port &&
          proxyInfo.type === plan.type
        );
      }

      const challenger = details.challenger;
      if (!challenger) {
        return false;
      }

      return (
        normalizeHostRule(challenger.host) === plan.host &&
        Number(challenger.port) === plan.port
      );
    }

    function onAuthRequired(details) {
      if (!details.isProxy) {
        return {};
      }

      const runtime = state.runtime;
      const cookieStoreId = getEffectiveCookieStoreId(
        details && details.cookieStoreId,
      );
      const plan = runtime.proxyRuntime.planByContainerId[cookieStoreId];
      if (!plan || !plan.authCredentials) {
        return {};
      }

      if (!proxyChallengeMatches(details, plan)) {
        return {};
      }

      return {
        authCredentials: plan.authCredentials,
      };
    }

    function appliedProxyMatches(proxyInfo, requestInfo) {
      return Boolean(
        proxyInfo &&
          requestInfo &&
          proxyInfo.type === requestInfo.type &&
          normalizeHostRule(proxyInfo.host) === requestInfo.host &&
          Number(proxyInfo.port) === requestInfo.port &&
          (!Object.hasOwn(requestInfo, "proxyDNS") ||
            Boolean(proxyInfo.proxyDNS) === requestInfo.proxyDNS),
      );
    }

    function enforceHostRules(details) {
      if (!state.routingReady) {
        try {
          return Promise.resolve(waitForRoutingReady()).then(
            (isReady) =>
              isReady && state.routingReady
                ? enforceHostRules(details)
                : { cancel: true },
            () => ({ cancel: true }),
          );
        } catch (_) {
          return { cancel: true };
        }
      }

      const runtime = state.runtime;
      const route = safelyResolveProxyRoute(details, runtime);
      const context = route.context;
      const proxyInfo = details && details.proxyInfo;
      const isAppliedRouteValid =
        route.kind === ROUTE_DIRECT
          ? !proxyInfo || proxyInfo.type === "direct"
          : route.kind === ROUTE_PROXY &&
            appliedProxyMatches(proxyInfo, route.plan.requestInfo);

      if (!isAppliedRouteValid) {
        return {
          cancel: true,
        };
      }

      if (!runtime.hostRuleRuntime.hasAnyEnabledRules) {
        return {};
      }

      ensureRequestTarget(context);
      if (!context.normalizedHost) {
        return {};
      }

      const decision = Shared.getHostRuleDecisionForNormalizedHost(
        runtime.hostRuleRuntime,
        context.normalizedHost,
        context.cookieStoreId,
      );
      if (!decision || decision.decision !== "block") {
        return {};
      }

      if (details.type === "main_frame") {
        const autoReopen = blockedPageStore.scheduleAutoReopenBlockedMainFrame(
          decision,
          details,
        );
        if (autoReopen) {
          return autoReopen.then(() => ({ cancel: true }));
        }

        return blockedPageStore
          .createBlockedPageEntry(decision, details)
          .then((entryId) => ({
            redirectUrl: blockedPageStore.buildBlockedPageUrl(entryId),
          }))
          .catch((error) => {
            console.error("Failed to persist blocked navigation context", error);
            return { cancel: true };
          });
      }

      return {
        cancel: true,
      };
    }

    return {
      addHeaders,
      enforceHostRules,
      onAuthRequired,
      setProxy,
    };
  }
