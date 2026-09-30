import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const vite = await createServer({ configFile: "vite.app.config.js", server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { AnatomyFigure, default: MuscleMap } = await vite.ssrLoadModule("/src/components/exercises/MuscleMap.jsx");
test("anatomy exposes all existing filters for both genders", () => {
  for (const gender of ["male", "female"]) {
    const html = [false, true].map((back) => renderToStaticMarkup(React.createElement(AnatomyFigure, { gender, back, interactive: true }))).join("");
    for (const group of ["Cuello", "Hombros", "Pecho", "Core", "Cadera", "Cuádriceps", "Bíceps", "Antebrazos", "Espalda", "Glúteos", "Isquiotibiales", "Gemelos", "Tríceps"]) assert.ok(html.includes(`Filtrar por ${group}`), group);
    assert.match(html, /tabindex="0"/);
    const front = renderToStaticMarkup(React.createElement(AnatomyFigure, { gender, interactive: true }));
    assert.doesNotMatch(front, /Filtrar por Gemelos/);
  }
});
test("informational anatomy has no inactive keyboard controls", () => {
  const html = renderToStaticMarkup(React.createElement(AnatomyFigure, { gender: "female", back: true, selected: "Isquiotibiales" }));
  assert.match(html, /female_muscle_07.webp/);
  assert.match(html, /clip-path=/);
  assert.doesNotMatch(html, /tabindex|role="button"/);
});
test("controlled selection keeps the reset and status", () => {
  const html = renderToStaticMarkup(React.createElement(MuscleMap, { value: "Gemelos", onChange: () => {} }));
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Ver todos/);
  assert.match(html, /aria-pressed="true"/);
});
