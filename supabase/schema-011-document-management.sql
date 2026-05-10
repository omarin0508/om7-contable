-- OM7 Finance OS - Schema 011
-- Gestion documental: archivo, inactivo y borrado logico.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.documents
add column if not exists display_name text;

alter table public.documents
add column if not exists notes text;

alter table public.documents
add column if not exists archived_at timestamptz;

alter table public.documents
add column if not exists inactive_at timestamptz;

alter table public.documents
add column if not exists deleted_at timestamptz;

alter table public.documents
add column if not exists updated_at timestamptz default now();

alter table public.documents
add column if not exists updated_by uuid references auth.users(id) on delete set null;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create index if not exists documents_archived_at_idx
on public.documents (archived_at);

create index if not exists documents_inactive_at_idx
on public.documents (inactive_at);

create index if not exists documents_deleted_at_idx
on public.documents (deleted_at);

create index if not exists documents_lifecycle_idx
on public.documents (organization_id, company_id, archived_at, inactive_at, deleted_at);

drop policy if exists "documents_manage_internal_org_member" on public.documents;
create policy "documents_manage_internal_org_member"
on public.documents for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
