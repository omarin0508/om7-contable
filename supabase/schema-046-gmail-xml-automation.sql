alter table public.gmail_xml_connections
add column if not exists auto_sync_enabled boolean not null default true;

alter table public.gmail_xml_connections
add column if not exists last_sync_at timestamptz;

alter table public.gmail_xml_connections
add column if not exists last_sync_status text;

alter table public.gmail_xml_connections
add column if not exists last_sync_error text;

alter table public.gmail_xml_connections
add column if not exists last_sync_summary jsonb;

alter table public.gmail_xml_imports
add column if not exists sync_attempts integer not null default 0;

alter table public.gmail_xml_imports
add column if not exists last_attempt_at timestamptz;

alter table public.gmail_xml_imports
add column if not exists gmail_labels_updated_at timestamptz;

alter table public.gmail_xml_connections
drop constraint if exists gmail_xml_connections_last_sync_status_check;

alter table public.gmail_xml_connections
add constraint gmail_xml_connections_last_sync_status_check
check (
  last_sync_status is null
  or last_sync_status in ('ok', 'error')
);

create index if not exists gmail_xml_connections_auto_sync_idx
on public.gmail_xml_connections (auto_sync_enabled, active, last_sync_at);

create index if not exists gmail_xml_imports_retry_idx
on public.gmail_xml_imports (
  organization_id,
  user_id,
  import_status,
  sync_attempts,
  last_attempt_at
);

notify pgrst, 'reload schema';
