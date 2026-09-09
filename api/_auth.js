const EXPECTED_PROJECT_REF = "ubfqwmhxkjtqdcfnsmwe";
const DEFAULT_SUPABASE_URL = `https://${EXPECTED_PROJECT_REF}.supabase.co`;
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZnF3bWh4a2p0cWRjZm5zbXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1OTAxODEsImV4cCI6MjA5NTE2NjE4MX0.03WBL3APZucAM1-ufuSgEbuXyYjmM0keDAjG4FRtfVo";

export function publicSupabaseConfig() {
  const envUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const envKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const envMatchesProject = Boolean(envUrl && envKey && envUrl.includes(EXPECTED_PROJECT_REF));
  return {
    url: envMatchesProject ? envUrl : DEFAULT_SUPABASE_URL,
    anonKey: envMatchesProject ? envKey : DEFAULT_SUPABASE_ANON_KEY,
  };
}

export async function requireAdmin(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw Object.assign(new Error("No autorizado"), { statusCode: 401 });

  const { url, anonKey } = publicSupabaseConfig();

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!response.ok) throw new Error("Sesión inválida");
    const user = await response.json();
    if (!user?.id) throw new Error("Sesión inválida");
    return { uid: user.id, email: user.email || "" };
  } catch {
    throw Object.assign(new Error("Sesión inválida"), { statusCode: 401 });
  }
}

export function requireNotificationSecret(req) {
  const expected = process.env.NOTIFICATION_SECRET;
  if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
    throw Object.assign(new Error("No autorizado"), { statusCode: 401 });
  }
}
