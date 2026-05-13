create or replace view public.vw_mayor_general as
select
  asiento.organization_id,
  asiento.id as asiento_id,
  linea.id as asiento_linea_id,
  asiento.fecha,
  asiento.numero_asiento,
  asiento.descripcion as descripcion_asiento,
  linea.descripcion as descripcion_linea,
  asiento.modulo_origen,
  asiento.referencia,
  cuenta.id as cuenta_contable_id,
  cuenta.codigo,
  cuenta.nombre,
  cuenta.naturaleza,
  linea.debito,
  linea.credito,
  case
    when cuenta.naturaleza = 'deudora' then linea.debito - linea.credito
    else linea.credito - linea.debito
  end as saldo_movimiento_natural,
  sum(
    case
      when cuenta.naturaleza = 'deudora' then linea.debito - linea.credito
      else linea.credito - linea.debito
    end
  ) over (
    partition by asiento.organization_id, cuenta.id
    order by asiento.fecha, asiento.numero_asiento, linea.created_at, linea.id
    rows between unbounded preceding and current row
  ) as saldo_acumulado_natural
from public.asiento_lineas linea
join public.asientos_contables asiento on asiento.id = linea.asiento_id
join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
where asiento.estado = 'contabilizado';

create or replace view public.vw_saldos_contables as
with movimientos as (
  select
    asiento.organization_id,
    cuenta.id as cuenta_contable_id,
    cuenta.codigo,
    cuenta.nombre,
    cuenta.categoria,
    cuenta.tipo_estado,
    cuenta.naturaleza,
    cuenta.tipo_cuenta,
    cuenta.nivel,
    cuenta.cuenta_padre_id,
    sum(linea.debito) as total_debito,
    sum(linea.credito) as total_credito
  from public.asiento_lineas linea
  join public.asientos_contables asiento on asiento.id = linea.asiento_id
  join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
  where asiento.estado = 'contabilizado'
  group by
    asiento.organization_id,
    cuenta.id,
    cuenta.codigo,
    cuenta.nombre,
    cuenta.categoria,
    cuenta.tipo_estado,
    cuenta.naturaleza,
    cuenta.tipo_cuenta,
    cuenta.nivel,
    cuenta.cuenta_padre_id
)
select
  organization_id,
  cuenta_contable_id,
  codigo,
  nombre,
  categoria,
  tipo_estado,
  naturaleza,
  tipo_cuenta,
  nivel,
  cuenta_padre_id,
  total_debito,
  total_credito,
  greatest(total_debito - total_credito, 0) as saldo_deudor,
  greatest(total_credito - total_debito, 0) as saldo_acreedor,
  case
    when naturaleza = 'deudora' then total_debito - total_credito
    else total_credito - total_debito
  end as saldo_natural,
  case
    when total_debito = total_credito then 'cero'
    when total_debito > total_credito then 'deudor'
    else 'acreedor'
  end as tipo_saldo_resultante,
  case
    when total_debito = total_credito then false
    when naturaleza = 'deudora' and total_credito > total_debito then true
    when naturaleza = 'acreedora' and total_debito > total_credito then true
    else false
  end as tiene_saldo_contrario
from movimientos;

create or replace view public.vw_balance_comprobacion as
select
  organization_id,
  codigo,
  nombre,
  categoria,
  tipo_estado,
  naturaleza,
  total_debito,
  total_credito,
  saldo_deudor,
  saldo_acreedor,
  saldo_natural,
  sum(total_debito) over (partition by organization_id) as total_debito_balance,
  sum(total_credito) over (partition by organization_id) as total_credito_balance,
  sum(total_debito - total_credito) over (partition by organization_id) as diferencia_balance
from public.vw_saldos_contables
where tipo_cuenta = 'detalle'
  and (total_debito <> 0 or total_credito <> 0);

