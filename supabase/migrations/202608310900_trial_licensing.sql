-- Apply AFTER 20260820_user_data_rls_hardening.sql. No business data is deleted.
begin;

alter table public.app_users
  add column if not exists subscription_status text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists licensed_until timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_license_owner boolean not null default false;

-- Preserve existing access. Never infer OWNER from an email or user metadata.
update public.app_users
set subscription_status = case
  when status = 'active' then 'ACTIVE'
  when status in ('pending', 'pending_approval') then 'TRIAL_PENDING'
  else 'SUSPENDED' end
where subscription_status is null;

alter table public.app_users
  alter column subscription_status set default 'TRIAL_PENDING',
  alter column subscription_status set not null;
alter table public.app_users add constraint app_users_subscription_status_check
  check (subscription_status in ('TRIAL_PENDING', 'TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'ACTIVE', 'SUSPENDED'));
alter table public.app_users add constraint app_users_trial_dates_check
  check (subscription_status <> 'TRIAL_ACTIVE' or
    (trial_started_at is not null and trial_ends_at is not null and trial_ends_at > trial_started_at));

create function public.touch_subscription_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end
$$;
create trigger app_users_subscription_updated_at before update on public.app_users
for each row execute function public.touch_subscription_updated_at();

-- Identities and license/OWNER fields can never be edited with browser credentials.
alter table public.app_users enable row level security;
drop policy if exists al_mether_service_only on public.app_users;
create policy al_mether_service_only on public.app_users as restrictive
for all to public using (false) with check (false);
revoke insert, update, delete on public.app_users from anon, authenticated;

-- This RPC is server-only. The email MUST come from a verified NextAuth session.
create function public.get_subscription_access(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u public.app_users%rowtype;
  at_time timestamptz := clock_timestamp();
  effective_status text;
  allowed boolean;
  days_left integer;
begin
  update public.app_users set subscription_status = 'TRIAL_EXPIRED'
  where lower(email) = lower(p_email)
    and subscription_status = 'TRIAL_ACTIVE' and trial_ends_at <= at_time;
  select * into u from public.app_users where lower(email) = lower(p_email);
  if not found then return null; end if;
  effective_status := u.subscription_status;
  -- A finite paid license never falls back into a trial.
  if effective_status = 'ACTIVE' and u.licensed_until <= at_time then
    effective_status := 'SUSPENDED';
  end if;
  if effective_status in ('ACTIVE', 'TRIAL_ACTIVE') and u.status <> 'active' then
    effective_status := 'SUSPENDED';
  end if;
  allowed := u.status = 'active' and (
    (effective_status = 'ACTIVE' and (u.licensed_until is null or u.licensed_until > at_time)) or
    (effective_status = 'TRIAL_ACTIVE' and u.trial_started_at <= at_time and u.trial_ends_at > at_time)
  );
  if effective_status = 'TRIAL_ACTIVE' then
    days_left := greatest(0, ceil(extract(epoch from (u.trial_ends_at - at_time)) / 86400))::integer;
  end if;
  return jsonb_build_object(
    'user_id', u.id, 'subscription_status', effective_status,
    'allowed', coalesce(allowed, false), 'is_owner', u.is_license_owner,
    'trial_started_at', u.trial_started_at, 'trial_ends_at', u.trial_ends_at,
    'licensed_until', u.licensed_until, 'server_now', at_time, 'days_remaining', days_left,
    'last_day', effective_status = 'TRIAL_ACTIVE' and
      (u.trial_ends_at at time zone 'Europe/Istanbul')::date = (at_time at time zone 'Europe/Istanbul')::date
  );
end
$$;

-- Both authorization and date arithmetic occur in one database transaction.
create function public.manage_subscription(
  p_actor_id text, p_user_id text, p_action text, p_days integer default 5,
  p_licensed_until timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor public.app_users%rowtype;
  target public.app_users%rowtype;
  at_time timestamptz := clock_timestamp();
begin
  select * into actor from public.app_users where id::text = p_actor_id for update;
  if not found or actor.is_license_owner is not true or actor.status is distinct from 'active'
     or actor.subscription_status is distinct from 'ACTIVE'
     or (actor.licensed_until is not null and actor.licensed_until <= at_time) then
    raise exception 'OWNER authorization required' using errcode = '42501';
  end if;
  select * into target from public.app_users where id::text = p_user_id for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if target.is_license_owner then
    raise exception 'OWNER accounts must be managed out of band' using errcode = '42501';
  end if;
  if p_action in ('approve', 'extend') and (p_days is null or p_days not in (2, 5, 7)) then
    raise exception 'Trial duration must be 2, 5 or 7 days' using errcode = '22023';
  end if;
  if p_action = 'approve' then
    if target.subscription_status <> 'TRIAL_PENDING' or target.trial_started_at is not null then
      raise exception 'Trial already approved; use extend' using errcode = '22023';
    end if;
    update public.app_users set subscription_status = 'TRIAL_ACTIVE', status = 'active',
      trial_started_at = at_time, trial_ends_at = at_time + p_days * interval '24 hours'
    where id = target.id;
  elsif p_action = 'extend' then
    if target.subscription_status not in ('TRIAL_ACTIVE', 'TRIAL_EXPIRED') or target.trial_started_at is null then
      raise exception 'Only an existing trial can be extended' using errcode = '22023';
    end if;
    update public.app_users set subscription_status = 'TRIAL_ACTIVE', status = 'active',
      trial_ends_at = greatest(at_time, target.trial_ends_at) + p_days * interval '24 hours'
    where id = target.id;
  elsif p_action = 'activate' then
    if p_licensed_until is not null and p_licensed_until <= at_time then
      raise exception 'License end must be in the future' using errcode = '22023';
    end if;
    update public.app_users set subscription_status = 'ACTIVE', status = 'active',
      licensed_until = p_licensed_until where id = target.id;
  elsif p_action = 'suspend' then
    -- Keep the identity login-capable; only application authorization changes.
    update public.app_users set subscription_status = 'SUSPENDED' where id = target.id;
  else
    raise exception 'Invalid subscription action' using errcode = '22023';
  end if;
  return public.get_subscription_access(target.email);
end
$$;

revoke all on function public.get_subscription_access(text) from public, anon, authenticated;
revoke all on function public.manage_subscription(text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.get_subscription_access(text) to service_role;
grant execute on function public.manage_subscription(text, text, text, integer, timestamptz) to service_role;

-- Keep the existing user_id RLS scope; add a database-clock license condition.
-- All existing policies using this helper inherit the check, including reminders.
create or replace function public.current_app_user_id()
returns text language sql stable security definer set search_path = '' as $$
  select u.id::text from public.app_users u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.status = 'active'
    and (
      (u.subscription_status = 'ACTIVE' and (u.licensed_until is null or u.licensed_until > statement_timestamp())) or
      (u.subscription_status = 'TRIAL_ACTIVE' and u.trial_started_at <= statement_timestamp() and u.trial_ends_at > statement_timestamp())
    )
  limit 1
$$;
revoke all on function public.current_app_user_id() from public;
grant execute on function public.current_app_user_id() to anon, authenticated;

commit;
