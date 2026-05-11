import { getActiveContext } from "@/lib/active-context";
import { getPeriodLabel, normalizePeriodStatus } from "@/lib/accounting-periods";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { createClient } from "@/lib/supabase/server";

export type AssistantSnapshot = {
  accounting: {
    observed: number;
    pendingToPost: number;
    posted: number;
    reviewed: number;
    suggested: number;
    total: number;
  };
  companyName: string | null;
  documents: {
    converted: number;
    errors: number;
    readyToConvert: number;
    received: number;
    requiresReview: number;
    total: number;
    unconverted: number;
  };
  generatedAt: string;
  invoices: {
    approved: number;
    fromDocument: number;
    observed: number;
    pendingReview: number;
    reviewed: number;
    total: number;
  };
  organizationName: string | null;
  period: {
    blockers: number;
    label: string;
    observed: number;
    pending: number;
    status: "closed" | "in_review" | "open";
  };
  purchases: {
    approved: number;
    fromDocument: number;
    observed: number;
    pendingReview: number;
    reviewed: number;
    total: number;
  };
  warnings: string[];
};

type DocumentRow = {
  converted_at: string | null;
  converted_type: string | null;
  created_at: string | null;
  id: string;
  processing_status: string | null;
  review_status: string | null;
};

type ExtractionRow = {
  document_id: string;
  extraction_status: string | null;
};

type ReviewRow = {
  created_at: string | null;
  fecha?: string | null;
  id: string;
  purchase_date?: string | null;
  review_status: string | null;
  source_document_id: string | null;
};

type JournalRow = {
  id: string;
  period_month: number;
  period_year: number;
  status: string | null;
};

function emptySnapshot(warnings: string[] = []): AssistantSnapshot {
  const now = new Date();

  return {
    accounting: {
      observed: 0,
      pendingToPost: 0,
      posted: 0,
      reviewed: 0,
      suggested: 0,
      total: 0,
    },
    companyName: null,
    documents: {
      converted: 0,
      errors: 0,
      readyToConvert: 0,
      received: 0,
      requiresReview: 0,
      total: 0,
      unconverted: 0,
    },
    generatedAt: now.toISOString(),
    invoices: {
      approved: 0,
      fromDocument: 0,
      observed: 0,
      pendingReview: 0,
      reviewed: 0,
      total: 0,
    },
    organizationName: null,
    period: {
      blockers: 0,
      label: getPeriodLabel(now.getFullYear(), now.getMonth() + 1),
      observed: 0,
      pending: 0,
      status: "open",
    },
    purchases: {
      approved: 0,
      fromDocument: 0,
      observed: 0,
      pendingReview: 0,
      reviewed: 0,
      total: 0,
    },
    warnings,
  };
}

function isInPeriod(
  value: string | null | undefined,
  year: number,
  month: number,
) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month
  );
}

function summarizeReviews(rows: ReviewRow[]) {
  return rows.reduce(
    (summary, row) => {
      const status = normalizeReviewStatus(row.review_status);

      summary.total += 1;
      summary.fromDocument += row.source_document_id ? 1 : 0;

      if (status === "pending") {
        summary.pendingReview += 1;
      } else if (status === "reviewed") {
        summary.reviewed += 1;
      } else if (status === "approved") {
        summary.approved += 1;
      } else if (status === "observed") {
        summary.observed += 1;
      }

      return summary;
    },
    {
      approved: 0,
      fromDocument: 0,
      observed: 0,
      pendingReview: 0,
      reviewed: 0,
      total: 0,
    },
  );
}

function summarizeAccounting(rows: JournalRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;

      if (row.status === "posted") {
        summary.posted += 1;
      } else if (row.status === "reviewed") {
        summary.reviewed += 1;
        summary.pendingToPost += 1;
      } else if (row.status === "observed") {
        summary.observed += 1;
        summary.pendingToPost += 1;
      } else {
        summary.suggested += 1;
        summary.pendingToPost += 1;
      }

      return summary;
    },
    {
      observed: 0,
      pendingToPost: 0,
      posted: 0,
      reviewed: 0,
      suggested: 0,
      total: 0,
    },
  );
}

