-- Harden direct Supabase access without changing existing application data.
-- Server-side service-role clients continue to bypass RLS as designed.

create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.id::text
  from public.app_users as app_user
  where lower(app_user.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and app_user.status = 'active'
  limit 1
$$;

revoke all on function public.current_app_user_id() from public;
grant execute on function public.current_app_user_id() to anon, authenticated;

do $$
declare
  target_table text;
begin
  -- Remove the known unrestricted policies introduced by the initial schemas.
  if to_regclass('public.calendar_events') is not null then
    drop policy if exists "calendar_events_public_all" on public.calendar_events;
  end if;

  if to_regclass('public.calendar_reminders') is not null then
    drop policy if exists "calendar_reminders_public_all" on public.calendar_reminders;
  end if;

  if to_regclass('public.core_events') is not null then
    drop policy if exists "core_events_public_all" on public.core_events;
  end if;

  if to_regclass('public.core_notifications') is not null then
    drop policy if exists "core_notifications_public_all" on public.core_notifications;
  end if;

  if to_regclass('public.core_scheduler_jobs') is not null then
    drop policy if exists "core_scheduler_jobs_public_all" on public.core_scheduler_jobs;
  end if;

  -- Tables whose rows are owned directly through user_id.
  foreach target_table in array array[
    'alarms',
    'calendar_attachments',
    'calendar_checklists',
    'calendar_events',
    'calendar_notes',
    'case_document_records',
    'case_mails',
    'case_notes',
    'case_parties',
    'conversion_history',
    'core_events',
    'core_notifications',
    'legal_cases',
    'legal_deadlines'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null
       and exists (
         select 1
         from information_schema.columns as column_info
         where column_info.table_schema = 'public'
           and column_info.table_name = target_table
           and column_info.column_name = 'user_id'
       ) then
      execute format('alter table public.%I enable row level security', target_table);

      execute format(
        'drop policy if exists "al_mether_owner_access" on public.%I',
        target_table
      );
      execute format(
        'create policy "al_mether_owner_access" on public.%I for all to authenticated using (user_id::text = public.current_app_user_id()) with check (user_id::text = public.current_app_user_id())',
        target_table
      );

      -- Restrictive policies ensure an older permissive policy cannot expose
      -- another user's rows.
      execute format(
        'drop policy if exists "al_mether_owner_guard" on public.%I',
        target_table
      );
      execute format(
        'create policy "al_mether_owner_guard" on public.%I as restrictive for all to public using (user_id::text = public.current_app_user_id()) with check (user_id::text = public.current_app_user_id())',
        target_table
      );
    end if;
  end loop;

  -- These tables contain identities, credentials, push endpoints or global
  -- scheduler state and are intentionally accessible only through server APIs.
  foreach target_table in array array[
    'app_users',
    'deadlines',
    'mail_connections',
    'push_subscriptions',
    'core_scheduler_jobs'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I enable row level security', target_table);
      execute format(
        'drop policy if exists "al_mether_service_only" on public.%I',
        target_table
      );
      execute format(
        'create policy "al_mether_service_only" on public.%I as restrictive for all to public using (false) with check (false)',
        target_table
      );
    end if;
  end loop;

  -- Reminder ownership is inherited from its calendar event.
  if to_regclass('public.calendar_reminders') is not null then
    alter table public.calendar_reminders enable row level security;
    drop policy if exists "al_mether_reminder_owner_access" on public.calendar_reminders;
    drop policy if exists "al_mether_reminder_owner_guard" on public.calendar_reminders;

    if to_regclass('public.calendar_events') is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'calendar_events'
           and column_name = 'user_id'
       ) then
      create policy "al_mether_reminder_owner_access"
        on public.calendar_reminders
        for all
        to authenticated
        using (
          exists (
            select 1
            from public.calendar_events as event
            where event.id = calendar_reminders.event_id
              and event.user_id::text = public.current_app_user_id()
          )
        )
        with check (
          exists (
            select 1
            from public.calendar_events as event
            where event.id = calendar_reminders.event_id
              and event.user_id::text = public.current_app_user_id()
          )
        );

      create policy "al_mether_reminder_owner_guard"
        on public.calendar_reminders
        as restrictive
        for all
        to public
        using (
          exists (
            select 1
            from public.calendar_events as event
            where event.id = calendar_reminders.event_id
              and event.user_id::text = public.current_app_user_id()
          )
        )
        with check (
          exists (
            select 1
            from public.calendar_events as event
            where event.id = calendar_reminders.event_id
              and event.user_id::text = public.current_app_user_id()
          )
        );
    else
      create policy "al_mether_reminder_owner_guard"
        on public.calendar_reminders
        as restrictive
        for all
        to public
        using (false)
        with check (false);
    end if;
  end if;
end
$$;
