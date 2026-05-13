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
  getFlujoEfectivo,
  getResumenFlujoEfectivo,
  type FlujoEfectivoMovimiento,
} from "@/lib/flujo-efectivo";

type FlujoEfectivoPageProps = {
  searchParams?: Promise<{
    clasificacion?: string;
    desde?: string;
    hasta?: string;
  }>;
};

const classificationLabels: Record<string, string> = {
  ajustes: "Ajustes",
  cobros_clientes: "Cobros clientes",
  otros_egresos: "Otros egresos",
  otros_ingresos: "Otros ingresos",
  pagos_planilla: "Pagos planilla",
  pagos_proveedores: "Pagos proveedores",
  pagos_subcontratos: "Pagos subcontratos",
  transferencias: "Transferencias",
};

const classificationOptions = [
  "cobros_clientes",
  "pagos_proveedores",
  "pagos_planilla",
  "pagos_subcontratos",
  "transferencias",
  "otros_ingresos",
  "otros_egresos",
  "ajustes",
] as const;

function money(value: number, currency: string) {
  return formatCurrencyAmount(Number(value ?? 0), currency);
}

function getClassificationLabel(value: string | null | undefined) {
  if (!value) {
    return "Sin clasificacion";
  }

  return classificationLabels[value] ?? value;
}

function getClassificationTone(value: string): "amber" | "cyan" | "emerald" | "rose" | "slate" {
  if (value === "cobros_clientes" || value === "otros_ingresos") {
    return "emerald";
  }

  if (value === "transferencias") {
    return "cyan";
  }

  if (value === "ajustes") {
    return "amber";
  }

  if (value === "otros_egresos") {
    return "slate";
  }

  return "rose";
}

function filterMovements(
  movimientos: FlujoEfectivoMovimiento[],
  clasificacion: string | null,
) {
  if (!clasificacion || clasificacion === "todas") {
    return movimientos;
  }

  return movimientos.filter(
    (movimiento) => movimiento.clasificacion_flujo === clasificacion,
  );
}

