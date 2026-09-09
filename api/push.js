import { requireAdmin } from "./_auth.js";
import { DEFAULT_PREFERENCES, normalizeSubscription, pushDiagnostics, sendPush } from "./_push.js";
import { getSubscriptions, hashEndpoint, redis, subscriptionsKey } from "./_redis.js";

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function actionOf(req) {
  const queryAction = typeof req.query?.action === "string" ? req.query.action : "";
  if (queryAction) return queryAction;
  if (req.body?.action) return String(req.body.action);
  if (req.method === "DELETE") return "unsubscribe";
  if (req.method === "PATCH") return "preferences";
  if (req.method === "POST") return "subscribe";
  if (req.method === "GET" && req.query?.endpoint) return "current";
  return "diagnostics";
}

function endpointFrom(req) {
  return req.body?.subscription?.endpoint || req.body?.endpoint || req.query?.endpoint || "";
}

async function readRecord(hash) {
  const raw = await redis(["HGET", subscriptionsKey(), hash]);
  if (!raw) return null;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const action = actionOf(req);

    if (req.method === "OPTIONS") return res.status(204).end();

    const methods = {
      diagnostics: ["GET"], list: ["GET"], current: ["GET"],
      subscribe: ["POST"], preferences: ["POST", "PATCH"],
      unsubscribe: ["POST", "DELETE"], test: ["POST"],
    };
    if (!Object.hasOwn(methods, action)) return json(res, 400, { error: "Acción Push inválida." });
    if (!methods[action].includes(req.method)) {
      res.setHeader("Allow", methods[action].join(", "));
      return json(res, 405, { error: "Método no permitido." });
    }

    // La clave VAPID pública es, por definición, pública. Este diagnóstico no
    // depende de una sesión para que la pantalla pueda detectar errores de deploy.
    if (req.method === "GET" && action === "diagnostics") {
      return json(res, 200, pushDiagnostics());
    }

    const admin = await requireAdmin(req);

    if (req.method === "GET" && action === "list") {
      const devices = (await getSubscriptions())
        .filter(([, record]) => record?.userId === admin.uid)
        .map(([subscriptionHash, record]) => ({
          subscriptionHash,
          deviceName: record.deviceName || "Dispositivo",
          metadata: record.metadata || {},
          preferences: { ...DEFAULT_PREFERENCES, ...(record.preferences || {}) },
          createdAt: record.createdAt || null,
          updatedAt: record.updatedAt || null,
        }));
      return json(res, 200, { ok: true, devices });
    }

    const endpoint = endpointFrom(req);
    if (!endpoint) return json(res, 400, { error: "Falta el endpoint de la suscripción." });
    const hash = hashEndpoint(endpoint);
    const current = await readRecord(hash);

    if (req.method === "GET" && action === "current") {
      if (!current || current.userId !== admin.uid) {
        return json(res, 200, {
          ok: true,
          registered: false,
          subscriptionHash: hash,
          preferences: DEFAULT_PREFERENCES,
        });
      }

      try {
        normalizeSubscription(current.subscription);
      } catch {
        await redis(["HDEL", subscriptionsKey(), hash]).catch(() => undefined);
        return json(res, 200, {
          ok: true,
          registered: false,
          stale: true,
          subscriptionHash: hash,
          preferences: DEFAULT_PREFERENCES,
        });
      }

      return json(res, 200, {
        ok: true,
        registered: true,
        subscriptionHash: hash,
        preferences: { ...DEFAULT_PREFERENCES, ...(current.preferences || {}) },
        deviceName: current.deviceName || "Dispositivo",
      });
    }

    if (action === "unsubscribe") {
      if (!current || current.userId === admin.uid) await redis(["HDEL", subscriptionsKey(), hash]);
      return json(res, 200, { ok: true });
    }

    if (action === "test") {
      if (!current || current.userId !== admin.uid) {
        return json(res, 404, { error: "Este dispositivo no está vinculado a la cuenta actual." });
      }
      const result = await sendPush({
        userId: admin.uid,
        type: "test",
        title: "Infytter Fitness",
        body: "Las notificaciones remotas funcionan correctamente en este dispositivo.",
        url: "/notificaciones",
        tag: `push-test-${Date.now()}`,
        targetHash: hash,
      });
      if (!result.sent && result.failed) return json(res, 502, { error: "El servicio Push rechazó el envío.", ...result });
      if (!result.sent && result.removed) return json(res, 410, { error: "La suscripción del navegador venció. Activá las notificaciones nuevamente.", ...result });
      return json(res, 200, { ok: true, ...result });
    }

    if (action !== "subscribe" && action !== "preferences") {
      return json(res, 400, { error: "Acción Push inválida." });
    }

    const owned = current?.userId === admin.uid;
    if (action === "preferences" && !owned) {
      return json(res, 404, { error: "Este dispositivo no está vinculado a la cuenta actual." });
    }
    // Cambiar de cuenta en el mismo navegador requiere presentar la suscripción
    // completa; conocer sólo el endpoint nunca permite apropiarse del registro.
    let subscription = owned ? current.subscription : undefined;
    if (req.body?.subscription) subscription = normalizeSubscription(req.body.subscription);
    if (!subscription) return json(res, 422, { error: "Suscripción Push inválida." });
    if (current && !owned && (subscription.keys.auth !== current.subscription?.keys?.auth || subscription.keys.p256dh !== current.subscription?.keys?.p256dh)) {
      return json(res, 403, { error: "Suscripción Push no autorizada." });
    }

    // Validar también las suscripciones ya guardadas antes de reutilizarlas.
    subscription = normalizeSubscription(subscription);

    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(current?.userId === admin.uid ? current.preferences || {} : {}),
      ...(req.body?.preferences || {}),
    };

    const now = new Date().toISOString();
    const record = {
      ...(current?.userId === admin.uid ? current : {}),
      subscription,
      deviceName: req.body?.deviceName || (owned ? current.deviceName : "") || "Dispositivo",
      metadata: {
        ...(current?.userId === admin.uid ? current.metadata || {} : {}),
        ...(req.body?.metadata || {}),
      },
      preferences,
      userId: admin.uid,
      userEmail: admin.email,
      updatedAt: now,
      createdAt: current?.userId === admin.uid && current.createdAt ? current.createdAt : now,
    };

    await redis(["HSET", subscriptionsKey(), hash, JSON.stringify(record)]);
    return json(res, 200, {
      ok: true,
      registered: true,
      subscriptionHash: hash,
      preferences,
      deviceName: record.deviceName,
    });
  } catch (error) {
    console.error("push-api", error);
    return json(res, error.statusCode || 500, { error: error.message || "Error interno" });
  }
}
