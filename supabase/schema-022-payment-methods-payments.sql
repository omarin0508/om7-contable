create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.payment_methods
drop constraint if exists payment_methods_type_check;

alter table public.payment_methods
add constraint payment_methods_type_check
check (type in ('cash', 'bank', 'card', 'transfer', 'payable', 'receivable'));

create unique index if not exists payment_methods_company_code_key
on public.payment_methods (organization_id, company_id, code)
where company_id is not null;

create unique index if not exists payment_methods_company_code_all_key
on public.payment_methods (organization_id, company_id, code);

create unique index if not exists payment_methods_org_code_key
on public.payment_methods (organization_id, code)
where company_id is null;

create index if not exists payment_methods_company_active_idx
on public.payment_methods (organization_id, company_id, is_active, type);

alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select_internal" on public.payment_methods;
create policy "payment_methods_select_internal"
on public.payment_methods for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "payment_methods_insert_internal" on public.payment_methods;
create policy "payment_methods_insert_internal"
on public.payment_methods for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "payment_methods_update_internal" on public.payment_methods;
create policy "payment_methods_update_internal"
on public.payment_methods for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.purchase_payments
drop constraint if exists purchase_payments_amount_check;

alter table public.purchase_payments
add constraint purchase_payments_amount_check
check (amount > 0);

create index if not exists purchase_payments_purchase_id_idx
on public.purchase_payments (purchase_id);

create index if not exists purchase_payments_company_date_idx
on public.purchase_payments (organization_id, company_id, payment_date);

alter table public.purchase_payments enable row level security;

drop policy if exists "purchase_payments_select_internal" on public.purchase_payments;
create policy "purchase_payments_select_internal"
on public.purchase_payments for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "purchase_payments_insert_internal" on public.purchase_payments;
create policy "purchase_payments_insert_internal"
on public.purchase_payments for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "purchase_payments_update_internal" on public.purchase_payments;
create policy "purchase_payments_update_internal"
on public.purchase_payments for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

create table if not exists public.invoice_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  amount numeric not null,
  collection_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.invoice_collections
drop constraint if exists invoice_collections_amount_check;

alter table public.invoice_collections
add constraint invoice_collections_amount_check
check (amount > 0);

create index if not exists invoice_collections_invoice_id_idx
on public.invoice_collections (invoice_id);

create index if not exists invoice_collections_company_date_idx
on public.invoice_collections (organization_id, company_id, collection_date);

alter table public.invoice_collections enable row level security;

drop policy if exists "invoice_collections_select_internal" on public.invoice_collections;
create policy "invoice_collections_select_internal"
on public.invoice_collections for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "invoice_collections_insert_internal" on public.invoice_collections;
create policy "invoice_collections_insert_internal"
on public.invoice_collections for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "invoice_collections_update_internal" on public.invoice_collections;
create policy "invoice_collections_update_internal"
on public.invoice_collections for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

insert into public.payment_methods (
  organization_id,
  company_id,
  code,
  name,
  type,
  is_active
)
select companies.organization_id, companies.id, defaults.code, defaults.name, defaults.type, true
from public.companies
cross join (
  values
    ('cash', 'Caja', 'cash'),
    ('bank', 'Banco', 'bank'),
    ('card', 'Tarjeta', 'card'),
    ('transfer', 'Transferencia', 'transfer'),
    ('payable', 'Credito / Por pagar', 'payable'),
    ('receivable', 'Por cobrar', 'receivable')
) as defaults(code, name, type)
on conflict do nothing;