create or replace view public.vw_saldos_contables_jerarquia as
with recursive account_tree as (
  select
    cuenta.id as ancestor_id,
    cuenta.id as descendant_id
  from public.cuentas_contables cuenta
  union all
  select
    parent.ancestor_id,
    child.id as descendant_id
  from account_tree parent
  join public.cuentas_contables child on child.cuenta_padre_id = parent.descendant_id
),
movimientos as (
  select
    asiento.organization_id,
    linea.cuenta_contable_id,
    sum(linea.debito) as total_debito,
    sum(linea.credito) as total_credito
  from public.asiento_lineas linea
  join public.asientos_contables asiento on asiento.id = linea.asiento_id
  where asiento.estado = 'contabilizado'
  group by asiento.organization_id, linea.cuenta_contable_id
),
acumulado as (
  select
    movimientos.organization_id,
    account_tree.ancestor_id as cuenta_contable_id,
    sum(movimientos.total_debito) as total_debito,
    sum(movimientos.total_credito) as total_credito
  from movimientos
  join account_tree on account_tree.descendant_id = movimientos.cuenta_contable_id
  group by movimientos.organization_id, account_tree.ancestor_id
)
select
  acumulado.organization_id,
  cuenta.id as cuenta_contable_id,
  cuenta.codigo,
  cuenta.nombre,
  cuenta.categoria,
  cuenta.tipo_estado,
  cuenta.naturaleza,
  cuenta.tipo_cuenta,
  cuenta.nivel,
  cuenta.cuenta_padre_id,
  acumulado.total_debito,
  acumulado.total_credito,
  greatest(acumulado.total_debito - acumulado.total_credito, 0) as saldo_deudor,
  greatest(acumulado.total_credito - acumulado.total_debito, 0) as saldo_acreedor,
  case
    when cuenta.naturaleza = 'deudora' then acumulado.total_debito - acumulado.total_credito
    else acumulado.total_credito - acumulado.total_debito
  end as saldo_natural,
  case
    when acumulado.total_debito = acumulado.total_credito then 'cero'
    when acumulado.total_debito > acumulado.total_credito then 'deudor'
    else 'acreedor'
  end as tipo_saldo_resultante,
  case
    when acumulado.total_debito = acumulado.total_credito then false
    when cuenta.naturaleza = 'deudora' and acumulado.total_credito > acumulado.total_debito then true
    when cuenta.naturaleza = 'acreedora' and acumulado.total_debito > acumulado.total_credito then true
    else false
  end as tiene_saldo_contrario
from acumulado
join public.cuentas_contables cuenta on cuenta.id = acumulado.cuenta_contable_id;

