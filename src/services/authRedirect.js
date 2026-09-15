export const PRODUCTION_APP_URL = "https://infytter.coffeetec.com.ar";

function cleanPath(path) {
  const value = String(path || "/").trim() || "/";
  return value.startsWith("/") ? value : `/${value}`;
}

export function getAuthRedirectUrl(path = "/", locationLike = typeof window !== "undefined" ? window.location : null) {
  const hostname = String(locationLike?.hostname || "").toLowerCase();
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const origin = local && locationLike?.origin
    ? String(locationLike.origin).replace(/\/+$/, "")
    : PRODUCTION_APP_URL;
  return `${origin}${cleanPath(path)}`;
}
