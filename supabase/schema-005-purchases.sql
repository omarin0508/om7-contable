-- OM7 Finance OS - Schema 005
-- Compras y gastos manuales v1 asociadas a empresa activa.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text,
  document_number text,
  purchase_date date,
  category text,
  description text,
  currency text default 'CRC',
  subtotal numeric(14, 2) default 0,
  tax numeric(14, 2) default 0,
  total numeric(14, 2) default 0,
  payment_method text,
  status text not null default 'registrada',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_purchases_updated_at on public.purchases;
create trigger set_purchases_updated_at
before update on public.purchases
for each row execute function public.set_updated_at();

alter table public.purchases enable row level security;

drop policy if exists "purchases_select_org_member" on public.purchases;
create policy "purchases_select_org_member"
on public.purchases for select
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.companies c
    where c.id = purchases.company_id
      and c.organization_id = purchases.organization_id
  )
);

drop policy if exists "purchases_insert_active_org_company" on public.purchases;
create policy "purchases_insert_active_org_company"
on public.purchases for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = purchases.organization_id
      and p.active_company_id = purchases.company_id
  )
  and exists (
    select 1
    from public.companies c
    where c.id = purchases.company_id
      and c.organization_id = purchases.organization_id
  )
);

create index if not exists purchases_organization_id_idx
on public.purchases (organization_id);

create index if not exists purchases_company_id_idx
on public.purchases (company_id);

create index if not exists purchases_purchase_date_idx
on public.purchases (purchase_date desc);
