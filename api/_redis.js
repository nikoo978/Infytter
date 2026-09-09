import crypto from "node:crypto";

const stateKey = () => process.env.REDIS_STATE_KEY || "gymflow";

export const subscriptionsKey = () => `${stateKey()}:push:subscriptions`;
export const reminderKey = (userId, personId) => `${stateKey()}:push:reminder:${userId}:${personId}`;
export const sentKey = (userId, id) => `${stateKey()}:push:sent:${userId}:${id}`;
export const deliveryKey = (userId, id, subscriptionHash) => `${stateKey()}:push:delivery:${userId}:${id}:${subscriptionHash}`;

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw Object.assign(new Error("Redis no configurado"), { statusCode: 503 });
  return { url, token };
}

export async function redis(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Redis ${response.status}: ${await response.text()}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export const hashEndpoint = (endpoint) => crypto.createHash("sha256").update(String(endpoint || "")).digest("hex");
export const hashValue = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

export async function getSubscriptions() {
  const raw = await redis(["HGETALL", subscriptionsKey()]);
  const entries = [];

  if (Array.isArray(raw)) {
    for (let index = 0; index < raw.length; index += 2) {
      try { entries.push([raw[index], JSON.parse(raw[index + 1])]); } catch { /* malformed rows are ignored */ }
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      try { entries.push([key, typeof value === "string" ? JSON.parse(value) : value]); } catch { /* malformed rows are ignored */ }
    }
  }

  return entries;
}
