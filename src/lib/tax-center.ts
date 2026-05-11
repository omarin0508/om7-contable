import { getActiveContext } from "@/lib/active-context";
import {
  listJournalEntriesForSources,
  type JournalEntry,
} from "@/lib/accounting-entries";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import { listPurchases } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

export type TaxCenterPeriod = {
  month: number;
  year: number;
};

export type TaxTreatment = "creditable" | "not_creditable" | "exempt" | "review";

export type TaxCenterRecord = {
  accountingStatus: "missing" | "posted" | "suggested" | "reviewed" | "observed";
  amount: number;
  counterparty: string;
  date: string | null;
  documentHref: string | null;
  documentNumber: string | null;
  e7Href: string | null;
  hasE7Distribution: boolean;
  id: string;
  reviewStatus: string;
  subtotal: number;
  tax: number;
  taxTreatment?: TaxTreatment;
  total: number;
};

export type TaxCenterAlert = {
  href?: string;
  message: string;
  tone: "amber" | "cyan" | "rose";
  title: string;
};

export type TaxCenterData = {
  accountingTaxCredit: number;
  accountingTaxDebit: number;
  activeCompanyName: string | null;
  alerts: TaxCenterAlert[];
  currency: string;
  e7Mind: TaxMindInsight;
  period: TaxCenterPeriod;
  purchases: TaxCenterRecord[];
  purchaseTaxCredit: number;
  purchaseTaxReview: number;
  purchaseTaxableBase: number;
  pendingDocumentsWithTax: number;
  sales: TaxCenterRecord[];
  salesTaxDebit: number;
  salesTaxableBase: number;
  taxNet: number;
};

export type TaxMindStatus = "optimal" | "review_recommended" | "attention_required";

export type TaxMindInsight = {
  alerts: string[];
  diffAmount: number;
  highlights: Array<{
    label: string;
    value: string;
  }>;
  recommendedStep: string;
  score: number;
  status: TaxMindStatus;
  statusLabel: string;
  summary: string;
};

type DistributionLine = {
  document_id: string;
  tax_treatment: string | null;
  tax: number | null;
};

function isInPeriod(value: string | null | undefined, period: TaxCenterPeriod) {
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

function money(value: number | null | undefined) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function getDocumentHref(sourceDocumentId: string | null | undefined) {
  return sourceDocumentId ? `/documentos/${sourceDocumentId}` : null;
}

function getE7Href(sourceDocumentId: string | null | undefined) {
  return sourceDocumentId ? `/documentos/${sourceDocumentId}/distribucion` : null;
}

function getJournalStatus(
  entry: JournalEntry | null | undefined,
): TaxCenterRecord["accountingStatus"] {
  if (!entry) {
    return "missing";
  }

  if (entry.status === "posted") {
    return "posted";
  }

  if (entry.status === "reviewed" || entry.status === "observed") {
    return entry.status;
  }

  return "suggested";
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getPostedTaxFromLines(entries: JournalEntry[], kind: "credit" | "debit") {
  return entries
    .filter((entry) => entry.status === "posted")
    .flatMap((entry) => entry.lines ?? [])
    .filter((line) => {
      const accountName = normalizeText(line.account?.name);
      const isIva = accountName.includes("iva");
      const isCredit = accountName.includes("credito");
      const isDebit = accountName.includes("debito");

      return isIva && (kind === "credit" ? isCredit : isDebit);
    })
    .reduce((sum, line) => sum + money(line.amount), 0);
}

function getEntryTaxDifference(entry: JournalEntry) {
  const lines = entry.lines ?? [];
  const debit = lines
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + money(line.amount), 0);
  const credit = lines
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + money(line.amount), 0);

  return Math.abs(debit - credit);
}

function getTaxTreatment(lines: DistributionLine[]): TaxTreatment {
  if (lines.length === 0) {
    return "review";
  }

  const treatments = lines.map((line) => normalizeText(line.tax_treatment));

  if (treatments.some((item) => item.includes("exento"))) {
    return "exempt";
  }

  if (
    treatments.some(
      (item) => item.includes("no_acreditable") || item.includes("no acreditable"),
    )
  ) {
    return "not_creditable";
  }

  if (
    treatments.some(
      (item) =>
        item.includes("credito") ||
        item.includes("creditable") ||
        item.includes("acreditable"),
    )
  ) {
    return "creditable";
  }

  return "review";
}

