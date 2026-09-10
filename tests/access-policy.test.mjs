import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { daysUntilExpiry, planUsage, statusOf, weeklyAccessUsage } from '../src/services/accessPolicy.js';

const person = { id: 'client-a', role: 'Cliente', plan: '3 días', expiry: '2026-09-09' };
const access = (date, overrides = {}) => ({ personId: person.id, allowed: true, date, ...overrides });

test('expiry includes the entire Argentina date and denies access from the next midnight', () => {
  assert.equal(statusOf(person, new Date('2026-09-10T02:59:59.999Z')), 'Por vencer');
  assert.equal(daysUntilExpiry(person.expiry, new Date('2026-09-10T02:59:59.999Z')), 0);
  for (const now of ['2026-09-10T03:00:00Z', '2026-09-10T15:00:00Z', '2026-09-11T02:59:59Z']) {
    assert.equal(statusOf(person, new Date(now)), 'Vencida');
    assert.equal(daysUntilExpiry(person.expiry, new Date(now)), -1);
  }
});

test('missing, malformed and impossible expiry dates fail closed', () => {
  for (const expiry of [undefined, null, '', 'invalid', '2026-02-30', '2026-02-29', '2026-13-01', '2026-00-01', '2026-09-00', '2026-9-09', '2026-09-09T23:59:59Z']) {
    assert.equal(statusOf({ ...person, expiry }, new Date('2026-01-01T12:00:00Z')), 'Vencida');
    assert.equal(daysUntilExpiry(expiry), null);
  }
  assert.equal(statusOf(null), 'Vencida');
  assert.equal(daysUntilExpiry('2028-02-29', new Date('2028-02-28T12:00:00Z')), 1);
});

test('the warning starts seven calendar days before expiry and professors retain their access rule', () => {
  assert.equal(statusOf(person, new Date('2026-09-01T12:00:00Z')), 'Vigente');
  assert.equal(statusOf(person, new Date('2026-09-02T03:00:00Z')), 'Por vencer');
  assert.equal(statusOf({ role: 'Profesor', expiry: null }), 'Vigente');
});

test('two entries across UTC midnight count as one Argentina day', () => {
  const result = planUsage(person, [access('2026-09-08T23:00:00Z'), access('2026-09-09T02:00:00Z')], new Date('2026-09-09T02:30:00Z'));
  assert.deepEqual(result, { usedDays: 1, alreadyEnteredToday: true, limitReached: false });
});

test('entries on either side of Argentina midnight count as different days', () => {
  const result = planUsage(person, [access('2026-09-09T02:59:59Z'), access('2026-09-09T03:00:00Z')], new Date('2026-09-09T04:00:00Z'));
  assert.equal(result.usedDays, 2);
});

test('a week resets at Monday midnight in Argentina, including across years', () => {
  const events = [access('2026-09-07T02:59:59Z'), access('2026-09-07T03:00:00Z')];
  assert.equal(planUsage(person, events, new Date('2026-09-07T04:00:00Z')).usedDays, 1);
  assert.equal(planUsage(person, events, new Date('2026-09-14T03:00:00Z')).usedDays, 0);
  const newYear = [access('2026-12-28T12:00:00Z'), access('2027-01-01T12:00:00Z')];
  assert.equal(planUsage(person, newYear, new Date('2027-01-02T12:00:00Z')).usedDays, 2);
});

test('three-day plan permits a third day and re-entry that day, then denies a fourth distinct day', () => {
  const events = ['2026-09-07T12:00:00Z', '2026-09-08T12:00:00Z'].map((date) => access(date));
  assert.equal(planUsage(person, events, new Date('2026-09-09T12:00:00Z')).limitReached, false);
  events.push(access('2026-09-09T12:00:00Z'));
  assert.deepEqual(planUsage(person, events, new Date('2026-09-09T23:00:00Z')), { usedDays: 3, alreadyEnteredToday: true, limitReached: false });
  assert.deepEqual(planUsage(person, events, new Date('2026-09-10T12:00:00Z')), { usedDays: 3, alreadyEnteredToday: false, limitReached: true });
});

test('unrelated, manual, denied, invalid and future events do not consume attendance days', () => {
  const events = [
    access('2026-09-07T12:00:00Z'),
    access('2026-09-08T12:00:00Z', { personId: 'other-client' }),
    access('2026-09-09T12:00:00Z', { manual: true }),
    access('2026-09-10T12:00:00Z', { allowed: false }),
    access('2026-09-11T12:00:00Z'),
    access('2026-09-09T12:00:00'), access('invalid'), access(null), access('2026-02-30T12:00:00Z'), null,
  ];
  assert.deepEqual(planUsage(person, events, new Date('2026-09-10T15:00:00Z')), { usedDays: 1, alreadyEnteredToday: false, limitReached: false });
  assert.deepEqual(planUsage({ ...person, plan: 'Libre' }, events), { usedDays: 0, alreadyEnteredToday: false, limitReached: false });
  assert.deepEqual(planUsage(null, events), { usedDays: 0, alreadyEnteredToday: false, limitReached: false });
});

test('the client portal can count its own scoped events without personId', () => {
  const events = [{ allowed: true, date: '2026-09-08T23:00:00Z' }, { allowed: true, date: '2026-09-09T02:00:00Z' }];
  assert.equal(weeklyAccessUsage(events, new Date('2026-09-09T02:30:00Z')).usedDays, 1);
});

test('policy results do not depend on the host time zone', () => {
  const moduleUrl = new URL('../src/services/accessPolicy.js', import.meta.url).href;
  const script = `import { statusOf, planUsage } from ${JSON.stringify(moduleUrl)};
    const person = ${JSON.stringify(person)};
    console.log(JSON.stringify([statusOf(person, new Date('2026-09-10T03:00:00Z')),
      planUsage(person, [{ personId: person.id, allowed: true, date: '2026-09-07T02:59:59Z' }], new Date('2026-09-07T03:00:00Z'))]));`;
  for (const TZ of ['UTC', 'America/Argentina/Buenos_Aires', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' }));
    assert.deepEqual(result, ['Vencida', { usedDays: 0, alreadyEnteredToday: false, limitReached: false }]);
  }
});
