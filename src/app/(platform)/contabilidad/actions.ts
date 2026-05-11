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

export async function createDefaultAccountsAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");

  await createDefaultAccountsForCompany();

  revalidatePath("/contabilidad");
  redirect(redirectTo);
}

export async function suggestJournalEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");
  const sourceType = String(formData.get("sourceType") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");

  if (sourceType === "purchase") {
    await suggestJournalEntryForPurchase(sourceId);
  } else if (sourceType === "invoice") {
    await suggestJournalEntryForInvoice(sourceId);
  } else {
    throw new Error("Origen contable invalido.");
  }

  revalidatePath("/contabilidad");
  revalidatePath("/compras");
  revalidatePath("/facturas");
  redirect(redirectTo);
}

export async function updateJournalEntryStatusAction(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/contabilidad");
  const status = String(formData.get("journalStatus") ?? "reviewed");
  const note = String(formData.get("journalNote") ?? "").trim();

  if (status === "posted") {
    await postJournalEntry(entryId);
  } else if (status === "observed") {
    await observeJournalEntry(entryId, note);
  } else if (status === "reviewed") {
    await updateJournalEntryStatus(entryId, "reviewed");
  } else {
    throw new Error("Estado contable invalido.");
  }

  revalidatePath("/contabilidad");
  revalidatePath("/compras");
  revalidatePath("/facturas");
  redirect(redirectTo);
}
