create table if not exists public.case_document_records (
  id uuid primary key default gen_random_uuid(),

  case_id uuid not null
    references public.legal_cases(id)
    on delete cascade,

  user_id uuid not null,

  document_identity text not null,

  file_name text not null,

  document_type text,

  parser_data jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint case_document_records_identity_check
    check (
      document_identity ~ '^[a-f0-9]{64}$'
    ),

  constraint case_document_records_user_identity_unique
    unique (
      user_id,
      document_identity
    )
);

create index if not exists
  case_document_records_case_id_idx
on public.case_document_records(case_id);

create index if not exists
  case_document_records_user_id_idx
on public.case_document_records(user_id);

create index if not exists
  case_document_records_document_type_idx
on public.case_document_records(
  user_id,
  document_type
);

alter table public.case_document_records
  enable row level security;
