alter table public.gmail_xml_imports
add column if not exists sync_mode text not null default 'daily';

alter table public.gmail_xml_imports
add column if not exists date_from date;

alter table public.gmail_xml_imports
add column if not exists date_to date;

alter table public.gmail_xml_imports
add column if not exists gmail_query text;

alter table public.gmail_xml_imports
add column if not exists batch_period text;

alter table public.gmail_xml_imports
add column if not exists has_more_results boolean not null default false;

alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_sync_mode_check;

alter table public.gmail_xml_imports
add constraint gmail_xml_imports_sync_mode_check
check (sync_mode in ('daily', 'historical'));

create index if not exists gmail_xml_imports_batch_idx
on public.gmail_xml_imports (
  organization_id,
  company_id,
  user_id,
  sync_mode,
  batch_period,
  created_at desc
);

notify pgrst, 'reload schema';
