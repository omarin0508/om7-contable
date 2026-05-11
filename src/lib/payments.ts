import { getActiveContext } from "@/lib/active-context";
import { normalizePeriodStatus } from "@/lib/accounting-periods";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type PaymentMethodType =
  | "bank"
  | "card"
  | "cash"
  | "payable"
  | "receivable"
  | "transfer";

export type PaymentMethod = {
  id: string;
  organization_id: string;
  company_id: string | null;
  code: string;
  name: string;
  type: PaymentMethodType | string;
  is_active: boolean;
  created_at: string | null;
};

export type PurchasePayment = {
  id: string;
  organization_id: string;
  company_id: string;
  purchase_id: string;
  payment_method_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string | null;
  payment_method?: PaymentMethod | null;
};

export type InvoiceCollection = {
  id: string;
  organization_id: string;
  company_id: string;
  invoice_id: string;
  payment_method_id: string;
  amount: number;
  collection_date: string;
  notes: string | null;
  created_at: string | null;
  payment_method?: PaymentMethod | null;
};

export type PaymentSummary = {
  amount: number;
  items: PurchasePayment[];
};

export type CollectionSummary = {
  amount: number;
  items: InvoiceCollection[];
};

export type CashflowOverview = {
  paidThisMonth: number;
  collectedThisMonth: number;
  partialMovements: number;
  pendingCollections: number;
  pendingPayments: number;
};

const defaultPaymentMethods: Array<{
  code: string;
  name: string;
  type: PaymentMethodType;
}> = [
  { code: "cash", name: "Caja", type: "cash" },
  { code: "bank", name: "Banco", type: "bank" },
  { code: "card", name: "Tarjeta", type: "card" },
  { code: "transfer", name: "Transferencia", type: "transfer" },
  { code: "payable", name: "Credito / Por pagar", type: "payable" },
  { code: "receivable", name: "Por cobrar", type: "receivable" },
];

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

function normalizeAmount(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
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

async function assertPaymentPeriodIsOpen(
  companyId: string,
  dateValue: string | null | undefined,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { month, year } = getPeriodFromDate(dateValue);
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
    throw new Error("No se puede registrar el movimiento en un periodo cerrado.");
  }
}

function buildSummaryMap<T extends { amount: number }>(
  items: T[],
  getSourceId: (item: T) => string,
) {
  return items.reduce((map, item) => {
    const sourceId = getSourceId(item);
    const current = map.get(sourceId) ?? { amount: 0, items: [] as T[] };

    current.amount = normalizeAmount(current.amount + Number(item.amount ?? 0));
    current.items.push(item);
    map.set(sourceId, current);

    return map;
  }, new Map<string, { amount: number; items: T[] }>());
}

async function queryPaymentMethods(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeContext: await getActiveContext(),
    company,
    methods: (data ?? []) as PaymentMethod[],
    organization,
  };
}

export async function createDefaultPaymentMethods(companyId?: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext(companyId);
  const payload = defaultPaymentMethods.map((method) => ({
    ...method,
    company_id: company.id,
    is_active: true,
    organization_id: organization.id,
  }));
  const { error } = await supabase.from("payment_methods").upsert(payload, {
    onConflict: "organization_id,company_id,code",
  });

  if (error) {
    throw new Error(error.message);
  }

  return queryPaymentMethods(company.id);
}

export async function listPaymentMethods(companyId?: string) {
  const result = await queryPaymentMethods(companyId);

  if (result.methods.length > 0) {
    return result;
  }

  return createDefaultPaymentMethods(result.company.id);
}

