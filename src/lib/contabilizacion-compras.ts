import { getActiveContext } from "@/lib/active-context";
import {
  getAsientoContableById,
  type AsientoContable,
} from "@/lib/asientos-contables";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { assertInternalUser } from "@/lib/permissions";
import { type Purchase } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

export type ReglaContableCompra = {
  id: string;
  organization_id: string | null;
  categoria_compra: string;
  cuenta_debito_id: string;
  cuenta_credito_id: string | null;
  cuenta_iva_id: string | null;
  requiere_centro_costo: boolean;
  activa: boolean;
  prioridad: number;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type EstadoContableCompra = {
  purchaseId: string;
  estadoContable: string;
  asientoContableId: string | null;
  error: string | null;
  asiento: AsientoContable | null;
};

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuario no autenticado.");
  }

  return { supabase, user };
}

async function getValidatedOrganization() {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const organization = activeContext.organization;

  if (!organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return organization;
}

async function getPurchaseById(compraId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const organization = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", compraId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Compra no encontrada.");
  }

  return data as Purchase;
}

async function marcarCompraConError(compraId: string, message: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const organization = await getValidatedOrganization();

  await supabase
    .from("purchases")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", compraId)
    .eq("organization_id", organization.id);
}

export async function obtenerReglaContableCompra({
  categoriaCompra,
  organizationId,
}: {
  categoriaCompra: string | null | undefined;
  organizationId?: string;
}) {
  const organization = await getValidatedOrganization();
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("obtener_regla_contable_compra", {
    p_categoria_compra: categoriaCompra ?? "",
    p_organization_id: organizationId ?? organization.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReglaContableCompra[])[0] ?? null;
}

export async function validarCompraContabilizable(compraId: string) {
  const purchase = await getPurchaseById(compraId);
  const reviewStatus = normalizeReviewStatus(purchase.review_status);

  if (reviewStatus !== "reviewed" && reviewStatus !== "approved") {
    throw new Error("La compra debe estar revisada o aprobada.");
  }

  if (!purchase.counterparty_id && !purchase.supplier_name?.trim()) {
    throw new Error("La compra requiere proveedor o contraparte valida.");
  }

  if (!purchase.category?.trim()) {
    throw new Error("La compra requiere categoria contable.");
  }

  if (Number(purchase.total ?? 0) <= 0) {
    throw new Error("La compra debe tener monto mayor a cero.");
  }

  const regla = await obtenerReglaContableCompra({
    categoriaCompra: purchase.category,
    organizationId: purchase.organization_id,
  });

  if (!regla) {
    throw new Error("No existe regla contable activa para esta categoria.");
  }

  return { purchase, regla };
}

export async function generarAsientoCompra(compraId: string) {
  try {
    await validarCompraContabilizable(compraId);

    const { supabase } = await getAuthenticatedSupabase();
    const { data, error } = await supabase.rpc("generar_asiento_compra", {
      p_compra_id: compraId,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo generar el asiento de compra.");
    }

    return data as AsientoContable;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el asiento de compra.";
    await marcarCompraConError(compraId, message).catch(() => undefined);
    throw error;
  }
}

export async function revertirAsientoCompra(
  compraId: string,
  motivo = "Reversion contable de compra",
) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedOrganization();

  const { data, error } = await supabase.rpc("revertir_asiento_compra", {
    p_compra_id: compraId,
    p_motivo: motivo,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo revertir el asiento de compra.");
  }

  return data as AsientoContable;
}

export async function obtenerEstadoContableCompra(
  compraId: string,
): Promise<EstadoContableCompra> {
  const purchase = await getPurchaseById(compraId);
  let asiento: AsientoContable | null = null;

  if (purchase.asiento_contable_id) {
    asiento = await getAsientoContableById(purchase.asiento_contable_id)
      .then((result) => result.asiento)
      .catch(() => null);
  }

  return {
    asiento,
    asientoContableId: purchase.asiento_contable_id ?? null,
    error: purchase.contabilizacion_error ?? null,
    estadoContable: purchase.estado_contable ?? "pendiente",
    purchaseId: purchase.id,
  };
}
