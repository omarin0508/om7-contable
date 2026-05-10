-- OM7 Finance OS - Schema 004
-- Facturas manuales v1 asociadas a empresa activa.
-- Ejecutar manualmente en Supabase SQL Editor.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo_documento text not null default 'factura',
  proveedor text not null,
  numero_documento text,
  fecha date,
  moneda text default 'CRC',
  subtotal numeric(14, 2) default 0,
  impuesto numeric(14, 2) default 0,
  total numeric(14, 2) default 0,
  estado text not null default 'borrador',
  notas text,
  created_at timestamptz default now()
);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_org_member" on public.invoices;
create policy "invoices_select_org_member"
on public.invoices for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "invoices_insert_active_org_company" on public.invoices;
create policy "invoices_insert_active_org_company"
on public.invoices for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active_organization_id = invoices.organization_id
      and p.active_company_id = invoices.company_id
  )
  and exists (
    select 1
    from public.companies c
    where c.id = invoices.company_id
      and c.organization_id = invoices.organization_id
  )
);

create index if not exists invoices_organization_id_idx
on public.invoices (organization_id);

create index if not exists invoices_company_id_idx
on public.invoices (company_id);

create index if not exists invoices_created_at_idx
on public.invoices (created_at desc);
