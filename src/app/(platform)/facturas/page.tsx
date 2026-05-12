import Link from "next/link";
import type { ReactNode } from "react";
import {
  registerInvoiceCollectionAction,
  updateInvoiceReviewStatusAction,
} from "@/app/(platform)/facturas/actions";
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
  getReviewStatusBadgeClass,
  getReviewStatusLabel,
} from "@/lib/accounting-review-ui";
import {
  canApproveRecord,
  canObserveRecord,
  canReopenReview,
  canReviewRecord,
  getRecordBusinessStateDescription,
  getRecordBusinessStateLabel,
  isRecordLockedByPeriod,
} from "@/lib/accounting-business-rules";
import {
  getPeriodLabel,
  getPeriodStatusBadgeClass,
  getPeriodStatusLabel,
  listAccountingPeriods,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import {
  listJournalEntriesForSources,
  type JournalEntry,
} from "@/lib/accounting-entries";
import { formatCurrencyAmount } from "@/lib/currency";
import {
  getConversionMetadataString,
  getConversionMetadataValue,
  hasE7MindTrace,
} from "@/lib/document-ui";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import {
  getCollectionStatusKey,
  getCollectionStatusLabel,
  getInvoiceCollectionSummary,
  getMovementStatusBadgeClass,
  getRemainingAmount,
  listPaymentMethods,
  type CollectionSummary,
  type PaymentMethod,
} from "@/lib/payments";

type InvoicesPageProps = {
  searchParams?: Promise<{
    error?: string;
    filter?: string;
    q?: string;
    returnLabel?: string;
    returnTo?: string;
  }>;
};

const statusLabels: Record<string, string> = {
  archivada: "Archivada",
  borrador: "Borrador",
  revision: "Revision",
  validada: "Validada",
};

const filterLabels: Record<string, string> = {
  all: "Todas",
  document: "Desde documento",
  counterparty: "Con contraparte",
  missing_counterparty: "Sin contraparte",
  high_confidence: "Alta confianza",
  pending: "Pendientes",
  accounting_pending: "Pendientes de revisar",
  accounting_reviewed: "Revisadas",
  accounting_approved: "Aprobadas",
  accounting_observed: "Observadas",
};

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function hasHighConfidence(invoice: Invoice) {
  return Number(invoice.classification_confidence ?? 0) >= 0.9;
}

function isPending(invoice: Invoice) {
  return invoice.estado === "borrador" || invoice.estado === "revision";
}

function hasAccountingStatus(invoice: Invoice, status: string) {
  return (invoice.review_status ?? "pending") === status;
}

function getInvoicePeriodDate(invoice: Invoice) {
  const rawDate = invoice.fecha ?? invoice.created_at;
  const date = rawDate ? new Date(rawDate) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getInvoicePeriod(invoice: Invoice, periods: AccountingPeriod[]) {
  const date = getInvoicePeriodDate(invoice);

  if (!date) {
    return null;
  }

  return (
    periods.find(
      (period) =>
        period.period_year === date.getFullYear() &&
        period.period_month === date.getMonth() + 1,
    ) ?? null
  );
}

function getInvoicePeriodLabel(invoice: Invoice) {
  const date = getInvoicePeriodDate(invoice);

  if (!date) {
    return "Sin periodo";
  }

  return getPeriodLabel(date.getFullYear(), date.getMonth() + 1);
}

function getInvoiceTraceDocumentId(invoice: Invoice) {
  return (
    invoice.source_document_id ??
    getConversionMetadataString(invoice.conversion_metadata, "source_document_id")
  );
}

function getSearchText(invoice: Invoice) {
  return [
    invoice.counterparty?.name,
    invoice.proveedor,
    invoice.tipo_documento,
    invoice.numero_documento,
    invoice.suggested_account,
    invoice.source_document?.display_name,
    invoice.source_document?.original_filename,
  ]
    .join(" ")
    .toLowerCase();
}

function filterInvoices(invoices: Invoice[], filter: string, searchTerm: string) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return invoices.filter((invoice) => {
    const matchesSearch =
      !normalizedSearch || getSearchText(invoice).includes(normalizedSearch);
    const matchesFilter =
      filter === "document"
        ? Boolean(invoice.source_document_id)
        : filter === "counterparty"
          ? Boolean(invoice.counterparty_id)
          : filter === "missing_counterparty"
            ? !invoice.counterparty_id
            : filter === "high_confidence"
              ? hasHighConfidence(invoice)
              : filter === "pending"
                ? isPending(invoice)
                : filter === "accounting_pending"
                  ? hasAccountingStatus(invoice, "pending")
                  : filter === "accounting_reviewed"
                    ? hasAccountingStatus(invoice, "reviewed")
                    : filter === "accounting_approved"
                      ? hasAccountingStatus(invoice, "approved")
                      : filter === "accounting_observed"
                        ? hasAccountingStatus(invoice, "observed")
                : true;

    return matchesSearch && matchesFilter;
  });
}

function ReviewStatusForm({
  invoiceId,
  redirectTo,
  status,
  children,
  className,
}: {
  invoiceId: string;
  redirectTo: string;
  status: string;
  children: ReactNode;
  className: string;
}) {
  return (
    <form action={updateInvoiceReviewStatusAction}>
      <input name="invoiceId" type="hidden" value={invoiceId} />
      <input name="reviewStatus" type="hidden" value={status} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function InvoiceCollectionForm({
  collected,
  invoice,
  locked,
  methods,
  redirectTo,
}: {
  collected: number;
  invoice: Invoice;
  locked: boolean;
  methods: PaymentMethod[];
  redirectTo: string;
}) {
  const remaining = getRemainingAmount(invoice.total, collected);

  if (remaining <= 0) {
    return null;
  }

  if (locked) {
    return (
      <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400">
        El periodo esta cerrado. Este cobro queda en solo lectura.
      </p>
    );
  }

  return (
    <details className="mt-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3">
      <summary className="cursor-pointer text-xs font-semibold text-emerald-100">
        Registrar cobro
      </summary>
      <form action={registerInvoiceCollectionAction} className="mt-3 grid gap-3">
        <input name="invoiceId" type="hidden" value={invoice.id} />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-slate-300">Metodo</span>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
              name="paymentMethodId"
              required
            >
              {methods.map((method) => (
                <option className="bg-slate-950" key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-300">Monto</span>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
              defaultValue={remaining.toFixed(2)}
              max={remaining.toFixed(2)}
              min="0"
              name="amount"
              step="0.01"
              type="number"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-300">Fecha</span>
            <input
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="collectionDate"
              type="date"
            />
          </label>
        </div>
        <input
          className="h-10 rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
          name="notes"
          placeholder="Nota opcional"
        />
        <button className="om7-btn-primary px-3 py-2 text-xs" type="submit">
          Guardar cobro
        </button>
      </form>
    </details>
  );
}

function InvoiceCard({
  collectionSummary,
  invoice,
  journalEntry,
  paymentMethods,
  period,
  redirectTo,
}: {
  collectionSummary: CollectionSummary | null;
  invoice: Invoice;
  journalEntry: JournalEntry | null;
  paymentMethods: PaymentMethod[];
  period: AccountingPeriod | null;
  redirectTo: string;
}) {
  const confidence = formatConfidence(invoice.classification_confidence);
  const ruleApplied =
    invoice.classification_rule_applied ??
    getConversionMetadataValue(
      invoice.conversion_metadata,
      "classification_rule_applied",
      "Sin regla registrada",
    );
  const title = invoice.counterparty?.name ?? invoice.proveedor;
  const sourceName =
    invoice.source_document?.display_name ??
    invoice.source_document?.original_filename ??
    "Documento procesado";
  const traceDocumentId = getInvoiceTraceDocumentId(invoice);
  const e7Synced = hasE7MindTrace(invoice.conversion_metadata);
  const lockedByPeriod = isRecordLockedByPeriod(period);
  const periodLabel = getInvoicePeriodLabel(invoice);
  const collectedAmount = collectionSummary?.amount ?? 0;
  const collectionStatus = getCollectionStatusKey(invoice.total, collectedAmount);
  const collectionLabel = getCollectionStatusLabel(invoice.total, collectedAmount);
  const remainingAmount = getRemainingAmount(invoice.total, collectedAmount);
  const reviewActionLabel =
    (invoice.review_status ?? "pending") === "observed"
      ? "Marcar corregido"
      : "Marcar revisada";
  const isPosted = journalEntry?.status === "posted";

  return (
    <article className="min-w-0 rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.08),transparent_34%),rgba(255,255,255,0.035)] p-3 shadow-2xl shadow-black/15 transition hover:border-emerald-300/20 hover:bg-white/[0.05] sm:p-5">
      <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {invoice.source_document_id ? (
              <span className="om7-chip om7-chip-cyan">Desde documento</span>
            ) : (
              <span className="om7-chip text-slate-400">Manual</span>
            )}
            {e7Synced ? (
              <span className="om7-chip om7-chip-emerald">
                Sincronizado con E7 Mind
              </span>
            ) : null}
            {invoice.counterparty_id ? (
              <span className="om7-chip om7-chip-emerald">Contraparte</span>
            ) : (
              <span className="om7-chip om7-chip-amber">Sin contraparte</span>
            )}
            <StatusBadge>{statusLabels[invoice.estado] ?? invoice.estado}</StatusBadge>
            <span className={getReviewStatusBadgeClass(invoice.review_status)}>
              {getReviewStatusLabel(invoice.review_status)}
            </span>
            {lockedByPeriod ? (
              <span className={getPeriodStatusBadgeClass(period?.status)}>
                Periodo cerrado
              </span>
            ) : null}
            {isPosted ? (
              <span className="om7-chip om7-chip-emerald">Contabilizada</span>
            ) : null}
            <span className={getMovementStatusBadgeClass(collectionStatus)}>
              {collectionLabel}
            </span>
          </div>

          <h3 className="mt-4 break-words text-lg font-semibold text-white">
            {title}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-500">
            {invoice.numero_documento ?? "Sin numero"} ·{" "}
            {invoice.fecha ?? "Sin fecha"}
          </p>
          <p className="mt-1 break-words text-xs text-slate-600">
            Periodo: {periodLabel}
            {period ? ` · ${getPeriodStatusLabel(period.status)}` : ""}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-left lg:text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
            Total
          </p>
          <p className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
            {formatMoney(invoice.total, invoice.moneda)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Tipo</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {invoice.tipo_documento ?? "Factura"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Cuenta sugerida</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {invoice.suggested_account ?? "Sin cuenta"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Sugerencia OM7</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {confidence ? `Confianza ${confidence}` : "Sin confianza"}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
              Cobro
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {collectionLabel} · cobrado {formatMoney(collectedAmount, invoice.moneda)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Saldo pendiente: {formatMoney(remainingAmount, invoice.moneda)}
            </p>
          </div>
          <span className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-slate-300">
            {collectionSummary?.items[0]?.payment_method?.name ?? "Sin movimiento"}
          </span>
        </div>
        <InvoiceCollectionForm
          collected={collectedAmount}
          invoice={invoice}
          locked={lockedByPeriod}
          methods={paymentMethods}
          redirectTo={redirectTo}
        />
      </div>

      <details className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
          Trazabilidad OM7
        </summary>
        <div className="mt-3">
          <p className="text-sm text-slate-300">
            Origen: {traceDocumentId ? sourceName : "Registro manual"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Regla aplicada: {ruleApplied}
          </p>
          {e7Synced ? (
            <p className="mt-2 text-sm text-emerald-100/80">
              Distribucion aprobada y vinculada al registro. Puedes reabrir E7
              Mind para validar y sincronizar de nuevo sin duplicar.
            </p>
          ) : null}
        </div>
      </details>

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Revision del registro
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {getRecordBusinessStateLabel(invoice, period)}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {getRecordBusinessStateDescription(invoice, period)}
            </p>
            {invoice.review_notes ? (
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Nota: {invoice.review_notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            {canReopenReview(invoice, period) ? (
              <ReviewStatusForm
                className="om7-btn-secondary px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
                status="pending"
              >
                Reabrir revision
              </ReviewStatusForm>
            ) : null}
            {canReviewRecord(invoice, period) ? (
              <ReviewStatusForm
                className="om7-btn-secondary px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
                status="reviewed"
              >
                {reviewActionLabel}
              </ReviewStatusForm>
            ) : null}
            {canApproveRecord(invoice, period) ? (
              <ReviewStatusForm
                className="om7-btn-primary px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
                status="approved"
              >
                Aprobar
              </ReviewStatusForm>
            ) : null}
          </div>
        </div>

        {lockedByPeriod ? (
          <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400">
            Las acciones de revision quedan deshabilitadas porque el periodo
            esta cerrado.
          </p>
        ) : null}

        {canObserveRecord(invoice, period) ? (
        <details className="mt-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-amber-100">
            Observar con nota
          </summary>
          <form action={updateInvoiceReviewStatusAction} className="mt-3 space-y-3">
            <input name="invoiceId" type="hidden" value={invoice.id} />
            <input name="reviewStatus" type="hidden" value="observed" />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <textarea
              className="min-h-20 w-full rounded-xl border border-amber-200/15 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-200/40 focus:ring-4 focus:ring-amber-200/10"
              name="reviewNotes"
              placeholder="Motivo de la observacion..."
              required
            />
            <button className="om7-btn-secondary px-3 py-2 text-xs" type="submit">
              Guardar observacion
            </button>
          </form>
        </details>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {traceDocumentId ? (
          <Link
            className="om7-btn-secondary px-4 py-2.5"
            href={`/documentos/${traceDocumentId}`}
          >
            Ver documento
          </Link>
        ) : null}
        {e7Synced && traceDocumentId ? (
          <Link
            className="om7-btn-primary px-4 py-2.5"
            href={`/documentos/${traceDocumentId}/distribucion`}
          >
            Abrir E7 Mind
          </Link>
        ) : null}
        {invoice.counterparty_id ? (
          <Link
            className="om7-btn-ghost px-4 py-2.5"
            href={`/contrapartes/${invoice.counterparty_id}`}
          >
            Ver contraparte
          </Link>
        ) : null}
      </div>

      {(invoice.review_status ?? "pending") === "approved" ? (
        <div className="mt-5">
          <JournalEntryCard
            currency={invoice.moneda}
            entry={journalEntry}
            locked={lockedByPeriod}
            lockedReason="Periodo cerrado. El asiento queda solo lectura."
            redirectTo={redirectTo}
            sourceId={invoice.id}
            sourceType="invoice"
          />
        </div>
      ) : null}
    </article>
  );
}

export default async function InvoicesPage({
  searchParams,
}: InvoicesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedSearchParams.filter ?? "all";
  const actionError = resolvedSearchParams.error ?? null;
  const searchTerm = resolvedSearchParams.q ?? "";
  const returnTo = resolvedSearchParams.returnTo?.startsWith("/")
    ? resolvedSearchParams.returnTo
    : "/dashboard";
  const returnLabel = resolvedSearchParams.returnLabel ?? "Volver al dashboard";
  const returnQuery =
    returnTo !== "/dashboard"
      ? `&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`
      : "";
  const redirectTo = `/facturas?filter=${activeFilter}${
    searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""
  }${returnQuery}`;
  const [
    { activeContext, invoices },
    periodsResult,
    paymentMethodsResult,
  ] = await Promise.all([
    getInvoicesForActiveCompany(),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
    listPaymentMethods().catch(() => ({
      methods: [] as PaymentMethod[],
    })),
  ]);
  const periods = periodsResult.periods;
  const paymentMethods = paymentMethodsResult.methods;
  const invoiceCollectionMap = await getInvoiceCollectionSummary(
    invoices.map((invoice) => invoice.id),
  ).catch(() => new Map<string, CollectionSummary>());
  const invoiceEntryMap = await listJournalEntriesForSources(
    "invoice",
    invoices.map((invoice) => invoice.id),
  ).catch(() => new Map<string, JournalEntry>());
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = activeCompany?.base_currency ?? organization?.base_currency ?? "CRC";
  const filteredInvoices = filterInvoices(invoices, activeFilter, searchTerm);
  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );
  const fromDocumentCount = invoices.filter(
    (invoice) => invoice.source_document_id,
  ).length;
  const pendingCount = invoices.filter(isPending).length;
  const missingTraceCount = invoices.filter(
    (invoice) => !invoice.counterparty_id || !invoice.source_document_id,
  ).length;
  const pendingReviewCount = invoices.filter((invoice) =>
    hasAccountingStatus(invoice, "pending"),
  ).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Facturas"
        description="Control operativo de ingresos, clientes y documentos convertidos."
        action={
            <div className="flex flex-wrap gap-2">
              <BackLink href={returnTo} label={returnLabel} />
            <Link className="om7-btn-primary px-4 py-2.5" href="/facturas/nueva">
              Nueva factura
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
            Selecciona una empresa activa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Las facturas deben registrarse bajo una empresa. Ve a Empresas y
            usa el boton Usar como activa para definir el contexto de trabajo.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={activeCompany?.name ?? "Sin empresa activa"}
          label="Total facturas"
          value={String(invoices.length)}
        />
        <MetricCard
          detail={currency}
          label="Monto total"
          value={formatMoney(totalAmount, currency)}
        />
        <MetricCard
          detail="Tienen documento origen"
          label="Desde documento"
          value={String(fromDocumentCount)}
        />
        <MetricCard
          detail={`Pendientes ${pendingCount} · por completar ${missingTraceCount}`}
          label="Por revisar"
          value={String(pendingReviewCount)}
        />
      </section>

      <section>
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Bandeja de facturas
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Revisión, cobro y trazabilidad en una sola bandeja.
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {filteredInvoices.length} de {invoices.length} visibles
                </span>
              </div>

              <form className="grid gap-2 lg:grid-cols-[1fr_auto]" method="get">
                <input
                  className="h-12 min-w-0 rounded-2xl border border-white/[0.1] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={searchTerm}
                  name="q"
                  placeholder="Buscar por cliente, documento, tipo o cuenta..."
                />
                <input name="filter" type="hidden" value={activeFilter} />
                <button className="om7-btn-secondary h-12 px-5" type="submit">
                  Buscar
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {Object.entries(filterLabels).map(([filter, label]) => (
                  <Link
                    className={[
                      "rounded-full border px-3 py-2 text-xs font-semibold transition",
                      activeFilter === filter
                        ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                        : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
                    ].join(" ")}
                    href={`/facturas?filter=${filter}${
                      searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""
                    }${returnQuery}`}
                    key={filter}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="grid gap-4">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <InvoiceCard
                  collectionSummary={invoiceCollectionMap.get(invoice.id) ?? null}
                  invoice={invoice}
                  journalEntry={invoiceEntryMap.get(invoice.id) ?? null}
                  key={invoice.id}
                  paymentMethods={paymentMethods}
                  period={getInvoicePeriod(invoice, periods)}
                  redirectTo={redirectTo}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
                <p className="text-base font-semibold text-white">
                  Sin facturas para esta vista
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Ajusta los filtros o crea una factura desde un documento
                  revisado.
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
