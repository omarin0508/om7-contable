-- OM7 Finance OS - Schema 015
-- Catalogo base de contrapartes y matches documentales.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  type text not null default 'supplier',
  name text not null,
  normalized_name text not null,
  tax_id text,
  normalized_tax_id text,
  email text,
  phone text,
  source text not null default 'manual',
  default_category text,
  default_account text,
  default_cost_center_id uuid,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.counterparties
drop constraint if exists counterparties_type_check;

alter table public.counterparties
add constraint counterparties_type_check
check (type in ('supplier', 'customer', 'both'));

alter table public.counterparties
drop constraint if exists counterparties_source_check;

alter table public.counterparties
add constraint counterparties_source_check
check (source in ('manual', 'document', 'imported'));

create unique index if not exists counterparties_org_tax_id_key
on public.counterparties (organization_id, normalized_tax_id)
where normalized_tax_id is not null and normalized_tax_id <> '';

create unique index if not exists counterparties_org_name_key
on public.counterparties (organization_id, normalized_name)
where normalized_name <> '';

create index if not exists counterparties_company_idx
on public.counterparties (organization_id, company_id, type, is_active);

drop trigger if exists set_counterparties_updated_at on public.counterparties;
create trigger set_counterparties_updated_at
before update on public.counterparties
for each row execute function public.set_updated_at();

alter table public.counterparties enable row level security;

drop policy if exists "counterparties_select_internal" on public.counterparties;
create policy "counterparties_select_internal"
on public.counterparties for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "counterparties_insert_internal" on public.counterparties;
create policy "counterparties_insert_internal"
on public.counterparties for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "counterparties_update_internal" on public.counterparties;
create policy "counterparties_update_internal"
on public.counterparties for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create table if not exists public.document_counterparty_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid not null references public.document_extractions(id) on delete cascade,
  classification_id uuid references public.document_classifications(id) on delete set null,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  match_status text not null default 'none',
  counterparty_type text not null default 'supplier',
  name text,
  tax_id text,
  confidence_score numeric(5, 2) not null default 0,
  explanation text,
  status text not null default 'suggested',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.document_counterparty_matches
drop constraint if exists document_counterparty_matches_status_check;

alter table public.document_counterparty_matches
add constraint document_counterparty_matches_status_check
check (status in ('suggested', 'accepted', 'created', 'rejected', 'edited'));

alter table public.document_counterparty_matches
drop constraint if exists document_counterparty_matches_match_status_check;

alter table public.document_counterparty_matches
add constraint document_counterparty_matches_match_status_check
check (match_status in ('exact', 'probable', 'none'));

alter table public.document_counterparty_matches
drop constraint if exists document_counterparty_matches_type_check;

alter table public.document_counterparty_matches
add constraint document_counterparty_matches_type_check
check (counterparty_type in ('supplier', 'customer', 'both'));

create unique index if not exists document_counterparty_matches_extraction_id_key
on public.document_counterparty_matches (extraction_id);

create index if not exists document_counterparty_matches_document_id_idx
on public.document_counterparty_matches (document_id);

create index if not exists document_counterparty_matches_counterparty_id_idx
on public.document_counterparty_matches (counterparty_id);

drop trigger if exists set_document_counterparty_matches_updated_at on public.document_counterparty_matches;
create trigger set_document_counterparty_matches_updated_at
before update on public.document_counterparty_matches
for each row execute function public.set_updated_at();

alter table public.document_counterparty_matches enable row level security;

drop policy if exists "document_counterparty_matches_select_internal" on public.document_counterparty_matches;
create policy "document_counterparty_matches_select_internal"
on public.document_counterparty_matches for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "document_counterparty_matches_insert_internal" on public.document_counterparty_matches;
create policy "document_counterparty_matches_insert_internal"
on public.document_counterparty_matches for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "document_counterparty_matches_update_internal" on public.document_counterparty_matches;
create policy "document_counterparty_matches_update_internal"
on public.document_counterparty_matches for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

alter table public.purchases
add column if not exists counterparty_id uuid references public.counterparties(id) on delete set null;

alter table public.invoices
add column if not exists counterparty_id uuid references public.counterparties(id) on delete set null;

create index if not exists purchases_counterparty_id_idx
on public.purchases (counterparty_id);

create index if not exists invoices_counterparty_id_idx
on public.invoices (counterparty_id);
