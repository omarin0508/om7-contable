import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type ReporteContableFilters = {
  organizationId?: string;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  cuentaId?: string | null;
  incluirCuentasSinMovimiento?: boolean;
};

export type SaldoContable = {
  organization_id: string;
  cuenta_contable_id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  tipo_estado: string;
  naturaleza: string;
  tipo_cuenta: string;
  nivel: number;
  cuenta_padre_id: string | null;
  total_debito: number;
  total_credito: number;
  saldo_deudor: number;
  saldo_acreedor: number;
  saldo_natural: number;
  tipo_saldo_resultante: "deudor" | "acreedor" | "cero" | string;
  tiene_saldo_contrario: boolean;
};

export type MayorGeneralMovimiento = {
  organization_id: string;
  asiento_id: string;
  asiento_linea_id: string;
  fecha: string;
  numero_asiento: number;
  descripcion_asiento: string;
  descripcion_linea: string | null;
  modulo_origen: string | null;
  referencia: string | null;
  cuenta_contable_id: string;
  codigo: string;
  nombre: string;
  naturaleza: string;
  debito: number;
  credito: number;
  saldo_movimiento_natural: number;
  saldo_acumulado_natural: number;
};

export type BalanceComprobacionRow = {
  organization_id: string;
  cuenta_contable_id?: string | null;
  codigo: string;
  nombre: string;
  categoria: string;
  tipo_estado: string;
  naturaleza: string;
  tipo_cuenta?: string | null;
  nivel?: number | null;
  cuenta_padre_id?: string | null;
  total_debito: number;
  total_credito: number;
  saldo_deudor: number;
  saldo_acreedor: number;
  saldo_natural: number;
  total_debito_balance: number;
  total_credito_balance: number;
  diferencia_balance: number;
  tiene_saldo_contrario?: boolean;
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

function getRpcParams(filters: ReporteContableFilters, organizationId: string) {
  return {
    p_cuenta_id: filters.cuentaId || null,
    p_fecha_desde: filters.fechaDesde || null,
    p_fecha_hasta: filters.fechaHasta || null,
    p_organization_id: organizationId,
  };
}

export async function getSaldosContables(filters: ReporteContableFilters = {}) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_saldos_contables",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    organizationId,
    saldos: (data ?? []) as SaldoContable[],
  };
}

export async function getMayorGeneral(filters: ReporteContableFilters = {}) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_mayor_general",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    movimientos: (data ?? []) as MayorGeneralMovimiento[],
    organizationId,
  };
}

export async function getBalanceComprobacion(
  filters: ReporteContableFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const organizationId = await resolveOrganizationId(filters.organizationId);
  const { data, error } = await supabase.rpc(
    "get_balance_comprobacion",
    getRpcParams(filters, organizationId),
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BalanceComprobacionRow[];
  const { saldos } = await getSaldosContables(filters);
  const saldosByCode = new Map(
    saldos.map((saldo) => [saldo.codigo, saldo] as const),
  );
  const enrichedRows = rows.map((row) => {
    const saldo = saldosByCode.get(row.codigo);

    return {
      ...row,
      cuenta_contable_id: saldo?.cuenta_contable_id ?? null,
      cuenta_padre_id: saldo?.cuenta_padre_id ?? null,
      nivel: saldo?.nivel ?? null,
      tiene_saldo_contrario: saldo?.tiene_saldo_contrario ?? false,
      tipo_cuenta: saldo?.tipo_cuenta ?? "detalle",
    };
  });
  const summary = rows[0]
    ? {
        diferencia: Number(rows[0].diferencia_balance ?? 0),
        totalCredito: Number(rows[0].total_credito_balance ?? 0),
        totalDebito: Number(rows[0].total_debito_balance ?? 0),
      }
    : {
        diferencia: 0,
        totalCredito: 0,
        totalDebito: 0,
      };

  return {
    organizationId,
    rows: enrichedRows,
    summary,
  };
}
