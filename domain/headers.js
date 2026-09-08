import { createId } from "./ids.js";
import { normalizeText } from "./values.js";

export const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function normalizeHeaderName(value) {
  const name = normalizeText(value);
  return HEADER_NAME_PATTERN.test(name) ? name : "";
}

export function normalizeHeaderValue(value) {
  return value == null ? "" : String(value);
}

export function createHeaderId(prefix) {
  return createId(prefix || "header");
}

function normalizeHeaderEntry(entry, fallbackId) {
  const name = normalizeHeaderName(entry && entry.name);
  if (!name) {
    return null;
  }

  return {
    id: normalizeText(entry && entry.id) || fallbackId || createHeaderId(),
    name,
    value: normalizeHeaderValue(entry && entry.value),
  };
}

export function normalizeHeaderEntries(value, prefix) {
  const source = Array.isArray(value) ? value : [];
  const headers = [];

  source.forEach((entry, index) => {
    const normalized = normalizeHeaderEntry(
      entry,
      `${prefix || "header"}-${index + 1}`,
    );
    if (normalized) {
      headers.push(normalized);
    }
  });

  return headers;
}

export function headersToMultilineText(headers) {
  return normalizeHeaderEntries(headers)
    .map((header) => `${header.name}: ${header.value}`)
    .join("\n");
}

export function parseHeaderLines(text, existingHeaders, prefix) {
  const input = String(text || "");
  const currentHeaders = normalizeHeaderEntries(existingHeaders, prefix);
  const headers = [];
  const errors = [];
  let headerIndex = 0;

  input.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    if (!rawLine.trim()) {
      return;
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex === -1) {
      errors.push({
        line: lineIndex + 1,
        message: 'Missing ":" separator',
      });
      return;
    }

    const name = normalizeHeaderName(rawLine.slice(0, separatorIndex));
    if (!name) {
      errors.push({
        line: lineIndex + 1,
        message: "Header name is invalid",
      });
      return;
    }

    const rawValue = rawLine.slice(separatorIndex + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
    const previous = currentHeaders[headerIndex];

    headers.push({
      id: previous && previous.id ? previous.id : createHeaderId(prefix),
      name,
      value,
    });
    headerIndex += 1;
  });

  return {
    headers,
    errors,
    valid: errors.length === 0,
  };
}

function dedupeCompiledHeaders(headers) {
  const input = Array.isArray(headers) ? headers : [];
  const deduped = [];
  const seenNames = new Set();

  for (let index = input.length - 1; index >= 0; index -= 1) {
    const header = input[index];
    if (!header || typeof header.name !== "string") {
      continue;
    }

    const normalizedName = header.name.toLowerCase();
    if (seenNames.has(normalizedName)) {
      continue;
    }

    seenNames.add(normalizedName);
    deduped.push({ ...header });
  }

  deduped.reverse();
  return deduped;
}

export function compileHeaderPlan(globalHeaders, scopedHeaders, pwnFoxValue) {
  const headers = [];

  if (pwnFoxValue) {
    headers.push({
      name: "X-PwnFox-Color",
      value: pwnFoxValue,
    });
  }

  headers.push(...globalHeaders, ...scopedHeaders);

  const dedupedHeaders = dedupeCompiledHeaders(headers);
  if (!dedupedHeaders.length) {
    return null;
  }

  const compiledHeaders = dedupedHeaders.map((header) => ({
    ...header,
    normalizedName: header.name.toLowerCase(),
  }));
  const headerNameSet = new Set();
  const headerByNormalizedName = new Map();

  compiledHeaders.forEach((header) => {
    headerNameSet.add(header.normalizedName);
    headerByNormalizedName.set(header.normalizedName, header);
  });

  const headerCount = compiledHeaders.length;
  return {
    headers: dedupedHeaders,
    compiledHeaders,
    headerCount,
    headerNameSet,
    headerByNormalizedName,
    singleHeader: headerCount === 1 ? compiledHeaders[0] : null,
    smallCompiledHeaders: headerCount <= 3 ? compiledHeaders : null,
  };
}

function normalizeRequestHeaderName(header) {
  return header && typeof header.name === "string"
    ? header.name.toLowerCase()
    : "";
}

function copyCompiledHeader(header) {
  return {
    name: header.name,
    value: header.value,
  };
}

function copyCompiledHeaders(headers) {
  return (Array.isArray(headers) ? headers : []).map(copyCompiledHeader);
}

function mergeRequestHeadersWithSingleCompiledHeader(baseHeaders, compiledHeader) {
  let lastRelevantIndex = -1;

  for (let index = 0; index < baseHeaders.length; index += 1) {
    if (
      normalizeRequestHeaderName(baseHeaders[index]) ===
      compiledHeader.normalizedName
    ) {
      lastRelevantIndex = index;
    }
  }

  if (lastRelevantIndex === -1) {
    return baseHeaders.slice().concat(copyCompiledHeader(compiledHeader));
  }

  const merged = [];
  for (let index = 0; index < baseHeaders.length; index += 1) {
    const header = baseHeaders[index];
    if (
      normalizeRequestHeaderName(header) !== compiledHeader.normalizedName
    ) {
      merged.push(header);
      continue;
    }

    if (index !== lastRelevantIndex) {
      continue;
    }

    merged.push({
      ...header,
      name: compiledHeader.name,
      value: compiledHeader.value,
    });
  }

  return merged;
}

