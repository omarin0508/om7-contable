import {
  normalizeReviewStatus,
  type AccountingReviewStatus,
} from "@/lib/accounting-review-ui";
import { getDocumentHumanStatus, type DocumentUiLike } from "@/lib/document-ui";
import type { Invoice } from "@/lib/invoices";
import type { Purchase } from "@/lib/purchases";

export type MonthlyReportPeriod = {
  month: number;
  year: number;
};

export type AmountSummary = {
  amount: number;
  count: number;
  key: string;
  label: string;
};

export type ReviewStatusSummary = {
  amount: number;
  count: number;
  status: AccountingReviewStatus;
};

export type DocumentPeriodSummary = {
  converted: number;
  errors: number;
  pending: number;
  received: number;
  unconverted: number;
};

type ReportDocument = DocumentUiLike & {
  converted_at?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

export function isDateInPeriod(
  value: string | null | undefined,
  period: MonthlyReportPeriod,
) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === period.year &&
    date.getMonth() + 1 === period.month
  );
}

export function summarizePurchasesByCategory(
  purchases: Purchase[],
  period: MonthlyReportPeriod,
) {
  const summary = new Map<string, AmountSummary>();

  purchases
    .filter((purchase) =>
      isDateInPeriod(purchase.purchase_date ?? purchase.created_at, period),
    )
    .forEach((purchase) => {
      const label = purchase.category?.trim() || "Sin categoria";
      const key = label.toLowerCase();
      const current = summary.get(key) ?? {
        amount: 0,
        count: 0,
        key,
        label,
      };

      current.amount += Number(purchase.total ?? 0);
      current.count += 1;
      summary.set(key, current);
    });

  return [...summary.values()].sort((left, right) => right.amount - left.amount);
}

export function summarizeByReviewStatus<T extends { review_status?: string | null }>(
  records: T[],
  period: MonthlyReportPeriod,
  getDate: (record: T) => string | null | undefined,
  getAmount: (record: T) => number | null | undefined,
) {
  const initialStatuses: AccountingReviewStatus[] = [
    "pending",
    "reviewed",
    "approved",
    "observed",
  ];
  const summary = new Map<AccountingReviewStatus, ReviewStatusSummary>(
    initialStatuses.map((status) => [
      status,
      {
        amount: 0,
        count: 0,
        status,
      },
    ]),
  );

  records
    .filter((record) => isDateInPeriod(getDate(record), period))
    .forEach((record) => {
      const status = normalizeReviewStatus(record.review_status);
      const current = summary.get(status);

      if (!current) {
        return;
      }

      current.amount += Number(getAmount(record) ?? 0);
      current.count += 1;
    });

  return [...summary.values()];
}

export function summarizeDocumentsForPeriod(
  documents: ReportDocument[],
  period: MonthlyReportPeriod,
): DocumentPeriodSummary {
  const activeDocuments = documents.filter((document) => !document.deleted_at);
  const periodDocuments = activeDocuments.filter((document) =>
    isDateInPeriod(document.created_at, period),
  );
  const convertedInPeriod = activeDocuments.filter((document) =>
    isDateInPeriod(document.converted_at, period),
  );

  const summary = periodDocuments.reduce<DocumentPeriodSummary>(
    (summary, document) => {
      const humanStatus = getDocumentHumanStatus(document);
      const converted = Boolean(document.converted_at);

      summary.received += 1;

      if (!converted && humanStatus.key !== "convertido") {
        summary.unconverted += 1;
      }

      if (humanStatus.key === "error") {
        summary.errors += 1;
      }

      if (humanStatus.key === "recibido" || humanStatus.key === "requiere_revision") {
        summary.pending += 1;
      }

      return summary;
    },
    {
      converted: 0,
      errors: 0,
      pending: 0,
      received: 0,
      unconverted: 0,
    },
  );

  summary.converted = convertedInPeriod.length;

  return summary;
}

export function getMonthlyReport({
  documents,
  invoices,
  period,
  purchases,
}: {
  documents: ReportDocument[];
  invoices: Invoice[];
  period: MonthlyReportPeriod;
  purchases: Purchase[];
}) {
  const periodPurchases = purchases.filter((purchase) =>
    isDateInPeriod(purchase.purchase_date ?? purchase.created_at, period),
  );
  const periodInvoices = invoices.filter((invoice) =>
    isDateInPeriod(invoice.fecha ?? invoice.created_at, period),
  );
  const totalPurchases = periodPurchases.reduce(
    (sum, purchase) => sum + Number(purchase.total ?? 0),
    0,
  );
  const totalInvoices = periodInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );
  const allRecords = [...periodPurchases, ...periodInvoices];
  const pending = allRecords.filter(
    (record) => normalizeReviewStatus(record.review_status) === "pending",
  ).length;
  const observed = allRecords.filter(
    (record) => normalizeReviewStatus(record.review_status) === "observed",
  ).length;
  const approved = allRecords.filter(
    (record) => normalizeReviewStatus(record.review_status) === "approved",
  ).length;

  return {
    approved,
    balance: totalInvoices - totalPurchases,
    documents: summarizeDocumentsForPeriod(documents, period),
    invoiceStatus: summarizeByReviewStatus(
      invoices,
      period,
      (invoice) => invoice.fecha ?? invoice.created_at,
      (invoice) => invoice.total,
    ),
    observed,
    observedRecords: allRecords
      .filter(
        (record) => normalizeReviewStatus(record.review_status) === "observed",
      )
      .sort(
        (left, right) =>
          new Date(
            ("purchase_date" in right ? right.purchase_date : right.fecha) ??
              right.created_at ??
              0,
          ).getTime() -
          new Date(
            ("purchase_date" in left ? left.purchase_date : left.fecha) ??
              left.created_at ??
              0,
          ).getTime(),
      ),
    pending,
    purchaseCategories: summarizePurchasesByCategory(purchases, period),
    purchaseStatus: summarizeByReviewStatus(
      purchases,
      period,
      (purchase) => purchase.purchase_date ?? purchase.created_at,
      (purchase) => purchase.total,
    ),
    totalInvoices,
    totalPurchases,
  };
}
