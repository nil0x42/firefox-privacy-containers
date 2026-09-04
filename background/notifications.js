export async function showNotification(browser, options) {
  if (
    !browser.notifications ||
    typeof browser.notifications.create !== "function"
  ) {
    return false;
  }

  const notificationId = `${options.idPrefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await browser.notifications.create(notificationId, {
    type: "basic",
    iconUrl: browser.runtime.getURL("res/icon.png"),
    title: options.title,
    message: options.message,
  });

  return true;
}

export function showCommandFailureNotification(browser, error) {
  const rawMessage =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : error
        ? String(error)
        : "Shortcut action failed";
  const message = rawMessage.endsWith(".") ? rawMessage : `${rawMessage}.`;

  return showNotification(browser, {
    idPrefix: "shortcut-failure",
    title: "Shortcut failed",
    message,
  });
}
