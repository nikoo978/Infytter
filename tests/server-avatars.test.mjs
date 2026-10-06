import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { encodeAvatar, storeAvatar, MAX_AVATAR_BYTES } from '../api/avatars.js';
import { createAppServer } from '../server/index.js';
const uid = '9ac3a2dc-952e-4c3f-858c-74b670bf8bb9';
const picture = async color => sharp({ create: { width: 512, height: 512, channels: 3, background: color } }).jpeg().toBuffer();

test('server rejects corrupt images, disguised formats, oversized bodies and excessive pixel counts', async () => {
  await assert.rejects(encodeAvatar(Buffer.from('not an image')), { statusCode: 415 });
  const png = await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toBuffer();
  await assert.rejects(encodeAvatar(png), { statusCode: 415 });
  await assert.rejects(encodeAvatar(Buffer.alloc(MAX_AVATAR_BYTES + 1)), { statusCode: 413 });
  const large = await sharp({create:{width:2048,height:2048,channels:3,background:'red'}}).jpeg().toBuffer();
  await assert.rejects(encodeAvatar(large), { statusCode: 415 });
  const valid = await encodeAvatar(await picture('red'));
  assert.equal((await sharp(valid).metadata()).format, 'jpeg');
  assert.equal((await sharp(valid).metadata()).width, 512);
});

test('replacement leaves exactly one private file with the new contents', async () => {
  const dir = await mkdtemp(join(tmpdir(),'infytter-avatar-'));
  try {
    await storeAvatar(dir, uid, await encodeAvatar(await picture('red')));
    const second = await encodeAvatar(await picture('blue'));
    await storeAvatar(dir, uid, second);
    assert.deepEqual(await readdir(dir), [`${uid}.jpg`]);
    assert.deepEqual(await readFile(join(dir,`${uid}.jpg`)), second);
    await assert.rejects(storeAvatar(dir, '../outside', second), { statusCode: 400 });
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('HTTP photos enforce authentication, server permission checks, upload limits and readiness', async () => {
  const original = globalThis.fetch;
  const dir = await mkdtemp(join(tmpdir(),'infytter-avatar-http-'));
  const previous = { ready: process.env.AVATAR_STORAGE_READY, dir: process.env.AVATAR_DIR };
  process.env.AVATAR_STORAGE_READY='1'; process.env.AVATAR_DIR=dir;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({id:uid});
    if (String(url).endsWith('/rest/v1/rpc/gf_avatar_account')) {
      return options.headers.authorization === 'Bearer admin-test' ? Response.json(uid) : Response.json({}, {status:403});
    }
    return original(url,options);
  };
  const server = createAppServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/avatar`;
  const headers={authorization:'Bearer owner-test','content-type':'image/jpeg'};
  try {
    assert.equal((await original(base)).status,401);
    assert.equal((await original(base+'?personId=student',{headers})).status,403);
    assert.equal((await original(base+'?personId=student',{method:'PUT',headers,body:await picture('red')})).status,403);
    assert.equal((await original(base,{method:'PUT',headers,body:Buffer.alloc(MAX_AVATAR_BYTES+1)})).status,413);
    for (const color of ['red','blue','green']) assert.equal((await original(base,{method:'PUT',headers,body:await picture(color)})).status,200);
    assert.deepEqual(await readdir(dir),[`${uid}.jpg`]);
    assert.equal((await original(base,{method:'PUT',headers,body:await picture('red')})).status,429);
    const allowed=await original(base+'?personId=student',{headers:{authorization:'Bearer admin-test'}});
    assert.equal(allowed.status,200);
    assert.equal(allowed.headers.get('cache-control'),'private, no-store');
    process.env.AVATAR_STORAGE_READY='0';
    assert.equal((await original(base,{headers})).status,503);
  } finally {
    globalThis.fetch=original;
    if (previous.ready === undefined) delete process.env.AVATAR_STORAGE_READY; else process.env.AVATAR_STORAGE_READY=previous.ready;
    if (previous.dir === undefined) delete process.env.AVATAR_DIR; else process.env.AVATAR_DIR=previous.dir;
    await new Promise(resolve=>server.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
});
