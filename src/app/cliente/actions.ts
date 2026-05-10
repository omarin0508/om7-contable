"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uploadDocument } from "@/lib/storage";

function getFile(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Selecciona un archivo valido.");
  }

  return file;
}

export async function uploadClientDocumentAction(formData: FormData) {
  const documentType = String(formData.get("documentType") ?? "factura").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();

  await uploadDocument({
    file: getFile(formData),
    relatedType: "client_upload",
    companyId: companyId || undefined,
    documentType: documentType || "factura",
    metadata: {
      channel: "client_portal",
    },
  });

  revalidatePath("/cliente");
  revalidatePath("/documentos");
  redirect("/cliente");
}
