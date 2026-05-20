import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { CuentaContable } from "@/lib/cuentas-contables";

export type AsientoEstado = "borrador" | "contabilizado" | "anulado";

export type AsientoContable = {
  id: string;
  organization_id: string;
  fecha: string;
  periodo: string | null;
  numero_asiento: number;
  descripcion: string;
  referencia: string | null;
  modulo_origen: string | null;
  documento_origen_id: string | null;
  estado: AsientoEstado | string;
  moneda: string;
  tipo_cambio: number | null;
  total_debito: number;
  total_credito: number;
  creado_por: string | null;
  contabilizado_por: string | null;
  contabilizado_at: string | null;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  lineas?: AsientoLinea[];
};

export type AsientoLinea = {
  id: string;
  asiento_id: string;
  organization_id: string;
  cuenta_contable_id: string;
  descripcion: string | null;
  tercero_id: string | null;
  centro_costo_id: string | null;
  presupuesto_id: string | null;
  documento_origen_id: string | null;
  debito: number;
  credito: number;
  moneda: string;
  tipo_cambio: number | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  cuenta?: CuentaContable | null;
};

export type CreateAsientoBorradorPayload = {
  fecha: string;
  descripcion: string;
  periodo?: string | null;
  referencia?: string | null;
  modulo_origen?: string | null;
  documento_origen_id?: string | null;
  moneda?: string;
  tipo_cambio?: number | null;
  metadata?: Record<string, unknown>;
};

export type AddLineaAsientoPayload = {
  asiento_id: string;
  cuenta_contable_id: string;
  descripcion?: string | null;
  tercero_id?: string | null;
  centro_costo_id?: string | null;
  presupuesto_id?: string | null;
  documento_origen_id?: string | null;
  debito?: number;
  credito?: number;
  moneda?: string;
  tipo_cambio?: number | null;
  metadata?: Record<string, unknown>;
};

export type UpdateAsientoBorradorPayload = CreateAsientoBorradorPayload & {
  id: string;
};

export type ReplaceLineasAsientoPayload = {
  asiento_id: string;
  lineas: Omit<AddLineaAsientoPayload, "asiento_id">[];
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

  return { activeContext, organization };
}

async function fetchLineasForAsientos(asientoIds: string[]) {
  if (asientoIds.length === 0) {
    return new Map<string, AsientoLinea[]>();
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("asiento_lineas")
    .select("*, cuenta:cuentas_contables(*)")
    .in("asiento_id", asientoIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AsientoLinea[]).reduce((map, line) => {
    const current = map.get(line.asiento_id) ?? [];
    current.push(line);
    map.set(line.asiento_id, current);
    return map;
  }, new Map<string, AsientoLinea[]>());
}

export async function getAsientosContables() {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("asientos_contables")
    .select("*")
    .eq("organization_id", organization.id)
    .order("fecha", { ascending: false })
    .order("numero_asiento", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const asientos = (data ?? []) as AsientoContable[];
  const lineasByAsiento = await fetchLineasForAsientos(
    asientos.map((asiento) => asiento.id),
  );

  return {
    asientos: asientos.map((asiento) => ({
      ...asiento,
      lineas: lineasByAsiento.get(asiento.id) ?? [],
    })),
    organization,
  };
}

export async function getAsientoContableById(id: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("asientos_contables")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Asiento no encontrado.");
  }

  const lineasByAsiento = await fetchLineasForAsientos([id]);

  return {
    asiento: {
      ...(data as AsientoContable),
      lineas: lineasByAsiento.get(id) ?? [],
    },
    organization,
  };
}

export async function createAsientoBorrador(payload: CreateAsientoBorradorPayload) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("asientos_contables")
    .insert({
      creado_por: user.id,
      descripcion: payload.descripcion,
      documento_origen_id: payload.documento_origen_id ?? null,
      estado: "borrador",
      fecha: payload.fecha,
      metadata: payload.metadata ?? {},
      modulo_origen: payload.modulo_origen ?? "manual",
      moneda: payload.moneda ?? organization.base_currency ?? "CRC",
      organization_id: organization.id,
      periodo: payload.periodo ?? null,
      referencia: payload.referencia ?? null,
      tipo_cambio: payload.tipo_cambio ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el asiento.");
  }

  return data as AsientoContable;
}

export async function addLineaAsiento(payload: AddLineaAsientoPayload) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("asiento_lineas")
    .insert({
      asiento_id: payload.asiento_id,
      centro_costo_id: payload.centro_costo_id ?? null,
      credito: payload.credito ?? 0,
      cuenta_contable_id: payload.cuenta_contable_id,
      debito: payload.debito ?? 0,
      descripcion: payload.descripcion ?? null,
      documento_origen_id: payload.documento_origen_id ?? null,
      metadata: payload.metadata ?? {},
      moneda: payload.moneda ?? organization.base_currency ?? "CRC",
      organization_id: organization.id,
      presupuesto_id: payload.presupuesto_id ?? null,
      tercero_id: payload.tercero_id ?? null,
      tipo_cambio: payload.tipo_cambio ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo agregar la linea.");
  }

  return data as AsientoLinea;
}

export async function updateAsientoBorrador(
  payload: UpdateAsientoBorradorPayload,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data, error } = await supabase
    .from("asientos_contables")
    .update({
      descripcion: payload.descripcion,
      documento_origen_id: payload.documento_origen_id ?? null,
      fecha: payload.fecha,
      metadata: payload.metadata ?? {},
      modulo_origen: payload.modulo_origen ?? "manual",
      moneda: payload.moneda ?? organization.base_currency ?? "CRC",
      periodo: payload.periodo ?? null,
      referencia: payload.referencia ?? null,
      tipo_cambio: payload.tipo_cambio ?? null,
    })
    .eq("id", payload.id)
    .eq("organization_id", organization.id)
    .eq("estado", "borrador")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el asiento.");
  }

  return data as AsientoContable;
}

