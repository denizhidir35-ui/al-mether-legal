create table if not exists public.core_notifications (
  id uuid primary key,
  title text not null,
  message text not null,
  channel text not null default 'in-app',
  status text not null default 'pending',
  product text,
  user_id text,
  source text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  scheduled_at timestamptz,
  sent_at timestamptz
);

create index if not exists core_notifications_status_idx
on public.core_notifications(status);

create index if not exists core_notifications_product_idx
on public.core_notifications(product);

create index if not exists core_notifications_created_at_idx
on public.core_notifications(created_at);

create index if not exists core_notifications_scheduled_at_idx
on public.core_notifications(scheduled_at);

alter table public.core_notifications enable row level security;

drop policy if exists "core_notifications_public_all" on public.core_notifications;
create policy "core_notifications_public_all"
on public.core_notifications
for all
using (true)
with check (true);
