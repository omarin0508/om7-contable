import { getActiveContext } from "@/lib/active-context";
import { normalizeCurrencyCode } from "@/lib/currency";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type PresupuestoVsContabilidadFilters = {
  organizationId?: string;
  centroCostoId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
};

export type PresupuestoVsContabilidadContext = {
  organizationId: string;
  organizationName: string;
  moneda: string;
  centroCostoId: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
};

export type CentroCostoOption = {
  id: string;
  nombre: string;
  codigo: string | null;
};

export type PresupuestoVsContabilidadRow = {
  organization_id: string;
  centro_costo_id: string | null;
  centro_costo_nombre: string;
  presupuesto_id: string | null;
  presupuesto_nombre: string;
  monto_presupuestado: number;
  gasto_contable_real: number;
  comprometido_contable: number;
  disponible: number;
  porcentaje_ejecucion: number | null;
  desviacion: number;
  estado:
    | "dentro_presupuesto"
    | "cerca_limite"
    | "excedido"
    | "sin_presupuesto"
    | string;
};

export type ResumenPresupuestoVsContabilidad = {
  montoPresupuestado: number;
  gastoContableReal: number;
  comprometidoContable: number;
  disponible: number;
  porcentajeEjecucion: number | null;
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
  filters: PresupuestoVsContabilidadFilters,
): Promise<PresupuestoVsContabilidadContext> {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const organizationId = filters.organizationId ?? activeContext.organization?.id;

  if (!organizationId) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return {
    centroCostoId: filters.centroCostoId ?? null,
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

function summarizeRows(
  rows: PresupuestoVsContabilidadRow[],
): ResumenPresupuestoVsContabilidad {
  const montoPresupuestado = rows.reduce(
    (total, row) => total + Number(row.monto_presupuestado ?? 0),
    0,
  );
  const gastoContableReal = rows.reduce(
    (total, row) => total + Number(row.gasto_contable_real ?? 0),
    0,
  );
  const comprometidoContable = rows.reduce(
    (total, row) => total + Number(row.comprometido_contable ?? 0),
    0,
  );
  const disponible =
    montoPresupuestado - gastoContableReal - comprometidoContable;
  const porcentajeEjecucion =
    montoPresupuestado > 0
      ? ((gastoContableReal + comprometidoContable) / montoPresupuestado) * 100
      : null;

  return {
    comprometidoContable,
    disponible,
    gastoContableReal,
    montoPresupuestado,
    porcentajeEjecucion,
  };
}

export function getPresupuestoEstadoLabel(status: string | null | undefined) {
  if (status === "excedido") {
    return "Excedido";
  }

  if (status === "cerca_limite") {
    return "Cerca limite";
  }

  if (status === "sin_presupuesto") {
    return "Sin presupuesto";
  }

  return "Dentro presupuesto";
}

export async function getPresupuestoVsContabilidad(
  filters: PresupuestoVsContabilidadFilters = {},
) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(filters);
  const { data, error } = await supabase.rpc(
    "get_presupuesto_vs_contabilidad",
    {
      p_centro_costo_id: context.centroCostoId,
      p_fecha_desde: context.fechaDesde,
      p_fecha_hasta: context.fechaHasta,
      p_organization_id: context.organizationId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as PresupuestoVsContabilidadRow[];
  const { data: centrosData, error: centrosError } = await supabase
    .from("centros_costo")
    .select("id,nombre,codigo")
    .eq("organization_id", context.organizationId)
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (centrosError) {
    throw new Error(centrosError.message);
  }

  return {
    centrosCosto: (centrosData ?? []) as CentroCostoOption[],
    context,
    rows,
    resumen: summarizeRows(rows),
  };
}
