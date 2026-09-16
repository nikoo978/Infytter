import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/auth/EmailConfirmedWelcome.jsx", import.meta.url), "utf8");
const siteApp = readFileSync(new URL("../src/SiteApp.jsx", import.meta.url), "utf8");

test("la confirmación exitosa muestra el mensaje solicitado de Infytter", () => {
  assert.match(source, /¡BIENVENIDO!/);
  assert.match(source, /¡SU MAIL HA SIDO CONFIRMADO!/);
  assert.match(source, /Entrar a Infytter/);
});

test("la ruta de bienvenida se resuelve antes del AuthProvider", () => {
  const welcomeIndex = siteApp.indexOf('window.location.pathname === "/bienvenido"');
  const authIndex = siteApp.indexOf("<AuthProvider>");
  assert.ok(welcomeIndex >= 0);
  assert.ok(authIndex >= 0);
  assert.ok(welcomeIndex < authIndex);
});
