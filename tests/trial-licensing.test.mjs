import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { runInNewContext } from 'node:vm';
import { encode } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { db, ready, user, access, manage, identity } from './trial-fixture.mjs';
import { proxy, config } from '../proxy.ts';
import nextTesting from 'next/experimental/testing/server.js';
// Next 16.2.6 still exports the old test-helper name despite its Proxy docs.
const { unstable_doesMiddlewareMatch: doesProxyMatch } = nextTesting;
import { getOrCreateAppUser } from '../lib/alUser.ts';
import { PATCH } from '../app/api/admin/subscriptions/route.ts';
import { PATCH as legacyPatch } from '../app/api/admin/users/route.ts';
import { subscriptionMessage } from '../lib/subscription.ts';
import { scopedAccountKey, setAccountStorageScope } from '../lib/accountStorage.ts';

let owner;
before(async () => {
  await ready;
  owner = await user('owner@example.test', { status: 'active', subscription_status: 'ACTIVE', is_license_owner: true });
  process.env.NEXTAUTH_SECRET = 'isolated-trial-fixture-secret-never-production';
});
after(async () => { await db.close(); });

test('Next matcher protects all app/API paths including RSC requests and future routes', () => {
  for (const url of ['/cases', '/cases?_rsc=fixture', '/file-viewer', '/api/cases', '/api/admin/subscriptions', '/settings/licenses', '/future-app-route']) {
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url }), true, url);
  }
  for (const url of ['/_next/static/chunk.js', '/brand/legal-logo-light.png']) {
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url }), false, url);
  }
});

test('missing or forged session cannot access application APIs', async () => {
  assert.equal((await proxy(new NextRequest('http://localhost:3000/api/cases'))).status, 401);
  assert.equal((await proxy(new NextRequest('http://localhost:3000/api/cases', {
    headers: { cookie: 'next-auth.session-token=forged-token' },
  }))).status, 401);
});

test('migration preserves existing users; new user is pending with no running clock', async () => {
  assert.equal((await access('legacy-active@example.test')).allowed, true);
  assert.equal((await access('legacy-pending@example.test')).subscription_status, 'TRIAL_PENDING');
  assert.equal((await access('legacy-inactive@example.test')).subscription_status, 'SUSPENDED');
  const fresh = await user('fresh@example.test');
  const current = await access(fresh.email);
  assert.equal(current.subscription_status, 'TRIAL_PENDING');
  assert.equal(current.allowed, false);
  assert.equal(current.trial_started_at, null);
  assert.equal(current.trial_ends_at, null);
});

for (const days of [2, 5, 7]) test(`OWNER approves exactly ${days} days using database clock`, async () => {
  const target = await user(`days-${days}@example.test`);
  const result = await manage(owner, target, 'approve', days);
  assert.equal(result.subscription_status, 'TRIAL_ACTIVE');
  assert.equal(result.allowed, true);
  assert.equal(Date.parse(result.trial_ends_at) - Date.parse(result.trial_started_at), days * 86400000);
  assert.ok(Math.abs(Date.parse(result.server_now) - Date.parse(result.trial_started_at)) < 1000);
  assert.equal(result.days_remaining, days);
  assert.equal(subscriptionMessage(result), `${days} gün kaldı`);
  await assert.rejects(manage(owner, target, 'approve', days), /already approved/);
});

test('ordinary USER and legacy admin cannot approve, extend, activate or suspend', async () => {
  const attacker = await user('attacker@example.test', { status: 'active', subscription_status: 'ACTIVE' });
  const admin = (await db.query("select * from app_users where email='legacy-active@example.test'")).rows[0];
  for (const actor of [attacker, admin]) for (const action of ['approve', 'extend', 'activate', 'suspend']) {
    await assert.rejects(manage(actor, attacker, action), /OWNER authorization/);
  }
  await assert.rejects(manage(owner, owner, 'suspend'), /OWNER accounts/);
});

test('invalid durations cannot start a trial; default is five days', async () => {
  const target = await user('default@example.test');
  for (const days of [0, -1, 6, 1000, null]) await assert.rejects(manage(owner, target, 'approve', days), /2, 5 or 7/);
  const result = (await db.query('select manage_subscription($1,$2,$3) as value', [owner.id, target.id, 'approve'])).rows[0].value;
  assert.equal(Date.parse(result.trial_ends_at) - Date.parse(result.trial_started_at), 5 * 86400000);
});

