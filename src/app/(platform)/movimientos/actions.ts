"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generarAsientoMovimientoCaja,
  revertirAsientoMovimientoCaja,
} from "@/lib/contabilizacion-caja";

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

function revalidateAccountingPaths() {
  revalidatePath("/movimientos");
  revalidatePath("/movimientos/recientes");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
  revalidatePath("/contabilidad/reportes");
}

export async function generateCashMovementAccountingEntryAction(
  formData: FormData,
) {
  const redirectTo = String(formData.get("redirectTo") ?? "/movimientos/recientes");
  let target = redirectTo;

  try {
    await generarAsientoMovimientoCaja(String(formData.get("movementId") ?? ""));
  } catch (error) {
    logActionError("generateCashMovementAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento de caja/banco."),
    );
  }

  revalidateAccountingPaths();
  redirect(target);
}

export async function revertCashMovementAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/movimientos/recientes");
  let target = redirectTo;

  try {
    await revertirAsientoMovimientoCaja(
      String(formData.get("movementId") ?? ""),
      String(formData.get("motivo") ?? "Reversion contable de caja/banco").trim(),
    );
  } catch (error) {
    logActionError("revertCashMovementAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo revertir el asiento de caja/banco."),
    );
  }

  revalidateAccountingPaths();
  redirect(target);
}
