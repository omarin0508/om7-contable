create or replace function public.get_balance_general(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  codigo text,
  nombre text,
  categoria text,
  nivel integer,
  cuenta_padre_id uuid,
  tipo_cuenta text,
  naturaleza text,
  total_debito numeric,
  total_credito numeric,
  saldo_natural numeric,
  saldo_presentacion numeric,
  tipo_saldo_resultante text,
  tiene_saldo_contrario boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive account_tree as (
    select
      cuenta.id as ancestor_id,
      cuenta.id as descendant_id
    from public.cuentas_contables cuenta
    where cuenta.tipo_estado = 'BG'
      and (
        cuenta.organization_id is null
        or cuenta.organization_id = p_organization_id
      )
    union all
    select
      parent.ancestor_id,
      child.id as descendant_id
    from account_tree parent
    join public.cuentas_contables child on child.cuenta_padre_id = parent.descendant_id
  ),
  movimientos as (
    select
      linea.cuenta_contable_id,
      sum(linea.debito) as total_debito,
      sum(linea.credito) as total_credito
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and (p_fecha_desde is null or asiento.fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
    group by linea.cuenta_contable_id
  ),
  acumulado as (
    select
      account_tree.ancestor_id as cuenta_contable_id,
      coalesce(sum(movimientos.total_debito), 0) as total_debito,
      coalesce(sum(movimientos.total_credito), 0) as total_credito
    from account_tree
    left join movimientos on movimientos.cuenta_contable_id = account_tree.descendant_id
    group by account_tree.ancestor_id
  )
  select
    p_organization_id,
    cuenta.codigo,
    cuenta.nombre,
    cuenta.categoria,
    cuenta.nivel,
    cuenta.cuenta_padre_id,
    cuenta.tipo_cuenta,
    cuenta.naturaleza,
    acumulado.total_debito,
    acumulado.total_credito,
    case
      when cuenta.naturaleza = 'deudora' then acumulado.total_debito - acumulado.total_credito
      else acumulado.total_credito - acumulado.total_debito
    end as saldo_natural,
    case
      when cuenta.naturaleza = 'deudora' then acumulado.total_debito - acumulado.total_credito
      else acumulado.total_credito - acumulado.total_debito
    end as saldo_presentacion,
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
  from public.cuentas_contables cuenta
  join acumulado on acumulado.cuenta_contable_id = cuenta.id
  where cuenta.tipo_estado = 'BG'
    and (
      cuenta.organization_id is null
      or cuenta.organization_id = p_organization_id
    )
    and (
      public.is_internal_org_member(p_organization_id)
      or coalesce(auth.role(), '') = 'service_role'
    )
  order by cuenta.codigo;
$$;

create or replace function public.get_estado_resultados(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  codigo text,
  nombre text,
  categoria text,
  seccion text,
  nivel integer,
  cuenta_padre_id uuid,
  tipo_cuenta text,
  naturaleza text,
  total_debito numeric,
  total_credito numeric,
  saldo_natural numeric,
  saldo_presentacion numeric,
  total_ingresos numeric,
  total_costo_venta numeric,
  utilidad_bruta numeric,
  total_gastos_operativos numeric,
  utilidad_operativa numeric,
  productos_financieros numeric,
  otros_ingresos_gastos numeric,
  utilidad_neta numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive account_tree as (
    select
      cuenta.id as ancestor_id,
      cuenta.id as descendant_id
    from public.cuentas_contables cuenta
    where cuenta.tipo_estado = 'ER'
      and (
        cuenta.organization_id is null
        or cuenta.organization_id = p_organization_id
      )
    union all
    select
      parent.ancestor_id,
      child.id as descendant_id
    from account_tree parent
    join public.cuentas_contables child on child.cuenta_padre_id = parent.descendant_id
  ),
  movimientos as (
    select
      linea.cuenta_contable_id,
      sum(linea.debito) as total_debito,
      sum(linea.credito) as total_credito
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and (p_fecha_desde is null or asiento.fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
    group by linea.cuenta_contable_id
  ),
  acumulado as (
    select
      account_tree.ancestor_id as cuenta_contable_id,
      coalesce(sum(movimientos.total_debito), 0) as total_debito,
      coalesce(sum(movimientos.total_credito), 0) as total_credito
    from account_tree
    left join movimientos on movimientos.cuenta_contable_id = account_tree.descendant_id
    group by account_tree.ancestor_id
  ),
  rows_er as (
    select
      p_organization_id as organization_id,
      cuenta.codigo,
      cuenta.nombre,
      cuenta.categoria,
      case
        when cuenta.codigo like '4%' then 'ingresos'
        when cuenta.codigo like '5%' then 'costo_venta'
        when cuenta.codigo like '6%' then 'gastos_operativos'
        when cuenta.codigo like '7%' then 'productos_financieros'
        when cuenta.codigo like '8%' then 'otros_ingresos_gastos'
        else cuenta.categoria
      end as seccion,
      cuenta.nivel,
      cuenta.cuenta_padre_id,
      cuenta.tipo_cuenta,
      cuenta.naturaleza,
      acumulado.total_debito,
      acumulado.total_credito,
      case
        when cuenta.naturaleza = 'deudora' then acumulado.total_debito - acumulado.total_credito
        else acumulado.total_credito - acumulado.total_debito
      end as saldo_natural,
      case
        when cuenta.naturaleza = 'deudora' then acumulado.total_debito - acumulado.total_credito
        else acumulado.total_credito - acumulado.total_debito
      end as saldo_presentacion
    from public.cuentas_contables cuenta
    join acumulado on acumulado.cuenta_contable_id = cuenta.id
    where cuenta.tipo_estado = 'ER'
      and (
        cuenta.organization_id is null
        or cuenta.organization_id = p_organization_id
      )
  ),
  totals as (
    select
      coalesce(sum(saldo_presentacion) filter (where seccion = 'ingresos' and nivel = 1), 0) as total_ingresos,
      coalesce(sum(saldo_presentacion) filter (where seccion = 'costo_venta' and nivel = 1), 0) as total_costo_venta,
      coalesce(sum(saldo_presentacion) filter (where seccion = 'gastos_operativos' and nivel = 1), 0) as total_gastos_operativos,
      coalesce(sum(saldo_presentacion) filter (where seccion = 'productos_financieros' and nivel = 1), 0) as productos_financieros,
      coalesce(sum(saldo_presentacion) filter (where seccion = 'otros_ingresos_gastos' and nivel = 1), 0) as otros_ingresos_gastos
    from rows_er
  )
  select
    rows_er.organization_id,
    rows_er.codigo,
    rows_er.nombre,
    rows_er.categoria,
    rows_er.seccion,
    rows_er.nivel,
    rows_er.cuenta_padre_id,
    rows_er.tipo_cuenta,
    rows_er.naturaleza,
    rows_er.total_debito,
    rows_er.total_credito,
    rows_er.saldo_natural,
    rows_er.saldo_presentacion,
    totals.total_ingresos,
    totals.total_costo_venta,
    totals.total_ingresos - totals.total_costo_venta as utilidad_bruta,
    totals.total_gastos_operativos,
    totals.total_ingresos - totals.total_costo_venta - totals.total_gastos_operativos as utilidad_operativa,
    totals.productos_financieros,
    totals.otros_ingresos_gastos,
    totals.total_ingresos
      - totals.total_costo_venta
      - totals.total_gastos_operativos
      + totals.productos_financieros
      + totals.otros_ingresos_gastos as utilidad_neta
  from rows_er
  cross join totals
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role'
  order by rows_er.codigo;
$$;

create or replace function public.get_resumen_financiero(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  total_activos numeric,
  total_pasivos numeric,
  total_patrimonio numeric,
  diferencia_balance numeric,
  total_ingresos numeric,
  total_costos numeric,
  total_gastos numeric,
  utilidad_neta numeric,
  balance_cuadra boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with bg as (
    select *
    from public.get_balance_general(p_organization_id, p_fecha_desde, p_fecha_hasta)
    where nivel = 1
  ),
  er as (
    select *
    from public.get_estado_resultados(p_organization_id, p_fecha_desde, p_fecha_hasta)
    limit 1
  ),
  totals as (
    select
      coalesce((select saldo_presentacion from bg where categoria = 'activo' order by codigo limit 1), 0) as total_activos,
      coalesce((select saldo_presentacion from bg where categoria = 'pasivo' order by codigo limit 1), 0) as total_pasivos,
      coalesce((select saldo_presentacion from bg where categoria = 'patrimonio' order by codigo limit 1), 0) as total_patrimonio,
      coalesce((select total_ingresos from er), 0) as total_ingresos,
      coalesce((select total_costo_venta from er), 0) as total_costos,
      coalesce((select total_gastos_operativos from er), 0) as total_gastos,
      coalesce((select utilidad_neta from er), 0) as utilidad_neta
  )
  select
    p_organization_id,
    totals.total_activos,
    totals.total_pasivos,
    totals.total_patrimonio,
    totals.total_activos - totals.total_pasivos - totals.total_patrimonio as diferencia_balance,
    totals.total_ingresos,
    totals.total_costos,
    totals.total_gastos,
    totals.utilidad_neta,
    abs(totals.total_activos - totals.total_pasivos - totals.total_patrimonio) < 0.01
  from totals
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role';
$$;

grant execute on function public.get_balance_general(uuid, date, date) to authenticated;
grant execute on function public.get_estado_resultados(uuid, date, date) to authenticated;
grant execute on function public.get_resumen_financiero(uuid, date, date) to authenticated;
