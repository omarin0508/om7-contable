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
    <header className="om7-topbar sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="flex min-h-16 min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.22em]">
            {organizationName ? `Despacho: ${organizationName}` : "Despacho"}
          </p>
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">
            {activeCompanyName ?? "Dashboard financiero"}
          </h1>
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-500 shadow-sm">
            <Icon name="search" className="h-4 w-4" />
            <span>Buscar documentos, clientes o registros</span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {onSelectCompany ? (
            <CompanySelector
              activeCompanyId={activeCompanyId}
              companies={companies}
              onSelect={onSelectCompany}
            />
          ) : null}
          <button
            className="hidden h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white sm:grid"
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
