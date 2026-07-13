export function createRequestContextCache(deps) {
    const { state, Shared } = deps;

    function normalizeMessageText(value) {
      return value == null ? "" : String(value).trim();
    }

    function doesSlotMatch(slot, requestId, cookieStoreId, method, url) {
      return Boolean(
        slot &&
          slot.context &&
          slot.requestId === requestId &&
          slot.cookieStoreId === cookieStoreId &&
          slot.method === method &&
          slot.url === url,
      );
    }

    function writeSlot(slot, requestId, cookieStoreId, method, url, context) {
      slot.requestId = requestId;
      slot.cookieStoreId = cookieStoreId;
      slot.method = method;
      slot.url = url;
      slot.context = context;
    }

    function promoteSecondarySlot() {
      const previousPrimary = state.requestContextCachePrimary;
      state.requestContextCachePrimary = state.requestContextCacheSecondary;
      state.requestContextCacheSecondary = previousPrimary;
    }

    function getRequestContext(requestDetails) {
      const requestId = normalizeMessageText(requestDetails && requestDetails.requestId);
      if (!requestId) {
        return Shared.buildRequestContext(requestDetails);
      }

      const cookieStoreId = Shared.getEffectiveCookieStoreId(
        requestDetails && requestDetails.cookieStoreId,
      );
      const method =
        requestDetails && typeof requestDetails.method === "string"
          ? requestDetails.method.toUpperCase()
          : "GET";
      const url = normalizeMessageText(requestDetails && requestDetails.url);

      if (
        doesSlotMatch(
          state.requestContextCachePrimary,
          requestId,
          cookieStoreId,
          method,
          url,
        )
      ) {
        return state.requestContextCachePrimary.context;
      }

      if (
        doesSlotMatch(
          state.requestContextCacheSecondary,
          requestId,
          cookieStoreId,
          method,
          url,
        )
      ) {
        promoteSecondarySlot();
        return state.requestContextCachePrimary.context;
      }

      const context = Shared.buildRequestContext(requestDetails);
      writeSlot(
        state.requestContextCacheSecondary,
        state.requestContextCachePrimary.requestId,
        state.requestContextCachePrimary.cookieStoreId,
        state.requestContextCachePrimary.method,
        state.requestContextCachePrimary.url,
        state.requestContextCachePrimary.context,
      );
      writeSlot(
        state.requestContextCachePrimary,
        requestId,
        cookieStoreId,
        method,
        url,
        context,
      );
      return context;
    }

    return {
      getRequestContext,
      normalizeMessageText,
    };
  }
