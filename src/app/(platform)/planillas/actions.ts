"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/active-context";
import {
  generarAsientoPlanilla,
  revertirAsientoPlanilla,
} from "@/lib/contabilizacion-planillas";
import { normalizeCurrencyCode } from "@/lib/currency";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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

function revalidatePayrollPaths() {
  revalidatePath("/planillas");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/estado-resultados");
  revalidatePath("/contabilidad/reportes");
}

async function getValidatedSupabaseContext() {
  await assertInternalUser();
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const activeContext = await getActiveContext();
  const organization = activeContext.organization;
  const company = activeContext.activeCompany;

  if (!organization || !company) {
    throw new Error("Selecciona una organizacion y empresa activa.");
  }

  return { company, organization, supabase };
}

export async function createPlanillaAction(formData: FormData) {
  let target = "/planillas";

  try {
    const { company, organization, supabase } = await getValidatedSupabaseContext();
    const totalSalarios = parseAmount(formData.get("totalSalarios"));
    const totalCargasSociales = parseAmount(formData.get("totalCargasSociales"));
    const totalRetenciones = parseAmount(formData.get("totalRetenciones"));
    const totalNetoPagar =
      parseAmount(formData.get("totalNetoPagar")) ||
      Math.max(totalSalarios - totalRetenciones, 0);
    const totalObligaciones =
      parseAmount(formData.get("totalObligaciones")) ||
      totalCargasSociales + totalRetenciones;
    const { error } = await supabase.from("planillas").insert({
      clasificacion_laboral: String(
        formData.get("clasificacionLaboral") ?? "",
      ).trim() || null,
      company_id: company.id,
      estado_operativo: String(
        formData.get("estadoOperativo") ?? "aprobada",
      ).trim(),
      fecha_pago: String(formData.get("fechaPago") ?? "").trim() || null,
      moneda: normalizeCurrencyCode(formData.get("moneda")),
      nombre: String(formData.get("nombre") ?? "").trim(),
      organization_id: organization.id,
      periodo_desde: String(formData.get("periodoDesde") ?? "").trim(),
      periodo_hasta: String(formData.get("periodoHasta") ?? "").trim(),
      tipo_planilla:
        String(formData.get("tipoPlanilla") ?? "").trim() || "semanal",
      total_cargas_sociales: totalCargasSociales,
      total_neto_pagar: totalNetoPagar,
      total_obligaciones: totalObligaciones,
      total_retenciones: totalRetenciones,
      total_salarios: totalSalarios,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    logActionError("createPlanillaAction", error);
    target = redirectWithError(
      "/planillas",
      getErrorMessage(error, "No se pudo crear la planilla."),
    );
  }

  revalidatePayrollPaths();
  redirect(target);
}

export async function generatePayrollAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/planillas");
  let target = redirectTo;

  try {
    await generarAsientoPlanilla(String(formData.get("planillaId") ?? ""));
  } catch (error) {
    logActionError("generatePayrollAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento de planilla."),
    );
  }

  revalidatePayrollPaths();
  redirect(target);
}

export async function revertPayrollAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/planillas");
  let target = redirectTo;

  try {
    await revertirAsientoPlanilla(
      String(formData.get("planillaId") ?? ""),
      String(formData.get("motivo") ?? "Reversion contable de planilla").trim(),
    );
  } catch (error) {
    logActionError("revertPayrollAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo revertir el asiento de planilla."),
    );
  }

  revalidatePayrollPaths();
  redirect(target);
}
