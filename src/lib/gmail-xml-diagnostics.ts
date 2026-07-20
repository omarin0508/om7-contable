import { getActiveContext } from "@/lib/active-context";
import {
  normalizeCounterpartyName,
  normalizeTaxId,
} from "@/lib/counterparties";
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
  display_name?: string | null;
  mime_type: string | null;
  document_type: string | null;
  processing_status: string | null;
  metadata: Record<string, unknown> | null;
  converted_at?: string | null;
  converted_type?: string | null;
  converted_record_id?: string | null;
  created_at: string | null;
};

type ExtractionRow = {
  document_id: string;
  extraction_status: string | null;
  extraction_provider?: string | null;
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

type CounterpartyRow = {
  id: string;
  name: string;
  tax_id: string | null;
  normalized_tax_id: string | null;
  normalized_name: string | null;
};

type CounterpartyMatchRow = {
  document_id: string;
  counterparty_id: string | null;
  match_status: string | null;
  status: string | null;
  name: string | null;
  tax_id: string | null;
};

type ConvertedRecordRow = {
  id: string;
  source_document_id: string | null;
  counterparty_id: string | null;
};

type PaginatedQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string; code?: string } | null;
  }>;
};

export type GmailXmlDocumentDiagnosticDetail = {
  documentId: string;
  filename: string;
  providerName: string;
  providerTaxId: string | null;
  fiscalKey: string | null;
  documentNumber: string | null;
  fiscalDate: string | null;
  monthKey: string;
  subtotal: number;
  iva: number;
  total: number;
  importStatus: string;
  conversionStatus: string;
  convertedRecordId: string | null;
  convertedType: string | null;
  source: "gmail" | "manual";
  importedAt: string | null;
  classificationStatus: string;
  linkedCounterpartyName: string | null;
  extractionStatus: string | null;
  observations: string[];
  possibleDuplicate: boolean;
};

export type GmailXmlProviderSummary = {
  providerName: string;
  providerTaxId: string | null;
  documentsCount: number;
  subtotal: number;
  iva: number;
  total: number;
  averagePerDocument: number;
  oldestDate: string | null;
  newestDate: string | null;
  lastImportAt: string | null;
  classificationStatus: string;
  linkedCounterpartyName: string | null;
};

