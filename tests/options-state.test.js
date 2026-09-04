import assert from "node:assert/strict";
import test from "node:test";
import Shared from "../utils/shared.js";
import {
  createConfigDraftController,
  createOptionsState,
} from "../options/state.js";

test("serializes a newer options draft behind an in-flight save", async () => {
  const state = createOptionsState();
  const calls = [];
  let finishFirstSave;
  const firstSave = new Promise((resolve) => {
    finishFirstSave = resolve;
  });
  const controller = createConfigDraftController({
    state,
    clearStatus() {},
    setConflictStatus() {},
    setStatus() {},
    timerApi: globalThis,
    async saveConfigBundle(expectedRevision, config) {
      calls.push({ expectedRevision, config: Shared.clone(config) });
      if (calls.length === 1) {
        await firstSave;
      }
      return Shared.createConfigBundle(config, {
        revision: expectedRevision + 1,
      });
    },
  });

  state.config.globalHeaders = [{ id: "one", name: "X-Test", value: "1" }];
  controller.markDraftDirty();
  const saving = controller.flushConfigSave();
  await Promise.resolve();

  state.config.globalHeaders[0].value = "2";
  controller.markDraftDirty();
  finishFirstSave();
  await saving;

  assert.equal(calls.length, 2);
  assert.equal(calls[0].expectedRevision, 0);
  assert.equal(calls[0].config.globalHeaders[0].value, "1");
  assert.equal(calls[1].expectedRevision, 1);
  assert.equal(calls[1].config.globalHeaders[0].value, "2");
  assert.equal(state.persistedMeta.revision, 2);
  assert.equal(state.dirty, false);
});

test("keeps a conflicting draft dirty for an explicit reload", async () => {
  const state = createOptionsState();
  let conflictShown = false;
  const controller = createConfigDraftController({
    state,
    clearStatus() {},
    setStatus() {},
    setConflictStatus() {
      conflictShown = true;
      state.saveBlockedReason = "Configuration changed elsewhere.";
    },
    timerApi: globalThis,
    async saveConfigBundle() {
      const error = new Error("Conflict");
      error.code = "CONFIG_CONFLICT";
      throw error;
    },
  });

  controller.markDraftDirty();
  await assert.rejects(controller.flushConfigSave(), /Conflict/);
  assert.equal(conflictShown, true);
  assert.equal(state.dirty, true);
});
