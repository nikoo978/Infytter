const RELAY_MS = 6 * 24 * 60 * 60 * 1000;

function appUrl() {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  if (!configured) throw Object.assign(new Error("PUBLIC_APP_URL no configurada"), { statusCode: 503 });
  return configured.replace(/\/$/, "");
}

function qstashUrl() {
  return String(process.env.QSTASH_URL || "https://qstash.upstash.io").trim().replace(/\/$/, "");
}

export async function publishAt(payload, finalAtMs) {
  const token = String(process.env.QSTASH_TOKEN || "").trim();
  const secret = String(process.env.NOTIFICATION_SECRET || "").trim();
  if (!token || !secret) throw Object.assign(new Error("QStash no configurado"), { statusCode: 503 });

  const now = Date.now();
  const finalAt = Number(finalAtMs);
  if (!Number.isFinite(finalAt)) throw Object.assign(new Error("Fecha de notificación inválida"), { statusCode: 400 });
  if (finalAt <= now + 5000) return { skipped: true, reason: "past" };

  const nextAt = Math.min(finalAt, now + RELAY_MS);
  const isRelay = nextAt < finalAt;
  const qstashPayload = isRelay ? { kind: "relay", finalAt, payload } : payload;
  const target = `${appUrl()}/api/notify`;

  const response = await fetch(`${qstashUrl()}/v2/publish/${target}`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Not-Before": String(Math.floor(nextAt / 1000)),
      "Upstash-Retries": "3",
      "Upstash-Forward-Authorization": `Bearer ${secret}`,
    },
    body: JSON.stringify(qstashPayload),
  });

  if (!response.ok) throw new Error(`QStash ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function continueRelay(finalAt, payload) {
  return publishAt(payload, Number(finalAt));
}
