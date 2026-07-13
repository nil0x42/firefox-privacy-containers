export function createContainerCache(deps) {
    const { state, browser, Shared } = deps;

    function setContainerCache(containers) {
      state.containers = containers;
      state.containerMetaById = new Map(
        containers.map((container) => [
          container.cookieStoreId,
          {
            name: container.name,
            color: container.color,
            iconUrl: container.iconUrl,
          },
        ]),
      );
    }

    async function refreshContainerCache() {
      setContainerCache(await browser.contextualIdentities.query({}));
    }

    function upsertContainerCache(contextualIdentity) {
      const nextContainer = {
        cookieStoreId: contextualIdentity.cookieStoreId,
        name: contextualIdentity.name,
        color: contextualIdentity.color,
        icon: contextualIdentity.icon,
        iconUrl: contextualIdentity.iconUrl,
      };
      const index = state.containers.findIndex(
        (container) => container.cookieStoreId === contextualIdentity.cookieStoreId,
      );

      if (index === -1) {
        state.containers.push(nextContainer);
      } else {
        state.containers[index] = {
          ...state.containers[index],
          ...nextContainer,
        };
      }

      state.containerMetaById.set(contextualIdentity.cookieStoreId, {
        name: contextualIdentity.name,
        color: contextualIdentity.color,
        iconUrl: contextualIdentity.iconUrl,
      });
    }

    function removeContainerFromCache(cookieStoreId) {
      state.containerMetaById.delete(cookieStoreId);
      state.containers = state.containers.filter(
        (container) => container.cookieStoreId !== cookieStoreId,
      );
    }

    function getContainerMeta(cookieStoreId) {
      return state.containerMetaById.get(cookieStoreId) || null;
    }

    function getContainerName(cookieStoreId) {
      if (!cookieStoreId) {
        return "unassigned";
      }

      if (cookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER) {
        return "Default container";
      }

      return getContainerMeta(cookieStoreId)?.name || "missing";
    }

    function getContainerDescriptor(cookieStoreId) {
      const effectiveCookieStoreId =
        cookieStoreId || Shared.FIREFOX_DEFAULT_CONTAINER;

      if (effectiveCookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER) {
        return {
          cookieStoreId: Shared.FIREFOX_DEFAULT_CONTAINER,
          name: "Default container",
          color: "",
          iconUrl: "",
          missing: false,
        };
      }

      const meta = getContainerMeta(effectiveCookieStoreId);
      if (!meta) {
        return {
          cookieStoreId: effectiveCookieStoreId,
          name: "Missing container",
          color: "",
          iconUrl: "",
          missing: true,
        };
      }

      return {
        cookieStoreId: effectiveCookieStoreId,
        name: meta.name,
        color: meta.color,
        iconUrl: meta.iconUrl,
        missing: false,
      };
    }

    function isContainerAvailable(cookieStoreId) {
      return (
        cookieStoreId === Shared.FIREFOX_DEFAULT_CONTAINER ||
        Boolean(getContainerMeta(cookieStoreId))
      );
    }

    function getAmbiguousContainerIdSet() {
      return new Set(
        Shared.getDuplicateLiveContainerGroups(state.containers).flatMap((entry) =>
          entry.containers.map((container) => container.cookieStoreId),
        ),
      );
    }

    function decorateContainerDescriptor(descriptor, ambiguousContainerIds) {
      if (!descriptor) {
        return null;
      }

      return {
        ...descriptor,
        ambiguous: ambiguousContainerIds.has(descriptor.cookieStoreId),
        technicalLabel: Shared.getContainerTechnicalLabel(descriptor.cookieStoreId),
      };
    }

    return {
      decorateContainerDescriptor,
      getAmbiguousContainerIdSet,
      getContainerDescriptor,
      getContainerMeta,
      getContainerName,
      isContainerAvailable,
      refreshContainerCache,
      removeContainerFromCache,
      setContainerCache,
      upsertContainerCache,
    };
  }