test('logout/login, browser time and cookie deletion cannot restart a trial', async () => {
  const target = await user('clock@example.test');
  const initial = await manage(owner, target, 'approve');
  // Separate browser realm: changing the Node clock would also change PGlite's
  // WASM host clock, which is the database server, not the browser under test.
  for (const browserNow of [0, 9999999999999]) {
    const result = await runInNewContext('Date.now = () => browserNow; fetchStatus()', {
      browserNow, fetchStatus: () => access(target.email),
    });
    assert.equal(result.trial_started_at, initial.trial_started_at);
    assert.equal(result.trial_ends_at, initial.trial_ends_at);
    assert.equal(result.days_remaining, 5);
  }
  const anonymous = await proxy(new NextRequest('http://localhost:3000/cases'));
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get('location'), /\/login/);
  assert.equal((await access(target.email)).trial_ends_at, initial.trial_ends_at);
});

async function expire(target) {
  await db.query("update app_users set trial_started_at=clock_timestamp()-interval '6 days', trial_ends_at=clock_timestamp()-interval '1 day' where id=$1", [target.id]);
}
async function request(path, target, init = {}) {
  const token = await encode({ token: { email: target.email, appUserStatus: 'active' }, secret: process.env.NEXTAUTH_SECRET });
  return new NextRequest(`http://localhost:3000${path}`, { ...init,
    headers: { cookie: `next-auth.session-token=${token}`, ...init.headers } });
}

test('expired trial is persisted and all app routes/APIs reject even a stale active JWT', async () => {
  const target = await user('expired@example.test');
  await manage(owner, target, 'approve');
  const stale = await request('/cases', target);
  await expire(target);
  const result = await access(target.email);
  assert.equal(result.subscription_status, 'TRIAL_EXPIRED');
  assert.equal(result.allowed, false);
  assert.equal((await db.query('select subscription_status from app_users where id=$1', [target.id])).rows[0].subscription_status, 'TRIAL_EXPIRED');
  assert.equal((await proxy(stale)).headers.get('location'), 'http://localhost:3000/account/access');
  for (const path of ['/cases', '/file-viewer', '/settings', '/dashboard', '/inbox', '/uets-import', '/celse-import']) {
    assert.equal((await proxy(await request(path, target))).headers.get('location'), 'http://localhost:3000/account/access');
  }
  for (const path of ['/api/cases', '/api/mail/messages', '/api/convert/pdf-to-word']) {
    assert.equal((await proxy(await request(path, target))).status, 403);
  }
  identity.email = target.email;
  const dal = await getOrCreateAppUser();
  assert.equal(dal.error, 'Demo süreniz sona erdi.');
  assert.equal((await proxy(await request('/api/account/status', target))).status, 200);
  assert.equal((await proxy(await request('/account/access', target))).status, 200);
  assert.equal((await proxy(await request('/api/auth/signout', target))).status, 200);
});

test('OWNER extends active and expired trials without changing original start or data', async () => {
  const target = await user('extend@example.test');
  const initial = await manage(owner, target, 'approve');
  await db.query("insert into legal_cases(user_id,title) values ($1,'Retained case')", [target.id]);
  const extended = await manage(owner, target, 'extend', 2);
  assert.equal(extended.trial_started_at, initial.trial_started_at);
  assert.equal(Date.parse(extended.trial_ends_at) - Date.parse(initial.trial_ends_at), 2 * 86400000);
  await expire(target);
  const expired = await access(target.email);
  const renewed = await manage(owner, target, 'extend', 7);
  assert.equal(renewed.trial_started_at, expired.trial_started_at);
  assert.equal(renewed.days_remaining, 7);
  assert.equal(renewed.allowed, true);
  assert.equal((await db.query('select title from legal_cases where user_id=$1', [target.id])).rows[0].title, 'Retained case');
});

test('paid activation ignores expired trial, supports nullable date, suspension denies access', async () => {
  const target = await user('paid@example.test');
  await manage(owner, target, 'approve');
  await expire(target);
  const paid = await manage(owner, target, 'activate');
  assert.equal(paid.subscription_status, 'ACTIVE');
  assert.equal(paid.licensed_until, null);
  assert.equal(paid.allowed, true);
  assert.equal((await proxy(await request('/cases', target))).status, 200);
  await manage(owner, target, 'suspend');
  assert.equal((await access(target.email)).allowed, false);
  assert.equal((await proxy(await request('/api/cases', target))).status, 403);
  assert.equal((await proxy(await request('/api/auth/session', target))).status, 200);
  await manage(owner, target, 'activate', 5, '2099-01-01T00:00:00Z');
  assert.equal((await access(target.email)).allowed, true);
  await db.query("update app_users set licensed_until=clock_timestamp()-interval '1 second' where id=$1", [target.id]);
  assert.equal((await access(target.email)).subscription_status, 'SUSPENDED');
});

