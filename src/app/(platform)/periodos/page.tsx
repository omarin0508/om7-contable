import Link from "next/link";
import type { ReactNode } from "react";
import {
  closePeriodAction,
  markPeriodInReviewAction,
  reopenPeriodAction,
} from "@/app/(platform)/periodos/actions";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getPeriodLabel,
  getPeriodStatusBadgeClass,
  getPeriodStatusLabel,
  listAccountingPeriods,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import { listPurchases, type Purchase } from "@/lib/purchases";

type PeriodSummary = {
  approvedCount: number;
  closedRecordWarning: boolean;
  invoices: Invoice[];
  invoiceTotal: number;
  month: number;
  observedCount: number;
  pendingCount: number;
  period: AccountingPeriod | null;
  purchases: Purchase[];
  purchaseTotal: number;
  reviewedCount: number;
  year: number;
};

function isInPeriod(value: string | null | undefined, year: number, month: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

function getRecentMonths(count = 6) {
  const current = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);

    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  });
}

function buildPeriodSummaries({
  invoices,
  periods,
  purchases,
}: {
  invoices: Invoice[];
  periods: AccountingPeriod[];
  purchases: Purchase[];
}) {
  return getRecentMonths().map(({ month, year }) => {
    const period =
      periods.find(
        (item) => item.period_year === year && item.period_month === month,
      ) ?? null;
    const periodPurchases = purchases.filter((purchase) =>
      isInPeriod(purchase.purchase_date ?? purchase.created_at, year, month),
    );
    const periodInvoices = invoices.filter((invoice) =>
      isInPeriod(invoice.fecha ?? invoice.created_at, year, month),
    );
    const records = [...periodPurchases, ...periodInvoices];
    const pendingCount = records.filter(
      (record) => normalizeReviewStatus(record.review_status) === "pending",
    ).length;
    const observedCount = records.filter(
      (record) => normalizeReviewStatus(record.review_status) === "observed",
    ).length;
    const approvedCount = records.filter(
      (record) => normalizeReviewStatus(record.review_status) === "approved",
    ).length;
    const reviewedCount = records.filter(
      (record) => normalizeReviewStatus(record.review_status) === "reviewed",
    ).length;

    return {
      approvedCount,
      closedRecordWarning: period?.status === "closed" && records.length > 0,
      invoices: periodInvoices,
      invoiceTotal: periodInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.total ?? 0),
        0,
      ),
      month,
      observedCount,
      pendingCount,
      period,
      purchases: periodPurchases,
      purchaseTotal: periodPurchases.reduce(
        (sum, purchase) => sum + Number(purchase.total ?? 0),
        0,
      ),
      reviewedCount,
      year,
    } satisfies PeriodSummary;
  });
}

function PeriodActionForm({
  action,
  children,
  companyId,
  month,
  year,
  disabled,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  companyId: string;
  disabled?: boolean;
  month: number;
  year: number;
}) {
  return (
    <form action={action}>
      <input name="companyId" type="hidden" value={companyId} />
      <input name="periodYear" type="hidden" value={year} />
      <input name="periodMonth" type="hidden" value={month} />
      <button
        className="om7-btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled}
        type="submit"
      >
        {children}
      </button>
    </form>
  );
}

