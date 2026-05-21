import Link from "next/link";
import type { ReactNode } from "react";
import {
  createPurchaseAction,
  generatePurchaseAccountingEntryAction,
  registerPurchasePaymentAction,
  revertPurchaseAccountingEntryAction,
  updatePurchaseAccountingFieldsAction,
  updatePurchaseReviewStatusAction,
} from "@/app/(platform)/compras/actions";
import { AccountingAmountCalculator } from "@/components/accounting/accounting-amount-calculator";
import {
  BackLink,
  ModuleFrame,
  ModuleHeader,
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
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
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
  getMovementStatusBadgeClass,
  getPaymentStatusKey,
  getPaymentStatusLabel,
  getRemainingAmount,
  getPurchasePaymentSummary,
  listPaymentMethods,
  type PaymentMethod,
  type PaymentSummary,
} from "@/lib/payments";
import { listPurchases, type Purchase } from "@/lib/purchases";

type PurchasesPageProps = {
  searchParams?: Promise<{
    error?: string;
    filter?: string;
    q?: string;
    returnLabel?: string;
    returnTo?: string;
  }>;
};

const categoryOptions = [
  "Operaciones",
  "Servicios profesionales",
  "Tecnologia",
  "Impuestos",
  "Administrativo",
  "Otros",
];

