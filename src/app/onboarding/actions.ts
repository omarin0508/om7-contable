"use server";

import { redirect } from "next/navigation";
import { createOrganization } from "@/lib/organizations";

export async function createInitialOrganization(formData: FormData) {
  const name = String(formData.get("organizationName") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const baseCurrency = String(formData.get("currency") ?? "").trim();

  if (!name || !accountType) {
    throw new Error("Nombre y tipo de cuenta son requeridos.");
  }

  await createOrganization({
    name,
    accountType,
    country,
    baseCurrency,
  });

  redirect("/dashboard");
}
