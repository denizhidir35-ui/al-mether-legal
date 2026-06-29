create table if not exists public.core_scheduler_jobs (
  id text primary key,
  name text not null,
  product text not null,
  frequency text not null default 'manual',
  enabled boolean not null default true,
  status text not null default 'idle',
  run_at timestamptz,
  last_run_at timestamptz,
  next_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists core_scheduler_jobs_product_idx
on public.core_scheduler_jobs(product);

create index if not exists core_scheduler_jobs_status_idx
on public.core_scheduler_jobs(status);

create index if not exists core_scheduler_jobs_next_run_at_idx
on public.core_scheduler_jobs(next_run_at);

alter table public.core_scheduler_jobs enable row level security;

drop policy if exists "core_scheduler_jobs_public_all" on public.core_scheduler_jobs;
create policy "core_scheduler_jobs_public_all"
on public.core_scheduler_jobs
for all
using (true)
with check (true);
