"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCurrencyCode } from "@/lib/currency";
import { registerPurchasePayment } from "@/lib/payments";
import { createPurchase, updatePurchaseReviewStatus } from "@/lib/purchases";

function parseAmount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function createPurchaseAction(formData: FormData) {
  await createPurchase({
    supplierName: String(formData.get("supplierName") ?? "").trim(),
    documentNumber: String(formData.get("documentNumber") ?? "").trim(),
    purchaseDate: String(formData.get("purchaseDate") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    currency: normalizeCurrencyCode(formData.get("currency")),
    subtotal: parseAmount(formData.get("subtotal")),
    tax: parseAmount(formData.get("tax")),
    total: parseAmount(formData.get("total")),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim(),
    status: String(formData.get("status") ?? "registrada").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  revalidatePath("/compras");
  redirect("/compras");
}

export async function updatePurchaseReviewStatusAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");

  await updatePurchaseReviewStatus({
    notes: String(formData.get("reviewNotes") ?? "").trim(),
    purchaseId: String(formData.get("purchaseId") ?? ""),
    status: String(formData.get("reviewStatus") ?? "pending"),
  });

  revalidatePath("/compras");
  redirect(redirectTo);
}

export async function registerPurchasePaymentAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");

  await registerPurchasePayment({
    amount: parseAmount(formData.get("amount")),
    notes: String(formData.get("notes") ?? "").trim(),
    paymentDate:
      String(formData.get("paymentDate") ?? "").trim() ||
      new Date().toISOString().slice(0, 10),
    paymentMethodId: String(formData.get("paymentMethodId") ?? ""),
    purchaseId: String(formData.get("purchaseId") ?? ""),
  });

  revalidatePath("/compras");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  redirect(redirectTo);
}