export async function getPurchasePaymentSummary(purchaseIds: string[]) {
  if (purchaseIds.length === 0) {
    return new Map<string, PaymentSummary>();
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("purchase_payments")
    .select("*, payment_method:payment_methods(*)")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .in("purchase_id", purchaseIds)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return buildSummaryMap(
    (data ?? []) as PurchasePayment[],
    (payment) => payment.purchase_id,
  ) as Map<string, PaymentSummary>;
}

export async function getInvoiceCollectionSummary(invoiceIds: string[]) {
  if (invoiceIds.length === 0) {
    return new Map<string, CollectionSummary>();
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const { data, error } = await supabase
    .from("invoice_collections")
    .select("*, payment_method:payment_methods(*)")
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .in("invoice_id", invoiceIds)
    .order("collection_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return buildSummaryMap(
    (data ?? []) as InvoiceCollection[],
    (collection) => collection.invoice_id,
  ) as Map<string, CollectionSummary>;
}

export function getPaymentStatusKey(total: number | null | undefined, paid: number) {
  const safeTotal = Math.max(Number(total ?? 0), 0);

  if (safeTotal <= 0 || paid <= 0) {
    return "pending";
  }

  if (paid + 0.01 >= safeTotal) {
    return "paid";
  }

  return "partial";
}

export function getCollectionStatusKey(
  total: number | null | undefined,
  collected: number,
) {
  const safeTotal = Math.max(Number(total ?? 0), 0);

  if (safeTotal <= 0 || collected <= 0) {
    return "pending";
  }

  if (collected + 0.01 >= safeTotal) {
    return "collected";
  }

  return "partial";
}

export function getPaymentStatusLabel(
  total: number | null | undefined,
  paid: number,
) {
  const status = getPaymentStatusKey(total, paid);

  if (status === "paid") {
    return "Pagada";
  }

  if (status === "partial") {
    return "Parcial";
  }

  return "Pendiente";
}

export function getCollectionStatusLabel(
  total: number | null | undefined,
  collected: number,
) {
  const status = getCollectionStatusKey(total, collected);

  if (status === "collected") {
    return "Cobrada";
  }

  if (status === "partial") {
    return "Parcial";
  }

  return "Pendiente";
}

export function getMovementStatusBadgeClass(status: string) {
  if (status === "paid" || status === "collected") {
    return "om7-chip om7-chip-emerald";
  }

  if (status === "partial") {
    return "om7-chip om7-chip-cyan";
  }

  return "om7-chip om7-chip-amber";
}

export function getRemainingAmount(total: number | null | undefined, paid: number) {
  return normalizeAmount(Math.max(Number(total ?? 0) - Number(paid ?? 0), 0));
}

export async function registerPurchasePayment(input: {
  amount: number;
  notes?: string;
  paymentDate: string;
  paymentMethodId: string;
  purchaseId: string;
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const amount = normalizeAmount(input.amount);

  if (amount <= 0) {
    throw new Error("Ingresa un monto de pago valido.");
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("id, company_id, total, purchase_date, created_at")
    .eq("id", input.purchaseId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .single();

  if (purchaseError || !purchase) {
    throw new Error(purchaseError?.message ?? "Compra no encontrada.");
  }

  await assertPaymentPeriodIsOpen(
    purchase.company_id,
    purchase.purchase_date ?? purchase.created_at,
  );

  const summaries = await getPurchasePaymentSummary([input.purchaseId]);
  const currentPaid = summaries.get(input.purchaseId)?.amount ?? 0;
  const remaining = getRemainingAmount(Number(purchase.total ?? 0), currentPaid);

  if (remaining > 0 && amount > remaining + 0.01) {
    throw new Error("El pago supera el saldo pendiente de la compra.");
  }

  const { data: method, error: methodError } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("id", input.paymentMethodId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("is_active", true)
    .single();

  if (methodError || !method) {
    throw new Error(methodError?.message ?? "Metodo de pago no valido.");
  }

  const { data, error } = await supabase
    .from("purchase_payments")
    .insert({
      amount,
      company_id: company.id,
      notes: input.notes?.trim() || null,
      organization_id: organization.id,
      payment_date: input.paymentDate,
      payment_method_id: input.paymentMethodId,
      purchase_id: input.purchaseId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el pago.");
  }

  return data as PurchasePayment;
}

export async function registerInvoiceCollection(input: {
  amount: number;
  collectionDate: string;
  invoiceId: string;
  notes?: string;
  paymentMethodId: string;
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const { company, organization } = await getValidatedContext();
  const amount = normalizeAmount(input.amount);

  if (amount <= 0) {
    throw new Error("Ingresa un monto de cobro valido.");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, company_id, total, fecha, created_at")
    .eq("id", input.invoiceId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message ?? "Factura no encontrada.");
  }

  await assertPaymentPeriodIsOpen(
    invoice.company_id,
    invoice.fecha ?? invoice.created_at,
  );

  const summaries = await getInvoiceCollectionSummary([input.invoiceId]);
  const currentCollected = summaries.get(input.invoiceId)?.amount ?? 0;
  const remaining = getRemainingAmount(Number(invoice.total ?? 0), currentCollected);

  if (remaining > 0 && amount > remaining + 0.01) {
    throw new Error("El cobro supera el saldo pendiente de la factura.");
  }

  const { data: method, error: methodError } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("id", input.paymentMethodId)
    .eq("organization_id", organization.id)
    .eq("company_id", company.id)
    .eq("is_active", true)
    .single();

  if (methodError || !method) {
    throw new Error(methodError?.message ?? "Metodo de cobro no valido.");
  }

  const { data, error } = await supabase
    .from("invoice_collections")
    .insert({
      amount,
      collection_date: input.collectionDate,
      company_id: company.id,
      invoice_id: input.invoiceId,
      notes: input.notes?.trim() || null,
      organization_id: organization.id,
      payment_method_id: input.paymentMethodId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el cobro.");
  }

  return data as InvoiceCollection;
}
