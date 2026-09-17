import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync(new URL("../src/components/auth/ClientPlatformGate.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260917061000_gf_client_membership_platform_gate.sql", import.meta.url), "utf8");

test("el portal Cliente queda detrás del gate de membresía", () => {
  assert.match(app, /<ClientPlatformGate><ClientHomeV106 \/><\/ClientPlatformGate>/);
  assert.match(gate, /gf_get_my_platform_access|Verificando tu membresía/);
  assert.match(gate, /Cuenta pendiente de vinculación/);
  assert.match(gate, /Mensualidad vencida/);
});

test("Supabase exige vínculo y mensualidad vigente usando fecha argentina", () => {
  assert.match(migration, /America\/Argentina\/Buenos_Aires/);
  assert.match(migration, /expiry_date < v_today/);
  assert.match(migration, /start_date > v_today/);
  assert.match(migration, /archivedAt/);
});

test("la lectura de ejercicios queda restringida también en RLS", () => {
  assert.match(migration, /Usuarios habilitados leen ejercicios/);
  assert.match(migration, /gf_client_has_platform_access\(\)/);
  assert.match(migration, /'admin'::text, 'coadmin'::text, 'profe'::text/);
});
