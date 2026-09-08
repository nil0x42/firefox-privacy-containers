import { showCommandFailureNotification } from "./notifications.js";

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

    function runWhenReady(operation) {
      return lifecycle.initialize().then(operation);
    }

    function runEventWhenReady(label, operation) {
      return runWhenReady(operation).catch((error) => {
        console.error(label, error);
      });
    }

    function handleRuntimeMessage(message, sender) {
      if (!message || typeof message.type !== "string") {
        return undefined;
      }

      if (message.type === "containers-changed") {
        return runWhenReady(() =>
          lifecycle.handleContainersChangedMessage(),
        ).catch(() => ({ ok: false }));
      }

      if (message.type === "config:get") {
        return configService.getBundle().then(
          (bundle) => ({ ok: true, bundle }),
          (error) => ({ ok: false, error: serializeConfigError(error) }),
        );
      }

      if (message.type === "config:save") {
        return runWhenReady(() =>
          configService.save(message.expectedRevision, message.config),
        ).then(
          (bundle) => ({ ok: true, bundle }),
          (error) => ({ ok: false, error: serializeConfigError(error) }),
        );
      }

      if (message.type === "get-blocked-page-context") {
        return runWhenReady(() =>
          blockedPageStore.getBlockedPageContextPayload(message),
        ).then((context) => ({
          ok: true,
          context,
        }));
      }

      if (message.type === "open-blocked-url-in-container") {
        return runWhenReady(() =>
          blockedPageStore.openBlockedUrlInContainer(message, sender),
        );
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
        return runEventWhenReady("Failed to register created container", () =>
          lifecycle.handleContainerCreated(change.contextualIdentity),
        );
      });

      browser.contextualIdentities.onRemoved.addListener((change) => {
        return runEventWhenReady("Failed to clean up removed container", () =>
          lifecycle.handleContainerRemoved(
            change.contextualIdentity.cookieStoreId,
          ),
        );
      });

      browser.contextualIdentities.onUpdated.addListener((change) => {
        return runEventWhenReady("Failed to register updated container", () =>
          lifecycle.handleContainerUpdated(change.contextualIdentity),
        );
      });

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
        return runWhenReady(() => shortcuts.handleCommand(commandName)).catch(
          (error) => {
            console.error("Command failed", commandName, error);
            showCommandFailureNotification(browser, error).catch(() => undefined);
          },
        );
      });

      browser.tabs.onActivated.addListener((activeInfo) => {
        return runEventWhenReady("Failed to update activated tab badge", () =>
          badges.updateBadgeForTab(activeInfo.tabId),
        );
      });

      browser.tabs.onCreated.addListener((tab) => {
        return runEventWhenReady("Failed to register created tab", async () => {
          if (typeof tab.id === "number") {
            tabIndex.trackTab(tab);
            await badges.updateBadgeForTab(tab.id, tab);
          }
        });
      });

      browser.tabs.onRemoved.addListener((tabId) => {
        return runEventWhenReady("Failed to register removed tab", async () => {
          await blockedPageStore.removeBlockedPageEntriesForTab(tabId).catch(
            (error) => {
              console.error("Failed to remove blocked navigation contexts", error);
            },
          );
          tabIndex.untrackTab(tabId);
          state.badgeTextByTabId.delete(tabId);
        });
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
