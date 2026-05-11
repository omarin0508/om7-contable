import Link from "next/link";
import { createDefaultAccountsAction } from "@/app/(platform)/contabilidad/actions";
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
  listAccountingAccounts,
  listJournalEntriesForActiveCompany,
} from "@/lib/accounting-entries";
import {
  getPeriodLabel,
  listAccountingPeriods,
  normalizePeriodStatus,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import { normalizeCurrencyCode } from "@/lib/currency";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import { listPurchases } from "@/lib/purchases";

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
  const [
    entriesResult,
    accountsResult,
    periodsResult,
    purchasesResult,
    invoicesResult,
  ] = await Promise.all([
    listJournalEntriesForActiveCompany().catch(() => ({
      company: null,
      entries: [],
      organization: null,
    })),
    listAccountingAccounts().catch(() => ({
      accounts: [],
      company: null,
      organization: null,
    })),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
    listPurchases(),
    getInvoicesForActiveCompany(),
  ]);
  const activeContext = purchasesResult.activeContext;
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const entries = entriesResult.entries;
  const periods = periodsResult.periods;
  const suggestedCount = entries.filter((entry) => entry.status === "suggested").length;
  const observedCount = entries.filter((entry) => entry.status === "observed").length;
  const postedCount = entries.filter((entry) => entry.status === "posted").length;
  const pendingCount = entries.filter((entry) => entry.status !== "posted").length;
  const sourceTitles = new Map<string, string>([
    ...purchasesResult.purchases.map((purchase) => [
      `purchase-${purchase.id}`,
      purchase.counterparty?.name ?? purchase.supplier_name ?? "Compra",
    ] as const),
    ...invoicesResult.invoices.map((invoice) => [
      `invoice-${invoice.id}`,
      invoice.counterparty?.name ?? invoice.proveedor ?? "Factura",
    ] as const),
  ]);

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Contabilidad asistida"
        description="Asientos sugeridos por OM7 para revisar, observar y contabilizar sin crear registros desde cero."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink />
            <form action={createDefaultAccountsAction}>
              <input name="redirectTo" type="hidden" value="/contabilidad" />
              <button className="om7-btn-primary px-4 py-2.5" type="submit">
                Preparar cuentas base
              </button>
            </form>
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

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
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
          <div className="max-h-[72vh] overflow-y-auto overscroll-contain p-5">
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
                            {sourceTitles.get(`${entry.source_type}-${entry.source_id}`) ??
                              "Registro origen"}
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
                        sourceType={entry.source_type === "invoice" ? "invoice" : "purchase"}
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
                </div>
              )}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <p className="text-base font-semibold text-white">
              Catalogo minimo de cuentas
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Base simple para que OM7 sugiera asientos sin configuracion pesada.
            </p>
          </div>
          <div className="max-h-[72vh] overflow-y-auto overscroll-contain p-5">
            <div className="grid gap-3">
              {accountsResult.accounts.length > 0 ? (
                accountsResult.accounts.map((account) => (
                  <div
                    className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                    key={account.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {account.code} · {account.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {account.type} · saldo {account.normal_balance}
                        </p>
                      </div>
                      {account.is_system ? (
                        <span className="om7-chip om7-chip-cyan">Sistema</span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-8 text-center">
                  <p className="text-sm font-semibold text-white">
                    No hay cuentas base.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Usa Preparar cuentas base para crear el catalogo minimo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
