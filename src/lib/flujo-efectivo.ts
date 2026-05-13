import { getActiveContext } from "@/lib/active-context";
import { normalizeCurrencyCode } from "@/lib/currency";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type FlujoEfectivoFilters = {
  organizationId?: string;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
};

export type FlujoEfectivoMovimiento = {
  organization_id: string;
  fecha: string;
  modulo_origen: string | null;
  referencia: string | null;
  asiento_id: string;
  numero_asiento: number;
  descripcion: string;
  cuenta_efectivo_id: string;
  codigo_cuenta: string;
  nombre_cuenta: string;
  entrada: number;
  salida: number;
  flujo_neto: number;
  clasificacion_flujo: string;
  saldo_acumulado: number;
};

export type ResumenFlujoEfectivo = {
  organization_id: string;
  total_entradas: number;
  total_salidas: number;
  flujo_neto: number;
  saldo_inicial: number;
  saldo_final: number;
  cobros_clientes: number;
  pagos_proveedores: number;
  pagos_planilla: number;
  pagos_subcontratos: number;
  transferencias_neto: number;
  otros_neto: number;
};

export type FlujoEfectivoContext = {
  organizationId: string;
  organizationName: string;
  moneda: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
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
  filters: FlujoEfectivoFilters,
): Promise<FlujoEfectivoContext> {
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

function getRpcParams(filters: FlujoEfectivoFilters, organizationId: string) {
  return {
    p_fecha_desde: filters.fechaDesde || null,
    p_fecha_hasta: filters.fechaHasta || null,
    p_organization_id: organizationId,
  };
}

export async function getFlujoEfectivo(filters: FlujoEfectivoFilters = {}) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(filters);
  const { data, error } = await supabase.rpc(
    "get_flujo_efectivo",
    getRpcParams(filters, context.organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    context,
    movimientos: (data ?? []) as FlujoEfectivoMovimiento[],
  };
}

export async function getResumenFlujoEfectivo(
  filters: FlujoEfectivoFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(filters);
  const { data, error } = await supabase.rpc(
    "get_resumen_flujo_efectivo",
    getRpcParams(filters, context.organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ResumenFlujoEfectivo[];

  return {
    context,
    resumen:
      rows[0] ??
      ({
        cobros_clientes: 0,
        flujo_neto: 0,
        organization_id: context.organizationId,
        otros_neto: 0,
        pagos_planilla: 0,
        pagos_proveedores: 0,
        pagos_subcontratos: 0,
        saldo_final: 0,
        saldo_inicial: 0,
        total_entradas: 0,
        total_salidas: 0,
        transferencias_neto: 0,
      } satisfies ResumenFlujoEfectivo),
  };
}
