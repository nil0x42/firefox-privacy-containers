export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
