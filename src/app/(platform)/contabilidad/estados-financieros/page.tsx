import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getResumenFinanciero } from "@/lib/estados-financieros";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

export default async function EstadosFinancierosPage() {
  const result = await getResumenFinanciero().catch((error: unknown) => ({
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el resumen financiero.",
    organizationId: null,
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
  }));
  const { resumen } = result;
  const actionError = "error" in result ? result.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Estados financieros"
        description="Balance General, Estado de Resultados y resumen ejecutivo calculados desde SQL/backend."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/balance-general">
              Balance General
            </Link>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/estado-resultados">
              Estado Resultados
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Estados financieros no disponibles
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Activos" label="Total activos" value={formatCurrency(resumen.total_activos)} />
        <MetricCard detail="Pasivos" label="Total pasivos" value={formatCurrency(resumen.total_pasivos)} />
        <MetricCard detail="Patrimonio" label="Patrimonio" value={formatCurrency(resumen.total_patrimonio)} />
        <MetricCard detail="Resultado del periodo" label="Utilidad neta" value={formatCurrency(resumen.utilidad_neta)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <PremiumCard className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-white">Balance General</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Activos, pasivos y patrimonio con saldo jerarquico acumulado.
              </p>
            </div>
            <StatusBadge tone={resumen.balance_cuadra ? "emerald" : "amber"}>
              {resumen.balance_cuadra ? "Cuadra" : "Revisar"}
            </StatusBadge>
          </div>
          <Link className="om7-btn-primary mt-5 px-4 py-2.5" href="/contabilidad/balance-general">
            Abrir balance
          </Link>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">Estado de Resultados</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ingresos, costos, gastos y utilidad neta calculados desde cuentas ER.
          </p>
          <Link className="om7-btn-primary mt-5 px-4 py-2.5" href="/contabilidad/estado-resultados">
            Abrir resultados
          </Link>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">Resumen financiero</p>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-3 text-slate-300">
              <span>Diferencia balance</span>
              <span className="font-semibold text-white">
                {formatCurrency(resumen.diferencia_balance)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-slate-300">
              <span>Ingresos</span>
              <span className="font-semibold text-white">
                {formatCurrency(resumen.total_ingresos)}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-slate-300">
              <span>Costos + gastos</span>
              <span className="font-semibold text-white">
                {formatCurrency(resumen.total_costos + resumen.total_gastos)}
              </span>
            </div>
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
