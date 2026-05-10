import type { Company } from "@/lib/organizations";
import { assertInternalUser, getCurrentUserRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CompanyClient = {
  access_id: string;
  access_type: "user" | "invitation";
  company_id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
};

type CompanyClientRpcRow = Omit<CompanyClient, "access_id" | "access_type"> & {
  user_id: string;
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

export async function listCompanyClients(companyId: string) {
  await assertInternalUser();
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("list_company_clients", {
    target_company_id: companyId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as CompanyClientRpcRow[]).map((client) => ({
    ...client,
    access_id: String(client.user_id),
    access_type: "user" as const,
  })) as CompanyClient[];
}

export async function listCompanyClientAccesses(companyId: string) {
  const clients = await listCompanyClients(companyId);
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("client_invitations")
    .select("id, company_id, email, role, status, invited_at, accepted_at")
    .eq("company_id", companyId)
    .in("status", ["pending", "cancelled"])
    .order("invited_at", { ascending: false });

  if (error) {
    if (
      error.message.includes("client_invitations") ||
      error.message.includes("does not exist")
    ) {
      return clients;
    }

    throw new Error(error.message);
  }

  const invitations = (data ?? []).map((invitation) => ({
    access_id: String(invitation.id),
    access_type: "invitation" as const,
    company_id: String(invitation.company_id),
    user_id: null,
    email: invitation.email as string | null,
    role: String(invitation.role ?? "client"),
    status: String(invitation.status ?? "pending"),
    invited_at: invitation.invited_at as string | null,
    accepted_at: invitation.accepted_at as string | null,
  }));

  return [...clients, ...invitations];
}

export async function assignClientToCompany(companyId: string, email: string) {
  await assertInternalUser();
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("invite_or_assign_client_to_company", {
    target_company_id: companyId,
    client_email: email,
  });

  if (error) {
    if (
      error.message.includes("invite_or_assign_client_to_company") ||
      error.message.includes("does not exist")
    ) {
      const fallback = await supabase.rpc("assign_client_to_company", {
        target_company_id: companyId,
        client_email: email,
      });

      if (fallback.error) {
        const message = fallback.error.message.includes("No existe un usuario")
          ? "Este usuario debe registrarse primero para poder asignarlo."
          : fallback.error.message;
        throw new Error(message);
      }

      return fallback.data as CompanyClient;
    }

    throw new Error(error.message);
  }

  return Array.isArray(data) ? (data[0] as CompanyClient) : (data as CompanyClient);
}

export async function removeClientFromCompany(companyId: string, userId: string) {
  await assertInternalUser();
  const supabase = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("remove_client_from_company", {
    target_company_id: companyId,
    target_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelClientInvitation(invitationId: string) {
  await assertInternalUser();
  const supabase = await getAuthenticatedSupabase();
  const { error } = await supabase.rpc("cancel_client_invitation", {
    target_invitation_id: invitationId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getClientCompaniesForUser() {
  const currentUser = await getCurrentUserRole();
  return currentUser.clientCompanies as Company[];
}
