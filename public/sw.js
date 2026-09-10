const SW_VERSION = "gymflow-push-v1-07-2";
const CACHE_NAME = "gymflow-shell-v1-07-2";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/infytter-logo.svg",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

function canCache(response) {
  return response.ok && response.type === "basic" && !/(?:no-store|private)/i.test(response.headers.get("cache-control") || "");
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch("/", { cache: "no-store" });
  if (!canCache(response) || !response.headers.get("content-type")?.includes("text/html")) throw new Error("No se pudo preparar la copia offline");
  const html = await response.clone().text();
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) urls.add(url.pathname + url.search);
  }
  if (!urls.size) throw new Error("La aplicación offline está incompleta");
  // Mantener el worker anterior si falla un archivo necesario de la nueva versión.
  await Promise.all([...urls].map((url) => cache.add(url)));
  await cache.put("/", response);
  await Promise.allSettled(CORE_ASSETS.filter(url => url !== "/").map(url => cache.add(url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await cacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("gymflow-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || (url.pathname === "/api" || url.pathname.startsWith("/api/"))) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (canCache(response) && response.headers.get("content-type")?.includes("text/html")) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        const cached = await (await caches.open(CACHE_NAME)).match("/");
        if (cached) return cached;
        throw new Error("GymFlow todavía no tiene una copia offline en esta PC.");
      }
    })());
    return;
  }
  if (!url.pathname.startsWith("/assets/") && !CORE_ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (canCache(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json?.() || {}; } catch { payload = { body: event.data?.text?.() || "" }; }
  const options = {
    body: payload.body || "Tenés una nueva notificación.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || payload.type || `infytter-${Date.now()}`,
    renotify: true,
    vibrate: [180, 100, 180],
    data: { url: payload.url || "/", type: payload.type || null, swVersion: SW_VERSION, ...(payload.data || {}) },
    actions: [{ action: "open", title: "Abrir" }],
  };
  event.waitUntil(self.registration.showNotification(payload.title || "Infytter Fitness", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try { target = new URL(event.notification.data?.url || "/", self.location.origin); } catch { target = new URL("/", self.location.origin); }
  const url = target.origin === self.location.origin ? target.href : new URL("/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("navigate" in client && client.url !== url) await client.navigate(url).catch(() => undefined);
      if ("focus" in client) return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
