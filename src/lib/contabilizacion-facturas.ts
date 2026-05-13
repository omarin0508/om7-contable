import { getActiveContext } from "@/lib/active-context";
import {
  getAsientoContableById,
  type AsientoContable,
} from "@/lib/asientos-contables";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { type Invoice } from "@/lib/invoices";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type ReglaContableFactura = {
  id: string;
  organization_id: string | null;
  categoria_factura: string;
  cuenta_clientes_id: string;
  cuenta_ingreso_id: string;
  cuenta_iva_debito_id: string | null;
  requiere_centro_costo: boolean;
  prioridad: number;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type EstadoContableFactura = {
  invoiceId: string;
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

async function getInvoiceById(invoiceId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const organization = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Factura no encontrada.");
  }

  return data as Invoice;
}

async function marcarFacturaConError(invoiceId: string, message: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const organization = await getValidatedOrganization();

  await supabase
    .from("invoices")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", invoiceId)
    .eq("organization_id", organization.id);
}

export async function obtenerReglaContableFactura({
  categoriaFactura,
  organizationId,
}: {
  categoriaFactura: string | null | undefined;
  organizationId?: string;
}) {
  const organization = await getValidatedOrganization();
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("obtener_regla_contable_factura", {
    p_categoria_factura: categoriaFactura || "factura",
    p_organization_id: organizationId ?? organization.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReglaContableFactura[])[0] ?? null;
}

export async function validarFacturaContabilizable(invoiceId: string) {
  const invoice = await getInvoiceById(invoiceId);
  const reviewStatus = normalizeReviewStatus(invoice.review_status);

  if (reviewStatus !== "reviewed" && reviewStatus !== "approved") {
    throw new Error("La factura debe estar revisada o aprobada.");
  }

  if (!invoice.counterparty_id && !invoice.proveedor?.trim()) {
    throw new Error("La factura requiere cliente o contraparte valida.");
  }

  if (Number(invoice.total ?? 0) <= 0) {
    throw new Error("La factura debe tener monto mayor a cero.");
  }

  const regla = await obtenerReglaContableFactura({
    categoriaFactura: invoice.tipo_documento || "factura",
    organizationId: invoice.organization_id,
  });

  if (!regla) {
    throw new Error("No existe regla contable activa para esta factura.");
  }

  return { invoice, regla };
}

export async function generarAsientoFactura(invoiceId: string) {
  try {
    await validarFacturaContabilizable(invoiceId);

    const { supabase } = await getAuthenticatedSupabase();
    const { data, error } = await supabase.rpc("generar_asiento_factura", {
      p_factura_id: invoiceId,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo generar el asiento de factura.");
    }

    return data as AsientoContable;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el asiento de factura.";
    await marcarFacturaConError(invoiceId, message).catch(() => undefined);
    throw error;
  }
}

export async function revertirAsientoFactura(
  invoiceId: string,
  motivo = "Reversion contable de factura",
) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedOrganization();

  const { data, error } = await supabase.rpc("revertir_asiento_factura", {
    p_factura_id: invoiceId,
    p_motivo: motivo,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo revertir el asiento de factura.");
  }

  return data as AsientoContable;
}

export async function obtenerEstadoContableFactura(
  invoiceId: string,
): Promise<EstadoContableFactura> {
  const invoice = await getInvoiceById(invoiceId);
  let asiento: AsientoContable | null = null;

  if (invoice.asiento_contable_id) {
    asiento = await getAsientoContableById(invoice.asiento_contable_id)
      .then((result) => result.asiento)
      .catch(() => null);
  }

  return {
    asiento,
    asientoContableId: invoice.asiento_contable_id ?? null,
    error: invoice.contabilizacion_error ?? null,
    estadoContable: invoice.estado_contable ?? "pendiente",
    invoiceId: invoice.id,
  };
}