test('last day text is computed from database date in Istanbul', async () => {
  const target = await user('last-day@example.test');
  await manage(owner, target, 'approve');
  await db.query("update app_users set trial_ends_at=((clock_timestamp() at time zone 'Europe/Istanbul')::date + time '23:59:59.999999') at time zone 'Europe/Istanbul' where id=$1", [target.id]);
  assert.equal(subscriptionMessage(await access(target.email)), 'Demo süreniz bugün sona eriyor.');
});

test('RLS isolates cases, mail, history and reminders; expiry denies reads without deleting rows', async () => {
  const a = await user('rls-a@example.test');
  const b = await user('rls-b@example.test');
  await manage(owner, a, 'approve'); await manage(owner, b, 'activate');
  for (const table of ['legal_cases', 'case_mails', 'conversion_history', 'calendar_events']) {
    for (const target of [a,b]) await db.query(`insert into ${table}(user_id,title) values($1,$2)`, [target.id, target.email]);
  }
  await db.exec('insert into calendar_reminders(event_id) select id from calendar_events');
  async function asUser(email, run) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ email })]);
    await db.exec('set role authenticated');
    try { await run(); } finally { await db.exec('reset role'); }
  }
  await asUser(a.email, async () => {
    for (const table of ['legal_cases', 'case_mails', 'conversion_history', 'calendar_events']) {
      const result = await db.query(`select * from ${table}`);
      assert.equal(result.rows.length, 1); assert.equal(result.rows[0].user_id, a.id);
    }
    assert.equal((await db.query('select * from calendar_reminders')).rows.length, 1);
    await assert.rejects(db.query("insert into legal_cases(user_id,title) values($1,'attack')", [b.id]), /row-level security/);
    await assert.rejects(db.query("update app_users set is_license_owner=true where id=$1", [a.id]), /permission denied/);
    await assert.rejects(db.query("select manage_subscription($1,$2,'approve')", [owner.id,a.id]), /permission denied/);
    await assert.rejects(db.query('select get_subscription_access($1)', [b.email]), /permission denied/);
  });
  await expire(a);
  await asUser(a.email, async () => {
    // Direct RLS denies expiry even BEFORE the access RPC persists TRIAL_EXPIRED.
    assert.equal((await db.query('select * from legal_cases')).rows.length, 0);
    assert.equal((await db.query('select * from calendar_reminders')).rows.length, 0);
  });
  for (const table of ['legal_cases', 'case_mails', 'conversion_history', 'calendar_events']) {
    assert.equal((await db.query(`select * from ${table} where user_id=$1`, [a.id])).rows.length, 1);
  }
  await manage(owner, a, 'activate');
  await asUser(a.email, async () => { assert.equal((await db.query('select * from legal_cases')).rows.length, 1); });
  await manage(owner, a, 'suspend');
  await asUser(a.email, async () => { assert.equal((await db.query('select * from legal_cases')).rows.length, 0); });
});

test('management HTTP route refuses USER, forged actor, cross-origin and invalid day requests', async () => {
  const target = await user('http@example.test', { name: 'http' });
  const body = { userId: target.id, action: 'approve', actorId: owner.id };
  async function patch(data, origin = 'http://localhost:3000') {
    return PATCH(new NextRequest('http://localhost:3000/api/admin/subscriptions', {
      method: 'PATCH', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }));
  }
  identity.email = target.email;
  assert.equal((await patch(body)).status, 403);
  identity.email = owner.email;
  assert.equal((await legacyPatch()).status, 409);
  assert.equal((await patch(body, 'https://attacker.test')).status, 403);
  assert.equal((await patch({ ...body, days: 99 })).status, 400);
  const response = await patch(body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).access.days_remaining, 5);
});

test('legacy local history is namespaced per identity, kept after expiry/login; auth and theme untouched', () => {
  class MemoryStorage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }
  globalThis.Storage = MemoryStorage;
  globalThis.window = {};
  const store = new MemoryStorage();
  store.setItem('al-mether-cases', 'unowned legacy data');
  setAccountStorageScope('A');
  assert.equal(store.getItem('al-mether-cases'), null);
  store.setItem('al-mether-cases', 'A data');
  setAccountStorageScope('B');
  assert.equal(store.getItem('al-mether-cases'), null);
  store.setItem('al-mether-cases', 'B data');
  setAccountStorageScope(null);
  assert.equal(store.getItem('al-mether-cases'), null);
  setAccountStorageScope('A');
  assert.equal(store.getItem('al-mether-cases'), 'A data');
  assert.equal(store.values.get('al-mether-cases'), 'unowned legacy data');
  assert.equal(scopedAccountKey('legal-theme', 'A'), 'legal-theme');
  assert.equal(scopedAccountKey('sb-auth-token', 'A'), 'sb-auth-token');
  delete globalThis.window;
  delete globalThis.Storage;
});
