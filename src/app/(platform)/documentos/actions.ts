"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createManualExtraction,
  getDefaultExtractedData,
  getDocumentExtractionById,
  processDocumentWithVision,
  updateDocumentExtractionData,
} from "@/lib/document-processing";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createInvoiceForActiveCompany } from "@/lib/invoices";
import { assertInternalUser } from "@/lib/permissions";
import { createPurchase } from "@/lib/purchases";
import { uploadDocument } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

function getFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo valido.");
  }

  return file;
}

function parseNumberValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLineItems(formData: FormData) {
  const lineItems = new Map<number, Record<string, unknown>>();
  const allowedKeys = new Set([
    "detalle",
    "cantidad",
    "unidad",
    "precio_unitario",
    "impuesto",
    "total_linea",
  ]);

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^lineItems\[(\d+)\]\[(.+)\]$/);

    if (!match || !allowedKeys.has(match[2])) {
      continue;
    }

    const index = Number(match[1]);
    const field = match[2];
    const current = lineItems.get(index) ?? {};

    current[field] = [
      "cantidad",
      "precio_unitario",
      "impuesto",
      "total_linea",
    ].includes(field)
      ? parseNumberValue(value)
      : String(value ?? "").trim();
    lineItems.set(index, current);
  }

  return [...lineItems.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, line]) => line)
    .filter((line) =>
      Object.values(line).some((value) => String(value ?? "").trim() !== ""),
    );
}

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function getManageableDocument(documentId: string) {
  const currentUser = await assertInternalUser();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  return { currentUser, document, supabase };
}

async function updateDocumentLifecycle(
  documentId: string,
  values: Record<string, unknown>,
) {
  const { currentUser, document, supabase } = await getManageableDocument(documentId);
  const { error } = await supabase
    .from("documents")
    .update({
      ...values,
      updated_by: currentUser.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadDocumentAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const relatedType = String(formData.get("relatedType") ?? "general");
  const relatedId = String(formData.get("relatedId") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "otro").trim();

  await uploadDocument({
    file: getFile(formData),
    relatedType:
      relatedType === "invoice" || relatedType === "purchase"
        ? relatedType
        : "general",
    relatedId: relatedId || undefined,
    documentType: documentType || "otro",
  });

  revalidatePath("/documentos");
  revalidatePath("/facturas");
  revalidatePath("/compras");
  redirect(redirectTo);
}

export async function processDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const rawText = String(formData.get("rawText") ?? "").trim();
  const extractedDataInput = String(formData.get("extractedData") ?? "").trim();

  if (!documentId) {
    throw new Error("Documento requerido.");
  }

  let extractedData = getDefaultExtractedData();

  if (extractedDataInput) {
    try {
      extractedData = {
        ...extractedData,
        ...JSON.parse(extractedDataInput),
      };
    } catch {
      throw new Error("El JSON extraido no es valido.");
    }
  }

  await createManualExtraction(
    documentId,
    rawText || "Extraccion manual simulada pendiente de OCR real.",
    extractedData,
  );

  revalidatePath("/documentos");
  redirect(redirectTo);
}

export async function processDocumentWithVisionAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!documentId) {
    throw new Error("Documento requerido.");
  }

  await processDocumentWithVision(documentId);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(redirectTo);
}

export async function updateDocumentMetadataAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "otro").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const tags = parseTags(formData.get("tags"));

  if (!documentId) {
    throw new Error("Documento requerido.");
  }

  const { currentUser, document, supabase } = await getManageableDocument(documentId);
  const metadata =
    document.metadata && typeof document.metadata === "object"
      ? (document.metadata as Record<string, unknown>)
      : {};
  const { error } = await supabase
    .from("documents")
    .update({
      display_name: displayName || null,
      document_type: documentType || "otro",
      notes: notes || null,
      metadata: {
        ...metadata,
        tags,
      },
      updated_by: currentUser.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/documentos");
  revalidatePath(`/documentos/${documentId}`);
  redirect(redirectTo);
}

export async function archiveDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  await updateDocumentLifecycle(documentId, {
    archived_at: new Date().toISOString(),
    inactive_at: null,
    deleted_at: null,
  });
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${documentId}`);
  redirect(redirectTo);
}

export async function inactivateDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  await updateDocumentLifecycle(documentId, {
    inactive_at: new Date().toISOString(),
    deleted_at: null,
  });
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${documentId}`);
  redirect(redirectTo);
}

