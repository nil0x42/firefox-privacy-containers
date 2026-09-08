import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createSvgIcon, setSvgIcon } from "../ui/icons.js";

test("creates SVG icons without accepting other markup roots", () => {
  const dom = new JSDOM("<!doctype html><div id=target></div>");
  const { document } = dom.window;

  try {
    const icon = createSvgIcon(
      '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>',
      document,
    );
    assert.strictEqual(icon.localName, "svg");
    assert.strictEqual(icon.namespaceURI, "http://www.w3.org/2000/svg");

    const target = document.getElementById("target");
    setSvgIcon(target, '<svg viewBox="0 0 1 1"></svg>');
    assert.strictEqual(target.children.length, 1);
    assert.strictEqual(target.firstElementChild.localName, "svg");

    assert.throws(
      () => createSvgIcon("<img src=x>", document),
      /Invalid SVG icon markup/,
    );
  } finally {
    dom.window.close();
  }
});
