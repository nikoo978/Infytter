import { publicSupabaseConfig } from "./_auth.js";
import { sendPush } from "./_push.js";

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const userId = String(body.userId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!userId || !email) return json(res, 400, { error: "Registro inválido" });

    const { url, anonKey } = publicSupabaseConfig();
    const rpc = await fetch(`${url}/rest/v1/rpc/gf_registration_push_target`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId, p_email: email }),
    });

    if (!rpc.ok) {
      const text = await rpc.text();
      throw new Error(text || "No se pudo verificar el registro");
    }

    const target = await rpc.json();
    const row = Array.isArray(target) ? target[0] : target;
    if (!row?.verified || !row?.masterUserId) return json(res, 200, { ok: true, notified: false });

    const result = await sendPush({
      userId: row.masterUserId,
      type: "newAccount",
      title: "Nueva cuenta PWA",
      body: `${row.email || email} se registró en GymFlow.`,
      tag: `new-account-${userId}`,
      url: "/usuarios",
      data: { userId, email: row.email || email },
      dedupeId: `new-account-${userId}`,
    });

    return json(res, 200, { ok: true, notified: result.sent > 0, sent: result.sent, removed: result.removed, failed: result.failed });
  } catch (error) {
    console.error("account-registration-push", error?.message || error);
    return json(res, 500, { error: error?.message || "Error inesperado" });
  }
}
