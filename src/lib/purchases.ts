import { getActiveContext } from "@/lib/active-context";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

export type Purchase = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  supplier_name: string | null;
  document_number: string | null;
  purchase_date: string | null;
  category: string | null;
  description: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreatePurchaseInput = {
  supplierName?: string;
  documentNumber?: string;
  purchaseDate?: string;
  category?: string;
  description?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentMethod?: string;
  status?: string;
  notes?: string;
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

export async function listPurchases() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      purchases: [] as Purchase[],
    };
  }

  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .order("purchase_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeContext,
    purchases: (data ?? []) as Purchase[],
  };
}

export async function createPurchase(input: CreatePurchaseInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de crear compras.");
  }

  const { data, error } = await supabase
    .from("purchases")
    .insert({
      organization_id: activeContext.organization.id,
      company_id: activeContext.activeCompany.id,
      user_id: user.id,
      supplier_name: input.supplierName || null,
      document_number: input.documentNumber || null,
      purchase_date: input.purchaseDate || null,
      category: input.category || null,
      description: input.description || null,
      currency: normalizeCurrencyCode(
        input.currency ||
          activeContext.activeCompany.base_currency ||
          activeContext.organization.base_currency,
      ),
      subtotal: input.subtotal ?? 0,
      tax: input.tax ?? 0,
      total: input.total ?? 0,
      payment_method: input.paymentMethod || null,
      status: input.status || "registrada",
      notes: input.notes || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar la compra.");
  }

  return data as Purchase;
}
