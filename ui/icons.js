export function createSvgIcon(svgMarkup, documentValue = document) {
  const Parser = documentValue.defaultView?.DOMParser || DOMParser;
  const iconDocument = new Parser().parseFromString(svgMarkup, "text/html");
  const icon = iconDocument.body.firstElementChild;
  if (
    !icon ||
    icon.localName !== "svg" ||
    icon.namespaceURI !== "http://www.w3.org/2000/svg"
  ) {
    throw new Error("Invalid SVG icon markup");
  }
  return documentValue.importNode(icon, true);
}

export function setSvgIcon(target, svgMarkup) {
  target.replaceChildren(createSvgIcon(svgMarkup, target.ownerDocument));
}
