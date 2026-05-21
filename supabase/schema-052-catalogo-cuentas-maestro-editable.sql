-- Permite administrar el Catalogo Maestro OM7 solamente a roles internos altos.
-- El catalogo por organizacion sigue protegido por membresia interna existente.

create or replace function public.is_master_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.status = 'active'
        and member.role in ('owner', 'platform_owner', 'org_owner', 'admin')
    );
$$;

drop policy if exists "cuentas_contables_insert_master_admin"
on public.cuentas_contables;

create policy "cuentas_contables_insert_master_admin"
on public.cuentas_contables for insert
to authenticated
with check (
  organization_id is null
  and public.is_master_catalog_admin()
);

drop policy if exists "cuentas_contables_update_master_admin"
on public.cuentas_contables;

create policy "cuentas_contables_update_master_admin"
on public.cuentas_contables for update
to authenticated
using (
  organization_id is null
  and public.is_master_catalog_admin()
)
with check (
  organization_id is null
  and public.is_master_catalog_admin()
);
