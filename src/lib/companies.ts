import { getActiveOrganization, type Company, type Organization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export type CreateCompanyInput = {
  name: string;
  legalName?: string;
  taxId?: string;
  country?: string;
  baseCurrency?: string;
  status?: string;
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

  return supabase;
}

export async function getActiveOrganizationForUser(): Promise<Organization | null> {
  return getActiveOrganization();
}

export async function getCompaniesForActiveOrganization() {
  const supabase = await getAuthenticatedSupabase();
  const activeOrganization = await getActiveOrganizationForUser();

  if (!activeOrganization) {
    return {
      activeOrganization: null,
      companies: [] as Company[],
    };
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("organization_id", activeOrganization.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeOrganization,
    companies: (data ?? []) as Company[],
  };
}

export async function getCompanyById(companyId: string) {
  const supabase = await getAuthenticatedSupabase();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Company;
}

export async function createCompany(input: CreateCompanyInput) {
  const supabase = await getAuthenticatedSupabase();
  const activeOrganization = await getActiveOrganizationForUser();

  if (!activeOrganization) {
    throw new Error("No existe una organizacion activa.");
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      organization_id: activeOrganization.id,
      name: input.name,
      legal_name: input.legalName || null,
      tax_id: input.taxId || null,
      country: input.country || null,
      base_currency: input.baseCurrency || activeOrganization.base_currency || "CRC",
      status: input.status || "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la empresa.");
  }

  return data as Company;
}

export async function updateCompanyStatus(companyId: string, status: string) {
  const supabase = await getAuthenticatedSupabase();

  const { data, error } = await supabase
    .from("companies")
    .update({ status })
    .eq("id", companyId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la empresa.");
  }

  return data as Company;
}