export async function replaceLineasAsiento(payload: ReplaceLineasAsientoPayload) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { data: asiento, error: asientoError } = await supabase
    .from("asientos_contables")
    .select("id, estado, organization_id")
    .eq("id", payload.asiento_id)
    .eq("organization_id", organization.id)
    .single();

  if (asientoError || !asiento) {
    throw new Error(asientoError?.message ?? "Asiento no encontrado.");
  }

  if (String(asiento.estado) !== "borrador") {
    throw new Error("Solo se pueden editar lineas de asientos en borrador.");
  }

  const { error: deleteError } = await supabase
    .from("asiento_lineas")
    .delete()
    .eq("asiento_id", payload.asiento_id)
    .eq("organization_id", organization.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (payload.lineas.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("asiento_lineas")
    .insert(
      payload.lineas.map((linea) => ({
        asiento_id: payload.asiento_id,
        centro_costo_id: linea.centro_costo_id ?? null,
        credito: linea.credito ?? 0,
        cuenta_contable_id: linea.cuenta_contable_id,
        debito: linea.debito ?? 0,
        descripcion: linea.descripcion ?? null,
        documento_origen_id: linea.documento_origen_id ?? null,
        metadata: linea.metadata ?? {},
        moneda: linea.moneda ?? organization.base_currency ?? "CRC",
        organization_id: organization.id,
        presupuesto_id: linea.presupuesto_id ?? null,
        tercero_id: linea.tercero_id ?? null,
        tipo_cambio: linea.tipo_cambio ?? null,
      })),
    )
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AsientoLinea[];
}

export async function deleteAsientoBorrador(id: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedOrganization();
  const { error } = await supabase
    .from("asientos_contables")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id)
    .eq("estado", "borrador");

  if (error) {
    throw new Error(error.message);
  }
}

export async function contabilizarAsiento(id: string) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedOrganization();

  const { data, error } = await supabase.rpc("contabilizar_asiento", {
    p_asiento_id: id,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo contabilizar el asiento.");
  }

  return data as AsientoContable;
}

export async function anularAsiento(id: string, motivo: string) {
  const { supabase } = await getAuthenticatedSupabase();
  await getValidatedOrganization();

  const { data, error } = await supabase.rpc("anular_asiento", {
    p_asiento_id: id,
    p_motivo: motivo,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo anular el asiento.");
  }

  return data as AsientoContable;
}
