import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync(new URL("../src/components/auth/ClientPlatformGate.jsx", import.meta.url), "utf8");
const users = readFileSync(new URL("../src/pages/Usuarios.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260919123000_gf_account_link_dni_integrity.sql", import.meta.url), "utf8");

test("Supabase rechaza vínculos Cliente con DNI incompatible", () => {
  assert.match(migration, /v_target_dni <> v_person_dni/);
  assert.match(migration, /El DNI de la cuenta no coincide/);
  assert.match(migration, /reason', 'link_mismatch'/);
});

test("Usuarios sólo ofrece fichas Cliente con el mismo DNI", () => {
  assert.match(users, /digits\(person\.dni\) === profileDni/);
  assert.match(users, /Vínculo incompatible/);
  assert.match(users, /Vínculo inválido/);
});

test("el gate distingue un vínculo incorrecto de una membresía futura", () => {
  assert.match(gate, /case "link_mismatch"/);
  assert.match(gate, /Tu cuenta está vinculada a otra ficha/);
  assert.match(gate, /Verificar vínculo de nuevo/);
});
