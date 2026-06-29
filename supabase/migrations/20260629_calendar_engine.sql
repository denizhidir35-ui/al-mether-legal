create table if not exists public.calendar_events (
  id uuid primary key,
  legal_event_id text not null,
  title text not null,
  description text,
  start_date date not null,
  end_date date not null,
  all_day boolean not null default true,
  risk text,
  source text not null default 'gmail',
  source_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_reminders (
  id uuid primary key,
  calendar_event_id uuid not null references public.calendar_events(id) on delete cascade,
  remind_at timestamptz not null,
  type text not null default 'system',
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_start_date_idx
on public.calendar_events(start_date);

create index if not exists calendar_events_source_id_idx
on public.calendar_events(source_id);

create index if not exists calendar_reminders_calendar_event_id_idx
on public.calendar_reminders(calendar_event_id);

create index if not exists calendar_reminders_remind_at_idx
on public.calendar_reminders(remind_at);

alter table public.calendar_events enable row level security;
alter table public.calendar_reminders enable row level security;

drop policy if exists "calendar_events_public_all" on public.calendar_events;
create policy "calendar_events_public_all"
on public.calendar_events
for all
using (true)
with check (true);

drop policy if exists "calendar_reminders_public_all" on public.calendar_reminders;
create policy "calendar_reminders_public_all"
on public.calendar_reminders
for all
using (true)
with check (true);
