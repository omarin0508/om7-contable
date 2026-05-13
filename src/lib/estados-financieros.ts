import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type EstadoFinancieroFilters = {
  organizationId?: string;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
};

export type BalanceGeneralRow = {
  organization_id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  nivel: number;
  cuenta_padre_id: string | null;
  tipo_cuenta: string;
  naturaleza: string;
  total_debito: number;
  total_credito: number;
  saldo_natural: number;
  saldo_presentacion: number;
  tipo_saldo_resultante: string;
  tiene_saldo_contrario: boolean;
};

export type EstadoResultadosRow = {
  organization_id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  seccion: string;
  nivel: number;
  cuenta_padre_id: string | null;
  tipo_cuenta: string;
  naturaleza: string;
  total_debito: number;
  total_credito: number;
  saldo_natural: number;
  saldo_presentacion: number;
  total_ingresos: number;
  total_costo_venta: number;
  utilidad_bruta: number;
  total_gastos_operativos: number;
  utilidad_operativa: number;
  productos_financieros: number;
  otros_ingresos_gastos: number;
  utilidad_neta: number;
};

export type ResumenFinanciero = {
  organization_id: string;
  total_activos: number;
  total_pasivos: number;
  total_patrimonio: number;
  diferencia_balance: number;
  total_ingresos: number;
  total_costos: number;
  total_gastos: number;
  utilidad_neta: number;
  balance_cuadra: boolean;
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

async function resolveOrganizationId(organizationId?: string) {
  await assertInternalUser();

  if (organizationId) {
    return organizationId;
  }

  const activeContext = await getActiveContext();

  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return activeContext.organization.id;
}

function getRpcParams(filters: EstadoFinancieroFilters, organizationId: string) {
  return {
    p_fecha_desde: filters.fechaDesde || null,
    p_fecha_hasta: filters.fechaHasta || null,
    p_organization_id: organizationId,
  };
}

export async function getBalanceGeneral(filters: EstadoFinancieroFilters = {}) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_balance_general",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    organizationId,
    rows: (data ?? []) as BalanceGeneralRow[],
  };
}

export async function getEstadoResultados(filters: EstadoFinancieroFilters = {}) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_estado_resultados",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    organizationId,
    rows: (data ?? []) as EstadoResultadosRow[],
  };
}

export async function getResumenFinanciero(
  filters: EstadoFinancieroFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_resumen_financiero",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ResumenFinanciero[];

  return {
    organizationId,
    resumen:
      rows[0] ??
      ({
        balance_cuadra: true,
        diferencia_balance: 0,
        organization_id: organizationId,
        total_activos: 0,
        total_costos: 0,
        total_gastos: 0,
        total_ingresos: 0,
        total_pasivos: 0,
        total_patrimonio: 0,
        utilidad_neta: 0,
      } satisfies ResumenFinanciero),
  };
}