export default async function FlujoEfectivoPage({
  searchParams,
}: FlujoEfectivoPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters = {
    fechaDesde: params.desde ?? null,
    fechaHasta: params.hasta ?? null,
  };
  const [flujoResult, resumenResult] = await Promise.all([
    getFlujoEfectivo(filters).catch((error: unknown) => ({
      context: {
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        moneda: "CRC",
        organizationId: "",
        organizationName: "Organizacion OM7",
      },
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el flujo de efectivo.",
      movimientos: [] as FlujoEfectivoMovimiento[],
    })),
    getResumenFlujoEfectivo(filters).catch(() => ({
      resumen: {
        cobros_clientes: 0,
        flujo_neto: 0,
        organization_id: "",
        otros_neto: 0,
        pagos_planilla: 0,
        pagos_proveedores: 0,
        pagos_subcontratos: 0,
        saldo_final: 0,
        saldo_inicial: 0,
        total_entradas: 0,
        total_salidas: 0,
        transferencias_neto: 0,
      },
    })),
  ]);
  const actionError = "error" in flujoResult ? flujoResult.error : null;
  const context = flujoResult.context;
  const resumen = resumenResult.resumen;
  const selectedClassification = params.clasificacion ?? "todas";
  const movimientos = filterMovements(
    flujoResult.movimientos,
    selectedClassification,
  );
  const excelParams = new URLSearchParams({ tipo: "flujo-efectivo" });

  if (filters.fechaDesde) {
    excelParams.set("fechaDesde", filters.fechaDesde);
  }

  if (filters.fechaHasta) {
    excelParams.set("fechaHasta", filters.fechaHasta);
  }

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Flujo de Efectivo"
        description="Entradas, salidas y saldo acumulado desde asientos contabilizados y cuentas de caja/bancos."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/reportes" label="Volver a reportes" />
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href={`/contabilidad/reportes/exportar/excel?${excelParams.toString()}`}
            >
              Excel
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Flujo no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={context.organizationName}
          label="Entradas"
          value={money(resumen.total_entradas, context.moneda)}
        />
        <MetricCard
          detail="Salidas de efectivo"
          label="Salidas"
          value={money(resumen.total_salidas, context.moneda)}
        />
        <MetricCard
          detail="Entradas menos salidas"
          label="Flujo neto"
          value={money(resumen.flujo_neto, context.moneda)}
        />
        <MetricCard
          detail="Saldo inicial + flujo neto"
          label="Saldo final"
          value={money(resumen.saldo_final, context.moneda)}
        />
      </section>

      <PremiumCard className="p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm text-slate-300">
            Desde
            <input
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white outline-none transition focus:border-cyan-200/50"
              defaultValue={filters.fechaDesde ?? ""}
              name="desde"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Hasta
            <input
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white outline-none transition focus:border-cyan-200/50"
              defaultValue={filters.fechaHasta ?? ""}
              name="hasta"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Clasificacion
            <select
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-cyan-200/50"
              defaultValue={selectedClassification}
              name="clasificacion"
            >
              <option value="todas">Todas</option>
              {classificationOptions.map((option) => (
                <option key={option} value={option}>
                  {getClassificationLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <button className="om7-btn-primary px-4 py-2.5" type="submit">
            Filtrar
          </button>
        </form>
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Resumen SQL"
          label="Cobros clientes"
          value={money(resumen.cobros_clientes, context.moneda)}
        />
        <MetricCard
          detail="Resumen SQL"
          label="Pagos proveedores"
          value={money(resumen.pagos_proveedores, context.moneda)}
        />
        <MetricCard
          detail="Resumen SQL"
          label="Planilla + subcontratos"
          value={money(
            resumen.pagos_planilla + resumen.pagos_subcontratos,
            context.moneda,
          )}
        />
        <MetricCard
          detail="Resumen SQL"
          label="Otros neto"
          value={money(
            resumen.transferencias_neto + resumen.otros_neto,
            context.moneda,
          )}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Movimientos de efectivo
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Los saldos acumulados vienen de `get_flujo_efectivo`.
              </p>
            </div>
            <StatusBadge tone="cyan">{movimientos.length} lineas</StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Asiento</th>
                <th>Clasificacion</th>
                <th>Cuenta caja/banco</th>
                <th>Descripcion</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Neto</th>
                <th>Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length > 0 ? (
                movimientos.map((movimiento, index) => (
                  <tr
                    key={`${movimiento.asiento_id}-${movimiento.cuenta_efectivo_id}-${index}`}
                  >
                    <td>{movimiento.fecha}</td>
                    <td className="font-mono">#{movimiento.numero_asiento}</td>
                    <td>
                      <StatusBadge
                        tone={getClassificationTone(
                          movimiento.clasificacion_flujo,
                        )}
                      >
                        {getClassificationLabel(
                          movimiento.clasificacion_flujo,
                        )}
                      </StatusBadge>
                    </td>
                    <td>
                      <p className="font-mono text-cyan-100">
                        {movimiento.codigo_cuenta}
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {movimiento.nombre_cuenta}
                      </p>
                    </td>
                    <td>
                      <p className="text-sm text-white">
                        {movimiento.descripcion}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {movimiento.modulo_origen ?? "manual"} -{" "}
                        {movimiento.referencia ?? "sin referencia"}
                      </p>
                    </td>
                    <td>{money(movimiento.entrada, context.moneda)}</td>
                    <td>{money(movimiento.salida, context.moneda)}</td>
                    <td>{money(movimiento.flujo_neto, context.moneda)}</td>
                    <td>{money(movimiento.saldo_acumulado, context.moneda)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        No hay movimientos de efectivo contabilizados.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Los asientos borrador o anulados no alimentan este
                        reporte.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
