export function createRequestHandlers(deps) {
    const {
      state,
      Shared,
      constants,
      requestContextCache,
      blockedPageStore,
    } = deps;

    function resolveProxyDecision(requestDetails) {
      const context = requestContextCache.getRequestContext(requestDetails);
      const plan =
        state.runtime.proxyRuntime.planByContainerId[context.cookieStoreId];
      if (!plan) {
        return constants.DIRECT;
      }

      if (!plan.requiresRequestTarget) {
        return plan.requestInfo || constants.DIRECT;
      }

      if (!context.target) {
        return constants.DIRECT;
      }

      if (
        plan.bypassMatcher.matchesNormalizedHost(
          context.method,
          context.normalizedHost,
        )
      ) {
        return constants.DIRECT;
      }

      if (plan.doNotProxyLocal && context.isLoopback) {
        return constants.DIRECT;
      }

      return plan.requestInfo || constants.DIRECT;
    }

    function setProxy(requestDetails) {
      return resolveProxyDecision(requestDetails);
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
          proxyInfo.host === plan.host &&
          proxyInfo.port === plan.port &&
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
      const context = requestContextCache.getRequestContext(details);
      if (
        state.runtime.proxyRuntime.invalidAssignmentByContainerId[
          context.cookieStoreId
        ]
      ) {
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
