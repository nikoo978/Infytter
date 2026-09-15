import test from "node:test";
import assert from "node:assert/strict";
import { getAuthRedirectUrl, PRODUCTION_APP_URL } from "../src/services/authRedirect.js";

test("confirmation emails always return to the Infytter production domain", () => {
  const url = getAuthRedirectUrl("/bienvenido?email_confirmado=1", {
    hostname: "gymflow-old.example.com",
    origin: "https://gymflow-old.example.com",
  });
  assert.equal(url, `${PRODUCTION_APP_URL}/bienvenido?email_confirmado=1`);
});

test("localhost keeps a local callback for development", () => {
  const url = getAuthRedirectUrl("/bienvenido?email_confirmado=1", {
    hostname: "localhost",
    origin: "http://localhost:5173",
  });
  assert.equal(url, "http://localhost:5173/bienvenido?email_confirmado=1");
});

test("redirect helper normalizes paths", () => {
  const url = getAuthRedirectUrl("bienvenido", {
    hostname: "infytter.coffeetec.com.ar",
    origin: PRODUCTION_APP_URL,
  });
  assert.equal(url, `${PRODUCTION_APP_URL}/bienvenido`);
});
