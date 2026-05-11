import { getActiveContext } from "@/lib/active-context";
import { normalizePeriodStatus } from "@/lib/accounting-periods";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { getInvoicesForActiveCompany } from "@/lib/invoices";
import {
  getInvoiceCollectionSummary,
  getPaymentStatusKey,
  getPurchasePaymentSummary,
  type InvoiceCollection,
  type PurchasePayment,
} from "@/lib/payments";
import { listPurchases } from "@/lib/purchases";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type AccountingAccount = {
  id: string;
  organization_id: string;
  company_id: string | null;
  code: string;
  name: string;
  type: string;
  normal_balance: "debit" | "credit" | string;
  is_system: boolean;
  is_active: boolean;
  created_at: string | null;
};

export type JournalEntryStatus = "suggested" | "reviewed" | "posted" | "observed";

export type JournalEntryLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  side: "debit" | "credit" | string;
  amount: number;
  description: string | null;
  created_at: string | null;
  account?: AccountingAccount | null;
};

export type JournalEntry = {
  id: string;
  organization_id: string;
  company_id: string;
  period_year: number;
  period_month: number;
  source_type: "purchase" | "invoice" | string;
  source_id: string;
  status: JournalEntryStatus | string;
  explanation: string | null;
  created_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  lines?: JournalEntryLine[];
};

export type AccountingPeriodSummary = {
  credit: number;
  debit: number;
  difference: number;
  isBalanced: boolean;
  observed: number;
  pendingToPost: number;
  posted: number;
  reviewed: number;
  suggested: number;
  totalEntries: number;
};

const defaultAccounts = [
  { code: "1-01", name: "Caja", type: "cash", normal_balance: "debit" },
  { code: "1-02", name: "Banco", type: "bank", normal_balance: "debit" },
  { code: "1-03", name: "Cuentas por cobrar", type: "asset", normal_balance: "debit" },
  { code: "1-04", name: "Inventario / Activo", type: "asset", normal_balance: "debit" },
  { code: "1-05", name: "IVA credito fiscal", type: "tax", normal_balance: "debit" },
  { code: "2-01", name: "Cuentas por pagar", type: "liability", normal_balance: "credit" },
  { code: "2-02", name: "IVA debito fiscal", type: "tax", normal_balance: "credit" },
  { code: "4-01", name: "Ventas / Ingresos", type: "income", normal_balance: "credit" },
  { code: "5-01", name: "Gastos generales", type: "expense", normal_balance: "debit" },
] as const;

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

function getPeriodFromDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha del registro no es valida.");
  }

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

async function assertPeriodIsOpen(companyId: string, year: number, month: number) {
  const { supabase } = await getAuthenticatedSupabase();
  const { organization } = await getValidatedContext(companyId);

  const { data, error } = await supabase
    .from("accounting_periods")
    .select("status")
    .eq("organization_id", organization.id)
    .eq("company_id", companyId)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (normalizePeriodStatus(data?.status) === "closed") {
    throw new Error("No se puede modificar un asiento de un periodo cerrado.");
  }
}

export async function createDefaultAccountsForCompany(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);

  const payload = defaultAccounts.map((account) => ({
    ...account,
    company_id: company.id,
    is_system: true,
    organization_id: organization.id,
  }));

  const { error } = await supabase
    .from("accounting_accounts")
    .upsert(payload, {
      onConflict: "organization_id,company_id,code",
    });

  if (error) {
    throw new Error(error.message);
  }

  return listAccountingAccounts(company.id);
}

export async function listAccountingAccounts(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);

  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    accounts: (data ?? []) as AccountingAccount[],
    company,
    organization,
  };
}

async function getAccountsForSuggestion(companyId: string) {
  let { accounts } = await listAccountingAccounts(companyId);

  if (accounts.length === 0) {
    ({ accounts } = await createDefaultAccountsForCompany(companyId));
  }

  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const requiredCodes = ["1-02", "1-03", "1-05", "2-01", "2-02", "4-01", "5-01"];

  for (const code of requiredCodes) {
    if (!byCode.has(code)) {
      throw new Error("Faltan cuentas base para sugerir el asiento.");
    }
  }

  return byCode;
}

async function fetchEntryLines(entryIds: string[]) {
  if (entryIds.length === 0) {
    return new Map<string, JournalEntryLine[]>();
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("journal_entry_lines")
    .select("*, account:accounting_accounts(*)")
    .in("journal_entry_id", entryIds);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JournalEntryLine[]).reduce(
    (map, line) => {
      const current = map.get(line.journal_entry_id) ?? [];
      current.push(line);
      map.set(line.journal_entry_id, current);
      return map;
    },
    new Map<string, JournalEntryLine[]>(),
  );
}

