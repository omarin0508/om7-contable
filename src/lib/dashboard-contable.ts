import { getActiveContext } from "@/lib/active-context";
import { normalizeCurrencyCode } from "@/lib/currency";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type DashboardContableFilters = {
  organizationId?: string;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
};

export type DashboardContableContext = {
  organizationId: string;
  organizationName: string;
  moneda: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
};

export type DashboardContableEjecutivo = {
  organization_id: string;
  total_activos: number;
  total_pasivos: number;
  total_patrimonio: number;
  utilidad_neta: number;
  total_ingresos: number;
  total_costos: number;
  total_gastos: number;
  flujo_neto: number;
  saldo_final_efectivo: number;
  balance_cuadra: boolean;
  diferencia_balance: number;
  asientos_borrador: number;
  asientos_contabilizados: number;
  asientos_anulados: number;
  compras_pendientes_contables: number;
  compras_contabilizadas_contables: number;
  compras_errores_contables: number;
  facturas_pendientes_contables: number;
  facturas_contabilizadas_contables: number;
  facturas_errores_contables: number;
  caja_pendiente_contable: number;
  caja_contabilizada_contable: number;
  caja_errores_contable: number;
  planillas_pendientes_contables: number;
  planillas_contabilizadas_contables: number;
  planillas_errores_contables: number;
  subcontratos_pendientes_contables: number;
  subcontratos_contabilizados_contables: number;
  subcontratos_errores_contables: number;
  total_pendientes_contables: number;
  saldos_contrarios_count: number;
  alertas_count: number;
};

export type AlertaContable = {
  organization_id: string;
  alerta_tipo: string;
  severidad: "ok" | "pendiente" | "atencion" | "error" | string;
  titulo: string;
  descripcion: string;
  cantidad: number;
  metadata: Record<string, unknown> | null;
};

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuario no autenticado.");
  }

  return supabase;
}

async function resolveContext(
  filters: DashboardContableFilters,
): Promise<DashboardContableContext> {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const organizationId = filters.organizationId ?? activeContext.organization?.id;

  if (!organizationId) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return {
    fechaDesde: filters.fechaDesde ?? null,
    fechaHasta: filters.fechaHasta ?? null,
    moneda: normalizeCurrencyCode(
      activeContext.activeCompany?.base_currency ??
        activeContext.organization?.base_currency ??
        "CRC",
    ),
    organizationId,
    organizationName:
      activeContext.organization?.id === organizationId
        ? activeContext.organization.name
        : "Organizacion OM7",
  };
}

function getRpcParams(filters: DashboardContableFilters, organizationId: string) {
  return {
    p_fecha_desde: filters.fechaDesde || null,
    p_fecha_hasta: filters.fechaHasta || null,
    p_organization_id: organizationId,
  };
}

function getEmptyDashboard(
  organizationId: string,
): DashboardContableEjecutivo {
  return {
    alertas_count: 0,
    asientos_anulados: 0,
    asientos_borrador: 0,
    asientos_contabilizados: 0,
    balance_cuadra: true,
    caja_contabilizada_contable: 0,
    caja_errores_contable: 0,
    caja_pendiente_contable: 0,
    compras_contabilizadas_contables: 0,
    compras_errores_contables: 0,
    compras_pendientes_contables: 0,
    diferencia_balance: 0,
    facturas_contabilizadas_contables: 0,
    facturas_errores_contables: 0,
    facturas_pendientes_contables: 0,
    flujo_neto: 0,
    organization_id: organizationId,
    planillas_contabilizadas_contables: 0,
    planillas_errores_contables: 0,
    planillas_pendientes_contables: 0,
    saldo_final_efectivo: 0,
    saldos_contrarios_count: 0,
    subcontratos_contabilizados_contables: 0,
    subcontratos_errores_contables: 0,
    subcontratos_pendientes_contables: 0,
    total_activos: 0,
    total_costos: 0,
    total_gastos: 0,
    total_ingresos: 0,
    total_pendientes_contables: 0,
    total_pasivos: 0,
    total_patrimonio: 0,
    utilidad_neta: 0,
  };
}

export async function getDashboardContableEjecutivo(
  filters: DashboardContableFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(filters);
  const { data, error } = await supabase.rpc(
    "get_dashboard_contable_ejecutivo",
    getRpcParams(filters, context.organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DashboardContableEjecutivo[];

  return {
    context,
    resumen: rows[0] ?? getEmptyDashboard(context.organizationId),
  };
}

export async function getAlertasContables(
  filters: DashboardContableFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(filters);
  const { data, error } = await supabase.rpc(
    "get_alertas_contables",
    getRpcParams(filters, context.organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    alertas: (data ?? []) as AlertaContable[],
    context,
  };
}
