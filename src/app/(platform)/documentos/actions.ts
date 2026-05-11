"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  acceptCounterpartyMatch,
  createCounterpartyFromMatch,
  detectAndStoreCounterpartyMatch,
  editCounterpartyMatch,
  getAcceptedCounterpartyMatch,
  type CounterpartyType,
} from "@/lib/counterparties";
import {
  createManualExtraction,
  getDefaultExtractedData,
  getDocumentExtractionById,
  processDocumentWithVision,
  updateDocumentExtractionData,
} from "@/lib/document-processing";
import { normalizeCurrencyCode } from "@/lib/currency";
import {
  classifyAndStoreDocumentExtraction,
  createCounterpartyRuleFromClassification,
  editDocumentClassification,
  getPreferredDocumentClassification,
  updateDocumentClassificationStatus,
  type DocumentClassificationFlow,
} from "@/lib/document-classification";
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

function parseConfidence(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

function parseFlowType(value: FormDataEntryValue | null): DocumentClassificationFlow {
  const parsed = String(value ?? "unknown");

  if (
    parsed === "purchase" ||
    parsed === "sale" ||
    parsed === "expense" ||
    parsed === "income" ||
    parsed === "unknown"
  ) {
    return parsed;
  }

  return "unknown";
}

function parseCounterpartyType(value: FormDataEntryValue | null): CounterpartyType {
  const parsed = String(value ?? "supplier");

  if (parsed === "supplier" || parsed === "customer" || parsed === "both") {
    return parsed;
  }

  return "supplier";
}

function assertReviewedExtractionStatus(status: string) {
  if (status !== "reviewed") {
    throw new Error("Revisa y aprueba los datos antes de crear una compra o factura.");
  }
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

async function getConvertibleDocument(documentId: string) {
  const currentUser = await assertInternalUser();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const { data: document, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, company_id, converted_at, converted_type, converted_record_id",
    )
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Documento no encontrado.");
  }

  if (document.converted_at || document.converted_type || document.converted_record_id) {
    const convertedLabel =
      document.converted_type === "invoice" ? "factura" : "compra";
    throw new Error(
      `Este documento ya fue convertido en una ${convertedLabel}.`,
    );
  }

  return { currentUser, document, supabase };
}

async function markDocumentAsConverted({
  convertedBy,
  conversionNotes,
  convertedRecordId,
  convertedType,
  documentId,
  extractionId,
}: {
  convertedBy: string;
  conversionNotes: string;
  convertedRecordId: string;
  convertedType: "purchase" | "invoice";
  documentId: string;
  extractionId: string;
}) {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const convertedAt = new Date().toISOString();
  const { data: updatedDocument, error: documentError } = await supabase
    .from("documents")
    .update({
      converted_at: convertedAt,
      converted_type: convertedType,
      converted_record_id: convertedRecordId,
      converted_by: convertedBy,
      conversion_notes: conversionNotes,
      updated_by: convertedBy,
      updated_at: convertedAt,
    })
    .eq("id", documentId)
    .is("converted_at", null)
    .select("id")
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!updatedDocument) {
    throw new Error(
      "Este documento ya fue convertido en una compra/factura.",
    );
  }

  const extraction = await getDocumentExtractionById(extractionId);
  const { error: extractionError } = await supabase
    .from("document_extractions")
    .update({
      extracted_data: {
        ...(extraction.extracted_data ?? {}),
        conversion: {
          converted_at: convertedAt,
          converted_by: convertedBy,
          converted_record_id: convertedRecordId,
          converted_type: convertedType,
          notes: conversionNotes,
        },
      },
      updated_at: convertedAt,
    })
    .eq("id", extractionId);

  if (extractionError) {
    throw new Error(extractionError.message);
  }
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

  const updatedExtraction = await updateDocumentExtractionData(extractionId, {
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

  await classifyAndStoreDocumentExtraction(updatedExtraction.id);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#extraccion-${extractionId}`);
}

export async function classifyDocumentExtractionAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  await assertInternalUser();
  await classifyAndStoreDocumentExtraction(extractionId);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#clasificacion`);
}

export async function acceptDocumentClassificationAction(formData: FormData) {
  const classificationId = String(formData.get("classificationId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!classificationId) {
    throw new Error("Clasificacion requerida.");
  }

  await assertInternalUser();
  await updateDocumentClassificationStatus(classificationId, "accepted");

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#clasificacion`);
}

export async function rejectDocumentClassificationAction(formData: FormData) {
  const classificationId = String(formData.get("classificationId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!classificationId) {
    throw new Error("Clasificacion requerida.");
  }

  await assertInternalUser();
  await updateDocumentClassificationStatus(classificationId, "rejected");

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#clasificacion`);
}

export async function editDocumentClassificationAction(formData: FormData) {
  const classificationId = String(formData.get("classificationId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!classificationId) {
    throw new Error("Clasificacion requerida.");
  }

  await assertInternalUser();
  await editDocumentClassification(classificationId, {
    flow_type: parseFlowType(formData.get("flowType")),
    suggested_account: String(formData.get("suggestedAccount") ?? "").trim() || null,
    suggested_category:
      String(formData.get("suggestedCategory") ?? "").trim() || null,
    suggested_cost_center_id:
      String(formData.get("suggestedCostCenterId") ?? "").trim() || null,
    confidence_score: parseConfidence(formData.get("confidenceScore")),
    rule_applied: String(formData.get("ruleApplied") ?? "manual_edit").trim(),
    explanation: String(formData.get("explanation") ?? "").trim(),
    needs_review: false,
  });

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#clasificacion`);
}

export async function createCounterpartyRuleFromClassificationAction(
  formData: FormData,
) {
  const classificationId = String(formData.get("classificationId") ?? "").trim();
  const matchId = String(formData.get("matchId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!classificationId || !matchId) {
    throw new Error("Clasificacion y contraparte requeridas.");
  }

  await assertInternalUser();
  await createCounterpartyRuleFromClassification(classificationId, matchId, {
    ruleName: String(formData.get("ruleName") ?? "").trim(),
    suggestedAccount: String(formData.get("suggestedAccount") ?? "").trim(),
    suggestedCategory: String(formData.get("suggestedCategory") ?? "").trim(),
    suggestedCostCenterId: String(
      formData.get("suggestedCostCenterId") ?? "",
    ).trim(),
  });

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#clasificacion`);
}

export async function detectDocumentCounterpartyAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  await assertInternalUser();
  const classification = await getPreferredDocumentClassification(extractionId);
  await detectAndStoreCounterpartyMatch(extractionId, classification);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#contraparte`);
}

export async function acceptCounterpartyMatchAction(formData: FormData) {
  const matchId = String(formData.get("matchId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!matchId) {
    throw new Error("Contraparte requerida.");
  }

  await assertInternalUser();
  await acceptCounterpartyMatch(matchId);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#contraparte`);
}

export async function createCounterpartyFromMatchAction(formData: FormData) {
  const matchId = String(formData.get("matchId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");

  if (!matchId) {
    throw new Error("Contraparte requerida.");
  }

  await assertInternalUser();
  await createCounterpartyFromMatch(matchId);

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#contraparte`);
}

export async function editCounterpartyMatchAction(formData: FormData) {
  const matchId = String(formData.get("matchId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/documentos");
  const name = String(formData.get("name") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").trim();

  if (!matchId || !name) {
    throw new Error("Nombre de contraparte requerido.");
  }

  await assertInternalUser();
  await editCounterpartyMatch(matchId, {
    counterpartyType: parseCounterpartyType(formData.get("counterpartyType")),
    name,
    taxId,
  });

  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  redirect(`${redirectTo}#contraparte`);
}

export async function createPurchaseFromXmlAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  const extraction = await getDocumentExtractionById(extractionId);
  assertReviewedExtractionStatus(extraction.extraction_status);
  const { currentUser } = await getConvertibleDocument(extraction.document_id);
  const data = extraction.extracted_data ?? {};
  const classification = await getPreferredDocumentClassification(extraction.id);
  const counterparty = await getAcceptedCounterpartyMatch(extraction.id);
  const clave = data.clave ?? "";
  const sourceLabel =
    extraction.extraction_provider === "xml-parser-cr" ? "XML" : "documento";
  const classificationNote = classification
    ? ` Clasificacion OM7: ${classification.suggested_category ?? "Sin categoria"} / ${classification.suggested_account ?? "Sin cuenta"}.`
    : "";

  const purchase = await createPurchase({
    supplierName: data.emisor_nombre || data.supplier_name || "",
    documentNumber: data.numero_consecutivo || data.document_number || "",
    purchaseDate: data.fecha_emision || data.date || "",
    category:
      classification?.suggested_category ||
      (extraction.extraction_provider === "xml-parser-cr"
        ? "XML Costa Rica"
        : "Documento procesado"),
    description: `Creado desde ${sourceLabel}: ${clave}`,
    currency: normalizeCurrencyCode(data.moneda || data.currency),
    subtotal: Number(data.subtotal ?? 0),
    tax: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: data.medio_pago || "",
    status: "registrada",
    notes: data.notes || `Creado desde ${sourceLabel}: ${clave}.${classificationNote}`,
    classificationId: classification?.id,
    classificationRuleApplied: classification?.rule_applied,
    classificationConfidence: classification?.confidence_score,
    suggestedAccount: classification?.suggested_account ?? undefined,
    suggestedCostCenterId:
      classification?.suggested_cost_center_id ?? undefined,
    counterpartyId: counterparty?.counterparty_id ?? undefined,
    sourceDocumentId: extraction.document_id,
    sourceExtractionId: extraction.id,
  });

  await markDocumentAsConverted({
    convertedBy: currentUser.userId,
    conversionNotes: `Compra creada desde extraccion ${extraction.id}.`,
    convertedRecordId: purchase.id,
    convertedType: "purchase",
    documentId: extraction.document_id,
    extractionId: extraction.id,
  });

  revalidatePath("/compras");
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${extraction.document_id}`);
  revalidatePath("/bandeja");
  redirect("/compras");
}

export async function createInvoiceFromXmlAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  const extraction = await getDocumentExtractionById(extractionId);
  assertReviewedExtractionStatus(extraction.extraction_status);
  const { currentUser } = await getConvertibleDocument(extraction.document_id);
  const data = extraction.extracted_data ?? {};
  const classification = await getPreferredDocumentClassification(extraction.id);
  const counterparty = await getAcceptedCounterpartyMatch(extraction.id);
  const clave = data.clave ?? "";
  const sourceLabel =
    extraction.extraction_provider === "xml-parser-cr" ? "XML" : "documento";
  const classificationNote = classification
    ? ` Clasificacion OM7: ${classification.suggested_category ?? "Sin categoria"} / ${classification.suggested_account ?? "Sin cuenta"}.`
    : "";

  const invoice = await createInvoiceForActiveCompany({
    tipoDocumento: data.document_kind || "factura",
    proveedor: data.receptor_nombre || data.emisor_nombre || data.supplier_name || "",
    numeroDocumento: data.numero_consecutivo || data.document_number || "",
    fecha: data.fecha_emision || data.date || "",
    moneda: normalizeCurrencyCode(data.moneda || data.currency),
    subtotal: Number(data.subtotal ?? 0),
    impuesto: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    estado: "registrada",
    notas: data.notes || `Creado desde ${sourceLabel}: ${clave}.${classificationNote}`,
    classificationId: classification?.id,
    classificationRuleApplied: classification?.rule_applied,
    classificationConfidence: classification?.confidence_score,
    suggestedAccount: classification?.suggested_account ?? undefined,
    suggestedCostCenterId:
      classification?.suggested_cost_center_id ?? undefined,
    counterpartyId: counterparty?.counterparty_id ?? undefined,
    sourceDocumentId: extraction.document_id,
    sourceExtractionId: extraction.id,
  });

  await markDocumentAsConverted({
    convertedBy: currentUser.userId,
    conversionNotes: `Factura creada desde extraccion ${extraction.id}.`,
    convertedRecordId: invoice.id,
    convertedType: "invoice",
    documentId: extraction.document_id,
    extractionId: extraction.id,
  });

  revalidatePath("/facturas");
  revalidatePath("/documentos");
  revalidatePath(`/documentos/${extraction.document_id}`);
  revalidatePath("/bandeja");
  redirect("/facturas");
}
