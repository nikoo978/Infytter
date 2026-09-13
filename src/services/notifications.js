import { supabase } from "./supabase";

const DEFAULT_PREFERENCES = {
  newAccount: true,
  newClient: true,
  income: true,
  withdrawal: true,
  expense: true,
  membershipExpiring: true,
  membershipExpired: true,
  clientAccess: false,
  staffAccess: false,
  deniedAccess: true,
  manualAccess: true,
};

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);
const isWindows = () => /Windows/i.test(navigator.userAgent);
const isMac = () => /Macintosh|Mac OS X/i.test(navigator.userAgent) && !isIOS();
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export function getDeviceEnvironment() {
  const ua = navigator.userAgent;
  const platform = isIOS() ? "ios" : isAndroid() ? "android" : isWindows() ? "windows" : isMac() ? "mac" : "desktop";
  const browser = /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return { platform, browser, standalone: isStandalone() };
}

function base64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function sameBytes(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.every((value, index) => value === b[index]);
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function accessToken() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function parseApiResponse(response, url) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (contentType.includes("text/html") || /^\s*<!doctype html/i.test(text)) {
      throw new Error(`La API de notificaciones no está desplegada correctamente en el servidor (${url} devuelve la aplicación web en lugar de JSON).`);
    }
    throw new Error(`Respuesta inválida del servidor de notificaciones (${response.status}).`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

async function publicApiFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  return parseApiResponse(response, url);
}

async function apiFetch(url, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error("Iniciá sesión con una cuenta cloud para usar notificaciones remotas.");
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  return parseApiResponse(response, url);
}

function deviceMetadata() {
  const ua = navigator.userAgent;
  const environment = getDeviceEnvironment();
  const platformLabel = environment.platform === "ios" ? "iOS" : environment.platform === "android" ? "Android" : environment.platform === "windows" ? "Windows" : environment.platform === "mac" ? "macOS" : navigator.platform || "Web";
  return { platform: platformLabel, browser: environment.browser, standalone: environment.standalone, userAgent: ua.slice(0, 220) };
}

function deviceName(metadata) {
  return `${metadata.platform} · ${metadata.browser}${metadata.standalone ? " · PWA" : ""}`;
}

async function registration() {
  if (!("serviceWorker" in navigator)) throw new Error("Este navegador no admite Service Worker.");

  let registered = null;
  try {
    registered = await withTimeout(
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }),
      5000,
      "El Service Worker tardó demasiado en registrarse."
    );
    registered.update().catch(() => undefined);
  } catch (registerError) {
    registered = await withTimeout(
      navigator.serviceWorker.getRegistration("/"),
      2000,
      "No se pudo consultar el Service Worker."
    ).catch(() => null);
    if (!registered) throw registerError;
  }

  if (registered?.pushManager) return registered;
  return withTimeout(
    navigator.serviceWorker.ready,
    3000,
    "El Service Worker no quedó listo a tiempo. Cerrá y volvé a abrir la app."
  );
}

export async function getPushDiagnostics() {
  return withTimeout(
    publicApiFetch("/api/push?action=diagnostics", { method: "GET" }),
    5000,
    "La API de notificaciones tardó demasiado en responder."
  );
}

