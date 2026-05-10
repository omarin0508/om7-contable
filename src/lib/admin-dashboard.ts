import { getActiveContext } from "@/lib/active-context";
import { createClient } from "@/lib/supabase/server";

export type AdminDashboardMetrics = {
  activeClients: number;
  documentsReceivedToday: number;
  pendingReview: number;
  portalAccesses: number;
};

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  return supabase;
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();
  const organizationId = activeContext.organization?.id;
  const companyIds = activeContext.companies.map((company) => company.id);

  if (!organizationId || companyIds.length === 0) {
    return {
      activeClients: 0,
      documentsReceivedToday: 0,
      pendingReview: 0,
      portalAccesses: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: activeClients },
    { count: portalAccesses },
    { count: documentsReceivedToday },
    { count: pendingReview },
  ] = await Promise.all([
    supabase
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .in("company_id", companyIds)
      .eq("role", "client")
      .eq("status", "active"),
    supabase
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .in("company_id", companyIds)
      .eq("role", "client"),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("related_type", "client_upload")
      .gte("created_at", today.toISOString()),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("related_type", "client_upload")
      .eq("review_status", "pending"),
  ]);

  return {
    activeClients: activeClients ?? 0,
    documentsReceivedToday: documentsReceivedToday ?? 0,
    pendingReview: pendingReview ?? 0,
    portalAccesses: portalAccesses ?? 0,
  };
}
