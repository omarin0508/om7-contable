import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { JournalEntryCard } from "@/components/accounting/journal-entry-card";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getJournalTotals,
  listJournalEntriesForActiveCompany,
} from "@/lib/accounting-entries";
import {
  getPeriodLabel,
  listAccountingPeriods,
  normalizePeriodStatus,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  getAlertasContables,
  getDashboardContableEjecutivo,
} from "@/lib/dashboard-contable";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import { listPurchases } from "@/lib/purchases";

type AccountingPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getEntryStatusLabel(status: string | null | undefined) {
  if (status === "posted") {
    return "Contabilizado";
  }

  if (status === "reviewed") {
    return "Revisado";
  }

  if (status === "observed") {
    return "Observado";
  }

  return "Sugerido";
}

export default async function AccountingPage({
  searchParams,
}: AccountingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const [entriesResult, periodsResult, purchasesResult, invoicesResult] =
    await Promise.all([
      listJournalEntriesForActiveCompany().catch(() => ({
        company: null,
        entries: [],
        organization: null,
      })),
      listAccountingPeriods().catch(() => ({
        periods: [] as AccountingPeriod[],
      })),
      listPurchases(),
      getInvoicesForActiveCompany(),
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
  const periods = periodsResult.periods;
  const suggestedCount = entries.filter(
    (entry) => entry.status === "suggested",
  ).length;
  const observedCount = entries.filter(
    (entry) => entry.status === "observed",
  ).length;
  const postedCount = entries.filter((entry) => entry.status === "posted").length;
  const pendingCount = entries.filter((entry) => entry.status !== "posted").length;
  const sourceTitles = new Map<string, string>([
    ...purchasesResult.purchases.map(
      (purchase) =>
        [
          `purchase-${purchase.id}`,
          purchase.counterparty?.name ?? purchase.supplier_name ?? "Compra",
        ] as const,
    ),
    ...invoicesResult.invoices.map(
      (invoice) =>
        [
          `invoice-${invoice.id}`,
          invoice.counterparty?.name ?? invoice.proveedor ?? "Factura",
        ] as const,
    ),
  ]);
  const dashboardContable =
    "error" in dashboardContableResult ? null : dashboardContableResult.resumen;
  const dashboardContableError =
    "error" in dashboardContableResult ? dashboardContableResult.error : null;
  const alertasContables = alertasContablesResult.alertas;
  const accountingStatusRows = dashboardContable
    ? [
        {
          errors: dashboardContable.compras_errores_contables,
          href: "/compras",
          label: "Compras",
          pending: dashboardContable.compras_pendientes_contables,
          posted: dashboardContable.compras_contabilizadas_contables,
        },
        {
          errors: dashboardContable.facturas_errores_contables,
          href: "/facturas",
          label: "Facturas",
          pending: dashboardContable.facturas_pendientes_contables,
          posted: dashboardContable.facturas_contabilizadas_contables,
        },
        {
          errors: dashboardContable.caja_errores_contable,
          href: "/movimientos",
          label: "Caja/Bancos",
          pending: dashboardContable.caja_pendiente_contable,
          posted: dashboardContable.caja_contabilizada_contable,
        },
        {
          errors: dashboardContable.planillas_errores_contables,
          href: "/planillas",
          label: "Planillas",
          pending: dashboardContable.planillas_pendientes_contables,
          posted: dashboardContable.planillas_contabilizadas_contables,
        },
        {
          errors: dashboardContable.subcontratos_errores_contables,
          href: "/subcontratos",
          label: "Subcontratos",
          pending: dashboardContable.subcontratos_pendientes_contables,
          posted: dashboardContable.subcontratos_contabilizados_contables,
        },
      ]
    : [];

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Contabilidad asistida"
        description="Asientos sugeridos por OM7 para revisar, observar y contabilizar sin crear registros desde cero."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink />
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/asientos"
            >
              Asientos reales
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/mayor"
            >
              Mayor
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/balance-comprobacion"
            >
              Balance
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/estados-financieros"
            >
              Estados financieros
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/reportes"
            >
              Reportes
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/flujo-efectivo"
            >
              Flujo efectivo
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/cierres"
            >
              Cierres
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/presupuesto-vs-real"
            >
              Presupuesto vs real
            </Link>
            <Link
              className="om7-btn-ghost px-4 py-2.5"
              href="/contabilidad/reglas"
            >
              Reglas
            </Link>
            <Link
              className="om7-btn-primary px-4 py-2.5"
              href="/contabilidad/catalogo"
            >
              Catalogo de cuentas
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona un cliente/empresa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            La contabilidad asistida se calcula para el cliente/empresa activo.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a clientes/empresas
          </Link>
        </PremiumCard>
      ) : null}

      {dashboardContableError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Dashboard contable no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {dashboardContableError}
          </p>
        </PremiumCard>
      ) : null}

      {dashboardContable ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              detail="get_resumen_financiero"
              label="Utilidad neta"
              value={formatCurrencyAmount(dashboardContable.utilidad_neta, currency)}
            />
            <MetricCard
              detail="get_resumen_flujo_efectivo"
              label="Flujo neto"
              value={formatCurrencyAmount(dashboardContable.flujo_neto, currency)}
            />
            <MetricCard
              detail="Caja/Bancos oficiales"
              label="Saldo efectivo"
              value={formatCurrencyAmount(
                dashboardContable.saldo_final_efectivo,
                currency,
              )}
            />
            <MetricCard
              detail={dashboardContable.balance_cuadra ? "OK" : "Atencion"}
              label="Balance"
              value={
                dashboardContable.balance_cuadra
                  ? "Cuadra"
                  : formatCurrencyAmount(
                      dashboardContable.diferencia_balance,
                      currency,
                    )
              }
            />
            <MetricCard
              detail="SQL estado_contable"
              label="Pendientes"
              value={String(dashboardContable.total_pendientes_contables)}
            />
            <MetricCard
              detail="get_alertas_contables"
              label="Alertas"
              value={String(dashboardContable.alertas_count)}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <PremiumCard className="overflow-hidden">
              <div className="border-b border-white/[0.07] p-5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">
                      Estado contable OM7
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Contabilizados, pendientes y errores provienen de
                      `get_dashboard_contable_ejecutivo`.
                    </p>
                  </div>
                  <StatusBadge>SQL/RPC</StatusBadge>
                </div>
              </div>
              <div className="om7-responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Modulo</th>
                      <th>Contabilizados</th>
                      <th>Pendientes</th>
                      <th>Errores</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountingStatusRows.map((row) => (
                      <tr key={row.label}>
                        <td>
                          <Link className="font-semibold text-cyan-100" href={row.href}>
                            {row.label}
                          </Link>
                        </td>
                        <td>{row.posted}</td>
                        <td>{row.pending}</td>
                        <td>{row.errors}</td>
                        <td>
                          <StatusBadge>
                            {row.errors > 0
                              ? "Error"
                              : row.pending > 0
                                ? "Pendiente"
                                : "OK"}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumCard>

            <PremiumCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    Alertas contables
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Alertas oficiales desde backend.
                  </p>
                </div>
                <StatusBadge>{alertasContables.length}</StatusBadge>
              </div>
              <div className="mt-5 grid gap-3">
                {alertasContables.length > 0 ? (
                  alertasContables.slice(0, 4).map((alerta) => (
                    <div
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4"
                      key={alerta.alerta_tipo}
                    >
                      <p className="text-sm font-semibold text-white">
                        {alerta.titulo}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {alerta.descripcion}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-slate-300">
                        Cantidad: {alerta.cantidad}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-400">
                    Sin alertas contables para el periodo actual.
                  </p>
                )}
              </div>
            </PremiumCard>
          </section>
        </>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="OM7 preparo propuesta Debe/Haber"
          label="Asientos sugeridos"
          value={String(suggestedCount)}
        />
        <MetricCard
          detail="Necesitan correccion"
          label="Observados"
          value={String(observedCount)}
        />
        <MetricCard
          detail="Ya fueron contabilizados"
          label="Contabilizados"
          value={String(postedCount)}
        />
        <MetricCard
          detail="Sugeridos, revisados u observados"
          label="Pendientes"
          value={String(pendingCount)}
        />
      </section>

      <section>
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">
                  Ultimos asientos
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Propuestas generadas desde compras y facturas aprobadas.
                </p>
              </div>
              <StatusBadge>{entries.length} asientos</StatusBadge>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid gap-4">
              {entries.length > 0 ? (
                entries.map((entry) => {
                  const totals = getJournalTotals(entry);
                  const entryPeriod = periods.find(
                    (period) =>
                      period.period_year === entry.period_year &&
                      period.period_month === entry.period_month,
                  );
                  const entryLocked =
                    normalizePeriodStatus(entryPeriod?.status) === "closed";

                  return (
                    <div
                      className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4"
                      key={entry.id}
                    >
                      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="om7-chip om7-chip-cyan">
                              {entry.source_type === "purchase" ? "Compra" : "Factura"}
                            </span>
                            <span className="om7-chip text-slate-300">
                              {getEntryStatusLabel(entry.status)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-white">
                            {sourceTitles.get(
                              `${entry.source_type}-${entry.source_id}`,
                            ) ?? "Registro origen"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getPeriodLabel(entry.period_year, entry.period_month)}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {totals.isBalanced ? "Cuadra" : "Con diferencia"}
                        </div>
                      </div>
                      <JournalEntryCard
                        currency={currency}
                        entry={entry}
                        locked={entryLocked}
                        lockedReason="Periodo cerrado. El asiento queda solo lectura."
                        redirectTo="/contabilidad"
                        sourceId={entry.source_id}
                        sourceType={
                          entry.source_type === "invoice" ? "invoice" : "purchase"
                        }
                      />
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
                  <p className="text-base font-semibold text-white">
                    Aun no hay asientos sugeridos.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Aprueba una compra o factura y genera el asiento sugerido
                    desde su card.
                  </p>
                  <Link
                    className="mt-5 inline-flex rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
                    href="/contabilidad/catalogo"
                  >
                    Revisar catalogo de cuentas
                  </Link>
                </div>
              )}
            </div>
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
