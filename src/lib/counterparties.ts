import type {
  DocumentClassificationFlow,
  DocumentClassificationRecord,
} from "@/lib/document-classification";
import type {
  DocumentExtraction,
  ExtractedDocumentData,
} from "@/lib/document-processing";
import type { Company } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export type CounterpartyType = "supplier" | "customer" | "both";
export type CounterpartyMatchStatus = "exact" | "probable" | "none";
export type CounterpartyMatchReviewStatus =
  | "suggested"
  | "accepted"
  | "created"
  | "rejected"
  | "edited";

export type CounterpartyRecord = {
  id: string;
  organization_id: string;
  company_id: string | null;
  type: CounterpartyType;
  name: string;
  normalized_name: string;
  tax_id: string | null;
  normalized_tax_id: string | null;
  email: string | null;
  phone: string | null;
  notes?: string | null;
  source: "manual" | "document" | "imported";
  default_category: string | null;
  default_account: string | null;
  default_cost_center_id: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CounterpartyFilters = {
  query?: string;
  status?: "active" | "inactive" | "all";
  type?: CounterpartyType | "all";
};

export type CounterpartyInput = {
  email?: string;
  isActive?: boolean;
  name: string;
  notes?: string;
  phone?: string;
  taxId?: string;
  type: CounterpartyType;
};

export type CounterpartyMatchResult = {
  match_status: CounterpartyMatchStatus;
  counterparty_id: string | null;
  counterparty_type: CounterpartyType;
  name: string;
  tax_id: string | null;
  confidence_score: number;
  explanation: string;
};

export type DocumentCounterpartyMatchRecord = CounterpartyMatchResult & {
  id: string;
  organization_id: string;
  company_id: string;
  document_id: string;
  extraction_id: string;
  classification_id: string | null;
  status: CounterpartyMatchReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function normalizeTaxId(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function normalizeCounterpartyName(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getTokens(value: string) {
  return normalizeCounterpartyName(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function nameSimilarity(left: string, right: string) {
  const leftTokens = new Set(getTokens(left));
  const rightTokens = new Set(getTokens(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

function inferCounterpartyType(
  flowType: DocumentClassificationFlow | null | undefined,
  data: ExtractedDocumentData | null,
  company: Company,
): CounterpartyType {
  if (flowType === "purchase" || flowType === "expense") {
    return "supplier";
  }

  if (flowType === "sale" || flowType === "income") {
    return "customer";
  }

  const companyTaxId = normalizeTaxId(company.tax_id);
  const issuerTaxId = normalizeTaxId(data?.emisor_cedula ?? data?.supplier_tax_id);
  const receiverTaxId = normalizeTaxId(data?.receptor_cedula ?? data?.customer_tax_id);

  if (companyTaxId && companyTaxId === receiverTaxId) {
    return "supplier";
  }

  if (companyTaxId && companyTaxId === issuerTaxId) {
    return "customer";
  }

  return "supplier";
}

function getCounterpartyCandidate(
  data: ExtractedDocumentData | null,
  counterpartyType: CounterpartyType,
) {
  if (counterpartyType === "customer") {
    return {
      name: String(data?.receptor_nombre ?? data?.customer_name ?? "").trim(),
      taxId: String(data?.receptor_cedula ?? data?.customer_tax_id ?? "").trim(),
    };
  }

  return {
    name: String(data?.emisor_nombre ?? data?.supplier_name ?? "").trim(),
    taxId: String(data?.emisor_cedula ?? data?.supplier_tax_id ?? "").trim(),
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

export async function findCounterpartyMatch(
  extraction: Pick<DocumentExtraction, "extracted_data">,
  company: Company,
  flowType?: DocumentClassificationFlow | null,
): Promise<CounterpartyMatchResult> {
  const { supabase } = await getAuthenticatedSupabase();
  const data = extraction.extracted_data ?? null;
  const counterpartyType = inferCounterpartyType(flowType, data, company);
  const candidate = getCounterpartyCandidate(data, counterpartyType);
  const normalizedTaxId = normalizeTaxId(candidate.taxId);
  const normalizedName = normalizeCounterpartyName(candidate.name);

  if (!candidate.name && !candidate.taxId) {
    return {
      match_status: "none",
      counterparty_id: null,
      counterparty_type: counterpartyType,
      name: "",
      tax_id: null,
      confidence_score: 0,
      explanation: "No se detecto nombre ni cedula de contraparte.",
    };
  }

  if (normalizedTaxId) {
    const { data: taxMatch, error } = await supabase
      .from("counterparties")
      .select("*")
      .eq("organization_id", company.organization_id)
      .eq("normalized_tax_id", normalizedTaxId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (taxMatch) {
      return {
        match_status: "exact",
        counterparty_id: taxMatch.id,
        counterparty_type: taxMatch.type,
        name: taxMatch.name,
        tax_id: taxMatch.tax_id,
        confidence_score: 0.99,
        explanation: "Coincidencia exacta por cedula/tax_id.",
      };
    }
  }

  if (normalizedName) {
    const { data: nameMatch, error } = await supabase
      .from("counterparties")
      .select("*")
      .eq("organization_id", company.organization_id)
      .eq("normalized_name", normalizedName)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (nameMatch) {
      return {
        match_status: "exact",
        counterparty_id: nameMatch.id,
        counterparty_type: nameMatch.type,
        name: nameMatch.name,
        tax_id: nameMatch.tax_id,
        confidence_score: 0.92,
        explanation: "Coincidencia exacta por nombre normalizado.",
      };
    }
  }

  const { data: counterparties, error } = await supabase
    .from("counterparties")
    .select("*")
    .eq("organization_id", company.organization_id)
    .eq("is_active", true)
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const probable = ((counterparties ?? []) as CounterpartyRecord[])
    .map((item) => ({
      counterparty: item,
      score: nameSimilarity(candidate.name, item.name),
    }))
    .filter((item) => item.score >= 0.6)
    .sort((left, right) => right.score - left.score)[0];

  if (probable) {
    return {
      match_status: "probable",
      counterparty_id: probable.counterparty.id,
      counterparty_type: probable.counterparty.type,
      name: probable.counterparty.name,
      tax_id: probable.counterparty.tax_id,
      confidence_score: Number(probable.score.toFixed(2)),
      explanation: "Coincidencia probable por similitud basica de nombre.",
    };
  }

  return {
    match_status: "none",
    counterparty_id: null,
    counterparty_type: counterpartyType,
    name: candidate.name,
    tax_id: candidate.taxId || null,
    confidence_score: candidate.taxId ? 0.65 : 0.45,
    explanation: "No existe contraparte registrada; se sugiere crear una nueva.",
  };
}

export async function detectAndStoreCounterpartyMatch(
  extractionId: string,
  classification: DocumentClassificationRecord | null,
) {
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

  const match = await findCounterpartyMatch(
    typedExtraction,
    company as Company,
    classification?.flow_type,
  );

  const { data, error } = await supabase
    .from("document_counterparty_matches")
    .upsert(
      {
        organization_id: typedExtraction.organization_id,
        company_id: typedExtraction.company_id,
        document_id: typedExtraction.document_id,
        extraction_id: typedExtraction.id,
        classification_id: classification?.id ?? null,
        ...match,
        status: "suggested",
      },
      { onConflict: "extraction_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la contraparte.");
  }

  return data as DocumentCounterpartyMatchRecord;
}

export async function getCounterpartyMatchByExtraction(extractionId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_counterparty_matches")
    .select("*")
    .eq("extraction_id", extractionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as DocumentCounterpartyMatchRecord | null;
}

export async function acceptCounterpartyMatch(matchId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_counterparty_matches")
    .update({
      status: "accepted",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", matchId)
    .not("counterparty_id", "is", null)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo aceptar la contraparte detectada.",
    );
  }

  const match = data as DocumentCounterpartyMatchRecord;
  await attachCounterpartyToConvertedRecord(match);

  return match;
}

async function attachCounterpartyToConvertedRecord(
  match: DocumentCounterpartyMatchRecord,
) {
  if (!match.counterparty_id) {
    return;
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id, converted_type, converted_record_id")
    .eq("id", match.document_id)
    .eq("organization_id", match.organization_id)
    .eq("company_id", match.company_id)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!document?.converted_type || !document.converted_record_id) {
    return;
  }

  const table =
    document.converted_type === "purchase"
      ? "purchases"
      : document.converted_type === "invoice"
        ? "invoices"
        : null;

  if (!table) {
    return;
  }

  const { error } = await supabase
    .from(table)
    .update({
      counterparty_id: match.counterparty_id,
    })
    .eq("id", document.converted_record_id)
    .eq("organization_id", match.organization_id)
    .eq("company_id", match.company_id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createCounterpartyFromMatch(matchId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { data: match, error: matchError } = await supabase
    .from("document_counterparty_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    throw new Error(matchError?.message ?? "Match de contraparte no encontrado.");
  }

  const normalizedTaxId = normalizeTaxId(match.tax_id);
  const normalizedName = normalizeCounterpartyName(match.name);

  if (normalizedTaxId) {
    const { data: existingByTaxId, error: existingTaxError } = await supabase
      .from("counterparties")
      .select("*")
      .eq("organization_id", match.organization_id)
      .eq("normalized_tax_id", normalizedTaxId)
      .maybeSingle();

    if (existingTaxError) {
      throw new Error(existingTaxError.message);
    }

    if (existingByTaxId) {
      const { data: updatedMatch, error: updateError } = await supabase
        .from("document_counterparty_matches")
        .update({
          counterparty_id: existingByTaxId.id,
          match_status: "exact",
          status: "accepted",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", matchId)
        .select("*")
        .single();

      if (updateError || !updatedMatch) {
        throw new Error(updateError?.message ?? "No se pudo asociar la contraparte.");
      }

      const typedMatch = updatedMatch as DocumentCounterpartyMatchRecord;
      await attachCounterpartyToConvertedRecord(typedMatch);

      return typedMatch;
    }
  }

  if (normalizedName) {
    const { data: existingByName, error: existingNameError } = await supabase
      .from("counterparties")
      .select("*")
      .eq("organization_id", match.organization_id)
      .eq("normalized_name", normalizedName)
      .maybeSingle();

    if (existingNameError) {
      throw new Error(existingNameError.message);
    }

    if (existingByName) {
      const { data: updatedMatch, error: updateError } = await supabase
        .from("document_counterparty_matches")
        .update({
          counterparty_id: existingByName.id,
          match_status: "exact",
          status: "accepted",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", matchId)
        .select("*")
        .single();

      if (updateError || !updatedMatch) {
        throw new Error(updateError?.message ?? "No se pudo asociar la contraparte.");
      }

      const typedMatch = updatedMatch as DocumentCounterpartyMatchRecord;
      await attachCounterpartyToConvertedRecord(typedMatch);

      return typedMatch;
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("counterparties")
    .insert({
      organization_id: match.organization_id,
      company_id: match.company_id,
      type: match.counterparty_type,
      name: match.name || "Contraparte sin nombre",
      normalized_name: normalizedName || "CONTRAPARTE SIN NOMBRE",
      tax_id: match.tax_id || null,
      normalized_tax_id: normalizedTaxId || null,
      source: "document",
      is_active: true,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "No se pudo crear la contraparte.");
  }

  const { data: updatedMatch, error: updateError } = await supabase
    .from("document_counterparty_matches")
    .update({
      counterparty_id: inserted.id,
      match_status: "exact",
      status: "created",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .select("*")
    .single();

  if (updateError || !updatedMatch) {
    throw new Error(updateError?.message ?? "No se pudo asociar la contraparte.");
  }

  const typedMatch = updatedMatch as DocumentCounterpartyMatchRecord;
  await attachCounterpartyToConvertedRecord(typedMatch);

  return typedMatch;
}

export async function editCounterpartyMatch(
  matchId: string,
  values: {
    counterpartyType: CounterpartyType;
    name: string;
    taxId?: string;
  },
) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("document_counterparty_matches")
    .update({
      counterparty_type: values.counterpartyType,
      name: values.name,
      tax_id: values.taxId || null,
      match_status: "none",
      counterparty_id: null,
      confidence_score: 0.5,
      explanation: "Contraparte ajustada manualmente por el usuario.",
      status: "edited",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", matchId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo editar la contraparte.");
  }

  return data as DocumentCounterpartyMatchRecord;
}

export async function getAcceptedCounterpartyMatch(extractionId: string) {
  const match = await getCounterpartyMatchByExtraction(extractionId);

  if (
    match?.counterparty_id &&
    (match.status === "accepted" ||
      match.status === "created" ||
      match.status === "edited")
  ) {
    return match;
  }

  return null;
}

export async function listCounterparties(filters: CounterpartyFilters = {}) {
  const { supabase } = await getAuthenticatedSupabase();
  const { getActiveOrganizationForUser } = await import("@/lib/companies");
  const activeOrganization = await getActiveOrganizationForUser();

  if (!activeOrganization) {
    return {
      activeOrganization: null,
      counterparties: [] as CounterpartyRecord[],
    };
  }

  let query = supabase
    .from("counterparties")
    .select("*")
    .eq("organization_id", activeOrganization.id)
    .order("updated_at", { ascending: false });

  if (filters.status !== "all") {
    query = query.eq("is_active", filters.status !== "inactive");
  }

  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const search = normalizeCounterpartyName(filters.query);
  const counterparties = ((data ?? []) as CounterpartyRecord[]).filter(
    (counterparty) => {
      if (!search) {
        return true;
      }

      const haystack = normalizeCounterpartyName(
        [
          counterparty.name,
          counterparty.tax_id,
          counterparty.email,
          counterparty.phone,
        ].join(" "),
      );

      return haystack.includes(search);
    },
  );

  return {
    activeOrganization,
    counterparties,
  };
}

export async function getCounterpartyById(counterpartyId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("counterparties")
    .select("*")
    .eq("id", counterpartyId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Contraparte no encontrada.");
  }

  return data as CounterpartyRecord;
}

async function assertNoDuplicateTaxId({
  counterpartyId,
  organizationId,
  taxId,
}: {
  counterpartyId?: string;
  organizationId: string;
  taxId?: string;
}) {
  const normalizedTaxId = normalizeTaxId(taxId);

  if (!normalizedTaxId) {
    return;
  }

  const { supabase } = await getAuthenticatedSupabase();
  let query = supabase
    .from("counterparties")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("normalized_tax_id", normalizedTaxId)
    .limit(1);

  if (counterpartyId) {
    query = query.neq("id", counterpartyId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    throw new Error(`Ya existe una contraparte con esa cedula: ${data.name}.`);
  }
}

export async function createCounterparty(input: CounterpartyInput) {
  const { supabase } = await getAuthenticatedSupabase();
  const { getActiveOrganizationForUser } = await import("@/lib/companies");
  const activeOrganization = await getActiveOrganizationForUser();

  if (!activeOrganization) {
    throw new Error("No existe una organizacion activa.");
  }

  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre de la contraparte es requerido.");
  }

  await assertNoDuplicateTaxId({
    organizationId: activeOrganization.id,
    taxId: input.taxId,
  });

  const { data, error } = await supabase
    .from("counterparties")
    .insert({
      organization_id: activeOrganization.id,
      type: input.type,
      name,
      normalized_name: normalizeCounterpartyName(name),
      tax_id: input.taxId?.trim() || null,
      normalized_tax_id: normalizeTaxId(input.taxId) || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      source: "manual",
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la contraparte.");
  }

  return data as CounterpartyRecord;
}

export async function updateCounterparty(
  counterpartyId: string,
  input: CounterpartyInput,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const current = await getCounterpartyById(counterpartyId);
  const name = input.name.trim();

  if (!name) {
    throw new Error("El nombre de la contraparte es requerido.");
  }

  await assertNoDuplicateTaxId({
    counterpartyId,
    organizationId: current.organization_id,
    taxId: input.taxId,
  });

  const { data, error } = await supabase
    .from("counterparties")
    .update({
      type: input.type,
      name,
      normalized_name: normalizeCounterpartyName(name),
      tax_id: input.taxId?.trim() || null,
      normalized_tax_id: normalizeTaxId(input.taxId) || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.isActive ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", counterpartyId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la contraparte.");
  }

  return data as CounterpartyRecord;
}

export async function updateCounterpartyStatus(
  counterpartyId: string,
  isActive: boolean,
) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("counterparties")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", counterpartyId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo cambiar el estado.");
  }

  return data as CounterpartyRecord;
}

export async function getCounterpartyWorkspace(counterpartyId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const counterparty = await getCounterpartyById(counterpartyId);
  const [
    { data: purchases, error: purchasesError },
    { data: invoices, error: invoicesError },
    { data: matches, error: matchesError },
    { data: rules, error: rulesError },
  ] = await Promise.all([
    supabase
      .from("purchases")
      .select("*")
      .eq("counterparty_id", counterparty.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invoices")
      .select("*")
      .eq("counterparty_id", counterparty.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("document_counterparty_matches")
      .select("*, documents(original_filename, display_name, created_at)")
      .eq("counterparty_id", counterparty.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("counterparty_rules")
      .select("*")
      .eq("counterparty_id", counterparty.id)
      .order("priority", { ascending: true }),
  ]);

  if (purchasesError) throw new Error(purchasesError.message);
  if (invoicesError) throw new Error(invoicesError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (rulesError) throw new Error(rulesError.message);

  return {
    counterparty,
    invoices: invoices ?? [],
    matches: matches ?? [],
    purchases: purchases ?? [],
    rules: rules ?? [],
  };
}
