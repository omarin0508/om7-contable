"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createReglaContable,
  duplicarReglaGlobalAOrganizacion,
  toggleReglaContable,
  updateReglaContable,
  type ReglaContableModulo,
} from "@/lib/reglas-contables";

const accountFieldsByModulo: Record<ReglaContableModulo, string[]> = {
  caja: ["cuenta_caja_banco_id", "cuenta_contrapartida_id", "cuenta_iva_id"],
  compras: ["cuenta_debito_id", "cuenta_credito_id", "cuenta_iva_id"],
  facturas: ["cuenta_clientes_id", "cuenta_ingreso_id", "cuenta_iva_debito_id"],
  planillas: [
    "cuenta_gasto_salarios_id",
    "cuenta_cargas_sociales_id",
    "cuenta_banco_id",
    "cuenta_obligaciones_id",
  ],
  subcontratos: [
    "cuenta_costo_subcontrato_id",
    "cuenta_proveedor_id",
    "cuenta_banco_id",
    "cuenta_retenciones_id",
  ],
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function redirectWithError(message: string) {
  return `/contabilidad/reglas?error=${encodeURIComponent(message)}`;
}

function getModulo(formData: FormData): ReglaContableModulo {
  const modulo = String(formData.get("modulo") ?? "") as ReglaContableModulo;

  if (!Object.keys(accountFieldsByModulo).includes(modulo)) {
    throw new Error("Modulo de regla invalido.");
  }

  return modulo;
}

function getPayload(formData: FormData) {
  const modulo = getModulo(formData);
  const cuentas = Object.fromEntries(
    accountFieldsByModulo[modulo].map((field) => [
      field,
      String(formData.get(field) ?? "").trim() || null,
    ]),
  );

  return {
    activa: String(formData.get("activa") ?? "true") === "true",
    clave: String(formData.get("clave") ?? "").trim(),
    claveSecundaria: String(formData.get("claveSecundaria") ?? "").trim() || null,
    cuentas,
    modulo,
    prioridad: Number(formData.get("prioridad") ?? 100),
    requiereCentroCosto: String(formData.get("requiereCentroCosto") ?? "") === "on",
  };
}

function revalidateReglas() {
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/reglas");
}

export async function createReglaContableAction(formData: FormData) {
  let target = "/contabilidad/reglas";

  try {
    await createReglaContable(getPayload(formData));
    revalidateReglas();
  } catch (error) {
    target = redirectWithError(
      getErrorMessage(error, "No se pudo crear la regla contable."),
    );
  }

  redirect(target);
}

export async function updateReglaContableAction(formData: FormData) {
  let target = "/contabilidad/reglas";

  try {
    const modulo = getModulo(formData);
    const ruleId = String(formData.get("ruleId") ?? "").trim();

    await updateReglaContable(modulo, ruleId, {
      activa: String(formData.get("activa") ?? "true") === "true",
      clave: String(formData.get("clave") ?? "").trim(),
      claveSecundaria:
        String(formData.get("claveSecundaria") ?? "").trim() || null,
      cuentas: Object.fromEntries(
        accountFieldsByModulo[modulo].map((field) => [
          field,
          String(formData.get(field) ?? "").trim() || null,
        ]),
      ),
      prioridad: Number(formData.get("prioridad") ?? 100),
      requiereCentroCosto:
        String(formData.get("requiereCentroCosto") ?? "") === "on",
    });
    revalidateReglas();
  } catch (error) {
    target = redirectWithError(
      getErrorMessage(error, "No se pudo actualizar la regla contable."),
    );
  }

  redirect(target);
}

export async function toggleReglaContableAction(formData: FormData) {
  let target = "/contabilidad/reglas";

  try {
    await toggleReglaContable(
      getModulo(formData),
      String(formData.get("ruleId") ?? "").trim(),
      String(formData.get("activa") ?? "") === "true",
    );
    revalidateReglas();
  } catch (error) {
    target = redirectWithError(
      getErrorMessage(error, "No se pudo cambiar el estado de la regla."),
    );
  }

  redirect(target);
}

export async function duplicateReglaContableAction(formData: FormData) {
  let target = "/contabilidad/reglas";

  try {
    await duplicarReglaGlobalAOrganizacion(
      getModulo(formData),
      String(formData.get("ruleId") ?? "").trim(),
    );
    revalidateReglas();
  } catch (error) {
    target = redirectWithError(
      getErrorMessage(error, "No se pudo duplicar la regla global."),
    );
  }

  redirect(target);
}
