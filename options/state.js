import Shared from "../utils/shared.js";
import { createId } from "../domain/ids.js";

export function createOptionsState() {
  const defaultConfig = Shared.createDefaultConfig();
  return {
    activeTab: "containers",
    colorChoices: [],
    commands: [],
    config: defaultConfig,
    containers: [],
    iconChoices: [],
    openContainerIdentityPopoverAnchorRect: null,
    openContainerIdentityPopoverCookieStoreId: "",
    openContainerIdentityPopoverPlacement: null,
    pendingInteractions: {
      containers: { reorder: null, scrollAnchor: null, insert: null },
      proxies: { reorder: null, scrollAnchor: null, insert: null },
      hostRules: { reorder: null, scrollAnchor: null, insert: null },
    },
    pendingIdentitySaves: new Map(),
    pendingRemoteBundle: null,
    pendingSaveMessage: "Saved.",
    persistedConfig: Shared.clone(defaultConfig),
    persistedMeta: Shared.createConfigBundle(defaultConfig, {}).meta,
    saveBlockedReason: "",
    draftVersion: 0,
    dirty: false,
    suppressSaveStatus: false,
    suppressCommandChangeEvents: 0,
    containerReorderInFlight: false,
    transferBusy: false,
    transferInstanceId: "",
    transferPlatform: "",
    saveInFlight: false,
    savePromise: Promise.resolve(),
    saveTimer: 0,
    writerId: createId("options"),
    pendingFocusRestore: null,
    dismissedStatusSignature: "",
    lastStatusSignature: "",
    statusIsError: false,
  };
}

export function createConfigDraftController({
  state,
  saveConfigBundle,
  setStatus,
  clearStatus,
  setConflictStatus,
  onRemoteBundleApplied = () => undefined,
  timerApi,
}) {
  function setPersistedBundle(bundle) {
    const normalizedBundle = Shared.normalizeConfigBundle(bundle);
    state.persistedConfig = normalizedBundle.config;
    state.persistedMeta = normalizedBundle.meta;
  }

  function syncDraftWithPersistedBundle(bundle) {
    setPersistedBundle(bundle);
    state.config = Shared.clone(state.persistedConfig);
    state.draftVersion += 1;
    state.dirty = false;
    state.saveBlockedReason = "";
  }

  function applyRemoteBundle(bundle) {
    if (bundle.meta.revision <= state.persistedMeta.revision) {
      return "ignored";
    }

    if (!state.dirty && !state.saveInFlight) {
      syncDraftWithPersistedBundle(bundle);
      onRemoteBundleApplied();
      return "applied";
    }

    setPersistedBundle(bundle);
    setConflictStatus();
    return "conflict";
  }

  function receiveRemoteBundle(bundle) {
    const normalizedBundle = Shared.normalizeConfigBundle(bundle);
    if (normalizedBundle.meta.revision <= state.persistedMeta.revision) {
      return "ignored";
    }

    if (!state.saveInFlight) {
      return applyRemoteBundle(normalizedBundle);
    }

    if (
      !state.pendingRemoteBundle ||
      normalizedBundle.meta.revision >
        state.pendingRemoteBundle.meta.revision
    ) {
      state.pendingRemoteBundle = normalizedBundle;
    }
    return "deferred";
  }

  function reconcilePendingRemoteBundle() {
    const bundle = state.pendingRemoteBundle;
    state.pendingRemoteBundle = null;
    return bundle ? applyRemoteBundle(bundle) : "ignored";
  }

  function markDraftDirty() {
    state.dirty = true;
    state.draftVersion += 1;
  }

  function scheduleConfigSave(delay, message) {
    state.pendingSaveMessage = message || "Saved.";
    state.suppressSaveStatus = false;
    markDraftDirty();

    if (state.saveBlockedReason) {
      setStatus(state.saveBlockedReason, true);
      return;
    }

    setStatus("Saving...", false);
    if (state.saveTimer) {
      timerApi.clearTimeout(state.saveTimer);
    }
    if (delay <= 0) {
      state.saveTimer = 0;
      flushConfigSave().catch((error) => setStatus(error.message, true));
      return;
    }

    state.saveTimer = timerApi.setTimeout(() => {
      flushConfigSave().catch((error) => setStatus(error.message, true));
    }, delay);
  }

  async function flushConfigSave() {
    if (state.saveBlockedReason) {
      throw new Error(state.saveBlockedReason);
    }
    if (state.saveTimer) {
      timerApi.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    if (state.saveInFlight) {
      await state.savePromise;
      return state.dirty ? flushConfigSave() : state.savePromise;
    }
    if (!state.dirty) {
      return state.savePromise;
    }

    state.saveInFlight = true;
    const snapshot = Shared.clone(state.config);
    const expectedRevision = state.persistedMeta.revision;
    const requestedDraftVersion = state.draftVersion;
    const successMessage = state.pendingSaveMessage;
    const suppressSaveStatus = state.suppressSaveStatus;
    if (!suppressSaveStatus) {
      setStatus("Saving...", false);
    }
    state.dirty = false;

    state.savePromise = saveConfigBundle(expectedRevision, snapshot)
      .then((savedBundle) => {
        setPersistedBundle(savedBundle);
        if (state.draftVersion === requestedDraftVersion) {
          state.config = Shared.clone(savedBundle.config);
        }
        if (suppressSaveStatus) {
          clearStatus();
        } else if (state.draftVersion === requestedDraftVersion && !state.dirty) {
          setStatus(successMessage, false);
        } else {
          setStatus("Saving...", false);
        }
      })
      .catch((error) => {
        if (error?.code === "CONFIG_CONFLICT") {
          setConflictStatus();
        }
        state.dirty = true;
        throw error;
      })
      .finally(() => {
        state.saveInFlight = false;
        state.suppressSaveStatus = false;
        reconcilePendingRemoteBundle();
      });

    await state.savePromise;
    return state.dirty ? flushConfigSave() : state.savePromise;
  }

  async function persistConfigNow(message, options) {
    markDraftDirty();
    state.pendingSaveMessage = message || "Saved.";
    state.suppressSaveStatus = Boolean(options?.silentStatus);
    if (state.saveTimer) {
      timerApi.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    await flushConfigSave();
  }

  function discardPendingConfigDraft() {
    if (state.saveTimer) {
      timerApi.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    state.dirty = false;
    state.saveBlockedReason = "";
  }

  return {
    discardPendingConfigDraft,
    flushConfigSave,
    markDraftDirty,
    persistConfigNow,
    receiveRemoteBundle,
    scheduleConfigSave,
    setPersistedBundle,
    syncDraftWithPersistedBundle,
  };
}