export type GmailXmlIvaRateSummary = {
  rateKey: string;
  rateLabel: string;
  ratePercent: number | null;
  documentsCount: number;
  linesCount: number;
  taxableBase: number;
  iva: number;
  totalPortion: number;
  totalShare: number;
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchAllRows<T>(
  createQuery: () => PaginatedQuery<T>,
  batchSize = 1000,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await createQuery().range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return rows;
}

async function fetchAllRowsByIds<T>(
  ids: string[],
  createQuery: (chunk: string[]) => PaginatedQuery<T>,
  chunkSize = 500,
) {
  const rows: T[] = [];

  for (const chunk of chunkArray(ids, chunkSize)) {
    rows.push(...(await fetchAllRows(() => createQuery(chunk))));
  }

  return rows;
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
    data?.issued_at ??
    data?.invoice_date ??
    data?.document_date ??
    data?.issue_date ??
    null;

  return typeof raw === "string" && raw ? raw : null;
}

function normalizeNumericValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const clean = value
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function getLineItems(extraction: ExtractionRow | undefined) {
  const lines = extraction?.extracted_data?.line_items;

  return Array.isArray(lines) ? (lines as Array<Record<string, unknown>>) : [];
}

function getLineTax(line: Record<string, unknown>) {
  return normalizeNumericValue(
    line.impuesto ??
      line.tax ??
      line.iva ??
      line.monto_impuesto ??
      line.montoIva ??
      0,
  );
}

function getLineSubtotal(line: Record<string, unknown>) {
  return normalizeNumericValue(
    line.subtotal ??
      line.base_imponible ??
      line.baseImponible ??
      line.monto_total ??
      line.monto ??
      line.amount ??
      0,
  );
}

function getLineTotal(line: Record<string, unknown>) {
  return normalizeNumericValue(
    line.total_linea ??
      line.total ??
      line.monto_total_linea ??
      line.amount_total ??
      0,
  );
}

function normalizeRatePercent(value: unknown) {
  const rate = normalizeNumericValue(value);

  if (rate <= 0) {
    return null;
  }

  return Math.round(rate * 10000) / 10000;
}

function inferRatePercent(tax: number, taxableBase: number) {
  if (tax <= 0) {
    return 0;
  }

  if (taxableBase <= 0) {
    return null;
  }

  return Math.round((tax / taxableBase) * 10000) / 100;
}

function getIvaRateLabel(ratePercent: number | null) {
  if (ratePercent === null) {
    return "IVA sin tarifa detectada";
  }

  if (ratePercent === 0) {
    return "Exento / 0%";
  }

  return `IVA ${ratePercent.toLocaleString("es-CR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  })}%`;
}

function getIvaRateKey(ratePercent: number | null) {
  return ratePercent === null ? "unknown" : `rate:${ratePercent}`;
}

function getExtractedIva(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return normalizeNumericValue(
    data?.impuesto ??
      data?.tax ??
      data?.iva ??
      data?.total_impuesto ??
      data?.totalImpuesto ??
      data?.TotalImpuesto ??
      data?.monto_impuesto ??
      data?.montoIva ??
      0,
  );
}

function getExtractedSubtotal(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return normalizeNumericValue(
    data?.subtotal ??
      data?.base_imponible ??
      data?.baseImponible ??
      data?.base ??
      0,
  );
}

function getExtractedTotal(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return normalizeNumericValue(
    data?.total ??
      data?.total_comprobante ??
      data?.totalComprobante ??
      data?.TotalComprobante ??
      0,
  );
}

function getTextValue(...values: unknown[]) {
  for (const value of values) {
    const clean = String(value ?? "").trim();

    if (clean) {
      return clean;
    }
  }

  return "";
}

function normalizeFiscalKey(value: unknown) {
  return String(value ?? "").trim();
}

function getFiscalDedupKey(
  document: DocumentRow,
  extraction: ExtractionRow | undefined,
) {
  const data = extraction?.extracted_data;
  const fiscalKey = normalizeFiscalKey(
    data?.clave ??
      data?.Clave ??
      data?.clave_fiscal ??
      data?.numero_clave ??
      data?.key,
  );

  return fiscalKey ? `clave:${fiscalKey}` : `document:${document.id}`;
}

function getFiscalKey(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return normalizeFiscalKey(
    data?.clave ??
      data?.Clave ??
      data?.clave_fiscal ??
      data?.numero_clave ??
      data?.key,
  ) || null;
}

function normalizeDateCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const clean = value.trim();
  const parsed = Date.parse(clean);

  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  const slashMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      .toISOString();
  }

  return null;
}

function getFiscalOrFallbackDate(
  document: DocumentRow,
  extraction: ExtractionRow | undefined,
) {
  const fiscalDate = normalizeDateCandidate(getExtractedDate(extraction));

  if (fiscalDate) {
    return { value: fiscalDate, source: "fiscal" as const };
  }

  // Fallback intentional: algunos documentos antiguos no tienen fecha fiscal extraida.
  return {
    value: normalizeDateCandidate(document.created_at),
    source: "created_at" as const,
  };
}

function getDocumentBusinessDate(
  document: DocumentRow,
  extraction: ExtractionRow | undefined,
) {
  return getExtractedDate(extraction) ?? document.created_at;
}

