import { getActiveContext } from "@/lib/active-context";
import {
  getAsientoContableById,
  type AsientoContable,
} from "@/lib/asientos-contables";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type Subcontrato = {
  id: string;
  organization_id: string;
  company_id: string;
  nombre: string;
  subcontratista_nombre: string;
  counterparty_id: string | null;
  tipo_subcontrato: string;
  categoria_subcontrato: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  moneda: string;
  monto_total: number;
  monto_retencion_estimado: number;
  monto_pagado: number;
  centro_costo_id: string | null;
  presupuesto_id: string | null;
  estado_operativo: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type SubcontratoPago = {
  id: string;
  subcontrato_id: string;
  hito_id: string | null;
  organization_id: string;
  company_id: string;
  payment_method_id: string | null;
  numero_documento: string | null;
  fecha_pago: string;
  monto_bruto: number;
  monto_retencion: number;
  monto_neto: number;
  estado_operativo: string;
  asiento_contable_id: string | null;
  estado_contable: string | null;
  contabilizacion_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  subcontrato?: Subcontrato | null;
};

export type ReglaContableSubcontrato = {
  id: string;
  organization_id: string | null;
  tipo_subcontrato: string;
  categoria_subcontrato: string | null;
  cuenta_costo_subcontrato_id: string;
  cuenta_proveedor_id: string;
  cuenta_banco_id: string | null;
  cuenta_retenciones_id: string | null;
  requiere_centro_costo: boolean;
  prioridad: number;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type EstadoContableSubcontrato = {
  subcontratoPagoId: string;
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

async function getPagoById(subcontratoPagoId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("subcontratos_pagos")
    .select("*, subcontrato:subcontratos(*)")
    .eq("id", subcontratoPagoId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Pago de subcontrato no encontrado.");
  }

  return data as SubcontratoPago;
}

async function marcarPagoConError(subcontratoPagoId: string, message: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedContext();

  await supabase
    .from("subcontratos_pagos")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", subcontratoPagoId)
    .eq("organization_id", organization.id);
}

export async function obtenerReglaContableSubcontrato({
  categoriaSubcontrato,
  organizationId,
  tipoSubcontrato,
}: {
  categoriaSubcontrato?: string | null;
  organizationId?: string;
  tipoSubcontrato: string;
}) {
  const { organization } = await getValidatedContext();
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc(
    "obtener_regla_contable_subcontrato",
    {
      p_categoria_subcontrato: categoriaSubcontrato ?? null,
      p_organization_id: organizationId ?? organization.id,
      p_tipo_subcontrato: tipoSubcontrato,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReglaContableSubcontrato[])[0] ?? null;
}

export async function validarSubcontratoContabilizable(subcontratoPagoId: string) {
  const pago = await getPagoById(subcontratoPagoId);
  const subcontrato = pago.subcontrato;

  if (!subcontrato) {
    throw new Error("El pago requiere un subcontrato valido.");
  }

  if (!["aprobado", "en_ejecucion", "cerrado"].includes(subcontrato.estado_operativo)) {
    throw new Error("El subcontrato debe estar aprobado o en ejecucion.");
  }

  if (!["revisado", "aprobado", "pagado"].includes(pago.estado_operativo)) {
    throw new Error("El pago debe estar revisado, aprobado o pagado.");
  }

  if (Number(pago.monto_bruto ?? 0) <= 0) {
    throw new Error("El pago debe tener monto mayor a cero.");
  }

  const montoNeto = Number(pago.monto_neto ?? 0);
  const retencion = Number(pago.monto_retencion ?? 0);
  const bruto = Number(pago.monto_bruto ?? 0);

  if (Math.abs(montoNeto + retencion - bruto) >= 0.01) {
    throw new Error("El neto mas retenciones debe coincidir con el bruto.");
  }

  const regla = await obtenerReglaContableSubcontrato({
    categoriaSubcontrato: subcontrato.categoria_subcontrato,
    organizationId: pago.organization_id,
    tipoSubcontrato: subcontrato.tipo_subcontrato,
  });

  if (!regla) {
    throw new Error("No existe regla contable activa para este subcontrato.");
  }

  return { pago, regla, subcontrato };
}

export async function generarAsientoSubcontrato(subcontratoPagoId: string) {
  try {
    await validarSubcontratoContabilizable(subcontratoPagoId);

    const { supabase } = await getAuthenticatedSupabase();
    const { data, error } = await supabase.rpc("generar_asiento_subcontrato", {
      p_subcontrato_pago_id: subcontratoPagoId,
    });

    if (error || !data) {
      throw new Error(
        error?.message ?? "No se pudo generar el asiento de subcontrato.",
      );
    }

    return data as AsientoContable;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el asiento de subcontrato.";
    await marcarPagoConError(subcontratoPagoId, message).catch(() => undefined);
    throw error;
  }
}

export async function revertirAsientoSubcontrato(
  subcontratoPagoId: string,
  motivo = "Reversion contable de subcontrato",
) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedContext();

  const { data, error } = await supabase.rpc("revertir_asiento_subcontrato", {
    p_motivo: motivo,
    p_subcontrato_pago_id: subcontratoPagoId,
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo revertir el asiento de subcontrato.",
    );
  }

  return data as AsientoContable;
}

export async function obtenerEstadoContableSubcontrato(
  subcontratoPagoId: string,
): Promise<EstadoContableSubcontrato> {
  const pago = await getPagoById(subcontratoPagoId);
  let asiento: AsientoContable | null = null;

  if (pago.asiento_contable_id) {
    asiento = await getAsientoContableById(pago.asiento_contable_id)
      .then((result) => result.asiento)
      .catch(() => null);
  }

  return {
    asiento,
    asientoContableId: pago.asiento_contable_id ?? null,
    error: pago.contabilizacion_error ?? null,
    estadoContable: pago.estado_contable ?? "pendiente",
    subcontratoPagoId: pago.id,
  };
}

export async function getSubcontractsForActiveCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const { activeContext, company, organization } = await getValidatedContext();
  const subcontracts = await supabase
    .from("subcontratos")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (subcontracts.error) {
    throw new Error(subcontracts.error.message);
  }

  const payments = await supabase
    .from("subcontratos_pagos")
    .select("*, subcontrato:subcontratos(*)")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .order("fecha_pago", { ascending: false })
    .limit(80);

  if (payments.error) {
    throw new Error(payments.error.message);
  }

  return {
    activeContext,
    payments: (payments.data ?? []) as SubcontratoPago[],
    subcontracts: (subcontracts.data ?? []) as Subcontrato[],
  };
}
