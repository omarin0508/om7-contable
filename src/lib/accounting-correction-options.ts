import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { getReglasContables } from "@/lib/reglas-contables";
import { createClient } from "@/lib/supabase/server";

export type AccountingCorrectionOption = {
  label: string;
  value: string;
};

export type AccountingCorrectionOptions = {
  accounts: AccountingCorrectionOption[];
  centrosCosto: AccountingCorrectionOption[];
  purchaseCategories: AccountingCorrectionOption[];
  saleTypes: AccountingCorrectionOption[];
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

function uniqueOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "es", { numeric: true }))
    .map((value) => ({ label: value, value }));
}

export async function getAccountingCorrectionOptions(): Promise<AccountingCorrectionOptions> {
  await assertInternalUser();

  const activeContext = await getActiveContext();
  const organization = activeContext.organization;

  if (!organization) {
    return {
      accounts: [],
      centrosCosto: [],
      purchaseCategories: [],
      saleTypes: [],
    };
  }

  const supabase = await getAuthenticatedSupabase();
  const [rules, centrosResult] = await Promise.all([
    getReglasContables().catch(() => null),
    supabase
      .from("centros_costo")
      .select("id,codigo,nombre")
      .eq("organization_id", organization.id)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
  ]);

  const cuentas = rules?.cuentas ?? [];
  const accounts = cuentas.map((account) => ({
    label: `${account.codigo} - ${account.nombre}`,
    value: `${account.codigo} - ${account.nombre}`,
  }));
  const centrosCosto = ((centrosResult.data ?? []) as Array<{
    codigo: string | null;
    id: string;
    nombre: string;
  }>).map((centro) => ({
    label: [centro.codigo, centro.nombre].filter(Boolean).join(" - "),
    value: centro.id,
  }));

  return {
    accounts,
    centrosCosto,
    purchaseCategories: uniqueOptions(
      (rules?.reglas.compras ?? []).map((rule) => rule.clave),
    ),
    saleTypes: uniqueOptions((rules?.reglas.facturas ?? []).map((rule) => rule.clave)),
  };
}
