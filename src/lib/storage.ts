import { getActiveContext } from "@/lib/active-context";
import { parseCostaRicaInvoiceXml } from "@/lib/costa-rica-invoice-xml";
import { createDocumentExtraction } from "@/lib/document-processing";
import { assertClientAccessToCompany, getCurrentUserRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const DOCUMENTS_BUCKET = "om7-documents";
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/xml",
  "text/xml",
]);

export type DocumentRecord = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  related_type: string;
  related_id: string | null;
  original_filename: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: string;
  processing_status: string;
  review_status: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type UploadDocumentInput = {
  file: File;
  relatedType?: "invoice" | "purchase" | "general" | "client_upload";
  relatedId?: string;
  companyId?: string;
  documentType?: string;
  metadata?: Record<string, unknown>;
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

function sanitizeFilename(filename: string) {
  const cleanName = filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return cleanName || "documento";
}

function isXmlFile(file: File) {
  return (
    file.name.toLowerCase().endsWith(".xml") ||
    file.type === "application/xml" ||
    file.type === "text/xml"
  );
}

function isAllowedFile(file: File) {
  return ALLOWED_MIME_TYPES.has(file.type) || isXmlFile(file);
}

async function validateRelatedRecord(
  relatedType: string,
  relatedId: string | undefined,
  organizationId: string,
  companyId: string,
) {
  if (!relatedId || relatedType === "general" || relatedType === "client_upload") {
    return;
  }

  const { supabase } = await getAuthenticatedSupabase();
  const table = relatedType === "invoice" ? "invoices" : "purchases";
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", relatedId)
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("El documento relacionado no pertenece a la empresa activa.");
  }
}

async function getUploadContext(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();

  if (companyId) {
    await assertClientAccessToCompany(companyId);

    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      throw new Error(error?.message ?? "Empresa no encontrada.");
    }

    return {
      organization: {
        id: company.organization_id,
        base_currency: company.base_currency,
      },
      activeCompany: company,
    };
  }

  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de subir documentos.");
  }

  return {
    organization: activeContext.organization,
    activeCompany: activeContext.activeCompany,
  };
}

export async function uploadDocument(input: UploadDocumentInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { organization, activeCompany } = await getUploadContext(input.companyId);

  if (!input.file || input.file.size === 0) {
    throw new Error("Selecciona un archivo valido.");
  }

  if (!isAllowedFile(input.file)) {
    throw new Error("Solo se permiten archivos PDF, XML o imagenes.");
  }

  const relatedType = input.relatedType ?? "general";
  const relatedId = input.relatedId || undefined;

  await validateRelatedRecord(
    relatedType,
    relatedId,
    organization.id,
    activeCompany.id,
  );

  const filename = sanitizeFilename(input.file.name);
  const storagePath = [
    "organizations",
    organization.id,
    "companies",
    activeCompany.id,
    "documents",
    `${crypto.randomUUID()}-${filename}`,
  ].join("/");

  const arrayBuffer = await input.file.arrayBuffer();
  const fileBuffer = new Uint8Array(arrayBuffer);
  const xmlFile = isXmlFile(input.file);
  const contentType = input.file.type || (xmlFile ? "application/xml" : undefined);
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: organization.id,
      company_id: activeCompany.id,
      user_id: user.id,
      related_type: relatedType,
      related_id: relatedId ?? null,
      original_filename: input.file.name,
      storage_path: storagePath,
      mime_type: contentType,
      size_bytes: input.file.size,
      document_type: input.documentType || (xmlFile ? "factura" : "otro"),
      processing_status: "uploaded",
      metadata: {
        ...(input.metadata ?? {}),
        source_format: xmlFile ? "xml-cr" : "file",
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(error?.message ?? "No se pudo registrar el documento.");
  }

  const document = data as DocumentRecord;

  if (xmlFile) {
    const xmlText = new TextDecoder("utf-8").decode(arrayBuffer);

    try {
      const extractedData = parseCostaRicaInvoiceXml(xmlText);

      await createDocumentExtraction(document.id, {
        provider: "xml-parser-cr",
        status: "processed",
        rawText: xmlText,
        extractedData,
        confidence: 1,
      });
    } catch (error) {
      await createDocumentExtraction(document.id, {
        provider: "xml-parser-cr",
        status: "error",
        rawText: xmlText,
        extractedData: {},
        confidence: 0,
        errorMessage:
          error instanceof Error ? error.message : "No se pudo procesar el XML.",
      });
    }
  }

  return document;
}

export async function getSignedDocumentUrl(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data: document, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, 60 * 10);

  if (signedUrlError || !data?.signedUrl) {
    throw new Error(signedUrlError?.message ?? "No se pudo generar el enlace.");
  }

  return data.signedUrl;
}

export async function deleteDocument(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data: document, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([document.storage_path]);

  if (storageError) {
    throw new Error(storageError.message);
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function listDocumentsByCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      documents: [] as Array<DocumentRecord & { signedUrl: string | null }>,
    };
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const documents = await Promise.all(
    (data ?? []).map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(document.storage_path, 60 * 10);

      return {
        ...(document as DocumentRecord),
        signedUrl: signedError ? null : signed?.signedUrl ?? null,
      };
    }),
  );

  return {
    activeContext,
    documents,
  };
}

export async function listClientUploadDocumentsForCurrentUser(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const currentUser = await getCurrentUserRole();
  if (currentUser.role === "internal") {
    const { activeContext, documents } = await listDocumentsByCompany();

    return {
      companies: activeContext.companies,
      activeCompany: activeContext.activeCompany,
      documents: documents.filter(
        (document) => document.related_type === "client_upload",
      ),
    };
  }

  let targetCompany = currentUser.clientCompanies[0] ?? null;

  if (companyId) {
    await assertClientAccessToCompany(companyId);
    targetCompany =
      currentUser.clientCompanies.find((company) => company.id === companyId) ??
      targetCompany;
  }

  if (!targetCompany) {
    return {
      companies: currentUser.clientCompanies,
      activeCompany: null,
      documents: [] as Array<DocumentRecord & { signedUrl: string | null }>,
    };
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", targetCompany.id)
    .eq("related_type", "client_upload")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const documents = await Promise.all(
    (data ?? []).map(async (document) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(document.storage_path, 60 * 10);

      return {
        ...(document as DocumentRecord),
        signedUrl: signedError ? null : signed?.signedUrl ?? null,
      };
    }),
  );

  return {
    companies: currentUser.clientCompanies,
    activeCompany: targetCompany,
    documents,
  };
}
