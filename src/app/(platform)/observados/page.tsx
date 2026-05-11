import Link from "next/link";
import type { ReactNode } from "react";
import {
  updatePurchaseReviewStatusAction,
} from "@/app/(platform)/compras/actions";
import {
  updateInvoiceReviewStatusAction,
} from "@/app/(platform)/facturas/actions";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getReviewStatusBadgeClass,
  getReviewStatusDescription,
  getReviewStatusLabel,
  normalizeReviewStatus,
} from "@/lib/accounting-review-ui";
import {
  canApproveRecord,
  canReviewRecord,
  getRecordBusinessStateDescription,
  isRecordLockedByPeriod,
} from "@/lib/accounting-business-rules";
import {
  getPeriodLabel,
  getPeriodStatusBadgeClass,
  getPeriodStatusLabel,
  listAccountingPeriods,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getConversionMetadataValue } from "@/lib/document-ui";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import { listPurchases, type Purchase } from "@/lib/purchases";

type ObservedRecord =
  | {
      amount: number | null;
      counterpartyHref: string | null;
      counterpartyName: string;
      currency: string | null;
      date: string | null;
      documentHref: string | null;
      documentName: string;
      id: string;
      kind: "purchase";
      notes: string | null;
      period: AccountingPeriod | null;
      periodLabel: string;
      recordHref: string;
      ruleApplied: string;
      confidence: number | null;
    }
  | {
      amount: number | null;
      counterpartyHref: string | null;
      counterpartyName: string;
      currency: string | null;
      date: string | null;
      documentHref: string | null;
      documentName: string;
      id: string;
      kind: "invoice";
      notes: string | null;
      period: AccountingPeriod | null;
      periodLabel: string;
      recordHref: string;
      ruleApplied: string;
      confidence: number | null;
    };

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Sin confianza";
  }

  return `${Math.round(Number(value) * 100)}%`;
}

function getSourceDocumentName(
  record: Pick<Purchase | Invoice, "source_document">,
) {
  return (
    record.source_document?.display_name ??
    record.source_document?.original_filename ??
    "Registro manual"
  );
}

