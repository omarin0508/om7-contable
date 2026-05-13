import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getResumenReportesFinancieros } from "@/lib/reportes-financieros";

function formatCurrency(value: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

const reportCards = [
  {
    description: "Activos, pasivos y patrimonio desde SQL.",
    href: "/contabilidad/balance-general",
    title: "Balance General",
    type: "balance-general",
  },
  {
    description: "Ingresos, costos, gastos y utilidad neta.",
    href: "/contabilidad/estado-resultados",
    title: "Estado de Resultados",
    type: "estado-resultados",
  },
  {
    description: "Debitos, creditos y saldos por cuenta detalle.",
    href: "/contabilidad/balance-comprobacion",
    title: "Balance de Comprobacion",
    type: "balance-comprobacion",
  },
  {
    description: "Movimientos linea por linea con saldo acumulado.",
    href: "/contabilidad/mayor",
    title: "Mayor General",
    type: "mayor-general",
  },
] as const;

export default async function ReportesFinancierosPage() {
  const result = await getResumenReportesFinancieros().catch(
    (error: unknown) => ({
      context: {
        fechaDesde: null,
        fechaHasta: null,
        moneda: "CRC",
        organizationId: "",
        organizationName: "Organizacion OM7",
        cuentaId: null,
      },
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el resumen de reportes.",
      resumen: {
        balance_cuadra: true,
        diferencia_balance: 0,
        total_activos: 0,
        total_costos: 0,
        total_gastos: 0,
        total_ingresos: 0,
        total_pasivos: 0,
        total_patrimonio: 0,
        utilidad_neta: 0,
      },
    }),
  );
  const { context, resumen } = result;
  const actionError = "error" in result ? result.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Reportes financieros"
        description="Centro de consulta y exportacion basado en la verdad contable oficial de SQL/RPC."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/estados-financieros"
            >
              Estados financieros
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Reportes no disponibles
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={context.organizationName}
          label="Activos"
          value={formatCurrency(resumen.total_activos, context.moneda)}
        />
        <MetricCard
          detail="Pasivos + patrimonio"
          label="Estructura"
          value={formatCurrency(
            resumen.total_pasivos + resumen.total_patrimonio,
            context.moneda,
          )}
        />
        <MetricCard
          detail="Resultado del periodo"
          label="Utilidad neta"
          value={formatCurrency(resumen.utilidad_neta, context.moneda)}
        />
        <MetricCard
          detail={resumen.balance_cuadra ? "Cuadra" : "Revisar"}
          label="Diferencia"
          value={formatCurrency(resumen.diferencia_balance, context.moneda)}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">
              Estado del balance
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              El estado proviene de `get_resumen_financiero`; la pantalla no
              recalcula saldos ni diferencias.
            </p>
          </div>
          <StatusBadge tone={resumen.balance_cuadra ? "emerald" : "amber"}>
            {resumen.balance_cuadra ? "Cuadra" : "No cuadra"}
          </StatusBadge>
        </div>
      </PremiumCard>

      <section className="grid gap-5 lg:grid-cols-2">
        {reportCards.map((report) => (
          <PremiumCard className="p-5" key={report.type}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-white">
                  {report.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {report.description}
                </p>
              </div>
              <StatusBadge tone="cyan">RPC oficial</StatusBadge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="om7-btn-primary px-4 py-2.5" href={report.href}>
                Abrir
              </Link>
              <Link
                className="om7-btn-ghost px-4 py-2.5"
                href={`/contabilidad/reportes/exportar/excel?tipo=${report.type}`}
              >
                Excel
              </Link>
            </div>
          </PremiumCard>
        ))}
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">Exportaciones</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Excel usa los mismos helpers server-side que las pantallas. PDF
              queda preparado para una fase posterior.
            </p>
          </div>
          <StatusBadge tone="slate">PDF futuro</StatusBadge>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
