-- OM7 Finance OS - Schema 006
-- Almacenamiento documental privado con Supabase Storage.
-- Ejecutar manualmente en Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('om7-documents', 'om7-documents', false)
on conflict (id) do update set public = false;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  related_type text not null default 'general',
  related_id uuid,
  original_filename text,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  document_type text not null default 'otro',
  processing_status text not null default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.documents enable row level security;

drop policy if exists "documents_select_org_member" on public.documents;
create policy "documents_select_org_member"
on public.documents for select
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = documents.company_id
      and c.organization_id = documents.organization_id
  )
);

drop policy if exists "documents_insert_active_org_company" on public.documents;
create policy "documents_insert_active_org_company"
on public.documents for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = documents.organization_id
      and p.active_company_id = documents.company_id
  )
  and exists (
    select 1
    from public.companies c
    where c.id = documents.company_id
      and c.organization_id = documents.organization_id
  )
);

drop policy if exists "documents_delete_org_member" on public.documents;
create policy "documents_delete_org_member"
on public.documents for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "storage_documents_select_org_member" on storage.objects;
create policy "storage_documents_select_org_member"
on storage.objects for select
to authenticated
using (
  bucket_id = 'om7-documents'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 3) = 'companies'
  and public.is_org_member(split_part(name, '/', 2)::uuid)
);

drop policy if exists "storage_documents_insert_active_org_company" on storage.objects;
create policy "storage_documents_insert_active_org_company"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'om7-documents'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 3) = 'companies'
  and split_part(name, '/', 5) = 'documents'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = split_part(name, '/', 2)::uuid
      and p.active_company_id = split_part(name, '/', 4)::uuid
  )
  and exists (
    select 1
    from public.companies c
    where c.id = split_part(name, '/', 4)::uuid
      and c.organization_id = split_part(name, '/', 2)::uuid
      and public.is_org_member(c.organization_id)
  )
);

drop policy if exists "storage_documents_delete_org_member" on storage.objects;
create policy "storage_documents_delete_org_member"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'om7-documents'
  and split_part(name, '/', 1) = 'organizations'
  and split_part(name, '/', 3) = 'companies'
  and public.is_org_member(split_part(name, '/', 2)::uuid)
);

create index if not exists documents_organization_id_idx
on public.documents (organization_id);

create index if not exists documents_company_id_idx
on public.documents (company_id);

create index if not exists documents_related_idx
on public.documents (related_type, related_id);

create index if not exists documents_created_at_idx
on public.documents (created_at desc);
