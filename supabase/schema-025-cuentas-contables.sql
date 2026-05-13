create table if not exists public.cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  nivel integer not null,
  cuenta_padre_id uuid references public.cuentas_contables(id) on delete restrict,
  tipo_estado text not null,
  categoria text not null,
  naturaleza text not null,
  tipo_cuenta text not null,
  permite_movimientos boolean not null default false,
  centro_costo_requerido boolean not null default false,
  moneda text,
  activa boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_codigo_not_blank;

alter table public.cuentas_contables
add constraint cuentas_contables_codigo_not_blank
check (length(btrim(codigo)) > 0);

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_nombre_not_blank;

alter table public.cuentas_contables
add constraint cuentas_contables_nombre_not_blank
check (length(btrim(nombre)) > 0);

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_nivel_check;

alter table public.cuentas_contables
add constraint cuentas_contables_nivel_check
check (nivel >= 1);

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_tipo_estado_check;

alter table public.cuentas_contables
add constraint cuentas_contables_tipo_estado_check
check (tipo_estado in ('BG', 'ER'));

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_categoria_check;

alter table public.cuentas_contables
add constraint cuentas_contables_categoria_check
check (categoria in ('activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto'));

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_naturaleza_check;

alter table public.cuentas_contables
add constraint cuentas_contables_naturaleza_check
check (naturaleza in ('deudora', 'acreedora'));

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_tipo_cuenta_check;

alter table public.cuentas_contables
add constraint cuentas_contables_tipo_cuenta_check
check (tipo_cuenta in ('acumulativa', 'detalle'));

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_movimientos_detalle_check;

alter table public.cuentas_contables
add constraint cuentas_contables_movimientos_detalle_check
check (tipo_cuenta = 'detalle' or permite_movimientos = false);

alter table public.cuentas_contables
drop constraint if exists cuentas_contables_not_self_parent;

alter table public.cuentas_contables
add constraint cuentas_contables_not_self_parent
check (cuenta_padre_id is null or cuenta_padre_id <> id);

create unique index if not exists cuentas_contables_organization_codigo_key
on public.cuentas_contables (organization_id, codigo);

create index if not exists cuentas_contables_organization_idx
on public.cuentas_contables (organization_id);

create index if not exists cuentas_contables_codigo_idx
on public.cuentas_contables (codigo);

create index if not exists cuentas_contables_cuenta_padre_idx
on public.cuentas_contables (cuenta_padre_id);

create index if not exists cuentas_contables_categoria_idx
on public.cuentas_contables (categoria);

create index if not exists cuentas_contables_tipo_estado_idx
on public.cuentas_contables (tipo_estado);

create or replace function public.validate_cuentas_contables_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_organization_id uuid;
begin
  if new.cuenta_padre_id is null then
    return new;
  end if;

  select organization_id
  into parent_organization_id
  from public.cuentas_contables
  where id = new.cuenta_padre_id;

  if parent_organization_id is null then
    raise exception 'La cuenta padre no existe.';
  end if;

  if parent_organization_id <> new.organization_id then
    raise exception 'La cuenta padre debe pertenecer a la misma organizacion.';
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

drop trigger if exists validate_cuentas_contables_hierarchy_trigger
on public.cuentas_contables;
create trigger validate_cuentas_contables_hierarchy_trigger
before insert or update of organization_id, cuenta_padre_id
on public.cuentas_contables
for each row execute function public.validate_cuentas_contables_hierarchy();

drop trigger if exists set_cuentas_contables_updated_at
on public.cuentas_contables;
create trigger set_cuentas_contables_updated_at
before update on public.cuentas_contables
for each row execute function public.set_updated_at();

alter table public.cuentas_contables enable row level security;

drop policy if exists "cuentas_contables_select_internal"
on public.cuentas_contables;
create policy "cuentas_contables_select_internal"
on public.cuentas_contables for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "cuentas_contables_insert_internal"
on public.cuentas_contables;
create policy "cuentas_contables_insert_internal"
on public.cuentas_contables for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "cuentas_contables_update_internal"
on public.cuentas_contables;
create policy "cuentas_contables_update_internal"
on public.cuentas_contables for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));
