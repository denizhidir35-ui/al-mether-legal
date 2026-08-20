begin;

create table if not exists public.core_notifications (
  id uuid primary key,
  title text not null,
  message text not null,
  channel text not null default 'in-app',
  status text not null default 'pending',
  product text,
  user_id text not null,
  source text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists core_notifications_user_feed_idx
  on public.core_notifications (user_id, channel, source, created_at desc);

create index if not exists core_notifications_source_identity_idx
  on public.core_notifications (source, source_id);

alter table public.core_notifications enable row level security;

grant select, insert, update, delete
  on table public.core_notifications
  to authenticated;

grant all
  on table public.core_notifications
  to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.core_notifications'::regclass
      and policy.polname = 'al_mether_owner_access'
  ) then
    create policy "al_mether_owner_access"
      on public.core_notifications
      for all
      to authenticated
      using (user_id = public.current_app_user_id())
      with check (user_id = public.current_app_user_id());
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy as policy
    where policy.polrelid = 'public.core_notifications'::regclass
      and policy.polname = 'al_mether_owner_guard'
  ) then
    create policy "al_mether_owner_guard"
      on public.core_notifications
      as restrictive
      for all
      to public
      using (user_id = public.current_app_user_id())
      with check (user_id = public.current_app_user_id());
  end if;
end
$$;

commit;
