drop function if exists public.get_presupuesto_vs_contabilidad(uuid, uuid, date, date);

create table if not exists public.centros_costo (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  codigo text,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.centros_costo
drop constraint if exists centros_costo_nombre_not_blank;

alter table public.centros_costo
add constraint centros_costo_nombre_not_blank
check (length(btrim(nombre)) > 0);

create index if not exists centros_costo_organization_idx
on public.centros_costo (organization_id);

create unique index if not exists centros_costo_org_codigo_key
on public.centros_costo (organization_id, lower(btrim(codigo)))
where codigo is not null and length(btrim(codigo)) > 0;

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  centro_costo_id uuid references public.centros_costo(id) on delete set null,
  nombre text not null,
  periodo_desde date,
  periodo_hasta date,
  moneda text not null default 'CRC',
  monto_presupuestado numeric not null default 0,
  estado text not null default 'aprobado',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.presupuestos
drop constraint if exists presupuestos_nombre_not_blank;

alter table public.presupuestos
add constraint presupuestos_nombre_not_blank
check (length(btrim(nombre)) > 0);

alter table public.presupuestos
drop constraint if exists presupuestos_monto_check;

alter table public.presupuestos
add constraint presupuestos_monto_check
check (monto_presupuestado >= 0);

alter table public.presupuestos
drop constraint if exists presupuestos_estado_check;

alter table public.presupuestos
add constraint presupuestos_estado_check
check (estado in ('borrador', 'aprobado', 'en_ejecucion', 'cerrado', 'anulado'));

alter table public.presupuestos
drop constraint if exists presupuestos_fechas_check;

alter table public.presupuestos
add constraint presupuestos_fechas_check
check (
  periodo_desde is null
  or periodo_hasta is null
  or periodo_hasta >= periodo_desde
);

create index if not exists presupuestos_organization_idx
on public.presupuestos (organization_id);

create index if not exists presupuestos_centro_costo_idx
on public.presupuestos (centro_costo_id);

create index if not exists presupuestos_estado_idx
on public.presupuestos (organization_id, estado);

create or replace function public.validate_presupuesto_centro_costo_org()
returns trigger
language plpgsql
as $$
declare
  target_organization_id uuid;
begin
  if new.centro_costo_id is null then
    return new;
  end if;

  select organization_id
  into target_organization_id
  from public.centros_costo
  where id = new.centro_costo_id;

  if target_organization_id is null then
    raise exception 'El centro de costo no existe.';
  end if;

  if target_organization_id <> new.organization_id then
    raise exception 'El presupuesto debe pertenecer a la misma organizacion del centro de costo.';
  end if;

  return new;
end;
$$;

create or replace function public.get_presupuesto_vs_contabilidad(
  p_organization_id uuid,
  p_centro_costo_id uuid default null,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  centro_costo_id uuid,
  centro_costo_nombre text,
  presupuesto_id uuid,
  presupuesto_nombre text,
  monto_presupuestado numeric,
  gasto_contable_real numeric,
  comprometido_contable numeric,
  disponible numeric,
  porcentaje_ejecucion numeric,
  desviacion numeric,
  estado text
)
language sql
stable
security definer
set search_path = public
as $$
  with gasto_real_raw as (
    select
      linea.centro_costo_id,
      linea.presupuesto_id,
      sum(coalesce(linea.debito, 0) - coalesce(linea.credito, 0)) as gasto_contable_real
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
    where asiento.organization_id = p_organization_id
      and asiento.estado = 'contabilizado'
      and (p_fecha_desde is null or asiento.fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
      and (p_centro_costo_id is null or linea.centro_costo_id = p_centro_costo_id)
      and cuenta.tipo_estado = 'ER'
      and cuenta.categoria in ('costo', 'gasto')
      and cuenta.tipo_cuenta = 'detalle'
    group by linea.centro_costo_id, linea.presupuesto_id
  ),
  comprometido_raw as (
    select
      subcontrato.centro_costo_id,
      subcontrato.presupuesto_id,
      sum(greatest(coalesce(pago.monto_bruto, 0), 0)) as comprometido_contable
    from public.subcontratos_pagos pago
    join public.subcontratos subcontrato on subcontrato.id = pago.subcontrato_id
    where pago.organization_id = p_organization_id
      and pago.estado_operativo in ('revisado', 'aprobado', 'pagado')
      and coalesce(pago.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
      and (p_fecha_desde is null or pago.fecha_pago >= p_fecha_desde)
      and (p_fecha_hasta is null or pago.fecha_pago <= p_fecha_hasta)
      and (p_centro_costo_id is null or subcontrato.centro_costo_id = p_centro_costo_id)
    group by subcontrato.centro_costo_id, subcontrato.presupuesto_id
  ),
  presupuestos_base as (
    select
      presupuesto.id as presupuesto_id,
      presupuesto.organization_id,
      presupuesto.centro_costo_id,
      coalesce(centro.nombre, 'Sin centro de costo') as centro_costo_nombre,
      presupuesto.nombre as presupuesto_nombre,
      presupuesto.monto_presupuestado
    from public.presupuestos presupuesto
    left join public.centros_costo centro on centro.id = presupuesto.centro_costo_id
    where presupuesto.organization_id = p_organization_id
      and presupuesto.estado in ('aprobado', 'en_ejecucion', 'cerrado')
      and (p_centro_costo_id is null or presupuesto.centro_costo_id = p_centro_costo_id)
      and (
        p_fecha_desde is null
        or presupuesto.periodo_hasta is null
        or presupuesto.periodo_hasta >= p_fecha_desde
      )
      and (
        p_fecha_hasta is null
        or presupuesto.periodo_desde is null
        or presupuesto.periodo_desde <= p_fecha_hasta
      )
  ),
  presupuesto_rows as (
    select
      presupuesto.organization_id,
      presupuesto.centro_costo_id,
      presupuesto.centro_costo_nombre,
      presupuesto.presupuesto_id,
      presupuesto.presupuesto_nombre,
      presupuesto.monto_presupuestado,
      coalesce(sum(gasto.gasto_contable_real), 0) as gasto_contable_real,
      coalesce(sum(comprometido.comprometido_contable), 0) as comprometido_contable
    from presupuestos_base presupuesto
    left join gasto_real_raw gasto on (
      gasto.presupuesto_id = presupuesto.presupuesto_id
      or (
        gasto.presupuesto_id is null
        and gasto.centro_costo_id is not distinct from presupuesto.centro_costo_id
      )
    )
    left join comprometido_raw comprometido on (
      comprometido.presupuesto_id = presupuesto.presupuesto_id
      or (
        comprometido.presupuesto_id is null
        and comprometido.centro_costo_id is not distinct from presupuesto.centro_costo_id
      )
    )
    group by
      presupuesto.organization_id,
      presupuesto.centro_costo_id,
      presupuesto.centro_costo_nombre,
      presupuesto.presupuesto_id,
      presupuesto.presupuesto_nombre,
      presupuesto.monto_presupuestado
  ),
  unbudgeted_keys as (
    select centro_costo_id, presupuesto_id from gasto_real_raw
    union
    select centro_costo_id, presupuesto_id from comprometido_raw
  ),
  unbudgeted_rows as (
    select
      p_organization_id as organization_id,
      keys.centro_costo_id,
      coalesce(centro.nombre, 'Sin centro de costo') as centro_costo_nombre,
      keys.presupuesto_id,
      coalesce(presupuesto.nombre, 'Sin presupuesto') as presupuesto_nombre,
      coalesce(presupuesto.monto_presupuestado, 0) as monto_presupuestado,
      coalesce(gasto.gasto_contable_real, 0) as gasto_contable_real,
      coalesce(comprometido.comprometido_contable, 0) as comprometido_contable
    from unbudgeted_keys keys
    left join public.centros_costo centro on centro.id = keys.centro_costo_id
    left join public.presupuestos presupuesto on presupuesto.id = keys.presupuesto_id
    left join gasto_real_raw gasto on gasto.centro_costo_id is not distinct from keys.centro_costo_id
      and gasto.presupuesto_id is not distinct from keys.presupuesto_id
    left join comprometido_raw comprometido on comprometido.centro_costo_id is not distinct from keys.centro_costo_id
      and comprometido.presupuesto_id is not distinct from keys.presupuesto_id
    where not exists (
      select 1
      from presupuestos_base presupuesto_base
      where presupuesto_base.presupuesto_id is not distinct from keys.presupuesto_id
        or (
          keys.presupuesto_id is null
          and presupuesto_base.centro_costo_id is not distinct from keys.centro_costo_id
        )
    )
  ),
  combined_rows as (
    select * from presupuesto_rows
    union all
    select * from unbudgeted_rows
  )
  select
    combined_rows.organization_id,
    combined_rows.centro_costo_id,
    combined_rows.centro_costo_nombre,
    combined_rows.presupuesto_id,
    combined_rows.presupuesto_nombre,
    combined_rows.monto_presupuestado,
    combined_rows.gasto_contable_real,
    combined_rows.comprometido_contable,
    combined_rows.monto_presupuestado
      - combined_rows.gasto_contable_real
      - combined_rows.comprometido_contable as disponible,
    case
      when combined_rows.monto_presupuestado > 0 then
        round(
          (
            (combined_rows.gasto_contable_real + combined_rows.comprometido_contable)
            / combined_rows.monto_presupuestado
          ) * 100,
          2
        )
      else null
    end as porcentaje_ejecucion,
    combined_rows.gasto_contable_real
      + combined_rows.comprometido_contable
      - combined_rows.monto_presupuestado as desviacion,
    case
      when combined_rows.monto_presupuestado <= 0 then 'sin_presupuesto'
      when combined_rows.gasto_contable_real + combined_rows.comprometido_contable
        > combined_rows.monto_presupuestado then 'excedido'
      when combined_rows.gasto_contable_real + combined_rows.comprometido_contable
        >= combined_rows.monto_presupuestado * 0.85 then 'cerca_limite'
      else 'dentro_presupuesto'
    end as estado
  from combined_rows
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role'
  order by
    combined_rows.centro_costo_nombre,
    combined_rows.presupuesto_nombre;
$$;

drop trigger if exists validate_presupuesto_centro_costo_org_trigger
on public.presupuestos;
create trigger validate_presupuesto_centro_costo_org_trigger
before insert or update
on public.presupuestos
for each row execute function public.validate_presupuesto_centro_costo_org();

drop trigger if exists set_centros_costo_updated_at
on public.centros_costo;
create trigger set_centros_costo_updated_at
before update on public.centros_costo
for each row execute function public.set_updated_at();

drop trigger if exists set_presupuestos_updated_at
on public.presupuestos;
create trigger set_presupuestos_updated_at
before update on public.presupuestos
for each row execute function public.set_updated_at();

alter table public.centros_costo enable row level security;
alter table public.presupuestos enable row level security;

drop policy if exists "centros_costo_select_internal" on public.centros_costo;
create policy "centros_costo_select_internal"
on public.centros_costo for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "centros_costo_insert_internal" on public.centros_costo;
create policy "centros_costo_insert_internal"
on public.centros_costo for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "centros_costo_update_internal" on public.centros_costo;
create policy "centros_costo_update_internal"
on public.centros_costo for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

drop policy if exists "presupuestos_select_internal" on public.presupuestos;
create policy "presupuestos_select_internal"
on public.presupuestos for select
to authenticated
using (public.is_internal_org_member(organization_id));

drop policy if exists "presupuestos_insert_internal" on public.presupuestos;
create policy "presupuestos_insert_internal"
on public.presupuestos for insert
to authenticated
with check (public.is_internal_org_member(organization_id));

drop policy if exists "presupuestos_update_internal" on public.presupuestos;
create policy "presupuestos_update_internal"
on public.presupuestos for update
to authenticated
using (public.is_internal_org_member(organization_id))
with check (public.is_internal_org_member(organization_id));

grant execute on function public.get_presupuesto_vs_contabilidad(uuid, uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
