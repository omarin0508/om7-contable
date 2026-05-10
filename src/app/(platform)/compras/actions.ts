"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createPurchase } from "@/lib/purchases";

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
