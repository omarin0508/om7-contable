import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getAdminDashboardMetrics } from "@/lib/admin-dashboard";
import { getActiveContext } from "@/lib/active-context";
import { getAccountingSummaryForPeriod } from "@/lib/accounting-entries";
import { getCurrentAccountingPeriod } from "@/lib/accounting-periods";
import { listCounterparties } from "@/lib/counterparties";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import {
  getCollectionStatusKey,
  getInvoiceCollectionSummary,
  getPaymentStatusKey,
  getPurchasePaymentSummary,
  type CashflowOverview,
  type CollectionSummary,
  type PaymentSummary,
} from "@/lib/payments";
import { listPurchases } from "@/lib/purchases";
import { listDocumentsByCompany } from "@/lib/storage";

type DashboardPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeContext = await getActiveContext();
  const [
    adminMetrics,
    documentsResult,
    purchasesResult,
    invoicesResult,
    counterpartiesResult,
    currentPeriod,
  ] = await Promise.all([
    getAdminDashboardMetrics(),
    listDocumentsByCompany(),
    listPurchases(),
    getInvoicesForActiveCompany(),
    listCounterparties({ status: "active", type: "all" }),
    activeContext.activeCompany
      ? getCurrentAccountingPeriod(activeContext.activeCompany.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const accountingSummary =
    activeContext.activeCompany && currentPeriod
      ? await getAccountingSummaryForPeriod(
          activeContext.activeCompany.id,
          currentPeriod.period_year,
          currentPeriod.period_month,
        ).catch(() => null)
      : null;
  const purchasePaymentMap = await getPurchasePaymentSummary(
    purchasesResult.purchases.map((purchase) => purchase.id),
  ).catch(() => new Map<string, PaymentSummary>());
  const invoiceCollectionMap = await getInvoiceCollectionSummary(
    invoicesResult.invoices.map((invoice) => invoice.id),
  ).catch(() => new Map<string, CollectionSummary>());
  const currentYear = currentPeriod?.period_year ?? new Date().getFullYear();
  const currentMonth = currentPeriod?.period_month ?? new Date().getMonth() + 1;
  const isCurrentMonth = (dateValue: string | null | undefined) => {
    const date = dateValue ? new Date(dateValue) : null;

    return (
      date !== null &&
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === currentYear &&
      date.getMonth() + 1 === currentMonth
    );
  };
  const paymentOverview: CashflowOverview = {
    collectedThisMonth: [...invoiceCollectionMap.values()].reduce(
      (sum, summary) =>
        sum +
        summary.items
          .filter((item) => isCurrentMonth(item.collection_date))
          .reduce((itemSum, item) => itemSum + Number(item.amount ?? 0), 0),
      0,
    ),
    paidThisMonth: [...purchasePaymentMap.values()].reduce(
      (sum, summary) =>
        sum +
        summary.items
          .filter((item) => isCurrentMonth(item.payment_date))
          .reduce((itemSum, item) => itemSum + Number(item.amount ?? 0), 0),
      0,
    ),
    partialMovements:
      purchasesResult.purchases.filter(
        (purchase) =>
          getPaymentStatusKey(
            purchase.total,
            purchasePaymentMap.get(purchase.id)?.amount ?? 0,
          ) === "partial",
      ).length +
      invoicesResult.invoices.filter(
        (invoice) =>
          getCollectionStatusKey(
            invoice.total,
            invoiceCollectionMap.get(invoice.id)?.amount ?? 0,
          ) === "partial",
      ).length,
    pendingCollections: invoicesResult.invoices.filter(
      (invoice) =>
        getCollectionStatusKey(
          invoice.total,
          invoiceCollectionMap.get(invoice.id)?.amount ?? 0,
        ) !== "collected",
    ).length,
    pendingPayments: purchasesResult.purchases.filter(
      (purchase) =>
        getPaymentStatusKey(
          purchase.total,
          purchasePaymentMap.get(purchase.id)?.amount ?? 0,
        ) !== "paid",
    ).length,
  };

  return (
    <DashboardView
      activeContext={activeContext}
      adminMetrics={adminMetrics}
      counterparties={counterpartiesResult.counterparties}
      currentPeriod={currentPeriod}
      accountingSummary={accountingSummary}
      documents={documentsResult.documents}
      invoices={invoicesResult.invoices}
      paymentOverview={paymentOverview}
      purchases={purchasesResult.purchases}
      viewMode={resolvedSearchParams.view === "operativo" ? "operativo" : "principal"}
    />
  );
}
