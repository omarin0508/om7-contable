create or replace function public.get_flujo_efectivo(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  fecha date,
  modulo_origen text,
  referencia text,
  asiento_id uuid,
  numero_asiento bigint,
  descripcion text,
  cuenta_efectivo_id uuid,
  codigo_cuenta text,
  nombre_cuenta text,
  entrada numeric,
  salida numeric,
  flujo_neto numeric,
  clasificacion_flujo text,
  saldo_acumulado numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with movimientos_efectivo as (
    select
      asiento.organization_id,
      asiento.fecha,
      asiento.modulo_origen,
      asiento.referencia,
      asiento.id as asiento_id,
      asiento.numero_asiento,
      asiento.descripcion,
      cuenta.id as cuenta_efectivo_id,
      cuenta.codigo as codigo_cuenta,
      cuenta.nombre as nombre_cuenta,
      linea.id as asiento_linea_id,
      coalesce(linea.debito, 0) as entrada,
      coalesce(linea.credito, 0) as salida,
      coalesce(linea.debito, 0) - coalesce(linea.credito, 0) as flujo_neto,
      case
        when asiento.modulo_origen = 'caja_chica'
          and asiento.metadata ->> 'source_type' = 'invoice_collection'
          then 'cobros_clientes'
        when asiento.modulo_origen = 'caja_chica'
          and asiento.metadata ->> 'source_type' = 'purchase_payment'
          then 'pagos_proveedores'
        when asiento.modulo_origen = 'caja_chica'
          and asiento.metadata ->> 'source_type' = 'cash_bank_transfer'
          then 'transferencias'
        when asiento.modulo_origen = 'planillas'
          then 'pagos_planilla'
        when asiento.modulo_origen = 'subcontratos'
          then 'pagos_subcontratos'
        when asiento.modulo_origen = 'facturas'
          and coalesce(linea.debito, 0) > coalesce(linea.credito, 0)
          then 'cobros_clientes'
        when asiento.modulo_origen = 'compras'
          and coalesce(linea.credito, 0) > coalesce(linea.debito, 0)
          then 'pagos_proveedores'
        when asiento.modulo_origen = 'ajustes'
          then 'ajustes'
        when coalesce(linea.debito, 0) > coalesce(linea.credito, 0)
          then 'otros_ingresos'
        else 'otros_egresos'
      end as clasificacion_flujo
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and (p_fecha_hasta is null or asiento.fecha <= p_fecha_hasta)
      and cuenta.categoria = 'activo'
      and cuenta.tipo_cuenta = 'detalle'
      and cuenta.permite_movimientos is true
      and (
        cuenta.codigo = '1.1.1'
        or cuenta.codigo like '1.1.1.%'
        or lower(coalesce(cuenta.metadata ->> 'tipo', '')) in ('efectivo', 'caja', 'banco')
        or lower(coalesce(cuenta.metadata ->> 'tipo_cuenta', '')) in ('efectivo', 'caja', 'banco')
        or lower(coalesce(cuenta.metadata ->> 'cash_equivalent', '')) = 'true'
        or lower(coalesce(cuenta.metadata ->> 'es_efectivo', '')) = 'true'
      )
  ),
  movimientos_con_saldo as (
    select
      movimientos_efectivo.*,
      sum(movimientos_efectivo.flujo_neto) over (
        partition by movimientos_efectivo.organization_id
        order by
          movimientos_efectivo.fecha,
          movimientos_efectivo.numero_asiento,
          movimientos_efectivo.asiento_id,
          movimientos_efectivo.asiento_linea_id
        rows between unbounded preceding and current row
      ) as saldo_acumulado
    from movimientos_efectivo
  )
  select
    movimientos_con_saldo.organization_id,
    movimientos_con_saldo.fecha,
    movimientos_con_saldo.modulo_origen,
    movimientos_con_saldo.referencia,
    movimientos_con_saldo.asiento_id,
    movimientos_con_saldo.numero_asiento,
    movimientos_con_saldo.descripcion,
    movimientos_con_saldo.cuenta_efectivo_id,
    movimientos_con_saldo.codigo_cuenta,
    movimientos_con_saldo.nombre_cuenta,
    movimientos_con_saldo.entrada,
    movimientos_con_saldo.salida,
    movimientos_con_saldo.flujo_neto,
    movimientos_con_saldo.clasificacion_flujo,
    movimientos_con_saldo.saldo_acumulado
  from movimientos_con_saldo
  where (p_fecha_desde is null or movimientos_con_saldo.fecha >= p_fecha_desde)
    and (
      public.is_internal_org_member(p_organization_id)
      or coalesce(auth.role(), '') = 'service_role'
    )
  order by
    movimientos_con_saldo.fecha,
    movimientos_con_saldo.numero_asiento,
    movimientos_con_saldo.asiento_id,
    movimientos_con_saldo.asiento_linea_id;
$$;

create or replace function public.get_resumen_flujo_efectivo(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  total_entradas numeric,
  total_salidas numeric,
  flujo_neto numeric,
  saldo_inicial numeric,
  saldo_final numeric,
  cobros_clientes numeric,
  pagos_proveedores numeric,
  pagos_planilla numeric,
  pagos_subcontratos numeric,
  transferencias_neto numeric,
  otros_neto numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with saldo_inicial as (
    select
      coalesce(sum(coalesce(linea.debito, 0) - coalesce(linea.credito, 0)), 0) as saldo
    from public.asiento_lineas linea
    join public.asientos_contables asiento on asiento.id = linea.asiento_id
    join public.cuentas_contables cuenta on cuenta.id = linea.cuenta_contable_id
    where asiento.estado = 'contabilizado'
      and asiento.organization_id = p_organization_id
      and p_fecha_desde is not null
      and asiento.fecha < p_fecha_desde
      and cuenta.categoria = 'activo'
      and cuenta.tipo_cuenta = 'detalle'
      and cuenta.permite_movimientos is true
      and (
        cuenta.codigo = '1.1.1'
        or cuenta.codigo like '1.1.1.%'
        or lower(coalesce(cuenta.metadata ->> 'tipo', '')) in ('efectivo', 'caja', 'banco')
        or lower(coalesce(cuenta.metadata ->> 'tipo_cuenta', '')) in ('efectivo', 'caja', 'banco')
        or lower(coalesce(cuenta.metadata ->> 'cash_equivalent', '')) = 'true'
        or lower(coalesce(cuenta.metadata ->> 'es_efectivo', '')) = 'true'
      )
  ),
  flujo_periodo as (
    select *
    from public.get_flujo_efectivo(p_organization_id, p_fecha_desde, p_fecha_hasta)
  ),
  resumen as (
    select
      coalesce(sum(entrada), 0) as total_entradas,
      coalesce(sum(salida), 0) as total_salidas,
      coalesce(sum(flujo_neto), 0) as flujo_neto,
      coalesce(sum(entrada) filter (where clasificacion_flujo = 'cobros_clientes'), 0) as cobros_clientes,
      coalesce(sum(salida - entrada) filter (where clasificacion_flujo = 'pagos_proveedores'), 0) as pagos_proveedores,
      coalesce(sum(salida - entrada) filter (where clasificacion_flujo = 'pagos_planilla'), 0) as pagos_planilla,
      coalesce(sum(salida - entrada) filter (where clasificacion_flujo = 'pagos_subcontratos'), 0) as pagos_subcontratos,
      coalesce(sum(flujo_neto) filter (where clasificacion_flujo = 'transferencias'), 0) as transferencias_neto,
      coalesce(sum(flujo_neto) filter (
        where clasificacion_flujo in ('otros_ingresos', 'otros_egresos', 'ajustes')
      ), 0) as otros_neto
    from flujo_periodo
  )
  select
    p_organization_id,
    resumen.total_entradas,
    resumen.total_salidas,
    resumen.flujo_neto,
    saldo_inicial.saldo,
    saldo_inicial.saldo + resumen.flujo_neto,
    resumen.cobros_clientes,
    resumen.pagos_proveedores,
    resumen.pagos_planilla,
    resumen.pagos_subcontratos,
    resumen.transferencias_neto,
    resumen.otros_neto
  from resumen
  cross join saldo_inicial
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role';
$$;

grant execute on function public.get_flujo_efectivo(uuid, date, date) to authenticated;
grant execute on function public.get_resumen_flujo_efectivo(uuid, date, date) to authenticated;
