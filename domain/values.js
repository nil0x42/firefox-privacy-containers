export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}
