function getError(response) {
  const details = response && response.error;
  const error = new Error(details?.message || "Configuration request failed.");
  error.code = details?.code || "CONFIG_NOT_READY";
  error.validationErrors = details?.validationErrors;
  error.bundle = details?.bundle;
  return error;
}

async function request(message) {
  const response = await browser.runtime.sendMessage(message);
  if (!response || response.ok !== true) {
    throw getError(response);
  }
  return response.bundle;
}

function getConfigBundle() {
  return request({ type: "config:get" });
}

function saveConfigBundle(expectedRevision, config) {
  return request({ type: "config:save", expectedRevision, config });
}

export { getConfigBundle, saveConfigBundle };
