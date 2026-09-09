import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/push.js';
import { normalizeSubscription } from '../api/_push.js';

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-only',
  keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 5).toString('base64url') },
};

test('Push accepts browser providers and rejects arbitrary server destinations', () => {
  for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns.notify.windows.com']) {
    assert.doesNotThrow(() => normalizeSubscription({ ...subscription, endpoint: `https://${host}/test` }));
  }
  for (const endpoint of ['https://localhost/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.attacker.test/test', 'https://fcm.googleapis.com:8443/test', 'https://user:password@fcm.googleapis.com/test', 'http://fcm.googleapis.com/test']) {
    assert.throws(() => normalizeSubscription({ ...subscription, endpoint }), { statusCode: 422 });
  }
});

test('knowing an endpoint cannot change another account’s subscription', async () => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only';
  let record = { userId: 'owner-a', subscription, deviceName: 'Private device' };
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'owner-b' });
    assert.equal(url, 'https://redis.example.test');
    const command = JSON.parse(options.body);
    if (command[0] === 'HGET') return Response.json({ result: JSON.stringify(record) });
    assert.equal(command[0], 'HSET');
    writes++;
    record = JSON.parse(command[3]);
    return Response.json({ result: 1 });
  };
  async function invoke(action, body) {
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; } };
    await handler({ method: 'POST', query: { action }, headers: { authorization: 'Bearer test-only' }, body }, res);
    return res;
  }
  try {
    assert.equal((await invoke('preferences', { endpoint: subscription.endpoint })).code, 404);
    assert.equal((await invoke('subscribe', { endpoint: subscription.endpoint })).code, 422);
    const otherKeys = { ...subscription, keys: { ...subscription.keys, auth: Buffer.alloc(16, 9).toString('base64url') } };
    assert.equal((await invoke('subscribe', { subscription: otherKeys })).code, 403);
    assert.equal(writes, 0);
    assert.equal((await invoke('subscribe', { subscription })).code, 200);
    assert.equal(writes, 1);
    assert.equal(record.userId, 'owner-b');
    assert.equal(record.deviceName, 'Dispositivo');
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
      if (env[name] === undefined) delete process.env[name]; else process.env[name] = env[name];
    }
  }
});
