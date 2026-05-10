"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assignClientToCompany, createCompany } from "@/lib/companies";

export async function createCompanyAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const taxId = String(formData.get("taxId") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const baseCurrency = String(formData.get("baseCurrency") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!name) {
    throw new Error("El nombre comercial es requerido.");
  }

  await createCompany({
    name,
    legalName,
    taxId,
    country,
    baseCurrency,
    status,
  });

  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function assignClientToCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!companyId || !email) {
    throw new Error("Empresa y email son requeridos.");
  }

  await assignClientToCompany(companyId, email);

  revalidatePath("/empresas");
  redirect("/empresas");
}
