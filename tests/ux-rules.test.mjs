import assert from "node:assert/strict";
import test from "node:test";

import { calculateBodyComposition } from "../src/services/bodyComposition.js";
import { passwordPolicyError, passwordRequirementStatus } from "../src/services/passwordPolicy.js";

test("password policy explains and accepts every required character class", () => {
  assert.match(passwordPolicyError("solominusculas"), /mayúscula/i);
  assert.equal(passwordPolicyError("Infytter9!"), "");
  const status = Object.fromEntries(passwordRequirementStatus("Infytter9!").map((item) => [item.key, item.met]));
  assert.deepEqual(status, { length: true, lower: true, upper: true, number: true, symbol: true });
});

test("Navy calculation returns a male estimate with complete measurements", () => {
  const result = calculateBodyComposition({ weightKg: 80, heightCm: 180, waistCm: 90, neckCm: 40, sex: "male" });
  assert.equal(result.bmi, 24.69);
  assert.equal(result.bodyFatPct, 18.37);
  assert.equal(result.bodyFatState, "valid");
});

test("Navy calculation returns a female estimate when hip is present", () => {
  const result = calculateBodyComposition({ weightKg: 65, heightCm: 165, waistCm: 75, neckCm: 33, hipCm: 95, sex: "female" });
  assert.equal(result.bmi, 23.88);
  assert.equal(result.bodyFatPct, 26.92);
  assert.equal(result.bodyFatState, "valid");
});

test("Navy calculation names missing female measurements", () => {
  const result = calculateBodyComposition({ weightKg: 65, heightCm: 165, waistCm: 75, neckCm: 33, sex: "female" });
  assert.equal(result.bodyFatPct, null);
  assert.equal(result.bodyFatState, "incomplete");
  assert.match(result.bodyFatMessage, /cadera/i);
});

test("Navy calculation rejects physiologically invalid estimates instead of silently presenting them", () => {
  const result = calculateBodyComposition({ weightKg: 45, heightCm: 160, waistCm: 30, neckCm: 20, hipCm: 55, sex: "female" });
  assert.equal(result.bodyFatPct, null);
  assert.equal(result.bodyFatState, "invalid");
  assert.match(result.bodyFatMessage, /fuera del rango/i);
});
