import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CuentaContableCategoria =
  | "activo"
  | "pasivo"
  | "patrimonio"
  | "ingreso"
  | "costo"
  | "gasto";

export type CuentaContable = {
  id: string;
  organization_id: string | null;
  codigo: string;
  nombre: string;
  nivel: number;
  cuenta_padre_id: string | null;
  tipo_estado: "BG" | "ER";
  categoria: CuentaContableCategoria;
  naturaleza: "deudora" | "acreedora";
  tipo_cuenta: "acumulativa" | "detalle";
  permite_movimientos: boolean;
  centro_costo_requerido: boolean;
  moneda: string | null;
  activa: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type CuentaContableNode = CuentaContable & {
  children: CuentaContableNode[];
};

export type CatalogoContableStats = {
  total: number;
  detalle: number;
  acumulativa: number;
  movimientos: number;
  bg: number;
  er: number;
  activas: number;
  inactivas: number;
  copiadas: number;
  personalizadas: number;
};

export type CatalogoContableSource = "organization" | "global";

export type CuentaContableUsage = Record<string, number>;

export type CatalogoContableWorkspace = Awaited<
  ReturnType<typeof listCatalogoContableWorkspace>
>;

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

export function buildCuentaContableTree(accounts: CuentaContable[]) {
  const nodesById = new Map<string, CuentaContableNode>();
  const roots: CuentaContableNode[] = [];

  for (const account of accounts) {
    nodesById.set(account.id, { ...account, children: [] });
  }

  for (const account of accounts) {
    const node = nodesById.get(account.id);

    if (!node) {
      continue;
    }

    const parent = account.cuenta_padre_id
      ? nodesById.get(account.cuenta_padre_id)
      : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CuentaContableNode[]) => {
    nodes.sort((left, right) =>
      left.codigo.localeCompare(right.codigo, "es", { numeric: true }),
    );
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);

  return roots;
}

export function getCatalogoContableStats(accounts: CuentaContable[]) {
  return accounts.reduce<CatalogoContableStats>(
    (stats, account) => {
      stats.total += 1;

      if (account.tipo_cuenta === "detalle") {
        stats.detalle += 1;
      } else {
        stats.acumulativa += 1;
      }

      if (account.permite_movimientos) {
        stats.movimientos += 1;
      }

      if (account.tipo_estado === "BG") {
        stats.bg += 1;
      } else {
        stats.er += 1;
      }

      if (account.activa) {
        stats.activas += 1;
      } else {
        stats.inactivas += 1;
      }

      if (typeof account.metadata?.copied_from_global_account_id === "string") {
        stats.copiadas += 1;
      } else if (account.organization_id) {
        stats.personalizadas += 1;
      }

      return stats;
    },
    {
      acumulativa: 0,
      activas: 0,
      bg: 0,
      copiadas: 0,
      detalle: 0,
      er: 0,
      inactivas: 0,
      movimientos: 0,
      personalizadas: 0,
      total: 0,
    },
  );
}

async function fetchCuentasContablesByOrganization(
  organizationId: string | null,
) {
  const supabase = await getAuthenticatedSupabase();
  const query = supabase
    .from("cuentas_contables")
    .select("*")
    .order("codigo", { ascending: true });
  const { data, error } =
    organizationId === null
      ? await query.is("organization_id", null)
      : await query.eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CuentaContable[];
}

export async function listCuentasContables() {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const organization = activeContext.organization;

  if (!organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  let source: CatalogoContableSource = "organization";
  let accounts = await fetchCuentasContablesByOrganization(organization.id);

  if (accounts.length === 0) {
    source = "global";
    accounts = await fetchCuentasContablesByOrganization(null);
  }

  return {
    accounts,
    organization,
    source,
    stats: getCatalogoContableStats(accounts),
    tree: buildCuentaContableTree(accounts),
  };
}

async function getAccountUsageByOrganization(organizationId: string) {
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("asiento_lineas")
    .select("cuenta_contable_id")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ cuenta_contable_id: string | null }>).reduce(
    (usage, line) => {
      if (line.cuenta_contable_id) {
        usage[line.cuenta_contable_id] = (usage[line.cuenta_contable_id] ?? 0) + 1;
      }

      return usage;
    },
    {} as CuentaContableUsage,
  );
}

