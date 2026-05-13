import { getActiveContext } from "@/lib/active-context";
import { normalizeCurrencyCode } from "@/lib/currency";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CierreContableEstado =
  | "abierto"
  | "en_revision"
  | "cerrado"
  | "reabierto"
  | string;

export type CierreItemSeveridad = "info" | "warning" | "error" | "ok" | string;
export type CierreItemEstado =
  | "pendiente"
  | "revisado"
  | "resuelto"
  | "ignorado"
  | string;

export type CierreContable = {
  id: string;
  organization_id: string;
  periodo: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: CierreContableEstado;
  resumen: Record<string, unknown> | null;
  cerrado_por: string | null;
  cerrado_at: string | null;
  reabierto_por: string | null;
  reabierto_at: string | null;
  motivo_reapertura: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CierreContableItem = {
  id: string;
  cierre_id: string;
  organization_id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  severidad: CierreItemSeveridad;
  estado: CierreItemEstado;
  referencia_tipo: string | null;
  referencia_id: string | null;
  metadata: Record<string, unknown> | null;
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CierreContableResumenItems = {
  total: number;
  pendientes: number;
  errores: number;
  warnings: number;
  revisados: number;
  resueltos: number;
  ignorados: number;
};

export type CierreContableContext = {
  organizationId: string;
  organizationName: string;
  moneda: string;
};

export type GenerarChecklistCierreParams = {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  organizationId?: string;
};

type CierreWithSummary = CierreContable & {
  itemsResumen: CierreContableResumenItems;
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

  return supabase;
}

async function resolveContext(
  organizationId?: string,
): Promise<CierreContableContext> {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const resolvedOrganizationId =
    organizationId ?? activeContext.organization?.id ?? null;

  if (!resolvedOrganizationId) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return {
    moneda: normalizeCurrencyCode(
      activeContext.activeCompany?.base_currency ??
        activeContext.organization?.base_currency ??
        "CRC",
    ),
    organizationId: resolvedOrganizationId,
    organizationName:
      activeContext.organization?.id === resolvedOrganizationId
        ? activeContext.organization.name
        : "Organizacion OM7",
  };
}

function summarizeItems(
  items: CierreContableItem[],
): CierreContableResumenItems {
  return {
    errores: items.filter((item) => item.severidad === "error").length,
    ignorados: items.filter((item) => item.estado === "ignorado").length,
    pendientes: items.filter((item) => item.estado === "pendiente").length,
    resueltos: items.filter((item) => item.estado === "resuelto").length,
    revisados: items.filter((item) => item.estado === "revisado").length,
    total: items.length,
    warnings: items.filter((item) => item.severidad === "warning").length,
  };
}

export function getCierreEstadoLabel(status: string | null | undefined) {
  if (status === "cerrado") {
    return "Cerrado";
  }

  if (status === "en_revision") {
    return "En revision";
  }

  if (status === "reabierto") {
    return "Reabierto";
  }

  return "Abierto";
}

export function getItemEstadoLabel(status: string | null | undefined) {
  if (status === "revisado") {
    return "Revisado";
  }

  if (status === "resuelto") {
    return "Resuelto";
  }

  if (status === "ignorado") {
    return "Ignorado";
  }

  return "Pendiente";
}

export function getItemSeveridadLabel(
  severidad: string | null | undefined,
) {
  if (severidad === "error") {
    return "Error";
  }

  if (severidad === "warning") {
    return "Atencion";
  }

  if (severidad === "ok") {
    return "OK";
  }

  return "Info";
}

export async function getCierresContables(organizationId?: string) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(organizationId);

  const { data: cierresData, error: cierresError } = await supabase
    .from("cierres_contables")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("fecha_inicio", { ascending: false })
    .order("created_at", { ascending: false });

  if (cierresError) {
    throw new Error(cierresError.message);
  }

  const cierres = (cierresData ?? []) as CierreContable[];
  const cierreIds = cierres.map((cierre) => cierre.id);
  const { data: itemsData, error: itemsError } =
    cierreIds.length > 0
      ? await supabase
          .from("cierre_contable_items")
          .select("*")
          .eq("organization_id", context.organizationId)
          .in("cierre_id", cierreIds)
      : { data: [], error: null };

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const items = (itemsData ?? []) as CierreContableItem[];
  const cierresConResumen = cierres.map((cierre) => {
    const cierreItems = items.filter((item) => item.cierre_id === cierre.id);

    return {
      ...cierre,
      itemsResumen: summarizeItems(cierreItems),
    };
  });

  return {
    cierres: cierresConResumen as CierreWithSummary[],
    context,
  };
}

export async function getCierreContableById(id: string) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext();

  const { data: cierreData, error: cierreError } = await supabase
    .from("cierres_contables")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .single();

  if (cierreError || !cierreData) {
    throw new Error(cierreError?.message ?? "Cierre contable no encontrado.");
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from("cierre_contable_items")
    .select("*")
    .eq("cierre_id", id)
    .eq("organization_id", context.organizationId)
    .order("severidad", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const items = (itemsData ?? []) as CierreContableItem[];

  return {
    cierre: cierreData as CierreContable,
    context,
    items,
    itemsResumen: summarizeItems(items),
  };
}

export async function generarChecklistCierre(
  params: GenerarChecklistCierreParams,
) {
  const supabase = await getAuthenticatedSupabase();
  const context = await resolveContext(params.organizationId);
  const { data, error } = await supabase.rpc(
    "generar_checklist_cierre_contable",
    {
      p_fecha_fin: params.fechaFin,
      p_fecha_inicio: params.fechaInicio,
      p_organization_id: context.organizationId,
      p_periodo: params.periodo,
    },
  );

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo generar el checklist.");
  }

  return data as CierreContable;
}

export async function marcarItemCierre(
  itemId: string,
  estado: CierreItemEstado,
  motivo?: string,
) {
  const supabase = await getAuthenticatedSupabase();
  await resolveContext();
  const cleanMotivo = motivo?.trim();

  if (estado === "ignorado" && cleanMotivo) {
    const { data: currentItem, error: currentError } = await supabase
      .from("cierre_contable_items")
      .select("metadata")
      .eq("id", itemId)
      .single();

    if (currentError || !currentItem) {
      throw new Error(currentError?.message ?? "Item de cierre no encontrado.");
    }

    const currentMetadata =
      typeof currentItem.metadata === "object" && currentItem.metadata
        ? (currentItem.metadata as Record<string, unknown>)
        : {};

    const { error: metadataError } = await supabase
      .from("cierre_contable_items")
      .update({
        metadata: {
          ...currentMetadata,
          motivo_ignorado: cleanMotivo,
        },
      })
      .eq("id", itemId);

    if (metadataError) {
      throw new Error(metadataError.message);
    }
  }

  const { data, error } = await supabase.rpc("marcar_item_cierre", {
    p_estado: estado,
    p_item_id: itemId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el item.");
  }

  return data as CierreContableItem;
}

export async function cerrarPeriodoContable(cierreId: string) {
  const supabase = await getAuthenticatedSupabase();
  await resolveContext();
  const { data, error } = await supabase.rpc("cerrar_periodo_contable", {
    p_cierre_id: cierreId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo cerrar el periodo.");
  }

  return data as CierreContable;
}

export async function reabrirPeriodoContable(
  cierreId: string,
  motivo: string,
) {
  const supabase = await getAuthenticatedSupabase();
  await resolveContext();
  const { data, error } = await supabase.rpc("reabrir_periodo_contable", {
    p_cierre_id: cierreId,
    p_motivo: motivo,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo reabrir el periodo.");
  }

  return data as CierreContable;
}
