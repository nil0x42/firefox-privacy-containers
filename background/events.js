export function createEventBinder(deps) {
    const {
      state,
      browser,
      Shared,
      lifecycle,
      blockedPageStore,
      badges,
      shortcuts,
      tabIndex,
      configService,
      requestHandlers,
    } = deps;
    let eventsBound = false;

    function handleRuntimeMessage(message, sender) {
      if (!message || typeof message.type !== "string") {
        return undefined;
      }

      if (message.type === "containers-changed") {
        return lifecycle.handleContainersChangedMessage();
      }

      if (message.type === "config:get") {
        return configService.getBundle().then(
          (bundle) => ({ ok: true, bundle }),
          (error) => ({ ok: false, error: serializeConfigError(error) }),
        );
      }

      if (message.type === "config:save") {
        return configService.save(message.expectedRevision, message.config).then(
          (bundle) => ({ ok: true, bundle }),
          (error) => ({ ok: false, error: serializeConfigError(error) }),
        );
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
      if (eventsBound) {
        return;
      }
      eventsBound = true;

      const networkFilter = { urls: Shared.NETWORK_REQUEST_URL_PATTERNS };
      browser.proxy.onRequest.addListener(requestHandlers.setProxy, networkFilter);
      browser.webRequest.onBeforeSendHeaders.addListener(
        requestHandlers.addHeaders,
        networkFilter,
        ["blocking", "requestHeaders"],
      );
      browser.webRequest.onAuthRequired.addListener(
        requestHandlers.onAuthRequired,
        networkFilter,
        ["blocking"],
      );
      browser.webRequest.onBeforeRequest.addListener(
        requestHandlers.enforceHostRules,
        networkFilter,
        ["blocking"],
      );

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

      browser.runtime.onStartup.addListener(() => {
        return Promise.all([
          lifecycle.reconcileBrowserState(),
          blockedPageStore.cleanupPersistedEntries(),
        ]).catch((error) => {
          console.error("Failed to reconcile browser state", error);
        });
      });

      browser.runtime.onInstalled.addListener(() => {
        return Promise.all([
          browser.storage.local.remove("blockedPageEntries"),
          blockedPageStore.cleanupPersistedEntries(),
          lifecycle.reconcileBrowserState(),
        ]).catch((error) => {
          console.error("Failed to reconcile installed extension state", error);
        });
      });

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
        blockedPageStore.removeBlockedPageEntriesForTab(tabId).catch((error) => {
          console.error("Failed to remove blocked navigation contexts", error);
        });
        badges.clearCommandErrorTimer(tabId);
        tabIndex.untrackTab(tabId);
        state.badgeTextByTabId.delete(tabId);
      });
    }

    function serializeConfigError(error) {
      return {
        code: error?.code || "CONFIG_NOT_READY",
        message: error?.message || "Configuration request failed.",
        validationErrors: error?.validationErrors,
        bundle: error?.bundle,
      };
    }

    return {
      bindBrowserEvents,
      handleRuntimeMessage,
    };
  }
