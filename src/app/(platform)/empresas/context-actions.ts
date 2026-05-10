"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setActiveCompany } from "@/lib/active-context";

export async function setActiveCompanyAction(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "").trim();

  if (!companyId) {
    throw new Error("Empresa requerida.");
  }

  await setActiveCompany(companyId);
  revalidatePath("/empresas");
  revalidatePath("/dashboard");
  redirect("/empresas");
}
