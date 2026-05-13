import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getEstadoResultados,
  getResumenFinanciero,
  type EstadoResultadosRow,
} from "@/lib/estados-financieros";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

const sectionLabels: Record<string, string> = {
  costo_venta: "Costo de venta",
  gastos_operativos: "Gastos operativos",
  ingresos: "Ingresos",
  otros_ingresos_gastos: "Otros ingresos y gastos",
  productos_financieros: "Productos financieros",
};

const sectionOrder = [
  "ingresos",
  "costo_venta",
  "gastos_operativos",
  "productos_financieros",
  "otros_ingresos_gastos",
];

function groupBySection(rows: EstadoResultadosRow[]) {
  return sectionOrder
    .map((section) => ({
      rows: rows.filter((row) => row.seccion === section),
      section,
    }))
    .filter((group) => group.rows.length > 0);
}

export default async function EstadoResultadosPage() {
  const [estadoResult, resumenResult] = await Promise.all([
    getEstadoResultados().catch((error: unknown) => ({
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el Estado de Resultados.",
      organizationId: null,
      rows: [],
    })),
    getResumenFinanciero().catch(() => ({
      resumen: {
        balance_cuadra: true,
        total_costos: 0,
        total_gastos: 0,
        total_ingresos: 0,
        utilidad_neta: 0,
      },
    })),
  ]);
  const actionError = "error" in estadoResult ? estadoResult.error : null;
  const rows = estadoResult.rows;
  const resumen = resumenResult.resumen;
  const groupedRows = groupBySection(rows);
  const firstRow = rows[0] ?? null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Estado de Resultados"
        description="Ingresos, costos, gastos y utilidad calculados desde funciones oficiales en SQL."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/estados-financieros" label="Volver" />
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/balance-general"
            >
              Balance General
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Estado no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Cuentas ER"
          label="Ingresos"
          value={formatCurrency(resumen.total_ingresos)}
        />
        <MetricCard
          detail="Costo de venta"
          label="Costos"
          value={formatCurrency(resumen.total_costos)}
        />
        <MetricCard
          detail="Operativos"
          label="Gastos"
          value={formatCurrency(resumen.total_gastos)}
        />
        <MetricCard
          detail={firstRow ? "Resultado neto" : "Sin movimientos ER"}
          label="Utilidad neta"
          value={formatCurrency(resumen.utilidad_neta)}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Cuentas de resultados
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                La utilidad bruta, operativa y neta vienen desde
                `get_estado_resultados`.
              </p>
            </div>
            <StatusBadge tone={rows.length > 0 ? "cyan" : "slate"}>
              {rows.length > 0 ? `${rows.length} cuentas` : "Sin movimientos"}
            </StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Seccion</th>
                <th>Naturaleza</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.length > 0 ? (
                groupedRows.flatMap((group) => [
                  <tr key={group.section}>
                    <td colSpan={6}>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                        {sectionLabels[group.section] ?? group.section}
                      </span>
                    </td>
                  </tr>,
                  ...group.rows.map((row) => (
                    <tr key={row.codigo}>
                      <td
                        style={{
                          paddingLeft: `${Math.max(row.nivel - 1, 0) * 18 + 16}px`,
                        }}
                      >
                        <p className="font-mono text-cyan-100">{row.codigo}</p>
                        <p className="mt-1 text-sm text-white">{row.nombre}</p>
                      </td>
                      <td>{sectionLabels[row.seccion] ?? row.seccion}</td>
                      <td>{row.naturaleza}</td>
                      <td>{formatCurrency(row.total_debito)}</td>
                      <td>{formatCurrency(row.total_credito)}</td>
                      <td>{formatCurrency(row.saldo_presentacion)}</td>
                    </tr>
                  )),
                ])
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        Sin movimientos de resultados.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Ingresos, costos y gastos apareceran cuando existan
                        asientos contabilizados en cuentas ER.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      <section className="grid gap-4 lg:grid-cols-3">
        <PremiumCard className="p-5">
          <p className="text-sm text-slate-500">Utilidad bruta</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatCurrency(firstRow?.utilidad_bruta ?? 0)}
          </p>
        </PremiumCard>
        <PremiumCard className="p-5">
          <p className="text-sm text-slate-500">Utilidad operativa</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatCurrency(firstRow?.utilidad_operativa ?? 0)}
          </p>
        </PremiumCard>
        <PremiumCard className="p-5">
          <p className="text-sm text-slate-500">Utilidad neta</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatCurrency(resumen.utilidad_neta)}
          </p>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
