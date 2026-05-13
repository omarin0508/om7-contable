import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount } from "@/lib/currency";
import {
  getPresupuestoEstadoLabel,
  getPresupuestoVsContabilidad,
} from "@/lib/presupuesto-contabilidad";

type PresupuestoVsRealPageProps = {
  searchParams?: Promise<{
    centroCostoId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }>;
};

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "Sin base";
  }

  return `${Number(value).toFixed(2)}%`;
}

function getEstadoTone(status: string) {
  if (status === "excedido") {
    return "rose" as const;
  }

  if (status === "cerca_limite" || status === "sin_presupuesto") {
    return "amber" as const;
  }

  return "emerald" as const;
}

function buildExcelHref(params: {
  centroCostoId: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
}) {
  const searchParams = new URLSearchParams({ tipo: "presupuesto-vs-real" });

  if (params.centroCostoId) {
    searchParams.set("centroCostoId", params.centroCostoId);
  }

  if (params.fechaDesde) {
    searchParams.set("fechaDesde", params.fechaDesde);
  }

  if (params.fechaHasta) {
    searchParams.set("fechaHasta", params.fechaHasta);
  }

  return `/contabilidad/reportes/exportar/excel?${searchParams.toString()}`;
}

export default async function PresupuestoVsRealPage({
  searchParams,
}: PresupuestoVsRealPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const centroCostoId = resolvedSearchParams.centroCostoId || null;
  const fechaDesde = resolvedSearchParams.fechaDesde || null;
  const fechaHasta = resolvedSearchParams.fechaHasta || null;
  const report = await getPresupuestoVsContabilidad({
    centroCostoId,
    fechaDesde,
    fechaHasta,
  });
  const { context, rows, resumen, centrosCosto } = report;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Presupuesto vs real"
        description="Ejecucion financiera por centro de costo usando asientos contabilizados oficiales y presupuestos aprobados."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href={buildExcelHref({ centroCostoId, fechaDesde, fechaHasta })}
            >
              Exportar Excel
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Presupuestos aprobados"
          label="Presupuesto total"
          value={formatCurrencyAmount(resumen.montoPresupuestado, context.moneda)}
        />
        <MetricCard
          detail="Asientos contabilizados ER"
          label="Gasto real"
          value={formatCurrencyAmount(resumen.gastoContableReal, context.moneda)}
        />
        <MetricCard
          detail="Aprobado no contabilizado"
          label="Comprometido"
          value={formatCurrencyAmount(resumen.comprometidoContable, context.moneda)}
        />
        <MetricCard
          detail={formatPercent(resumen.porcentajeEjecucion)}
          label="Disponible"
          value={formatCurrencyAmount(resumen.disponible, context.moneda)}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Filtros de ejecucion
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              La desviacion y el gasto real se calculan en SQL/RPC.
            </p>
          </div>
          <form className="grid w-full gap-3 sm:grid-cols-4 lg:max-w-4xl">
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Centro de costo
              <select
                className="om7-input"
                defaultValue={centroCostoId ?? ""}
                name="centroCostoId"
              >
                <option value="">Todos</option>
                {centrosCosto.map((centro) => (
                  <option key={centro.id} value={centro.id}>
                    {centro.codigo ? `${centro.codigo} - ` : ""}
                    {centro.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Desde
              <input
                className="om7-input"
                defaultValue={fechaDesde ?? ""}
                name="fechaDesde"
                type="date"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-300">
              Hasta
              <input
                className="om7-input"
                defaultValue={fechaHasta ?? ""}
                name="fechaHasta"
                type="date"
              />
            </label>
            <button className="om7-btn-primary self-end px-4 py-2.5" type="submit">
              Filtrar
            </button>
          </form>
        </div>
      </PremiumCard>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Ejecucion por centro de costo
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Fuente: `get_presupuesto_vs_contabilidad`.
              </p>
            </div>
            <StatusBadge tone="cyan">{rows.length} lineas</StatusBadge>
          </div>
        </div>
        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Centro de costo</th>
                <th>Presupuesto</th>
                <th>Presupuestado</th>
                <th>Gasto real</th>
                <th>Comprometido</th>
                <th>Disponible</th>
                <th>% ejecucion</th>
                <th>Desviacion</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.centro_costo_id ?? "sin-centro"}-${row.presupuesto_id ?? "sin-presupuesto"}`}
                >
                  <td className="font-semibold text-white">
                    {row.centro_costo_nombre}
                  </td>
                  <td>{row.presupuesto_nombre}</td>
                  <td>
                    {formatCurrencyAmount(row.monto_presupuestado, context.moneda)}
                  </td>
                  <td>
                    {formatCurrencyAmount(row.gasto_contable_real, context.moneda)}
                  </td>
                  <td>
                    {formatCurrencyAmount(row.comprometido_contable, context.moneda)}
                  </td>
                  <td>{formatCurrencyAmount(row.disponible, context.moneda)}</td>
                  <td>{formatPercent(row.porcentaje_ejecucion)}</td>
                  <td>{formatCurrencyAmount(row.desviacion, context.moneda)}</td>
                  <td>
                    <StatusBadge tone={getEstadoTone(row.estado)}>
                      {getPresupuestoEstadoLabel(row.estado)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="p-8 text-center text-sm text-slate-400">
                      Sin presupuestos ni gasto real para el filtro actual.
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