function getTaxTreatmentLabel(treatment: TaxTreatment | undefined) {
  if (treatment === "creditable") {
    return "IVA acreditable";
  }

  if (treatment === "not_creditable") {
    return "No acreditable";
  }

  if (treatment === "exempt") {
    return "Exento";
  }

  return "Requiere revision";
}

export function getTaxTreatmentStatusLabel(treatment: TaxTreatment | undefined) {
  return getTaxTreatmentLabel(treatment);
}

async function getDistributionLines(documentIds: string[]) {
  if (documentIds.length === 0) {
    return new Map<string, DistributionLine[]>();
  }

  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const { data, error } = await supabase
    .from("document_accounting_distributions")
    .select("document_id, tax_treatment, tax")
    .in("document_id", documentIds);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DistributionLine[]).reduce((map, line) => {
    const current = map.get(line.document_id) ?? [];
    current.push(line);
    map.set(line.document_id, current);
    return map;
  }, new Map<string, DistributionLine[]>());
}

function buildAlerts({
  purchases,
  sales,
}: {
  purchases: TaxCenterRecord[];
  sales: TaxCenterRecord[];
}) {
  const alerts: TaxCenterAlert[] = [];
  const approvedMissing = [...sales, ...purchases].filter(
    (record) => record.reviewStatus === "approved" && record.accountingStatus !== "posted",
  );
  const reviewPurchases = purchases.filter(
    (purchase) => purchase.tax > 0 && purchase.taxTreatment === "review",
  );
  const pendingWithTax = [...sales, ...purchases].filter(
    (record) => record.tax > 0 && record.reviewStatus !== "approved",
  );

  if (approvedMissing.length > 0) {
    alerts.push({
      message: `${approvedMissing.length} registro(s) aprobados tienen IVA pero todavia no estan contabilizados.`,
      tone: "amber",
      title: "IVA detectado sin asiento posted",
    });
  }

  if (reviewPurchases.length > 0) {
    alerts.push({
      message: `${reviewPurchases.length} compra(s) tienen IVA sin tratamiento acreditable claro.`,
      tone: "rose",
      title: "IVA credito requiere revision",
    });
  }

  if (pendingWithTax.length > 0) {
    alerts.push({
      message: `${pendingWithTax.length} documento(s) con IVA siguen pendientes, revisados u observados.`,
      tone: "cyan",
      title: "IVA pendiente de aprobacion",
    });
  }

  return alerts;
}

function getStatusFromScore(score: number): {
  label: string;
  status: TaxMindStatus;
} {
  if (score >= 85) {
    return {
      label: "Optimo",
      status: "optimal",
    };
  }

  if (score >= 65) {
    return {
      label: "Revision recomendada",
      status: "review_recommended",
    };
  }

  return {
    label: "Atencion requerida",
    status: "attention_required",
  };
}

