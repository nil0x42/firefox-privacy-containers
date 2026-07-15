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

    function createDirectRoute(context) {
      return { kind: ROUTE_DIRECT, context };
    }

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

    function resolveProxyRoute(requestDetails) {
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
      const assignment = Shared.resolveProxyAssignment(
        state.config,
        context.cookieStoreId,
      );

      if (assignment.status === "absent") {
        return createDirectRoute(context);
      }

      const plan =
        state.runtime.proxyRuntime.planByContainerId[context.cookieStoreId];
      if (
        assignment.status !== "valid" ||
        !plan ||
        plan.proxyId !== assignment.proxyId ||
        !plan.requestInfo
      ) {
        return createBlockedRoute(context);
      }

      if (!plan.requiresRequestTarget) {
        return { kind: ROUTE_PROXY, context, plan };
      }

      if (!context.target) {
        return createBlockedRoute(context);
      }

      if (
        plan.bypassMatcher.matchesNormalizedHost(
          context.method,
          context.normalizedHost,
        )
      ) {
        return createDirectRoute(context);
      }

      if (plan.doNotProxyLocal && context.isLoopback) {
        return createDirectRoute(context);
      }

      return { kind: ROUTE_PROXY, context, plan };
    }

    function safelyResolveProxyRoute(requestDetails) {
      try {
        return resolveProxyRoute(requestDetails);
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
      const cookieStoreId = Shared.getEffectiveCookieStoreId(
        requestDetails.cookieStoreId,
      );
      const plan = state.runtime.headerRuntime.planByContainerId[cookieStoreId];
      if (!plan) {
        return {};
      }

      return {
        requestHeaders: Shared.mergeRequestHeadersWithCompiledPlan(
          requestDetails.requestHeaders,
          plan,
        ),
      };
    }

    function proxyChallengeMatches(details, plan) {
      const proxyInfo = details.proxyInfo;
      if (proxyInfo) {
        return (
          Shared.normalizeHostRule(proxyInfo.host) === plan.host &&
          Number(proxyInfo.port) === plan.port &&
          proxyInfo.type === plan.type
        );
      }

      const challenger = details.challenger;
      if (!challenger) {
        return false;
      }

      return (
        Shared.normalizeHostRule(challenger.host) === plan.host &&
        Number(challenger.port) === plan.port
      );
    }

    function onAuthRequired(details) {
      if (!details.isProxy) {
        return {};
      }

      const cookieStoreId = Shared.getEffectiveCookieStoreId(
        details && details.cookieStoreId,
      );
      const plan = state.runtime.proxyRuntime.planByContainerId[cookieStoreId];
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

    function enforceHostRules(details) {
      if (!state.routingReady) {
        return {
          cancel: true,
        };
      }

      const route = safelyResolveProxyRoute(details);
      const context = route.context;
      const proxyInfo = details && details.proxyInfo;
      const isAppliedRouteValid =
        route.kind === ROUTE_DIRECT
          ? !proxyInfo || proxyInfo.type === "direct"
          : route.kind === ROUTE_PROXY &&
            proxyInfo &&
            proxyInfo.type === route.plan.type &&
            Shared.normalizeHostRule(proxyInfo.host) === route.plan.host &&
            Number(proxyInfo.port) === route.plan.port;

      if (!isAppliedRouteValid) {
        return {
          cancel: true,
        };
      }

      if (!state.runtime.hostRuleRuntime.hasAnyEnabledRules) {
        return {};
      }

      if (!context.normalizedHost) {
        return {};
      }

      const decision = Shared.getHostRuleDecisionForNormalizedHost(
        state.runtime.hostRuleRuntime,
        context.normalizedHost,
        context.cookieStoreId,
      );
      if (!decision || decision.decision !== "block") {
        return {};
      }

      if (details.type === "main_frame") {
        if (blockedPageStore.scheduleAutoReopenBlockedMainFrame(decision, details)) {
          return {
            cancel: true,
          };
        }

        const entryId = blockedPageStore.createBlockedPageEntry(decision, details);
        return {
          redirectUrl: blockedPageStore.buildBlockedPageUrl(entryId),
        };
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
