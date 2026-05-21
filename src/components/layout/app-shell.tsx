import type { ReactNode } from "react";
import { AssistantFloatingButton } from "@/components/assistant/assistant-floating-button";
import { QuickCalculator } from "@/components/global/quick-calculator";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AssistantProvider } from "@/hooks/assistant/use-assistant";
import type { AssistantSnapshot } from "@/lib/assistant/context";
import type { Company } from "@/lib/organizations";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string | null;
  organizationName?: string | null;
  activeCompanyName?: string | null;
  activeCompanyId?: string | null;
  assistantSnapshot: AssistantSnapshot;
  companies?: Company[];
  onSelectCompany?: (formData: FormData) => void;
};

export function AppShell({
  children,
  userEmail,
  organizationName,
  activeCompanyName,
  activeCompanyId,
  companies,
  onSelectCompany,
  assistantSnapshot,
}: AppShellProps) {
  return (
    <div className="om7-app-shell min-h-screen overflow-x-clip">
      <div className="om7-app-glow pointer-events-none fixed inset-0" />
      <div className="om7-app-grid pointer-events-none fixed inset-0" />

      <AssistantProvider snapshot={assistantSnapshot}>
        <Sidebar />
        <MobileNav />

        <div className="relative flex min-h-screen min-w-0 flex-col lg:pl-72">
          <Topbar
            activeCompanyId={activeCompanyId}
            activeCompanyName={activeCompanyName}
            companies={companies}
            onSelectCompany={onSelectCompany}
            organizationName={organizationName}
            userEmail={userEmail}
          />
          <main className="min-w-0 flex-1 px-3 pb-28 pt-20 sm:px-5 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>
        <QuickCalculator />
        <AssistantFloatingButton />
      </AssistantProvider>
    </div>
  );
}