create or replace function public.get_saldos_contables(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_cuenta_id uuid default null
)
returns table (
  organization_id uuid,
  cuenta_contable_id uuid,
  codigo text,
  nombre text,
  categoria text,
  tipo_estado text,
  naturaleza text,
  tipo_cuenta text,
  nivel integer,
  cuenta_padre_id uuid,
  total_debito numeric,
  total_credito numeric,
  saldo_deudor numeric,
  saldo_acreedor numeric,
  saldo_natural numeric,
  tipo_saldo_resultante text,
  tiene_saldo_contrario boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with movimientos as (
    select
      asiento.organization_id,
      cuenta.id as cuenta_contable_id,
      cuenta.codigo,
      cuenta.nombre,
      cuenta.categoria,
      cuenta.tipo_estado,
      cuenta.naturaleza,
      cuenta.tipo_cuenta,
      cuenta.nivel,
      cuenta.cuenta_padre_id,
      sum(linea.debito) as total_debito,
      sum(linea.credito) as total_credito
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and (p_fecha_desde is null or asiento.fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
      and (p_cuenta_id is null or cuenta.id = p_cuenta_id)
    group by
      asiento.organization_id,
      cuenta.id,
      cuenta.codigo,
      cuenta.nombre,
      cuenta.categoria,
      cuenta.tipo_estado,
      cuenta.naturaleza,
      cuenta.tipo_cuenta,
      cuenta.nivel,
      cuenta.cuenta_padre_id
  )
  select
    movimientos.organization_id,
    movimientos.cuenta_contable_id,
    movimientos.codigo,
    movimientos.nombre,
    movimientos.categoria,
    movimientos.tipo_estado,
    movimientos.naturaleza,
    movimientos.tipo_cuenta,
    movimientos.nivel,
    movimientos.cuenta_padre_id,
    movimientos.total_debito,
    movimientos.total_credito,
    greatest(movimientos.total_debito - movimientos.total_credito, 0),
    greatest(movimientos.total_credito - movimientos.total_debito, 0),
    case
      when movimientos.naturaleza = 'deudora' then movimientos.total_debito - movimientos.total_credito
      else movimientos.total_credito - movimientos.total_debito
    end,
    case
      when movimientos.total_debito = movimientos.total_credito then 'cero'
      when movimientos.total_debito > movimientos.total_credito then 'deudor'
      else 'acreedor'
    end,
    case
      when movimientos.total_debito = movimientos.total_credito then false
      when movimientos.naturaleza = 'deudora' and movimientos.total_credito > movimientos.total_debito then true
      when movimientos.naturaleza = 'acreedora' and movimientos.total_debito > movimientos.total_credito then true
      else false
    end
  from movimientos
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role'
  order by movimientos.codigo;
$$;

create or replace function public.get_mayor_general(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_cuenta_id uuid default null
)
returns table (
  organization_id uuid,
  asiento_id uuid,
  asiento_linea_id uuid,
  fecha date,
  numero_asiento bigint,
  descripcion_asiento text,
  descripcion_linea text,
  modulo_origen text,
  referencia text,
  cuenta_contable_id uuid,
  codigo text,
  nombre text,
  naturaleza text,
  debito numeric,
  credito numeric,
  saldo_movimiento_natural numeric,
  saldo_acumulado_natural numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    select
      asiento.organization_id,
      asiento.id as asiento_id,
      linea.id as asiento_linea_id,
      asiento.fecha,
      asiento.numero_asiento,
      asiento.descripcion as descripcion_asiento,
      linea.descripcion as descripcion_linea,
      asiento.modulo_origen,
      asiento.referencia,
      cuenta.id as cuenta_contable_id,
      cuenta.codigo,
      cuenta.nombre,
      cuenta.naturaleza,
      linea.debito,
      linea.credito,
      case
        when cuenta.naturaleza = 'deudora' then linea.debito - linea.credito
        else linea.credito - linea.debito
      end as saldo_movimiento_natural,
      sum(
        case
          when cuenta.naturaleza = 'deudora' then linea.debito - linea.credito
          else linea.credito - linea.debito
        end
      ) over (
        partition by asiento.organization_id, cuenta.id
        order by asiento.fecha, asiento.numero_asiento, linea.created_at, linea.id
        rows between unbounded preceding and current row
      ) as saldo_acumulado_natural
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and (p_fecha_desde is null or asiento.fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
      and (p_cuenta_id is null or cuenta.id = p_cuenta_id)
  ) mayor
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role'
  order by organization_id, codigo, fecha, numero_asiento, asiento_linea_id;
$$;

create or replace function public.get_balance_comprobacion(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_cuenta_id uuid default null
)
returns table (
  organization_id uuid,
  codigo text,
  nombre text,
  categoria text,
  tipo_estado text,
  naturaleza text,
  total_debito numeric,
  total_credito numeric,
  saldo_deudor numeric,
  saldo_acreedor numeric,
  saldo_natural numeric,
  total_debito_balance numeric,
  total_credito_balance numeric,
  diferencia_balance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with saldos as (
    select *
    from public.get_saldos_contables(
      p_organization_id,
      p_fecha_desde,
      p_fecha_hasta,
      p_cuenta_id
    )
    where tipo_cuenta = 'detalle'
      and (total_debito <> 0 or total_credito <> 0)
  )
  select
    saldos.organization_id,
    saldos.codigo,
    saldos.nombre,
    saldos.categoria,
    saldos.tipo_estado,
    saldos.naturaleza,
    saldos.total_debito,
    saldos.total_credito,
    saldos.saldo_deudor,
    saldos.saldo_acreedor,
    saldos.saldo_natural,
    sum(saldos.total_debito) over (partition by saldos.organization_id),
    sum(saldos.total_credito) over (partition by saldos.organization_id),
    sum(saldos.total_debito - saldos.total_credito) over (partition by saldos.organization_id)
  from saldos
  order by saldos.codigo;
$$;

grant execute on function public.get_saldos_contables(uuid, date, date, uuid) to authenticated;
grant execute on function public.get_mayor_general(uuid, date, date, uuid) to authenticated;
grant execute on function public.get_balance_comprobacion(uuid, date, date, uuid) to authenticated;
