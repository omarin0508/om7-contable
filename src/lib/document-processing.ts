import { getActiveContext } from "@/lib/active-context";
import { createClient } from "@/lib/supabase/server";

export type ExtractedDocumentData = {
  supplier_name?: string;
  document_number?: string;
  date?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  document_kind?: string;
  clave?: string;
  numero_consecutivo?: string;
  fecha_emision?: string;
  emisor_nombre?: string;
  emisor_cedula?: string;
  receptor_nombre?: string;
  receptor_cedula?: string;
  moneda?: string;
  impuesto?: number;
  condicion_venta?: string;
  medio_pago?: string;
  line_items?: Array<Record<string, unknown>>;
};

export type DocumentExtraction = {
  id: string;
  organization_id: string;
  company_id: string;
  document_id: string;
  user_id: string;
  extraction_provider: string;
  extraction_status: string;
  raw_text: string | null;
  extracted_data: ExtractedDocumentData | null;
  confidence: number | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function defaultExtractedData(): ExtractedDocumentData {
  return {
    supplier_name: "",
    document_number: "",
    date: "",
    currency: "",
    subtotal: 0,
    tax: 0,
    total: 0,
    line_items: [],
  };
}

async function getDocumentInActiveContext(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de procesar documentos.");
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("id, organization_id, company_id")
    .eq("id", documentId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return document;
}

async function getAccessibleDocument(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, organization_id, company_id")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return document;
}

export async function getDocumentExtraction(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();

  await getDocumentInActiveContext(documentId);

  const { data, error } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as DocumentExtraction | null;
}

export async function getDocumentExtractionById(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa.");
  }

  const { data, error } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("id", extractionId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Extraccion no encontrada.");
  }

  return data as DocumentExtraction;
}

export async function createManualExtraction(
  documentId: string,
  rawText: string,
  extractedData: ExtractedDocumentData = defaultExtractedData(),
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const document = await getDocumentInActiveContext(documentId);

  const { data, error } = await supabase
    .from("document_extractions")
    .insert({
      organization_id: document.organization_id,
      company_id: document.company_id,
      document_id: document.id,
      user_id: user.id,
      extraction_provider: "manual",
      extraction_status: "processed",
      raw_text: rawText,
      extracted_data: extractedData,
      confidence: 100,
      processed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la extraccion.");
  }

  const { error: documentError } = await supabase
    .from("documents")
    .update({ processing_status: "processed" })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  return data as DocumentExtraction;
}

export async function createDocumentExtraction(
  documentId: string,
  options: {
    provider: string;
    status: string;
    rawText: string;
    extractedData?: ExtractedDocumentData;
    confidence?: number;
    errorMessage?: string;
  },
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const document = await getAccessibleDocument(documentId);
  const processedAt =
    options.status === "processed" || options.status === "error"
      ? new Date().toISOString()
      : null;

  const { data, error } = await supabase
    .from("document_extractions")
    .insert({
      organization_id: document.organization_id,
      company_id: document.company_id,
      document_id: document.id,
      user_id: user.id,
      extraction_provider: options.provider,
      extraction_status: options.status,
      raw_text: options.rawText,
      extracted_data: options.extractedData ?? defaultExtractedData(),
      confidence: options.confidence ?? null,
      error_message: options.errorMessage ?? null,
      processed_at: processedAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la extraccion.");
  }

  const { error: documentError } = await supabase
    .from("documents")
    .update({ processing_status: options.status })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  return data as DocumentExtraction;
}

export async function updateExtractionStatus(documentId: string, status: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const document = await getDocumentInActiveContext(documentId);

  const { error: documentError } = await supabase
    .from("documents")
    .update({ processing_status: status })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (documentError) {
    throw new Error(documentError.message);
  }

  const { error } = await supabase
    .from("document_extractions")
    .update({ extraction_status: status })
    .eq("document_id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function listPendingDocumentsForProcessing() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return [];
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .in("processing_status", ["pending", "uploaded", "processing"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listDocumentExtractionsByCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return [] as DocumentExtraction[];
  }

  const { data, error } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DocumentExtraction[];
}

export function getDefaultExtractedData() {
  return defaultExtractedData();
}
