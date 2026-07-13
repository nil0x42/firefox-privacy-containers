export function createShortcutManager(deps) {
    const { state, browser, Shared, containerCache, tabActions } = deps;

    function getShortcutContainerId(slot) {
      return state.runtime.shortcutRuntime.containerIdBySlot[slot] || "";
    }

    function getSlotDescriptions(slot, containerId) {
      const containerName = containerCache.getContainerName(containerId);
      const containerLabel = containerId
        ? containerName
        : "the container currently assigned to this shortcut";

      return {
        open: `Open a new tab in ${containerLabel}`,
        reopen: `Reopen the current tab in ${containerLabel}`,
      };
    }

    async function refreshCommandDescriptions() {
      if (!browser.commands || !browser.commands.update) {
        return;
      }

      const desiredDescriptions = new Map();
      [
        Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND,
        Shared.GO_ONE_TAB_LEFT_COMMAND,
        Shared.GO_ONE_TAB_RIGHT_COMMAND,
        Shared.MOVE_TAB_LEFT_COMMAND,
        Shared.MOVE_TAB_RIGHT_COMMAND,
        Shared.TOGGLE_TAB_PINNED_COMMAND,
      ].forEach((commandName) => {
        const description = Shared.getFixedShortcutCommandDescription(commandName);
        if (description) {
          desiredDescriptions.set(commandName, description);
        }
      });

      for (let slot = 0; slot < Shared.SHORTCUT_SLOT_COUNT; slot += 1) {
        const containerId = getShortcutContainerId(slot);
        const descriptions = getSlotDescriptions(slot, containerId);

        desiredDescriptions.set(
          Shared.getOpenContainerSlotCommandName(slot),
          descriptions.open,
        );
        desiredDescriptions.set(
          Shared.getReopenContainerSlotCommandName(slot),
          descriptions.reopen,
        );
      }

      const updates = [];
      desiredDescriptions.forEach((description, name) => {
        if (state.commandDescriptionByName.get(name) !== description) {
          updates.push({ name, description });
        }
      });

      const results = await Promise.allSettled(
        updates.map((update) => browser.commands.update(update)),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const update = updates[index];
          state.commandDescriptionByName.set(update.name, update.description);
        }
      });
    }

    async function openContainerSlot(slot) {
      const containerId = getShortcutContainerId(slot);
      if (!containerId) {
        throw new Error("This shortcut is not assigned to any container yet");
      }

      await tabActions.openTabInContainer(containerId);
    }

    async function reopenContainerSlot(slot) {
      const containerId = getShortcutContainerId(slot);
      if (!containerId) {
        throw new Error("This shortcut is not assigned to any container yet");
      }

      return tabActions.reopenCurrentTabInContainer(containerId);
    }

    async function handleCommand(commandName) {
      if (commandName === Shared.OPEN_CURRENT_CONTAINER_TAB_COMMAND) {
        await tabActions.openCurrentContainerTab();
        return;
      }

      if (commandName === Shared.GO_ONE_TAB_LEFT_COMMAND) {
        await tabActions.goOneTabLeft();
        return;
      }

      if (commandName === Shared.GO_ONE_TAB_RIGHT_COMMAND) {
        await tabActions.goOneTabRight();
        return;
      }

      if (commandName === Shared.MOVE_TAB_LEFT_COMMAND) {
        await tabActions.moveTabLeft();
        return;
      }

      if (commandName === Shared.MOVE_TAB_RIGHT_COMMAND) {
        await tabActions.moveTabRight();
        return;
      }

      if (commandName === Shared.TOGGLE_TAB_PINNED_COMMAND) {
        await tabActions.toggleTabPinned();
        return;
      }

      if (Shared.isOpenContainerSlotCommand(commandName)) {
        await openContainerSlot(Shared.getSlotNumberFromCommandName(commandName));
        return;
      }

      if (Shared.isReopenContainerSlotCommand(commandName)) {
        await reopenContainerSlot(Shared.getSlotNumberFromCommandName(commandName));
      }
    }

    return {
      getShortcutContainerId,
      handleCommand,
      refreshCommandDescriptions,
    };
  }
