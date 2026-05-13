import { getActiveContext } from "@/lib/active-context";
import {
  getAsientoContableById,
  type AsientoContable,
} from "@/lib/asientos-contables";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type Planilla = {
  id: string;
  organization_id: string;
  company_id: string;
  nombre: string;
  tipo_planilla: string;
  clasificacion_laboral: string | null;
  periodo_desde: string;
  periodo_hasta: string;
  fecha_pago: string | null;
  moneda: string;
  total_salarios: number;
  total_cargas_sociales: number;
  total_retenciones: number;
  total_obligaciones: number;
  total_neto_pagar: number;
  payment_method_id: string | null;
  centro_costo_id: string | null;
  presupuesto_id: string | null;
  estado_operativo: string;
  asiento_contable_id: string | null;
  estado_contable: string | null;
  contabilizacion_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type ReglaContablePlanilla = {
  id: string;
  organization_id: string | null;
  tipo_planilla: string;
  clasificacion_laboral: string | null;
  cuenta_gasto_salarios_id: string;
  cuenta_cargas_sociales_id: string | null;
  cuenta_banco_id: string | null;
  cuenta_obligaciones_id: string | null;
  requiere_centro_costo: boolean;
  prioridad: number;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type EstadoContablePlanilla = {
  planillaId: string;
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

async function getPlanillaById(planillaId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("planillas")
    .select("*")
    .eq("id", planillaId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Planilla no encontrada.");
  }

  return data as Planilla;
}

async function marcarPlanillaConError(planillaId: string, message: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedContext();

  await supabase
    .from("planillas")
    .update({
      contabilizacion_error: message,
      estado_contable: "error",
    })
    .eq("id", planillaId)
    .eq("organization_id", organization.id);
}

export async function obtenerReglaContablePlanilla({
  clasificacionLaboral,
  organizationId,
  tipoPlanilla,
}: {
  clasificacionLaboral?: string | null;
  organizationId?: string;
  tipoPlanilla: string;
}) {
  const { organization } = await getValidatedContext();
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("obtener_regla_contable_planilla", {
    p_clasificacion_laboral: clasificacionLaboral ?? null,
    p_organization_id: organizationId ?? organization.id,
    p_tipo_planilla: tipoPlanilla,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ReglaContablePlanilla[])[0] ?? null;
}

export async function validarPlanillaContabilizable(planillaId: string) {
  const planilla = await getPlanillaById(planillaId);

  if (!["revisada", "aprobada", "pagada"].includes(planilla.estado_operativo)) {
    throw new Error("La planilla debe estar revisada, aprobada o pagada.");
  }

  if (Number(planilla.total_salarios ?? 0) <= 0) {
    throw new Error("La planilla debe tener salarios mayores a cero.");
  }

  if (planilla.periodo_hasta < planilla.periodo_desde) {
    throw new Error("La planilla tiene un rango de fechas invalido.");
  }

  const regla = await obtenerReglaContablePlanilla({
    clasificacionLaboral: planilla.clasificacion_laboral,
    organizationId: planilla.organization_id,
    tipoPlanilla: planilla.tipo_planilla,
  });

  if (!regla) {
    throw new Error("No existe regla contable activa para esta planilla.");
  }

  return { planilla, regla };
}

export async function generarAsientoPlanilla(planillaId: string) {
  try {
    await validarPlanillaContabilizable(planillaId);

    const { supabase } = await getAuthenticatedSupabase();
    const { data, error } = await supabase.rpc("generar_asiento_planilla", {
      p_planilla_id: planillaId,
    });

    if (error || !data) {
      throw new Error(
        error?.message ?? "No se pudo generar el asiento de planilla.",
      );
    }

    return data as AsientoContable;
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "No se pudo generar el asiento de planilla.";
    await marcarPlanillaConError(planillaId, message).catch(() => undefined);
    throw error;
  }
}

export async function revertirAsientoPlanilla(
  planillaId: string,
  motivo = "Reversion contable de planilla",
) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedContext();

  const { data, error } = await supabase.rpc("revertir_asiento_planilla", {
    p_motivo: motivo,
    p_planilla_id: planillaId,
  });

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo revertir el asiento de planilla.",
    );
  }

  return data as AsientoContable;
}

export async function obtenerEstadoContablePlanilla(
  planillaId: string,
): Promise<EstadoContablePlanilla> {
  const planilla = await getPlanillaById(planillaId);
  let asiento: AsientoContable | null = null;

  if (planilla.asiento_contable_id) {
    asiento = await getAsientoContableById(planilla.asiento_contable_id)
      .then((result) => result.asiento)
      .catch(() => null);
  }

  return {
    asiento,
    asientoContableId: planilla.asiento_contable_id ?? null,
    error: planilla.contabilizacion_error ?? null,
    estadoContable: planilla.estado_contable ?? "pendiente",
    planillaId: planilla.id,
  };
}

export async function getPlanillasForActiveCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const { activeContext, company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("planillas")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .order("periodo_hasta", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeContext,
    planillas: (data ?? []) as Planilla[],
  };
}
