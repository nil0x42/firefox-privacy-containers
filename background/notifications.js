export async function showNotification(browser, options) {
  await browser.notifications.create(options.id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("res/icon.png"),
    title: options.title,
    message: options.message,
  });

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
    id: "shortcut-failure",
    title: "Shortcut failed",
    message,
  });
}
