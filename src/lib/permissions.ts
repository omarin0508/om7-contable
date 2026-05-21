import type { Company } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserRole = {
  userId: string;
  email: string | null;
  role: "internal" | "client" | null;
  membershipRoles: string[];
  clientCompanies: Company[];
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

export async function getCurrentUserRole(): Promise<CurrentUserRole> {
  const { supabase, user } = await getAuthenticatedSupabase();

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const internalRoles = new Set([
    "owner",
    "platform_owner",
    "org_owner",
    "admin",
    "staff",
    "accountant",
    "assistant",
  ]);
  const hasInternalRole = (memberships ?? []).some((membership) =>
    internalRoles.has(String(membership.role)),
  );
  const membershipRoles = (memberships ?? []).map((membership) =>
    String(membership.role),
  );

  const { data: companyUsers, error: companyUsersError } = await supabase
    .from("company_users")
    .select("role, companies(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (companyUsersError) {
    throw new Error(companyUsersError.message);
  }

  const clientCompanies = (companyUsers ?? [])
    .filter((item) => String(item.role) === "client")
    .map((item) => item.companies)
    .flat()
    .filter(Boolean) as unknown as Company[];

  return {
    userId: user.id,
    email: user.email ?? null,
    role: hasInternalRole ? "internal" : clientCompanies.length > 0 ? "client" : null,
    membershipRoles,
    clientCompanies,
  };
}

export async function isInternalUser() {
  const currentUser = await getCurrentUserRole();
  return currentUser.role === "internal";
}

export async function isClientUser() {
  const currentUser = await getCurrentUserRole();
  return currentUser.role === "client";
}

export async function assertInternalUser() {
  const currentUser = await getCurrentUserRole();

  if (currentUser.role !== "internal") {
    throw new Error("No tienes permisos internos para esta accion.");
  }

  return currentUser;
}

export async function assertMasterCatalogAdmin() {
  const currentUser = await assertInternalUser();
  const allowedRoles = new Set(["owner", "platform_owner", "org_owner", "admin"]);
  const canEditMaster = currentUser.membershipRoles.some((role) =>
    allowedRoles.has(role),
  );

  if (!canEditMaster) {
    throw new Error("Solo administradores internos pueden editar el catalogo maestro.");
  }

  return currentUser;
}

export async function assertClientAccessToCompany(companyId: string) {
  const currentUser = await getCurrentUserRole();

  if (currentUser.role === "internal") {
    return currentUser;
  }

  const hasAccess = currentUser.clientCompanies.some(
    (company) => company.id === companyId,
  );

  if (!hasAccess) {
    throw new Error("No tienes acceso a esta empresa.");
  }

  return currentUser;
}
