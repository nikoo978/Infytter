import test from "node:test";
import assert from "node:assert/strict";
import { authRateLimitDetails, firstAuthErrorField, sanitizeDni, validateAuthForm } from "../src/services/authForm.js";

test("registro devuelve errores propios y ordenados sin depender del navegador", () => {
  const result = validateAuthForm({ view: "register", name: "", dni: "", email: "", password: "" });
  assert.equal(result.errors.name, "Completá tu nombre y apellido.");
  assert.equal(result.errors.dni, "Completá tu DNI.");
  assert.equal(result.errors.email, "Completá tu email.");
  assert.equal(result.errors.password, "Completá la contraseña.");
  assert.equal(firstAuthErrorField(result.errors), "name");
});

test("nombre corto y nombre sin apellido tienen mensajes claros", () => {
  assert.equal(validateAuthForm({ view: "register", name: "A", dni: "12345678", email: "a@b.com", password: "abc12345" }).errors.name, "Usá al menos 3 caracteres.");
  assert.equal(validateAuthForm({ view: "register", name: "Nicolas", dni: "12345678", email: "a@b.com", password: "abc12345" }).errors.name, "Ingresá nombre y apellido.");
});

test("DNI se normaliza y valida entre 6 y 10 dígitos", () => {
  assert.equal(sanitizeDni("12.345.678"), "12345678");
  assert.equal(validateAuthForm({ view: "register", name: "Ana Perez", dni: "12345", email: "ana@test.com", password: "abc12345" }).errors.dni, "Ingresá entre 6 y 10 números, sin puntos ni espacios.");
});

test("email inválido se detecta antes de llamar a Supabase", () => {
  const result = validateAuthForm({ view: "register", name: "Ana Perez", dni: "12345678", email: "ana@", password: "abc12345" });
  assert.match(result.errors.email, /email válido/);
});

test("registro válido queda normalizado", () => {
  const result = validateAuthForm({ view: "register", name: "  Ana   Perez ", dni: "12.345.678", email: "ANA@TEST.COM", password: "abc12345" });
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.name, "Ana Perez");
  assert.equal(result.values.dni, "12345678");
  assert.equal(result.values.email, "ana@test.com");
});

test("rate limit de correo y de requests muestran causas distintas", () => {
  const mail = authRateLimitDetails({ status: 429, code: "over_email_send_rate_limit" }, "register");
  const requests = authRateLimitDetails({ status: 429, code: "over_request_rate_limit" }, "register");
  assert.match(mail.message, /servicio de correo/);
  assert.equal(mail.retryAfterSeconds, 120);
  assert.match(requests.message, /Esta conexión/);
  assert.equal(requests.retryAfterSeconds, 60);
});
