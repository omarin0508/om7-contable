"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCurrencyCode } from "@/lib/currency";
import {
  createInvoiceForActiveCompany,
  updateInvoiceReviewStatus,
} from "@/lib/invoices";
import { registerInvoiceCollection } from "@/lib/payments";

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
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export async function createInvoiceAction(formData: FormData) {
  const errorRedirectTo = String(formData.get("errorRedirectTo") ?? "/facturas");
  const successRedirectTo = String(formData.get("successRedirectTo") ?? "/facturas");
  const proveedor = String(formData.get("proveedor") ?? "").trim();
  let target = successRedirectTo;

  try {
    if (!proveedor) {
      throw new Error("El proveedor es requerido.");
    }

    await createInvoiceForActiveCompany({
      tipoDocumento: String(formData.get("tipoDocumento") ?? "factura").trim(),
      proveedor,
      numeroDocumento: String(formData.get("numeroDocumento") ?? "").trim(),
      fecha: String(formData.get("fecha") ?? "").trim(),
      moneda: normalizeCurrencyCode(formData.get("moneda")),
      subtotal: parseAmount(formData.get("subtotal")),
      impuesto: parseAmount(formData.get("impuesto")),
      total: parseAmount(formData.get("total")),
      estado: String(formData.get("estado") ?? "borrador").trim(),
      notas: String(formData.get("notas") ?? "").trim(),
    });
  } catch (error) {
    logActionError("createInvoiceAction", error);
    target = redirectWithError(
      errorRedirectTo,
      getErrorMessage(error, "No se pudo crear la factura."),
    );
  }

  revalidatePath("/facturas");
  redirect(target);
}

export async function updateInvoiceReviewStatusAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/facturas");

  let target = redirectTo;

  try {
    await updateInvoiceReviewStatus({
      invoiceId: String(formData.get("invoiceId") ?? ""),
      notes: String(formData.get("reviewNotes") ?? "").trim(),
      status: String(formData.get("reviewStatus") ?? "pending"),
    });
  } catch (error) {
    logActionError("updateInvoiceReviewStatusAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo actualizar la revision de la factura."),
    );
  }

  revalidatePath("/facturas");
  redirect(target);
}

export async function registerInvoiceCollectionAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/facturas");
  let target = redirectTo;

  try {
    await registerInvoiceCollection({
      amount: parseAmount(formData.get("amount")),
      collectionDate:
        String(formData.get("collectionDate") ?? "").trim() ||
        new Date().toISOString().slice(0, 10),
      invoiceId: String(formData.get("invoiceId") ?? ""),
      notes: String(formData.get("notes") ?? "").trim(),
      paymentMethodId: String(formData.get("paymentMethodId") ?? ""),
    });
  } catch (error) {
    logActionError("registerInvoiceCollectionAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo registrar el cobro."),
    );
  }

  revalidatePath("/facturas");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  redirect(target);
}
