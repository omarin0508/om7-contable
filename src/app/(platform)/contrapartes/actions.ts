"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCounterparty,
  updateCounterparty,
  updateCounterpartyStatus,
  type CounterpartyType,
} from "@/lib/counterparties";
import { assertInternalUser } from "@/lib/permissions";

function parseCounterpartyType(value: FormDataEntryValue | null): CounterpartyType {
  const parsed = String(value ?? "supplier");

  if (parsed === "supplier" || parsed === "customer" || parsed === "both") {
    return parsed;
  }

  return "supplier";
}

function parseCounterpartyInput(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    isActive: String(formData.get("isActive") ?? "true") === "true",
    name: String(formData.get("name") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    taxId: String(formData.get("taxId") ?? "").trim(),
    type: parseCounterpartyType(formData.get("type")),
  };
}

export async function createCounterpartyAction(formData: FormData) {
  await assertInternalUser();
  await createCounterparty(parseCounterpartyInput(formData));

  revalidatePath("/contrapartes");
  redirect("/contrapartes");
}

export async function updateCounterpartyAction(formData: FormData) {
  const counterpartyId = String(formData.get("counterpartyId") ?? "").trim();
  const redirectTo = String(
    formData.get("redirectTo") ?? `/contrapartes/${counterpartyId}`,
  );

  if (!counterpartyId) {
    throw new Error("Contraparte requerida.");
  }

  await assertInternalUser();
  await updateCounterparty(counterpartyId, parseCounterpartyInput(formData));

  revalidatePath("/contrapartes");
  revalidatePath(`/contrapartes/${counterpartyId}`);
  redirect(redirectTo);
}

export async function activateCounterpartyAction(formData: FormData) {
  const counterpartyId = String(formData.get("counterpartyId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/contrapartes");

  if (!counterpartyId) {
    throw new Error("Contraparte requerida.");
  }

  await assertInternalUser();
  await updateCounterpartyStatus(counterpartyId, true);

  revalidatePath("/contrapartes");
  revalidatePath(`/contrapartes/${counterpartyId}`);
  redirect(redirectTo);
}

export async function inactivateCounterpartyAction(formData: FormData) {
  const counterpartyId = String(formData.get("counterpartyId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/contrapartes");

  if (!counterpartyId) {
    throw new Error("Contraparte requerida.");
  }

  await assertInternalUser();
  await updateCounterpartyStatus(counterpartyId, false);

  revalidatePath("/contrapartes");
  revalidatePath(`/contrapartes/${counterpartyId}`);
  redirect(redirectTo);
}
