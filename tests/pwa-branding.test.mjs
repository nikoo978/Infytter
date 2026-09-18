import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

test("la PWA usa el isologo de Infytter en manifest", () => {
  const sources = manifest.icons.map((icon) => icon.src);
  assert.deepEqual(sources, [
    "/icons/infytter-isologo-192.png",
    "/icons/infytter-isologo-512.png",
  ]);
  assert.ok(manifest.icons.every((icon) => icon.purpose.includes("maskable")));
});

test("iOS usa el Apple Touch Icon del isologo", () => {
  assert.match(html, /infytter-isologo-apple-180\.png/);
  assert.match(html, /apple-mobile-web-app-title" content="Infytter"/);
});

test("el service worker precarga y usa los nuevos iconos", () => {
  assert.match(sw, /infytter-isologo-192\.png/);
  assert.match(sw, /infytter-isologo-512\.png/);
  assert.match(sw, /infytter-isologo-apple-180\.png/);
  assert.doesNotMatch(sw, /\/icons\/icon-192\.png/);
});
