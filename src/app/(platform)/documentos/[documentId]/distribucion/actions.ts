"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveAndSyncE7Distribution,
  updateE7DistributionLines,
  type E7TaxTreatment,
} from "@/lib/e7-mind";

function redirectWithError(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

function redirectWithNotice(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}notice=${encodeURIComponent(message)}`;
}

function getString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function getLineUpdates(formData: FormData) {
  const lines = new Map<
    number,
    {
      account: string;
      category: string;
      costCenter: string;
      id: string;
      taxTreatment: E7TaxTreatment | string;
    }
  >();

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^lines\[(\d+)\]\[(.+)\]$/);

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const field = match[2] as "account" | "category" | "costCenter" | "id" | "taxTreatment";
    const current =
      lines.get(index) ??
      ({
        account: "",
        category: "",
        costCenter: "",
        id: "",
        taxTreatment: "not_applicable",
      } satisfies {
        account: string;
        category: string;
        costCenter: string;
        id: string;
        taxTreatment: E7TaxTreatment | string;
      });

    current[field] = getString(value);
    lines.set(index, current);
  }

  return [...lines.values()].filter((line) => line.id);
}

export async function saveE7DistributionAction(formData: FormData) {
  const documentId = getString(formData.get("documentId"));
  const redirectTo =
    getString(formData.get("redirectTo")) ||
    (documentId ? `/documentos/${documentId}/distribucion` : "/documentos");
  let target = redirectTo;

  try {
    if (!documentId) {
      throw new Error("Documento requerido.");
    }

    const lines = getLineUpdates(formData);

    if (lines.length === 0) {
      throw new Error("No hay lineas para actualizar.");
    }

    await updateE7DistributionLines(documentId, lines);
    target = redirectWithNotice(
      redirectTo,
      "Distribucion contable actualizada.",
    );
  } catch (error) {
    console.error("[OM7 action error]", {
      action: "saveE7DistributionAction",
      error: error instanceof Error ? error.message : String(error),
    });
    target = redirectWithError(
      redirectTo,
      error instanceof Error
        ? error.message
        : "No se pudo guardar la distribucion.",
    );
  }

  revalidatePath(`/documentos/${documentId}/distribucion`);
  revalidatePath(`/documentos/${documentId}`);
  redirect(target);
}

export async function approveE7DistributionAction(formData: FormData) {
  const documentId = getString(formData.get("documentId"));
  const redirectTo =
    getString(formData.get("redirectTo")) ||
    (documentId ? `/documentos/${documentId}/distribucion` : "/documentos");
  let target = redirectTo;

  try {
    if (!documentId) {
      throw new Error("Documento requerido.");
    }

    const result = await approveAndSyncE7Distribution(documentId);
    const message =
      result.action === "prepared"
        ? result.reason
        : `Distribucion aprobada y ${
            result.recordType === "purchase" ? "compra" : "factura"
          } ${result.action === "created" ? "creada" : "actualizada"}.`;

    target = redirectWithNotice(result.targetPath, message);
  } catch (error) {
    console.error("[OM7 action error]", {
      action: "approveE7DistributionAction",
      error: error instanceof Error ? error.message : String(error),
    });
    target = redirectWithError(
      redirectTo,
      error instanceof Error
        ? error.message
        : "No se pudo aprobar la distribucion.",
    );
  }

  revalidatePath(`/documentos/${documentId}/distribucion`);
  revalidatePath(`/documentos/${documentId}`);
  revalidatePath("/documentos");
  revalidatePath("/bandeja");
  revalidatePath("/compras");
  revalidatePath("/facturas");
  redirect(target);
}
