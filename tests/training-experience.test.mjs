import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync(new URL("../src/pages/ClientHomeV106.jsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/components/routines/RoutineEditor.jsx", import.meta.url), "utf8");
const plan = readFileSync(new URL("../src/components/routines/TrainingPlan.jsx", import.meta.url), "utf8");
const runner = readFileSync(new URL("../src/components/routines/WorkoutRunnerV2.jsx", import.meta.url), "utf8");
const professor = readFileSync(new URL("../src/components/routines/ProfessorTrainingOverview.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260917192000_gf_training_plan_performance_v1090.sql", import.meta.url), "utf8");
const globalHistory = readFileSync(new URL("../supabase/migrations/20260917192200_gf_global_exercise_last_values_v1090.sql", import.meta.url), "utf8");

test("Cliente usa navegación Inicio, Entrenar, Progreso y Perfil", () => {
  assert.match(client, /label="Inicio"/);
  assert.match(client, /label="Entrenar"/);
  assert.match(client, /label="Progreso"/);
  assert.match(client, /label="Perfil"/);
  assert.match(client, /<TrainingPlan/);
  assert.match(client, /<TrainingProgressPanel/);
});

test("las rutinas permiten programar días y el plan los muestra por semana", () => {
  assert.match(editor, /scheduleDays/);
  assert.match(editor, /Días del plan/);
  assert.match(plan, /TRAINING_DAYS/);
  assert.match(plan, /Comenzar entrenamiento/);
  assert.match(migration, /schedule_days/);
  assert.match(migration, /gf_save_professor_routine_v2/);
});

test("el runner guarda en la nube y ofrece descanso, cargas e historial global", () => {
  assert.match(runner, /saveWorkoutProgress/);
  assert.match(runner, /Guardado/);
  assert.match(runner, /restLeft/);
  assert.match(runner, /Última vez · cualquier rutina/);
  assert.match(runner, /e1RM estimado/);
  assert.match(runner, /Agregar serie/);
  assert.doesNotMatch(runner, /localStorage|sessionStorage|indexedDB/i);
  assert.match(globalHistory, /all_user_sessions/);
});

test("Profesor puede revisar entrenamientos reales del Cliente", () => {
  assert.match(professor, /Entrenamientos reales/);
  assert.match(professor, /getPersonTrainingOverview/);
  assert.match(migration, /gf_get_person_training_overview/);
});

test("los RPC de progreso vuelven a exigir mensualidad vigente", () => {
  assert.match(migration, /gf_client_has_platform_access\(\)/);
  assert.match(migration, /Necesitás una mensualidad vigente/);
});