function buildTaxMindInsight({
  accountingTaxCredit,
  accountingTaxDebit,
  entries,
  purchaseTaxCredit,
  purchases,
  sales,
  salesTaxDebit,
}: {
  accountingTaxCredit: number;
  accountingTaxDebit: number;
  entries: JournalEntry[];
  purchaseTaxCredit: number;
  purchases: TaxCenterRecord[];
  sales: TaxCenterRecord[];
  salesTaxDebit: number;
}): TaxMindInsight {
  const records = [...sales, ...purchases];
  const approvedWithoutPosted = records.filter(
    (record) => record.reviewStatus === "approved" && record.accountingStatus !== "posted",
  ).length;
  const pendingWithTax = records.filter(
    (record) => record.tax > 0 && record.reviewStatus !== "approved",
  ).length;
  const reviewPurchases = purchases.filter(
    (purchase) => purchase.tax > 0 && purchase.taxTreatment === "review",
  ).length;
  const missingTrace = records.filter(
    (record) => record.tax > 0 && !record.documentHref,
  ).length;
  const missingDistribution = records.filter(
    (record) => record.tax > 0 && record.documentHref && !record.hasE7Distribution,
  ).length;
  const unbalancedEntries = entries.filter(
    (entry) => getEntryTaxDifference(entry) > 0.01,
  ).length;
  const diffAmount = money(
    Math.abs(salesTaxDebit - accountingTaxDebit) +
      Math.abs(purchaseTaxCredit - accountingTaxCredit),
  );
  const diffPenalty = diffAmount > 0.01 ? 12 : 0;
  const score = Math.max(
    0,
    100 -
      Math.min(36, approvedWithoutPosted * 18) -
      Math.min(28, reviewPurchases * 14) -
      Math.min(30, pendingWithTax * 10) -
      Math.min(20, missingTrace * 10) -
      Math.min(20, missingDistribution * 10) -
      Math.min(36, unbalancedEntries * 18) -
      diffPenalty,
  );
  const { label, status } = getStatusFromScore(score);
  const alerts = [
    approvedWithoutPosted > 0
      ? `${approvedWithoutPosted} registro(s) aprobados sin asiento contabilizado.`
      : null,
    pendingWithTax > 0
      ? `${pendingWithTax} registro(s) con IVA siguen pendientes de aprobacion.`
      : null,
    reviewPurchases > 0
      ? `${reviewPurchases} compra(s) tienen IVA sin tratamiento acreditable claro.`
      : null,
    missingDistribution > 0
      ? `${missingDistribution} documento(s) con IVA no tienen distribucion E7 asociada.`
      : null,
    unbalancedEntries > 0
      ? `${unbalancedEntries} asiento(s) estan descuadrados.`
      : null,
    diffAmount > 0.01
      ? `Diferencia documento/asiento estimada por ${diffAmount.toLocaleString("es-CR")}.`
      : null,
  ].filter(Boolean) as string[];
  const recommendedStep =
    approvedWithoutPosted > 0
      ? "Contabilizar los registros aprobados con IVA."
      : reviewPurchases > 0 || missingDistribution > 0
        ? "Revisar E7 Mind en compras con IVA sin tratamiento claro."
        : pendingWithTax > 0
          ? "Aprobar o corregir los registros con IVA pendiente."
          : unbalancedEntries > 0
            ? "Corregir asientos descuadrados antes del cierre."
            : diffAmount > 0.01
              ? "Comparar IVA de documentos contra asientos contabilizados."
              : "Periodo listo para revision final tributaria.";
  const summary =
    alerts.length > 0
      ? alerts[0]
      : "El periodo tributario se ve consistente para revision final.";

  return {
    alerts,
    diffAmount,
    highlights: [
      { label: "Sin asiento posted", value: String(approvedWithoutPosted) },
      { label: "IVA por revisar", value: String(reviewPurchases) },
      { label: "Pendientes IVA", value: String(pendingWithTax) },
      { label: "Sin E7", value: String(missingDistribution) },
    ],
    recommendedStep,
    score,
    status,
    statusLabel: label,
    summary,
  };
}

