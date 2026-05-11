import { getActiveContext } from "@/lib/active-context";
import {
  createDefaultAccountsForCompany,
  listAccountingAccounts,
  type AccountingAccount,
} from "@/lib/accounting-entries";
import { getCounterpartyMatchByExtraction } from "@/lib/counterparties";
import {
  getDocumentClassificationByExtraction,
  type DocumentClassificationRecord,
} from "@/lib/document-classification";
import type {
  DocumentExtraction,
  ExtractedDocumentData,
} from "@/lib/document-processing";
import {
  getDocumentViewerData,
  type DocumentRecord,
} from "@/lib/storage";
import { normalizeCurrencyCode } from "@/lib/currency";
import { createInvoiceForActiveCompany, type Invoice } from "@/lib/invoices";
import { createPurchase, type Purchase } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

export type E7DistributionStatus = "suggested" | "edited" | "approved";

export type E7TaxTreatment =
  | "iva_credito_fiscal"
  | "iva_debito_fiscal"
  | "exento"
  | "no_acreditable"
  | "not_applicable";

export type E7DistributionLine = {
  id: string;
  organization_id: string;
  company_id: string;
  document_id: string;
  extraction_id: string;
  classification_id: string | null;
  line_index: number;
  line_description: string;
  quantity: number | null;
  subtotal: number;
  tax: number;
  total: number;
  suggested_account: string | null;
  final_account: string | null;
  suggested_category: string | null;
  final_category: string | null;
  suggested_cost_center: string | null;
  final_cost_center: string | null;
  tax_treatment: E7TaxTreatment | string;
  confidence_score: number;
  rule_applied: string;
  status: E7DistributionStatus | string;
  corrected_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type E7SuggestedEntryLine = {
  account: string;
  amount: number;
  side: "debit" | "credit";
};

export type E7DistributionWorkspace = {
  accounts: AccountingAccount[];
  classification: DocumentClassificationRecord | null;
  counterpartyName: string | null;
  document: DocumentRecord;
  entryLines: E7SuggestedEntryLine[];
  extraction: DocumentExtraction | null;
  lines: E7DistributionLine[];
  totals: {
    credit: number;
    debit: number;
    difference: number;
    subtotal: number;
    tax: number;
    total: number;
  };
};

export type E7ConversionResult =
  | {
      action: "created" | "updated";
      recordId: string;
      recordType: "purchase" | "invoice";
      targetPath: "/compras" | "/facturas";
    }
  | {
      action: "prepared";
      reason: string;
      targetPath: string;
    };

type ExtractedLine = {
  description: string;
  lineIndex: number;
  quantity: number | null;
  subtotal: number;
  tax: number;
  total: number;
};

const costCenters = {
  admin: "Administracion",
  bodega: "Bodega",
  operacion: "Operacion",
  proyecto: "Proyecto",
};

const categoryRules = [
  {
    account: "5-01 Gastos generales",
    category: "Materiales construccion",
    costCenter: costCenters.proyecto,
    keywords: ["cemento", "arena", "varilla", "bloque", "concreto"],
    rule: "keyword_materials",
  },
  {
    account: "5-01 Gastos generales",
    category: "Instalaciones",
    costCenter: costCenters.operacion,
    keywords: ["tubo", "pvc", "cable", "instalacion", "conector"],
    rule: "keyword_installation",
  },
  {
    account: "5-01 Gastos generales",
    category: "Herramientas/equipo menor",
    costCenter: costCenters.bodega,
    keywords: ["herramienta", "taladro", "martillo", "equipo"],
    rule: "keyword_tools",
  },
  {
    account: "5-01 Gastos generales",
    category: "Servicios externos",
    costCenter: costCenters.admin,
    keywords: ["servicio", "honorario", "profesional", "consultoria"],
    rule: "keyword_services",
  },
  {
    account: "5-01 Gastos generales",
    category: "Transporte",
    costCenter: costCenters.operacion,
    keywords: ["transporte", "flete", "envio", "acarreo"],
    rule: "keyword_transport",
  },
] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function getLineDescription(line: Record<string, unknown>, index: number) {
  return (
    String(
      line.detalle ??
        line.description ??
        line.producto ??
        line.item ??
        line.name ??
        "",
    ).trim() || `Linea ${index + 1}`
  );
}

function getExtractedLines(data: ExtractedDocumentData | null): ExtractedLine[] {
  const rawLines = Array.isArray(data?.line_items) ? data.line_items : [];

  if (rawLines.length > 0) {
    return rawLines.map((line, index) => {
      const record = line as Record<string, unknown>;
      const total = numberValue(
        record.total_linea ?? record.total ?? record.amount ?? record.monto,
      );
      const tax = numberValue(record.impuesto ?? record.tax);
      const subtotal = numberValue(record.subtotal) || Math.max(total - tax, 0);

      return {
        description: getLineDescription(record, index),
        lineIndex: index,
        quantity: numberValue(record.cantidad ?? record.quantity) || null,
        subtotal,
        tax,
        total: total || subtotal + tax,
      };
    });
  }

  const subtotal = numberValue(data?.subtotal);
  const tax = numberValue(data?.impuesto ?? data?.tax);
  const total = numberValue(data?.total) || subtotal + tax;

  return [
    {
      description:
        String(
          data?.document_kind ??
            data?.notes ??
            data?.supplier_name ??
            data?.emisor_nombre ??
            "Documento sin lineas detectadas",
        ).trim() || "Documento sin lineas detectadas",
      lineIndex: 0,
      quantity: null,
      subtotal,
      tax,
      total,
    },
  ];
}

function inferTaxTreatment(
  classification: DocumentClassificationRecord | null,
  tax: number,
): E7TaxTreatment {
  if (tax <= 0) {
    return "exento";
  }

  if (
    classification?.flow_type === "sale" ||
    classification?.flow_type === "income"
  ) {
    return "iva_debito_fiscal";
  }

  if (
    classification?.flow_type === "purchase" ||
    classification?.flow_type === "expense"
  ) {
    return "iva_credito_fiscal";
  }

  return "no_acreditable";
}

function inferLineSuggestion(
  line: ExtractedLine,
  classification: DocumentClassificationRecord | null,
) {
  const text = normalizeText(line.description);
  const rule = categoryRules.find((item) =>
    item.keywords.some((keyword) => text.includes(normalizeText(keyword))),
  );
  const confidence = rule ? 0.9 : classification?.confidence_score ?? 0.55;

  return {
    account:
      rule?.account ??
      classification?.suggested_account ??
      (classification?.flow_type === "sale" || classification?.flow_type === "income"
        ? "4-01 Ventas / Ingresos"
        : "5-01 Gastos generales"),
    category:
      rule?.category ??
      classification?.suggested_category ??
      (classification?.flow_type === "sale" || classification?.flow_type === "income"
        ? "Ingresos"
        : "Gastos generales"),
    confidence: Number(confidence.toFixed(2)),
    costCenter: rule?.costCenter ?? costCenters.admin,
    rule: rule?.rule ?? classification?.rule_applied ?? "e7_default_rule",
    taxTreatment: inferTaxTreatment(classification, line.tax),
  };
}

function getFallbackAccount(
  accounts: AccountingAccount[],
  code: string,
  fallback: string,
) {
  const account = accounts.find((item) => item.code === code);
  return account ? `${account.code} ${account.name}` : fallback;
}

function buildEntryLines(
  lines: E7DistributionLine[],
  accounts: AccountingAccount[],
  classification: DocumentClassificationRecord | null,
) {
  const debit = new Map<string, number>();
  const credit = new Map<string, number>();
  const isIncome =
    classification?.flow_type === "sale" || classification?.flow_type === "income";
  const receivableOrPayable = isIncome
    ? getFallbackAccount(accounts, "1-03", "1-03 Cuentas por cobrar")
    : getFallbackAccount(accounts, "2-01", "2-01 Cuentas por pagar");
  const taxAccount = isIncome
    ? getFallbackAccount(accounts, "2-02", "2-02 IVA debito fiscal")
    : getFallbackAccount(accounts, "1-05", "1-05 IVA credito fiscal");

  for (const line of lines) {
    const account =
      line.final_account || line.suggested_account || "5-01 Gastos generales";
    const base = numberValue(line.subtotal);
    const tax = numberValue(line.tax);
    const total = numberValue(line.total) || base + tax;

    if (isIncome) {
      debit.set(receivableOrPayable, (debit.get(receivableOrPayable) ?? 0) + total);
      credit.set(account, (credit.get(account) ?? 0) + base);
      if (tax > 0) {
        credit.set(taxAccount, (credit.get(taxAccount) ?? 0) + tax);
      }
    } else {
      debit.set(account, (debit.get(account) ?? 0) + base);
      if (tax > 0) {
        debit.set(taxAccount, (debit.get(taxAccount) ?? 0) + tax);
      }
      credit.set(receivableOrPayable, (credit.get(receivableOrPayable) ?? 0) + total);
    }
  }

  return [
    ...[...debit.entries()].map(([account, amount]) => ({
      account,
      amount,
      side: "debit" as const,
    })),
    ...[...credit.entries()].map(([account, amount]) => ({
      account,
      amount,
      side: "credit" as const,
    })),
  ].filter((line) => line.amount > 0);
}

function getCounterpartyNameForRecord(
  data: ExtractedDocumentData | null | undefined,
  recordType: "purchase" | "invoice",
) {
  if (recordType === "invoice") {
    return (
      textValue(data?.receptor_nombre) ||
      textValue(data?.customer_name) ||
      textValue(data?.emisor_nombre) ||
      textValue(data?.supplier_name)
    );
  }

  return (
    textValue(data?.emisor_nombre) ||
    textValue(data?.supplier_name) ||
    textValue(data?.receptor_nombre) ||
    textValue(data?.customer_name)
  );
}

function inferRecordType({
  activeCompanyTaxId,
  classification,
  data,
  document,
}: {
  activeCompanyTaxId?: string | null;
  classification: DocumentClassificationRecord | null;
  data: ExtractedDocumentData | null | undefined;
  document: DocumentRecord;
}): "purchase" | "invoice" | null {
  if (document.converted_type === "purchase" || document.converted_type === "invoice") {
    return document.converted_type;
  }

  if (
    classification?.flow_type === "purchase" ||
    classification?.flow_type === "expense"
  ) {
    return "purchase";
  }

  if (
    classification?.flow_type === "sale" ||
    classification?.flow_type === "income"
  ) {
    return "invoice";
  }

  const normalizedCompanyTaxId = normalizeText(activeCompanyTaxId);
  const issuerTaxId = normalizeText(data?.emisor_cedula ?? data?.supplier_tax_id);
  const receiverTaxId = normalizeText(data?.receptor_cedula ?? data?.customer_tax_id);

  if (normalizedCompanyTaxId && normalizedCompanyTaxId === receiverTaxId) {
    return "purchase";
  }

  if (normalizedCompanyTaxId && normalizedCompanyTaxId === issuerTaxId) {
    return "invoice";
  }

  return null;
}

function getE7ConversionMetadata({
  approvedAt,
  approvedBy,
  classification,
  extraction,
  lines,
}: {
  approvedAt: string;
  approvedBy: string;
  classification: DocumentClassificationRecord | null;
  extraction: DocumentExtraction;
  lines: E7DistributionLine[];
}) {
  const confidenceValues = lines.map((line) => numberValue(line.confidence_score));
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) /
        confidenceValues.length
      : classification?.confidence_score ?? 0;

  return {
    approved_at: approvedAt,
    approved_by: approvedBy,
    created_from: "e7_mind_distribution",
    distribution_id: lines[0]?.id ?? null,
    distribution_line_ids: lines.map((line) => line.id),
    e7_mind: {
      approved_at: approvedAt,
      approved_by: approvedBy,
      average_confidence: Number(averageConfidence.toFixed(2)),
      distribution_id: lines[0]?.id ?? null,
      distribution_line_ids: lines.map((line) => line.id),
      flow_type: classification?.flow_type ?? "unknown",
      rule_applied:
        classification?.rule_applied ??
        lines[0]?.rule_applied ??
        "e7_distribution",
    },
    rule_applied:
      classification?.rule_applied ?? lines[0]?.rule_applied ?? "e7_distribution",
    confidence:
      classification?.confidence_score ?? Number(averageConfidence.toFixed(2)),
    source_document_id: extraction.document_id,
    source_extraction_id: extraction.id,
  };
}

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

