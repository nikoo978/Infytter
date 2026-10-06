import sharp from 'sharp';
import { mkdir, readFile, readdir, writeFile, rename, unlink, statfs } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { requireAdmin, publicSupabaseConfig } from './_auth.js';

export const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_STORED_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rates = new Map();
let uploading = false;
const fail = (message, statusCode) => { throw Object.assign(new Error(message), { statusCode }); };

// Runs before the HTTP adapter buffers the body. One upload at a time bounds memory and disk work.
export async function preflight(req) {
  if (!['GET', 'PUT'].includes(req.method)) fail('Método no permitido', 405);
  if (process.env.AVATAR_STORAGE_READY !== '1') fail('El almacenamiento de fotos todavía necesita configurarse en el servidor.', 503);
  if (req.method === 'PUT') {
    if (req.query.personId) fail('Sólo podés cambiar tu propia foto.', 403);
    if (String(req.headers['content-type']).split(';')[0] !== 'image/jpeg') fail('La foto debe enviarse como JPG.', 415);
    if (Number(req.headers['content-length']) > MAX_AVATAR_BYTES) fail('Foto demasiado grande.', 413);
    if (uploading) fail('Hay una foto guardándose. Intentá nuevamente en unos segundos.', 429);
    uploading = true;
  }
  try {
    req.avatarActor = await requireAdmin(req);
    if (!UUID.test(req.avatarActor.uid)) fail('Sesión inválida', 401);
    if (req.method === 'PUT') {
      const now = Date.now();
      for (const [key, value] of rates) if (now - value.start >= 60000) rates.delete(key);
      const rate = rates.get(req.avatarActor.uid) || { start: now, count: 0 };
      if (rate.count >= 3 || (!rates.has(req.avatarActor.uid) && rates.size >= 4096)) fail('Esperá un minuto antes de volver a cambiar la foto.', 429);
      rate.count++; rates.set(req.avatarActor.uid, rate);
    }
    return () => { if (req.method === 'PUT') uploading = false; };
  } catch (error) { if (req.method === 'PUT') uploading = false; throw error; }
}

export async function encodeAvatar(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > MAX_AVATAR_BYTES) fail('Foto inválida o demasiado grande.', 413);
  try {
    const image = sharp(input, { limitInputPixels: 1024 * 1024, failOn: 'warning' });
    const info = await image.metadata();
    if (info.format !== 'jpeg' || (info.pages || 1) !== 1) fail('Elegí una foto JPG válida.', 415);
    const result = await image.rotate().resize(512, 512, { fit: 'cover' }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
    if (result.length > MAX_STORED_BYTES) fail('No se pudo reducir la foto.', 413);
    return result;
  } catch (error) { if (error.statusCode) throw error; fail('No se pudo leer la foto.', 415); }
}

export async function storeAvatar(directory, uid, image) {
  if (!UUID.test(uid)) fail('Cuenta inválida', 400);
  const dir = resolve(directory);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const target = join(dir, `${uid}.jpg`);
  const files = await readdir(dir);
  if (!files.includes(`${uid}.jpg`) && files.filter(name => name.endsWith('.jpg')).length >= 2000) fail('El almacenamiento de fotos alcanzó su capacidad.', 507);
  const disk = await statfs(dir);
  if (Number(disk.bavail) * Number(disk.bsize) < 100 * 1024 * 1024) fail('No hay espacio disponible para guardar la foto.', 507);
  const temporary = join(dir, `${uid}.upload`);
  try {
    await writeFile(temporary, image, { mode: 0o600, flag: 'wx' });
    await rename(temporary, target); // Atomic replacement: one final file, never a history of uploads.
  } finally { await unlink(temporary).catch(() => {}); }
}

export default async function avatar(req, res) {
  const dir = resolve(process.env.AVATAR_DIR || '/app/data/avatars');
  const actor = req.avatarActor;
  let uid = actor.uid;
  if (req.method === 'GET' && req.query.personId) {
    const { url, anonKey } = publicSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/rpc/gf_avatar_account`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { authorization: req.headers.authorization, apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ p_person_id: req.query.personId }),
    });
    if (!response.ok) fail('No tenés permiso para ver esta foto.', 403);
    uid = await response.json();
    if (!uid || !UUID.test(uid)) fail('Foto no disponible.', 404);
  }
  if (req.method === 'PUT') {
    const image = await encodeAvatar(req.rawBody);
    await storeAvatar(dir, uid, image);
    return res.status(200).json({ saved: true });
  }
  let image;
  try { image = await readFile(join(dir, `${uid}.jpg`)); }
  catch (error) { if (error.code === 'ENOENT') fail('Foto no disponible.', 404); throw error; }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(image);
}