export async function getPushStatus({ remote = true } = {}) {
  if (!window.isSecureContext || !("Notification" in window)) {
    return { supported: false, permission: "unsupported", subscription: null };
  }

  if (!remote) {
    return { supported: true, permission: Notification.permission, subscription: null, localOnly: true };
  }

  if (!("PushManager" in window)) return { supported: false, permission: "unsupported", subscription: null };

  const environment = getDeviceEnvironment();
  if (environment.platform === "ios" && !environment.standalone) {
    return { supported: true, permission: Notification.permission, subscription: null, requiresInstall: true };
  }

  const reg = await registration();
  const subscription = await withTimeout(reg.pushManager.getSubscription(), 3000, "No se pudo consultar la suscripción Push a tiempo.");

  let server = {};
  if (subscription) {
    try {
      server = await withTimeout(
        apiFetch(`/api/push?action=current&endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: "GET" }),
        5000,
        "El servidor de notificaciones tardó demasiado en responder."
      );
    } catch {
      server = {};
    }
  }

  return { supported: true, permission: Notification.permission, subscription, ...server };
}

export async function enableLocalNotifications() {
  if (!window.isSecureContext || !("Notification" in window)) throw new Error("Las notificaciones no están disponibles en este navegador.");
  const permission = await Notification.requestPermission();
  return { permission, local: permission === "granted", remote: false };
}

export async function testBrowserNotification() {
  if (!window.isSecureContext || !("Notification" in window)) {
    throw new Error("Las notificaciones no están disponibles en este navegador.");
  }

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "El permiso de notificaciones está bloqueado en el navegador."
      : "No se otorgó permiso para notificaciones.");
  }

  const reg = await registration();
  await withTimeout(
    reg.showNotification("Infytter Fitness", {
      body: "Prueba local correcta. El navegador y el Service Worker pueden mostrar notificaciones.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `browser-test-${Date.now()}`,
      data: { url: "/notificaciones", type: "browser-test" },
    }),
    4000,
    "El navegador no pudo mostrar la notificación de prueba."
  );

  return { ok: true, permission };
}

export async function enablePushNotifications(preferences = DEFAULT_PREFERENCES) {
  if (!window.isSecureContext || !("Notification" in window) || !("PushManager" in window)) {
    throw new Error("Web Push no está disponible en este navegador.");
  }

  const environment = getDeviceEnvironment();
  if (environment.platform === "ios" && !environment.standalone) {
    throw new Error("En iPhone/iPad primero instalá Infytter en la pantalla de inicio y abrila desde allí.");
  }

  const config = await getPushDiagnostics();
  const publicKey = String(config.vapidPublicKey || config.publicKey || "").trim();
  if (!config.configuredForImmediatePush || !publicKey) {
    throw new Error("Web Push no está configurado completamente en el servidor (VAPID + Redis). ");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { permission, remote: false };

  const reg = await registration();
  const expectedKey = base64ToUint8Array(publicKey);
  let subscription = await withTimeout(reg.pushManager.getSubscription(), 3000, "No se pudo consultar la suscripción Push.");

  if (subscription?.options?.applicationServerKey && !sameBytes(subscription.options.applicationServerKey, expectedKey)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await withTimeout(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey }),
      10000,
      "El navegador no completó la suscripción Push a tiempo."
    );
  }

  const metadata = deviceMetadata();
  const saved = await withTimeout(
    apiFetch("/api/push?action=subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: subscription.toJSON(), deviceName: deviceName(metadata), metadata, preferences }),
    }),
    7000,
    "El servidor no pudo registrar este dispositivo a tiempo."
  );

  return { permission, remote: true, subscription, ...saved };
}

export async function updatePushPreferences(preferences) {
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) throw new Error("Primero activá las notificaciones en este dispositivo.");
  return apiFetch("/api/push?action=preferences", {
    method: "PATCH",
    body: JSON.stringify({ subscription: subscription.toJSON(), preferences }),
  });
}

export async function testPushNotification() {
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) throw new Error("Primero activá las notificaciones.");
  return apiFetch("/api/push?action=test", {
    method: "POST",
    body: JSON.stringify({ action: "test", endpoint: subscription.endpoint }),
  });
}

export async function disablePushNotifications() {
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  await apiFetch("/api/push?action=unsubscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe();
  return { ok: true };
}

export async function unlinkPushSubscriptionBeforeLogout() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
  const subscription = await reg?.pushManager?.getSubscription?.().catch(() => null);
  if (!subscription) return;

  await apiFetch("/api/push?action=unsubscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

export async function sendRemoteEvent(event) {
  return apiFetch("/api/events", { method: "POST", body: JSON.stringify(event) });
}

export async function scheduleMembershipNotifications(person) {
  if (!person?.id) return;
  return apiFetch("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ action: "schedule", person: { id: person.id, name: person.name, expiry: person.expiry, branch: person.branch } }),
  });
}

export async function cancelMembershipNotifications(personId) {
  if (!personId) return;
  return apiFetch("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ action: "cancel", person: { id: personId } }),
  });
}

export async function notifyAdminAccountRegistration(userId, email) {
  if (!userId || !email) return { ok: false, ignored: true };
  return withTimeout(
    publicApiFetch("/api/account-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    }),
    8000,
    "No se pudo avisar al administrador sobre el registro."
  );
}

export { DEFAULT_PREFERENCES };
