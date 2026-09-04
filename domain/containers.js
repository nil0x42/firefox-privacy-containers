import { SHORTCUT_SLOT_COUNT } from "./shortcuts.js";
import { normalizeText } from "./values.js";

export const FIREFOX_DEFAULT_CONTAINER = "firefox-default";

export function normalizeContainerName(value) {
  return normalizeText(value);
}

export function normalizeContainerIdentityName(value) {
  return normalizeContainerName(value).toLowerCase();
}

export function getContainerTechnicalLabel(cookieStoreId) {
  const normalized = normalizeText(cookieStoreId);
  if (!normalized) {
    return "";
  }
  return normalized === FIREFOX_DEFAULT_CONTAINER
    ? "default"
    : normalized.replace(/^firefox-/, "");
}

export function createContainerLookup(containers) {
  const byId = {};
  for (const container of Array.isArray(containers) ? containers : []) {
    const cookieStoreId = normalizeText(container?.cookieStoreId);
    if (cookieStoreId) {
      byId[cookieStoreId] = {
        cookieStoreId,
        name: normalizeContainerName(container?.name) || cookieStoreId,
        icon: normalizeText(container?.icon),
        iconUrl: normalizeText(container?.iconUrl),
        color: normalizeText(container?.color),
      };
    }
  }
  return byId;
}

export function getContainerSlots(containers) {
  return [
    {
      slot: 0,
      cookieStoreId: FIREFOX_DEFAULT_CONTAINER,
      name: "Default container",
      icon: "default",
      iconUrl: "",
      color: "",
      isDefault: true,
      supportsShortcuts: true,
    },
    ...(Array.isArray(containers) ? containers : []).map((container, index) => ({
      slot: index + 1,
      cookieStoreId: normalizeText(container.cookieStoreId),
      name: normalizeContainerName(container.name) || `Container ${index + 1}`,
      icon: normalizeText(container.icon),
      iconUrl: normalizeText(container.iconUrl),
      color: normalizeText(container.color),
      isDefault: false,
      supportsShortcuts: index + 1 < SHORTCUT_SLOT_COUNT,
    })),
  ];
}

export function getContainerSlot(containers, slot) {
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 0) {
    return null;
  }
  return getContainerSlots(containers).find((entry) => entry.slot === slotNumber) || null;
}

export function getContainerIdForSlot(containers, slot) {
  return getContainerSlot(containers, slot)?.cookieStoreId || "";
}

export function getDuplicateLiveContainerGroups(containers) {
  const groupsByName = new Map();
  for (const slotEntry of getContainerSlots(containers)) {
    const normalizedName = normalizeContainerIdentityName(slotEntry.name);
    if (!normalizedName) {
      continue;
    }
    const group = groupsByName.get(normalizedName) || [];
    group.push({
      slot: slotEntry.slot,
      cookieStoreId: slotEntry.cookieStoreId,
      technicalLabel: getContainerTechnicalLabel(slotEntry.cookieStoreId),
      name: slotEntry.name,
      icon: slotEntry.icon,
      iconUrl: slotEntry.iconUrl,
      color: slotEntry.color,
      isDefault: Boolean(slotEntry.isDefault),
    });
    groupsByName.set(normalizedName, group);
  }

  return Array.from(groupsByName.entries())
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => ({
      normalizedName,
      name: group[0].name,
      count: group.length,
      containers: group,
    }));
}
