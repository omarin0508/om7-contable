"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/active-context";
import {
  generarAsientoSubcontrato,
  revertirAsientoSubcontrato,
} from "@/lib/contabilizacion-subcontratos";
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

function revalidateSubcontractPaths() {
  revalidatePath("/subcontratos");
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

export async function createSubcontractAction(formData: FormData) {
  let target = "/subcontratos";

  try {
    const { company, organization, supabase } = await getValidatedSupabaseContext();
    const { error } = await supabase.from("subcontratos").insert({
      categoria_subcontrato:
        String(formData.get("categoriaSubcontrato") ?? "").trim() || null,
      company_id: company.id,
      estado_operativo:
        String(formData.get("estadoOperativo") ?? "").trim() || "aprobado",
      fecha_fin: String(formData.get("fechaFin") ?? "").trim() || null,
      fecha_inicio: String(formData.get("fechaInicio") ?? "").trim() || null,
      moneda: normalizeCurrencyCode(formData.get("moneda")),
      monto_retencion_estimado: parseAmount(formData.get("montoRetencion")),
      monto_total: parseAmount(formData.get("montoTotal")),
      nombre: String(formData.get("nombre") ?? "").trim(),
      organization_id: organization.id,
      subcontratista_nombre: String(
        formData.get("subcontratistaNombre") ?? "",
      ).trim(),
      tipo_subcontrato:
        String(formData.get("tipoSubcontrato") ?? "").trim() || "obra",
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    logActionError("createSubcontractAction", error);
    target = redirectWithError(
      "/subcontratos",
      getErrorMessage(error, "No se pudo crear el subcontrato."),
    );
  }

  revalidateSubcontractPaths();
  redirect(target);
}

export async function createSubcontractPaymentAction(formData: FormData) {
  let target = "/subcontratos";

  try {
    const { company, organization, supabase } = await getValidatedSupabaseContext();
    const montoBruto = parseAmount(formData.get("montoBruto"));
    const montoRetencion = parseAmount(formData.get("montoRetencion"));
    const montoNeto =
      parseAmount(formData.get("montoNeto")) ||
      Math.max(montoBruto - montoRetencion, 0);
    const { data, error } = await supabase
      .from("subcontratos_pagos")
      .insert({
        company_id: company.id,
        estado_operativo:
          String(formData.get("estadoOperativo") ?? "").trim() || "aprobado",
        fecha_pago:
          String(formData.get("fechaPago") ?? "").trim() ||
          new Date().toISOString().slice(0, 10),
        monto_bruto: montoBruto,
        monto_neto: montoNeto,
        monto_retencion: montoRetencion,
        numero_documento:
          String(formData.get("numeroDocumento") ?? "").trim() || null,
        organization_id: organization.id,
        subcontrato_id: String(formData.get("subcontratoId") ?? ""),
      })
      .select("id,estado_operativo")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear el pago.");
    }

    if (["revisado", "aprobado", "pagado"].includes(data.estado_operativo)) {
      await generarAsientoSubcontrato(data.id);
    }
  } catch (error) {
    logActionError("createSubcontractPaymentAction", error);
    target = redirectWithError(
      "/subcontratos",
      getErrorMessage(error, "No se pudo registrar el pago de subcontrato."),
    );
  }

  revalidateSubcontractPaths();
  redirect(target);
}

export async function generateSubcontractAccountingEntryAction(
  formData: FormData,
) {
  const redirectTo = String(formData.get("redirectTo") ?? "/subcontratos");
  let target = redirectTo;

  try {
    await generarAsientoSubcontrato(String(formData.get("subcontratoPagoId") ?? ""));
  } catch (error) {
    logActionError("generateSubcontractAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo generar el asiento de subcontrato."),
    );
  }

  revalidateSubcontractPaths();
  redirect(target);
}

export async function revertSubcontractAccountingEntryAction(formData: FormData) {
  const redirectTo = String(formData.get("redirectTo") ?? "/subcontratos");
  let target = redirectTo;

  try {
    await revertirAsientoSubcontrato(
      String(formData.get("subcontratoPagoId") ?? ""),
      String(formData.get("motivo") ?? "Reversion contable de subcontrato").trim(),
    );
  } catch (error) {
    logActionError("revertSubcontractAccountingEntryAction", error);
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo revertir el asiento de subcontrato."),
    );
  }

  revalidateSubcontractPaths();
  redirect(target);
}
