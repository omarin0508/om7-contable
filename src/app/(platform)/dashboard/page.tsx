import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getAdminDashboardMetrics } from "@/lib/admin-dashboard";
import { getActiveContext } from "@/lib/active-context";

export default async function DashboardPage() {
  const [activeContext, adminMetrics] = await Promise.all([
    getActiveContext(),
    getAdminDashboardMetrics(),
  ]);

  return (
    <DashboardView
      activeContext={activeContext}
      adminMetrics={adminMetrics}
    />
  );
}
