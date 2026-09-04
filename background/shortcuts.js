import * as Shortcut from "../domain/shortcuts.js";

export function createShortcutManager(deps) {
    const { state, browser, containerCache, tabActions } = deps;

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
      if (!browser.commands?.getAll || !browser.commands.update) {
        return;
      }

      const desiredDescriptions = new Map();
      [
        Shortcut.OPEN_CURRENT_CONTAINER_TAB_COMMAND,
        Shortcut.GO_ONE_TAB_LEFT_COMMAND,
        Shortcut.GO_ONE_TAB_RIGHT_COMMAND,
        Shortcut.MOVE_TAB_LEFT_COMMAND,
        Shortcut.MOVE_TAB_RIGHT_COMMAND,
        Shortcut.TOGGLE_TAB_PINNED_COMMAND,
      ].forEach((commandName) => {
        const description = Shortcut.getFixedShortcutCommandDescription(commandName);
        if (description) {
          desiredDescriptions.set(commandName, description);
        }
      });

      for (let slot = 0; slot < Shortcut.SHORTCUT_SLOT_COUNT; slot += 1) {
        const containerId = getShortcutContainerId(slot);
        const descriptions = getSlotDescriptions(slot, containerId);

        desiredDescriptions.set(
          Shortcut.getOpenContainerSlotCommandName(slot),
          descriptions.open,
        );
        desiredDescriptions.set(
          Shortcut.getReopenContainerSlotCommandName(slot),
          descriptions.reopen,
        );
      }

      const currentDescriptions = new Map(
        (await browser.commands.getAll()).map((command) => [
          command.name,
          command.description || "",
        ]),
      );
      const updates = [];
      desiredDescriptions.forEach((description, name) => {
        if (currentDescriptions.get(name) !== description) {
          updates.push({ name, description });
        }
      });

      await Promise.allSettled(
        updates.map((update) => browser.commands.update(update)),
      );
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
      if (commandName === Shortcut.OPEN_CURRENT_CONTAINER_TAB_COMMAND) {
        await tabActions.openCurrentContainerTab();
        return;
      }

      if (commandName === Shortcut.GO_ONE_TAB_LEFT_COMMAND) {
        await tabActions.goOneTabLeft();
        return;
      }

      if (commandName === Shortcut.GO_ONE_TAB_RIGHT_COMMAND) {
        await tabActions.goOneTabRight();
        return;
      }

      if (commandName === Shortcut.MOVE_TAB_LEFT_COMMAND) {
        await tabActions.moveTabLeft();
        return;
      }

      if (commandName === Shortcut.MOVE_TAB_RIGHT_COMMAND) {
        await tabActions.moveTabRight();
        return;
      }

      if (commandName === Shortcut.TOGGLE_TAB_PINNED_COMMAND) {
        await tabActions.toggleTabPinned();
        return;
      }

      if (Shortcut.isOpenContainerSlotCommand(commandName)) {
        await openContainerSlot(Shortcut.getSlotNumberFromCommandName(commandName));
        return;
      }

      if (Shortcut.isReopenContainerSlotCommand(commandName)) {
        await reopenContainerSlot(Shortcut.getSlotNumberFromCommandName(commandName));
      }
    }

    return {
      getShortcutContainerId,
      handleCommand,
      refreshCommandDescriptions,
    };
  }
