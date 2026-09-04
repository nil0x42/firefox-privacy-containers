import { normalizeText } from "./values.js";

export const SHORTCUT_SLOT_COUNT = 30;
export const OPEN_CURRENT_CONTAINER_TAB_COMMAND = "open-current-container-tab";
export const GO_ONE_TAB_LEFT_COMMAND = "go-one-tab-left";
export const GO_ONE_TAB_RIGHT_COMMAND = "go-one-tab-right";
export const MOVE_TAB_LEFT_COMMAND = "move-tab-left";
export const MOVE_TAB_RIGHT_COMMAND = "move-tab-right";
export const TOGGLE_TAB_PINNED_COMMAND = "pin-unpin-tab";
export const OPEN_CONTAINER_SLOT_COMMAND_PREFIX = "open-container-slot-";
export const REOPEN_CONTAINER_SLOT_COMMAND_PREFIX =
  "reopen-current-tab-in-container-slot-";

export function getOpenContainerSlotCommandName(slot) {
  return `${OPEN_CONTAINER_SLOT_COMMAND_PREFIX}${slot}`;
}

export function getReopenContainerSlotCommandName(slot) {
  return `${REOPEN_CONTAINER_SLOT_COMMAND_PREFIX}${slot}`;
}

export function getFixedShortcutCommandDescription(commandName) {
  return (
    {
      [OPEN_CURRENT_CONTAINER_TAB_COMMAND]:
        "Open a new tab in the current container",
      [GO_ONE_TAB_LEFT_COMMAND]: "Go one tab to the left",
      [GO_ONE_TAB_RIGHT_COMMAND]: "Go one tab to the right",
      [MOVE_TAB_LEFT_COMMAND]: "Move tab left",
      [MOVE_TAB_RIGHT_COMMAND]: "Move tab right",
      [TOGGLE_TAB_PINNED_COMMAND]: "Pin/Unpin tab",
    }[commandName] || ""
  );
}

export function getSlotNumberFromCommandName(commandName) {
  const prefix = [
    OPEN_CONTAINER_SLOT_COMMAND_PREFIX,
    REOPEN_CONTAINER_SLOT_COMMAND_PREFIX,
  ].find((candidate) => commandName.startsWith(candidate));
  return prefix ? commandName.slice(prefix.length) : "";
}

export function isOpenContainerSlotCommand(commandName) {
  return commandName.startsWith(OPEN_CONTAINER_SLOT_COMMAND_PREFIX);
}

export function isReopenContainerSlotCommand(commandName) {
  return commandName.startsWith(REOPEN_CONTAINER_SLOT_COMMAND_PREFIX);
}

export function normalizeShortcutKey(eventData) {
  const source = eventData && typeof eventData === "object" ? eventData : {};
  const key = normalizeText(source.key);
  const code = normalizeText(source.code);

  if (["Control", "Shift", "Alt", "Meta"].includes(key)) {
    return "";
  }
  if (code === "Space") {
    return "Space";
  }
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3);
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (/^F\d{1,2}$/.test(key)) {
    return key.toUpperCase();
  }

  const namedKeys = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Comma: "Comma",
    Period: "Period",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
    Delete: "Delete",
  };
  if (namedKeys[code] || namedKeys[key]) {
    return namedKeys[code] || namedKeys[key];
  }

  const upper = key.toUpperCase();
  return key.length === 1 && /^[A-Z0-9]$/.test(upper) ? upper : "";
}

export function captureShortcutFromEventData(eventData) {
  const source = eventData && typeof eventData === "object" ? eventData : {};
  const key = normalizeShortcutKey(source);
  if (!(source.ctrlKey || source.altKey || source.metaKey) || !key) {
    return "";
  }

  return [
    source.ctrlKey && "Ctrl",
    source.altKey && "Alt",
    source.metaKey && "Command",
    source.shiftKey && "Shift",
    key,
  ]
    .filter(Boolean)
    .join("+");
}

export function getShortcutActivationIssue(requestedShortcut, activeShortcut) {
  const requested = normalizeText(requestedShortcut);
  const active = normalizeText(activeShortcut);
  if (!requested || requested === active) {
    return "";
  }

  return `Firefox did not activate "${requested}". It likely conflicts with the browser or another add-on.`;
}
