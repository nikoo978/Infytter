import assert from "node:assert/strict";
import test from "node:test";

import { createAppServer } from "../server/index.js";

async function withServer(run) {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("serves the branded Vite shell and SPA routes", async () => {
  await withServer(async (baseUrl) => {
    for (const pathname of ["/", "/pantalla-acceso"]) {
      const response = await fetch(`${baseUrl}${pathname}`, { headers: { accept: "text/html" } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
      const html = await response.text();
      assert.match(html, /<title>Infytter Fitness - Gestión de Gimnasio<\/title>/i);
      assert.match(html, /<div id="root"><\/div>/i);
      assert.match(html, /\/assets\/.+\.js/i);
      assert.doesNotMatch(html, /codex-preview/i);
    }
  });
});

test("serves the portable health endpoint", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.deepEqual(await response.json(), { ok: true, service: "gymflow" });
  });
});

test("adapts API query parameters for Push diagnostics", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/push?action=diagnostics`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.action, "diagnostics");
    assert.equal(body.runtime, "node");
    assert.equal(body.configured.publicAppUrl, false);
  });
});

test("returns a JSON 404 for unknown API routes", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    assert.deepEqual(await response.json(), { error: "API no encontrada" });
  });
});

test("missing assets and private paths never receive a cacheable SPA document", async () => {
  await withServer(async (baseUrl) => {
    for (const path of ["/assets/missing-12345678.js", "/missing.css", "/.env", "/%2ehidden"]) {
      const response = await fetch(baseUrl + path);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.doesNotMatch(await response.text(), /<html/i);
    }
  });
});

test("bad paths and oversized bodies fail without taking the server down", async () => {
  await withServer(async (baseUrl) => {
    for (const path of ["/%ZZ", "/%00"]) assert.equal((await fetch(baseUrl + path)).status, 400);
    const malformed = await fetch(baseUrl + "/api/push", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    });
    assert.equal(malformed.status, 400);
    const large = await fetch(baseUrl + "/api/push", { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
    assert.equal(large.status, 413);
    const health = await fetch(baseUrl + "/api/health?__proto__=x&constructor=y&constructor=z");
    assert.equal(health.status, 200);
    assert.match(health.headers.get("cache-control"), /no-store/);
  });
});

test("GET cannot unsubscribe, send Push or change preferences", async () => {
  await withServer(async (baseUrl) => {
    for (const action of ["unsubscribe", "test", "preferences", "subscribe"]) {
      const response = await fetch(`${baseUrl}/api/push?action=${action}&endpoint=https://example.com`);
      assert.equal(response.status, 405, action);
      assert.ok(response.headers.get("allow"));
    }
  });
});
