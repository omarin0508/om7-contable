import { getActiveContext } from "@/lib/active-context";
import {
  listDocumentExtractionsByCompany,
  selectBestDocumentExtraction,
} from "@/lib/document-processing";
import { createClient } from "@/lib/supabase/server";
import type { DocumentRecord } from "@/lib/storage";

export type ReviewFilters = {
  documentType?: string;
  processingStatus?: string;
  date?: string;
};

export type ReviewDocument = DocumentRecord & {
  signedUrl: string | null;
  extraction: Awaited<ReturnType<typeof listDocumentExtractionsByCompany>>[number] | null;
  extractionHistory: Awaited<ReturnType<typeof listDocumentExtractionsByCompany>>;
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

  const documents = await Promise.all(
    (data ?? []).map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from("om7-documents")
        .createSignedUrl(document.storage_path, 60 * 10);

      return {
        ...(document as DocumentRecord),
        signedUrl: signedError ? null : signed?.signedUrl ?? null,
        extraction:
          selectBestDocumentExtraction(
            extractionsByDocumentId.get(document.id) ?? [],
          ) ?? null,
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
