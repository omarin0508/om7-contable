import { getActiveContext } from "@/lib/active-context";
import {
  listDocumentExtractionsByCompany,
  selectBestDocumentExtraction,
  type DocumentExtraction,
} from "@/lib/document-processing";
import type { DocumentClassificationRecord } from "@/lib/document-classification";
import type { DocumentCounterpartyMatchRecord } from "@/lib/counterparties";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/lib/storage";

export type ReviewFilters = {
  documentType?: string;
  processingStatus?: string;
  date?: string;
};

export type ReviewDocument = DocumentRecord & {
  signedUrl: string | null;
  classification: DocumentClassificationRecord | null;
  convertedRecord: {
    id: string;
    review_notes: string | null;
    review_status: string | null;
    reviewed_at: string | null;
    type: "invoice" | "purchase";
  } | null;
  counterpartyMatch: DocumentCounterpartyMatchRecord | null;
  extraction: DocumentExtraction | null;
  extractionHistory: DocumentExtraction[];
};

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuario no autenticado.");
  }

  return { supabase, user };
}

export async function listClientUploadReviewDocuments(filters: ReviewFilters = {}) {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      documents: [] as ReviewDocument[],
    };
  }

  let query = supabase
    .from("documents")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .eq("related_type", "client_upload")
    .order("created_at", { ascending: false });

  if (filters.documentType && filters.documentType !== "all") {
    query = query.eq("document_type", filters.documentType);
  }

  if (filters.processingStatus && filters.processingStatus !== "all") {
    query = query.eq("processing_status", filters.processingStatus);
  }

  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(`${filters.date}T23:59:59.999Z`);
    query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const extractions = await listDocumentExtractionsByCompany();
  const extractionsByDocumentId = new Map<
    string,
    Awaited<ReturnType<typeof listDocumentExtractionsByCompany>>
  >();

  for (const extraction of extractions) {
    const current = extractionsByDocumentId.get(extraction.document_id) ?? [];
    current.push(extraction);
    extractionsByDocumentId.set(extraction.document_id, current);
  }

  const primaryExtractions = (data ?? [])
    .map((document) =>
      selectBestDocumentExtraction(extractionsByDocumentId.get(document.id) ?? []),
    )
    .filter(Boolean) as DocumentExtraction[];
  const extractionIds = primaryExtractions.map((extraction) => extraction.id);
  let classificationsByExtractionId = new Map<
    string,
    DocumentClassificationRecord
  >();
  let matchesByExtractionId = new Map<string, DocumentCounterpartyMatchRecord>();
  const purchaseRecordIds = (data ?? [])
    .filter((document) => document.converted_type === "purchase")
    .map((document) => document.converted_record_id)
    .filter(Boolean) as string[];
  const invoiceRecordIds = (data ?? [])
    .filter((document) => document.converted_type === "invoice")
    .map((document) => document.converted_record_id)
    .filter(Boolean) as string[];
  let convertedRecordsById = new Map<
    string,
    ReviewDocument["convertedRecord"]
  >();

  if (extractionIds.length > 0) {
    const [
      { data: classifications, error: classificationsError },
      { data: counterpartyMatches, error: matchesError },
    ] = await Promise.all([
      supabase
        .from("document_classifications")
        .select("*")
        .in("extraction_id", extractionIds),
      supabase
        .from("document_counterparty_matches")
        .select("*")
        .in("extraction_id", extractionIds),
    ]);

    if (classificationsError) {
      throw new Error(classificationsError.message);
    }

    if (matchesError) {
      throw new Error(matchesError.message);
    }

    classificationsByExtractionId = new Map(
      ((classifications ?? []) as DocumentClassificationRecord[]).map(
        (classification) => [classification.extraction_id, classification],
      ),
    );
    matchesByExtractionId = new Map(
      ((counterpartyMatches ?? []) as DocumentCounterpartyMatchRecord[]).map(
        (match) => [match.extraction_id, match],
      ),
    );
  }

  const [{ data: convertedPurchases }, { data: convertedInvoices }] =
    await Promise.all([
      purchaseRecordIds.length > 0
        ? supabase
            .from("purchases")
            .select("id, review_status, reviewed_at, review_notes")
            .in("id", purchaseRecordIds)
        : Promise.resolve({ data: [] }),
      invoiceRecordIds.length > 0
        ? supabase
            .from("invoices")
            .select("id, review_status, reviewed_at, review_notes")
            .in("id", invoiceRecordIds)
        : Promise.resolve({ data: [] }),
    ]);

  const convertedRecordEntries: Array<
    [string, NonNullable<ReviewDocument["convertedRecord"]>]
  > = [
    ...((convertedPurchases ?? []) as Array<{
      id: string;
      review_notes: string | null;
      review_status: string | null;
      reviewed_at: string | null;
    }>).map((purchase) => [
      purchase.id,
      {
        ...purchase,
        type: "purchase" as const,
      },
    ] as [string, NonNullable<ReviewDocument["convertedRecord"]>]),
    ...((convertedInvoices ?? []) as Array<{
      id: string;
      review_notes: string | null;
      review_status: string | null;
      reviewed_at: string | null;
    }>).map((invoice) => [
      invoice.id,
      {
        ...invoice,
        type: "invoice" as const,
      },
    ] as [string, NonNullable<ReviewDocument["convertedRecord"]>]),
  ];

  convertedRecordsById = new Map(convertedRecordEntries);

  const documents = await Promise.all(
    (data ?? []).map(async (document) => {
      const extraction =
        selectBestDocumentExtraction(
          extractionsByDocumentId.get(document.id) ?? [],
        ) ?? null;
      const { data: signed, error: signedError } = await supabase.storage
        .from("om7-documents")
        .createSignedUrl(document.storage_path, 60 * 10);

      return {
        ...(document as DocumentRecord),
        classification: extraction
          ? classificationsByExtractionId.get(extraction.id) ?? null
          : null,
        convertedRecord: document.converted_record_id
          ? convertedRecordsById.get(document.converted_record_id) ?? null
          : null,
        counterpartyMatch: extraction
          ? matchesByExtractionId.get(extraction.id) ?? null
          : null,
        extraction,
        signedUrl: signedError ? null : signed?.signedUrl ?? null,
        extractionHistory: extractionsByDocumentId.get(document.id) ?? [],
      };
    }),
  );

  return {
    activeContext,
    documents,
  };
}

export async function updateDocumentReviewStatus(
  documentId: string,
  status: "reviewed" | "rejected",
  notes?: string,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa.");
  }

  const { error } = await supabase
    .from("documents")
    .update({
      review_status: status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      review_notes: notes || null,
    })
    .eq("id", documentId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .eq("related_type", "client_upload");

  if (error) {
    throw new Error(error.message);
  }
}
