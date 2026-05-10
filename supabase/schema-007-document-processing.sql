-- OM7 Finance OS - Schema 007
-- Base de procesamiento documental v1 para OCR / IA futura.
-- Ejecutar manualmente en Supabase SQL Editor.

do $$
begin
  if to_regclass('public.documents') is null then
    raise exception 'Falta public.documents. Ejecuta primero supabase/schema-006-documents.sql.';
  end if;
end;
$$;

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  extraction_provider text not null default 'manual',
  extraction_status text not null default 'pending',
  raw_text text,
  extracted_data jsonb default '{}'::jsonb,
  confidence numeric(5, 2) default 1,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.document_extractions
alter column confidence set default 1;

drop trigger if exists set_document_extractions_updated_at on public.document_extractions;
create trigger set_document_extractions_updated_at
before update on public.document_extractions
for each row execute function public.set_updated_at();

alter table public.document_extractions enable row level security;

drop policy if exists "documents_update_processing_status" on public.documents;
create policy "documents_update_processing_status"
on public.documents for update
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = documents.organization_id
      and p.active_company_id = documents.company_id
  )
)
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = documents.organization_id
      and p.active_company_id = documents.company_id
  )
);

drop policy if exists "document_extractions_select_org_member" on public.document_extractions;
create policy "document_extractions_select_org_member"
on public.document_extractions for select
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.documents d
    where d.id = document_extractions.document_id
      and d.organization_id = document_extractions.organization_id
      and d.company_id = document_extractions.company_id
  )
);

drop policy if exists "document_extractions_insert_active_org_company" on public.document_extractions;
create policy "document_extractions_insert_active_org_company"
on public.document_extractions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = document_extractions.organization_id
      and p.active_company_id = document_extractions.company_id
  )
  and exists (
    select 1
    from public.documents d
    where d.id = document_extractions.document_id
      and d.organization_id = document_extractions.organization_id
      and d.company_id = document_extractions.company_id
  )
);

drop policy if exists "document_extractions_update_active_org_company" on public.document_extractions;
create policy "document_extractions_update_active_org_company"
on public.document_extractions for update
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = document_extractions.organization_id
      and p.active_company_id = document_extractions.company_id
  )
)
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = document_extractions.organization_id
      and p.active_company_id = document_extractions.company_id
  )
);

create index if not exists document_extractions_document_id_idx
on public.document_extractions (document_id);

create index if not exists document_extractions_organization_id_idx
on public.document_extractions (organization_id);

create index if not exists document_extractions_company_id_idx
on public.document_extractions (company_id);

create index if not exists document_extractions_status_idx
on public.document_extractions (extraction_status);
