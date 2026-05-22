import Link from "next/link";
import type { ReactNode } from "react";
import {
  generateInvoiceAccountingEntryAction,
  registerInvoiceCollectionAction,
  revertInvoiceAccountingEntryAction,
  updateInvoiceAccountingFieldsAction,
  updateInvoiceReviewStatusAction,
} from "@/app/(platform)/facturas/actions";
import { AccountingAmountCalculator } from "@/components/accounting/accounting-amount-calculator";
import {
  BackLink,
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
import {
  getAccountingCorrectionOptions,
  type AccountingCorrectionOptions,
} from "@/lib/accounting-correction-options";
import {
  getInvoiceIssuerCompanyLabel,
  getInvoicesForActiveCompany,
  type Invoice,
} from "@/lib/invoices";
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
    invoice?: string;
    q?: string;
    returnLabel?: string;
    returnTo?: string;
    tab?: string;
  }>;
};

type InvoiceWorkspaceTab = "summary" | "lines" | "taxes" | "trace" | "history";

const invoiceWorkspaceTabs: Array<{ key: InvoiceWorkspaceTab; label: string }> = [
  { key: "summary", label: "Resumen" },
  { key: "lines", label: "Lineas" },
  { key: "taxes", label: "Impuestos" },
  { key: "trace", label: "Trazabilidad" },
  { key: "history", label: "Historial" },
];

const statusLabels: Record<string, string> = {
  archivada: "Archivada",
  borrador: "Borrador",
  revision: "Revision",
  validada: "Validada",
};

const invoiceTypeOptions = [
  "factura",
  "venta",
  "recibo",
  "tiquete",
  "nota_credito",
  "nota_debito",
];

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

function getInvoiceAccountingStatusLabel(status: string | null | undefined) {
  if (status === "borrador") {
    return "Borrador contable";
  }

  if (status === "contabilizado") {
    return "Contabilizado";
  }

  if (status === "anulado") {
    return "Anulado contable";
  }

  if (status === "error") {
    return "Error contable";
  }

  return "Pendiente contable";
}

