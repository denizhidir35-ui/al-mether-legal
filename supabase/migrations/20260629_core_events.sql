create table if not exists public.core_events (
  id uuid primary key,
  type text not null,
  source text not null,
  product text,
  user_id text,
  correlation_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists core_events_type_idx
on public.core_events(type);

create index if not exists core_events_source_idx
on public.core_events(source);

create index if not exists core_events_product_idx
on public.core_events(product);

create index if not exists core_events_created_at_idx
on public.core_events(created_at);

alter table public.core_events enable row level security;

drop policy if exists "core_events_public_all" on public.core_events;
create policy "core_events_public_all"
on public.core_events
for all
using (true)
with check (true);
