import { getActiveContext } from "@/lib/active-context";
import {
  getBalanceGeneral,
  getEstadoResultados,
  getResumenFinanciero,
  type BalanceGeneralRow,
  type EstadoResultadosRow,
  type ResumenFinanciero,
} from "@/lib/estados-financieros";
import {
  getBalanceComprobacion,
  getMayorGeneral,
  type BalanceComprobacionRow,
  type MayorGeneralMovimiento,
} from "@/lib/reportes-contables";

export type ReporteFinancieroTipo =
  | "balance-general"
  | "estado-resultados"
  | "balance-comprobacion"
  | "mayor-general";

export type ReporteFinancieroFilters = {
  organizationId?: string;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  cuentaId?: string | null;
  moneda?: string;
  incluirCuentasSinMovimiento?: boolean;
};

export type ReporteFinancieroContext = {
  organizationId: string;
  organizationName: string;
  moneda: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  cuentaId: string | null;
};

async function resolveReportContext(
  filters: ReporteFinancieroFilters,
  organizationId: string,
): Promise<ReporteFinancieroContext> {
  const activeContext = await getActiveContext();
  const organizationName =
    activeContext.organization?.id === organizationId
      ? activeContext.organization.name
      : "Organizacion OM7";
  const moneda =
    filters.moneda ??
    activeContext.activeCompany?.base_currency ??
    activeContext.organization?.base_currency ??
    "CRC";

  return {
    cuentaId: filters.cuentaId ?? null,
    fechaDesde: filters.fechaDesde ?? null,
    fechaHasta: filters.fechaHasta ?? null,
    moneda,
    organizationId,
    organizationName,
  };
}

export async function getReporteBalanceGeneral(
  filters: ReporteFinancieroFilters = {},
) {
  const result = await getBalanceGeneral(filters);
  const context = await resolveReportContext(filters, result.organizationId);

  return {
    context,
    rows: result.rows as BalanceGeneralRow[],
  };
}

export async function getReporteEstadoResultados(
  filters: ReporteFinancieroFilters = {},
) {
  const result = await getEstadoResultados(filters);
  const context = await resolveReportContext(filters, result.organizationId);

  return {
    context,
    rows: result.rows as EstadoResultadosRow[],
  };
}

export async function getReporteBalanceComprobacion(
  filters: ReporteFinancieroFilters = {},
) {
  const result = await getBalanceComprobacion(filters);
  const context = await resolveReportContext(filters, result.organizationId);

  return {
    context,
    rows: result.rows as BalanceComprobacionRow[],
    summary: result.summary,
  };
}

export async function getReporteMayorGeneral(
  filters: ReporteFinancieroFilters = {},
) {
  const result = await getMayorGeneral(filters);
  const context = await resolveReportContext(filters, result.organizationId);

  return {
    context,
    movimientos: result.movimientos as MayorGeneralMovimiento[],
  };
}

export async function getResumenReportesFinancieros(
  filters: ReporteFinancieroFilters = {},
) {
  const result = await getResumenFinanciero(filters);
  const context = await resolveReportContext(filters, result.organizationId);

  return {
    context,
    resumen: result.resumen as ResumenFinanciero,
  };
}
