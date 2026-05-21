import { getActiveContext } from "@/lib/active-context";
import {
  normalizeReviewStatus,
  type AccountingReviewStatus,
} from "@/lib/accounting-review-ui";
import { normalizeTaxId } from "@/lib/counterparties";
import { normalizeCurrencyCode } from "@/lib/currency";
import type { ExtractedDocumentData } from "@/lib/document-processing";
import type { Company } from "@/lib/organizations";
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

export type UpdateInvoiceAccountingInput = {
  invoiceId: string;
  proveedor?: string;
  numeroDocumento?: string;
  fecha?: string;
  tipoDocumento?: string;
  subtotal?: number;
  impuesto?: number;
  total?: number;
  suggestedAccount?: string;
  suggestedCostCenterId?: string;
  notas?: string;
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

function normalizeComparableName(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function getInvoiceIssuerCompanyLabel(
  company: Pick<Company, "legal_name" | "name" | "tax_id"> | null | undefined,
) {
  if (!company) {
    return "Empresa activa";
  }

  return [company.legal_name || company.name, company.tax_id]
    .filter(Boolean)
    .join(" - ");
}

export function assertInvoiceIssuerMatchesCompany({
  company,
  data,
}: {
  company: Pick<Company, "legal_name" | "name" | "tax_id"> | null | undefined;
  data: ExtractedDocumentData | null | undefined;
}) {
  if (!company) {
    throw new Error("Selecciona una empresa activa antes de crear ventas.");
  }

  const companyTaxId = normalizeTaxId(company.tax_id);
  const issuerTaxId = normalizeTaxId(data?.emisor_cedula ?? data?.supplier_tax_id);

  if (companyTaxId && issuerTaxId && companyTaxId !== issuerTaxId) {
    throw new Error(
      `Esta venta no se puede crear porque el emisor del documento no coincide con la empresa activa (${getInvoiceIssuerCompanyLabel(company)}). En ventas, el emisor debe ser el cliente contable y el receptor debe ser el comprador.`,
    );
  }

  const issuerName = normalizeComparableName(
    data?.emisor_nombre ?? data?.supplier_name,
  );
  const companyNames = [
    normalizeComparableName(company.legal_name),
    normalizeComparableName(company.name),
  ].filter(Boolean);

  if (!companyTaxId && !issuerTaxId && issuerName && companyNames.length > 0) {
    const nameMatches = companyNames.some(
      (name) => name === issuerName || name.includes(issuerName) || issuerName.includes(name),
    );

    if (!nameMatches) {
      throw new Error(
        `Esta venta no se puede crear porque el emisor extraido (${data?.emisor_nombre ?? data?.supplier_name}) no coincide con la empresa activa (${getInvoiceIssuerCompanyLabel(company)}).`,
      );
    }
  }
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
  const asientoIds = [
    ...new Set(invoices.map((item) => item.asiento_contable_id).filter(Boolean)),
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
    invoices: invoices.map((invoice) => ({
      ...invoice,
      counterparty: invoice.counterparty_id
        ? counterpartyMap.get(invoice.counterparty_id) ?? null
        : null,
      source_document: invoice.source_document_id
        ? documentMap.get(invoice.source_document_id) ?? null
        : null,
      asiento_contable: invoice.asiento_contable_id
        ? asientoMap.get(invoice.asiento_contable_id) ?? null
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

export async function updateInvoiceAccountingFields(
  input: UpdateInvoiceAccountingInput,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de corregir facturas.");
  }

  const { data, error } = await supabase
    .from("invoices")
    .update({
      contabilizacion_error: null,
      estado_contable: "pendiente",
      fecha: input.fecha?.trim() || null,
      impuesto: input.impuesto ?? 0,
      notas: input.notas?.trim() || null,
      numero_documento: input.numeroDocumento?.trim() || null,
      proveedor: input.proveedor?.trim() || "Sin cliente",
      subtotal: input.subtotal ?? 0,
      suggested_account: input.suggestedAccount?.trim() || null,
      suggested_cost_center_id: input.suggestedCostCenterId?.trim() || null,
      tipo_documento: input.tipoDocumento?.trim() || "factura",
      total: input.total ?? 0,
    })
    .eq("id", input.invoiceId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .neq("estado_contable", "contabilizado")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo corregir la factura. Si ya esta contabilizada, anulala antes de editar.",
    );
  }

  return data as Invoice;
}
