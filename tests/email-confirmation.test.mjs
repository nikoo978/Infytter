import test from "node:test";
import assert from "node:assert/strict";
import { emailConfirmationResult } from "../src/services/emailConfirmation.js";

test("la ruta de bienvenida reconoce una confirmación exitosa", () => {
  const result = emailConfirmationResult({ search: "?email_confirmado=1", hash: "#access_token=abc" });
  assert.equal(result.status, "success");
});

test("un error de Supabase nunca se presenta como confirmación exitosa", () => {
  const result = emailConfirmationResult({
    search: "?email_confirmado=1",
    hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  });
  assert.equal(result.status, "error");
  assert.equal(result.errorCode, "otp_expired");
  assert.match(result.message, /expired/i);
});

test("abrir bienvenida manualmente no finge que el mail fue confirmado", () => {
  const result = emailConfirmationResult({ search: "", hash: "" });
  assert.equal(result.status, "unknown");
});
