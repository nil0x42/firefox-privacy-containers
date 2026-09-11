  function getParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      entry: params.get("entry") || "",
    };
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value || "";
    }
  }

  function setError(message) {
    const node = document.getElementById("blocked-error");
    if (!node) {
      return;
    }

    node.hidden = !message;
    node.textContent = message || "";
  }

  function setInputValue(id, value) {
    const node = document.getElementById(id);
    if (!(node instanceof HTMLInputElement)) {
      return;
    }

    node.value = value || "";
    node.title = value || "";
  }

  let copyNoticeTimer = 0;

  function setCopyNotice(message) {
    const node = document.getElementById("blocked-copy-notice");
    if (!node) {
      return;
    }

    if (copyNoticeTimer) {
      window.clearTimeout(copyNoticeTimer);
      copyNoticeTimer = 0;
    }

    node.hidden = !message;
    node.textContent = message || "";

    if (message) {
      copyNoticeTimer = window.setTimeout(() => {
        node.hidden = true;
        node.textContent = "";
        copyNoticeTimer = 0;
      }, 1800);
    }
  }

  async function copyText(text) {
    if (!text) {
      return false;
    }

    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const fallbackInput = document.createElement("input");
    fallbackInput.type = "text";
    fallbackInput.value = text;
    fallbackInput.setAttribute("readonly", "readonly");
    fallbackInput.style.position = "fixed";
    fallbackInput.style.opacity = "0";
    fallbackInput.style.pointerEvents = "none";
    document.body.appendChild(fallbackInput);
    fallbackInput.select();
    fallbackInput.setSelectionRange(0, fallbackInput.value.length);

    try {
      return document.execCommand("copy");
    } finally {
      fallbackInput.remove();
    }
  }

  function bindCopyUrlButton(url) {
    const button = document.getElementById("blocked-copy-url");
    const input = document.getElementById("blocked-url");
    if (!(button instanceof HTMLButtonElement) || !input) {
      return;
    }

    button.disabled = !url;
    button.classList.remove("is-copied");
    button.title = "Copy original URL";
    button.setAttribute("aria-label", "Copy original URL");
    input.addEventListener("focus", () => {
      input.select();
    });
    input.addEventListener("mouseup", (event) => {
      event.preventDefault();
    });
    button.onclick = async () => {
      if (!url) {
        return;
      }

      setError("");
      setCopyNotice("");
      button.disabled = true;

      try {
        const copied = await copyText(url);
        if (!copied) {
          throw new Error("Copy failed.");
        }

        button.classList.add("is-copied");
        button.title = "Copied";
        button.setAttribute("aria-label", "Copied");
        setCopyNotice("Original URL copied to clipboard.");
        window.setTimeout(() => {
          button.classList.remove("is-copied");
          button.title = "Copy original URL";
          button.setAttribute("aria-label", "Copy original URL");
          button.disabled = false;
        }, 1400);
      } catch (error) {
        button.classList.remove("is-copied");
        button.title = "Copy original URL";
        button.setAttribute("aria-label", "Copy original URL");
        button.disabled = false;
        setCopyNotice("");
        setError(error && error.message ? error.message : String(error));
      }
    };
  }

  function createAllowedContainerButton(entry, blockedEntryId, blockedUrl) {
    const link = document.createElement("a");
    link.className = "blocked-action-button";
    link.href = blockedUrl || "#";
    link.draggable = false;
    if (entry.color) {
      link.style.setProperty("--container-accent", entry.color);
    }

    const top = document.createElement("span");
    top.className = "blocked-action-top";
    if (entry.iconUrl) {
      const icon = document.createElement("img");
      icon.className = "blocked-action-icon";
      icon.src = entry.iconUrl;
      icon.alt = "";
      top.appendChild(icon);
    } else {
      const swatch = document.createElement("span");
      swatch.className = "blocked-action-swatch";
      top.appendChild(swatch);
    }

    const title = document.createElement("span");
    title.className = "blocked-action-title";
    title.textContent = entry.actionLabel || `Open in ${entry.name}`;
    top.appendChild(title);

    if (entry.ambiguous && entry.technicalLabel) {
      const flag = document.createElement("span");
      flag.className = "blocked-action-flag";
      flag.textContent = `ID: ${entry.technicalLabel}`;
      top.appendChild(flag);
      link.title = `Firefox container ID: ${entry.technicalLabel}`;
    }

    link.appendChild(top);

    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (link.getAttribute("aria-disabled") === "true") {
        return;
      }

      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      setError("");
      link.setAttribute("aria-disabled", "true");

      try {
        await browser.runtime.sendMessage({
          type: "open-blocked-url-in-container",
          entry: blockedEntryId,
          cookieStoreId: entry.cookieStoreId,
        });
      } catch (error) {
        link.removeAttribute("aria-disabled");
        setError(error && error.message ? error.message : String(error));
      }
    });
    link.addEventListener("auxclick", (event) => {
      event.preventDefault();
    });
    link.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    return link;
  }

  async function init() {
    const params = getParams();
    const response = await browser.runtime.sendMessage({
      type: "get-blocked-page-context",
      ...params,
    });
    const context = response && response.context ? response.context : null;

    if (!context) {
      setText("blocked-rule", "Unknown rule");
      setText("blocked-host", "Unknown host");
      setText("blocked-container", "Unknown container");
      setInputValue("blocked-url", "");
      bindCopyUrlButton("");
      setError("This blocked navigation context expired. Reload the original page if needed.");
      return;
    }

    setText("blocked-rule", context.ruleName);
    setText("blocked-host", context.host);
    setInputValue("blocked-url", context.url || "");
    bindCopyUrlButton(context.url || "");
    const containerName = context.container?.name || "Unknown container";
    setText("blocked-container", containerName);

    const summary = document.getElementById("blocked-summary");
    if (summary) {
      summary.textContent =
        context.mode === "blacklist"
          ? `The host "${context.host}" matched "${context.ruleName}" and is blocked in ${containerName}.`
          : `The host "${context.host}" matched "${context.ruleName}" and ${containerName} is blocked by that rule.`;
    }

    const allowedSection = document.getElementById("blocked-allowed-section");
    const allowedList = document.getElementById("blocked-allowed-list");
    const unavailableNode = document.getElementById("blocked-unavailable");
    const allowedContainers = Array.isArray(context.allowedContainers)
      ? context.allowedContainers
      : [];
    const unavailableContainers = Array.isArray(
      context.unavailableAllowedContainers,
    )
      ? context.unavailableAllowedContainers
      : [];
    const noLongerAllowedContainers = Array.isArray(
      context.noLongerAllowedContainers,
    )
      ? context.noLongerAllowedContainers
      : [];
    const shouldShowActions =
      context.mode === "blacklist" && allowedContainers.length > 0;
    const shouldShowDiagnostics =
      context.mode === "blacklist" &&
      (unavailableContainers.length > 0 ||
        noLongerAllowedContainers.length > 0);

    if (allowedSection && allowedList) {
      allowedSection.hidden = !shouldShowActions && !shouldShowDiagnostics;
      allowedList.textContent = "";

      const copy = allowedSection.querySelector(".blocked-actions-copy");
      if (copy) {
        copy.textContent = shouldShowActions
          ? `This Host Rule only allows this host in: ${allowedContainers
              .map((entry) => entry.name)
              .join(", ")}. Choosing one replaces this blocked tab.`
          : "No container from the original rule can be used now.";
      }

      if (shouldShowActions) {
        allowedContainers.forEach((entry) => {
          allowedList.appendChild(
            createAllowedContainerButton(entry, context.entry, context.url),
          );
        });
      }

      if (unavailableNode) {
        const messages = [];
        if (unavailableContainers.length) {
          messages.push(
            `Unavailable right now: ${unavailableContainers
              .map((entry) => entry.name)
              .join(", ")}.`,
          );
        }
        if (noLongerAllowedContainers.length) {
          messages.push(
            `No longer allowed: ${noLongerAllowedContainers
              .map((entry) => entry.name)
              .join(", ")}.`,
          );
        }
        unavailableNode.hidden = messages.length === 0;
        unavailableNode.textContent = messages.join(" ");
      }
    }
  }

  export { createAllowedContainerButton, init };

  if (typeof document !== "undefined") {
    init().catch((error) => {
      setError(error && error.message ? error.message : String(error));
    });
  }
