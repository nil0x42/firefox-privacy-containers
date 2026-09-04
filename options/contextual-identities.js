  const FALLBACK_COLORS = Object.freeze([
    { color: "red", colorCode: "#d1242f" },
    { color: "orange", colorCode: "#f18f01" },
    { color: "yellow", colorCode: "#ffd60a" },
    { color: "green", colorCode: "#2da44e" },
    { color: "blue", colorCode: "#218bff" },
    { color: "pink", colorCode: "#d63384" },
    { color: "purple", colorCode: "#8250df" },
    { color: "turquoise", colorCode: "#1fb6aa" },
    { color: "toolbar", colorCode: "#8c959f" },
  ]);
  const FALLBACK_ICONS = Object.freeze([
    "fingerprint",
    "briefcase",
    "dollar",
    "cart",
    "circle",
    "gift",
    "vacation",
    "food",
    "fruit",
    "pet",
    "tree",
    "chill",
    "fence",
  ].map((icon) => Object.freeze({ icon })));

  function isValidColorChoice(choice) {
    return Boolean(
      choice &&
        typeof choice.color === "string" &&
        choice.color &&
        /^#[0-9a-f]{6}$/i.test(choice.colorCode),
    );
  }

  function isValidIconChoice(choice) {
    return Boolean(choice && typeof choice.icon === "string" && choice.icon);
  }

  async function getChoices(api, methodName, validate, fallback) {
    if (!api || typeof api[methodName] !== "function") {
      return fallback.slice();
    }

    try {
      const choices = await api[methodName]();
      return Array.isArray(choices) && choices.length && choices.every(validate)
        ? choices
        : fallback.slice();
    } catch (_) {
      return fallback.slice();
    }
  }

  async function getSupportedIdentityChoices(browserApi) {
    const api = browserApi && browserApi.contextualIdentities;
    const [colors, icons] = await Promise.all([
      getChoices(api, "getSupportedColors", isValidColorChoice, FALLBACK_COLORS),
      getChoices(api, "getSupportedIcons", isValidIconChoice, FALLBACK_ICONS),
    ]);
    return { colors, icons };
  }

  const api = {
    FALLBACK_COLORS,
    FALLBACK_ICONS,
    getSupportedIdentityChoices,
  };
export default api;
export { FALLBACK_COLORS, FALLBACK_ICONS, getSupportedIdentityChoices };