async function getAccounts(companyId: string) {
  const result = await listAccountingAccounts(companyId).catch(() => ({
    accounts: [] as AccountingAccount[],
  }));

  if (result.accounts.length > 0) {
    return result.accounts;
  }

  return (await createDefaultAccountsForCompany(companyId)).accounts;
}

async function ensureSuggestedDistributions({
  classification,
  extraction,
}: {
  classification: DocumentClassificationRecord | null;
  extraction: DocumentExtraction;
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const extractedLines = getExtractedLines(extraction.extracted_data ?? null);
  const { data: existing, error: existingError } = await supabase
    .from("document_accounting_distributions")
    .select("*")
    .eq("extraction_id", extraction.id)
    .order("line_index", { ascending: true });

  if (existingError) {
    throw new Error(existingError.message);
  }

  if ((existing ?? []).length >= extractedLines.length) {
    return (existing ?? []) as E7DistributionLine[];
  }

  const payload = extractedLines.map((line) => {
    const suggestion = inferLineSuggestion(line, classification);

    return {
      classification_id: classification?.id ?? null,
      company_id: extraction.company_id,
      confidence_score: suggestion.confidence,
      document_id: extraction.document_id,
      extraction_id: extraction.id,
      final_account: suggestion.account,
      final_category: suggestion.category,
      final_cost_center: suggestion.costCenter,
      line_description: line.description,
      line_index: line.lineIndex,
      metadata: {
        e7_mind_version: "v1",
        suggested_at: new Date().toISOString(),
      },
      organization_id: extraction.organization_id,
      quantity: line.quantity,
      rule_applied: suggestion.rule,
      status: "suggested",
      subtotal: line.subtotal,
      suggested_account: suggestion.account,
      suggested_category: suggestion.category,
      suggested_cost_center: suggestion.costCenter,
      tax: line.tax,
      tax_treatment: suggestion.taxTreatment,
      total: line.total,
    };
  });

  const { data, error } = await supabase
    .from("document_accounting_distributions")
    .upsert(payload, {
      onConflict: "extraction_id,line_index",
    })
    .select("*")
    .order("line_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as E7DistributionLine[];
}

export async function getE7DistributionWorkspace(
  documentId: string,
): Promise<E7DistributionWorkspace> {
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa.");
  }

  const viewer = await getDocumentViewerData(documentId);
  const extraction = viewer.extraction;

  if (!extraction) {
    return {
      accounts: [],
      classification: null,
      counterpartyName: null,
      document: viewer.document,
      entryLines: [],
      extraction: null,
      lines: [],
      totals: {
        credit: 0,
        debit: 0,
        difference: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
      },
    };
  }

  const [classification, counterpartyMatch, accounts] = await Promise.all([
    getDocumentClassificationByExtraction(extraction.id),
    getCounterpartyMatchByExtraction(extraction.id).catch(() => null),
    getAccounts(extraction.company_id).catch(() => [] as AccountingAccount[]),
  ]);
  const lines = await ensureSuggestedDistributions({
    classification,
    extraction,
  });
  const entryLines = buildEntryLines(lines, accounts, classification);
  const debit = entryLines
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + line.amount, 0);
  const credit = entryLines
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + line.amount, 0);

  return {
    accounts,
    classification,
    counterpartyName: counterpartyMatch?.name ?? null,
    document: viewer.document,
    entryLines,
    extraction,
    lines,
    totals: {
      credit,
      debit,
      difference: Number((debit - credit).toFixed(2)),
      subtotal: lines.reduce((sum, line) => sum + numberValue(line.subtotal), 0),
      tax: lines.reduce((sum, line) => sum + numberValue(line.tax), 0),
      total: lines.reduce((sum, line) => sum + numberValue(line.total), 0),
    },
  };
}

