import { getActiveContext } from "@/lib/active-context";
import { createClient } from "@/lib/supabase/server";

export type GmailXmlDiagnosticsFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  source?: "all" | "gmail" | "manual";
  status?: "all" | "pendiente" | "procesado" | "duplicado" | "omitido" | "error";
};

type DocumentRow = {
  id: string;
  organization_id: string;
  company_id: string;
  original_filename: string | null;
  mime_type: string | null;
  document_type: string | null;
  processing_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type ExtractionRow = {
  document_id: string;
  extraction_status: string | null;
  extracted_data: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string | null;
};

type GmailImportRow = {
  id: string;
  gmail_message_id: string;
  gmail_attachment_id: string;
  subject: string | null;
  attachment_filename: string | null;
  imported_document_id: string | null;
  import_status: string;
  error_message: string | null;
  sync_mode: string | null;
  batch_period: string | null;
  created_at: string | null;
};

type SyncPeriodRow = {
  id: string;
  period_key: string;
  date_from: string;
  date_to: string;
  gmail_query: string | null;
  status: string;
  found_count: number;
  processed_count: number;
  imported_count: number;
  duplicated_count: number;
  omitted_count: number;
  error_count: number;
  has_more_results: boolean;
  last_synced_at: string | null;
  closed_at: string | null;
  created_at: string | null;
};

function isDateOnly(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizeFilters(filters: GmailXmlDiagnosticsFilters) {
  return {
    dateFrom: isDateOnly(filters.dateFrom) ? filters.dateFrom : null,
    dateTo: isDateOnly(filters.dateTo) ? filters.dateTo : null,
    source: filters.source === "gmail" || filters.source === "manual"
      ? filters.source
      : "all",
    status: filters.status && filters.status !== "all" ? filters.status : "all",
  } as const;
}

function isXmlDocument(document: DocumentRow) {
  return (
    document.mime_type?.toLowerCase().includes("xml") ||
    document.original_filename?.toLowerCase().endsWith(".xml") ||
    document.metadata?.source_format === "xml-cr"
  );
}

function getMonthKey(value: string | null | undefined) {
  return value ? value.slice(0, 7) : "Sin fecha";
}

function addMonths(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));

  return date.toISOString().slice(0, 7);
}

function getExtractedDate(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;
  const raw =
    data?.fecha_emision ??
    data?.fechaEmision ??
    data?.fecha ??
    data?.issue_date ??
    null;

  return typeof raw === "string" && raw ? raw : null;
}

function getDocumentBusinessDate(
  document: DocumentRow,
  extraction: ExtractionRow | undefined,
) {
  return getExtractedDate(extraction) ?? document.created_at;
}

