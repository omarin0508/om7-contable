import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import {
  getCollectionStatusKey,
  getCollectionStatusLabel,
  getInvoiceCollectionSummary,
  getMovementStatusBadgeClass,
  getPaymentStatusKey,
  getPaymentStatusLabel,
  getPurchasePaymentSummary,
  getRemainingAmount,
  listPaymentMethods,
  type CollectionSummary,
  type InvoiceCollection,
  type PaymentMethod,
  type PaymentSummary,
  type PurchasePayment,
} from "@/lib/payments";
import { listPurchases, type Purchase } from "@/lib/purchases";

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

function getRecordDate(value: string | null | undefined) {
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function isThisMonth(value: string | null | undefined) {
  const date = getRecordDate(value);
  const now = new Date();

  return (
    date !== null &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function PurchaseMovementCard({
  currency,
  purchase,
  summary,
}: {
  currency: string;
  purchase: Purchase;
  summary: PaymentSummary | null;
}) {
  const paid = summary?.amount ?? 0;
  const status = getPaymentStatusKey(purchase.total, paid);
  const remaining = getRemainingAmount(purchase.total, paid);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className={getMovementStatusBadgeClass(status)}>
            {getPaymentStatusLabel(purchase.total, paid)}
          </span>
          <p className="mt-3 truncate text-sm font-semibold text-white">
            {purchase.counterparty?.name ?? purchase.supplier_name ?? "Sin proveedor"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Saldo: {formatMoney(remaining, purchase.currency ?? currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link className="om7-btn-secondary px-3 py-2 text-xs" href="/compras">
            Registrar pago
          </Link>
          {purchase.source_document_id ? (
            <Link
              className="om7-btn-ghost px-3 py-2 text-xs"
              href={`/documentos/${purchase.source_document_id}`}
            >
              Documento
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function InvoiceMovementCard({
  currency,
  invoice,
  summary,
}: {
  currency: string;
  invoice: Invoice;
  summary: CollectionSummary | null;
}) {
  const collected = summary?.amount ?? 0;
  const status = getCollectionStatusKey(invoice.total, collected);
  const remaining = getRemainingAmount(invoice.total, collected);

  return (
    <article className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className={getMovementStatusBadgeClass(status)}>
            {getCollectionStatusLabel(invoice.total, collected)}
          </span>
          <p className="mt-3 truncate text-sm font-semibold text-white">
            {invoice.counterparty?.name ?? invoice.proveedor ?? "Sin cliente"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Saldo: {formatMoney(remaining, invoice.moneda ?? currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link className="om7-btn-secondary px-3 py-2 text-xs" href="/facturas">
            Registrar cobro
          </Link>
          {invoice.source_document_id ? (
            <Link
              className="om7-btn-ghost px-3 py-2 text-xs"
              href={`/documentos/${invoice.source_document_id}`}
            >
              Documento
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function LatestMovementCard({
  amount,
  date,
  href,
  label,
  method,
}: {
  amount: string;
  date: string;
  href: string;
  label: string;
  method: string;
}) {
  return (
    <Link
      className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-400">
            {method} - {date}
          </p>
        </div>
        <p className="text-sm font-semibold text-cyan-100">{amount}</p>
      </div>
    </Link>
  );
}

export default async function MovimientosPage() {
  const [{ activeContext, purchases }, { invoices }, methodsResult] =
    await Promise.all([
      listPurchases(),
      getInvoicesForActiveCompany(),
      listPaymentMethods().catch(() => ({ methods: [] as PaymentMethod[] })),
    ]);
  const paymentMap = await getPurchasePaymentSummary(
    purchases.map((purchase) => purchase.id),
  ).catch(() => new Map<string, PaymentSummary>());
  const collectionMap = await getInvoiceCollectionSummary(
    invoices.map((invoice) => invoice.id),
  ).catch(() => new Map<string, CollectionSummary>());
  const activeCompany = activeContext.activeCompany;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? activeContext.organization?.base_currency ?? "CRC",
  );
  const pendingPurchases = purchases.filter(
    (purchase) =>
      getPaymentStatusKey(
        purchase.total,
        paymentMap.get(purchase.id)?.amount ?? 0,
      ) !== "paid",
  );
  const pendingInvoices = invoices.filter(
    (invoice) =>
      getCollectionStatusKey(
        invoice.total,
        collectionMap.get(invoice.id)?.amount ?? 0,
      ) !== "collected",
  );
  const allPayments = [...paymentMap.values()]
    .flatMap((summary) => summary.items)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const allCollections = [...collectionMap.values()]
    .flatMap((summary) => summary.items)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const paidThisMonth = allPayments
    .filter((payment) => isThisMonth(payment.payment_date))
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const collectedThisMonth = allCollections
    .filter((collection) => isThisMonth(collection.collection_date))
    .reduce((sum, collection) => sum + Number(collection.amount ?? 0), 0);
  const partialCount =
    purchases.filter(
      (purchase) =>
        getPaymentStatusKey(
          purchase.total,
          paymentMap.get(purchase.id)?.amount ?? 0,
        ) === "partial",
    ).length +
    invoices.filter(
      (invoice) =>
        getCollectionStatusKey(
          invoice.total,
          collectionMap.get(invoice.id)?.amount ?? 0,
        ) === "partial",
    ).length;
  const usedMethods = new Map<string, { count: number; method: PaymentMethod }>();

  for (const movement of [
    ...(allPayments as Array<PurchasePayment | InvoiceCollection>),
    ...(allCollections as Array<PurchasePayment | InvoiceCollection>),
  ]) {
    const method = movement.payment_method;

    if (!method) {
      continue;
    }

    const current = usedMethods.get(method.id) ?? { count: 0, method };
    current.count += 1;
    usedMethods.set(method.id, current);
  }

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Movimientos"
        description="Resumen de pagos y cobros del periodo, conectado con compras y facturas."
        action={<BackLink />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          detail="Compras con saldo"
          label="Pendientes pago"
          value={String(pendingPurchases.length)}
        />
        <MetricCard
          detail="Facturas con saldo"
          label="Pendientes cobro"
          value={String(pendingInvoices.length)}
        />
        <MetricCard
          detail="Mes actual"
          label="Pagado"
          value={formatMoney(paidThisMonth, currency)}
        />
        <MetricCard
          detail="Mes actual"
          label="Cobrado"
          value={formatMoney(collectedThisMonth, currency)}
        />
        <MetricCard
          detail="Pagos o cobros incompletos"
          label="Parcial"
          value={String(partialCount)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">
                  Compras pendientes pago
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Saldos por registrar o completar.
                </p>
              </div>
              <StatusBadge>{pendingPurchases.length}</StatusBadge>
            </div>
          </div>
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain p-5">
            <div className="grid gap-3">
              {pendingPurchases.length > 0 ? (
                pendingPurchases.map((purchase) => (
                  <PurchaseMovementCard
                    currency={currency}
                    key={purchase.id}
                    purchase={purchase}
                    summary={paymentMap.get(purchase.id) ?? null}
                  />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] p-6 text-sm text-slate-400">
                  No hay compras pendientes de pago.
                </p>
              )}
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">
                  Facturas pendientes cobro
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Cuentas por cobrar en seguimiento.
                </p>
              </div>
              <StatusBadge>{pendingInvoices.length}</StatusBadge>
            </div>
          </div>
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain p-5">
            <div className="grid gap-3">
              {pendingInvoices.length > 0 ? (
                pendingInvoices.map((invoice) => (
                  <InvoiceMovementCard
                    currency={currency}
                    invoice={invoice}
                    key={invoice.id}
                    summary={collectionMap.get(invoice.id) ?? null}
                  />
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] p-6 text-sm text-slate-400">
                  No hay facturas pendientes de cobro.
                </p>
              )}
            </div>
          </div>
        </PremiumCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">Ultimos pagos</p>
          <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto overscroll-contain">
            {allPayments.slice(0, 8).map((payment) => (
              <LatestMovementCard
                amount={formatMoney(payment.amount, currency)}
                date={payment.payment_date}
                href="/compras"
                key={payment.id}
                label="Pago de compra"
                method={payment.payment_method?.name ?? "Metodo no registrado"}
              />
            ))}
            {allPayments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] p-6 text-sm text-slate-400">
                Aun no hay pagos registrados.
              </p>
            ) : null}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">Ultimos cobros</p>
          <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto overscroll-contain">
            {allCollections.slice(0, 8).map((collection) => (
              <LatestMovementCard
                amount={formatMoney(collection.amount, currency)}
                date={collection.collection_date}
                href="/facturas"
                key={collection.id}
                label="Cobro de factura"
                method={collection.payment_method?.name ?? "Metodo no registrado"}
              />
            ))}
            {allCollections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025] p-6 text-sm text-slate-400">
                Aun no hay cobros registrados.
              </p>
            ) : null}
          </div>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-base font-semibold text-white">
            Metodos de pago usados
          </p>
          <div className="mt-4 grid gap-3">
            {(usedMethods.size > 0
              ? [...usedMethods.values()]
              : methodsResult.methods.map((method) => ({ count: 0, method }))
            ).map(({ count, method }) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/20 p-4"
                key={method.id}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{method.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{method.type}</p>
                </div>
                <span className="om7-chip om7-chip-cyan">{count}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      </section>
    </ModuleFrame>
  );
}