function getSmallCompiledHeaderIndex(compiledHeaders, normalizedName) {
  if (!normalizedName) {
    return -1;
  }

  for (let index = 0; index < compiledHeaders.length; index += 1) {
    if (compiledHeaders[index].normalizedName === normalizedName) {
      return index;
    }
  }

  return -1;
}

function mergeRequestHeadersWithSmallCompiledHeaders(baseHeaders, compiledHeaders) {
  const lastRelevantIndices = new Array(compiledHeaders.length).fill(-1);
  let hasAnyRelevantHeaders = false;

  for (let index = 0; index < baseHeaders.length; index += 1) {
    const compiledHeaderIndex = getSmallCompiledHeaderIndex(
      compiledHeaders,
      normalizeRequestHeaderName(baseHeaders[index]),
    );

    if (compiledHeaderIndex === -1) {
      continue;
    }

    lastRelevantIndices[compiledHeaderIndex] = index;
    hasAnyRelevantHeaders = true;
  }

  if (!hasAnyRelevantHeaders) {
    return baseHeaders.slice().concat(copyCompiledHeaders(compiledHeaders));
  }

  const merged = [];
  for (let index = 0; index < baseHeaders.length; index += 1) {
    const header = baseHeaders[index];
    const compiledHeaderIndex = getSmallCompiledHeaderIndex(
      compiledHeaders,
      normalizeRequestHeaderName(header),
    );

    if (compiledHeaderIndex === -1) {
      merged.push(header);
      continue;
    }

    if (lastRelevantIndices[compiledHeaderIndex] !== index) {
      continue;
    }

    const overrideHeader = compiledHeaders[compiledHeaderIndex];
    merged.push({
      ...header,
      name: overrideHeader.name,
      value: overrideHeader.value,
    });
  }

  for (let index = 0; index < compiledHeaders.length; index += 1) {
    if (lastRelevantIndices[index] !== -1) {
      continue;
    }

    merged.push(copyCompiledHeader(compiledHeaders[index]));
  }

  return merged;
}

export function mergeRequestHeadersWithCompiledPlan(requestHeaders, compiledPlan) {
  if (!compiledPlan || !compiledPlan.headers.length) {
    return Array.isArray(requestHeaders) ? requestHeaders.slice() : [];
  }

  const baseHeaders = Array.isArray(requestHeaders) ? requestHeaders : [];
  if (!baseHeaders.length) {
    return copyCompiledHeaders(compiledPlan.compiledHeaders || compiledPlan.headers);
  }

  if (compiledPlan.singleHeader) {
    return mergeRequestHeadersWithSingleCompiledHeader(
      baseHeaders,
      compiledPlan.singleHeader,
    );
  }

  if (compiledPlan.smallCompiledHeaders) {
    return mergeRequestHeadersWithSmallCompiledHeaders(
      baseHeaders,
      compiledPlan.smallCompiledHeaders,
    );
  }

  const lastRelevantIndexByName = new Map();
  for (let index = 0; index < baseHeaders.length; index += 1) {
    const header = baseHeaders[index];
    const normalizedName = normalizeRequestHeaderName(header);
    if (normalizedName && compiledPlan.headerNameSet.has(normalizedName)) {
      lastRelevantIndexByName.set(normalizedName, index);
    }
  }

  if (!lastRelevantIndexByName.size) {
    return baseHeaders
      .slice()
      .concat(copyCompiledHeaders(compiledPlan.compiledHeaders || compiledPlan.headers));
  }

  const merged = [];
  for (let index = 0; index < baseHeaders.length; index += 1) {
    const header = baseHeaders[index];
    const normalizedName = normalizeRequestHeaderName(header);

    if (!normalizedName || !compiledPlan.headerNameSet.has(normalizedName)) {
      merged.push(header);
      continue;
    }

    if (lastRelevantIndexByName.get(normalizedName) !== index) {
      continue;
    }

    const overrideHeader =
      compiledPlan.headerByNormalizedName.get(normalizedName);
    merged.push({
      ...header,
      name: overrideHeader.name,
      value: overrideHeader.value,
    });
  }

  const compiledHeaders = compiledPlan.compiledHeaders || compiledPlan.headers;
  compiledHeaders.forEach((header) => {
    if (lastRelevantIndexByName.has(header.normalizedName)) {
      return;
    }

    merged.push(copyCompiledHeader(header));
  });
  return merged;
}

export function mergeRequestHeaders(requestHeaders, overrideHeaders) {
  return mergeRequestHeadersWithCompiledPlan(
    requestHeaders,
    compileHeaderPlan([], overrideHeaders, ""),
  );
}
