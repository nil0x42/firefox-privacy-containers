export function createLifecycleController(deps) {
    const {
      state,
      browser,
      Shared,
      constants,
      runtimeManager,
      containerCache,
      tabIndex,
      badges,
      shortcuts,
    } = deps;

    async function refreshTabCache() {
      const tabs = await browser.tabs.query({});
      tabIndex.setTrackedTabs(tabs);
      return tabs;
    }

    async function mutateConfigWithRetry(mutator, writerId) {
      let baseBundle = Shared.createConfigBundle(state.config, state.configMeta);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const nextConfig = mutator(Shared.clone(baseBundle.config));

        try {
          const savedBundle = await Shared.saveConfigBundle(
            baseBundle.meta.revision,
            nextConfig,
            writerId,
          );
          runtimeManager.applyConfigBundle(savedBundle);
          return savedBundle.config;
        } catch (error) {
          if (error.code !== "CONFIG_CONFLICT" || attempt === 1) {
            throw error;
          }

          baseBundle = await Shared.loadConfigBundle();
        }
      }

      return state.config;
    }

    function haveBadgeAssignmentsChanged(previousProxyRuntime, nextProxyRuntime) {
      const previousIds = [
        ...((previousProxyRuntime && previousProxyRuntime.proxiedContainerIds) || []),
        ...((previousProxyRuntime && previousProxyRuntime.blockedContainerIds) || []),
      ];
      const nextIds = [
        ...((nextProxyRuntime && nextProxyRuntime.proxiedContainerIds) || []),
        ...((nextProxyRuntime && nextProxyRuntime.blockedContainerIds) || []),
      ];

      if (previousIds.length !== nextIds.length) {
        return true;
      }

      const nextSet = new Set(nextIds);
      return previousIds.some((cookieStoreId) => !nextSet.has(cookieStoreId));
    }

    function haveContainerSlotsChanged(previousSlotIds, nextSlotIds) {
      if (previousSlotIds.length !== nextSlotIds.length) {
        return true;
      }

      return previousSlotIds.some(
        (cookieStoreId, index) => cookieStoreId !== nextSlotIds[index],
      );
    }

    function shouldRebuildHeadersForContainerUpdate(
      previousMeta,
      nextMeta,
      cookieStoreId,
    ) {
      if (!previousMeta || !nextMeta) {
        return true;
      }

      if (previousMeta.color === nextMeta.color) {
        return false;
      }

      const setting = state.config.containerSettings[cookieStoreId];
      return Boolean(setting && setting.pwnFoxColorEnabled);
    }

    async function handleConfigChanged(newConfig) {
      const nextBundle = Shared.normalizeConfigBundle(newConfig);
      if (nextBundle.meta.revision <= state.configMeta.revision) {
        return;
      }

      const previousConfig = state.config;
      const previousProxyRuntime = state.runtime.proxyRuntime;
      runtimeManager.applyConfigBundle(nextBundle);
      const parts = runtimeManager.getConfigRuntimePartsToRefresh(
        previousConfig,
        state.config,
      );
      if (!parts.length) {
        return;
      }

      runtimeManager.refreshRuntimeParts(parts);

      if (
        parts.includes("proxy") &&
        haveBadgeAssignmentsChanged(
          previousProxyRuntime,
          state.runtime.proxyRuntime,
        )
      ) {
        const changedContainerIds = new Set([
          ...(previousProxyRuntime.proxiedContainerIds || []),
          ...(previousProxyRuntime.blockedContainerIds || []),
          ...(state.runtime.proxyRuntime.proxiedContainerIds || []),
          ...(state.runtime.proxyRuntime.blockedContainerIds || []),
        ]);
        await badges.updateBadgesForContainers(changedContainerIds);
      }
    }

    async function handleContainerCacheChanged(previousSlotIds, options) {
      const parts = new Set(["shortcuts"]);

      if (!options || options.rebuildHeaders !== false) {
        parts.add("headers");
      }

      runtimeManager.refreshRuntimeParts(Array.from(parts));
      const nextSlotIds = state.runtime.shortcutRuntime.containerIdBySlot;

      if (
        haveContainerSlotsChanged(previousSlotIds, nextSlotIds) ||
        Boolean(options && options.refreshCommands)
      ) {
        await shortcuts.refreshCommandDescriptions();
      }
    }

    async function cleanupRemovedContainer(cookieStoreId) {
      const previousConfig = state.config;
      const previousProxyRuntime = state.runtime.proxyRuntime;
      const previousSlotIds =
        state.runtime.shortcutRuntime.containerIdBySlot.slice();
      const hadSetting = Boolean(state.config.containerSettings[cookieStoreId]);
      containerCache.removeContainerFromCache(cookieStoreId);

      if (hadSetting) {
        await mutateConfigWithRetry(
          (config) => Shared.cleanupRemovedContainer(config, cookieStoreId),
          constants.BACKGROUND_WRITER_ID,
        );
      }

      const parts = new Set(["headers", "shortcuts"]);
      runtimeManager
        .getConfigRuntimePartsToRefresh(previousConfig, state.config)
        .forEach((part) => {
          parts.add(part);
        });
      runtimeManager.refreshRuntimeParts(Array.from(parts));

      if (
        parts.has("proxy") &&
        haveBadgeAssignmentsChanged(
          previousProxyRuntime,
          state.runtime.proxyRuntime,
        )
      ) {
        await badges.updateBadgesForContainers(
          new Set([
            ...(previousProxyRuntime.proxiedContainerIds || []),
            ...(previousProxyRuntime.blockedContainerIds || []),
            ...(state.runtime.proxyRuntime.proxiedContainerIds || []),
            ...(state.runtime.proxyRuntime.blockedContainerIds || []),
          ]),
        );
      }

      if (
        haveContainerSlotsChanged(
          previousSlotIds,
          state.runtime.shortcutRuntime.containerIdBySlot,
        )
      ) {
        await shortcuts.refreshCommandDescriptions();
      }
    }

    async function handleContainersChangedMessage() {
      const previousSlotIds =
        state.runtime.shortcutRuntime.containerIdBySlot.slice();
      try {
        await containerCache.refreshContainerCache();
        await handleContainerCacheChanged(previousSlotIds, {
          rebuildHeaders: true,
          refreshCommands: true,
        });
        return { ok: true };
      } catch (_) {
        return { ok: false };
      }
    }

    async function handleContainerCreated(contextualIdentity) {
      const previousSlotIds =
        state.runtime.shortcutRuntime.containerIdBySlot.slice();
      containerCache.upsertContainerCache(contextualIdentity);
      await handleContainerCacheChanged(previousSlotIds, {
        rebuildHeaders: true,
        refreshCommands: true,
      });
    }

    async function handleContainerUpdated(contextualIdentity) {
      const previousSlotIds =
        state.runtime.shortcutRuntime.containerIdBySlot.slice();
      const previousMeta = containerCache.getContainerMeta(
        contextualIdentity.cookieStoreId,
      );
      containerCache.upsertContainerCache(contextualIdentity);
      await handleContainerCacheChanged(previousSlotIds, {
        rebuildHeaders: shouldRebuildHeadersForContainerUpdate(
          previousMeta,
          containerCache.getContainerMeta(contextualIdentity.cookieStoreId),
          contextualIdentity.cookieStoreId,
        ),
        refreshCommands:
          !previousMeta || previousMeta.name !== contextualIdentity.name,
      });
    }

    async function handleContainerRemoved(cookieStoreId) {
      await cleanupRemovedContainer(cookieStoreId);
    }

    async function initialize() {
      runtimeManager.applyConfigBundle(await Shared.loadConfigBundle());
      await Promise.all([containerCache.refreshContainerCache(), refreshTabCache()]);
      runtimeManager.rebuildRuntime();
      await Promise.all([
        badges.updateAllBadges(),
        shortcuts.refreshCommandDescriptions(),
      ]);
    }

    return {
      handleConfigChanged,
      handleContainerCreated,
      handleContainerRemoved,
      handleContainerUpdated,
      handleContainersChangedMessage,
      initialize,
      mutateConfigWithRetry,
    };
  }
