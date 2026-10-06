import { supabase } from "./supabase";
import { passwordPolicyError } from "./passwordPolicy";

export const AVATAR_BUCKET = "gf-profile-avatars";
export function ownAvatarPath(path, userId) {
  return typeof path === "string" && path.startsWith(`${userId}/`) && /^[a-zA-Z0-9/-]+\.jpg$/.test(path) ? path : "";
}

// Crop and re-encode: strip metadata and never upload the original file.
export async function prepareAvatar(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Elegí una imagen JPG, PNG o WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 5 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error("No se pudo leer la imagen.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .85));
    if (!blob || blob.size > 512 * 1024) throw new Error("No se pudo preparar la foto. Probá con otra imagen.");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

async function avatarRequest(method = "GET", blob, personId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Iniciá sesión para ver o cambiar la foto.");
  const response = await fetch(`/api/avatar${personId ? `?personId=${encodeURIComponent(personId)}` : ""}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(blob ? { "Content-Type": "image/jpeg" } : {}) }, body: blob,
  });
  return response;
}

async function removeLegacyPhoto(path, userId) {
  const previous = ownAvatarPath(path, userId);
  if (!previous) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([previous]);
  if (!error) await supabase.auth.updateUser({ data: { avatar_path: null } });
}

export async function avatarUrl(path, userId) {
  const response = await avatarRequest();
  if (response.ok) return URL.createObjectURL(await response.blob());
  const safe = ownAvatarPath(path, userId);
  if (![404, 503].includes(response.status) || !safe) return "";
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(safe, 3600);
  if (error) return "";
  // Keep existing photos visible until the persistent volume is ready.
  if (response.status === 503) return data.signedUrl;
  try {
    const legacy = await fetch(data.signedUrl);
    if (!legacy.ok || Number(legacy.headers.get("content-length")) > 512 * 1024) return data.signedUrl;
    const blob = await legacy.blob();
    if (blob.size > 512 * 1024) return data.signedUrl;
    const saved = await avatarRequest("PUT", blob);
    if (!saved.ok) return data.signedUrl;
    await removeLegacyPhoto(path, userId);
    const migrated = await avatarRequest();
    if (migrated.ok) return URL.createObjectURL(await migrated.blob());
  } catch { /* A legacy photo is removed only after a confirmed server save. */ }
  return data.signedUrl;
}

export async function studentAvatarUrl(personId) {
  if (!personId) return "";
  const response = await avatarRequest("GET", undefined, personId);
  return response.ok ? URL.createObjectURL(await response.blob()) : "";
}

export async function saveAvatar(file, user) {
  const blob = await prepareAvatar(file);
  const response = await avatarRequest("PUT", blob);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "No se pudo guardar la foto.");
  }
  await removeLegacyPhoto(user.user_metadata?.avatar_path, user.id);
  const saved = await avatarRequest();
  if (!saved.ok) throw new Error("La foto se guardó, pero no se pudo cargar. Volvé a abrir tu perfil.");
  return URL.createObjectURL(await saved.blob());
}

export async function changeAccountPassword(current, password, confirmation, nonce = "") {
  if (!current) throw new Error("Ingresá tu contraseña actual.");
  const policyError = passwordPolicyError(password);
  if (policyError) throw new Error(policyError);
  if (password !== confirmation) throw new Error("Las nuevas contraseñas no coinciden.");
  if (current === password) throw new Error("Elegí una contraseña distinta de la actual.");
  const { error } = await supabase.auth.updateUser({ current_password: current, password, ...(nonce ? { nonce } : {}) });
  if (error) throw error;
}
