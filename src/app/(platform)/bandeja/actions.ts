"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateDocumentReviewStatus } from "@/lib/document-review";

export async function markDocumentReviewedAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const notes = String(formData.get("reviewNotes") ?? "").trim();

  if (!documentId) {
    throw new Error("Documento requerido.");
  }

  await updateDocumentReviewStatus(documentId, "reviewed", notes);
  revalidatePath("/bandeja");
  redirect("/bandeja");
}

export async function markDocumentRejectedAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const notes = String(formData.get("reviewNotes") ?? "").trim();

  if (!documentId) {
    throw new Error("Documento requerido.");
  }

  await updateDocumentReviewStatus(documentId, "rejected", notes);
  revalidatePath("/bandeja");
  redirect("/bandeja");
}
