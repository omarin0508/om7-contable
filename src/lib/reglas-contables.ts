import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type ReglaContableModulo =
  | "compras"
  | "facturas"
  | "caja"
  | "planillas"
  | "subcontratos";

export type CuentaReglaOption = {
  id: string;
  organization_id: string | null;
  codigo: string;
  nombre: string;
  categoria: string;
  tipo_estado: string;
};

export type ReglaContable = {
  id: string;
  modulo: ReglaContableModulo;
  organization_id: string | null;
  clave: string;
  clave_secundaria: string | null;
  cuentas: Array<{
    campo: string;
    cuenta_id: string | null;
    cuenta_codigo: string | null;
    cuenta_nombre: string | null;
  }>;
  requiere_centro_costo: boolean;
  prioridad: number;
  activa: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReglaContablePayload = {
  modulo: ReglaContableModulo;
  clave: string;
  claveSecundaria?: string | null;
  cuentas: Record<string, string | null | undefined>;
  requiereCentroCosto?: boolean;
  prioridad?: number;
  activa?: boolean;
};

const tableByModulo: Record<ReglaContableModulo, string> = {
  caja: "reglas_contables_caja",
  compras: "reglas_contables_compras",
  facturas: "reglas_contables_facturas",
  planillas: "reglas_contables_planillas",
  subcontratos: "reglas_contables_subcontratos",
};

const keyFieldsByModulo: Record<
  ReglaContableModulo,
  { primary: string; secondary?: string }
> = {
  caja: { primary: "tipo_movimiento", secondary: "categoria_movimiento" },
  compras: { primary: "categoria_compra" },
  facturas: { primary: "categoria_factura" },
  planillas: { primary: "tipo_planilla", secondary: "clasificacion_laboral" },
  subcontratos: { primary: "tipo_subcontrato", secondary: "categoria_subcontrato" },
};

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

async function resolveOrganizationId() {
  await assertInternalUser();
  const activeContext = await getActiveContext();

  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return activeContext.organization.id;
}

function getCuentaName(
  accountsById: Map<string, CuentaReglaOption>,
  id: string | null | undefined,
) {
  if (!id) {
    return {
      cuenta_codigo: null,
      cuenta_id: null,
      cuenta_nombre: null,
    };
  }

  const account = accountsById.get(id);

  return {
    cuenta_codigo: account?.codigo ?? null,
    cuenta_id: id,
    cuenta_nombre: account?.nombre ?? null,
  };
}

function normalizeRule(
  modulo: ReglaContableModulo,
  row: Record<string, unknown>,
  accountsById: Map<string, CuentaReglaOption>,
): ReglaContable {
  const fields = keyFieldsByModulo[modulo];

  return {
    activa: Boolean(row.activa),
    clave: String(row[fields.primary] ?? ""),
    clave_secundaria: fields.secondary
      ? String(row[fields.secondary] ?? "") || null
      : null,
    created_at: String(row.created_at ?? "") || null,
    cuentas: accountFieldsByModulo[modulo].map((field) => ({
      campo: field,
      ...getCuentaName(accountsById, row[field] as string | null | undefined),
    })),
    id: String(row.id),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    modulo,
    organization_id: (row.organization_id as string | null) ?? null,
    prioridad: Number(row.prioridad ?? 100),
    requiere_centro_costo: Boolean(row.requiere_centro_costo),
    updated_at: String(row.updated_at ?? row.created_at ?? "") || null,
  };
}

async function listAccountsForRules(organizationId: string) {
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("cuentas_contables")
    .select("id,organization_id,codigo,nombre,categoria,tipo_estado")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq("tipo_cuenta", "detalle")
    .eq("permite_movimientos", true)
    .eq("activa", true)
    .order("categoria", { ascending: true })
    .order("codigo", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CuentaReglaOption[];
}

async function listReglasByModulo(
  modulo: ReglaContableModulo,
  organizationId: string,
  accountsById: Map<string, CuentaReglaOption>,
) {
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from(tableByModulo[modulo])
    .select("*")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("activa", { ascending: false })
    .order("prioridad", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    normalizeRule(modulo, row, accountsById),
  );
}

export async function getReglasContables() {
  const organizationId = await resolveOrganizationId();
  const cuentas = await listAccountsForRules(organizationId);
  const accountsById = new Map(cuentas.map((account) => [account.id, account]));
  const [compras, facturas, caja, planillas, subcontratos] = await Promise.all([
    listReglasByModulo("compras", organizationId, accountsById),
    listReglasByModulo("facturas", organizationId, accountsById),
    listReglasByModulo("caja", organizationId, accountsById),
    listReglasByModulo("planillas", organizationId, accountsById),
    listReglasByModulo("subcontratos", organizationId, accountsById),
  ]);

  return {
    cuentas,
    organizationId,
    reglas: {
      caja,
      compras,
      facturas,
      planillas,
      subcontratos,
    },
  };
}

export async function getReglasContablesCompras() {
  return (await getReglasContables()).reglas.compras;
}

export async function getReglasContablesFacturas() {
  return (await getReglasContables()).reglas.facturas;
}

export async function getReglasContablesCaja() {
  return (await getReglasContables()).reglas.caja;
}

export async function getReglasContablesPlanillas() {
  return (await getReglasContables()).reglas.planillas;
}

export async function getReglasContablesSubcontratos() {
  return (await getReglasContables()).reglas.subcontratos;
}

function buildPayload(
  organizationId: string,
  payload: ReglaContablePayload,
  ruleId?: string,
) {
  const fields = keyFieldsByModulo[payload.modulo];
  const priority = Number.isFinite(Number(payload.prioridad))
    ? Number(payload.prioridad)
    : 100;
  const record: Record<string, unknown> = {
    activa: payload.activa ?? true,
    organization_id: organizationId,
    prioridad: priority,
    requiere_centro_costo: Boolean(payload.requiereCentroCosto),
  };

  record[fields.primary] = payload.clave.trim();

  if (fields.secondary) {
    record[fields.secondary] = payload.claveSecundaria?.trim() || null;
  }

  for (const field of accountFieldsByModulo[payload.modulo]) {
    record[field] = payload.cuentas[field] || null;
  }

  return {
    record,
    validation: {
      p_clave: payload.clave,
      p_clave_secundaria: payload.claveSecundaria ?? null,
      p_cuenta_ids: accountFieldsByModulo[payload.modulo]
        .map((field) => payload.cuentas[field])
        .filter(Boolean),
      p_modulo: payload.modulo,
      p_organization_id: organizationId,
      p_prioridad: priority,
      p_regla_id: ruleId ?? null,
    },
  };
}

async function validateRule(validation: Record<string, unknown>) {
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("validar_regla_contable", validation);

  if (error) {
    throw new Error(error.message);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.valida) {
    throw new Error(result?.error ?? "La regla contable no es valida.");
  }
}

export async function createReglaContable(payload: ReglaContablePayload) {
  const organizationId = await resolveOrganizationId();
  const supabase = await getAuthenticatedSupabase();
  const { record, validation } = buildPayload(organizationId, payload);

  await validateRule(validation);

  const { data, error } = await supabase
    .from(tableByModulo[payload.modulo])
    .insert(record)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la regla contable.");
  }

  return String(data.id);
}

export async function updateReglaContable(
  modulo: ReglaContableModulo,
  ruleId: string,
  payload: Partial<ReglaContablePayload>,
) {
  const organizationId = await resolveOrganizationId();
  const supabase = await getAuthenticatedSupabase();
  const { data: current, error: currentError } = await supabase
    .from(tableByModulo[modulo])
    .select("*")
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .single();

  if (currentError || !current) {
    throw new Error(currentError?.message ?? "Regla contable no encontrada.");
  }

  const normalized = normalizeRule(modulo, current, new Map());
  const merged: ReglaContablePayload = {
    activa: payload.activa ?? normalized.activa,
    clave: payload.clave ?? normalized.clave,
    claveSecundaria: payload.claveSecundaria ?? normalized.clave_secundaria,
    cuentas: {
      ...Object.fromEntries(
        normalized.cuentas.map((account) => [account.campo, account.cuenta_id]),
      ),
      ...(payload.cuentas ?? {}),
    },
    modulo,
    prioridad: payload.prioridad ?? normalized.prioridad,
    requiereCentroCosto:
      payload.requiereCentroCosto ?? normalized.requiere_centro_costo,
  };
  const { record, validation } = buildPayload(organizationId, merged, ruleId);

  await validateRule(validation);

  const { error } = await supabase
    .from(tableByModulo[modulo])
    .update(record)
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleReglaContable(
  modulo: ReglaContableModulo,
  ruleId: string,
  activa: boolean,
) {
  const organizationId = await resolveOrganizationId();
  const supabase = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from(tableByModulo[modulo])
    .update({ activa })
    .eq("id", ruleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteOrDeactivateReglaContable(
  modulo: ReglaContableModulo,
  ruleId: string,
) {
  return toggleReglaContable(modulo, ruleId, false);
}

export async function duplicarReglaGlobalAOrganizacion(
  modulo: ReglaContableModulo,
  ruleId: string,
) {
  const organizationId = await resolveOrganizationId();
  const supabase = await getAuthenticatedSupabase();
  const { data: globalRule, error } = await supabase
    .from(tableByModulo[modulo])
    .select("*")
    .eq("id", ruleId)
    .is("organization_id", null)
    .single();

  if (error || !globalRule) {
    throw new Error(error?.message ?? "Regla global no encontrada.");
  }

  const clone = { ...globalRule, id: undefined, organization_id: organizationId };
  delete clone.id;

  const fields = keyFieldsByModulo[modulo];
  const validation = {
    p_clave: String(clone[fields.primary] ?? ""),
    p_clave_secundaria: fields.secondary
      ? String(clone[fields.secondary] ?? "")
      : null,
    p_cuenta_ids: accountFieldsByModulo[modulo]
      .map((field) => clone[field])
      .filter(Boolean),
    p_modulo: modulo,
    p_organization_id: organizationId,
    p_prioridad: Number(clone.prioridad ?? 100),
    p_regla_id: null,
  };

  await validateRule(validation);

  const { data, error: insertError } = await supabase
    .from(tableByModulo[modulo])
    .insert(clone)
    .select("id")
    .single();

  if (insertError || !data) {
    throw new Error(insertError?.message ?? "No se pudo duplicar la regla.");
  }

  return String(data.id);
}