function isWithinDateRange(
  value: string | null | undefined,
  filters: ReturnType<typeof normalizeFilters>,
) {
  if (!value) {
    return !filters.dateFrom && !filters.dateTo;
  }

  const normalizedDate = normalizeDateCandidate(value)?.slice(0, 10);

  if (!normalizedDate) {
    return !filters.dateFrom && !filters.dateTo;
  }

  if (filters.dateFrom && normalizedDate < filters.dateFrom) {
    return false;
  }

  if (filters.dateTo && normalizedDate >= filters.dateTo) {
    return false;
  }

  return true;
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

function buildSnapshotMetrics(
  documents: DocumentRow[],
  extractionMap: Map<string, ExtractionRow>,
) {
  const uniqueDocuments = new Map<string, DocumentRow>();
  const duplicateKeys = new Map<string, number>();
  const dates: string[] = [];
  let totalIva = 0;
  let fiscalDateFallbackCount = 0;

  for (const document of documents) {
    const extraction = extractionMap.get(document.id);
    const dedupKey = getFiscalDedupKey(document, extraction);
    duplicateKeys.set(dedupKey, (duplicateKeys.get(dedupKey) ?? 0) + 1);

    if (!uniqueDocuments.has(dedupKey)) {
      uniqueDocuments.set(dedupKey, document);
      totalIva += getExtractedIva(extraction);

      const date = getFiscalOrFallbackDate(document, extraction);
      if (date.value) {
        dates.push(date.value);
      }
      if (date.source === "created_at") {
        fiscalDateFallbackCount += 1;
      }
    }
  }

  dates.sort();

  return {
    totalIva,
    fiscalDateMin: dates[0] ?? null,
    fiscalDateMax: dates[dates.length - 1] ?? null,
    fiscalDateFallbackCount,
    duplicatesCount: [...duplicateKeys.values()]
      .reduce((total, count) => total + Math.max(0, count - 1), 0),
    uniqueFiscalDocuments: uniqueDocuments.size,
  };
}

function getDocumentImport(imports: GmailImportRow[], documentId: string) {
  return imports.find((item) => item.imported_document_id === documentId) ?? null;
}

function getProviderName(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return getTextValue(
    data?.emisor_nombre,
    data?.supplier_name,
    data?.proveedor,
    data?.provider_name,
    data?.issuer_name,
  );
}

function getProviderTaxId(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return getTextValue(
    data?.emisor_cedula,
    data?.supplier_tax_id,
    data?.tax_id,
    data?.provider_tax_id,
    data?.issuer_tax_id,
  ) || null;
}

function getDocumentNumber(extraction: ExtractionRow | undefined) {
  const data = extraction?.extracted_data;

  return getTextValue(
    data?.numero_consecutivo,
    data?.document_number,
    data?.consecutivo,
    data?.numero_documento,
  ) || null;
}

function getLinkedCounterparty({
  counterpartyById,
  counterpartyByName,
  counterpartyByTaxId,
  invoiceByDocumentId,
  matchByDocumentId,
  providerName,
  providerTaxId,
  purchaseByDocumentId,
}: {
  counterpartyById: Map<string, CounterpartyRow>;
  counterpartyByName: Map<string, CounterpartyRow>;
  counterpartyByTaxId: Map<string, CounterpartyRow>;
  invoiceByDocumentId: Map<string, ConvertedRecordRow>;
  matchByDocumentId: Map<string, CounterpartyMatchRow>;
  providerName: string;
  providerTaxId: string | null;
  purchaseByDocumentId: Map<string, ConvertedRecordRow>;
}) {
  return (documentId: string) => {
    const match = matchByDocumentId.get(documentId);
    const convertedCounterpartyId =
      purchaseByDocumentId.get(documentId)?.counterparty_id ??
      invoiceByDocumentId.get(documentId)?.counterparty_id ??
      null;
    const linkedById = convertedCounterpartyId
      ? counterpartyById.get(convertedCounterpartyId) ?? null
      : null;
    const matchedById = match?.counterparty_id
      ? counterpartyById.get(match.counterparty_id) ?? null
      : null;
    const matchedByTax = providerTaxId
      ? counterpartyByTaxId.get(normalizeTaxId(providerTaxId)) ?? null
      : null;
    const matchedByName = providerName
      ? counterpartyByName.get(normalizeCounterpartyName(providerName)) ?? null
      : null;

    return linkedById ?? matchedById ?? matchedByTax ?? matchedByName ?? null;
  };
}

function buildDocumentDetails({
  counterpartyById,
  counterpartyByName,
  counterpartyByTaxId,
  documents,
  extractionMap,
  imports,
  invoiceByDocumentId,
  matchByDocumentId,
  purchaseByDocumentId,
}: {
  counterpartyById: Map<string, CounterpartyRow>;
  counterpartyByName: Map<string, CounterpartyRow>;
  counterpartyByTaxId: Map<string, CounterpartyRow>;
  documents: DocumentRow[];
  extractionMap: Map<string, ExtractionRow>;
  imports: GmailImportRow[];
  invoiceByDocumentId: Map<string, ConvertedRecordRow>;
  matchByDocumentId: Map<string, CounterpartyMatchRow>;
  purchaseByDocumentId: Map<string, ConvertedRecordRow>;
}) {
  const duplicateKeyCounts = new Map<string, number>();

  for (const document of documents) {
    const extraction = extractionMap.get(document.id);
    const key = getFiscalDedupKey(document, extraction);
    duplicateKeyCounts.set(key, (duplicateKeyCounts.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const details: GmailXmlDocumentDiagnosticDetail[] = [];

  for (const document of documents) {
    const extraction = extractionMap.get(document.id);
    const dedupKey = getFiscalDedupKey(document, extraction);

    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);

    const providerName = getProviderName(extraction);
    const providerTaxId = getProviderTaxId(extraction);
    const importRow = getDocumentImport(imports, document.id);
    const date = getFiscalOrFallbackDate(document, extraction);
    const subtotal = getExtractedSubtotal(extraction);
    const iva = getExtractedIva(extraction);
    const rawTotal = getExtractedTotal(extraction);
    const total = rawTotal > 0 ? rawTotal : subtotal + iva;
    const linkedCounterparty = getLinkedCounterparty({
      counterpartyById,
      counterpartyByName,
      counterpartyByTaxId,
      invoiceByDocumentId,
      matchByDocumentId,
      providerName,
      providerTaxId,
      purchaseByDocumentId,
    })(document.id);
    const possibleDuplicate = (duplicateKeyCounts.get(dedupKey) ?? 0) > 1;
    const observations: string[] = [];

    if (!providerName) observations.push("Sin proveedor claro");
    if (providerName && !providerTaxId) observations.push("Proveedor sin tax_id");
    if (date.source === "created_at") observations.push("Sin fecha fiscal extraida");
    if (iva === 0) observations.push("Sin IVA detectado");
    if (possibleDuplicate) observations.push("Posible duplicado fiscal");
    if (extraction?.extraction_status === "error") observations.push("Error de extraccion");
    if (!document.converted_at && !document.converted_type) {
      observations.push("Importado no convertido");
    }

    const classificationStatus = linkedCounterparty
      ? "vinculado a contraparte"
      : possibleDuplicate
        ? "posible duplicado"
        : providerName && !providerTaxId
          ? "nombre detectado pero sin tax_id"
          : "pendiente de vincular";

    details.push({
      documentId: document.id,
      filename: document.display_name ?? document.original_filename ?? "documento.xml",
      providerName: providerName || "Sin proveedor claro",
      providerTaxId,
      fiscalKey: getFiscalKey(extraction),
      documentNumber: getDocumentNumber(extraction),
      fiscalDate: date.value,
      monthKey: date.value ? date.value.slice(0, 7) : "Sin fecha",
      subtotal,
      iva,
      total,
      importStatus: importRow?.import_status ?? "manual/base",
      conversionStatus:
        document.converted_type && document.converted_record_id
          ? `convertido a ${document.converted_type}`
          : "pendiente de convertir",
      convertedRecordId: document.converted_record_id ?? null,
      convertedType: document.converted_type ?? null,
      source: importRow ? "gmail" : "manual",
      importedAt: importRow?.created_at ?? document.created_at,
      classificationStatus,
      linkedCounterpartyName: linkedCounterparty?.name ?? null,
      extractionStatus: extraction?.extraction_status ?? null,
      observations,
      possibleDuplicate,
    });
  }

  return details.sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    return String(right.fiscalDate ?? "").localeCompare(String(left.fiscalDate ?? ""));
  });
}

export function getGmailXmlProviderSummary(
  documents: GmailXmlDocumentDiagnosticDetail[],
) {
  const providerMap = new Map<string, GmailXmlProviderSummary>();

  for (const document of documents) {
    const key = document.providerTaxId
      ? `tax:${normalizeTaxId(document.providerTaxId)}`
      : `name:${normalizeCounterpartyName(document.providerName) || "SIN PROVEEDOR"}`;
    const current = providerMap.get(key) ?? {
      providerName: document.providerName,
      providerTaxId: document.providerTaxId,
      documentsCount: 0,
      subtotal: 0,
      iva: 0,
      total: 0,
      averagePerDocument: 0,
      oldestDate: null,
      newestDate: null,
      lastImportAt: null,
      classificationStatus: document.classificationStatus,
      linkedCounterpartyName: document.linkedCounterpartyName,
    };

    current.documentsCount += 1;
    current.subtotal += document.subtotal;
    current.iva += document.iva;
    current.total += document.total;
    current.oldestDate = [current.oldestDate, document.fiscalDate]
      .filter(Boolean)
      .sort()[0] ?? null;
    current.newestDate = [current.newestDate, document.fiscalDate]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    current.lastImportAt = [current.lastImportAt, document.importedAt]
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    if (!current.linkedCounterpartyName && document.linkedCounterpartyName) {
      current.linkedCounterpartyName = document.linkedCounterpartyName;
      current.classificationStatus = "vinculado a contraparte";
    } else if (current.classificationStatus !== "vinculado a contraparte") {
      current.classificationStatus = document.classificationStatus;
    }

    providerMap.set(key, current);
  }

  return [...providerMap.values()]
    .map((provider) => ({
      ...provider,
      averagePerDocument:
        provider.documentsCount > 0 ? provider.total / provider.documentsCount : 0,
    }))
    .sort((left, right) => right.total - left.total);
}

export function getGmailXmlDocumentDetail(
  documents: GmailXmlDocumentDiagnosticDetail[],
) {
  return documents;
}

function buildIvaRateSummary({
  documents,
  extractionMap,
}: {
  documents: GmailXmlDocumentDiagnosticDetail[];
  extractionMap: Map<string, ExtractionRow>;
}) {
  const summaryMap = new Map<
    string,
    GmailXmlIvaRateSummary & { documentIds: Set<string> }
  >();

  for (const document of documents) {
    const extraction = extractionMap.get(document.documentId);
    const lineItems = getLineItems(extraction);
    const sourceLines =
      lineItems.length > 0
        ? lineItems
        : [
            {
              impuesto: document.iva,
              subtotal: document.subtotal,
              total_linea: document.total,
            },
          ];

    for (const line of sourceLines) {
      const taxableBase = getLineSubtotal(line);
      const iva = getLineTax(line);
      const rawTotal = getLineTotal(line);
      const totalPortion = rawTotal > 0 ? rawTotal : taxableBase + iva;
      const explicitRate = normalizeRatePercent(
        line.tarifa_iva ??
          line.tax_rate ??
          line.rate ??
          line.tarifa ??
          line.porcentaje_iva,
      );
      const ratePercent = explicitRate ?? inferRatePercent(iva, taxableBase);
      const rateKey = getIvaRateKey(ratePercent);
      const current = summaryMap.get(rateKey) ?? {
        documentIds: new Set<string>(),
        documentsCount: 0,
        iva: 0,
        linesCount: 0,
        rateKey,
        rateLabel: getIvaRateLabel(ratePercent),
        ratePercent,
        taxableBase: 0,
        totalPortion: 0,
        totalShare: 0,
      };

      current.documentIds.add(document.documentId);
      current.linesCount += 1;
      current.taxableBase += taxableBase;
      current.iva += iva;
      current.totalPortion += totalPortion;
      summaryMap.set(rateKey, current);
    }
  }

  const totalPortion = [...summaryMap.values()].reduce(
    (sum, item) => sum + item.totalPortion,
    0,
  );

  return [...summaryMap.values()]
    .map(({ documentIds, ...item }) => ({
      ...item,
      documentsCount: documentIds.size,
      iva: money(item.iva),
      taxableBase: money(item.taxableBase),
      totalPortion: money(item.totalPortion),
      totalShare:
        totalPortion > 0 ? Math.round((item.totalPortion / totalPortion) * 10000) / 100 : 0,
    }))
    .sort((left, right) => {
      if (left.ratePercent === null) return 1;
      if (right.ratePercent === null) return -1;
      return right.ratePercent - left.ratePercent;
    });
}

export async function getGmailXmlDiagnostics(filters: GmailXmlDiagnosticsFilters) {
  const activeContext = await getActiveContext();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Usuario no autenticado.");
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
      ivaRateSummary: [],
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
      ivaRateSummary: [],
      statusCounts: [],
      syncPeriods: [],
    };
  }

  const documentData = await fetchAllRows<DocumentRow>(() =>
    supabase
      .from("documents")
      .select("id, organization_id, company_id, original_filename, display_name, mime_type, document_type, processing_status, metadata, converted_at, converted_type, converted_record_id, created_at")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  );

  const importData = await fetchAllRows<GmailImportRow>(() => {
    let importsQuery = supabase
      .from("gmail_xml_imports")
      .select("id, gmail_message_id, gmail_attachment_id, subject, attachment_filename, imported_document_id, import_status, error_message, sync_mode, batch_period, created_at")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (normalizedFilters.status !== "all") {
      importsQuery = importsQuery.eq("import_status", normalizedFilters.status);
    }

    return importsQuery;
  });

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

  const documents = documentData.filter(isXmlDocument);
  const imports = importData;
  const importByDocumentId = new Map(
    imports
      .filter((item) => item.imported_document_id)
      .map((item) => [item.imported_document_id as string, item]),
  );
  const documentIds = documents.map((document) => document.id);
  const gmailDocumentIds = new Set(
    imports.map((item) => item.imported_document_id).filter(Boolean) as string[],
  );

  const extractionData = await fetchAllRowsByIds<ExtractionRow>(
    documentIds,
    (chunk) =>
      supabase
        .from("document_extractions")
        .select("document_id, extraction_status, extraction_provider, extracted_data, error_message, created_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .in("document_id", chunk)
        .order("created_at", { ascending: false }),
  );

  const extractionMap = new Map<string, ExtractionRow>();

  for (const extraction of extractionData) {
    if (!extractionMap.has(extraction.document_id)) {
      extractionMap.set(extraction.document_id, extraction);
    }
  }

  const filteredDocuments = documents.filter((document) => {
    const isGmailDocument = gmailDocumentIds.has(document.id);
    const importRow = importByDocumentId.get(document.id);

    if (normalizedFilters.source === "gmail" && !isGmailDocument) {
      return false;
    }

    if (normalizedFilters.source === "manual" && isGmailDocument) {
      return false;
    }

    if (
      normalizedFilters.status !== "all" &&
      importRow?.import_status !== normalizedFilters.status
    ) {
      return false;
    }

    return isWithinDateRange(
      getDocumentBusinessDate(document, extractionMap.get(document.id)),
      normalizedFilters,
    );
  });

  const [
    counterpartyData,
    matchData,
    purchaseData,
    invoiceData,
  ] = await Promise.all([
    fetchAllRows<CounterpartyRow>(() =>
      supabase
        .from("counterparties")
        .select("id, name, tax_id, normalized_tax_id, normalized_name")
        .eq("organization_id", organizationId)
        .or(`company_id.eq.${companyId},company_id.is.null`),
    ),
    fetchAllRowsByIds<CounterpartyMatchRow>(documentIds, (chunk) =>
      supabase
        .from("document_counterparty_matches")
        .select("document_id, counterparty_id, match_status, status, name, tax_id")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .in("document_id", chunk),
    ),
    fetchAllRowsByIds<ConvertedRecordRow>(documentIds, (chunk) =>
      supabase
        .from("purchases")
        .select("id, source_document_id, counterparty_id")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .in("source_document_id", chunk),
    ),
    fetchAllRowsByIds<ConvertedRecordRow>(documentIds, (chunk) =>
      supabase
        .from("invoices")
        .select("id, source_document_id, counterparty_id")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .in("source_document_id", chunk),
    ),
  ]);

  const counterparties = counterpartyData;
  const counterpartyById = new Map(counterparties.map((item) => [item.id, item]));
  const counterpartyByTaxId = new Map(
    counterparties
      .map((item) => [item.normalized_tax_id || normalizeTaxId(item.tax_id), item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const counterpartyByName = new Map(
    counterparties
      .map((item) => [item.normalized_name || normalizeCounterpartyName(item.name), item] as const)
      .filter(([key]) => Boolean(key)),
  );
  const matchByDocumentId = new Map<string, CounterpartyMatchRow>();

  for (const match of matchData) {
    const current = matchByDocumentId.get(match.document_id);
    if (!current || match.status === "accepted" || match.status === "created") {
      matchByDocumentId.set(match.document_id, match);
    }
  }

  const purchaseByDocumentId = new Map(
    purchaseData
      .filter((item) => item.source_document_id)
      .map((item) => [item.source_document_id as string, item]),
  );
  const invoiceByDocumentId = new Map(
    invoiceData
      .filter((item) => item.source_document_id)
      .map((item) => [item.source_document_id as string, item]),
  );

  const businessDates = filteredDocuments
    .map((document) => getDocumentBusinessDate(document, extractionMap.get(document.id)))
    .filter(Boolean)
    .sort() as string[];
  const snapshot = buildSnapshotMetrics(filteredDocuments, extractionMap);
  const documentDetails = buildDocumentDetails({
    counterpartyById,
    counterpartyByName,
    counterpartyByTaxId,
    documents: filteredDocuments,
    extractionMap,
    imports,
    invoiceByDocumentId,
    matchByDocumentId,
    purchaseByDocumentId,
  });
  const providerSummary = getGmailXmlProviderSummary(documentDetails);
  const ivaRateSummary = buildIvaRateSummary({
    documents: documentDetails,
    extractionMap,
  });
  const topProviderByTotal = [...providerSummary].sort((left, right) => right.total - left.total)[0] ?? null;
  const topProviderByIva = [...providerSummary].sort((left, right) => right.iva - left.iva)[0] ?? null;
  const topProviderByDocuments = [...providerSummary].sort(
    (left, right) => right.documentsCount - left.documentsCount,
  )[0] ?? null;
  const documentsWithoutProvider = documentDetails.filter(
    (document) => document.providerName === "Sin proveedor claro",
  ).length;
  const documentsWithoutIva = documentDetails.filter((document) => document.iva === 0).length;
  const documentsWithoutFiscalDate = documentDetails.filter((document) =>
    document.observations.includes("Sin fecha fiscal extraida"),
  ).length;
  const pendingConversion = documentDetails.filter((document) =>
    document.conversionStatus === "pendiente de convertir",
  ).length;
  const convertedDocuments = documentDetails.length - pendingConversion;
  const extractionErrors = documentDetails.filter((document) =>
    document.observations.includes("Error de extraccion"),
  ).length;
  const monthlyDocumentCounts = [...documentDetails.reduce((map, document) => {
    map.set(document.monthKey, (map.get(document.monthKey) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((left, right) => left.month.localeCompare(right.month));
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
      totalIva: snapshot.totalIva,
      fiscalDateMin: snapshot.fiscalDateMin,
      fiscalDateMax: snapshot.fiscalDateMax,
      fiscalDateFallbackCount: snapshot.fiscalDateFallbackCount,
      duplicatesCount: snapshot.duplicatesCount,
      uniqueFiscalDocuments: snapshot.uniqueFiscalDocuments,
      totalSubtotal: documentDetails.reduce((sum, document) => sum + document.subtotal, 0),
      totalGeneral: documentDetails.reduce((sum, document) => sum + document.total, 0),
      totalProviders: providerSummary.length,
      documentsWithoutProvider,
      documentsWithoutIva,
      documentsWithoutFiscalDate,
      pendingConversion,
      convertedDocuments,
      extractionErrors,
      lastSyncAt: connection?.last_sync_at ?? null,
    },
    monthlyCounts,
    monthlyDocumentCounts,
    sparseMonths: inferSparseMonths(monthlyCounts),
    providerSummary,
    providerHighlights: {
      topProviderByTotal,
      topProviderByIva,
      topProviderByDocuments,
    },
    documentDetails,
    latestDocuments,
    latestErrors,
    ivaRateSummary,
    statusCounts,
    syncPeriods: periodsError?.code === "42P01"
      ? []
      : ((periodData ?? []) as SyncPeriodRow[]),
  };
}

export const getGmailXmlDiagnosticSnapshot = getGmailXmlDiagnostics;
