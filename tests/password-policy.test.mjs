import test from "node:test";
import assert from "node:assert/strict";
import {
  passwordPolicyError,
  signupPasswordPolicyError,
  signupPasswordRequirementStatus,
} from "../src/services/passwordPolicy.js";

test("signup requires at least 78 characters", () => {
  assert.match(signupPasswordPolicyError(`${"a".repeat(76)}1`), /78 caracteres/);
  assert.equal(signupPasswordPolicyError(`${"a".repeat(77)}1`), "");
});

test("signup requires at least one letter and one number", () => {
  assert.match(signupPasswordPolicyError("a".repeat(78)), /1 número/);
  assert.match(signupPasswordPolicyError("1".repeat(78)), /1 letra/);
  assert.equal(signupPasswordPolicyError(`${"ñ".repeat(77)}1`), "");
});

test("signup password cannot equal DNI", () => {
  assert.equal(signupPasswordPolicyError("12345678", { dni: "12.345.678" }), "La contraseña no puede ser igual al DNI.");
  const status = signupPasswordRequirementStatus("12345678", "12.345.678");
  assert.equal(status.find((item) => item.key === "dni")?.met, false);
});

test("existing-account recovery policy remains unchanged", () => {
  assert.equal(passwordPolicyError("Abcdef1!"), "");
  assert.notEqual(passwordPolicyError(`${"a".repeat(77)}1`), "");
});
