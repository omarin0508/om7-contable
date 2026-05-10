import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { setActiveCompanyAction } from "@/app/(platform)/empresas/context-actions";
import { getActiveContext } from "@/lib/active-context";
import { getCurrentUserRole } from "@/lib/permissions";
import { getCurrentUserEmail } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentUserRole();

  if (currentUser.role === "client") {
    redirect("/cliente");
  }

  const userEmail = currentUser.email ?? (await getCurrentUserEmail());
  const activeContext = await getActiveContext();

  if (!activeContext.organization) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      activeCompanyId={activeContext.activeCompany?.id}
      activeCompanyName={activeContext.activeCompany?.name}
      companies={activeContext.companies}
      onSelectCompany={setActiveCompanyAction}
      organizationName={activeContext.organization.name}
      userEmail={userEmail}
    >
      {children}
    </AppShell>
  );
}