export async function updateE7DistributionLines(
  documentId: string,
  lines: Array<{
    account: string;
    category: string;
    costCenter: string;
    id: string;
    taxTreatment: E7TaxTreatment | string;
  }>,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa.");
  }

  for (const line of lines) {
    const { error } = await supabase
      .from("document_accounting_distributions")
      .update({
        corrected_by: user.id,
        final_account: line.account || null,
        final_category: line.category || null,
        final_cost_center: line.costCenter || null,
        status: "edited",
        tax_treatment: line.taxTreatment,
      })
      .eq("id", line.id)
      .eq("document_id", documentId)
      .eq("organization_id", activeContext.organization.id)
      .eq("company_id", activeContext.activeCompany.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function approveE7Distribution(documentId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa.");
  }

  const approvedAt = new Date().toISOString();
  const { error } = await supabase
    .from("document_accounting_distributions")
    .update({
      approved_at: approvedAt,
      approved_by: user.id,
      status: "approved",
    })
    .eq("document_id", documentId)
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    approvedAt,
    approvedBy: user.id,
  };
}

async function findExistingConvertedRecord({
  companyId,
  document,
  organizationId,
  recordType,
}: {
  companyId: string;
  document: DocumentRecord;
  organizationId: string;
  recordType: "purchase" | "invoice";
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const table = recordType === "purchase" ? "purchases" : "invoices";

  if (document.converted_type === recordType && document.converted_record_id) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", document.converted_record_id)
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data as Purchase | Invoice;
    }
  }

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("source_document_id", document.id)
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Purchase | Invoice | null;
}

