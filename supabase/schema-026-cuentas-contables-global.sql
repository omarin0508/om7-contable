alter table public.cuentas_contables
alter column organization_id drop not null;

drop index if exists cuentas_contables_organization_codigo_key;

create unique index if not exists cuentas_contables_global_codigo_key
on public.cuentas_contables (codigo)
where organization_id is null;

create unique index if not exists cuentas_contables_organization_codigo_key
on public.cuentas_contables (organization_id, codigo)
where organization_id is not null;

create or replace function public.validate_cuentas_contables_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_found boolean;
  parent_organization_id uuid;
begin
  if new.cuenta_padre_id is null then
    return new;
  end if;

  select true, organization_id
  into parent_found, parent_organization_id
  from public.cuentas_contables
  where id = new.cuenta_padre_id;

  if parent_found is not true then
    raise exception 'La cuenta padre no existe.';
  end if;

  if parent_organization_id is distinct from new.organization_id then
    raise exception 'La cuenta padre debe pertenecer al mismo catalogo.';
  end if;

  if exists (
    with recursive ancestors as (
      select id, cuenta_padre_id
      from public.cuentas_contables
      where id = new.cuenta_padre_id
      union all
      select parent.id, parent.cuenta_padre_id
      from public.cuentas_contables parent
      join ancestors current_node on parent.id = current_node.cuenta_padre_id
    )
    select 1
    from ancestors
    where id = new.id
  ) then
    raise exception 'La jerarquia de cuentas contables no puede tener ciclos.';
  end if;

  return new;
end;
$$;

drop policy if exists "cuentas_contables_select_internal"
on public.cuentas_contables;
create policy "cuentas_contables_select_internal"
on public.cuentas_contables for select
to authenticated
using (
  organization_id is null
  or public.is_internal_org_member(organization_id)
);

drop policy if exists "cuentas_contables_insert_internal"
on public.cuentas_contables;
create policy "cuentas_contables_insert_internal"
on public.cuentas_contables for insert
to authenticated
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);

drop policy if exists "cuentas_contables_update_internal"
on public.cuentas_contables;
create policy "cuentas_contables_update_internal"
on public.cuentas_contables for update
to authenticated
using (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_internal_org_member(organization_id)
);
