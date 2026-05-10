-- OM7 Finance OS - Schema 008
-- Bandeja de revision documental v1.
-- Ejecutar manualmente en Supabase SQL Editor.

alter table public.documents
add column if not exists review_status text not null default 'pending';

alter table public.documents
add column if not exists reviewed_at timestamptz;

alter table public.documents
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.documents
add column if not exists review_notes text;

create index if not exists documents_review_status_idx
on public.documents (review_status);

create index if not exists documents_client_upload_idx
on public.documents (organization_id, company_id, related_type, review_status);
