alter table public.mail_connections
  add column if not exists display_name text;

alter table public.mail_connections
  drop constraint if exists mail_connections_user_id_provider_key;

drop index if exists public.mail_connections_user_id_provider_key;

create unique index if not exists mail_connections_user_provider_email_uidx
  on public.mail_connections (
    user_id,
    provider,
    lower(email)
  );