export async function restoreDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  await updateDocumentLifecycle(documentId, {
    archived_at: null,
    inactive_at: null,
    deleted_at: null,
  });
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${documentId}`);
  redirect(redirectTo);
}

export async function softDeleteDocumentAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const confirmation = String(formData.get("confirmDelete") ?? "");

  if (confirmation !== "confirmado") {
    throw new Error("Confirma la eliminacion logica del documento.");
  }

  await updateDocumentLifecycle(documentId, {
    deleted_at: new Date().toISOString(),
  });
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${documentId}`);
  redirect(redirectTo);
}

export async function updateExtractionDataAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const documentKind = String(formData.get("documentKind") ?? "").trim();
  const clave = String(formData.get("clave") ?? "").trim();
  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const supplierTaxId = String(formData.get("supplierTaxId") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerTaxId = String(formData.get("customerTaxId") ?? "").trim();
  const documentNumber = String(formData.get("documentNumber") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const currency = normalizeCurrencyCode(formData.get("currency"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  await updateDocumentExtractionData(extractionId, {
    supplier_name: supplierName,
    emisor_nombre: supplierName,
    supplier_tax_id: supplierTaxId,
    emisor_cedula: supplierTaxId,
    customer_name: customerName,
    receptor_nombre: customerName,
    customer_tax_id: customerTaxId,
    receptor_cedula: customerTaxId,
    document_kind: documentKind,
    clave,
    document_number: documentNumber,
    numero_consecutivo: documentNumber,
    date,
    fecha_emision: date,
    currency,
    moneda: currency,
    subtotal: parseNumberValue(formData.get("subtotal")),
    tax: parseNumberValue(formData.get("tax")),
    impuesto: parseNumberValue(formData.get("tax")),
    total: parseNumberValue(formData.get("total")),
    notes,
    line_items: parseLineItems(formData),
  });

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#extraccion-${extractionId}`);
}

export async function createPurchaseFromXmlAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  const extraction = await getDocumentExtractionById(extractionId);
  const data = extraction.extracted_data ?? {};
  const clave = data.clave ?? "";
  const sourceLabel =
    extraction.extraction_provider === "xml-parser-cr" ? "XML" : "documento";

  await createPurchase({
    supplierName: data.emisor_nombre || data.supplier_name || "",
    documentNumber: data.numero_consecutivo || data.document_number || "",
    purchaseDate: data.fecha_emision || data.date || "",
    category:
      extraction.extraction_provider === "xml-parser-cr"
        ? "XML Costa Rica"
        : "Documento procesado",
    description: `Creado desde ${sourceLabel}: ${clave}`,
    currency: normalizeCurrencyCode(data.moneda || data.currency),
    subtotal: Number(data.subtotal ?? 0),
    tax: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: data.medio_pago || "",
    status: "registrada",
    notes: data.notes || `Creado desde ${sourceLabel}: ${clave}`,
  });

  revalidatePath("/compras");
  revalidatePath("/documentos");
  redirect("/compras");
}

export async function createInvoiceFromXmlAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  const extraction = await getDocumentExtractionById(extractionId);
  const data = extraction.extracted_data ?? {};
  const clave = data.clave ?? "";
  const sourceLabel =
    extraction.extraction_provider === "xml-parser-cr" ? "XML" : "documento";

  await createInvoiceForActiveCompany({
    tipoDocumento: data.document_kind || "factura",
    proveedor: data.receptor_nombre || data.emisor_nombre || data.supplier_name || "",
    numeroDocumento: data.numero_consecutivo || data.document_number || "",
    fecha: data.fecha_emision || data.date || "",
    moneda: normalizeCurrencyCode(data.moneda || data.currency),
    subtotal: Number(data.subtotal ?? 0),
    impuesto: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    estado: "registrada",
    notas: data.notes || `Creado desde ${sourceLabel}: ${clave}`,
  });

  revalidatePath("/facturas");
  revalidatePath("/documentos");
  redirect("/facturas");
}
