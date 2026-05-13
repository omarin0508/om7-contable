import {
  getAsientoContableById,
  type AsientoContable,
} from "@/lib/asientos-contables";
import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { type InvoiceCollection, type PurchasePayment } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export type MovimientoCajaEstadoContable = {
  movimientoId: string;
  estadoContable: string;
  asientoContableId: string | null;
  error: string | null;
  asiento: AsientoContable | null;
  tipo: "cobro" | "pago" | "transferencia";
};

export type ReglaContableCaja = {
  id: string;
  organization_id: string | null;
  tipo_movimiento: string;
  categoria_movimiento: string | null;
  cuenta_caja_banco_id: string;
  cuenta_contrapartida_id: string;
  cuenta_iva_id: string | null;
  requiere_centro_costo: boolean;
  prioridad: number;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
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

async function getValidatedContext() {
  await assertInternalUser();
  const activeContext = await getActiveContext();
  const organization = activeContext.organization;
  const company = activeContext.activeCompany;

  if (!organization || !company) {
    throw new Error("Selecciona una organizacion y empresa activa.");
  }

  return { activeContext, company, organization };
}

async function markMovementWithError(movementId: string, message: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedContext();

  await supabase
    .from("purchase_payments")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", movementId)
    .eq("organization_id", organization.id);

  await supabase
    .from("invoice_collections")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", movementId)
    .eq("organization_id", organization.id);

  await supabase
    .from("cash_bank_transfers")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", movementId)
    .eq("organization_id", organization.id);
}

export async function obtenerReglaContableCaja({
  categoriaMovimiento,
  organizationId,
  tipoMovimiento,
}: {
  categoriaMovimiento?: string | null;
  organizationId?: string;
  tipoMovimiento: string;
}) {
  const { organization } = await getValidatedContext();
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("obtener_regla_contable_caja", {
    p_categoria_movimiento: categoriaMovimiento ?? null,
    p_organization_id: organizationId ?? organization.id,
    p_tipo_movimiento: tipoMovimiento,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReglaContableCaja[])[0] ?? null;
}

export async function validarMovimientoCajaContabilizable(movementId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const purchasePayment = await supabase
    .from("purchase_payments")
    .select("*, payment_method:payment_methods(*)")
    .eq("id", movementId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (purchasePayment.error) {
    throw new Error(purchasePayment.error.message);
  }

  if (purchasePayment.data) {
    if (Number(purchasePayment.data.amount ?? 0) <= 0) {
      throw new Error("El pago debe tener monto mayor a cero.");
    }

    if (!purchasePayment.data.payment_method) {
      throw new Error("El pago requiere metodo de caja/banco.");
    }

    const type = String(purchasePayment.data.payment_method.type ?? "");
    if (!["cash", "bank", "card", "transfer"].includes(type)) {
      throw new Error("El metodo seleccionado no representa caja o banco.");
    }

    const regla = await obtenerReglaContableCaja({
      categoriaMovimiento: "pago_compra",
      organizationId: organization.id,
      tipoMovimiento: "egreso",
    });

    if (!regla) {
      throw new Error("No existe regla contable activa para pagos de compra.");
    }

    return { movimiento: purchasePayment.data as PurchasePayment, regla, tipo: "pago" };
  }

  const invoiceCollection = await supabase
    .from("invoice_collections")
    .select("*, payment_method:payment_methods(*)")
    .eq("id", movementId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (invoiceCollection.error) {
    throw new Error(invoiceCollection.error.message);
  }

  if (invoiceCollection.data) {
    if (Number(invoiceCollection.data.amount ?? 0) <= 0) {
      throw new Error("El cobro debe tener monto mayor a cero.");
    }

    if (!invoiceCollection.data.payment_method) {
      throw new Error("El cobro requiere metodo de caja/banco.");
    }

    const type = String(invoiceCollection.data.payment_method.type ?? "");
    if (!["cash", "bank", "card", "transfer"].includes(type)) {
      throw new Error("El metodo seleccionado no representa caja o banco.");
    }

    const regla = await obtenerReglaContableCaja({
      categoriaMovimiento: "cobro_factura",
      organizationId: organization.id,
      tipoMovimiento: "ingreso",
    });

    if (!regla) {
      throw new Error("No existe regla contable activa para cobros de factura.");
    }

    return {
      movimiento: invoiceCollection.data as InvoiceCollection,
      regla,
      tipo: "cobro",
    };
  }

  const transfer = await supabase
    .from("cash_bank_transfers")
    .select("*")
    .eq("id", movementId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (transfer.error) {
    throw new Error(transfer.error.message);
  }

  if (transfer.data) {
    if (Number(transfer.data.amount ?? 0) <= 0) {
      throw new Error("La transferencia debe tener monto mayor a cero.");
    }

    const regla = await obtenerReglaContableCaja({
      categoriaMovimiento: transfer.data.categoria_movimiento ?? "transferencia",
      organizationId: organization.id,
      tipoMovimiento: "transferencia",
    });

    if (!regla) {
      throw new Error("No existe regla contable activa para transferencias.");
    }

    return { movimiento: transfer.data, regla, tipo: "transferencia" };
  }

  throw new Error("Movimiento de caja/banco no encontrado.");
}

export async function generarAsientoMovimientoCaja(movementId: string) {
  try {
    await validarMovimientoCajaContabilizable(movementId);

    const { supabase } = await getAuthenticatedSupabase();
    const { data, error } = await supabase.rpc("generar_asiento_movimiento_caja", {
      p_movimiento_id: movementId,
    });

    if (error || !data) {
      throw new Error(
        error?.message ?? "No se pudo generar el asiento de caja/banco.",
      );
    }

    return data as AsientoContable;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el asiento de caja/banco.";
    await markMovementWithError(movementId, message).catch(() => undefined);
    throw error;
  }
}

export async function revertirAsientoMovimientoCaja(
  movementId: string,
  motivo = "Reversion contable de movimiento de caja",
) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedContext();

  const { data, error } = await supabase.rpc("revertir_asiento_movimiento_caja", {
    p_motivo: motivo,
    p_movimiento_id: movementId,
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo revertir el asiento de caja/banco.",
    );
  }

  return data as AsientoContable;
}

export async function obtenerEstadoContableMovimientoCaja(
  movementId: string,
): Promise<MovimientoCajaEstadoContable> {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const tables = [
    {
      name: "purchase_payments",
      tipo: "pago" as const,
    },
    {
      name: "invoice_collections",
      tipo: "cobro" as const,
    },
    {
      name: "cash_bank_transfers",
      tipo: "transferencia" as const,
    },
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name)
      .select("id,asiento_contable_id,estado_contable,contabilizacion_error")
      .eq("id", movementId)
      .eq("organization_id", organization.id)
      .eq("company_id", company.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      let asiento: AsientoContable | null = null;
      const asientoContableId = data.asiento_contable_id ?? null;

      if (asientoContableId) {
        asiento = await getAsientoContableById(asientoContableId)
          .then((result) => result.asiento)
          .catch(() => null);
      }

      return {
        asiento,
        asientoContableId,
        error: data.contabilizacion_error ?? null,
        estadoContable: data.estado_contable ?? "pendiente",
        movimientoId: movementId,
        tipo: table.tipo,
      };
    }
  }

  throw new Error("Movimiento de caja/banco no encontrado.");
}
