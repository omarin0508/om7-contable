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

export async function markPeriodInReviewAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  const period = await createOrGetAccountingPeriod(companyId, year, month);

  await markAccountingPeriodInReview(period.id, notes);

  revalidatePath("/periodos");
  redirect("/periodos");
}

export async function closePeriodAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  const period = await createOrGetAccountingPeriod(companyId, year, month);

  await closeAccountingPeriod(period.id, notes);

  revalidatePath("/periodos");
  redirect("/periodos");
}

export async function reopenPeriodAction(formData: FormData) {
  const { companyId, month, notes, year } = parsePeriod(formData);
  const period = await createOrGetAccountingPeriod(companyId, year, month);

  await reopenAccountingPeriod(period.id, notes);

  revalidatePath("/periodos");
  redirect("/periodos");
}
