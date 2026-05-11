-- OM7 Finance OS - Schema 013
-- Motor de clasificacion documental por reglas v1.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.document_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid not null references public.document_extractions(id) on delete cascade,
  flow_type text not null default 'unknown',
  counterparty_type text not null default 'unknown',
  suggested_account text,
  suggested_category text,
  suggested_cost_center_id uuid,
  confidence_score numeric(5, 2) not null default 0,
  rule_applied text not null default 'no_rule',
  explanation text,
  needs_review boolean not null default true,
  status text not null default 'suggested',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.document_classifications
drop constraint if exists document_classifications_flow_type_check;

alter table public.document_classifications
add constraint document_classifications_flow_type_check
check (flow_type in ('purchase', 'sale', 'expense', 'income', 'unknown'));

alter table public.document_classifications
drop constraint if exists document_classifications_counterparty_type_check;

alter table public.document_classifications
add constraint document_classifications_counterparty_type_check
check (counterparty_type in ('supplier', 'customer', 'unknown'));

alter table public.document_classifications
drop constraint if exists document_classifications_status_check;

alter table public.document_classifications
add constraint document_classifications_status_check
check (status in ('suggested', 'accepted', 'rejected', 'edited'));

create unique index if not exists document_classifications_extraction_id_key
on public.document_classifications (extraction_id);

create index if not exists document_classifications_document_id_idx
on public.document_classifications (document_id);

create index if not exists document_classifications_company_status_idx
on public.document_classifications (organization_id, company_id, status);

drop trigger if exists set_document_classifications_updated_at on public.document_classifications;
create trigger set_document_classifications_updated_at
before update on public.document_classifications
for each row execute function public.set_updated_at();

alter table public.document_classifications enable row level security;

drop policy if exists "document_classifications_select_internal" on public.document_classifications;
create policy "document_classifications_select_internal"
on public.document_classifications for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "document_classifications_insert_internal" on public.document_classifications;
create policy "document_classifications_insert_internal"
on public.document_classifications for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "document_classifications_update_internal" on public.document_classifications;
create policy "document_classifications_update_internal"
on public.document_classifications for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
