"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  closeAccountingPeriod,
  createOrGetAccountingPeriod,
  markAccountingPeriodInReview,
  reopenAccountingPeriod,
} from "@/lib/accounting-periods";

function parsePeriod(formData: FormData) {
  return {
    companyId: String(formData.get("companyId") ?? "").trim() || undefined,
    month: Number(formData.get("periodMonth")),
    notes: String(formData.get("notes") ?? "").trim(),
    year: Number(formData.get("periodYear")),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function redirectWithError(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export async function markPeriodInReviewAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  let target = "/periodos";

  try {
    const period = await createOrGetAccountingPeriod(companyId, year, month);
    await markAccountingPeriodInReview(period.id, notes);
  } catch (error) {
    target = redirectWithError(
      "/periodos",
      getErrorMessage(error, "No se pudo marcar el periodo en revision."),
    );
  }

  revalidatePath("/periodos");
  redirect(target);
}

export async function closePeriodAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  let target = "/periodos";

  try {
    const period = await createOrGetAccountingPeriod(companyId, year, month);
    await closeAccountingPeriod(period.id, notes);
  } catch (error) {
    target = redirectWithError(
      "/periodos",
      getErrorMessage(error, "No se pudo cerrar el periodo."),
    );
  }

  revalidatePath("/periodos");
  redirect(target);
}

export async function reopenPeriodAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  let target = "/periodos";

  try {
    const period = await createOrGetAccountingPeriod(companyId, year, month);
    await reopenAccountingPeriod(period.id, notes);
  } catch (error) {
    target = redirectWithError(
      "/periodos",
      getErrorMessage(error, "No se pudo reabrir el periodo."),
    );
  }

  revalidatePath("/periodos");
  redirect(target);
}
