import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const vite = await createServer({ configFile: "vite.app.config.js", server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { default: ExerciseDetail, MuscleFocus } = await vite.ssrLoadModule("/src/components/exercises/ExerciseDetail.jsx");
test("specific limb highlights use cropped plates with independent SVG IDs", () => {
 const html = renderToStaticMarkup(React.createElement("div", null, React.createElement(MuscleFocus, { group: "Bíceps" }), React.createElement(MuscleFocus, { group: "Gemelos" })));
 assert.match(html, /male_muscle_03.webp/);
 assert.match(html, /male_muscle_07.webp/);
 const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map(x => x[1]);
 assert.equal(new Set(ids).size, 4);
 assert.doesNotMatch(html, /Filtrar por|tabindex=/);
});
test("technique is immediately available without changing membership or exercise data", () => {
 const html = renderToStaticMarkup(React.createElement(ExerciseDetail, { exercise: { name: "Press", notes: "Bajá de forma controlada", equipment: "Barra", image_url: "/sample.gif" } }));
 assert.match(html, /Bajá de forma controlada/);
 assert.match(html, /Barra/);
 assert.match(html, /Abrir en pantalla completa/);
 assert.doesNotMatch(html, /Aumentar zoom/);
});