function getRecordPeriod(
  dateValue: string | null | undefined,
  periods: AccountingPeriod[],
) {
  const date = dateValue ? new Date(dateValue) : null;

  if (!date || Number.isNaN(date.getTime())) {
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

function getRecordPeriodLabel(dateValue: string | null | undefined) {
  const date = dateValue ? new Date(dateValue) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Sin periodo";
  }

  return getPeriodLabel(date.getFullYear(), date.getMonth() + 1);
}

function mapPurchase(
  purchase: Purchase,
  periods: AccountingPeriod[],
): ObservedRecord {
  const date = purchase.purchase_date ?? purchase.created_at;

  return {
    amount: purchase.total,
    confidence: purchase.classification_confidence ?? null,
    counterpartyHref: purchase.counterparty_id
      ? `/contrapartes/${purchase.counterparty_id}`
      : null,
    counterpartyName:
      purchase.counterparty?.name ?? purchase.supplier_name ?? "Sin proveedor",
    currency: purchase.currency,
    date,
    documentHref: purchase.source_document_id
      ? `/documentos/${purchase.source_document_id}`
      : null,
    documentName: getSourceDocumentName(purchase),
    id: purchase.id,
    kind: "purchase",
    notes: purchase.review_notes ?? null,
    period: getRecordPeriod(date, periods),
    periodLabel: getRecordPeriodLabel(date),
    recordHref: "/compras?filter=accounting_observed",
    ruleApplied:
      purchase.classification_rule_applied ??
      getConversionMetadataValue(
        purchase.conversion_metadata,
        "classification_rule_applied",
        "Sin regla registrada",
      ),
  };
}

function mapInvoice(
  invoice: Invoice,
  periods: AccountingPeriod[],
): ObservedRecord {
  const date = invoice.fecha ?? invoice.created_at;

  return {
    amount: invoice.total,
    confidence: invoice.classification_confidence ?? null,
    counterpartyHref: invoice.counterparty_id
      ? `/contrapartes/${invoice.counterparty_id}`
      : null,
    counterpartyName: invoice.counterparty?.name ?? invoice.proveedor,
    currency: invoice.moneda,
    date,
    documentHref: invoice.source_document_id
      ? `/documentos/${invoice.source_document_id}`
      : null,
    documentName: getSourceDocumentName(invoice),
    id: invoice.id,
    kind: "invoice",
    notes: invoice.review_notes ?? null,
    period: getRecordPeriod(date, periods),
    periodLabel: getRecordPeriodLabel(date),
    recordHref: "/facturas?filter=accounting_observed",
    ruleApplied:
      invoice.classification_rule_applied ??
      getConversionMetadataValue(
        invoice.conversion_metadata,
        "classification_rule_applied",
        "Sin regla registrada",
      ),
  };
}

function ReviewActionForm({
  id,
  kind,
  status,
  children,
  className,
}: {
  id: string;
  kind: ObservedRecord["kind"];
  status: "approved" | "reviewed";
  children: ReactNode;
  className: string;
}) {
  const action =
    kind === "purchase"
      ? updatePurchaseReviewStatusAction
      : updateInvoiceReviewStatusAction;

  return (
    <form action={action}>
      <input name={kind === "purchase" ? "purchaseId" : "invoiceId"} type="hidden" value={id} />
      <input name="reviewStatus" type="hidden" value={status} />
      <input name="redirectTo" type="hidden" value="/observados" />
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function ObservedRecordCard({ record }: { record: ObservedRecord }) {
  const kindLabel = record.kind === "purchase" ? "Compra" : "Factura";
  const lockedByPeriod = isRecordLockedByPeriod(record.period);

  return (
    <article className="rounded-3xl border border-amber-300/15 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.09),transparent_34%),rgba(255,255,255,0.035)] p-5 shadow-2xl shadow-black/15 transition hover:border-amber-200/30 hover:bg-white/[0.05]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="om7-chip om7-chip-amber">{kindLabel}</span>
            <span className={getReviewStatusBadgeClass("observed")}>
              {getReviewStatusLabel("observed")}
            </span>
            {record.documentHref ? (
              <span className="om7-chip om7-chip-cyan">Desde documento</span>
            ) : (
              <span className="om7-chip text-slate-400">Manual</span>
            )}
            {lockedByPeriod ? (
              <span className={getPeriodStatusBadgeClass(record.period?.status)}>
                Periodo cerrado
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 line-clamp-2 text-lg font-semibold text-white">
            {record.counterpartyName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(record.date)} · {record.documentName}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Periodo: {record.periodLabel}
            {record.period
              ? ` · ${getPeriodStatusLabel(record.period.status)}`
              : ""}
          </p>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-600">
            Monto
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {formatCurrencyAmount(record.amount, record.currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Observacion</p>
          <p className="mt-1 line-clamp-3 text-sm font-semibold text-amber-100">
            {record.notes ?? "Sin nota registrada"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Regla aplicada</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-100">
            {record.ruleApplied}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
          <p className="text-xs text-slate-500">Confianza</p>
          <p className="mt-1 text-sm font-semibold text-cyan-50">
            {formatConfidence(record.confidence)}
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-amber-300/10 bg-amber-300/[0.04] p-3 text-sm leading-6 text-amber-100/80">
        {lockedByPeriod
          ? getRecordBusinessStateDescription(
              { review_status: "observed" },
              record.period,
            )
          : getReviewStatusDescription("observed")}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {record.documentHref ? (
          <Link className="om7-btn-secondary px-4 py-2.5" href={record.documentHref}>
            Ver documento
          </Link>
        ) : null}
        {record.counterpartyHref ? (
          <Link className="om7-btn-ghost px-4 py-2.5" href={record.counterpartyHref}>
            Ver contraparte
          </Link>
        ) : null}
        <Link className="om7-btn-ghost px-4 py-2.5" href={record.recordHref}>
          Ir a {record.kind === "purchase" ? "compra" : "factura"}
        </Link>
        {canReviewRecord({ review_status: "observed" }, record.period) ? (
          <ReviewActionForm
            className="om7-btn-secondary px-4 py-2.5"
            id={record.id}
            kind={record.kind}
            status="reviewed"
          >
            Marcar corregido
          </ReviewActionForm>
        ) : null}
        {canApproveRecord({ review_status: "observed" }, record.period) ? (
          <ReviewActionForm
            className="om7-btn-primary px-4 py-2.5"
            id={record.id}
            kind={record.kind}
            status="approved"
          >
            Aprobar
          </ReviewActionForm>
        ) : null}
      </div>
    </article>
  );
}

type ObservedRecordsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function ObservedRecordsPage({
  searchParams,
}: ObservedRecordsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const [purchasesResult, invoicesResult, periodsResult] = await Promise.all([
    listPurchases(),
    getInvoicesForActiveCompany(),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
  ]);
  const periods = periodsResult.periods;
  const activeContext = purchasesResult.activeContext;
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const observedPurchases = purchasesResult.purchases
    .filter((purchase) => normalizeReviewStatus(purchase.review_status) === "observed")
    .map((purchase) => mapPurchase(purchase, periods));
  const observedInvoices = invoicesResult.invoices
    .filter((invoice) => normalizeReviewStatus(invoice.review_status) === "observed")
    .map((invoice) => mapInvoice(invoice, periods));
  const observedRecords = [...observedPurchases, ...observedInvoices].sort(
    (left, right) =>
      new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime(),
  );
  const fromDocumentCount = observedRecords.filter(
    (record) => record.documentHref,
  ).length;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const observedAmount = observedRecords.reduce(
    (sum, record) => sum + Number(record.amount ?? 0),
    0,
  );

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Registros observados"
        description="Compras y facturas que necesitan correccion antes de aprobarse."
        action={<BackLink />}
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
            La cola de observados se filtra por despacho y cliente activo.
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
          detail={formatCurrencyAmount(observedAmount, currency)}
          label="Total observados"
          value={String(observedRecords.length)}
        />
        <MetricCard
          detail="Gastos y compras"
          label="Compras observadas"
          value={String(observedPurchases.length)}
        />
        <MetricCard
          detail="Ingresos y facturas"
          label="Facturas observadas"
          value={String(observedInvoices.length)}
        />
        <MetricCard
          detail="Tienen documento origen"
          label="Desde documento"
          value={String(fromDocumentCount)}
        />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Cola de correccion
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Revisa la observacion, abre el origen si aplica y marca el
                registro como revisado o aprobado cuando quede corregido.
              </p>
            </div>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
              {activeCompany?.name ?? "Sin empresa activa"}
            </span>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto overscroll-contain p-5">
          <div className="grid gap-4">
          {observedRecords.length > 0 ? (
            observedRecords.map((record) => (
              <ObservedRecordCard
                key={`${record.kind}-${record.id}`}
                record={record}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
              <p className="text-base font-semibold text-white">
                No hay registros observados.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Cuando una compra o factura tenga observaciones contables,
                aparecera aqui para resolverla rapido.
              </p>
            </div>
          )}
          </div>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
