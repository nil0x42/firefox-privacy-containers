export async function showTransientNotification(browser, options) {
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

  if (typeof browser.notifications.clear === "function") {
    const clearTimer = setTimeout(() => {
      browser.notifications.clear(notificationId).catch(() => undefined);
    }, options.durationMs);
    if (typeof clearTimer?.unref === "function") {
      clearTimer.unref();
    }
  }

  return true;
}