export async function getAssistantSnapshot(): Promise<AssistantSnapshot> {
  const warnings: string[] = [];
  const activeContext = await getActiveContext();
  const organization = activeContext.organization;
  const company = activeContext.activeCompany;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (!organization || !company) {
    return emptySnapshot(["Selecciona un cliente/empresa para activar el copiloto."]);
  }

  const supabase = await createClient();

  if (!supabase) {
    return emptySnapshot(["Supabase no esta configurado para leer el contexto."]);
  }

  const [
    documentsResult,
    extractionsResult,
    purchasesResult,
    invoicesResult,
    entriesResult,
    periodResult,
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("id, converted_at, converted_type, processing_status, review_status, created_at")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id)
      .is("deleted_at", null),
    supabase
      .from("document_extractions")
      .select("document_id, extraction_status")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id),
    supabase
      .from("purchases")
      .select("id, review_status, source_document_id, purchase_date, created_at")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id),
    supabase
      .from("invoices")
      .select("id, review_status, source_document_id, fecha, created_at")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id),
    supabase
      .from("journal_entries")
      .select("id, status, period_year, period_month")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id)
      .eq("period_year", year)
      .eq("period_month", month),
    supabase
      .from("accounting_periods")
      .select("status")
      .eq("organization_id", organization.id)
      .eq("company_id", company.id)
      .eq("period_year", year)
      .eq("period_month", month)
      .maybeSingle(),
  ]);

  if (documentsResult.error) {
    warnings.push("No se pudo leer documentos para el copiloto.");
  }

  if (extractionsResult.error) {
    warnings.push("No se pudo leer extracciones para el copiloto.");
  }

  if (purchasesResult.error) {
    warnings.push("No se pudo leer compras para el copiloto.");
  }

  if (invoicesResult.error) {
    warnings.push("No se pudo leer facturas para el copiloto.");
  }

  if (entriesResult.error) {
    warnings.push("No se pudo leer asientos para el copiloto.");
  }

  if (periodResult.error) {
    warnings.push("No se pudo leer el periodo actual para el copiloto.");
  }

  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const extractions = (extractionsResult.data ?? []) as ExtractionRow[];
  const extractionByDocumentId = new Map(
    extractions.map((extraction) => [extraction.document_id, extraction]),
  );
  const documentSummary = documents.reduce(
    (summary, document) => {
      const extraction = extractionByDocumentId.get(document.id);
      const converted = Boolean(document.converted_at || document.converted_type);
      const errored =
        document.processing_status === "error" ||
        document.review_status === "rejected" ||
        extraction?.extraction_status === "error";

      summary.total += 1;
      summary.converted += converted ? 1 : 0;
      summary.unconverted += converted ? 0 : 1;
      summary.errors += errored ? 1 : 0;

      if (!converted && !extraction) {
        summary.received += 1;
      }

      if (!converted && extraction?.extraction_status === "processed") {
        summary.requiresReview += 1;
      }

      if (!converted && extraction?.extraction_status === "reviewed") {
        summary.readyToConvert += 1;
      }

      return summary;
    },
    {
      converted: 0,
      errors: 0,
      readyToConvert: 0,
      received: 0,
      requiresReview: 0,
      total: 0,
      unconverted: 0,
    },
  );
  const purchases = (purchasesResult.data ?? []) as ReviewRow[];
  const invoices = (invoicesResult.data ?? []) as ReviewRow[];
  const purchaseSummary = summarizeReviews(purchases);
  const invoiceSummary = summarizeReviews(invoices);
  const currentPeriodRecords = [
    ...purchases.filter((purchase) =>
      isInPeriod(purchase.purchase_date ?? purchase.created_at, year, month),
    ),
    ...invoices.filter((invoice) =>
      isInPeriod(invoice.fecha ?? invoice.created_at, year, month),
    ),
  ];
  const periodPending = currentPeriodRecords.filter(
    (record) => normalizeReviewStatus(record.review_status) === "pending",
  ).length;
  const periodObserved = currentPeriodRecords.filter(
    (record) => normalizeReviewStatus(record.review_status) === "observed",
  ).length;

  return {
    accounting: summarizeAccounting((entriesResult.data ?? []) as JournalRow[]),
    companyName: company.name,
    documents: documentSummary,
    generatedAt: now.toISOString(),
    invoices: invoiceSummary,
    organizationName: organization.name,
    period: {
      blockers: periodPending + periodObserved,
      label: getPeriodLabel(year, month),
      observed: periodObserved,
      pending: periodPending,
      status: normalizePeriodStatus(periodResult.data?.status),
    },
    purchases: purchaseSummary,
    warnings,
  };
}
