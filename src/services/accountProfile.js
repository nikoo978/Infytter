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

export async function avatarUrl(path, userId) {
  const safe = ownAvatarPath(path, userId);
  if (!safe) return "";
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(safe, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveAvatar(file, user) {
  const blob = await prepareAvatar(file);
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_path: path } });
  if (updateError) { await bucket.remove([path]); throw updateError; }
  const previous = ownAvatarPath(user.user_metadata?.avatar_path, user.id);
  if (previous) await bucket.remove([previous]);
  return avatarUrl(path, user.id);
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
