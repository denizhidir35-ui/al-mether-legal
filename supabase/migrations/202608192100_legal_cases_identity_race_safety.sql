-- AL METHER Legal
-- Race-safe legal case identity
--
-- Identity:
-- user_id + normalized court + normalized case number
--
-- Rows without a usable court or case number are intentionally
-- excluded from the unique index.

alter table public.legal_cases
  add column if not exists normalized_court text
  generated always as (
    nullif(
      regexp_replace(
        translate(
          lower(
            translate(
              coalesce(court_name, ''),
              'ÇĞİÖŞÜI',
              'CGIOSUI'
            )
          ),
          'çğıöşü',
          'cgiosu'
        ),
        '[^a-z0-9]+',
        '',
        'g'
      ),
      ''
    )
  ) stored;

alter table public.legal_cases
  add column if not exists normalized_case_number text
  generated always as (
    substring(
      regexp_replace(
        coalesce(case_number, ''),
        '\s+',
        '',
        'g'
      )
      from '([0-9]{4}/[0-9]+)'
    )
  ) stored;

do $$
begin
  if exists (
    select 1
    from public.legal_cases
    where
      normalized_court is not null
      and normalized_case_number is not null
    group by
      user_id,
      normalized_court,
      normalized_case_number
    having count(*) > 1
  ) then
    raise exception
      'legal_cases contains duplicate canonical case identities';
  end if;
end
$$;

create unique index if not exists
  legal_cases_user_court_case_uidx
on public.legal_cases (
  user_id,
  normalized_court,
  normalized_case_number
)
where
  normalized_court is not null
  and normalized_case_number is not null;

create index if not exists
  legal_cases_normalized_identity_idx
on public.legal_cases (
  user_id,
  normalized_case_number,
  normalized_court
)
where
  normalized_court is not null
  and normalized_case_number is not null;
