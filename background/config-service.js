export function createConfigService({ Shared, browser, writerId, onChanged }) {
  let currentBundle = null;
  let initialization = null;
  let writeQueue = Promise.resolve();

  function enqueue(task) {
    const result = writeQueue.then(task, task);
    writeQueue = result.catch(() => undefined);
    return result;
  }

  async function initialize() {
    if (!initialization) {
      initialization = (async () => {
        const stored = (await browser.storage.local.get(Shared.CONFIG_KEY))[
          Shared.CONFIG_KEY
        ];
        const bundle = stored
          ? Shared.normalizeConfigBundle(stored)
          : Shared.createConfigBundle(Shared.createDefaultConfig(), {
              revision: 0,
              writer: writerId,
            });
        if (!stored || JSON.stringify(stored) !== JSON.stringify(bundle)) {
          await browser.storage.local.set({ [Shared.CONFIG_KEY]: bundle });
        }
        currentBundle = bundle;
        return bundle;
      })();
    }
    return initialization;
  }

  async function getBundle() {
    return currentBundle || initialize();
  }

  async function save(expectedRevision, config) {
    await initialize();
    return enqueue(async () => {
      if (currentBundle.meta.revision !== expectedRevision) {
        const error = new Error(
          `Config revision mismatch: expected ${expectedRevision}, got ${currentBundle.meta.revision}`,
        );
        error.code = "CONFIG_CONFLICT";
        error.bundle = currentBundle;
        throw error;
      }

      const validation = Shared.validateConfig(config);
      if (!validation.valid) {
        const error = new Error(validation.errors.join("\n"));
        error.code = "CONFIG_INVALID";
        error.validationErrors = validation.errors;
        throw error;
      }

      const bundle = Shared.createConfigBundle(validation.config, {
        revision: currentBundle.meta.revision + 1,
        updatedAt: new Date().toISOString(),
        writer: writerId,
      });
      await browser.storage.local.set({ [Shared.CONFIG_KEY]: bundle });
      currentBundle = bundle;
      await onChanged(bundle);
      return bundle;
    });
  }

  async function mutate(mutator) {
    await initialize();
    return enqueue(async () => {
      const config = mutator(Shared.clone(currentBundle.config));
      const validation = Shared.validateConfig(config);
      if (!validation.valid) {
        const error = new Error(validation.errors.join("\n"));
        error.code = "CONFIG_INVALID";
        error.validationErrors = validation.errors;
        throw error;
      }
      const bundle = Shared.createConfigBundle(validation.config, {
        revision: currentBundle.meta.revision + 1,
        updatedAt: new Date().toISOString(),
        writer: writerId,
      });
      await browser.storage.local.set({ [Shared.CONFIG_KEY]: bundle });
      currentBundle = bundle;
      await onChanged(bundle);
      return bundle;
    });
  }

  return { getBundle, initialize, mutate, save };
}