export async function getTaxCenterData(
  input?: Partial<TaxCenterPeriod>,
): Promise<TaxCenterData> {
  const today = new Date();
  const period = {
    month: input?.month ?? today.getMonth() + 1,
    year: input?.year ?? today.getFullYear(),
  };
  const activeContext = await getActiveContext();
  const [{ invoices }, { purchases }] = await Promise.all([
    getInvoicesForActiveCompany(),
    listPurchases(),
  ]);
  const periodInvoices = invoices.filter((invoice) =>
    isInPeriod(invoice.fecha ?? invoice.created_at, period),
  );
  const periodPurchases = purchases.filter((purchase) =>
    isInPeriod(purchase.purchase_date ?? purchase.created_at, period),
  );
  const [invoiceEntryMap, purchaseEntryMap, distributionMap] = await Promise.all([
    listJournalEntriesForSources(
      "invoice",
      periodInvoices.map((invoice) => invoice.id),
    ),
    listJournalEntriesForSources(
      "purchase",
      periodPurchases.map((purchase) => purchase.id),
    ),
    getDistributionLines(
      [
        ...periodInvoices.map((invoice) => invoice.source_document_id),
        ...periodPurchases.map((purchase) => purchase.source_document_id),
      ].filter(Boolean) as string[],
    ),
  ]);
  const sales = periodInvoices.map((invoice) => {
    const entry = invoiceEntryMap.get(invoice.id) ?? null;

    return {
      accountingStatus: getJournalStatus(entry),
      amount: money(invoice.total),
      counterparty: invoice.counterparty?.name ?? invoice.proveedor ?? "Sin cliente",
      date: invoice.fecha ?? invoice.created_at,
      documentHref: getDocumentHref(invoice.source_document_id),
      documentNumber: invoice.numero_documento,
      e7Href: getE7Href(invoice.source_document_id),
      hasE7Distribution: invoice.source_document_id
        ? distributionMap.has(invoice.source_document_id)
        : false,
      id: invoice.id,
      reviewStatus: normalizeReviewStatus(invoice.review_status),
      subtotal: money(invoice.subtotal),
      tax: money(invoice.impuesto),
      total: money(invoice.total),
    } satisfies TaxCenterRecord;
  });
  const purchaseRecords = periodPurchases.map((purchase) => {
    const entry = purchaseEntryMap.get(purchase.id) ?? null;
    const distributionLines = purchase.source_document_id
      ? distributionMap.get(purchase.source_document_id) ?? []
      : [];
    const taxTreatment = getTaxTreatment(distributionLines);

    return {
      accountingStatus: getJournalStatus(entry),
      amount: money(purchase.total),
      counterparty:
        purchase.counterparty?.name ?? purchase.supplier_name ?? "Sin proveedor",
      date: purchase.purchase_date ?? purchase.created_at,
      documentHref: getDocumentHref(purchase.source_document_id),
      documentNumber: purchase.document_number,
      e7Href: taxTreatment !== "review" ? getE7Href(purchase.source_document_id) : null,
      hasE7Distribution: distributionLines.length > 0,
      id: purchase.id,
      reviewStatus: normalizeReviewStatus(purchase.review_status),
      subtotal: money(purchase.subtotal),
      tax: money(purchase.tax),
      taxTreatment,
      total: money(purchase.total),
    } satisfies TaxCenterRecord;
  });
  const salesTaxDebit = sales
    .filter((sale) => sale.reviewStatus === "approved")
    .reduce((sum, sale) => sum + sale.tax, 0);
  const purchaseTaxCredit = purchaseRecords
    .filter(
      (purchase) =>
        purchase.reviewStatus === "approved" &&
        purchase.taxTreatment === "creditable",
    )
    .reduce((sum, purchase) => sum + purchase.tax, 0);
  const purchaseTaxReview = purchaseRecords
    .filter((purchase) => purchase.tax > 0 && purchase.taxTreatment === "review")
    .reduce((sum, purchase) => sum + purchase.tax, 0);
  const allEntries = [
    ...Array.from(invoiceEntryMap.values()),
    ...Array.from(purchaseEntryMap.values()),
  ];
  const accountingTaxCredit = getPostedTaxFromLines(allEntries, "credit");
  const accountingTaxDebit = getPostedTaxFromLines(allEntries, "debit");
  const e7Mind = buildTaxMindInsight({
    accountingTaxCredit,
    accountingTaxDebit,
    entries: allEntries,
    purchaseTaxCredit,
    purchases: purchaseRecords,
    sales,
    salesTaxDebit,
  });

  return {
    accountingTaxCredit,
    accountingTaxDebit,
    activeCompanyName: activeContext.activeCompany?.name ?? null,
    alerts: buildAlerts({
      purchases: purchaseRecords,
      sales,
    }),
    currency:
      activeContext.activeCompany?.base_currency ??
      activeContext.organization?.base_currency ??
      "CRC",
    e7Mind,
    period,
    purchases: purchaseRecords,
    purchaseTaxCredit,
    purchaseTaxReview,
    purchaseTaxableBase: purchaseRecords
      .filter((purchase) => purchase.tax > 0)
      .reduce((sum, purchase) => sum + purchase.subtotal, 0),
    pendingDocumentsWithTax: [...sales, ...purchaseRecords].filter(
      (record) => record.tax > 0 && record.reviewStatus !== "approved",
    ).length,
    sales,
    salesTaxDebit,
    salesTaxableBase: sales
      .filter((sale) => sale.tax > 0)
      .reduce((sum, sale) => sum + sale.subtotal, 0),
    taxNet: salesTaxDebit - purchaseTaxCredit,
  };
}
