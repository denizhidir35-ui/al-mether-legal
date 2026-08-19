create table if not exists public.case_parties (
  id uuid primary key default gen_random_uuid(),

  case_id uuid not null
    references public.legal_cases(id)
    on delete cascade,

  user_id uuid not null,

  role text not null,
  party_type text not null default 'person',

  name text not null,

  is_client boolean not null default false,

  identity_no text,
  phone text,
  email text,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_parties_role_check
    check (
      role in (
        'muvekkil',
        'davaci',
        'davali',
        'sanik',
        'supheli',
        'katilan',
        'feri_mudahil',
        'vekil',
        'diger'
      )
    ),

  constraint case_parties_type_check
    check (
      party_type in (
        'person',
        'organization'
      )
    )
);

create index if not exists case_parties_case_id_idx
  on public.case_parties(case_id);

create index if not exists case_parties_user_id_idx
  on public.case_parties(user_id);

create index if not exists case_parties_name_idx
  on public.case_parties(lower(name));

create index if not exists case_parties_client_idx
  on public.case_parties(user_id, is_client)
  where is_client = true;

alter table public.case_parties
  enable row level security;
