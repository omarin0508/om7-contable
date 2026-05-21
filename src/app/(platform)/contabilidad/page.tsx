import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { listJournalEntriesForActiveCompany } from "@/lib/accounting-entries";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  getAlertasContables,
  getDashboardContableEjecutivo,
} from "@/lib/dashboard-contable";
import { listPurchases } from "@/lib/purchases";

type AccountingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AccountingPage({
  searchParams,
}: AccountingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const [entriesResult, purchasesResult] = await Promise.all([
    listJournalEntriesForActiveCompany().catch(() => ({
      company: null,
      entries: [],
      organization: null,
    })),
    listPurchases(),
  ]);
  const [dashboardContableResult, alertasContablesResult] = await Promise.all([
    getDashboardContableEjecutivo().catch((error: unknown) => ({
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el dashboard contable.",
      resumen: null,
    })),
    getAlertasContables().catch(() => ({
      alertas: [],
    })),
  ]);
  const activeContext = purchasesResult.activeContext;
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const entries = entriesResult.entries;
  const suggestedCount = entries.filter(
    (entry) => entry.status === "suggested",
  ).length;
  const observedCount = entries.filter(
    (entry) => entry.status === "observed",
  ).length;
  const postedCount = entries.filter((entry) => entry.status === "posted").length;
  const pendingCount = entries.filter((entry) => entry.status !== "posted").length;
  const dashboardContable =
    "error" in dashboardContableResult ? null : dashboardContableResult.resumen;
  const dashboardContableError =
    "error" in dashboardContableResult ? dashboardContableResult.error : null;
  const alertasContables = alertasContablesResult.alertas;
  const totalModuleErrors = dashboardContable
    ? dashboardContable.compras_errores_contables +
      dashboardContable.facturas_errores_contables +
      dashboardContable.caja_errores_contable +
      dashboardContable.planillas_errores_contables +
      dashboardContable.subcontratos_errores_contables
    : 0;
  const totalModulePending = dashboardContable
    ? dashboardContable.compras_pendientes_contables +
      dashboardContable.facturas_pendientes_contables +
      dashboardContable.caja_pendiente_contable +
      dashboardContable.planillas_pendientes_contables +
      dashboardContable.subcontratos_pendientes_contables
    : pendingCount;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Contabilidad asistida"
        description="Consola ejecutiva para entrar rapido a asientos, reportes, catalogo y cierre."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink />
            <Link
              className="om7-btn-primary px-4 py-2.5"
              href="/contabilidad/asientos/manual"
            >
              Nuevo asiento
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/catalogo"
            >
              Catalogo de cuentas
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-4">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo completar la accion
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-100">
                Selecciona un cliente/empresa
              </p>
              <p className="mt-1 text-sm text-amber-100/70">
                La consola contable trabaja sobre el cliente activo.
              </p>
            </div>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/empresas">
              Ir a clientes
            </Link>
          </div>
        </PremiumCard>
      ) : null}

      {dashboardContableError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-4">
          <p className="text-sm font-semibold text-amber-100">
            Dashboard contable no disponible
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-100/75">
            {dashboardContableError}
          </p>
        </PremiumCard>
      ) : null}

      {dashboardContable ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="Periodo activo"
            label="Utilidad neta"
            value={formatCurrencyAmount(dashboardContable.utilidad_neta, currency)}
          />
          <MetricCard
            detail="Caja/Bancos"
            label="Efectivo"
            value={formatCurrencyAmount(
              dashboardContable.saldo_final_efectivo,
              currency,
            )}
          />
          <MetricCard
            detail={totalModuleErrors > 0 ? `${totalModuleErrors} errores` : "Operativo"}
            label="Pendientes"
            value={String(totalModulePending)}
          />
          <MetricCard
            detail={dashboardContable.balance_cuadra ? "OK" : "Revisar"}
            label="Balance"
            value={
              dashboardContable.balance_cuadra
                ? "Cuadra"
                : formatCurrencyAmount(dashboardContable.diferencia_balance, currency)
            }
          />
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-4">
        <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-0 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.1] p-4">
            <div>
              <p className="text-base font-semibold text-white">Asientos</p>
              <p className="mt-1 text-sm text-slate-500">Trabajo contable.</p>
            </div>
            <StatusBadge>{entries.length} total</StatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 text-sm">
            <CompactValue label="Sugeridos" value={suggestedCount} />
            <CompactValue label="Pendientes" value={pendingCount} />
            <CompactValue label="Observados" value={observedCount} />
            <CompactValue label="Contabilizados" value={postedCount} />
          </div>
          <div className="flex gap-2 border-t border-white/[0.1] p-4 pt-3">
            <Link className="om7-btn-primary flex-1 px-3 py-2" href="/contabilidad/asientos">
              Abrir
            </Link>
            <Link
              className="om7-btn-ghost flex-1 px-3 py-2"
              href="/contabilidad/asientos/manual"
            >
              Nuevo
            </Link>
          </div>
        </PremiumCard>

        <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-0 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.1] p-4">
            <div>
              <p className="text-base font-semibold text-white">Notificaciones</p>
              <p className="mt-1 text-sm text-slate-500">Avisos compactos.</p>
            </div>
            <StatusBadge>{alertasContables.length}</StatusBadge>
          </div>
          <details className="m-4 rounded-2xl border border-white/[0.14] bg-white/[0.045] p-3 shadow-inner shadow-black/20 transition hover:border-cyan-200/20 hover:bg-cyan-300/[0.055]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
              <span>
                {alertasContables.length > 0
                  ? `${alertasContables.length} avisos`
                  : "Sin avisos"}
              </span>
              <span className="text-cyan-100">Ver</span>
            </summary>
            <div className="mt-3 grid gap-2">
              {alertasContables.length > 0 ? (
                alertasContables.slice(0, 3).map((alerta) => (
                  <div
                    className="rounded-xl border border-white/[0.08] bg-black/15 p-2"
                    key={alerta.alerta_tipo}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white">
                        {alerta.titulo}
                      </p>
                      <span className="text-xs text-cyan-100">
                        {alerta.cantidad}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  Todo en orden para el periodo.
                </p>
              )}
              <Link className="om7-btn-ghost px-3 py-2" href="/contabilidad/reportes">
                Revisar
              </Link>
            </div>
          </details>
        </PremiumCard>

        <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-0 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.1] p-4">
            <div>
              <p className="text-base font-semibold text-white">Cierre mensual</p>
              <p className="mt-1 text-sm text-slate-500">Control del periodo.</p>
            </div>
            <StatusBadge>
              {dashboardContable?.balance_cuadra ? "Listo" : "Revisar"}
            </StatusBadge>
          </div>
          <div className="m-4 rounded-2xl border border-white/[0.14] bg-white/[0.045] p-3 shadow-inner shadow-black/20">
            <p className="text-xs text-slate-500">Balance</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {dashboardContable?.balance_cuadra
                ? "Cuadra"
                : dashboardContable
                  ? formatCurrencyAmount(dashboardContable.diferencia_balance, currency)
              : "No disponible"}
            </p>
          </div>
          <div className="flex gap-2 border-t border-white/[0.1] p-4 pt-3">
            <Link className="om7-btn-primary flex-1 px-3 py-2" href="/contabilidad/cierres">
              Cierres
            </Link>
            <Link className="om7-btn-ghost flex-1 px-3 py-2" href="/contabilidad/reportes">
              Reportes
            </Link>
          </div>
        </PremiumCard>

        <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-0 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.1] p-4">
            <div>
              <p className="text-base font-semibold text-white">Workspaces</p>
              <p className="mt-1 text-sm text-slate-500">Acceso directo.</p>
            </div>
            <StatusBadge>ERP</StatusBadge>
          </div>
          <div className="grid gap-2 p-4">
            {[
              ["Catalogo", "/contabilidad/catalogo"],
              ["Mayor", "/contabilidad/mayor"],
              ["Balance", "/contabilidad/balance-comprobacion"],
              ["Estados", "/contabilidad/estados-financieros"],
            ].map(([label, href]) => (
              <Link
                className="rounded-xl border border-white/[0.12] bg-white/[0.045] px-3 py-2 text-sm font-semibold text-slate-200 shadow-sm shadow-black/10 transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.07]"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}

function CompactValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.13] bg-white/[0.045] p-3 shadow-inner shadow-black/15">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