export async function listCatalogoContableWorkspace() {
  const currentUser = await assertInternalUser();
  const canEditMaster = currentUser.membershipRoles.some((role) =>
    ["owner", "platform_owner", "org_owner", "admin"].includes(role),
  );

  const activeContext = await getActiveContext();
  const organization = activeContext.organization;

  if (!organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  const [organizationAccounts, globalAccounts, usageByAccountId] =
    await Promise.all([
      fetchCuentasContablesByOrganization(organization.id),
      fetchCuentasContablesByOrganization(null),
      getAccountUsageByOrganization(organization.id),
    ]);

  const accounts =
    organizationAccounts.length > 0 ? organizationAccounts : globalAccounts;
  const source: CatalogoContableSource =
    organizationAccounts.length > 0 ? "organization" : "global";

  return {
    accounts,
    activeCompany: activeContext.activeCompany ?? activeContext.suggestedCompany,
    globalAccounts,
    organization,
    organizationAccounts,
    source,
    stats: getCatalogoContableStats(accounts),
    tree: buildCuentaContableTree(accounts),
    usageByAccountId,
    canEditMaster,
  };
}

export async function copyGlobalAccountingCatalogToOrganization(
  organizationId: string,
) {
  await assertInternalUser();

  const supabase = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();
  const organization = activeContext.organization;

  if (!organization || organization.id !== organizationId) {
    throw new Error("La organizacion destino no coincide con la organizacion activa.");
  }

  const globalAccounts = await fetchCuentasContablesByOrganization(null);

  if (globalAccounts.length === 0) {
    throw new Error("No existe un catalogo global OM7 para copiar.");
  }

  const { data: existingAccounts, error: existingError } = await supabase
    .from("cuentas_contables")
    .select("codigo")
    .eq("organization_id", organizationId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingCodes = new Set(
    ((existingAccounts ?? []) as Array<{ codigo: string }>).map(
      (account) => account.codigo,
    ),
  );
  const idByGlobalId = new Map<string, string>();
  let created = 0;
  let skipped = 0;

  for (const account of globalAccounts) {
    const payload = {
      activa: account.activa,
      categoria: account.categoria,
      centro_costo_requerido: account.centro_costo_requerido,
      codigo: account.codigo,
      cuenta_padre_id: null,
      metadata: {
        ...account.metadata,
        copied_from_global_account_id: account.id,
      },
      moneda: account.moneda,
      naturaleza: account.naturaleza,
      nivel: account.nivel,
      nombre: account.nombre,
      organization_id: organizationId,
      permite_movimientos: account.permite_movimientos,
      tipo_cuenta: account.tipo_cuenta,
      tipo_estado: account.tipo_estado,
    };

    if (existingCodes.has(account.codigo)) {
      const { data: existing, error: selectError } = await supabase
        .from("cuentas_contables")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("codigo", account.codigo)
        .single();

      if (selectError) {
        throw new Error(selectError.message);
      }

      idByGlobalId.set(account.id, String(existing.id));
      skipped += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("cuentas_contables")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    idByGlobalId.set(account.id, String(inserted.id));
    created += 1;
  }

  for (const account of globalAccounts) {
    const copiedId = idByGlobalId.get(account.id);
    const copiedParentId = account.cuenta_padre_id
      ? idByGlobalId.get(account.cuenta_padre_id)
      : null;

    if (!copiedId) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("cuentas_contables")
      .update({ cuenta_padre_id: copiedParentId ?? null })
      .eq("id", copiedId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    created,
    skipped,
    totalGlobal: globalAccounts.length,
  };
}
