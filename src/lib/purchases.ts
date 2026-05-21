import { getActiveContext } from "@/lib/active-context";
import {
  normalizeReviewStatus,
  type AccountingReviewStatus,
} from "@/lib/accounting-review-ui";
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
  review_status?: AccountingReviewStatus | string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;
  asiento_contable_id?: string | null;
  estado_contable?: string | null;
  contabilizacion_error?: string | null;
  counterparty_id?: string | null;
  classification_id?: string | null;
  classification_rule_applied?: string | null;
  classification_confidence?: number | null;
  suggested_account?: string | null;
  suggested_cost_center_id?: string | null;
  source_document_id?: string | null;
  source_extraction_id?: string | null;
  conversion_metadata?: Record<string, unknown> | null;
  counterparty?: {
    id: string;
    name: string;
    tax_id: string | null;
    type: string;
  } | null;
  source_document?: {
    id: string;
    display_name: string | null;
    original_filename: string | null;
    converted_at: string | null;
  } | null;
  asiento_contable?: {
    id: string;
    numero_asiento: number;
    estado: string;
    total_debito: number;
    total_credito: number;
  } | null;
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
  counterpartyId?: string;
  classificationId?: string;
  classificationRuleApplied?: string;
  classificationConfidence?: number;
  suggestedAccount?: string;
  suggestedCostCenterId?: string;
  sourceDocumentId?: string;
  sourceExtractionId?: string;
  conversionMetadata?: Record<string, unknown>;
};

export type UpdatePurchaseReviewStatusInput = {
  purchaseId: string;
  status: AccountingReviewStatus | string;
  notes?: string;
};

export type UpdatePurchaseAccountingInput = {
  purchaseId: string;
  supplierName?: string;
  documentNumber?: string;
  purchaseDate?: string;
  category?: string;
  description?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  suggestedAccount?: string;
  suggestedCostCenterId?: string;
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

  const purchases = (data ?? []) as Purchase[];
  const counterpartyIds = [
    ...new Set(purchases.map((item) => item.counterparty_id).filter(Boolean)),
  ] as string[];
  const documentIds = [
    ...new Set(purchases.map((item) => item.source_document_id).filter(Boolean)),
  ] as string[];
  const asientoIds = [
    ...new Set(purchases.map((item) => item.asiento_contable_id).filter(Boolean)),
  ] as string[];
  const [{ data: counterparties }, { data: documents }, { data: asientos }] =
    await Promise.all([
      counterpartyIds.length > 0
        ? supabase
            .from("counterparties")
            .select("id, name, tax_id, type")
            .in("id", counterpartyIds)
        : Promise.resolve({ data: [] }),
      documentIds.length > 0
        ? supabase
            .from("documents")
            .select("id, display_name, original_filename, converted_at")
            .in("id", documentIds)
        : Promise.resolve({ data: [] }),
      asientoIds.length > 0
        ? supabase
            .from("asientos_contables")
            .select("id, numero_asiento, estado, total_debito, total_credito")
            .in("id", asientoIds)
        : Promise.resolve({ data: [] }),
    ]);
  const counterpartyMap = new Map(
    (counterparties ?? []).map((item) => [item.id, item]),
  );
  const documentMap = new Map((documents ?? []).map((item) => [item.id, item]));
  const asientoMap = new Map((asientos ?? []).map((item) => [item.id, item]));

  return {
    activeContext,
    purchases: purchases.map((purchase) => ({
      ...purchase,
      counterparty: purchase.counterparty_id
        ? counterpartyMap.get(purchase.counterparty_id) ?? null
        : null,
      source_document: purchase.source_document_id
        ? documentMap.get(purchase.source_document_id) ?? null
        : null,
      asiento_contable: purchase.asiento_contable_id
        ? asientoMap.get(purchase.asiento_contable_id) ?? null
        : null,
    })),
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
      counterparty_id: input.counterpartyId || null,
      classification_id: input.classificationId || null,
      classification_rule_applied: input.classificationRuleApplied || null,
      classification_confidence: input.classificationConfidence ?? null,
      suggested_account: input.suggestedAccount || null,
      suggested_cost_center_id: input.suggestedCostCenterId || null,
      source_document_id: input.sourceDocumentId || null,
      source_extraction_id: input.sourceExtractionId || null,
      conversion_metadata: input.sourceDocumentId
        ? {
            created_from: "document_extraction",
            source_document_id: input.sourceDocumentId,
            source_extraction_id: input.sourceExtractionId ?? null,
            ...(input.conversionMetadata ?? {}),
          }
        : null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar la compra.");
  }

  return data as Purchase;
}

export async function updatePurchaseReviewStatus(
  input: UpdatePurchaseReviewStatusInput,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de revisar compras.");
  }

  const reviewStatus = normalizeReviewStatus(input.status);
  const reviewNotes = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from("purchases")
    .update({
      review_notes: reviewNotes,
      review_status: reviewStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", input.purchaseId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo actualizar la compra. Si la ves en pantalla, falta aplicar la policy de actualizacion del schema 023 en Supabase.",
    );
  }

  return data as Purchase;
}

export async function updatePurchaseAccountingFields(
  input: UpdatePurchaseAccountingInput,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de corregir compras.");
  }

  const { data, error } = await supabase
    .from("purchases")
    .update({
      category: input.category?.trim() || null,
      contabilizacion_error: null,
      description: input.description?.trim() || null,
      document_number: input.documentNumber?.trim() || null,
      estado_contable: "pendiente",
      notes: input.notes?.trim() || null,
      purchase_date: input.purchaseDate?.trim() || null,
      subtotal: input.subtotal ?? 0,
      suggested_account: input.suggestedAccount?.trim() || null,
      suggested_cost_center_id: input.suggestedCostCenterId?.trim() || null,
      supplier_name: input.supplierName?.trim() || null,
      tax: input.tax ?? 0,
      total: input.total ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.purchaseId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .neq("estado_contable", "contabilizado")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo corregir la compra. Si ya esta contabilizada, anulala antes de editar.",
    );
  }

  return data as Purchase;
}
