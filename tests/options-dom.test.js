import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  createCheckbox,
  createField,
  createInput,
  createPanel,
  createSelect,
  createTextarea,
} from "../options/dom.js";

test("builds reusable options form controls", () => {
  const dom = new JSDOM("<!doctype html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    const input = createInput("value", "Placeholder");
    const field = createField("Label", input, "Help text", {
      compact: true,
      layout: "inline",
    });
    assert.strictEqual(field.classList.contains("is-inline"), true);
    assert.strictEqual(field.classList.contains("is-compact"), true);
    assert.strictEqual(field.querySelector(".field-label span").textContent, "Label");
    assert.strictEqual(field.querySelector(".help-button").title, "Help text");
    assert.strictEqual(field.lastElementChild, input);

    const panel = createPanel("Title", "Description");
    assert.strictEqual(panel.querySelector("h2").textContent, "Title");
    assert.strictEqual(panel.querySelector("p").textContent, "Description");

    const checkbox = createCheckbox(true);
    assert.strictEqual(checkbox.type, "checkbox");
    assert.strictEqual(checkbox.checked, true);

    const textarea = createTextarea("line", 4);
    assert.strictEqual(textarea.value, "line");
    assert.strictEqual(textarea.rows, 4);

    const select = createSelect(
      [
        { label: "First", value: "one" },
        { label: "Second", value: "two" },
      ],
      "two",
    );
    assert.strictEqual(select.value, "two");
    assert.strictEqual(select.options.length, 2);
  } finally {
    dom.window.close();
    delete globalThis.document;
    delete globalThis.window;
  }
});
