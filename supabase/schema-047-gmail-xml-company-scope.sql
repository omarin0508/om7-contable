alter table public.gmail_xml_imports
add column if not exists company_id uuid references public.companies(id) on delete set null;

update public.gmail_xml_imports imports
set company_id = documents.company_id
from public.documents documents
where imports.company_id is null
  and imports.imported_document_id = documents.id;

alter table public.gmail_xml_connections
drop constraint if exists gmail_xml_connections_unique_org_user;

drop index if exists public.gmail_xml_connections_unique_org_user_company;

create unique index if not exists gmail_xml_connections_unique_org_user_company
on public.gmail_xml_connections (
  organization_id,
  user_id,
  company_id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gmail_xml_connections_unique_org_user_company'
      and conrelid = 'public.gmail_xml_connections'::regclass
  ) then
    alter table public.gmail_xml_connections
    add constraint gmail_xml_connections_unique_org_user_company
      unique using index gmail_xml_connections_unique_org_user_company;
  end if;
end;
$$;

drop index if exists public.gmail_xml_imports_unique_attachment;
drop index if exists public.gmail_xml_imports_unique_attachment_idx;
alter table public.gmail_xml_imports
drop constraint if exists gmail_xml_imports_unique_attachment;

create unique index if not exists gmail_xml_imports_unique_company_attachment
on public.gmail_xml_imports (
  organization_id,
  company_id,
  user_id,
  gmail_message_id,
  gmail_attachment_id
);

drop index if exists public.gmail_xml_imports_context_status_idx;

create index if not exists gmail_xml_imports_context_status_idx
on public.gmail_xml_imports (
  organization_id,
  company_id,
  user_id,
  import_status,
  created_at desc
);

notify pgrst, 'reload schema';