function getInvoiceAccountingStatusClass(status: string | null | undefined) {
  if (status === "borrador") {
    return "om7-chip om7-chip-cyan";
  }

  if (status === "contabilizado") {
    return "om7-chip om7-chip-emerald";
  }

  if (status === "anulado") {
    return "om7-chip text-slate-400";
  }

  if (status === "error") {
    return "om7-chip om7-chip-rose";
  }

  return "om7-chip om7-chip-amber";
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

function buildInvoicesHref({
  filter,
  invoiceId,
  q,
  returnQuery,
  tab,
}: {
  filter: string;
  invoiceId?: string;
  q: string;
  returnQuery: string;
  tab?: string;
}) {
  const params = new URLSearchParams();

  if (filter && filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  if (invoiceId) params.set("invoice", invoiceId);
  if (tab && tab !== "summary") params.set("tab", tab);

  const query = params.toString();
  const returnSuffix = returnQuery ? `${query ? "&" : "?"}${returnQuery.slice(1)}` : "";

  return `/facturas${query ? `?${query}` : ""}${returnSuffix}`;
}

function InvoiceDataCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_0_rgba(0,0,0,0.18)] ring-1 ring-white/[0.035]">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function InvoiceSidebarPanel({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
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

function InvoiceAccountingForm({
  action,
  children,
  className,
  invoiceId,
  motivo,
  redirectTo,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  invoiceId: string;
  motivo?: string;
  redirectTo: string;
}) {
  return (
    <form action={action}>
      <input name="invoiceId" type="hidden" value={invoiceId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {motivo ? <input name="motivo" type="hidden" value={motivo} /> : null}
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
  issuerCompanyLabel,
  journalEntry,
  options,
  paymentMethods,
  period,
  redirectTo,
}: {
  collectionSummary: CollectionSummary | null;
  invoice: Invoice;
  issuerCompanyLabel: string;
  journalEntry: JournalEntry | null;
  options: AccountingCorrectionOptions;
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
  const accountingStatus = invoice.estado_contable ?? "pendiente";
  const actualAsiento = invoice.asiento_contable;
  const canGenerateAccounting =
    !lockedByPeriod &&
    ["reviewed", "approved"].includes(String(invoice.review_status ?? "")) &&
    accountingStatus !== "contabilizado";

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
            <span className={getInvoiceAccountingStatusClass(accountingStatus)}>
              {getInvoiceAccountingStatusLabel(accountingStatus)}
            </span>
            <span className={getMovementStatusBadgeClass(collectionStatus)}>
              {collectionLabel}
            </span>
          </div>

          <h3 className="mt-4 break-words text-lg font-semibold text-white">
            {title}
          </h3>
          <p className="mt-2 break-words text-sm text-slate-400">
            Emisor: {issuerCompanyLabel}
          </p>
          <p className="mt-1 break-words text-sm text-slate-500">
            Cliente / receptor: {title}
          </p>
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

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
              Contabilizacion oficial
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {getInvoiceAccountingStatusLabel(accountingStatus)}
              {actualAsiento ? ` - Asiento #${actualAsiento.numero_asiento}` : ""}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              El asiento real se genera desde reglas contables de ventas y
              alimenta mayor, balance y estados financieros.
            </p>
            {invoice.contabilizacion_error ? (
              <p className="mt-2 text-sm leading-6 text-rose-100/80">
                {invoice.contabilizacion_error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            {invoice.asiento_contable_id ? (
              <Link
                className="om7-btn-secondary px-3 py-2 text-xs"
                href={`/contabilidad/asientos/${invoice.asiento_contable_id}`}
              >
                Ver asiento
              </Link>
            ) : null}
            {canGenerateAccounting ? (
              <InvoiceAccountingForm
                action={generateInvoiceAccountingEntryAction}
                className="om7-btn-primary px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
              >
                {accountingStatus === "error" || accountingStatus === "anulado"
                  ? "Recontabilizar"
                  : "Generar asiento"}
              </InvoiceAccountingForm>
            ) : null}
            {accountingStatus === "borrador" ? (
              <InvoiceAccountingForm
                action={revertInvoiceAccountingEntryAction}
                className="om7-btn-ghost px-3 py-2 text-xs"
                invoiceId={invoice.id}
                motivo="Reversion de borrador contable de venta"
                redirectTo={redirectTo}
              >
                Anular borrador
              </InvoiceAccountingForm>
            ) : null}
          </div>
        </div>
      </div>

      {accountingStatus !== "contabilizado" ? (
        <details
          className={`mt-4 rounded-2xl border p-4 ${
            accountingStatus === "error"
              ? "border-rose-300/20 bg-rose-300/[0.045]"
              : "border-white/[0.07] bg-black/15"
          }`}
          open={accountingStatus === "error"}
        >
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/75">
            Corregir para contabilizar
          </summary>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Ajusta el tipo, cliente receptor, montos y cuenta sugerida que
            alimentan la regla contable. El emisor siempre es la empresa activa.
            Al guardar se limpia el error para poder continuar.
          </p>
          <form
            action={updateInvoiceAccountingFieldsAction}
            className="mt-4 grid gap-3 md:grid-cols-3"
          >
            <input name="invoiceId" type="hidden" value={invoice.id} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-300">Cliente / receptor</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.proveedor ?? ""}
                name="proveedor"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Numero</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.numero_documento ?? ""}
                name="numeroDocumento"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Fecha</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.fecha ?? ""}
                name="fecha"
                type="date"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Tipo contable</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.tipo_documento ?? "factura"}
                list={`invoice-accounting-types-${invoice.id}`}
                name="tipoDocumento"
                required
              />
            </label>
            <datalist id={`invoice-accounting-types-${invoice.id}`}>
              {(options.saleTypes.length > 0
                ? options.saleTypes
                : invoiceTypeOptions.map((value) => ({ label: value, value }))
              ).map((type) => (
                <option key={type.value} label={type.label} value={type.value} />
              ))}
            </datalist>
            <label className="block">
              <span className="text-xs text-slate-300">Cuenta sugerida</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.suggested_account ?? ""}
                list={`invoice-accounting-accounts-${invoice.id}`}
                name="suggestedAccount"
                placeholder="Ingreso operativo"
              />
            </label>
            <datalist id={`invoice-accounting-accounts-${invoice.id}`}>
              {options.accounts.map((account) => (
                <option key={account.value} label={account.label} value={account.value} />
              ))}
            </datalist>
            <AccountingAmountCalculator
              subtotal={invoice.subtotal}
              tax={invoice.impuesto}
              taxFieldName="impuesto"
              taxName="Impuesto"
              total={invoice.total}
            />
            <label className="block">
              <span className="text-xs text-slate-300">Centro de costo</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.suggested_cost_center_id ?? ""}
                list={`invoice-cost-centers-${invoice.id}`}
                name="suggestedCostCenterId"
                placeholder="Opcional"
              />
            </label>
            <datalist id={`invoice-cost-centers-${invoice.id}`}>
              {options.centrosCosto.map((centro) => (
                <option key={centro.value} label={centro.label} value={centro.value} />
              ))}
            </datalist>
            <label className="block md:col-span-3">
              <span className="text-xs text-slate-300">Notas</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-300/10"
                defaultValue={invoice.notas ?? ""}
                name="notas"
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-3">
              <button className="om7-btn-secondary px-3 py-2 text-xs" type="submit">
                Guardar correccion
              </button>
              <button
                className="om7-btn-primary px-3 py-2 text-xs"
                name="reprocess"
                type="submit"
                value="true"
              >
                Guardar y recontabilizar
              </button>
            </div>
          </form>
        </details>
      ) : null}

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

function InvoiceConsoleStat({
  detail,
  label,
  tone = "muted",
  value,
}: {
  detail: string;
  label: string;
  tone?: "critical" | "primary" | "success" | "muted";
  value: number | string;
}) {
  const toneClass = {
    critical:
      "border-rose-300/28 bg-[linear-gradient(180deg,rgba(251,113,133,0.12),rgba(255,255,255,0.028))] ring-rose-300/[0.08]",
    muted:
      "border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.024))] ring-white/[0.025]",
    primary:
      "border-cyan-300/24 bg-[linear-gradient(180deg,rgba(34,211,238,0.11),rgba(255,255,255,0.026))] ring-cyan-300/[0.07]",
    success:
      "border-emerald-300/22 bg-[linear-gradient(180deg,rgba(52,211,153,0.1),rgba(255,255,255,0.026))] ring-emerald-300/[0.06]",
  }[tone];

  return (
    <div className={`rounded-2xl border p-3.5 shadow-xl shadow-black/16 ring-1 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function InvoiceResultsTable({
  hrefForInvoice,
  invoices,
}: {
  hrefForInvoice: (invoiceId: string) => string;
  invoices: Invoice[];
}) {
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
      <div className="grid grid-cols-[minmax(0,1.5fr)_120px_120px_120px_auto] gap-3 border-b border-white/[0.08] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 max-lg:hidden">
        <span>Cliente</span>
        <span>Fecha</span>
        <span>Total</span>
        <span>Estado</span>
        <span />
      </div>
      <div className="h-full min-h-0 overflow-y-auto p-2 om7-scrollbar">
        {invoices.length > 0 ? (
          <div className="grid gap-2">
            {invoices.map((invoice) => {
              const title = invoice.counterparty?.name ?? invoice.proveedor;

              return (
                <Link
                  className="grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3 transition hover:border-emerald-300/24 hover:bg-emerald-300/[0.055] lg:grid-cols-[minmax(0,1.5fr)_120px_120px_120px_auto] lg:items-center"
                  href={hrefForInvoice(invoice.id)}
                  key={invoice.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {invoice.numero_documento ?? "Sin documento"} · {invoice.tipo_documento ?? "factura"}
                    </p>
                  </div>
                  <span className="text-sm text-slate-400">{invoice.fecha ?? "Sin fecha"}</span>
                  <span className="text-sm font-semibold text-slate-100">
                    {formatMoney(invoice.total, invoice.moneda)}
                  </span>
                  <span className={getReviewStatusBadgeClass(invoice.review_status)}>
                    {getReviewStatusLabel(invoice.review_status)}
                  </span>
                  <span className="w-fit rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-emerald-100">
                    Revisar
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
            <div>
              <p className="text-base font-semibold text-white">Sin ventas para esta vista</p>
              <p className="mt-2 text-sm text-slate-500">
                Ajusta los filtros o registra una venta desde documentos.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceDetailWorkspace({
  activeTab,
  backHref,
  collectionSummary,
  invoice,
  issuerCompanyLabel,
  journalEntry,
  options,
  paymentMethods,
  period,
  redirectTo,
  tabHref,
}: {
  activeTab: InvoiceWorkspaceTab;
  backHref: string;
  collectionSummary: CollectionSummary | null;
  invoice: Invoice;
  issuerCompanyLabel: string;
  journalEntry: JournalEntry | null;
  options: AccountingCorrectionOptions;
  paymentMethods: PaymentMethod[];
  period: AccountingPeriod | null;
  redirectTo: string;
  tabHref: (tab: InvoiceWorkspaceTab) => string;
}) {
  const title = invoice.counterparty?.name ?? invoice.proveedor;
  const accountingStatus = invoice.estado_contable ?? "pendiente";
  const traceDocumentId = getInvoiceTraceDocumentId(invoice);
  const sourceName =
    invoice.source_document?.display_name ??
    invoice.source_document?.original_filename ??
    "Documento procesado";
  const ruleApplied =
    invoice.classification_rule_applied ??
    getConversionMetadataValue(
      invoice.conversion_metadata,
      "classification_rule_applied",
      "Sin regla registrada",
    );
  const lockedByPeriod = isRecordLockedByPeriod(period);
  const collectedAmount = collectionSummary?.amount ?? 0;
  const collectionStatus = getCollectionStatusKey(invoice.total, collectedAmount);
  const collectionLabel = getCollectionStatusLabel(invoice.total, collectedAmount);
  const remainingAmount = getRemainingAmount(invoice.total, collectedAmount);
  const total = Number(invoice.total ?? 0);
  const subtotal = Number(invoice.subtotal ?? 0);
  const tax = Number(invoice.impuesto ?? 0);
  const hasInvalidAmounts = !Number.isFinite(total) || total <= 0;
  const hasTaxMismatch =
    Number.isFinite(subtotal) &&
    Number.isFinite(tax) &&
    Number.isFinite(total) &&
    total > 0 &&
    Math.abs(subtotal + tax - total) > 1;
  const isPosted =
    accountingStatus === "contabilizado" ||
    journalEntry?.status === "posted" ||
    Boolean(invoice.asiento_contable_id);
  const canCreateEntry =
    !lockedByPeriod &&
    !isPosted &&
    !hasInvalidAmounts &&
    !hasTaxMismatch &&
    !invoice.contabilizacion_error &&
    ["reviewed", "approved"].includes(String(invoice.review_status ?? ""));
  const resolution = hasInvalidAmounts
    ? {
        action: (
          <Link className="om7-btn-primary justify-center px-3 py-2 text-xs" href={tabHref("taxes")}>
            Corregir importes
          </Link>
        ),
        state: "Requiere correccion",
        problem: "Total de venta en cero",
        recommendation: "Revise subtotal, IVA y total antes de contabilizar.",
      }
    : hasTaxMismatch || invoice.contabilizacion_error
      ? {
          action: (
            <Link className="om7-btn-primary justify-center px-3 py-2 text-xs" href={tabHref("taxes")}>
              Revisar impuestos
            </Link>
          ),
          state: "Requiere correccion",
          problem: hasTaxMismatch ? "Diferencia en importes" : "Error contable",
          recommendation: invoice.contabilizacion_error ?? "Cuadre los importes antes de continuar.",
        }
      : String(invoice.review_status ?? "pending") !== "approved"
        ? {
            action: canApproveRecord(invoice, period) ? (
              <ReviewStatusForm
                className="om7-btn-secondary justify-center px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
                status="approved"
              >
                Aprobar venta
              </ReviewStatusForm>
            ) : null,
            state: "Pendiente de revision",
            problem: "Aprobacion pendiente",
            recommendation: "Revise los datos principales y apruebe la venta.",
          }
        : canCreateEntry
          ? {
              action: (
                <InvoiceAccountingForm
                  action={generateInvoiceAccountingEntryAction}
                  className="om7-btn-primary justify-center px-3 py-2 text-xs"
                  invoiceId={invoice.id}
                  redirectTo={redirectTo}
                >
                  Crear asiento
                </InvoiceAccountingForm>
              ),
              state: "Lista para contabilizar",
              problem: "Asiento pendiente",
              recommendation: "Genere el asiento para registrar el ingreso.",
            }
          : {
              action: null,
              state: "Operativa",
              problem: "Sin bloqueos operativos",
              recommendation: "Consulte trazabilidad, cobros o historial segun necesite.",
            };

  return (
    <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <PremiumCard className="flex-shrink-0 overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link className="om7-btn-ghost mb-3 inline-flex px-3 py-2 text-sm" href={backHref}>
              &lt;- Volver a ventas
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <span className={getReviewStatusBadgeClass(invoice.review_status)}>
                {getReviewStatusLabel(invoice.review_status)}
              </span>
              <span className={getInvoiceAccountingStatusClass(accountingStatus)}>
                {getInvoiceAccountingStatusLabel(accountingStatus)}
              </span>
              <span className={getMovementStatusBadgeClass(collectionStatus)}>
                {collectionLabel}
              </span>
              {traceDocumentId ? (
                <span className="om7-chip om7-chip-cyan">Con documento</span>
              ) : (
                <span className="om7-chip text-slate-400">Manual</span>
              )}
            </div>
            <h2 className="mt-4 max-w-5xl break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {invoice.numero_documento ?? "Sin documento"} · {invoice.fecha ?? "Sin fecha"} ·{" "}
              {formatMoney(invoice.total, invoice.moneda)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasInvalidAmounts || hasTaxMismatch || invoice.contabilizacion_error ? (
              <Link className="om7-btn-primary px-3 py-2 text-xs" href={tabHref("taxes")}>
                Corregir importes
              </Link>
            ) : canCreateEntry ? (
              <InvoiceAccountingForm
                action={generateInvoiceAccountingEntryAction}
                className="om7-btn-primary px-3 py-2 text-xs"
                invoiceId={invoice.id}
                redirectTo={redirectTo}
              >
                Crear asiento
              </InvoiceAccountingForm>
            ) : invoice.asiento_contable_id ? (
              <Link
                className="om7-btn-secondary px-3 py-2 text-xs"
                href={`/contabilidad/asientos/${invoice.asiento_contable_id}`}
              >
                Ver asiento
              </Link>
            ) : null}
          </div>
        </div>
      </PremiumCard>

      <div className="grid min-h-0 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(18rem,20rem)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.026]">
          <div className="flex flex-wrap gap-2 border-b border-white/[0.08] p-3">
            {invoiceWorkspaceTabs.map((tab) => (
              <Link
                className={[
                  "rounded-full border px-3 py-2 text-xs font-semibold transition",
                  activeTab === tab.key
                    ? "border-emerald-300/34 bg-emerald-300/12 text-emerald-100"
                    : "border-white/[0.08] bg-white/[0.035] text-slate-400 hover:text-white",
                ].join(" ")}
                href={tabHref(tab.key)}
                key={tab.key}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="min-h-0 overflow-y-auto p-4 om7-scrollbar">
            {activeTab === "summary" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InvoiceDataCell label="Cliente" value={title} />
                  <InvoiceDataCell label="Emisor" value={issuerCompanyLabel} />
                  <InvoiceDataCell label="Documento" value={invoice.numero_documento ?? "Sin numero"} />
                  <InvoiceDataCell label="Periodo" value={getInvoicePeriodLabel(invoice)} />
                  <InvoiceDataCell label="Total" value={formatMoney(invoice.total, invoice.moneda)} />
                  <InvoiceDataCell label="Cobro" value={`${collectionLabel} · ${formatMoney(collectedAmount, invoice.moneda)}`} />
                  <InvoiceDataCell label="Saldo" value={formatMoney(remainingAmount, invoice.moneda)} />
                  <InvoiceDataCell label="Contraparte" value={invoice.counterparty?.name ?? "Sin contraparte"} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {getRecordBusinessStateDescription(invoice, period)}
                </p>
              </>
            ) : null}

            {activeTab === "lines" ? (
              <form
                action={updateInvoiceAccountingFieldsAction}
                className="grid gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] md:grid-cols-3"
              >
                <input name="invoiceId" type="hidden" value={invoice.id} />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <div className="md:col-span-3">
                  <p className="text-sm font-semibold text-white">Lineas y clasificacion</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Ajuste cliente, documento, tipo y cuenta contable sugerida.
                  </p>
                </div>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Cliente / receptor</span>
                  <input className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.proveedor ?? ""} name="proveedor" required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Documento</span>
                  <input className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.numero_documento ?? ""} name="numeroDocumento" />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Tipo</span>
                  <input className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.tipo_documento ?? "factura"} list={`invoice-workspace-types-${invoice.id}`} name="tipoDocumento" />
                  <datalist id={`invoice-workspace-types-${invoice.id}`}>
                    {(options.saleTypes.length > 0
                      ? options.saleTypes
                      : invoiceTypeOptions.map((value) => ({ label: value, value }))
                    ).map((type) => (
                      <option key={type.value} label={type.label} value={type.value} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Cuenta sugerida</span>
                  <input className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.suggested_account ?? ""} list={`invoice-workspace-accounts-${invoice.id}`} name="suggestedAccount" />
                  <datalist id={`invoice-workspace-accounts-${invoice.id}`}>
                    {options.accounts.map((account) => (
                      <option key={account.value} label={account.label} value={account.value} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-300">Fecha</span>
                  <input className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.fecha ?? ""} name="fecha" type="date" />
                </label>
                <label className="block md:col-span-3">
                  <span className="text-xs font-medium text-slate-300">Notas</span>
                  <textarea className="mt-1.5 min-h-24 w-full rounded-xl border border-white/[0.16] bg-white/[0.065] px-3 py-2 text-sm text-white outline-none ring-1 ring-white/[0.035] focus:border-emerald-300/45" defaultValue={invoice.notas ?? ""} name="notas" />
                </label>
                <button className="om7-btn-secondary w-fit px-3 py-2 text-xs md:col-span-3" type="submit">
                  Guardar cambios
                </button>
              </form>
            ) : null}

            {activeTab === "taxes" ? (
              <form action={updateInvoiceAccountingFieldsAction} className="grid gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.035] p-4 md:grid-cols-3">
                <input name="invoiceId" type="hidden" value={invoice.id} />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <AccountingAmountCalculator
                  subtotal={invoice.subtotal}
                  tax={invoice.impuesto}
                  taxFieldName="impuesto"
                  taxName="Impuesto"
                  total={invoice.total}
                />
                <button className="om7-btn-secondary w-fit px-3 py-2 text-xs md:col-span-3" type="submit">
                  Guardar importes
                </button>
              </form>
            ) : null}

            {activeTab === "trace" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InvoiceDataCell label="Origen" value={traceDocumentId ? sourceName : "Registro manual"} />
                  <InvoiceDataCell label="Regla" value={ruleApplied} />
                  <InvoiceDataCell label="Confianza" value={formatConfidence(invoice.classification_confidence) ?? "Sin IA"} />
                  <InvoiceDataCell label="E7 Mind" value={hasE7MindTrace(invoice.conversion_metadata) ? "Sincronizado" : "Sin sincronizacion"} />
                </div>
                {journalEntry ? (
                  <div className="mt-4">
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
              </>
            ) : null}

            {activeTab === "history" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InvoiceDataCell label="Creada" value={invoice.created_at ?? "Sin fecha"} />
                  <InvoiceDataCell label="Revision" value={getReviewStatusLabel(invoice.review_status)} />
                  <InvoiceDataCell label="Contabilidad" value={getInvoiceAccountingStatusLabel(accountingStatus)} />
                  <InvoiceDataCell label="Estado" value={statusLabels[invoice.estado] ?? invoice.estado} />
                </div>
                <InvoiceCollectionForm
                  collected={collectedAmount}
                  invoice={invoice}
                  locked={lockedByPeriod}
                  methods={paymentMethods}
                  redirectTo={redirectTo}
                />
              </>
            ) : null}
          </div>
        </div>

        <aside className="grid min-h-0 min-w-0 content-start gap-3 overflow-hidden">
          <InvoiceSidebarPanel className="border-emerald-300/16 bg-emerald-300/[0.045]" title="Centro de resolucion">
            <div className="grid gap-3">
              <div className="rounded-xl border border-white/[0.1] bg-white/[0.055] p-3">
                <p className="text-xs text-slate-400">Estado actual</p>
                <p className="mt-1 text-sm font-semibold text-white">{resolution.state}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Problema detectado</p>
                <p className="mt-1 text-sm font-semibold text-white">{resolution.problem}</p>
              </div>
              <p className="text-xs leading-5 text-slate-400">{resolution.recommendation}</p>
              <div className="[&_a]:w-full [&_a]:justify-center [&_button]:w-full">
                {resolution.action}
              </div>
            </div>
          </InvoiceSidebarPanel>

          <InvoiceSidebarPanel title="Estado y cobro">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Total</span>
                <span className={hasInvalidAmounts ? "font-semibold text-amber-100" : "font-semibold text-white"}>
                  {formatMoney(invoice.total, invoice.moneda)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Cobro</span>
                <span className="text-emerald-100">{collectionLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Saldo</span>
                <span className="text-slate-300">{formatMoney(remainingAmount, invoice.moneda)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Asiento</span>
                <span className={isPosted ? "text-emerald-100" : "text-slate-300"}>
                  {isPosted ? "Registrado" : "Pendiente"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Documento</span>
                <span className="text-right text-slate-300">
                  {traceDocumentId ? "Vinculado" : "Sin documento"}
                </span>
              </div>
            </div>
          </InvoiceSidebarPanel>
        </aside>
      </div>
    </section>
  );
}

function InvoicesWorkspace({
  collectionSummaries,
  emptyText = "Ajusta los filtros o crea una venta desde un documento revisado.",
  invoices,
  issuerCompanyLabel,
  journalEntries,
  options,
  paymentMethods,
  periods,
  redirectTo,
}: {
  collectionSummaries: Map<string, CollectionSummary>;
  emptyText?: string;
  invoices: Invoice[];
  issuerCompanyLabel: string;
  journalEntries: Map<string, JournalEntry>;
  options: AccountingCorrectionOptions;
  paymentMethods: PaymentMethod[];
  periods: AccountingPeriod[];
  redirectTo: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/10 p-3 sm:p-4">
      {invoices.length > 0 ? (
        <div className="grid gap-3">
          {invoices.map((invoice, index) => {
            const title = invoice.counterparty?.name ?? invoice.proveedor;

            return (
              <details
                className="group rounded-2xl border border-white/[0.09] bg-white/[0.026] open:border-cyan-300/24 open:bg-cyan-300/[0.035]"
                key={invoice.id}
                name="invoice-focus-workspace"
                open={index === 0}
              >
                <summary className="grid cursor-pointer list-none gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {title}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {invoice.numero_documento ?? "Sin documento"} ·{" "}
                      {formatMoney(invoice.total, invoice.moneda)}
                    </p>
                  </div>
                  <span className="w-fit rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300 group-open:border-cyan-300/30 group-open:text-cyan-100">
                    Trabajar
                  </span>
                </summary>
                <div className="border-t border-white/[0.08] p-3 sm:p-4">
                  <InvoiceCard
                    collectionSummary={collectionSummaries.get(invoice.id) ?? null}
                    invoice={invoice}
                    issuerCompanyLabel={issuerCompanyLabel}
                    journalEntry={journalEntries.get(invoice.id) ?? null}
                    options={options}
                    paymentMethods={paymentMethods}
                    period={getInvoicePeriod(invoice, periods)}
                    redirectTo={redirectTo}
                  />
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
          <p className="text-base font-semibold text-white">
            Sin ventas para esta vista
          </p>
          <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
        </div>
      )}
    </div>
  );
}

export default async function InvoicesPage({
  searchParams,
}: InvoicesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedSearchParams.filter ?? "all";
  const actionError = resolvedSearchParams.error ?? null;
  const selectedInvoiceId = resolvedSearchParams.invoice ?? "";
  const searchTerm = resolvedSearchParams.q ?? "";
  const activeTab = invoiceWorkspaceTabs.some(
    (tab) => tab.key === resolvedSearchParams.tab,
  )
    ? (resolvedSearchParams.tab as InvoiceWorkspaceTab)
    : "summary";
  const returnTo = resolvedSearchParams.returnTo?.startsWith("/")
    ? resolvedSearchParams.returnTo
    : "/dashboard";
  const returnLabel = resolvedSearchParams.returnLabel ?? "Volver al dashboard";
  const returnQuery =
    returnTo !== "/dashboard"
      ? `&returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`
      : "";
  const redirectTo = buildInvoicesHref({
    filter: activeFilter,
    invoiceId: selectedInvoiceId,
    q: searchTerm,
    returnQuery,
    tab: activeTab,
  });
  const [
    { activeContext, invoices },
    periodsResult,
    paymentMethodsResult,
    correctionOptions,
  ] = await Promise.all([
    getInvoicesForActiveCompany(),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
    listPaymentMethods().catch(() => ({
      methods: [] as PaymentMethod[],
    })),
    getAccountingCorrectionOptions().catch(() => ({
      accounts: [],
      centrosCosto: [],
      purchaseCategories: [],
      saleTypes: invoiceTypeOptions.map((value) => ({ label: value, value })),
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
  const issuerCompanyLabel = getInvoiceIssuerCompanyLabel(activeCompany);
  const filteredInvoices = filterInvoices(invoices, activeFilter, searchTerm);
  const selectedInvoice = selectedInvoiceId
    ? invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null
    : null;
  const backHref = buildInvoicesHref({
    filter: activeFilter,
    q: searchTerm,
    returnQuery,
  });
  const hrefForInvoice = (invoiceId: string) =>
    buildInvoicesHref({
      filter: activeFilter,
      invoiceId,
      q: searchTerm,
      returnQuery,
    });
  const hrefForTab = (tab: InvoiceWorkspaceTab) =>
    buildInvoicesHref({
      filter: activeFilter,
      invoiceId: selectedInvoiceId,
      q: searchTerm,
      returnQuery,
      tab,
    });
  const approvedCount = invoices.filter((invoice) =>
    hasAccountingStatus(invoice, "approved"),
  ).length;
  const observedCount = invoices.filter((invoice) =>
    hasAccountingStatus(invoice, "observed"),
  ).length;
  const missingTraceCount = invoices.filter(
    (invoice) => !invoice.counterparty_id || !invoice.source_document_id,
  ).length;
  const pendingReviewCount = invoices.filter((invoice) =>
    hasAccountingStatus(invoice, "pending"),
  ).length;
  const headerMetrics = [
    { label: "ventas", value: invoices.length },
    { label: "pendientes", value: pendingReviewCount },
    { label: "aprobadas", value: approvedCount },
    { label: "observadas", value: observedCount },
  ];

  return (
    <ModuleFrame>
      <div className="flex h-[calc(100dvh-7rem)] min-h-[34rem] flex-col overflow-hidden">
        {!selectedInvoice ? (
          <header className="flex-shrink-0 rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.026))] p-4 shadow-2xl shadow-black/20 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Consola operativa
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Ventas
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Revisa ingresos, clientes, cobros y trazabilidad sin salir del workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <BackLink href={returnTo} label={returnLabel} />
                <Link className="om7-btn-primary px-4 py-2.5" href="/facturas/nueva">
                  Nueva venta
                </Link>
                <Link className="om7-btn-secondary px-4 py-2.5" href="/facturas">
                  Refrescar
                </Link>
              </div>
            </div>
          </header>
        ) : null}

        {actionError ? (
          <PremiumCard className="mt-3 flex-shrink-0 border-amber-300/15 bg-amber-300/[0.08] p-4">
            <p className="text-sm font-semibold text-amber-100">
              No se pudo completar la accion
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-100/75">
              {actionError}
            </p>
          </PremiumCard>
        ) : null}

        {!activeCompany ? (
          <PremiumCard className="mt-3 flex-shrink-0 border-amber-300/15 bg-amber-300/10 p-5">
            <p className="text-sm font-medium text-amber-100">
              Selecciona una empresa activa
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
              Las ventas deben registrarse bajo una empresa. Ve a Empresas y usa
              el boton Usar como activa para definir el contexto de trabajo.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
              href="/empresas"
            >
              Ir a empresas
            </Link>
          </PremiumCard>
        ) : null}

        <div className={`${selectedInvoice ? "" : "mt-3"} min-h-0 flex-1 overflow-hidden`}>
          {selectedInvoice ? (
            <InvoiceDetailWorkspace
              activeTab={activeTab}
              backHref={backHref}
              collectionSummary={invoiceCollectionMap.get(selectedInvoice.id) ?? null}
              invoice={selectedInvoice}
              issuerCompanyLabel={issuerCompanyLabel}
              journalEntry={invoiceEntryMap.get(selectedInvoice.id) ?? null}
              options={correctionOptions}
              paymentMethods={paymentMethods}
              period={getInvoicePeriod(selectedInvoice, periods)}
              redirectTo={redirectTo}
              tabHref={hrefForTab}
            />
          ) : (
            <PremiumCard className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-4 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04] sm:p-5">
              <div className="min-h-0">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <form
                    className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_180px_120px]"
                    method="get"
                  >
                    <input
                      className="h-11 min-w-0 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                      defaultValue={searchTerm}
                      name="q"
                      placeholder="Buscar venta..."
                    />
                    <select
                      className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/45"
                      defaultValue={activeFilter}
                      name="filter"
                    >
                      {Object.entries(filterLabels).map(([filter, label]) => (
                        <option className="bg-slate-950" key={filter} value={filter}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button className="om7-btn-secondary h-11 px-4" type="submit">
                      Buscar
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {headerMetrics.map((metric) => (
                      <span
                        className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300"
                        key={metric.label}
                      >
                        <span className="text-white">{metric.value}</span>{" "}
                        {metric.label}
                      </span>
                    ))}
                  </div>
                </div>

                <details className="mt-3 rounded-2xl border border-white/[0.08] bg-black/10 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Filtros avanzados
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["all", "Todas"],
                      ["accounting_pending", "Pendientes"],
                      ["accounting_approved", "Aprobadas"],
                      ["accounting_observed", "Observadas"],
                      ["document", "Desde XML"],
                      ["missing_counterparty", "Por completar"],
                    ].map(([filter, label]) => (
                      <Link
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-semibold transition",
                          activeFilter === filter
                            ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                            : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
                        ].join(" ")}
                        href={buildInvoicesHref({
                          filter,
                          q: searchTerm,
                          returnQuery,
                        })}
                        key={filter}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </details>
              </div>

              <section className="mt-4 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10 p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Ventas registradas
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {filteredInvoices.length} de {invoices.length} visibles
                      {missingTraceCount ? ` - ${missingTraceCount} por completar` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Selecciona una fila para abrir el workspace.
                  </p>
                </div>
                <InvoiceResultsTable
                  hrefForInvoice={hrefForInvoice}
                  invoices={filteredInvoices}
                />
              </section>
            </PremiumCard>
          )}
        </div>
      </div>

      <div className="hidden">
      <ModuleHeader
        title="Ventas"
        description="Consola operativa para revisar ingresos, clientes, cobros y trazabilidad."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href={returnTo} label={returnLabel} />
            <Link className="om7-btn-primary px-4 py-2.5" href="/facturas/nueva">
              Nueva venta
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
            Las ventas deben registrarse bajo una empresa. Ve a Empresas y
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

      <section className="sticky top-[var(--om7-actions-sticky-top,12.5rem)] z-40 rounded-2xl border border-white/16 bg-[#06101c] p-2 shadow-2xl shadow-black/25 lg:top-[var(--om7-actions-sticky-top-lg,9.25rem)]">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto om7-scrollbar">
            {[
              ["all", "Resumen"],
              ["accounting_pending", "Pendientes"],
              ["accounting_approved", "Aprobadas"],
              ["accounting_observed", "Observadas"],
              ["document", "Desde XML"],
              ["missing_counterparty", "Por completar"],
            ].map(([filter, label]) => (
              <Link
                className={[
                  "grid h-10 shrink-0 place-items-center rounded-xl border px-3.5 text-sm font-semibold transition",
                  activeFilter === filter
                    ? "border-cyan-300/35 bg-cyan-300/12 text-cyan-50"
                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-200/25 hover:bg-cyan-300/[0.08] hover:text-cyan-100",
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
          <form
            className="flex min-w-0 shrink-0 gap-2 xl:ml-auto xl:w-[min(420px,40vw)]"
            method="get"
          >
            <input
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.055] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45"
              defaultValue={searchTerm}
              name="q"
              placeholder="Buscar venta..."
            />
            <input name="filter" type="hidden" value={activeFilter} />
            <button className="om7-btn-secondary h-10 shrink-0 px-4" type="submit">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InvoiceConsoleStat
          detail={activeCompany?.name ?? "Sin empresa activa"}
          label="Ventas"
          tone="muted"
          value={invoices.length}
        />
        <InvoiceConsoleStat
          detail="Requieren decision operativa"
          label="Pendientes"
          tone="primary"
          value={pendingReviewCount}
        />
        <InvoiceConsoleStat
          detail="Listas para cobro y contabilidad"
          label="Aprobadas"
          tone="success"
          value={approvedCount}
        />
        <InvoiceConsoleStat
          detail={`${missingTraceCount} incompletas`}
          label="Observadas"
          tone="critical"
          value={observedCount}
        />
      </section>

      <section>
        <PremiumCard className="overflow-hidden border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Workspace de ventas
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Revisión, cobro y trazabilidad en una sola bandeja.
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {filteredInvoices.length} de {invoices.length} visibles
                </span>
              </div>

              <form className="hidden" method="get">
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

              <div className="hidden">
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
            <InvoicesWorkspace
              collectionSummaries={invoiceCollectionMap}
              invoices={filteredInvoices}
              issuerCompanyLabel={issuerCompanyLabel}
              journalEntries={invoiceEntryMap}
              options={correctionOptions}
              paymentMethods={paymentMethods}
              periods={periods}
              redirectTo={redirectTo}
            />
          </div>
        </PremiumCard>
      </section>
      </div>
    </ModuleFrame>
  );
}
