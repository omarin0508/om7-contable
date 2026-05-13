"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generarAsientoFactura,
  revertirAsientoFactura,
} from "@/lib/contabilizacion-facturas";
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
    const reviewStatus = String(formData.get("reviewStatus") ?? "pending");
    const invoice = await updateInvoiceReviewStatus({
      invoiceId: String(formData.get("invoiceId") ?? ""),
      notes: String(formData.get("reviewNotes") ?? "").trim(),
      status: reviewStatus,
    });

    if (reviewStatus === "reviewed" || reviewStatus === "approved") {
      await generarAsientoFactura(invoice.id);
    }
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

export async function generateInvoiceAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/facturas");
  let target = redirectTo;

  try {
    await generarAsientoFactura(String(formData.get("invoiceId") ?? ""));
  } catch (error) {
    logActionError("generateInvoiceAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento contable."),
    );
  }

  revalidatePath("/facturas");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
  redirect(target);
}

export async function revertInvoiceAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/facturas");
  let target = redirectTo;

  try {
    await revertirAsientoFactura(
      String(formData.get("invoiceId") ?? ""),
      String(formData.get("motivo") ?? "Reversion contable de factura").trim(),
    );
  } catch (error) {
    logActionError("revertInvoiceAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo revertir el asiento contable."),
    );
  }

  revalidatePath("/facturas");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
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
