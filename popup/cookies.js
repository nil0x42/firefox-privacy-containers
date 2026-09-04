  async function getTabCookies(browserApi, Shared, tab) {
    return browserApi.cookies.getAll(
      Shared.buildCookieQueryDetails(tab, true),
    );
  }

  async function removeTabCookies(browserApi, Shared, tab) {
    const cookies = await getTabCookies(browserApi, Shared, tab);
    const results = await Promise.allSettled(
      cookies.map((cookie) =>
        browserApi.cookies.remove(
          Shared.buildCookieRemovalDetails(cookie, tab.cookieStoreId),
        ),
      ),
    );
    const removedCount = results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
    const failedCount = results.length - removedCount;

    if (failedCount) {
      const summary = removedCount
        ? `Removed ${removedCount} cookie${removedCount === 1 ? "" : "s"}, but `
        : "";
      throw new Error(
        `${summary}failed to remove ${failedCount} cookie${failedCount === 1 ? "" : "s"}.`,
      );
    }

    return {
      matchedCount: cookies.length,
      removedCount,
    };
  }

export { getTabCookies, removeTabCookies };
