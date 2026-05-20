"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  anularAsiento,
  contabilizarAsiento,
  createAsientoBorrador,
  deleteAsientoBorrador,
  replaceLineasAsiento,
  updateAsientoBorrador,
  type AddLineaAsientoPayload,
} from "@/lib/asientos-contables";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function redirectWithError(path: string, message: string) {
  const [basePath, hash] = path.split("#");
  const separator = basePath.includes("?") ? "&" : "?";
  const target = `${basePath}${separator}error=${encodeURIComponent(message)}`;

  return hash ? `${target}#${hash}` : target;
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function parseAmount(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!normalized) {
    return 0;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Los montos de debe y haber deben ser numeros positivos.");
  }

  return amount;
}

function parseOptionalAmount(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El tipo de cambio debe ser un numero positivo.");
  }

  return amount;
}

function parseLineas(formData: FormData) {
  const accountIds = formData.getAll("lineAccountId");
  const descriptions = formData.getAll("lineDescription");
  const debits = formData.getAll("lineDebit");
  const credits = formData.getAll("lineCredit");
  const lineas: Omit<AddLineaAsientoPayload, "asiento_id">[] = [];

  for (let index = 0; index < accountIds.length; index += 1) {
    const cuenta_contable_id = String(accountIds[index] ?? "").trim();
    const descripcion = String(descriptions[index] ?? "").trim();
    const debito = parseAmount(debits[index] ?? null);
    const credito = parseAmount(credits[index] ?? null);

    if (!cuenta_contable_id && debito === 0 && credito === 0 && !descripcion) {
      continue;
    }

    if (!cuenta_contable_id) {
      throw new Error("Cada linea con monto debe tener cuenta contable.");
    }

    if ((debito > 0 && credito > 0) || (debito === 0 && credito === 0)) {
      throw new Error("Cada linea debe tener monto solo en debe o solo en haber.");
    }

    lineas.push({
      credito,
      cuenta_contable_id,
      debito,
      descripcion: descripcion || null,
    });
  }

  if (lineas.length < 2) {
    throw new Error("El asiento debe tener al menos dos lineas contables.");
  }

  const totalDebito = lineas.reduce((sum, linea) => sum + Number(linea.debito), 0);
  const totalCredito = lineas.reduce((sum, linea) => sum + Number(linea.credito), 0);

  if (Math.abs(totalDebito - totalCredito) > 0.004) {
    throw new Error("El asiento debe estar balanceado: debe y haber deben coincidir.");
  }

  return lineas;
}

function parseAsientoPayload(formData: FormData) {
  const fecha = getString(formData, "fecha");
  const descripcion = getString(formData, "descripcion");
  const moneda = getString(formData, "moneda") || "CRC";
  const nota = getNullableString(formData, "nota");
  const templateSourceId = getNullableString(formData, "templateSourceId");

  if (!fecha) {
    throw new Error("La fecha del asiento es obligatoria.");
  }

  if (!descripcion) {
    throw new Error("El nombre o descripcion del asiento es obligatorio.");
  }

  return {
    descripcion,
    fecha,
    metadata: {
      ...(nota ? { nota } : {}),
      ...(templateSourceId ? { template_source_id: templateSourceId } : {}),
    },
    modulo_origen: "manual",
    moneda,
    periodo: getNullableString(formData, "periodo"),
    referencia: getNullableString(formData, "referencia"),
    tipo_cambio: parseOptionalAmount(formData.get("tipoCambio")),
  };
}

function revalidateAsientos() {
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/asientos");
  revalidatePath("/contabilidad/asientos/manual");
  revalidatePath("/contabilidad/mayor");
  revalidatePath("/contabilidad/balance-comprobacion");
}

export async function saveManualAsientoAction(formData: FormData) {
  const asientoId = getString(formData, "asientoId");
  const redirectTo = getString(formData, "redirectTo") || "/contabilidad/asientos/manual";
  let target = redirectTo;

  try {
    const asientoPayload = parseAsientoPayload(formData);
    const lineas = parseLineas(formData);
    const asiento = asientoId
      ? await updateAsientoBorrador({ ...asientoPayload, id: asientoId })
      : await createAsientoBorrador(asientoPayload);

    await replaceLineasAsiento({
      asiento_id: asiento.id,
      lineas,
    });

    target = `/contabilidad/asientos/manual/${asiento.id}`;
  } catch (error) {
    target = redirectWithError(
      redirectTo,
      getErrorMessage(error, "No se pudo guardar el asiento manual."),
    );
  }

  revalidateAsientos();
  redirect(target);
}

export async function deleteManualAsientoAction(formData: FormData) {
  const asientoId = getString(formData, "asientoId");
  let target = "/contabilidad/asientos/manual";

  try {
    await deleteAsientoBorrador(asientoId);
  } catch (error) {
    target = redirectWithError(
      `/contabilidad/asientos/manual/${asientoId}`,
      getErrorMessage(error, "No se pudo eliminar el asiento."),
    );
  }

  revalidateAsientos();
  redirect(target);
}

export async function postManualAsientoAction(formData: FormData) {
  const asientoId = getString(formData, "asientoId");
  let target = `/contabilidad/asientos/${asientoId}`;

  try {
    await contabilizarAsiento(asientoId);
  } catch (error) {
    target = redirectWithError(
      `/contabilidad/asientos/manual/${asientoId}`,
      getErrorMessage(error, "No se pudo contabilizar el asiento."),
    );
  }

  revalidateAsientos();
  redirect(target);
}

export async function voidManualAsientoAction(formData: FormData) {
  const asientoId = getString(formData, "asientoId");
  const motivo = getString(formData, "motivoAnulacion");
  let target = `/contabilidad/asientos/${asientoId}`;

  try {
    await anularAsiento(asientoId, motivo);
  } catch (error) {
    target = redirectWithError(
      `/contabilidad/asientos/manual/${asientoId}`,
      getErrorMessage(error, "No se pudo anular el asiento."),
    );
  }

  revalidateAsientos();
  redirect(target);
}
