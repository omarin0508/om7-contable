"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uploadDocument } from "@/lib/storage";

type UploadErrorCode =
  | "no_company"
  | "storage_failed"
  | "xml_processing_failed"
  | "permission_denied"
  | "invalid_file"
  | "upload_failed";

function getFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo valido.");
  }

  return file;
}

function getClientUploadErrorCode(error: unknown): UploadErrorCode {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("empresa asignada")) {
    return "no_company";
  }

  if (message.includes("guardar el archivo")) {
    return "storage_failed";
  }

  if (message.includes("XML se subió")) {
    return "xml_processing_failed";
  }

  if (message.includes("permisos")) {
    return "permission_denied";
  }

  if (message.includes("archivo") || message.includes("permiten")) {
    return "invalid_file";
  }

  return "upload_failed";
}

export async function uploadClientDocumentAction(formData: FormData) {
  const documentType = String(formData.get("documentType") ?? "factura").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();
  let warningCode: string | undefined;

  try {
    const result = await uploadDocument({
      file: getFile(formData),
      relatedType: "client_upload",
      companyId: companyId || undefined,
      documentType: documentType || "factura",
      metadata: {
        channel: "client_portal",
      },
    });
    warningCode = result.warningCode;
  } catch (error) {
    console.error("[OM7 client upload action failed]", {
      company_id: companyId || null,
      document_type: documentType || null,
      error: error instanceof Error ? error.message : String(error),
    });
    const errorCode = getClientUploadErrorCode(error);
    const search = new URLSearchParams({ uploadError: errorCode });

    if (companyId) {
      search.set("companyId", companyId);
    }

    redirect(`/cliente?${search.toString()}`);
  }

  revalidatePath("/cliente");
  revalidatePath("/documentos");

  const search = new URLSearchParams();

  if (companyId) {
    search.set("companyId", companyId);
  }

  if (warningCode) {
    search.set("uploadWarning", warningCode);
  } else {
    search.set("uploadStatus", "success");
  }

  redirect(`/cliente?${search.toString()}`);
}
