"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createInvoiceForActiveCompany } from "@/lib/invoices";

function parseAmount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function createInvoiceAction(formData: FormData) {
  const proveedor = String(formData.get("proveedor") ?? "").trim();

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

  revalidatePath("/facturas");
  redirect("/facturas");
}
