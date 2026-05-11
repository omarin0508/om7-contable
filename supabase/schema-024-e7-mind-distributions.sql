create table if not exists public.document_accounting_distributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extraction_id uuid not null references public.document_extractions(id) on delete cascade,
  classification_id uuid references public.document_classifications(id) on delete set null,
  line_index int not null,
  line_description text not null,
  quantity numeric,
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  suggested_account text,
  final_account text,
  suggested_category text,
  final_category text,
  suggested_cost_center text,
  final_cost_center text,
  tax_treatment text not null default 'not_applicable',
  confidence_score numeric(5, 2) not null default 0,
  rule_applied text not null default 'e7_keyword_rule',
  status text not null default 'suggested',
  corrected_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.document_accounting_distributions
drop constraint if exists document_accounting_distributions_status_check;

alter table public.document_accounting_distributions
add constraint document_accounting_distributions_status_check
check (status in ('suggested', 'edited', 'approved'));

alter table public.document_accounting_distributions
drop constraint if exists document_accounting_distributions_tax_treatment_check;

alter table public.document_accounting_distributions
add constraint document_accounting_distributions_tax_treatment_check
check (
  tax_treatment in (
    'iva_credito_fiscal',
    'iva_debito_fiscal',
    'exento',
    'no_acreditable',
    'not_applicable'
  )
);

create unique index if not exists document_accounting_distributions_extraction_line_key
on public.document_accounting_distributions (extraction_id, line_index);

create index if not exists document_accounting_distributions_document_idx
on public.document_accounting_distributions (organization_id, company_id, document_id);

create index if not exists document_accounting_distributions_status_idx
on public.document_accounting_distributions (organization_id, company_id, status);

drop trigger if exists set_document_accounting_distributions_updated_at
on public.document_accounting_distributions;
create trigger set_document_accounting_distributions_updated_at
before update on public.document_accounting_distributions
for each row execute function public.set_updated_at();

alter table public.document_accounting_distributions enable row level security;

drop policy if exists "document_accounting_distributions_select_internal"
on public.document_accounting_distributions;
create policy "document_accounting_distributions_select_internal"
on public.document_accounting_distributions for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "document_accounting_distributions_insert_internal"
on public.document_accounting_distributions;
create policy "document_accounting_distributions_insert_internal"
on public.document_accounting_distributions for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "document_accounting_distributions_update_internal"
on public.document_accounting_distributions;
create policy "document_accounting_distributions_update_internal"
on public.document_accounting_distributions for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
