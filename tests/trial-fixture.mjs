import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

// In-memory PostgreSQL only. Never loads .env or opens a production connection.
export const db = new PGlite();
export const identity = { email: null };
export const ready = (async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table public.app_users (
      id uuid primary key default gen_random_uuid(), email text unique not null,
      google_id text, name text, role text default 'lawyer', status text default 'pending_approval',
      created_at timestamptz default now()
    );
    insert into app_users(email, status, role) values
      ('legacy-active@example.test', 'active', 'admin'),
      ('legacy-pending@example.test', 'pending_approval', 'lawyer'),
      ('legacy-inactive@example.test', 'inactive', 'lawyer');
    create table legal_cases(id uuid primary key default gen_random_uuid(), user_id uuid, title text);
    create table conversion_history(id uuid primary key default gen_random_uuid(), user_id uuid, title text);
    create table case_mails(id uuid primary key default gen_random_uuid(), user_id uuid, title text);
    create table calendar_events(id uuid primary key default gen_random_uuid(), user_id uuid, title text);
    create table calendar_reminders(id uuid primary key default gen_random_uuid(), event_id uuid);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant all on all tables in schema public to anon, authenticated, service_role;
  `);
  for (const file of ['20260820_user_data_rls_hardening.sql', '202608310900_trial_licensing.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
})();

export async function user(email, overrides = {}) {
  await ready;
  const fields = { email, name: email.split('@')[0], ...overrides };
  const keys = Object.keys(fields);
  const result = await db.query(`insert into app_users (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(fields));
  return result.rows[0];
}
export async function access(email) {
  await ready;
  return (await db.query('select public.get_subscription_access($1) as value', [email])).rows[0].value;
}
export async function manage(actor, target, action, days = 5, until = null) {
  await ready;
  return (await db.query('select public.manage_subscription($1,$2,$3,$4,$5) as value', [actor.id, target.id, action, days, until])).rows[0].value;
}

// Adapter tests the actual server modules against the real migration functions.
export function getSupabaseAdmin() {
  return {
    async rpc(name, args) {
      try {
        let data;
        if (name === 'get_subscription_access') data = await access(args.p_email);
        else if (name === 'manage_subscription') data = await manage({ id: args.p_actor_id }, { id: args.p_user_id }, args.p_action, args.p_days, args.p_licensed_until);
        else throw new Error('Unexpected RPC');
        return { data, error: null };
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
    },
    from(table) {
      if (table !== 'app_users') throw new Error('Unexpected table: ' + table);
      const filters = [];
      const query = {
        select() { return query; },
        eq(field, value) { filters.push([field, value]); return query; },
        async maybeSingle() {
          const result = await db.query('select * from app_users where ' + filters.map(([f], i) => `${f}=$${i+1}`).join(' and '), filters.map(([,v]) => v));
          return { data: result.rows[0] ?? null, error: null };
        },
      };
      return query;
    },
  };
}

export async function getServerSession() {
  return identity.email ? { user: { email: identity.email, name: identity.email.split('@')[0] } } : null;
}
