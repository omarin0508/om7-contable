import { getActiveContext } from "@/lib/active-context";
import {
  normalizeReviewStatus,
  type AccountingReviewStatus,
} from "@/lib/accounting-review-ui";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

export type Invoice = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  tipo_documento: string;
  proveedor: string;
  numero_documento: string | null;
  fecha: string | null;
  moneda: string | null;
  subtotal: number | null;
  impuesto: number | null;
  total: number | null;
  estado: string;
  notas: string | null;
  review_status?: AccountingReviewStatus | string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_notes?: string | null;
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
  created_at: string | null;
};

export type CreateInvoiceInput = {
  tipoDocumento: string;
  proveedor: string;
  numeroDocumento?: string;
  fecha?: string;
  moneda?: string;
  subtotal?: number;
  impuesto?: number;
  total?: number;
  estado?: string;
  notas?: string;
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

export type UpdateInvoiceReviewStatusInput = {
  invoiceId: string;
  status: AccountingReviewStatus | string;
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

export async function getInvoicesForActiveCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      invoices: [] as Invoice[],
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const invoices = (data ?? []) as Invoice[];
  const counterpartyIds = [
    ...new Set(invoices.map((item) => item.counterparty_id).filter(Boolean)),
  ] as string[];
  const documentIds = [
    ...new Set(invoices.map((item) => item.source_document_id).filter(Boolean)),
  ] as string[];
  const [{ data: counterparties }, { data: documents }] = await Promise.all([
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
  ]);
  const counterpartyMap = new Map(
    (counterparties ?? []).map((item) => [item.id, item]),
  );
  const documentMap = new Map((documents ?? []).map((item) => [item.id, item]));

  return {
    activeContext,
    invoices: invoices.map((invoice) => ({
      ...invoice,
      counterparty: invoice.counterparty_id
        ? counterpartyMap.get(invoice.counterparty_id) ?? null
        : null,
      source_document: invoice.source_document_id
        ? documentMap.get(invoice.source_document_id) ?? null
        : null,
    })),
  };
}

export async function createInvoiceForActiveCompany(input: CreateInvoiceInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de crear facturas.");
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: activeContext.organization.id,
      company_id: activeContext.activeCompany.id,
      user_id: user.id,
      tipo_documento: input.tipoDocumento || "factura",
      proveedor: input.proveedor,
      numero_documento: input.numeroDocumento || null,
      fecha: input.fecha || null,
      moneda: normalizeCurrencyCode(
        input.moneda ||
          activeContext.activeCompany.base_currency ||
          activeContext.organization.base_currency,
      ),
      subtotal: input.subtotal ?? 0,
      impuesto: input.impuesto ?? 0,
      total: input.total ?? 0,
      estado: input.estado || "borrador",
      notas: input.notas || null,
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
    throw new Error(error?.message ?? "No se pudo crear la factura.");
  }

  return data as Invoice;
}

export async function updateInvoiceReviewStatus(
  input: UpdateInvoiceReviewStatusInput,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de revisar facturas.");
  }

  const reviewStatus = normalizeReviewStatus(input.status);
  const reviewNotes = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from("invoices")
    .update({
      review_notes: reviewNotes,
      review_status: reviewStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", input.invoiceId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo actualizar la factura. Si la ves en pantalla, falta aplicar la policy de actualizacion del schema 023 en Supabase.",
    );
  }

  return data as Invoice;
}
