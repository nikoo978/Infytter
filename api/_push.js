import webpush from "web-push";
import { deliveryKey, getSubscriptions, redis, subscriptionsKey } from "./_redis.js";

export const DEFAULT_PREFERENCES = {
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

function decodeBase64Url(value) {
  if (typeof value !== "string" || !value) return Buffer.alloc(0);
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  try { return Buffer.from(normalized + padding, "base64"); } catch { return Buffer.alloc(0); }
}

export function normalizeSubscription(value) {
  const endpoint = typeof value?.endpoint === "string" ? value.endpoint.trim() : "";
  const p256dh = typeof value?.keys?.p256dh === "string" ? value.keys.p256dh.trim() : "";
  const auth = typeof value?.keys?.auth === "string" ? value.keys.auth.trim() : "";

  let endpointUrl;
  try { endpointUrl = new URL(endpoint); } catch { endpointUrl = null; }
  const host = endpointUrl?.hostname || "";
  const supportedHost = host === "fcm.googleapis.com" ||
    ["push.services.mozilla.com", "push.apple.com", "notify.windows.com"].some(domain => host === domain || host.endsWith(`.${domain}`));
  if (!endpointUrl || endpointUrl.protocol !== "https:" || !supportedHost || endpointUrl.port || endpointUrl.username || endpointUrl.password || endpointUrl.hash) {
    throw Object.assign(new Error("La suscripción Push tiene un endpoint inválido."), { statusCode: 422 });
  }

  if (decodeBase64Url(p256dh).length !== 65) {
    throw Object.assign(new Error("La suscripción Push está dañada (p256dh inválido). Desactivá y volvé a activar las notificaciones."), { statusCode: 422 });
  }

  if (decodeBase64Url(auth).length < 16) {
    throw Object.assign(new Error("La suscripción Push está dañada (auth inválido). Desactivá y volvé a activar las notificaciones."), { statusCode: 422 });
  }

  return { endpoint, expirationTime: value?.expirationTime ?? null, keys: { p256dh, auth } };
}

export function pushDiagnostics() {
  const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  return {
    ok: true,
    action: "diagnostics",
    configured: {
      vapidPublic: Boolean(vapidPublicKey),
      vapidPrivate: Boolean(process.env.VAPID_PRIVATE_KEY),
      vapidSubject: Boolean(process.env.VAPID_SUBJECT),
      redisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      redisToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
      qstashToken: Boolean(process.env.QSTASH_TOKEN),
      notificationSecret: Boolean(process.env.NOTIFICATION_SECRET),
      publicAppUrl: Boolean(process.env.PUBLIC_APP_URL),
    },
    configuredForImmediatePush: Boolean(vapidPublicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    configuredForScheduledPush: Boolean(process.env.QSTASH_TOKEN && process.env.NOTIFICATION_SECRET && process.env.PUBLIC_APP_URL),
    vapidPublicKey,
    publicKey: vapidPublicKey,
    runtime: "node",
    now: new Date().toISOString(),
  };
}

function configureWebPush() {
  const subject = String(process.env.VAPID_SUBJECT || "").trim();
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  if (!subject || !publicKey || !privateKey) throw Object.assign(new Error("VAPID no configurado"), { statusCode: 503 });
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function lockDelivery(userId, dedupeId, hash) {
  if (!dedupeId) return true;
  const key = deliveryKey(userId, dedupeId, hash);
  const result = await redis(["SET", key, "processing", "NX", "EX", 60]);
  return result === "OK";
}

async function finishDelivery(userId, dedupeId, hash) {
  if (!dedupeId) return;
  await redis(["SET", deliveryKey(userId, dedupeId, hash), "sent", "EX", 60 * 60 * 24 * 45]);
}

async function releaseDelivery(userId, dedupeId, hash) {
  if (!dedupeId) return;
  await redis(["DEL", deliveryKey(userId, dedupeId, hash)]).catch(() => undefined);
}

export async function sendPush({ userId, type, title, body, url = "/", tag, targetHash, data = {}, dedupeId }) {
  if (!userId) throw Object.assign(new Error("Usuario requerido para enviar Push"), { statusCode: 400 });
  configureWebPush();

  const subscriptions = await getSubscriptions();
  const payload = JSON.stringify({ title, body, url, tag: tag || type, type, data });
  const results = { sent: 0, skipped: 0, duplicate: 0, removed: 0, failed: 0 };

  await Promise.all(subscriptions.map(async ([hash, device]) => {
    if (device?.userId !== userId) { results.skipped += 1; return; }
    if (targetHash && hash !== targetHash) { results.skipped += 1; return; }

    const enabled = type === "newAccount" ? true : (device?.preferences?.[type] ?? DEFAULT_PREFERENCES[type] ?? true);
    if (!enabled) { results.skipped += 1; return; }

    let subscription;
    try {
      subscription = normalizeSubscription(device?.subscription);
    } catch (error) {
      console.warn("push-invalid-subscription", hash, error?.message || error);
      await redis(["HDEL", subscriptionsKey(), hash]).catch(() => undefined);
      results.removed += 1;
      return;
    }

    const acquired = await lockDelivery(userId, dedupeId, hash);
    if (!acquired) { results.duplicate += 1; return; }

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 86400,
        urgency: "high",
        timeout: 10000,
      });
      await finishDelivery(userId, dedupeId, hash);
      results.sent += 1;
    } catch (error) {
      const status = Number(error?.statusCode || error?.status);
      if (status === 404 || status === 410) {
        await redis(["HDEL", subscriptionsKey(), hash]).catch(() => undefined);
        await finishDelivery(userId, dedupeId, hash).catch(() => undefined);
        results.removed += 1;
      } else {
        await releaseDelivery(userId, dedupeId, hash);
        console.error("push-send", status || "error", error?.message || error);
        results.failed += 1;
      }
    }
  }));

  return results;
}