async function markDocumentConvertedFromE7({
  approvedAt,
  approvedBy,
  document,
  extraction,
  recordId,
  recordType,
}: {
  approvedAt: string;
  approvedBy: string;
  document: DocumentRecord;
  extraction: DocumentExtraction;
  recordId: string;
  recordType: "purchase" | "invoice";
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const { error } = await supabase
    .from("documents")
    .update({
      converted_at: document.converted_at ?? approvedAt,
      converted_by: document.converted_by ?? approvedBy,
      converted_record_id: recordId,
      converted_type: recordType,
      conversion_notes: `Registro ${recordType === "purchase" ? "compra" : "factura"} sincronizado desde E7 Mind ${extraction.id}.`,
      updated_at: approvedAt,
      updated_by: approvedBy,
    })
    .eq("id", document.id)
    .eq("organization_id", document.organization_id)
    .eq("company_id", document.company_id);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateConvertedRecordFromE7({
  classification,
  counterpartyId,
  data,
  extraction,
  metadata,
  record,
  recordType,
}: {
  classification: DocumentClassificationRecord | null;
  counterpartyId: string | null | undefined;
  data: ExtractedDocumentData | null | undefined;
  extraction: DocumentExtraction;
  metadata: Record<string, unknown>;
  record: Purchase | Invoice;
  recordType: "purchase" | "invoice";
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const common = {
    classification_confidence: classification?.confidence_score ?? null,
    classification_id: classification?.id ?? null,
    classification_rule_applied: classification?.rule_applied ?? null,
    conversion_metadata: {
      ...((record.conversion_metadata ?? {}) as Record<string, unknown>),
      ...metadata,
    },
    counterparty_id: counterpartyId || null,
    source_document_id: extraction.document_id,
    source_extraction_id: extraction.id,
    suggested_account: classification?.suggested_account ?? null,
    suggested_cost_center_id: classification?.suggested_cost_center_id ?? null,
  };

  if (recordType === "purchase") {
    const { error } = await supabase
      .from("purchases")
      .update({
        ...common,
        category: classification?.suggested_category ?? (record as Purchase).category,
        currency: normalizeCurrencyCode(data?.moneda ?? data?.currency),
        document_number:
          textValue(data?.numero_consecutivo ?? data?.document_number) ||
          (record as Purchase).document_number,
        purchase_date:
          textValue(data?.fecha_emision ?? data?.date) ||
          (record as Purchase).purchase_date,
        supplier_name:
          getCounterpartyNameForRecord(data, "purchase") ||
          (record as Purchase).supplier_name,
        subtotal: numberValue(data?.subtotal),
        tax: numberValue(data?.impuesto ?? data?.tax),
        total: numberValue(data?.total),
      })
      .eq("id", record.id)
      .eq("organization_id", extraction.organization_id)
      .eq("company_id", extraction.company_id);

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      ...common,
      fecha:
        textValue(data?.fecha_emision ?? data?.date) ||
        (record as Invoice).fecha,
      moneda: normalizeCurrencyCode(data?.moneda ?? data?.currency),
      numero_documento:
        textValue(data?.numero_consecutivo ?? data?.document_number) ||
        (record as Invoice).numero_documento,
      proveedor:
        getCounterpartyNameForRecord(data, "invoice") ||
        (record as Invoice).proveedor,
      subtotal: numberValue(data?.subtotal),
      impuesto: numberValue(data?.impuesto ?? data?.tax),
      total: numberValue(data?.total),
    })
    .eq("id", record.id)
    .eq("organization_id", extraction.organization_id)
    .eq("company_id", extraction.company_id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function approveAndSyncE7Distribution(
  documentId: string,
): Promise<E7ConversionResult> {
  const workspace = await getE7DistributionWorkspace(documentId);
  const { classification, document, extraction, lines } = workspace;

  if (!extraction) {
    throw new Error("Primero procesa o revisa el documento para generar la extraccion.");
  }

  if (lines.length === 0) {
    throw new Error("No hay lineas de distribucion para aprobar.");
  }

  const recordType = inferRecordType({
    activeCompanyTaxId: (await getActiveContext()).activeCompany?.tax_id,
    classification,
    data: extraction.extracted_data,
    document,
  });

  const approval = await approveE7Distribution(documentId);

  if (!recordType) {
    return {
      action: "prepared",
      reason:
        "Distribucion aprobada. Falta elegir si el documento se convierte a compra o factura.",
      targetPath: `/documentos/${documentId}`,
    };
  }

  const counterpartyMatch = await getCounterpartyMatchByExtraction(
    extraction.id,
  ).catch(() => null);
  const metadata = getE7ConversionMetadata({
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
    classification,
    extraction,
    lines,
  });
  const existing = await findExistingConvertedRecord({
    companyId: extraction.company_id,
    document,
    organizationId: extraction.organization_id,
    recordType,
  });
  const data = extraction.extracted_data ?? {};

  if (existing) {
    await updateConvertedRecordFromE7({
      classification,
      counterpartyId: counterpartyMatch?.counterparty_id,
      data,
      extraction,
      metadata,
      record: existing,
      recordType,
    });
    await markDocumentConvertedFromE7({
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      document,
      extraction,
      recordId: existing.id,
      recordType,
    });

    return {
      action: "updated",
      recordId: existing.id,
      recordType,
      targetPath: recordType === "purchase" ? "/compras" : "/facturas",
    };
  }

  if (numberValue(data.total) <= 0) {
    throw new Error("Falta el total del documento para crear el registro.");
  }

  const sourceLabel =
    extraction.extraction_provider === "xml-parser-cr" ? "XML" : "documento";
  const clave = textValue(data.clave);
  const commonMetadata = {
    conversionMetadata: metadata,
    counterpartyId: counterpartyMatch?.counterparty_id ?? undefined,
    classificationConfidence: classification?.confidence_score,
    classificationId: classification?.id,
    classificationRuleApplied: classification?.rule_applied,
    sourceDocumentId: extraction.document_id,
    sourceExtractionId: extraction.id,
    suggestedAccount: classification?.suggested_account ?? undefined,
    suggestedCostCenterId: classification?.suggested_cost_center_id ?? undefined,
  };

  const created =
    recordType === "purchase"
      ? await createPurchase({
          ...commonMetadata,
          category:
            classification?.suggested_category ??
            (extraction.extraction_provider === "xml-parser-cr"
              ? "XML Costa Rica"
              : "Documento procesado"),
          currency: normalizeCurrencyCode(data.moneda ?? data.currency),
          description: `Creado desde E7 Mind (${sourceLabel}): ${clave}`,
          documentNumber: textValue(
            data.numero_consecutivo ?? data.document_number,
          ),
          notes: `Creado desde E7 Mind con distribucion aprobada.`,
          paymentMethod: textValue(data.medio_pago),
          purchaseDate: textValue(data.fecha_emision ?? data.date),
          status: "registrada",
          subtotal: numberValue(data.subtotal),
          supplierName: getCounterpartyNameForRecord(data, "purchase"),
          tax: numberValue(data.impuesto ?? data.tax),
          total: numberValue(data.total),
        })
      : await createInvoiceForActiveCompany({
          ...commonMetadata,
          estado: "registrada",
          fecha: textValue(data.fecha_emision ?? data.date),
          impuesto: numberValue(data.impuesto ?? data.tax),
          moneda: normalizeCurrencyCode(data.moneda ?? data.currency),
          notas: `Creado desde E7 Mind con distribucion aprobada.`,
          numeroDocumento: textValue(
            data.numero_consecutivo ?? data.document_number,
          ),
          proveedor: getCounterpartyNameForRecord(data, "invoice"),
          subtotal: numberValue(data.subtotal),
          tipoDocumento: textValue(data.document_kind) || "factura",
          total: numberValue(data.total),
        });

  await markDocumentConvertedFromE7({
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
    document,
    extraction,
    recordId: created.id,
    recordType,
  });

  return {
    action: "created",
    recordId: created.id,
    recordType,
    targetPath: recordType === "purchase" ? "/compras" : "/facturas",
  };
}
