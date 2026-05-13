drop function if exists public.get_dashboard_contable_ejecutivo(uuid, date, date);
drop function if exists public.get_alertas_contables(uuid, date, date);

create or replace function public.get_alertas_contables(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  alerta_tipo text,
  severidad text,
  titulo text,
  descripcion text,
  cantidad integer,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with resumen_financiero as (
    select *
    from public.get_resumen_financiero(p_organization_id, p_fecha_desde, p_fecha_hasta)
  ),
  asientos as (
    select
      count(*) filter (where estado = 'borrador')::integer as borradores,
      count(*) filter (where estado = 'anulado')::integer as anulados
    from public.asientos_contables
    where organization_id = p_organization_id
      and (p_fecha_desde is null or fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or fecha <= p_fecha_hasta)
  ),
  saldos_contrarios as (
    select count(*)::integer as total
    from public.get_saldos_contables(p_organization_id, p_fecha_desde, p_fecha_hasta, null)
    where tipo_cuenta = 'detalle'
      and tiene_saldo_contrario is true
  ),
  documentos as (
    select
      (
        (select count(*) from public.purchases item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or coalesce(item.purchase_date, item.created_at::date) >= p_fecha_desde)
            and (p_fecha_hasta is null or coalesce(item.purchase_date, item.created_at::date) <= p_fecha_hasta))
        + (select count(*) from public.invoices item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or coalesce(item.fecha, item.created_at::date) >= p_fecha_desde)
            and (p_fecha_hasta is null or coalesce(item.fecha, item.created_at::date) <= p_fecha_hasta))
        + (select count(*) from public.purchase_payments item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.payment_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.payment_date <= p_fecha_hasta))
        + (select count(*) from public.invoice_collections item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.collection_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.collection_date <= p_fecha_hasta))
        + (select count(*) from public.cash_bank_transfers item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.transfer_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.transfer_date <= p_fecha_hasta))
        + (select count(*) from public.planillas item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.periodo_hasta >= p_fecha_desde)
            and (p_fecha_hasta is null or item.periodo_desde <= p_fecha_hasta))
        + (select count(*) from public.subcontratos_pagos item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.fecha_pago >= p_fecha_desde)
            and (p_fecha_hasta is null or item.fecha_pago <= p_fecha_hasta))
      )::integer as pendientes,
      (
        (select count(*) from public.purchases item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.invoices item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.purchase_payments item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.invoice_collections item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.cash_bank_transfers item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.planillas item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
        + (select count(*) from public.subcontratos_pagos item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error')
      )::integer as errores
  ),
  reglas as (
    select
      (
        (case when not exists (
          select 1 from public.reglas_contables_compras regla
          where regla.activa is true
            and (regla.organization_id = p_organization_id or regla.organization_id is null)
        ) then 1 else 0 end)
        + (case when not exists (
          select 1 from public.reglas_contables_facturas regla
          where regla.activa is true
            and (regla.organization_id = p_organization_id or regla.organization_id is null)
        ) then 1 else 0 end)
        + (case when not exists (
          select 1 from public.reglas_contables_caja regla
          where regla.activa is true
            and (regla.organization_id = p_organization_id or regla.organization_id is null)
        ) then 1 else 0 end)
        + (case when not exists (
          select 1 from public.reglas_contables_planillas regla
          where regla.activa is true
            and (regla.organization_id = p_organization_id or regla.organization_id is null)
        ) then 1 else 0 end)
        + (case when not exists (
          select 1 from public.reglas_contables_subcontratos regla
          where regla.activa is true
            and (regla.organization_id = p_organization_id or regla.organization_id is null)
        ) then 1 else 0 end)
      )::integer as faltantes
  ),
  alertas as (
    select
      p_organization_id as organization_id,
      'balance_no_cuadra'::text as alerta_tipo,
      'error'::text as severidad,
      'Balance no cuadra'::text as titulo,
      'La diferencia del balance debe revisarse antes de cierre.'::text as descripcion,
      1::integer as cantidad,
      jsonb_build_object('diferencia_balance', resumen_financiero.diferencia_balance) as metadata
    from resumen_financiero
    where resumen_financiero.balance_cuadra is false
    union all
    select p_organization_id, 'asientos_borrador', 'atencion',
      'Asientos borrador pendientes',
      'Hay asientos reales en borrador que no impactan reportes oficiales.',
      asientos.borradores,
      jsonb_build_object('estado', 'borrador')
    from asientos
    where asientos.borradores > 0
    union all
    select p_organization_id, 'documentos_sin_contabilizar', 'pendiente',
      'Documentos sin contabilizar',
      'Existen registros operativos pendientes de asiento oficial.',
      documentos.pendientes,
      jsonb_build_object('estado_contable', 'pendiente')
    from documentos
    where documentos.pendientes > 0
    union all
    select p_organization_id, 'errores_contabilizacion', 'error',
      'Errores de contabilizacion',
      'Hay documentos con estado_contable = error.',
      documentos.errores,
      jsonb_build_object('estado_contable', 'error')
    from documentos
    where documentos.errores > 0
    union all
    select p_organization_id, 'saldos_contrarios', 'atencion',
      'Cuentas con saldo contrario',
      'Hay cuentas detalle con saldo contrario a su naturaleza.',
      saldos_contrarios.total,
      jsonb_build_object('fuente', 'get_saldos_contables')
    from saldos_contrarios
    where saldos_contrarios.total > 0
    union all
    select p_organization_id, 'reglas_faltantes', 'atencion',
      'Reglas contables faltantes',
      'Faltan reglas activas globales u organizacionales para algun modulo.',
      reglas.faltantes,
      jsonb_build_object('modulos_evaluados', jsonb_build_array('compras', 'facturas', 'caja', 'planillas', 'subcontratos'))
    from reglas
    where reglas.faltantes > 0
  )
  select *
  from alertas
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role'
  order by
    case severidad
      when 'error' then 0
      when 'atencion' then 1
      when 'pendiente' then 2
      else 3
    end,
    cantidad desc,
    alerta_tipo;
$$;

create or replace function public.get_dashboard_contable_ejecutivo(
  p_organization_id uuid,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  organization_id uuid,
  total_activos numeric,
  total_pasivos numeric,
  total_patrimonio numeric,
  utilidad_neta numeric,
  total_ingresos numeric,
  total_costos numeric,
  total_gastos numeric,
  flujo_neto numeric,
  saldo_final_efectivo numeric,
  balance_cuadra boolean,
  diferencia_balance numeric,
  asientos_borrador integer,
  asientos_contabilizados integer,
  asientos_anulados integer,
  compras_pendientes_contables integer,
  compras_contabilizadas_contables integer,
  compras_errores_contables integer,
  facturas_pendientes_contables integer,
  facturas_contabilizadas_contables integer,
  facturas_errores_contables integer,
  caja_pendiente_contable integer,
  caja_contabilizada_contable integer,
  caja_errores_contable integer,
  planillas_pendientes_contables integer,
  planillas_contabilizadas_contables integer,
  planillas_errores_contables integer,
  subcontratos_pendientes_contables integer,
  subcontratos_contabilizados_contables integer,
  subcontratos_errores_contables integer,
  total_pendientes_contables integer,
  saldos_contrarios_count integer,
  alertas_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with resumen_financiero as (
    select *
    from public.get_resumen_financiero(p_organization_id, p_fecha_desde, p_fecha_hasta)
  ),
  resumen_flujo as (
    select *
    from public.get_resumen_flujo_efectivo(p_organization_id, p_fecha_desde, p_fecha_hasta)
  ),
  asientos as (
    select
      count(*) filter (where estado = 'borrador')::integer as borrador,
      count(*) filter (where estado = 'contabilizado')::integer as contabilizados,
      count(*) filter (where estado = 'anulado')::integer as anulados
    from public.asientos_contables
    where organization_id = p_organization_id
      and (p_fecha_desde is null or fecha >= p_fecha_desde)
      and (p_fecha_hasta is null or fecha <= p_fecha_hasta)
  ),
  pendientes as (
    select
      (select count(*)::integer from public.purchases item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
          and (p_fecha_desde is null or coalesce(item.purchase_date, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.purchase_date, item.created_at::date) <= p_fecha_hasta)
      ) as compras,
      (select count(*)::integer from public.purchases item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
          and (p_fecha_desde is null or coalesce(item.purchase_date, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.purchase_date, item.created_at::date) <= p_fecha_hasta)
      ) as compras_contabilizadas,
      (select count(*)::integer from public.purchases item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'error'
          and (p_fecha_desde is null or coalesce(item.purchase_date, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.purchase_date, item.created_at::date) <= p_fecha_hasta)
      ) as compras_errores,
      (select count(*)::integer from public.invoices item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
          and (p_fecha_desde is null or coalesce(item.fecha, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.fecha, item.created_at::date) <= p_fecha_hasta)
      ) as facturas,
      (select count(*)::integer from public.invoices item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
          and (p_fecha_desde is null or coalesce(item.fecha, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.fecha, item.created_at::date) <= p_fecha_hasta)
      ) as facturas_contabilizadas,
      (select count(*)::integer from public.invoices item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'error'
          and (p_fecha_desde is null or coalesce(item.fecha, item.created_at::date) >= p_fecha_desde)
          and (p_fecha_hasta is null or coalesce(item.fecha, item.created_at::date) <= p_fecha_hasta)
      ) as facturas_errores,
      (
        (select count(*) from public.purchase_payments item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.payment_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.payment_date <= p_fecha_hasta))
        + (select count(*) from public.invoice_collections item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.collection_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.collection_date <= p_fecha_hasta))
        + (select count(*) from public.cash_bank_transfers item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
            and (p_fecha_desde is null or item.transfer_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.transfer_date <= p_fecha_hasta))
      )::integer as caja,
      (
        (select count(*) from public.purchase_payments item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
            and (p_fecha_desde is null or item.payment_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.payment_date <= p_fecha_hasta))
        + (select count(*) from public.invoice_collections item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
            and (p_fecha_desde is null or item.collection_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.collection_date <= p_fecha_hasta))
        + (select count(*) from public.cash_bank_transfers item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
            and (p_fecha_desde is null or item.transfer_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.transfer_date <= p_fecha_hasta))
      )::integer as caja_contabilizada,
      (
        (select count(*) from public.purchase_payments item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error'
            and (p_fecha_desde is null or item.payment_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.payment_date <= p_fecha_hasta))
        + (select count(*) from public.invoice_collections item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error'
            and (p_fecha_desde is null or item.collection_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.collection_date <= p_fecha_hasta))
        + (select count(*) from public.cash_bank_transfers item
          where item.organization_id = p_organization_id
            and coalesce(item.estado_contable, 'pendiente') = 'error'
            and (p_fecha_desde is null or item.transfer_date >= p_fecha_desde)
            and (p_fecha_hasta is null or item.transfer_date <= p_fecha_hasta))
      )::integer as caja_errores,
      (select count(*)::integer from public.planillas item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
          and (p_fecha_desde is null or item.periodo_hasta >= p_fecha_desde)
          and (p_fecha_hasta is null or item.periodo_desde <= p_fecha_hasta)
      ) as planillas,
      (select count(*)::integer from public.planillas item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
          and (p_fecha_desde is null or item.periodo_hasta >= p_fecha_desde)
          and (p_fecha_hasta is null or item.periodo_desde <= p_fecha_hasta)
      ) as planillas_contabilizadas,
      (select count(*)::integer from public.planillas item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'error'
          and (p_fecha_desde is null or item.periodo_hasta >= p_fecha_desde)
          and (p_fecha_hasta is null or item.periodo_desde <= p_fecha_hasta)
      ) as planillas_errores,
      (select count(*)::integer from public.subcontratos_pagos item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') not in ('contabilizado', 'anulado')
          and (p_fecha_desde is null or item.fecha_pago >= p_fecha_desde)
          and (p_fecha_hasta is null or item.fecha_pago <= p_fecha_hasta)
      ) as subcontratos
      ,
      (select count(*)::integer from public.subcontratos_pagos item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'contabilizado'
          and (p_fecha_desde is null or item.fecha_pago >= p_fecha_desde)
          and (p_fecha_hasta is null or item.fecha_pago <= p_fecha_hasta)
      ) as subcontratos_contabilizados,
      (select count(*)::integer from public.subcontratos_pagos item
        where item.organization_id = p_organization_id
          and coalesce(item.estado_contable, 'pendiente') = 'error'
          and (p_fecha_desde is null or item.fecha_pago >= p_fecha_desde)
          and (p_fecha_hasta is null or item.fecha_pago <= p_fecha_hasta)
      ) as subcontratos_errores
  ),
  saldos_contrarios as (
    select count(*)::integer as total
    from public.get_saldos_contables(p_organization_id, p_fecha_desde, p_fecha_hasta, null)
    where tipo_cuenta = 'detalle'
      and tiene_saldo_contrario is true
  ),
  alertas as (
    select count(*)::integer as total
    from public.get_alertas_contables(p_organization_id, p_fecha_desde, p_fecha_hasta)
  )
  select
    p_organization_id,
    resumen_financiero.total_activos,
    resumen_financiero.total_pasivos,
    resumen_financiero.total_patrimonio,
    resumen_financiero.utilidad_neta,
    resumen_financiero.total_ingresos,
    resumen_financiero.total_costos,
    resumen_financiero.total_gastos,
    resumen_flujo.flujo_neto,
    resumen_flujo.saldo_final as saldo_final_efectivo,
    resumen_financiero.balance_cuadra,
    resumen_financiero.diferencia_balance,
    asientos.borrador,
    asientos.contabilizados,
    asientos.anulados,
    pendientes.compras,
    pendientes.compras_contabilizadas,
    pendientes.compras_errores,
    pendientes.facturas,
    pendientes.facturas_contabilizadas,
    pendientes.facturas_errores,
    pendientes.caja,
    pendientes.caja_contabilizada,
    pendientes.caja_errores,
    pendientes.planillas,
    pendientes.planillas_contabilizadas,
    pendientes.planillas_errores,
    pendientes.subcontratos,
    pendientes.subcontratos_contabilizados,
    pendientes.subcontratos_errores,
    pendientes.compras
      + pendientes.facturas
      + pendientes.caja
      + pendientes.planillas
      + pendientes.subcontratos,
    saldos_contrarios.total,
    alertas.total
  from resumen_financiero
  cross join resumen_flujo
  cross join asientos
  cross join pendientes
  cross join saldos_contrarios
  cross join alertas
  where public.is_internal_org_member(p_organization_id)
    or coalesce(auth.role(), '') = 'service_role';
$$;

grant execute on function public.get_alertas_contables(uuid, date, date) to authenticated;
grant execute on function public.get_dashboard_contable_ejecutivo(uuid, date, date) to authenticated;
