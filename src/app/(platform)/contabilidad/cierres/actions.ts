"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cerrarPeriodoContable,
  generarChecklistCierre,
  marcarItemCierre,
  reabrirPeriodoContable,
  type CierreItemEstado,
} from "@/lib/cierres-contables";

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

function revalidateCierrePaths(cierreId?: string) {
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/cierres");

  if (cierreId) {
    revalidatePath(`/contabilidad/cierres/${cierreId}`);
  }
}

export async function generateClosingChecklistAction(formData: FormData) {
  let target = "/contabilidad/cierres";

  try {
    const periodo = String(formData.get("periodo") ?? "").trim();
    const fechaInicio = String(formData.get("fechaInicio") ?? "").trim();
    const fechaFin = String(formData.get("fechaFin") ?? "").trim();
    const cierre = await generarChecklistCierre({
      fechaFin,
      fechaInicio,
      periodo,
    });

    target = `/contabilidad/cierres/${cierre.id}`;
    revalidateCierrePaths(cierre.id);
  } catch (error) {
    logActionError("generateClosingChecklistAction", error);
    target = redirectWithError(
      "/contabilidad/cierres",
      getErrorMessage(error, "No se pudo generar el checklist de cierre."),
    );
  }

  redirect(target);
}

export async function markClosingItemAction(formData: FormData) {
  const cierreId = String(formData.get("cierreId") ?? "").trim();
  let target = cierreId
    ? `/contabilidad/cierres/${cierreId}`
    : "/contabilidad/cierres";

  try {
    const itemId = String(formData.get("itemId") ?? "").trim();
    const estado = String(formData.get("estado") ?? "").trim() as CierreItemEstado;
    const motivo = String(formData.get("motivo") ?? "").trim();

    await marcarItemCierre(itemId, estado, motivo || undefined);
    revalidateCierrePaths(cierreId);
  } catch (error) {
    logActionError("markClosingItemAction", error);
    target = redirectWithError(
      target,
      getErrorMessage(error, "No se pudo actualizar el item del cierre."),
    );
  }

  redirect(target);
}

export async function closeAccountingClosingAction(formData: FormData) {
  const cierreId = String(formData.get("cierreId") ?? "").trim();
  let target = cierreId
    ? `/contabilidad/cierres/${cierreId}`
    : "/contabilidad/cierres";

  try {
    await cerrarPeriodoContable(cierreId);
    revalidateCierrePaths(cierreId);
  } catch (error) {
    logActionError("closeAccountingClosingAction", error);
    target = redirectWithError(
      target,
      getErrorMessage(error, "No se pudo cerrar el periodo contable."),
    );
  }

  redirect(target);
}

export async function reopenAccountingClosingAction(formData: FormData) {
  const cierreId = String(formData.get("cierreId") ?? "").trim();
  let target = cierreId
    ? `/contabilidad/cierres/${cierreId}`
    : "/contabilidad/cierres";

  try {
    const motivo = String(formData.get("motivo") ?? "").trim();

    await reabrirPeriodoContable(cierreId, motivo);
    revalidateCierrePaths(cierreId);
  } catch (error) {
    logActionError("reopenAccountingClosingAction", error);
    target = redirectWithError(
      target,
      getErrorMessage(error, "No se pudo reabrir el periodo contable."),
    );
  }

  redirect(target);
}
