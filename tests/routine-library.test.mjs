import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const vite = await createServer({ configFile: "vite.app.config.js", server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const { default: TrainingPlan } = await vite.ssrLoadModule("/src/components/routines/TrainingPlan.jsx");
test("scheduled, unscheduled and professor routines stay visible together", () => {
  const item = { exercise_name: "Press", sets: 3, reps: "10" };
  const html = renderToStaticMarkup(React.createElement(TrainingPlan, {
    routines: { personal: [{ id: "a", title: "Bíceps libre", items: [item] }, { id: "b", title: "Piernas miércoles", scheduleDays: [3], items: [item] }], assigned: [{ id: "c", title: "Torso del profesor", sourceType: "professor", scheduleDays: [7], items: [item] }] },
    onChangeDays: () => {},
  }));
  for (const title of ["Bíceps libre", "Piernas miércoles", "Torso del profesor"]) assert.ok(html.includes(title));
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 3);
  assert.ok(!html.includes("Press"));
  assert.ok(!html.includes("Comenzar entrenamiento"));
  assert.ok(!html.includes("Organizar días (opcional)"));
  assert.ok(html.includes("Todas tus rutinas están siempre disponibles"));
});