export async function getJournalEntryForSource(
  sourceType: "purchase" | "invoice" | string,
  sourceId: string,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const linesByEntry = await fetchEntryLines([data.id]);

  return {
    ...(data as JournalEntry),
    lines: linesByEntry.get(data.id) ?? [],
  };
}

export async function listJournalEntriesForSources(
  sourceType: "purchase" | "invoice",
  sourceIds: string[],
) {
  if (sourceIds.length === 0) {
    return new Map<string, JournalEntry>();
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("source_type", sourceType)
    .in("source_id", sourceIds);

  if (error) {
    throw new Error(error.message);
  }

  const entries = (data ?? []) as JournalEntry[];
  const linesByEntry = await fetchEntryLines(entries.map((entry) => entry.id));

  return new Map(
    entries.map((entry) => [
      entry.source_id,
      {
        ...entry,
        lines: linesByEntry.get(entry.id) ?? [],
      },
    ]),
  );
}

async function replaceEntryLines(
  entryId: string,
  lines: Array<{
    account_id: string;
    amount: number;
    description: string;
    side: "debit" | "credit";
  }>,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error: deleteError } = await supabase
    .from("journal_entry_lines")
    .delete()
    .eq("journal_entry_id", entryId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error } = await supabase.from("journal_entry_lines").insert(
    lines.map((line) => ({
      ...line,
      journal_entry_id: entryId,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

function getPaymentCreditAccount(
  accounts: Map<string, AccountingAccount>,
  paymentMethod: string | null | undefined,
) {
  const normalized = String(paymentMethod ?? "").toLowerCase();

  if (normalized.includes("banco") || normalized.includes("transfer")) {
    return accounts.get("1-02");
  }

  if (normalized.includes("caja") || normalized.includes("efectivo")) {
    return accounts.get("1-01") ?? accounts.get("1-02");
  }

  return accounts.get("2-01");
}

function getMovementAccount(
  accounts: Map<string, AccountingAccount>,
  movement: InvoiceCollection | PurchasePayment | null | undefined,
  fallbackCode: "1-03" | "2-01",
) {
  const type = movement?.payment_method?.type;

  if (type === "cash") {
    return accounts.get("1-01") ?? accounts.get("1-02");
  }

  if (type === "bank" || type === "card" || type === "transfer") {
    return accounts.get("1-02");
  }

  return accounts.get(fallbackCode);
}

function calculateBalancedAmounts({
  subtotal,
  tax,
  total,
}: {
  subtotal: number | null | undefined;
  tax: number | null | undefined;
  total: number | null | undefined;
}) {
  const safeSubtotal = Number(subtotal ?? 0);
  const safeTax = Number(tax ?? 0);
  const safeTotal = Number(total ?? 0);
  const effectiveTotal =
    safeTotal > 0 ? safeTotal : Math.max(safeSubtotal + safeTax, 0);
  const expectedTotal = safeSubtotal + safeTax;
  const base =
    Math.abs(expectedTotal - effectiveTotal) < 0.01
      ? safeSubtotal
      : Math.max(effectiveTotal - safeTax, 0);

  return {
    base,
    tax: safeTax,
    total: effectiveTotal,
  };
}

export async function suggestJournalEntryForPurchase(purchaseId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { purchases } = await listPurchases();
  const purchase = purchases.find((item) => item.id === purchaseId);

  if (!purchase) {
    throw new Error("Compra no encontrada.");
  }

  if (normalizeReviewStatus(purchase.review_status) !== "approved") {
    throw new Error("Apruebe la compra antes de sugerir el asiento.");
  }

  const period = getPeriodFromDate(purchase.purchase_date ?? purchase.created_at);
  await assertPeriodIsOpen(purchase.company_id, period.year, period.month);
  const accounts = await getAccountsForSuggestion(purchase.company_id);
  const expenseAccount = accounts.get("5-01");
  const taxAccount = accounts.get("1-05");
  const paymentSummary = (await getPurchasePaymentSummary([purchase.id])).get(
    purchase.id,
  );
  const paidAmount = Math.min(
    Number(paymentSummary?.amount ?? 0),
    Number(purchase.total ?? 0),
  );
  const paymentStatus = getPaymentStatusKey(purchase.total, paidAmount);
  const paidAccount = getMovementAccount(
    accounts,
    paymentSummary?.items[0],
    "2-01",
  );
  const payableAccount =
    accounts.get("2-01") ?? getPaymentCreditAccount(accounts, purchase.payment_method);

  if (!expenseAccount || !taxAccount || !paidAccount || !payableAccount) {
    throw new Error("Faltan cuentas base para sugerir la compra.");
  }

  const amounts = calculateBalancedAmounts({
    subtotal: purchase.subtotal,
    tax: purchase.tax,
    total: purchase.total,
  });
  const lines = [
    {
      account_id: expenseAccount.id,
      amount: amounts.base,
      description: purchase.category
        ? `Gasto sugerido: ${purchase.category}`
        : "Gasto sugerido por OM7",
      side: "debit" as const,
    },
    ...(amounts.tax > 0
      ? [
          {
            account_id: taxAccount.id,
            amount: amounts.tax,
            description: "IVA credito fiscal sugerido",
            side: "debit" as const,
          },
        ]
      : []),
    ...(paidAmount > 0
      ? [
          {
            account_id: paidAccount.id,
            amount: paidAmount,
            description: "Pago registrado aplicado por OM7",
            side: "credit" as const,
          },
        ]
      : []),
    ...(amounts.total - paidAmount > 0
      ? [
          {
            account_id: payableAccount.id,
            amount: amounts.total - paidAmount,
            description: "Saldo pendiente por pagar sugerido",
            side: "credit" as const,
          },
        ]
      : []),
  ].filter((line) => line.amount > 0);

  if (lines.length === 0) {
    throw new Error("No hay montos suficientes para sugerir el asiento.");
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(
      {
        company_id: purchase.company_id,
        explanation:
          paymentStatus === "paid"
            ? "OM7 sugiere debitar gasto e IVA credito fiscal, y acreditar el pago registrado."
            : paidAmount > 0
              ? "OM7 sugiere debitar gasto e IVA credito fiscal, y separar pago parcial de saldo por pagar."
              : "OM7 sugiere debitar gasto e IVA credito fiscal, y acreditar cuenta por pagar.",
        organization_id: purchase.organization_id,
        period_month: period.month,
        period_year: period.year,
        source_id: purchase.id,
        source_type: "purchase",
        status: "suggested",
      },
      {
        onConflict: "organization_id,company_id,source_type,source_id",
      },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el asiento sugerido.");
  }

  await replaceEntryLines(data.id, lines);

  return getJournalEntryForSource("purchase", purchase.id);
}

export async function suggestJournalEntryForInvoice(invoiceId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { invoices } = await getInvoicesForActiveCompany();
  const invoice = invoices.find((item) => item.id === invoiceId);

  if (!invoice) {
    throw new Error("Factura no encontrada.");
  }

  if (normalizeReviewStatus(invoice.review_status) !== "approved") {
    throw new Error("Apruebe la factura antes de sugerir el asiento.");
  }

  const period = getPeriodFromDate(invoice.fecha ?? invoice.created_at);
  await assertPeriodIsOpen(invoice.company_id, period.year, period.month);
  const accounts = await getAccountsForSuggestion(invoice.company_id);
  const debitAccount = accounts.get("1-03");
  const incomeAccount = accounts.get("4-01");
  const taxAccount = accounts.get("2-02");
  const collectionSummary = (await getInvoiceCollectionSummary([invoice.id])).get(
    invoice.id,
  );
  const collectedAmount = Math.min(
    Number(collectionSummary?.amount ?? 0),
    Number(invoice.total ?? 0),
  );
  const collectionAccount = getMovementAccount(
    accounts,
    collectionSummary?.items[0],
    "1-03",
  );

  if (!debitAccount || !incomeAccount || !taxAccount || !collectionAccount) {
    throw new Error("Faltan cuentas base para sugerir la factura.");
  }

  const amounts = calculateBalancedAmounts({
    subtotal: invoice.subtotal,
    tax: invoice.impuesto,
    total: invoice.total,
  });
  const lines = [
    ...(collectedAmount > 0
      ? [
          {
            account_id: collectionAccount.id,
            amount: collectedAmount,
            description: "Cobro registrado aplicado por OM7",
            side: "debit" as const,
          },
        ]
      : []),
    ...(amounts.total - collectedAmount > 0
      ? [
          {
            account_id: debitAccount.id,
            amount: amounts.total - collectedAmount,
            description: "Saldo pendiente por cobrar sugerido",
            side: "debit" as const,
          },
        ]
      : []),
    {
      account_id: incomeAccount.id,
      amount: amounts.base,
      description: "Ingreso sugerido por OM7",
      side: "credit" as const,
    },
    ...(amounts.tax > 0
      ? [
          {
            account_id: taxAccount.id,
            amount: amounts.tax,
            description: "IVA debito fiscal sugerido",
            side: "credit" as const,
          },
        ]
      : []),
  ].filter((line) => line.amount > 0);

  if (lines.length === 0) {
    throw new Error("No hay montos suficientes para sugerir el asiento.");
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(
      {
        company_id: invoice.company_id,
        explanation:
          collectedAmount > 0
            ? "OM7 sugiere reconocer el cobro registrado y el saldo pendiente por cobrar, contra ventas e IVA debito fiscal."
            : "OM7 sugiere debitar cuentas por cobrar y acreditar ventas e IVA debito fiscal.",
        organization_id: invoice.organization_id,
        period_month: period.month,
        period_year: period.year,
        source_id: invoice.id,
        source_type: "invoice",
        status: "suggested",
      },
      {
        onConflict: "organization_id,company_id,source_type,source_id",
      },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el asiento sugerido.");
  }

  await replaceEntryLines(data.id, lines);

  return getJournalEntryForSource("invoice", invoice.id);
}

export async function updateJournalEntryStatus(
  entryId: string,
  status: JournalEntryStatus,
  note?: string,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data: existing, error: existingError } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", entryId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .single();

  if (existingError || !existing) {
    throw new Error(existingError?.message ?? "Asiento no encontrado.");
  }

  await assertPeriodIsOpen(company.id, existing.period_year, existing.period_month);

  const payload = {
    approved_at:
      status === "posted" || status === "reviewed"
        ? new Date().toISOString()
        : null,
    approved_by: status === "posted" || status === "reviewed" ? user.id : null,
    explanation:
      status === "observed" && note?.trim()
        ? `${existing.explanation ?? ""}\nObservacion: ${note.trim()}`.trim()
        : existing.explanation,
    status,
  };
  const { data, error } = await supabase
    .from("journal_entries")
    .update(payload)
    .eq("id", entryId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el asiento.");
  }

  return data as JournalEntry;
}

export function approveJournalEntry(entryId: string) {
  return updateJournalEntryStatus(entryId, "reviewed");
}

export function postJournalEntry(entryId: string) {
  return updateJournalEntryStatus(entryId, "posted");
}

export function observeJournalEntry(entryId: string, note: string) {
  return updateJournalEntryStatus(entryId, "observed", note);
}

export async function listJournalEntriesForActiveCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const entries = (data ?? []) as JournalEntry[];
  const linesByEntry = await fetchEntryLines(entries.map((entry) => entry.id));

  return {
    company,
    entries: entries.map((entry) => ({
      ...entry,
      lines: linesByEntry.get(entry.id) ?? [],
    })),
    organization,
  };
}

export async function listJournalEntriesForPeriod(
  companyId: string | undefined,
  year: number,
  month: number,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("period_year", year)
    .eq("period_month", month)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const entries = (data ?? []) as JournalEntry[];
  const linesByEntry = await fetchEntryLines(entries.map((entry) => entry.id));

  return {
    company,
    entries: entries.map((entry) => ({
      ...entry,
      lines: linesByEntry.get(entry.id) ?? [],
    })),
    organization,
  };
}

export async function getAccountingSummaryForPeriod(
  companyId: string | undefined,
  year: number,
  month: number,
): Promise<AccountingPeriodSummary> {
  const { entries } = await listJournalEntriesForPeriod(companyId, year, month);
  const totals = entries.reduce(
    (summary, entry) => {
      const entryTotals = getJournalTotals(entry);

      summary.debit += entryTotals.debit;
      summary.credit += entryTotals.credit;

      if (entry.status === "posted") {
        summary.posted += 1;
      } else if (entry.status === "reviewed") {
        summary.reviewed += 1;
      } else if (entry.status === "observed") {
        summary.observed += 1;
      } else {
        summary.suggested += 1;
      }

      return summary;
    },
    {
      credit: 0,
      debit: 0,
      observed: 0,
      posted: 0,
      reviewed: 0,
      suggested: 0,
    },
  );
  const difference = totals.debit - totals.credit;

  return {
    ...totals,
    difference,
    isBalanced: Math.abs(difference) < 0.01,
    pendingToPost: entries.filter((entry) => entry.status !== "posted").length,
    totalEntries: entries.length,
  };
}

export function getJournalTotals(entry: Pick<JournalEntry, "lines">) {
  const lines = entry.lines ?? [];
  const debit = lines
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  const credit = lines
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);

  return {
    credit,
    debit,
    difference: debit - credit,
    isBalanced: Math.abs(debit - credit) < 0.01,
  };
}
