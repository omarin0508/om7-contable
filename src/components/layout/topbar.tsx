import { Icon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/auth/logout-button";
import { CompanySelector } from "@/components/layout/company-selector";
import type { Company } from "@/lib/organizations";

type TopbarProps = {
  userEmail?: string | null;
  organizationName?: string | null;
  activeCompanyName?: string | null;
  activeCompanyId?: string | null;
  companies?: Company[];
  onSelectCompany?: (formData: FormData) => void;
};

export function Topbar({
  userEmail,
  organizationName,
  activeCompanyName,
  activeCompanyId,
  companies = [],
  onSelectCompany,
}: TopbarProps) {
  const displayEmail = userEmail ?? "Sesion no configurada";
  const avatarLetter = displayEmail.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070a12]/72 backdrop-blur-xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            {organizationName ?? "Executive Command Center"}
          </p>
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">
            {activeCompanyName ?? "Dashboard financiero"}
          </h1>
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-500 shadow-sm">
            <Icon name="search" className="h-4 w-4" />
            <span>Buscar empresas, facturas o movimientos</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSelectCompany ? (
            <CompanySelector
              activeCompanyId={activeCompanyId}
              companies={companies}
              onSelect={onSelectCompany}
            />
          ) : null}
          <button
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            type="button"
            aria-label="Notificaciones"
          >
            <Icon name="bell" className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] py-1.5 pl-2 pr-3 sm:flex">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-400 text-xs font-bold text-slate-950">
              {avatarLetter}
            </div>
            <div className="leading-tight">
              <p className="max-w-40 truncate text-xs font-medium text-white">
                {displayEmail}
              </p>
              <p className="text-[11px] text-slate-500">Usuario autenticado</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
