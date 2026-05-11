"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateDocumentReviewStatus } from "@/lib/document-review";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logActionError(action: string, error: unknown) {
  console.error("[OM7 action error]", {
    action,
    error: error instanceof Error ? error.message : String(error),
  });
}

function redirectWithError(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export async function markDocumentReviewedAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const notes = String(formData.get("reviewNotes") ?? "").trim();
  let target = "/bandeja";

  try {
    if (!documentId) {
      throw new Error("Documento requerido.");
    }

    await updateDocumentReviewStatus(documentId, "reviewed", notes);
  } catch (error) {
    logActionError("markDocumentReviewedAction", error);
    target = redirectWithError(
      "/bandeja",
      getErrorMessage(error, "No se pudo marcar el documento como revisado."),
    );
  }

  revalidatePath("/bandeja");
  redirect(target);
}

export async function markDocumentRejectedAction(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const notes = String(formData.get("reviewNotes") ?? "").trim();
  let target = "/bandeja";

  try {
    if (!documentId) {
      throw new Error("Documento requerido.");
    }

    await updateDocumentReviewStatus(documentId, "rejected", notes);
  } catch (error) {
    logActionError("markDocumentRejectedAction", error);
    target = redirectWithError(
      "/bandeja",
      getErrorMessage(error, "No se pudo observar el documento."),
    );
  }

  revalidatePath("/bandeja");
  redirect(target);
}
