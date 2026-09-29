import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ configFile: "vite.app.config.js", server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { default: ExerciseDetail, MuscleFocus, muscleIllustration } = await vite.ssrLoadModule("/src/components/exercises/ExerciseDetail.jsx");

test("specific limbs do not use the supplied whole-arm or whole-leg highlights", () => {
  for (const group of ["Bíceps", "Tríceps", "Antebrazos", "Cuádriceps", "Isquiotibiales", "Gemelos"]) {
    assert.equal(muscleIllustration(group).precise, true);
    const html = renderToStaticMarkup(React.createElement(MuscleFocus, { group }));
    assert.match(html, /muscle-map__region is-selected/);
    assert.doesNotMatch(html, /Filtrar por|tabindex=/);
    assert.match(html, /role="img"/);
  }
});

test("both genders have packaged illustrations and unmapped groups remain neutral", () => {
  for (const gender of ["male", "female"]) {
    for (const group of ["Pecho", "Espalda", "Hombros", "Core", "Glúteos", "Cuerpo completo", "Cardio", "Movilidad", ""]) {
      const plate = muscleIllustration(group, gender);
      assert.ok(existsSync(new URL(`../public${plate.src}`, import.meta.url)), plate.src);
    }
    for (const group of ["Cardio", "Movilidad", "Desconocido"]) {
      assert.equal(muscleIllustration(group, gender).highlighted, false);
      assert.match(muscleIllustration(group, gender).src, /_00.webp$/);
    }
  }
});

test("detail has readable fallbacks and independent panel IDs in a list", () => {
  const html = renderToStaticMarkup(React.createElement("div", null,
    React.createElement(ExerciseDetail, { exercise: { name: "Press", muscle_group: "Pecho", equipment: "Barra" } }),
    React.createElement(ExerciseDetail)));
  assert.match(html, /Cómo hacerlo/);
  assert.match(html, /Grupo muscular sin especificar/);
  assert.match(html, /Sin especificar/);
  const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2);
});
