"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createDefaultAccountsForCompany,
  observeJournalEntry,
  postJournalEntry,
  suggestJournalEntryForInvoice,
  suggestJournalEntryForPurchase,
  updateJournalEntryStatus,
} from "@/lib/accounting-entries";

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
  const [basePath, hash] = path.split("#");
  const separator = basePath.includes("?") ? "&" : "?";
  const target = `${basePath}${separator}error=${encodeURIComponent(message)}`;

  return hash ? `${target}#${hash}` : target;
}

export async function createDefaultAccountsAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");
  let target = redirectTo;

  try {
    await createDefaultAccountsForCompany();
  } catch (error) {
    logActionError("createDefaultAccountsAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudieron preparar las cuentas base."),
    );
  }

  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/catalogo");
  redirect(target);
}

export async function suggestJournalEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");
  const sourceType = String(formData.get("sourceType") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  let target = redirectTo;

  try {
    if (sourceType === "purchase") {
      await suggestJournalEntryForPurchase(sourceId);
    } else if (sourceType === "invoice") {
      await suggestJournalEntryForInvoice(sourceId);
    } else {
      throw new Error("Origen contable invalido.");
    }
  } catch (error) {
    logActionError("suggestJournalEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento sugerido."),
    );
  }

  revalidatePath("/contabilidad");
  revalidatePath("/compras");
  revalidatePath("/facturas");
  redirect(target);
}

export async function updateJournalEntryStatusAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");
  const status = String(formData.get("journalStatus") ?? "reviewed");
  const note = String(formData.get("journalNote") ?? "").trim();
  let target = redirectTo;

  try {
    if (status === "posted") {
      await postJournalEntry(entryId);
    } else if (status === "observed") {
      await observeJournalEntry(entryId, note);
    } else if (status === "reviewed") {
      await updateJournalEntryStatus(entryId, "reviewed");
    } else {
      throw new Error("Estado contable invalido.");
    }
  } catch (error) {
    logActionError("updateJournalEntryStatusAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo actualizar el asiento."),
    );
  }

  revalidatePath("/contabilidad");
  revalidatePath("/compras");
  revalidatePath("/facturas");
  redirect(target);
}
