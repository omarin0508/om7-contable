import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import {
  getCollectionStatusKey,
  getInvoiceCollectionSummary,
  getPaymentStatusKey,
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

export type MovementDashboardData = {
  activeContext: Awaited<ReturnType<typeof listPurchases>>["activeContext"];
  allCollections: InvoiceCollection[];
  allPayments: PurchasePayment[];
  collectionMap: Map<string, CollectionSummary>;
  invoices: Invoice[];
  methods: PaymentMethod[];
  overdueInvoices: Invoice[];
  overduePurchases: Purchase[];
  paidThisMonth: number;
  collectedThisMonth: number;
  paymentMap: Map<string, PaymentSummary>;
  pendingInvoices: Invoice[];
  pendingPurchases: Purchase[];
  purchases: Purchase[];
  totalPendingCollections: number;
  totalPendingPayments: number;
};

function getRecordDate(value: string | null | undefined) {
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function isThisMonth(value: string | null | undefined) {
  const date = getRecordDate(value);
  const now = new Date();

  return (
    date !== null &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function isPastDue(value: string | null | undefined) {
  const date = getRecordDate(value);
  const today = new Date();

  if (!date) {
    return false;
  }

  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date < today;
}

export async function getMovementDashboardData(): Promise<MovementDashboardData> {
  const { activeContext, purchases } = await listPurchases();
  const { invoices } = await getInvoicesForActiveCompany();
  const methodsResult = await listPaymentMethods().catch(() => ({
    methods: [] as PaymentMethod[],
  }));
  const paymentMap = await getPurchasePaymentSummary(
    purchases.map((purchase) => purchase.id),
  ).catch(() => new Map<string, PaymentSummary>());
  const collectionMap = await getInvoiceCollectionSummary(
    invoices.map((invoice) => invoice.id),
  ).catch(() => new Map<string, CollectionSummary>());
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
  const overduePurchases = pendingPurchases.filter((purchase) =>
    isPastDue(purchase.purchase_date ?? purchase.created_at),
  );
  const overdueInvoices = pendingInvoices.filter((invoice) =>
    isPastDue(invoice.fecha ?? invoice.created_at),
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
  const totalPendingCollections = pendingInvoices.reduce(
    (sum, invoice) =>
      sum +
      getRemainingAmount(invoice.total, collectionMap.get(invoice.id)?.amount ?? 0),
    0,
  );
  const totalPendingPayments = pendingPurchases.reduce(
    (sum, purchase) =>
      sum +
      getRemainingAmount(purchase.total, paymentMap.get(purchase.id)?.amount ?? 0),
    0,
  );

  return {
    activeContext,
    allCollections,
    allPayments,
    collectedThisMonth,
    collectionMap,
    invoices,
    methods: methodsResult.methods,
    overdueInvoices,
    overduePurchases,
    paidThisMonth,
    paymentMap,
    pendingInvoices,
    pendingPurchases,
    purchases,
    totalPendingCollections,
    totalPendingPayments,
  };
}