function PeriodCard({
  companyId,
  currency,
  summary,
}: {
  companyId: string;
  currency: string;
  summary: PeriodSummary;
}) {
  const status = summary.period?.status ?? "open";
  const cannotClose = summary.observedCount > 0 || summary.pendingCount > 0;

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),rgba(255,255,255,0.035)] p-5 shadow-2xl shadow-black/15">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className={getPeriodStatusBadgeClass(status)}>
            {getPeriodStatusLabel(status)}
          </span>
          <h2 className="mt-4 text-xl font-semibold capitalize text-white">
            {getPeriodLabel(summary.year, summary.month)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {summary.purchases.length} compras · {summary.invoices.length} facturas
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
            Movimiento
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {formatCurrencyAmount(
              summary.purchaseTotal + summary.invoiceTotal,
              currency,
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="mt-1 text-lg font-semibold text-amber-100">
            {summary.pendingCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Observados</p>
          <p className="mt-1 text-lg font-semibold text-rose-100">
            {summary.observedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Revisados</p>
          <p className="mt-1 text-lg font-semibold text-cyan-100">
            {summary.reviewedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Aprobados</p>
          <p className="mt-1 text-lg font-semibold text-emerald-100">
            {summary.approvedCount}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Monto compras</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {formatCurrencyAmount(summary.purchaseTotal, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Monto facturas</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">
            {formatCurrencyAmount(summary.invoiceTotal, currency)}
          </p>
        </div>
      </div>

      {summary.observedCount > 0 ? (
        <p className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-3 text-sm leading-6 text-rose-100">
          No se puede cerrar porque hay registros observados.
        </p>
      ) : summary.pendingCount > 0 ? (
        <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
          Revise los registros pendientes antes de cerrar el mes.
        </p>
      ) : status === "closed" ? (
        <p className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3 text-sm leading-6 text-emerald-100">
          Mes cerrado. Los documentos nuevos no se bloquean, pero deben
          revisarse con cuidado si pertenecen a este periodo.
        </p>
      ) : (
        <p className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3 text-sm leading-6 text-emerald-100">
          Listo para cerrar. No hay pendientes ni observados en este mes.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {summary.pendingCount > 0 ? (
          <>
            <Link
              className="om7-btn-ghost px-3 py-2 text-xs"
              href="/compras?filter=accounting_pending"
            >
              Ver pendientes compras
            </Link>
            <Link
              className="om7-btn-ghost px-3 py-2 text-xs"
              href="/facturas?filter=accounting_pending"
            >
              Ver pendientes facturas
            </Link>
          </>
        ) : null}
        {summary.observedCount > 0 ? (
          <Link className="om7-btn-ghost px-3 py-2 text-xs" href="/observados">
            Ver observados
          </Link>
        ) : null}
        {status !== "closed" ? (
          <>
            <PeriodActionForm
              action={markPeriodInReviewAction}
              companyId={companyId}
              month={summary.month}
              year={summary.year}
            >
              Marcar en revision
            </PeriodActionForm>
            <PeriodActionForm
              action={closePeriodAction}
              companyId={companyId}
              disabled={cannotClose}
              month={summary.month}
              year={summary.year}
            >
              Cerrar periodo
            </PeriodActionForm>
          </>
        ) : (
          <PeriodActionForm
            action={reopenPeriodAction}
            companyId={companyId}
            month={summary.month}
            year={summary.year}
          >
            Reabrir periodo
          </PeriodActionForm>
        )}
      </div>
    </article>
  );
}

export default async function AccountingPeriodsPage() {
  const [{ activeContext, purchases }, { invoices }, periodsResult] =
    await Promise.all([
      listPurchases(),
      getInvoicesForActiveCompany(),
      listAccountingPeriods(),
    ]);
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const summaries = buildPeriodSummaries({
    invoices,
    periods: periodsResult.periods,
    purchases,
  });
  const currentSummary = summaries[0];

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Periodos"
        description="Revision y cierre mensual por cliente/empresa."
        action={<BackLink />}
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona un cliente/empresa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Los periodos se calculan para el cliente/empresa activo.
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
          detail={activeCompany?.name ?? "Sin cliente activo"}
          label="Periodo actual"
          value={
            currentSummary
              ? getPeriodLabel(currentSummary.year, currentSummary.month)
              : "Sin periodo"
          }
        />
        <MetricCard
          detail="Registros del mes"
          label="Pendientes"
          value={String(currentSummary?.pendingCount ?? 0)}
        />
        <MetricCard
          detail="Bloquean el cierre"
          label="Observados"
          value={String(currentSummary?.observedCount ?? 0)}
        />
        <MetricCard
          detail="Estado del mes"
          label="Cierre"
          value={getPeriodStatusLabel(currentSummary?.period?.status)}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Cierre mensual simple
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Revise pendientes y observados antes de cerrar. No se crean
                asientos contables automaticos.
              </p>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
              {summaries.length} meses visibles
            </span>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto overscroll-contain p-5">
          <div className="grid gap-4">
            {activeCompany ? (
              summaries.map((summary) => (
                <PeriodCard
                  companyId={activeCompany.id}
                  currency={currency}
                  key={`${summary.year}-${summary.month}`}
                  summary={summary}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
                <p className="text-base font-semibold text-white">
                  No hay cliente/empresa activa.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Selecciona un cliente/empresa para revisar sus periodos.
                </p>
              </div>
            )}
          </div>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