function buildMonthlyCounts(documents: DocumentRow[], extractionMap: Map<string, ExtractionRow>) {
  const counts = new Map<string, number>();

  for (const document of documents) {
    const month = getMonthKey(
      getDocumentBusinessDate(document, extractionMap.get(document.id)),
    );
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

function inferSparseMonths(monthlyCounts: Array<{ month: string; count: number }>) {
  const datedMonths = monthlyCounts
    .filter((item) => /^\d{4}-\d{2}$/.test(item.month))
    .sort((left, right) => left.month.localeCompare(right.month));

  if (datedMonths.length < 2) {
    return [] as Array<{ month: string; count: number; reason: string }>;
  }

  const countMap = new Map(datedMonths.map((item) => [item.month, item.count]));
  const maxCount = Math.max(...datedMonths.map((item) => item.count));
  const lowThreshold = Math.max(1, Math.floor(maxCount * 0.2));
  const sparse: Array<{ month: string; count: number; reason: string }> = [];
  let current = datedMonths[0].month;
  const end = datedMonths[datedMonths.length - 1].month;

  while (current <= end) {
    const count = countMap.get(current) ?? 0;

    if (count === 0) {
      sparse.push({ month: current, count, reason: "sin documentos" });
    } else if (count <= lowThreshold && maxCount >= 10) {
      sparse.push({ month: current, count, reason: "baja cantidad" });
    }

    current = addMonths(current, 1);
  }

  return sparse;
}

export async function getGmailXmlDiagnostics(filters: GmailXmlDiagnosticsFilters) {
  const activeContext = await getActiveContext();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const normalizedFilters = normalizeFilters(filters);

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      gmailXmlEnabled: false,
      filters: normalizedFilters,
      connection: null,
      kpis: null,
      monthlyCounts: [],
      sparseMonths: [],
      latestDocuments: [],
      latestErrors: [],
      statusCounts: [],
      syncPeriods: [],
    };
  }

  const organizationId = activeContext.organization.id;
  const companyId = activeContext.activeCompany.id;
  const gmailXmlEnabled = activeContext.activeCompany.gmail_xml_enabled === true;

  const { data: connection, error: connectionError } = await supabase
    .from("gmail_xml_connections")
    .select("id, gmail_email, last_sync_at, last_sync_status, last_sync_error")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!gmailXmlEnabled) {
    return {
      activeContext,
      gmailXmlEnabled,
      filters: normalizedFilters,
      connection,
      kpis: null,
      monthlyCounts: [],
      sparseMonths: [],
      latestDocuments: [],
      latestErrors: [],
      statusCounts: [],
      syncPeriods: [],
    };
  }

  let documentsQuery = supabase
    .from("documents")
    .select("id, organization_id, company_id, original_filename, mime_type, document_type, processing_status, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (normalizedFilters.dateFrom) {
    documentsQuery = documentsQuery.gte("created_at", `${normalizedFilters.dateFrom}T00:00:00.000Z`);
  }

  if (normalizedFilters.dateTo) {
    documentsQuery = documentsQuery.lt("created_at", `${normalizedFilters.dateTo}T00:00:00.000Z`);
  }

  const { data: documentData, error: documentsError } = await documentsQuery;

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  let importsQuery = supabase
    .from("gmail_xml_imports")
    .select("id, gmail_message_id, gmail_attachment_id, subject, attachment_filename, imported_document_id, import_status, error_message, sync_mode, batch_period, created_at")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (normalizedFilters.dateFrom) {
    importsQuery = importsQuery.gte("created_at", `${normalizedFilters.dateFrom}T00:00:00.000Z`);
  }

  if (normalizedFilters.dateTo) {
    importsQuery = importsQuery.lt("created_at", `${normalizedFilters.dateTo}T00:00:00.000Z`);
  }

  if (normalizedFilters.status !== "all") {
    importsQuery = importsQuery.eq("import_status", normalizedFilters.status);
  }

  const { data: importData, error: importsError } = await importsQuery;

  if (importsError) {
    throw new Error(importsError.message);
  }

  const { data: periodData, error: periodsError } = await supabase
    .from("gmail_xml_sync_periods")
    .select("id, period_key, date_from, date_to, gmail_query, status, found_count, processed_count, imported_count, duplicated_count, omitted_count, error_count, has_more_results, last_synced_at, closed_at, created_at")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .order("date_from", { ascending: false })
    .limit(36);

  if (periodsError && periodsError.code !== "42P01") {
    throw new Error(periodsError.message);
  }

  const documents = ((documentData ?? []) as DocumentRow[]).filter(isXmlDocument);
  const imports = (importData ?? []) as GmailImportRow[];
  const documentIds = documents.map((document) => document.id);
  const gmailDocumentIds = new Set(
    imports.map((item) => item.imported_document_id).filter(Boolean) as string[],
  );
  const filteredDocuments = documents.filter((document) => {
    if (normalizedFilters.source === "gmail") {
      return gmailDocumentIds.has(document.id);
    }

    if (normalizedFilters.source === "manual") {
      return !gmailDocumentIds.has(document.id);
    }

    return true;
  });

  const { data: extractionData, error: extractionsError } = documentIds.length > 0
    ? await supabase
        .from("document_extractions")
        .select("document_id, extraction_status, extracted_data, error_message, created_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .in("document_id", documentIds)
        .order("created_at", { ascending: false })
        .limit(3000)
    : { data: [], error: null };

  if (extractionsError) {
    throw new Error(extractionsError.message);
  }

  const extractionMap = new Map<string, ExtractionRow>();

  for (const extraction of (extractionData ?? []) as ExtractionRow[]) {
    if (!extractionMap.has(extraction.document_id)) {
      extractionMap.set(extraction.document_id, extraction);
    }
  }

  const businessDates = filteredDocuments
    .map((document) => getDocumentBusinessDate(document, extractionMap.get(document.id)))
    .filter(Boolean)
    .sort() as string[];
  const statusCounts = ["pendiente", "procesado", "duplicado", "omitido", "error"]
    .map((status) => ({
      status,
      count: imports.filter((item) => item.import_status === status).length,
    }));
  const monthlyCounts = buildMonthlyCounts(filteredDocuments, extractionMap);
  const latestDocuments = filteredDocuments.slice(0, 20).map((document) => ({
    ...document,
    source: gmailDocumentIds.has(document.id) ? "gmail" : "manual",
    business_date: getDocumentBusinessDate(document, extractionMap.get(document.id)),
    extraction: extractionMap.get(document.id) ?? null,
  }));
  const latestErrors = imports
    .filter((item) => item.import_status === "error" || item.error_message)
    .slice(0, 20);

  return {
    activeContext,
    gmailXmlEnabled,
    filters: normalizedFilters,
    connection,
    kpis: {
      totalXmlDocuments: filteredDocuments.length,
      gmailDocuments: filteredDocuments.filter((document) => gmailDocumentIds.has(document.id)).length,
      manualDocuments: filteredDocuments.filter((document) => !gmailDocumentIds.has(document.id)).length,
      oldestDate: businessDates[0] ?? null,
      newestDate: businessDates[businessDates.length - 1] ?? null,
      lastSyncAt: connection?.last_sync_at ?? null,
    },
    monthlyCounts,
    sparseMonths: inferSparseMonths(monthlyCounts),
    latestDocuments,
    latestErrors,
    statusCounts,
    syncPeriods: periodsError?.code === "42P01"
      ? []
      : ((periodData ?? []) as SyncPeriodRow[]),
  };
}
