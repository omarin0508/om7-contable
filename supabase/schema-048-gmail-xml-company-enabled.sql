alter table public.companies
add column if not exists gmail_xml_enabled boolean not null default false;

update public.companies
set gmail_xml_enabled = true
where lower(coalesce(name, '') || ' ' || coalesce(legal_name, '')) like '%vag%';

create index if not exists companies_gmail_xml_enabled_idx
on public.companies (organization_id, gmail_xml_enabled)
where gmail_xml_enabled = true;

notify pgrst, 'reload schema';
