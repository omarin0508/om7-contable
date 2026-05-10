import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getActiveContext } from "@/lib/active-context";

export default async function DashboardPage() {
  const activeContext = await getActiveContext();

  return <DashboardView activeContext={activeContext} />;
}
