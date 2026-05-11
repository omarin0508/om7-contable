import { getActiveContext } from "@/lib/active-context";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import { listPurchases } from "@/lib/purchases";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AccountingPeriodStatus = "open" | "in_review" | "closed";

export type AccountingPeriod = {
  id: string;
  organization_id: string;
  company_id: string;
  period_year: number;
  period_month: number;
  status: AccountingPeriodStatus | string;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
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

async function getValidatedContext(companyId?: string) {
  await assertInternalUser();
  const activeContext = await getActiveContext();
  const organization = activeContext.organization;
  const company =
    activeContext.companies.find((item) => item.id === companyId) ??
    activeContext.activeCompany;

  if (!organization || !company) {
    throw new Error("Selecciona un cliente/empresa activa.");
  }

  if (company.organization_id !== organization.id) {
    throw new Error("La empresa no pertenece al despacho activo.");
  }

  return { activeContext, company, organization };
}

export function getPeriodLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function normalizePeriodStatus(
  status: string | null | undefined,
): AccountingPeriodStatus {
  return status === "closed" || status === "in_review" ? status : "open";
}

export function getPeriodStatusLabel(status: string | null | undefined) {
  const normalized = normalizePeriodStatus(status);

  if (normalized === "closed") {
    return "Cerrado";
  }

  if (normalized === "in_review") {
    return "En revision";
  }

  return "Mes abierto";
}

export function getPeriodStatusBadgeClass(status: string | null | undefined) {
  const normalized = normalizePeriodStatus(status);

  if (normalized === "closed") {
    return "om7-chip om7-chip-emerald";
  }

  if (normalized === "in_review") {
    return "om7-chip om7-chip-cyan";
  }

  return "om7-chip om7-chip-amber";
}

export async function listAccountingPeriods(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);

  const { data, error } = await supabase
    .from("accounting_periods")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    company,
    organization,
    periods: (data ?? []) as AccountingPeriod[],
  };
}

export async function createOrGetAccountingPeriod(
  companyId: string | undefined,
  year: number,
  month: number,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);

  const safeMonth = Math.min(Math.max(Number(month), 1), 12);
  const safeYear = Number(year);

  if (!Number.isInteger(safeYear)) {
    throw new Error("Periodo invalido.");
  }

  const { data, error } = await supabase
    .from("accounting_periods")
    .upsert(
      {
        company_id: company.id,
        organization_id: organization.id,
        period_month: safeMonth,
        period_year: safeYear,
      },
      {
        onConflict: "organization_id,company_id,period_year,period_month",
      },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo preparar el periodo.");
  }

  return data as AccountingPeriod;
}

export async function getCurrentAccountingPeriod(companyId?: string) {
  const today = new Date();

  return createOrGetAccountingPeriod(
    companyId,
    today.getFullYear(),
    today.getMonth() + 1,
  );
}

async function updateAccountingPeriodStatus(
  periodId: string,
  status: AccountingPeriodStatus,
  notes?: string,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { organization, company } = await getValidatedContext();
  const payload =
    status === "closed"
      ? {
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          notes: notes?.trim() || null,
          status,
        }
      : {
          closed_at: null,
          closed_by: null,
          notes: notes?.trim() || null,
          status,
        };

  const { data, error } = await supabase
    .from("accounting_periods")
    .update(payload)
    .eq("id", periodId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el periodo.");
  }

  return data as AccountingPeriod;
}

function isInPeriod(value: string | null | undefined, year: number, month: number) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

export async function closeAccountingPeriod(periodId: string, notes?: string) {
  const { periods } = await listAccountingPeriods();
  const period = periods.find((item) => item.id === periodId);

  if (!period) {
    throw new Error("Periodo no encontrado.");
  }

  const [{ purchases }, { invoices }] = await Promise.all([
    listPurchases(),
    getInvoicesForActiveCompany(),
  ]);
  const periodPurchases = purchases.filter((purchase) =>
    isInPeriod(purchase.purchase_date ?? purchase.created_at, period.period_year, period.period_month),
  );
  const periodInvoices = invoices.filter((invoice) =>
    isInPeriod(invoice.fecha ?? invoice.created_at, period.period_year, period.period_month),
  );
  const observedCount = [...periodPurchases, ...periodInvoices].filter(
    (record) => normalizeReviewStatus(record.review_status) === "observed",
  ).length;
  const pendingCount = [...periodPurchases, ...periodInvoices].filter(
    (record) => normalizeReviewStatus(record.review_status) === "pending",
  ).length;

  if (observedCount > 0) {
    throw new Error("No se puede cerrar porque hay registros observados.");
  }

  if (pendingCount > 0) {
    throw new Error("No se puede cerrar porque hay registros pendientes.");
  }

  return updateAccountingPeriodStatus(periodId, "closed", notes);
}

export async function markAccountingPeriodInReview(periodId: string, notes?: string) {
  return updateAccountingPeriodStatus(periodId, "in_review", notes);
}

export async function reopenAccountingPeriod(periodId: string, notes?: string) {
  return updateAccountingPeriodStatus(periodId, "open", notes);
}
