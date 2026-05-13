"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generarAsientoCompra,
  revertirAsientoCompra,
} from "@/lib/contabilizacion-compras";
import { normalizeCurrencyCode } from "@/lib/currency";
import { registerPurchasePayment } from "@/lib/payments";
import { createPurchase, updatePurchaseReviewStatus } from "@/lib/purchases";

function parseAmount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

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

export async function createPurchaseAction(formData: FormData) {
  let target = "/compras";

  try {
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
  } catch (error) {
    logActionError("createPurchaseAction", error);
    target = redirectWithError(
      "/compras",
      getErrorMessage(error, "No se pudo crear la compra."),
    );
  }

  revalidatePath("/compras");
  redirect(target);
}

export async function updatePurchaseReviewStatusAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");
  let target = redirectTo;

  try {
    const reviewStatus = String(formData.get("reviewStatus") ?? "pending");
    const purchase = await updatePurchaseReviewStatus({
      notes: String(formData.get("reviewNotes") ?? "").trim(),
      purchaseId: String(formData.get("purchaseId") ?? ""),
      status: reviewStatus,
    });

    if (reviewStatus === "reviewed" || reviewStatus === "approved") {
      await generarAsientoCompra(purchase.id);
    }
  } catch (error) {
    logActionError("updatePurchaseReviewStatusAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo actualizar la revision de la compra."),
    );
  }

  revalidatePath("/compras");
  redirect(target);
}

export async function generatePurchaseAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");
  let target = redirectTo;

  try {
    await generarAsientoCompra(String(formData.get("purchaseId") ?? ""));
  } catch (error) {
    logActionError("generatePurchaseAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento contable."),
    );
  }

  revalidatePath("/compras");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
  redirect(target);
}

export async function revertPurchaseAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");
  let target = redirectTo;

  try {
    await revertirAsientoCompra(
      String(formData.get("purchaseId") ?? ""),
      String(formData.get("motivo") ?? "Reversion contable de compra").trim(),
    );
  } catch (error) {
    logActionError("revertPurchaseAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo revertir el asiento contable."),
    );
  }

  revalidatePath("/compras");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
  redirect(target);
}

export async function registerPurchasePaymentAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/compras");
  let target = redirectTo;

  try {
    await registerPurchasePayment({
      amount: parseAmount(formData.get("amount")),
      notes: String(formData.get("notes") ?? "").trim(),
      paymentDate:
        String(formData.get("paymentDate") ?? "").trim() ||
        new Date().toISOString().slice(0, 10),
      paymentMethodId: String(formData.get("paymentMethodId") ?? ""),
      purchaseId: String(formData.get("purchaseId") ?? ""),
    });
  } catch (error) {
    logActionError("registerPurchasePaymentAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo registrar el pago."),
    );
  }

  revalidatePath("/compras");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  redirect(target);
}
