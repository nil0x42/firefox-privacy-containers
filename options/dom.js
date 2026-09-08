let inputMeasureContext = null;

export function createHelp(text) {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "help-button";
  help.textContent = "?";
  help.title = text;
  help.setAttribute("aria-label", text);
  help.onclick = (event) => {
    event.preventDefault();
  };
  return help;
}

export function createField(labelText, control, helpText, options = {}) {
  const { layout = "stacked", compact = false } = options;
  const wrapper = document.createElement("div");
  wrapper.className = "form-field field";
  if (layout === "inline") {
    wrapper.classList.add("is-inline");
  }
  if (compact) {
    wrapper.classList.add("is-compact");
  }

  const top = document.createElement("span");
  top.className = "field-label";

  const title = document.createElement("span");
  title.textContent = labelText;
  top.appendChild(title);

  if (helpText) {
    top.appendChild(createHelp(helpText));
  }

  wrapper.appendChild(top);
  wrapper.appendChild(control);
  return wrapper;
}

export function createPanel(title, subtitle) {
  const panel = document.createElement("section");
  panel.className = "panel";

  const heading = document.createElement("h2");
  heading.textContent = title;
  panel.appendChild(heading);

  if (subtitle) {
    const description = document.createElement("p");
    description.className = "panel-subtitle";
    description.textContent = subtitle;
    panel.appendChild(description);
  }

  return panel;
}

export function createInput(value, placeholder, type = "text") {
  const input = document.createElement("input");
  input.type = type;
  input.value = value || "";
  if (placeholder) {
    input.placeholder = placeholder;
  }
  return input;
}

export function createTextarea(value, rows) {
  const textarea = document.createElement("textarea");
  textarea.className = "textarea-field-control";
  textarea.value = value || "";
  if (rows) {
    textarea.rows = rows;
  }
  return textarea;
}

export function syncAutoWidthTextInput(
  input,
  fallbackText,
  minimumWidth = 136,
) {
  if (!input) {
    return;
  }

  if (!inputMeasureContext) {
    inputMeasureContext = document.createElement("canvas").getContext("2d");
  }

  if (!inputMeasureContext) {
    input.style.width = `${minimumWidth}px`;
    return;
  }

  const computed = window.getComputedStyle(input);
  inputMeasureContext.font = computed.font;
  const text = input.value || fallbackText || input.placeholder || "";
  const metricsWidth = inputMeasureContext.measureText(text).width;
  const paddingLeft = parseFloat(computed.paddingLeft || "0") || 0;
  const paddingRight = parseFloat(computed.paddingRight || "0") || 0;
  const borderLeft = parseFloat(computed.borderLeftWidth || "0") || 0;
  const borderRight = parseFloat(computed.borderRightWidth || "0") || 0;
  const nextWidth = Math.ceil(
    Math.max(
      minimumWidth,
      metricsWidth + paddingLeft + paddingRight + borderLeft + borderRight + 8,
    ),
  );

  input.style.width = `${nextWidth}px`;
}

export function createCheckbox(checked) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  return input;
}

export function createSelect(options, selectedValue) {
  const select = document.createElement("select");

  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.selected = optionData.value === selectedValue;
    select.appendChild(option);
  });

  return select;
}
