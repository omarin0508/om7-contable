import { normalizeCurrencyCode } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  name: string;
  account_type: string;
  country: string | null;
  base_currency: string | null;
  owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Company = {
  id: string;
  organization_id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  country: string | null;
  base_currency: string | null;
  status: string | null;
  gmail_xml_enabled?: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateOrganizationInput = {
  name: string;
  accountType: string;
  country?: string;
  baseCurrency?: string;
};

export type CreateCompanyInput = {
  organizationId: string;
  name: string;
  legalName?: string;
  taxId?: string;
  country?: string;
  baseCurrency?: string;
};

async function getAuthenticatedUser() {
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

async function ensureProfile() {
  const { supabase, user } = await getAuthenticatedUser();

  const fullName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    email: user.email,
  });

  return { supabase, user };
}

export async function getUserOrganizations() {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Organization[];
}

export async function createOrganization(input: CreateOrganizationInput) {
  const { supabase, user } = await ensureProfile();
  const organizationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const organization: Organization = {
    id: organizationId,
    name: input.name,
    account_type: input.accountType,
    country: input.country || null,
    base_currency: normalizeCurrencyCode(input.baseCurrency),
    owner_id: user.id,
    created_at: now,
    updated_at: now,
  };

  const { error: organizationError } = await supabase
    .from("organizations")
    .insert({
      id: organization.id,
      name: organization.name,
      account_type: organization.account_type,
      country: organization.country,
      base_currency: organization.base_currency,
      owner_id: organization.owner_id,
    });

  if (organizationError) {
    throw new Error(organizationError?.message ?? "No se pudo crear la organizacion.");
  }

  const { error: memberError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "org_owner",
      status: "active",
    });

  if (memberError) {
    throw new Error(memberError.message);
  }

  return organization;
}

export async function getActiveOrganization(): Promise<Organization | null> {
  const organizations = await getUserOrganizations();

  return organizations.length > 0 ? organizations[0] : null;
}

export async function getOrganizationCompanies(organizationId: string) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Company[];
}

export async function createCompany(input: CreateCompanyInput) {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      legal_name: input.legalName || null,
      tax_id: input.taxId || null,
      country: input.country || null,
      base_currency: normalizeCurrencyCode(input.baseCurrency),
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la empresa.");
  }

  return data as Company;
}
