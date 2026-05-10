"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createManualExtraction,
  getDefaultExtractedData,
  getDocumentExtractionById,
  processDocumentWithVision,
} from "@/lib/document-processing";
import { createInvoiceForActiveCompany } from "@/lib/invoices";
import { createPurchase } from "@/lib/purchases";
import { uploadDocument } from "@/lib/storage";

function getFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo valido.");
  }

  return file;
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

export async function createPurchaseFromXmlAction(formData: FormData) {
  const extractionId = String(formData.get("extractionId") ?? "").trim();

  if (!extractionId) {
    throw new Error("Extraccion requerida.");
  }

  const extraction = await getDocumentExtractionById(extractionId);
  const data = extraction.extracted_data ?? {};
  const clave = data.clave ?? "";

  await createPurchase({
    supplierName: data.emisor_nombre || data.supplier_name || "",
    documentNumber: data.numero_consecutivo || data.document_number || "",
    purchaseDate: data.fecha_emision || data.date || "",
    category: "XML Costa Rica",
    description: `Creado desde XML: ${clave}`,
    currency: data.moneda || data.currency || "CRC",
    subtotal: Number(data.subtotal ?? 0),
    tax: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: data.medio_pago || "",
    status: "registrada",
    notes: `Creado desde XML: ${clave}`,
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

  await createInvoiceForActiveCompany({
    tipoDocumento: data.document_kind || "factura",
    proveedor: data.receptor_nombre || data.emisor_nombre || data.supplier_name || "",
    numeroDocumento: data.numero_consecutivo || data.document_number || "",
    fecha: data.fecha_emision || data.date || "",
    moneda: data.moneda || data.currency || "CRC",
    subtotal: Number(data.subtotal ?? 0),
    impuesto: Number(data.impuesto ?? data.tax ?? 0),
    total: Number(data.total ?? 0),
    estado: "registrada",
    notas: `Creado desde XML: ${clave}`,
  });

  revalidatePath("/facturas");
  revalidatePath("/documentos");
  redirect("/facturas");
}
