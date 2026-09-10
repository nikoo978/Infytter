import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ configFile: "vite.app.config.js", server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { AnatomyFigure, default: MuscleMap } = await vite.ssrLoadModule("/src/components/exercises/MuscleMap.jsx");

// Expand the stateless SVG components to exercise their actual event handlers.
function buttons(element, result = []) {
  if (!element) return result;
  if (Array.isArray(element)) { element.forEach((child) => buttons(child, result)); return result; }
  if (typeof element.type === "function") return buttons(element.type(element.props), result);
  if (element.props?.role === "button") result.push(element.props);
  buttons(element.props?.children, result);
  return result;
}

test("both figures expose the existing muscle filters and keep calves on the posterior view", () => {
  const expected = ["Cuello", "Hombros", "Pecho", "Core", "Cadera", "Cuádriceps", "Bíceps", "Antebrazos", "Espalda", "Glúteos", "Isquiotibiales", "Gemelos", "Tríceps"].sort();
  for (const gender of ["male", "female"]) {
    const front = buttons(AnatomyFigure({ gender }));
    const back = buttons(AnatomyFigure({ gender, back: true }));
    const names = [...new Set([...front, ...back].map((props) => props["aria-label"].replace("Filtrar por ", "")))].sort();
    assert.deepEqual(names, expected);
    assert.ok(!front.some((props) => props["aria-label"] === "Filtrar por Gemelos"));
    assert.ok(back.some((props) => props["aria-label"] === "Filtrar por Gemelos"));
  }
});

test("a muscle activates once by click, Enter or Space and ignores unrelated keys", () => {
  const selected = [];
  const target = buttons(AnatomyFigure({ gender: "male", onSelect: (name) => selected.push(name) })).find((props) => props["aria-label"] === "Filtrar por Pecho");
  target.onClick();
  let prevented = 0;
  for (const key of ["Enter", " ", "Escape"]) target.onKeyDown({ key, preventDefault: () => prevented++ });
  assert.deepEqual(selected, ["Pecho", "Pecho", "Pecho"]);
  assert.equal(prevented, 2);
});

test("selection highlights only its group and extra detail preserves filter semantics", () => {
  for (const gender of ["male", "female"]) for (const detailed of [false, true]) {
    const targets = buttons(AnatomyFigure({ gender, detailed, back: true, selected: "Espalda" }));
    assert.deepEqual(targets.filter((props) => props["aria-pressed"]).map((props) => props["aria-label"]), ["Filtrar por Espalda"]);
    for (const target of targets) assert.equal(target.tabIndex, 0);
  }
});

test("the controlled map shows external selections and keeps an accessible reset", () => {
  const html = renderToStaticMarkup(React.createElement(MuscleMap, { value: "Gemelos", onChange: () => {} }));
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Ver todos/);
  assert.match(html, /Filtrar por Gemelos/);
  assert.equal((html.match(/class="muscle-map__region is-selected"/g) || []).length, 1);
  const idle = renderToStaticMarkup(React.createElement(MuscleMap, { onChange: () => {} }));
  assert.match(idle, /Sin filtro corporal/);
  assert.doesNotMatch(idle, /muscle-map__region is-selected/);
});
