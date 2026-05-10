import type { Company } from "@/lib/organizations";
import { assertInternalUser, getCurrentUserRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type CompanyClient = {
  company_id: string;
  user_id: string;
  email: string | null;
  role: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
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

  return (data ?? []) as CompanyClient[];
}

export async function assignClientToCompany(companyId: string, email: string) {
  await assertInternalUser();
  const supabase = await getAuthenticatedSupabase();
  const { data, error } = await supabase.rpc("assign_client_to_company", {
    target_company_id: companyId,
    client_email: email,
  });

  if (error) {
    const message = error.message.includes("No existe un usuario")
      ? "Este usuario debe registrarse primero para poder asignarlo."
      : error.message;
    throw new Error(message);
  }

  return data as CompanyClient;
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

export async function getClientCompaniesForUser() {
  const currentUser = await getCurrentUserRole();
  return currentUser.clientCompanies as Company[];
}
