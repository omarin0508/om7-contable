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
    <div className="min-h-screen overflow-hidden bg-[#03050a] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_78%_10%,rgba(16,185,129,0.09),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.98))]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />

      <AssistantProvider snapshot={assistantSnapshot}>
        <Sidebar />
        <MobileNav />

        <div className="relative flex min-h-screen flex-col lg:pl-72">
          <Topbar
            activeCompanyId={activeCompanyId}
            activeCompanyName={activeCompanyName}
            companies={companies}
            onSelectCompany={onSelectCompany}
            organizationName={organizationName}
            userEmail={userEmail}
          />
          <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>
        <QuickCalculator />
        <AssistantFloatingButton />
      </AssistantProvider>
    </div>
  );
}
