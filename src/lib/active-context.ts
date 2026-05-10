import type { Company, Organization } from "@/lib/organizations";
import {
  getOrganizationCompanies,
  getUserOrganizations as getOrganizationsForUser,
} from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export type ActiveContext = {
  organization: Organization | null;
  activeCompany: Company | null;
  suggestedCompany: Company | null;
  companies: Company[];
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

async function ensureProfileExists() {
  const { supabase, user } = await getAuthenticatedSupabase();

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

export async function ensureActiveOrganization() {
  const { supabase, user } = await ensureProfileExists();
  const organizations = await getOrganizationsForUser();

  if (organizations.length === 0) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("active_organization_id")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const organization =
    organizations.find(
      (item) => item.id === profile?.active_organization_id,
    ) ?? organizations[0];

  await supabase
    .from("profiles")
    .update({ active_organization_id: organization.id })
    .eq("id", user.id);

  return organization;
}

export async function getUserOrganizations() {
  return getOrganizationsForUser();
}

export async function getUserCompaniesByOrganization(organizationId: string) {
  return getOrganizationCompanies(organizationId);
}

export async function validateUserCompanyAccess(companyId: string) {
  const organization = await ensureActiveOrganization();

  if (!organization) {
    return false;
  }

  const companies = await getOrganizationCompanies(organization.id);

  return companies.some((company) => company.id === companyId);
}

export async function getActiveContext(): Promise<ActiveContext> {
  const { supabase, user } = await ensureProfileExists();
  const organization = await ensureActiveOrganization();

  if (!organization) {
    return {
      organization: null,
      activeCompany: null,
      suggestedCompany: null,
      companies: [],
    };
  }

  const companies = await getUserCompaniesByOrganization(organization.id);
  const {
    data: profile,
    error,
  } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const activeCompany =
    companies.find((company) => company.id === profile?.active_company_id) ??
    null;
  const suggestedCompany =
    activeCompany ??
    companies.find((company) => company.status === "active") ??
    companies[0] ??
    null;

  return {
    organization,
    activeCompany,
    suggestedCompany,
    companies,
  };
}

export async function setActiveCompany(companyId: string) {
  const { supabase, user } = await ensureProfileExists();
  const organization = await ensureActiveOrganization();

  if (!organization) {
    throw new Error("No existe una organizacion activa.");
  }

  const companies = await getUserCompaniesByOrganization(organization.id);
  const company = companies.find((item) => item.id === companyId);

  if (!company) {
    throw new Error("La empresa no pertenece a tu organizacion activa.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      active_organization_id: organization.id,
      active_company_id: company.id,
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return company;
}

export async function clearActiveCompany() {
  const { supabase, user } = await ensureProfileExists();

  const { error } = await supabase
    .from("profiles")
    .update({ active_company_id: null })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
