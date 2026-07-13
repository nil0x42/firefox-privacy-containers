export function createEventBinder(deps) {
    const {
      state,
      browser,
      Shared,
      constants,
      lifecycle,
      blockedPageStore,
      badges,
      shortcuts,
      tabIndex,
    } = deps;

    function handleRuntimeMessage(message, sender) {
      if (!message || typeof message.type !== "string") {
        return undefined;
      }

      if (message.type === "containers-changed") {
        return lifecycle.handleContainersChangedMessage();
      }

      if (message.type === "get-blocked-page-context") {
        return blockedPageStore.getBlockedPageContextPayload(message).then((context) => ({
          ok: true,
          context,
        }));
      }

      if (message.type === "open-blocked-url-in-container") {
        return blockedPageStore.openBlockedUrlInContainer(message, sender);
      }

      return undefined;
    }

    function bindBrowserEvents() {
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[Shared.CONFIG_KEY]) {
          return;
        }

        const nextBundle = changes[Shared.CONFIG_KEY].newValue;
        if (
          nextBundle &&
          Shared.isConfigBundle(nextBundle) &&
          nextBundle.meta.writer === constants.BACKGROUND_WRITER_ID &&
          nextBundle.meta.revision <= state.configMeta.revision
        ) {
          return;
        }

        lifecycle.handleConfigChanged(nextBundle).catch((error) => {
          console.error("Failed to refresh config cache", error);
        });
      });

      browser.contextualIdentities.onCreated.addListener((change) => {
        lifecycle.handleContainerCreated(change.contextualIdentity).catch(() => undefined);
      });

      browser.contextualIdentities.onRemoved.addListener((change) => {
        lifecycle.handleContainerRemoved(
          change.contextualIdentity.cookieStoreId,
        ).catch((error) => {
          console.error("Failed to clean up removed container", error);
        });
      });

      if (browser.contextualIdentities.onUpdated) {
        browser.contextualIdentities.onUpdated.addListener((change) => {
          lifecycle.handleContainerUpdated(change.contextualIdentity).catch(
            () => undefined,
          );
        });
      }

      browser.runtime.onMessage.addListener(handleRuntimeMessage);

      browser.commands.onCommand.addListener((commandName) => {
        shortcuts.handleCommand(commandName).catch((error) => {
          console.error("Command failed", commandName, error);
          badges.showCommandFailure(error).catch(() => undefined);
        });
      });

      browser.tabs.onActivated.addListener((activeInfo) => {
        badges.updateBadgeForTab(activeInfo.tabId);
      });

      browser.tabs.onCreated.addListener((tab) => {
        if (typeof tab.id === "number") {
          tabIndex.trackTab(tab);
          badges.updateBadgeForTab(tab.id, tab);
        }
      });

      browser.tabs.onRemoved.addListener((tabId) => {
        blockedPageStore.removeBlockedPageEntriesForTab(tabId);
        badges.clearCommandErrorTimer(tabId);
        tabIndex.untrackTab(tabId);
        state.badgeTextByTabId.delete(tabId);
      });
    }

    return {
      bindBrowserEvents,
      handleRuntimeMessage,
    };
  }
