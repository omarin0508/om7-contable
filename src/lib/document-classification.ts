import type {
  DocumentExtraction,
  ExtractedDocumentData,
} from "@/lib/document-processing";
import type { Company } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export type DocumentClassificationFlow =
  | "purchase"
  | "sale"
  | "expense"
  | "income"
  | "unknown";

export type DocumentClassificationCounterparty =
  | "supplier"
  | "customer"
  | "unknown";

export type DocumentClassificationStatus =
  | "suggested"
  | "accepted"
  | "rejected"
  | "edited";

export type DocumentClassificationResult = {
  flow_type: DocumentClassificationFlow;
  counterparty_type: DocumentClassificationCounterparty;
  suggested_account: string | null;
  suggested_category: string | null;
  suggested_cost_center_id: string | null;
  confidence_score: number;
  rule_applied: string;
  explanation: string;
  needs_review: boolean;
};

export type DocumentClassificationRecord = DocumentClassificationResult & {
  id: string;
  organization_id: string;
  company_id: string;
  document_id: string;
  extraction_id: string;
  status: DocumentClassificationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CounterpartyRuleRecord = {
  id: string;
  organization_id: string;
  counterparty_id: string;
  rule_name: string;
  flow_type: Exclude<DocumentClassificationFlow, "unknown">;
  suggested_category: string | null;
  suggested_account: string | null;
  suggested_cost_center_id: string | null;
  priority: number;
  is_active: boolean;
  created_from_document_id: string | null;
  created_from_classification_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ClassificationRule = {
  account: string;
  category: string;
  explanation: string;
  keywords: string[];
  rule: string;
};

type CounterpartyMatchForRule = {
  id: string;
  organization_id: string;
  company_id: string;
  document_id: string;
  extraction_id: string;
  classification_id: string | null;
  counterparty_id: string | null;
  status: string;
};

export const OM7_CLASSIFICATION_CATALOG: {
  categoryRules: ClassificationRule[];
  counterpartyRules: ClassificationRule[];
} = {
  categoryRules: [
    {
      account: "Gasto combustible",
      category: "Combustibles",
      explanation: "El detalle contiene terminos asociados a combustible.",
      keywords: [
        "combustible",
        "gasolina",
        "diesel",
        "diesel",
        "estacion de servicio",
      ],
      rule: "detail_fuel",
    },
    {
      account: "Electricidad",
      category: "Servicios publicos",
      explanation:
        "El detalle contiene terminos asociados a electricidad o energia.",
      keywords: ["electricidad", "ice", "cnfl", "energia"],
      rule: "detail_electricity",
    },
    {
      account: "Telecomunicaciones",
      category: "Telecomunicaciones",
      explanation:
        "El detalle contiene terminos asociados a telefono, internet o telecomunicaciones.",
      keywords: ["telefono", "internet", "telecomunicaciones"],
      rule: "detail_telecom",
    },
    {
      account: "Alquileres",
      category: "Alquileres",
      explanation:
        "El detalle contiene terminos asociados a alquiler o arrendamiento.",
      keywords: ["alquiler", "arrendamiento"],
      rule: "detail_rent",
    },
    {
      account: "Servicios profesionales",
      category: "Servicios profesionales",
      explanation:
        "El detalle contiene terminos asociados a honorarios o servicios profesionales.",
      keywords: ["honorarios", "servicios profesionales"],
      rule: "detail_professional_services",
    },
  ],
  counterpartyRules: [
    {
      account: "Electricidad",
      category: "Servicios publicos",
      explanation:
        "El emisor/proveedor coincide con entidades electricas frecuentes.",
      keywords: [
        "cnfl",
        "compania nacional de fuerza y luz",
        "instituto costarricense de electricidad",
      ],
      rule: "counterparty_electricity",
    },
    {
      account: "Telecomunicaciones",
      category: "Telecomunicaciones",
      explanation:
        "El emisor/proveedor coincide con entidades de telecomunicaciones frecuentes.",
      keywords: ["kolbi", "ice", "claro", "liberty", "telecom"],
      rule: "counterparty_telecom",
    },
    {
      account: "Gasto combustible",
      category: "Combustibles",
      explanation:
        "El emisor/proveedor coincide con terminos frecuentes de estaciones de servicio.",
      keywords: ["servicentro", "estacion de servicio", "gasolinera"],
      rule: "counterparty_fuel",
    },
  ],
};

function normalizeTaxId(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDocumentDetailText(data: ExtractedDocumentData | null) {
  const lineItems = Array.isArray(data?.line_items) ? data.line_items : [];
  const lineText = lineItems
    .map((line) =>
      [
        line.detalle,
        line.description,
        line.producto,
        line.item,
        line.name,
      ].join(" "),
    )
    .join(" ");

  return normalizeSearchText(
    [
      data?.notes,
      data?.supplier_name,
      data?.emisor_nombre,
      data?.document_kind,
      lineText,
    ].join(" "),
  );
}

function getCounterpartyText(data: ExtractedDocumentData | null) {
  return normalizeSearchText(
    [
      data?.supplier_name,
      data?.emisor_nombre,
      data?.customer_name,
      data?.receptor_nombre,
    ].join(" "),
  );
}

function getBaseFlow(data: ExtractedDocumentData | null, company: Company) {
  const companyTaxId = normalizeTaxId(company.tax_id);
  const issuerTaxId = normalizeTaxId(data?.emisor_cedula ?? data?.supplier_tax_id);
  const receiverTaxId = normalizeTaxId(data?.receptor_cedula ?? data?.customer_tax_id);

  if (companyTaxId && issuerTaxId && companyTaxId === issuerTaxId) {
    return {
      counterparty_type: "customer" as const,
      confidence: 0.9,
      explanation: "La cedula de la empresa coincide con el emisor del documento.",
      flow_type: "sale" as const,
      rule: "issuer_matches_company",
    };
  }

  if (companyTaxId && receiverTaxId && companyTaxId === receiverTaxId) {
    return {
      counterparty_type: "supplier" as const,
      confidence: 0.9,
      explanation: "La cedula de la empresa coincide con el receptor del documento.",
      flow_type: "purchase" as const,
      rule: "receiver_matches_company",
    };
  }

  return {
    counterparty_type: "unknown" as const,
    confidence: 0.35,
    explanation:
      "No se encontro coincidencia entre la cedula de la empresa y el emisor/receptor.",
    flow_type: "unknown" as const,
    rule: "tax_id_not_matched",
  };
}

function findRuleMatch(text: string, rules: ClassificationRule[]) {
  for (const rule of rules) {
    const matched = rule.keywords.some((keyword) =>
      text.includes(normalizeSearchText(keyword)),
    );

    if (matched) {
      return rule;
    }
  }

  return null;
}

function getCategorySuggestion(data: ExtractedDocumentData | null) {
  return (
    findRuleMatch(
      getDocumentDetailText(data),
      OM7_CLASSIFICATION_CATALOG.categoryRules,
    ) ??
    findRuleMatch(
      getCounterpartyText(data),
      OM7_CLASSIFICATION_CATALOG.counterpartyRules,
    )
  );
}

function getCounterpartyTypeForFlow(
  flowType: DocumentClassificationFlow,
): DocumentClassificationCounterparty {
  if (flowType === "purchase" || flowType === "expense") {
    return "supplier";
  }

  if (flowType === "sale" || flowType === "income") {
    return "customer";
  }

  return "unknown";
}

function applyCounterpartyRule(
  rule: CounterpartyRuleRecord,
): DocumentClassificationResult {
  return {
    flow_type: rule.flow_type,
    counterparty_type: getCounterpartyTypeForFlow(rule.flow_type),
    suggested_account: rule.suggested_account,
    suggested_category: rule.suggested_category,
    suggested_cost_center_id: rule.suggested_cost_center_id,
    confidence_score: 0.95,
    rule_applied: "counterparty_rule",
    explanation: "Se aplico una regla aprendida para esta contraparte.",
    needs_review: false,
  };
}

export function classifyDocumentByRules(
  extraction: Pick<DocumentExtraction, "extracted_data">,
  company: Company,
): DocumentClassificationResult {
  const data = extraction.extracted_data ?? null;
  const baseFlow = getBaseFlow(data, company);
  const category = getCategorySuggestion(data);
  const confidence = Math.min(
    0.98,
    baseFlow.confidence + (category ? 0.05 : 0),
  );

  return {
    flow_type: baseFlow.flow_type,
    counterparty_type: baseFlow.counterparty_type,
    suggested_account: category?.account ?? null,
    suggested_category: category?.category ?? null,
    suggested_cost_center_id: null,
    confidence_score: Number(confidence.toFixed(2)),
    rule_applied: category ? `${baseFlow.rule}+${category.rule}` : baseFlow.rule,
    explanation: category
      ? `${baseFlow.explanation} ${category.explanation}`
      : baseFlow.explanation,
    needs_review: confidence < 0.9 || baseFlow.flow_type === "unknown",
  };
}

export function classifyExtractedDocument(
  extraction: Pick<DocumentExtraction, "extracted_data">,
  company: Company,
) {
  return classifyDocumentByRules(extraction, company);
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

export async function getDocumentClassificationByExtraction(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_classifications")
    .select("*")
    .eq("extraction_id", extractionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as DocumentClassificationRecord | null;
}

export async function getActiveCounterpartyRule(
  counterpartyId: string | null | undefined,
  flowType?: DocumentClassificationFlow | null,
) {
  if (!counterpartyId) {
    return null;
  }

  const { supabase } = await getAuthenticatedSupabase();
  let query = supabase
    .from("counterparty_rules")
    .select("*")
    .eq("counterparty_id", counterpartyId)
    .eq("is_active", true);

  if (flowType && flowType !== "unknown") {
    query = query.eq("flow_type", flowType);
  }

  const { data, error } = await query
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CounterpartyRuleRecord | null;
}

async function getCounterpartyMatchForExtraction(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_counterparty_matches")
    .select("*")
    .eq("extraction_id", extractionId)
    .not("counterparty_id", "is", null)
    .in("status", ["accepted", "created", "edited", "suggested"])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CounterpartyMatchForRule | null;
}

export async function classifyAndStoreDocumentExtraction(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data: extraction, error: extractionError } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("id", extractionId)
    .single();

  if (extractionError || !extraction) {
    throw new Error(extractionError?.message ?? "Extraccion no encontrada.");
  }

  const typedExtraction = extraction as DocumentExtraction;
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", typedExtraction.company_id)
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message ?? "Empresa no encontrada.");
  }

  const baseResult = classifyDocumentByRules(typedExtraction, company as Company);
  const counterpartyMatch = await getCounterpartyMatchForExtraction(
    typedExtraction.id,
  );
  const learnedRule = await getActiveCounterpartyRule(
    counterpartyMatch?.counterparty_id,
    baseResult.flow_type,
  );
  const result = learnedRule ? applyCounterpartyRule(learnedRule) : baseResult;
  const { data, error } = await supabase
    .from("document_classifications")
    .upsert(
      {
        organization_id: typedExtraction.organization_id,
        company_id: typedExtraction.company_id,
        document_id: typedExtraction.document_id,
        extraction_id: typedExtraction.id,
        ...result,
        status: "suggested",
      },
      { onConflict: "extraction_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo clasificar el documento.");
  }

  return data as DocumentClassificationRecord;
}

export async function updateDocumentClassificationStatus(
  classificationId: string,
  status: DocumentClassificationStatus,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_classifications")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", classificationId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la clasificacion.");
  }

  return data as DocumentClassificationRecord;
}

export async function editDocumentClassification(
  classificationId: string,
  values: Partial<DocumentClassificationResult>,
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_classifications")
    .update({
      ...values,
      status: "edited",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", classificationId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo editar la clasificacion.");
  }

  return data as DocumentClassificationRecord;
}

export async function createCounterpartyRuleFromClassification(
  classificationId: string,
  matchId: string,
  values?: {
    ruleName?: string;
    suggestedAccount?: string | null;
    suggestedCategory?: string | null;
    suggestedCostCenterId?: string | null;
  },
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { data: classification, error: classificationError } = await supabase
    .from("document_classifications")
    .select("*")
    .eq("id", classificationId)
    .single();

  if (classificationError || !classification) {
    throw new Error(
      classificationError?.message ?? "Clasificacion no encontrada.",
    );
  }

  const typedClassification = classification as DocumentClassificationRecord;

  if (
    typedClassification.status !== "accepted" &&
    typedClassification.status !== "edited"
  ) {
    throw new Error(
      "Acepta o edita la clasificacion antes de guardarla como regla.",
    );
  }

  if (typedClassification.flow_type === "unknown") {
    throw new Error("Define el tipo de flujo antes de guardar la regla.");
  }

  const { data: match, error: matchError } = await supabase
    .from("document_counterparty_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error(matchError?.message ?? "Contraparte no encontrada.");
  }

  const typedMatch = match as CounterpartyMatchForRule;

  if (!typedMatch.counterparty_id) {
    throw new Error("Primero asocia o crea la contraparte detectada.");
  }

  const suggestedCategory =
    values?.suggestedCategory?.trim() ||
    typedClassification.suggested_category ||
    null;
  const suggestedAccount =
    values?.suggestedAccount?.trim() ||
    typedClassification.suggested_account ||
    null;
  const suggestedCostCenterId =
    values?.suggestedCostCenterId?.trim() ||
    typedClassification.suggested_cost_center_id ||
    null;

  const { data: existingRules, error: existingError } = await supabase
    .from("counterparty_rules")
    .select("*")
    .eq("counterparty_id", typedMatch.counterparty_id)
    .eq("flow_type", typedClassification.flow_type)
    .eq("is_active", true);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRule = ((existingRules ?? []) as CounterpartyRuleRecord[]).find(
    (rule) =>
      (rule.suggested_category ?? "") === (suggestedCategory ?? "") &&
      (rule.suggested_account ?? "") === (suggestedAccount ?? "") &&
      (rule.suggested_cost_center_id ?? "") === (suggestedCostCenterId ?? ""),
  );

  if (existingRule) {
    return existingRule;
  }

  const fallbackName =
    suggestedCategory ||
    suggestedAccount ||
    `Regla ${typedClassification.flow_type}`;
  const ruleName = values?.ruleName?.trim() || fallbackName;
  const { data, error } = await supabase
    .from("counterparty_rules")
    .insert({
      organization_id: typedClassification.organization_id,
      counterparty_id: typedMatch.counterparty_id,
      rule_name: ruleName,
      flow_type: typedClassification.flow_type,
      suggested_category: suggestedCategory,
      suggested_account: suggestedAccount,
      suggested_cost_center_id: suggestedCostCenterId,
      priority: 100,
      is_active: true,
      created_from_document_id: typedClassification.document_id,
      created_from_classification_id: typedClassification.id,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la regla aprendida.");
  }

  return data as CounterpartyRuleRecord;
}

export async function getAcceptedDocumentClassification(extractionId: string) {
  const classification = await getDocumentClassificationByExtraction(extractionId);

  if (
    classification?.status === "accepted" ||
    classification?.status === "edited"
  ) {
    return classification;
  }

  return null;
}

export async function getPreferredDocumentClassification(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_classifications")
    .select("*")
    .eq("extraction_id", extractionId)
    .in("status", ["edited", "accepted", "suggested"])
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const classifications = (data ?? []) as DocumentClassificationRecord[];
  const priority: Record<string, number> = {
    edited: 0,
    accepted: 1,
    suggested: 2,
  };

  return (
    classifications.sort(
      (left, right) => priority[left.status] - priority[right.status],
    )[0] ?? null
  );
}