const filterLabels: Record<string, string> = {
  all: "Todas",
  document: "Desde documento",
  counterparty: "Con contraparte",
  missing_counterparty: "Sin contraparte",
  high_confidence: "Alta confianza",
  review: "Necesita atencion",
  accounting_pending: "Pendientes",
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

function hasHighConfidence(purchase: Purchase) {
  return Number(purchase.classification_confidence ?? 0) >= 0.9;
}

function needsReview(purchase: Purchase) {
  return (
    purchase.status === "revision" ||
    !purchase.counterparty_id ||
    (purchase.source_document_id && !hasHighConfidence(purchase))
  );
}

function hasAccountingStatus(purchase: Purchase, status: string) {
  return (purchase.review_status ?? "pending") === status;
}

function getPurchaseAccountingStatusLabel(status: string | null | undefined) {
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

function getPurchaseAccountingStatusClass(status: string | null | undefined) {
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

function getPurchasePeriodDate(purchase: Purchase) {
  const rawDate = purchase.purchase_date ?? purchase.created_at;
  const date = rawDate ? new Date(rawDate) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getPurchasePeriod(
  purchase: Purchase,
  periods: AccountingPeriod[],
) {
  const date = getPurchasePeriodDate(purchase);

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

function getPurchasePeriodLabel(purchase: Purchase) {
  const date = getPurchasePeriodDate(purchase);

  if (!date) {
    return "Sin periodo";
  }

  return getPeriodLabel(date.getFullYear(), date.getMonth() + 1);
}

function getPurchaseTraceDocumentId(purchase: Purchase) {
  return (
    purchase.source_document_id ??
    getConversionMetadataString(purchase.conversion_metadata, "source_document_id")
  );
}

function getSearchText(purchase: Purchase) {
  return [
    purchase.counterparty?.name,
    purchase.supplier_name,
    purchase.description,
    purchase.category,
    purchase.suggested_account,
    purchase.document_number,
    purchase.source_document?.display_name,
    purchase.source_document?.original_filename,
  ]
    .join(" ")
    .toLowerCase();
}

function filterPurchases(
  purchases: Purchase[],
  filter: string,
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return purchases.filter((purchase) => {
    const matchesSearch =
      !normalizedSearch || getSearchText(purchase).includes(normalizedSearch);
    const matchesFilter =
      filter === "document"
        ? Boolean(purchase.source_document_id)
        : filter === "counterparty"
          ? Boolean(purchase.counterparty_id)
          : filter === "missing_counterparty"
            ? !purchase.counterparty_id
            : filter === "high_confidence"
              ? hasHighConfidence(purchase)
              : filter === "review"
                ? needsReview(purchase)
                : filter === "accounting_pending"
                  ? hasAccountingStatus(purchase, "pending")
                  : filter === "accounting_reviewed"
                    ? hasAccountingStatus(purchase, "reviewed")
                    : filter === "accounting_approved"
                      ? hasAccountingStatus(purchase, "approved")
                      : filter === "accounting_observed"
                        ? hasAccountingStatus(purchase, "observed")
                : true;

    return matchesSearch && matchesFilter;
  });
}

function ReviewStatusForm({
  purchaseId,
  redirectTo,
  status,
  children,
  className,
}: {
  purchaseId: string;
  redirectTo: string;
  status: string;
  children: ReactNode;
  className: string;
}) {
  return (
    <form action={updatePurchaseReviewStatusAction}>
      <input name="purchaseId" type="hidden" value={purchaseId} />
      <input name="reviewStatus" type="hidden" value={status} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function PurchaseAccountingForm({
  action,
  children,
  className,
  motivo,
  purchaseId,
  redirectTo,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  motivo?: string;
  purchaseId: string;
  redirectTo: string;
}) {
  return (
    <form action={action}>
      <input name="purchaseId" type="hidden" value={purchaseId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {motivo ? <input name="motivo" type="hidden" value={motivo} /> : null}
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function PurchasePaymentForm({
  locked,
  methods,
  paid,
  purchase,
  redirectTo,
}: {
  locked: boolean;
  methods: PaymentMethod[];
  paid: number;
  purchase: Purchase;
  redirectTo: string;
}) {
  const remaining = getRemainingAmount(purchase.total, paid);

  if (remaining <= 0) {
    return null;
  }

  if (locked) {
    return (
      <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-slate-400">
        El periodo esta cerrado. Este pago queda en solo lectura.
      </p>
    );
  }

  return (
    <details className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-3">
      <summary className="cursor-pointer text-xs font-semibold text-cyan-100">
        Registrar pago
      </summary>
      <form action={registerPurchasePaymentAction} className="mt-3 grid gap-3">
        <input name="purchaseId" type="hidden" value={purchase.id} />
        <input name="redirectTo" type="hidden" value={redirectTo} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-slate-300">Metodo</span>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
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
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
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
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="paymentDate"
              type="date"
            />
          </label>
        </div>
        <input
          className="h-10 rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
          name="notes"
          placeholder="Nota opcional"
        />
        <button className="om7-btn-primary px-3 py-2 text-xs" type="submit">
          Guardar pago
        </button>
      </form>
    </details>
  );
}

function PurchaseCard({
  journalEntry,
  options,
  paymentMethods,
  paymentSummary,
  period,
  purchase,
  redirectTo,
}: {
  journalEntry: JournalEntry | null;
  options: AccountingCorrectionOptions;
  paymentMethods: PaymentMethod[];
  paymentSummary: PaymentSummary | null;
  period: AccountingPeriod | null;
  purchase: Purchase;
  redirectTo: string;
}) {
  const confidence = formatConfidence(purchase.classification_confidence);
  const ruleApplied =
    purchase.classification_rule_applied ??
    getConversionMetadataValue(
      purchase.conversion_metadata,
      "classification_rule_applied",
      "Sin regla registrada",
    );
  const title =
    purchase.counterparty?.name ?? purchase.supplier_name ?? "Sin proveedor";
  const sourceName =
    purchase.source_document?.display_name ??
    purchase.source_document?.original_filename ??
    "Documento procesado";
  const traceDocumentId = getPurchaseTraceDocumentId(purchase);
  const e7Synced = hasE7MindTrace(purchase.conversion_metadata);
  const lockedByPeriod = isRecordLockedByPeriod(period);
  const periodLabel = getPurchasePeriodLabel(purchase);
  const paidAmount = paymentSummary?.amount ?? 0;
  const paymentStatus = getPaymentStatusKey(purchase.total, paidAmount);
  const paymentLabel = getPaymentStatusLabel(purchase.total, paidAmount);
  const remainingAmount = getRemainingAmount(purchase.total, paidAmount);
  const reviewActionLabel =
    (purchase.review_status ?? "pending") === "observed"
      ? "Marcar corregido"
      : "Marcar revisada";
  const isPosted = journalEntry?.status === "posted";
  const accountingStatus = purchase.estado_contable ?? "pendiente";
  const actualAsiento = purchase.asiento_contable;
  const canGenerateAccounting =
    !lockedByPeriod &&
    ["reviewed", "approved"].includes(String(purchase.review_status ?? "")) &&
    accountingStatus !== "contabilizado";

  return (
    <article className="min-w-0 rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),rgba(255,255,255,0.035)] p-3 shadow-2xl shadow-black/15 transition hover:border-cyan-300/20 hover:bg-white/[0.05] sm:p-5">
      <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {purchase.source_document_id ? (
              <span className="om7-chip om7-chip-cyan">Desde documento</span>
            ) : (
              <span className="om7-chip text-slate-400">Manual</span>
            )}
            {e7Synced ? (
              <span className="om7-chip om7-chip-emerald">
                Sincronizado con E7 Mind
              </span>
            ) : null}
            {purchase.counterparty_id ? (
              <span className="om7-chip om7-chip-emerald">Contraparte</span>
            ) : (
              <span className="om7-chip om7-chip-amber">Sin contraparte</span>
            )}
            {needsReview(purchase) ? (
              <span className="om7-chip om7-chip-amber">Necesita atencion</span>
            ) : null}
            <span className={getReviewStatusBadgeClass(purchase.review_status)}>
              {getReviewStatusLabel(purchase.review_status)}
            </span>
            {lockedByPeriod ? (
              <span className={getPeriodStatusBadgeClass(period?.status)}>
                Periodo cerrado
              </span>
            ) : null}
            {isPosted ? (
              <span className="om7-chip om7-chip-emerald">Contabilizada</span>
            ) : null}
            <span className={getPurchaseAccountingStatusClass(accountingStatus)}>
              {getPurchaseAccountingStatusLabel(accountingStatus)}
            </span>
            <span className={getMovementStatusBadgeClass(paymentStatus)}>
              {paymentLabel}
            </span>
          </div>

          <h3 className="mt-4 break-words text-lg font-semibold text-white">
            {title}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-500">
            {purchase.document_number ?? "Sin numero"} ·{" "}
            {purchase.purchase_date ?? "Sin fecha"}
          </p>
          <p className="mt-1 break-words text-xs text-slate-600">
            Periodo: {periodLabel}
            {period ? ` · ${getPeriodStatusLabel(period.status)}` : ""}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-left lg:text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
            Monto
          </p>
          <p className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
            {formatMoney(purchase.total, purchase.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Categoria sugerida</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {purchase.category ?? "Sin categoria"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Cuenta sugerida</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {purchase.suggested_account ?? "Sin cuenta"}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              Pago
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {paymentLabel} · pagado {formatMoney(paidAmount, purchase.currency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Saldo pendiente: {formatMoney(remainingAmount, purchase.currency)}
            </p>
          </div>
          <span className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-slate-300">
            {paymentSummary?.items[0]?.payment_method?.name ?? "Sin movimiento"}
          </span>
        </div>
        <PurchasePaymentForm
          locked={lockedByPeriod}
          methods={paymentMethods}
          paid={paidAmount}
          purchase={purchase}
          redirectTo={redirectTo}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-black/15 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              Contabilizacion oficial
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-100">
              {getPurchaseAccountingStatusLabel(accountingStatus)}
              {actualAsiento ? ` - Asiento #${actualAsiento.numero_asiento}` : ""}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              El asiento real se genera desde reglas contables de compras y
              alimenta mayor, balance y estados financieros.
            </p>
            {purchase.contabilizacion_error ? (
              <p className="mt-2 text-sm leading-6 text-rose-100/80">
                {purchase.contabilizacion_error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            {purchase.asiento_contable_id ? (
              <Link
                className="om7-btn-secondary px-3 py-2 text-xs"
                href={`/contabilidad/asientos/${purchase.asiento_contable_id}`}
              >
                Ver asiento
              </Link>
            ) : null}
            {canGenerateAccounting ? (
              <PurchaseAccountingForm
                action={generatePurchaseAccountingEntryAction}
                className="om7-btn-primary px-3 py-2 text-xs"
                purchaseId={purchase.id}
                redirectTo={redirectTo}
              >
                {accountingStatus === "error" || accountingStatus === "anulado"
                  ? "Recontabilizar"
                  : "Generar asiento"}
              </PurchaseAccountingForm>
            ) : null}
            {accountingStatus === "borrador" ? (
              <PurchaseAccountingForm
                action={revertPurchaseAccountingEntryAction}
                className="om7-btn-ghost px-3 py-2 text-xs"
                motivo="Reversion de borrador contable de compra"
                purchaseId={purchase.id}
                redirectTo={redirectTo}
              >
                Anular borrador
              </PurchaseAccountingForm>
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
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
            Corregir para contabilizar
          </summary>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Ajusta los datos que usa la regla contable. Al guardar se limpia el
            error y el registro vuelve a quedar listo para generar asiento.
          </p>
          <form
            action={updatePurchaseAccountingFieldsAction}
            className="mt-4 grid gap-3 md:grid-cols-3"
          >
            <input name="purchaseId" type="hidden" value={purchase.id} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-300">Proveedor</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.supplier_name ?? ""}
                name="supplierName"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Documento</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.document_number ?? ""}
                name="documentNumber"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Fecha</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.purchase_date ?? ""}
                name="purchaseDate"
                type="date"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-300">Categoria contable</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.category ?? ""}
                list={`purchase-accounting-categories-${purchase.id}`}
                name="category"
                placeholder="Servicios profesionales"
                required
              />
            </label>
            <datalist id={`purchase-accounting-categories-${purchase.id}`}>
              {options.purchaseCategories.map((category) => (
                <option key={category.value} label={category.label} value={category.value} />
              ))}
            </datalist>
            <label className="block">
              <span className="text-xs text-slate-300">Cuenta sugerida</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.suggested_account ?? ""}
                list={`purchase-accounting-accounts-${purchase.id}`}
                name="suggestedAccount"
                placeholder="Gasto operativo"
              />
            </label>
            <datalist id={`purchase-accounting-accounts-${purchase.id}`}>
              {options.accounts.map((account) => (
                <option key={account.value} label={account.label} value={account.value} />
              ))}
            </datalist>
            <AccountingAmountCalculator
              subtotal={purchase.subtotal}
              tax={purchase.tax}
              taxFieldName="tax"
              taxName="Impuesto"
              total={purchase.total}
            />
            <label className="block">
              <span className="text-xs text-slate-300">Centro de costo</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.suggested_cost_center_id ?? ""}
                list={`purchase-cost-centers-${purchase.id}`}
                name="suggestedCostCenterId"
                placeholder="Opcional"
              />
            </label>
            <datalist id={`purchase-cost-centers-${purchase.id}`}>
              {options.centrosCosto.map((centro) => (
                <option key={centro.value} label={centro.label} value={centro.value} />
              ))}
            </datalist>
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-300">Descripcion</span>
              <input
                className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.description ?? ""}
                name="description"
              />
            </label>
            <label className="block md:col-span-3">
              <span className="text-xs text-slate-300">Notas</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                defaultValue={purchase.notes ?? ""}
                name="notes"
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
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
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
              {getRecordBusinessStateLabel(purchase, period)}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {getRecordBusinessStateDescription(purchase, period)}
            </p>
            {purchase.review_notes ? (
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Nota: {purchase.review_notes}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
            {canReopenReview(purchase, period) ? (
              <ReviewStatusForm
                className="om7-btn-secondary px-3 py-2 text-xs"
                purchaseId={purchase.id}
                redirectTo={redirectTo}
                status="pending"
              >
                Reabrir revision
              </ReviewStatusForm>
            ) : null}
            {canReviewRecord(purchase, period) ? (
              <ReviewStatusForm
                className="om7-btn-secondary px-3 py-2 text-xs"
                purchaseId={purchase.id}
                redirectTo={redirectTo}
                status="reviewed"
              >
                {reviewActionLabel}
              </ReviewStatusForm>
            ) : null}
            {canApproveRecord(purchase, period) ? (
              <ReviewStatusForm
                className="om7-btn-primary px-3 py-2 text-xs"
                purchaseId={purchase.id}
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

        {canObserveRecord(purchase, period) ? (
        <details className="mt-3 rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-3">
          <summary className="cursor-pointer text-xs font-semibold text-amber-100">
            Observar con nota
          </summary>
          <form action={updatePurchaseReviewStatusAction} className="mt-3 space-y-3">
            <input name="purchaseId" type="hidden" value={purchase.id} />
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
        {purchase.counterparty_id ? (
          <Link
            className="om7-btn-ghost px-4 py-2.5"
            href={`/contrapartes/${purchase.counterparty_id}`}
          >
            Ver contraparte
          </Link>
        ) : null}
      </div>

      {(purchase.review_status ?? "pending") === "approved" ? (
        <div className="mt-5">
          <JournalEntryCard
            currency={purchase.currency}
            entry={journalEntry}
            locked={lockedByPeriod}
            lockedReason="Periodo cerrado. El asiento queda solo lectura."
            redirectTo={redirectTo}
            sourceId={purchase.id}
            sourceType="purchase"
          />
        </div>
      ) : null}
    </article>
  );
}

function PurchaseConsoleStat({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.14] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-4 shadow-xl shadow-black/20 ring-1 ring-white/[0.035]">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function PurchasesModal({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <div
      className="invisible fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 opacity-0 backdrop-blur-sm transition target:visible target:opacity-100 sm:p-6"
      id={id}
    >
      <div className="flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#07111f] shadow-2xl shadow-cyan-950/30">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 bg-[#06101c] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
              OM7 Finance OS
            </p>
            <p className="mt-1 truncate text-xl font-semibold text-white">
              {title}
            </p>
          </div>
          <a
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
            href="#panel-compras"
          >
            Cerrar
          </a>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 om7-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

function PurchaseWorkspaceLauncher({
  action,
  detail,
  href,
  title,
}: {
  action: string;
  detail: string;
  href: string;
  title: string;
}) {
  return (
    <a
      className="group rounded-2xl border border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-4 shadow-xl shadow-black/20 ring-1 ring-cyan-300/[0.04] transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-white">{title}</p>
        <span className="rounded-full border border-white/[0.1] bg-white/[0.045] px-2.5 py-1 text-xs font-semibold text-slate-300">
          {action}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-400">{detail}</p>
    </a>
  );
}

function PurchasesWorkspace({
  emptyText = "Ajusta los filtros o crea una compra desde un documento revisado.",
  journalEntries,
  options,
  paymentMethods,
  paymentSummaries,
  periods,
  purchases,
  redirectTo,
}: {
  emptyText?: string;
  journalEntries: Map<string, JournalEntry>;
  options: AccountingCorrectionOptions;
  paymentMethods: PaymentMethod[];
  paymentSummaries: Map<string, PaymentSummary>;
  periods: AccountingPeriod[];
  purchases: Purchase[];
  redirectTo: string;
}) {
  return (
    <div className="max-h-[62vh] overflow-y-auto rounded-2xl border border-white/15 p-3 om7-scrollbar sm:p-5">
      <div className="grid gap-4">
        {purchases.length > 0 ? (
          purchases.map((purchase) => (
            <PurchaseCard
              journalEntry={journalEntries.get(purchase.id) ?? null}
              key={purchase.id}
              options={options}
              paymentMethods={paymentMethods}
              paymentSummary={paymentSummaries.get(purchase.id) ?? null}
              period={getPurchasePeriod(purchase, periods)}
              purchase={purchase}
              redirectTo={redirectTo}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
            <p className="text-base font-semibold text-white">
              Sin compras para esta vista
            </p>
            <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
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
  const redirectTo = `/compras?filter=${activeFilter}${
    searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : ""
  }${returnQuery}`;
  const [
    { activeContext, purchases },
    periodsResult,
    paymentMethodsResult,
    correctionOptions,
  ] = await Promise.all([
    listPurchases(),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
    listPaymentMethods().catch(() => ({
      methods: [] as PaymentMethod[],
    })),
    getAccountingCorrectionOptions().catch(() => ({
      accounts: [],
      centrosCosto: [],
      purchaseCategories: categoryOptions.map((value) => ({ label: value, value })),
      saleTypes: [],
    })),
  ]);
  const periods = periodsResult.periods;
  const paymentMethods = paymentMethodsResult.methods;
  const purchasePaymentMap = await getPurchasePaymentSummary(
    purchases.map((purchase) => purchase.id),
  ).catch(() => new Map<string, PaymentSummary>());
  const purchaseEntryMap = await listJournalEntriesForSources(
    "purchase",
    purchases.map((purchase) => purchase.id),
  ).catch(() => new Map<string, JournalEntry>());
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const filteredPurchases = filterPurchases(
    purchases,
    activeFilter,
    searchTerm,
  );
  const fromDocumentCount = purchases.filter(
    (purchase) => purchase.source_document_id,
  ).length;
  const missingTraceCount = purchases.filter(
    (purchase) => !purchase.counterparty_id || !purchase.source_document_id,
  ).length;
  const pendingReviewCount = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "pending"),
  ).length;
  const approvedCount = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "approved"),
  ).length;
  const observedCount = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "observed"),
  ).length;
  const pendingPurchases = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "pending"),
  );
  const approvedPurchases = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "approved"),
  );
  const observedPurchases = purchases.filter((purchase) =>
    hasAccountingStatus(purchase, "observed"),
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Compras"
        description="Consola operativa para revisar gastos, proveedores, pagos y trazabilidad."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href={returnTo} label={returnLabel} />
            <a className="om7-btn-primary px-4 py-2.5" href="#modal-nueva-compra">
              Nueva compra
            </a>
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
            Las compras deben registrarse bajo una empresa. Ve a Empresas y
            define el contexto de trabajo antes de crear gastos reales.
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
              ["#modal-compras", "Compras"],
              ["#modal-pendientes", "Pendientes"],
              ["#modal-aprobadas", "Aprobadas"],
              ["#modal-observadas", "Observadas"],
            ].map(([href, label]) => (
              <a
                className="grid h-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </div>
          <form
            action="/compras#modal-compras"
            className="flex min-w-0 shrink-0 gap-2 xl:ml-auto xl:w-[min(420px,40vw)]"
            method="get"
          >
            <input
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.055] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45"
              defaultValue={searchTerm}
              name="q"
              placeholder="Buscar compra..."
            />
            <input name="filter" type="hidden" value={activeFilter} />
            <button className="om7-btn-secondary h-10 shrink-0 px-4" type="submit">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PurchaseConsoleStat
          detail={activeCompany?.name ?? "Sin empresa activa"}
          label="Compras"
          value={purchases.length}
        />
        <PurchaseConsoleStat
          detail={`${observedCount} observadas`}
          label="Aprobadas"
          value={approvedCount}
        />
        <PurchaseConsoleStat
          detail="Tienen documento origen"
          label="Desde XML"
          value={fromDocumentCount}
        />
        <PurchaseConsoleStat
          detail={`Por completar ${missingTraceCount}`}
          label="Por revisar"
          value={pendingReviewCount}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-4" id="panel-compras">
        <PurchaseWorkspaceLauncher
          action="Abrir"
          detail={`${purchases.length} registros`}
          href="#modal-compras"
          title="Compras"
        />
        <PurchaseWorkspaceLauncher
          action="Revisar"
          detail={`${pendingReviewCount} pendientes`}
          href="#modal-pendientes"
          title="Pendientes"
        />
        <PurchaseWorkspaceLauncher
          action="Validar"
          detail={`${approvedCount} aprobadas`}
          href="#modal-aprobadas"
          title="Aprobadas"
        />
        <PurchaseWorkspaceLauncher
          action="Corregir"
          detail={`${observedCount} observadas`}
          href="#modal-observadas"
          title="Observadas"
        />
      </section>

      <PurchasesModal id="modal-compras" title="Workspace de compras">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Bandeja operativa</p>
            <p className="mt-1 text-sm text-slate-500">
              Revision, pago y trazabilidad en una sola vista.
            </p>
          </div>
          <span className="text-sm text-slate-500">
            {filteredPurchases.length} de {purchases.length} visibles
          </span>
        </div>
        <PurchasesWorkspace
            journalEntries={purchaseEntryMap}
            options={correctionOptions}
            paymentMethods={paymentMethods}
          paymentSummaries={purchasePaymentMap}
          periods={periods}
          purchases={filteredPurchases}
          redirectTo={redirectTo}
        />
      </PurchasesModal>

      <PurchasesModal id="modal-pendientes" title="Compras pendientes">
        <PurchasesWorkspace
            journalEntries={purchaseEntryMap}
            options={correctionOptions}
            paymentMethods={paymentMethods}
          paymentSummaries={purchasePaymentMap}
          periods={periods}
          purchases={pendingPurchases}
          redirectTo="/compras#modal-pendientes"
        />
      </PurchasesModal>

      <PurchasesModal id="modal-aprobadas" title="Compras aprobadas">
        <PurchasesWorkspace
            journalEntries={purchaseEntryMap}
            options={correctionOptions}
            paymentMethods={paymentMethods}
          paymentSummaries={purchasePaymentMap}
          periods={periods}
          purchases={approvedPurchases}
          redirectTo="/compras#modal-aprobadas"
        />
      </PurchasesModal>

      <PurchasesModal id="modal-observadas" title="Compras observadas">
        <PurchasesWorkspace
            journalEntries={purchaseEntryMap}
            options={correctionOptions}
            paymentMethods={paymentMethods}
          paymentSummaries={purchasePaymentMap}
          periods={periods}
          purchases={observedPurchases}
          redirectTo="/compras#modal-observadas"
        />
      </PurchasesModal>

      <PurchasesModal id="modal-nueva-compra" title="Nueva compra manual">
        <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-5 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <p className="text-sm font-semibold text-white">Nueva compra manual</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {activeCompany
              ? `Se guardara en ${activeCompany.name}.`
              : "Selecciona una empresa activa antes de registrar."}
          </p>
          <form action={createPurchaseAction} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Proveedor</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                disabled={!activeCompany}
                name="supplierName"
                placeholder="Proveedor S.A."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Documento</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="documentNumber"
                  placeholder="OC-1001"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Fecha</span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="purchaseDate"
                  type="date"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Descripcion</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                disabled={!activeCompany}
                name="description"
                placeholder="Servicios, equipos, suscripcion..."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              {["subtotal", "tax", "total"].map((name) => (
                <label className="block" key={name}>
                  <span className="text-sm font-medium text-slate-300">
                    {name === "tax" ? "Impuesto" : name === "total" ? "Total" : "Subtotal"}
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    min="0"
                    name={name}
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                  />
                </label>
              ))}
            </div>
            <input name="currency" type="hidden" value={currency} />
            <input name="status" type="hidden" value="registrada" />
            <button
              className="om7-btn-primary h-12 w-full px-4 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activeCompany}
              type="submit"
            >
              Guardar compra
            </button>
          </form>
        </PremiumCard>
      </PurchasesModal>

      <section className="hidden">
        <PremiumCard className="overflow-hidden border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    Workspace de compras
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Revisión, pago y trazabilidad en una sola bandeja.
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {filteredPurchases.length} de {purchases.length} visibles
                </span>
              </div>

              <form className="hidden" method="get">
                <input
                  className="h-12 min-w-0 rounded-2xl border border-white/[0.1] bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={searchTerm}
                  name="q"
                  placeholder="Buscar por proveedor, descripcion, categoria o documento..."
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
                    href={`/compras?filter=${filter}${
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

          <div className="max-h-[58vh] overflow-y-auto p-3 om7-scrollbar sm:p-5">
            <div className="grid gap-4">
            {filteredPurchases.length > 0 ? (
              filteredPurchases.map((purchase) => (
                <PurchaseCard
                  journalEntry={purchaseEntryMap.get(purchase.id) ?? null}
                  key={purchase.id}
                  options={correctionOptions}
                  paymentMethods={paymentMethods}
                  paymentSummary={purchasePaymentMap.get(purchase.id) ?? null}
                  period={getPurchasePeriod(purchase, periods)}
                  purchase={purchase}
                  redirectTo={redirectTo}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
                <p className="text-base font-semibold text-white">
                  Sin compras para esta vista
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Ajusta los filtros o crea una compra desde un documento
                  revisado.
                </p>
              </div>
            )}
            </div>
          </div>
        </PremiumCard>

        <div id="nueva-compra">
          <PremiumCard className="border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] p-0 shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-white/[0.1] p-5">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Nueva compra manual
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {activeCompany
                      ? `Se guardara en ${activeCompany.name}.`
                      : "Selecciona una empresa activa antes de registrar."}
                  </p>
                </div>
                <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-100">
                  Abrir
                </span>
              </summary>

            <form action={createPurchaseAction} className="space-y-4 p-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Proveedor
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="supplierName"
                  placeholder="Proveedor S.A."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Documento
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="documentNumber"
                    placeholder="OC-1001"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Fecha
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="purchaseDate"
                    type="date"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Categoria
                  </span>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="category"
                  >
                    <option className="bg-slate-950" value="">
                      Seleccionar
                    </option>
                    {categoryOptions.map((category) => (
                      <option
                        className="bg-slate-950"
                        key={category}
                        value={category}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Estado
                  </span>
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    defaultValue="registrada"
                    disabled={!activeCompany}
                    name="status"
                  >
                    <option className="bg-slate-950" value="registrada">
                      Registrada
                    </option>
                    <option className="bg-slate-950" value="pendiente">
                      Pendiente
                    </option>
                    <option className="bg-slate-950" value="pagada">
                      Pagada
                    </option>
                    <option className="bg-slate-950" value="revision">
                      Revision
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Descripcion
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="description"
                  placeholder="Servicios, equipos, suscripcion..."
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Moneda
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="currency"
                    placeholder={currency}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">
                    Metodo pago
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    disabled={!activeCompany}
                    name="paymentMethod"
                    placeholder="Tarjeta, transferencia..."
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {["subtotal", "tax", "total"].map((name) => (
                  <label className="block" key={name}>
                    <span className="text-sm font-medium text-slate-300">
                      {name === "tax"
                        ? "Impuesto"
                        : name === "total"
                          ? "Total"
                          : "Subtotal"}
                    </span>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                      disabled={!activeCompany}
                      min="0"
                      name={name}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                    />
                  </label>
                ))}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Notas</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  disabled={!activeCompany}
                  name="notes"
                  placeholder="Observaciones internas"
                />
              </label>

              <button
                className="om7-btn-primary h-12 w-full px-4 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeCompany}
                type="submit"
              >
                Guardar compra
              </button>
            </form>
            </details>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
