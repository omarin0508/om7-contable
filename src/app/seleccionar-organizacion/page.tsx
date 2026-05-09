import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingCard } from "@/components/auth/onboarding-card";

const organizations = [
  {
    name: "OM7 Advisory",
    plan: "Profesional",
    companies: "18 empresas/clientes",
    status: "Activo",
  },
  {
    name: "Northstar Finance",
    plan: "Empresarial",
    companies: "42 empresas/clientes",
    status: "Activo",
  },
  {
    name: "Studio Norte",
    plan: "Básico",
    companies: "3 empresas/clientes",
    status: "Trial",
  },
];

export default function SelectOrganizationPage() {
  return (
    <AuthShell>
      <OnboardingCard
        title="Selecciona una organización"
        description="Vista mock para elegir el espacio de trabajo antes de entrar al sistema."
      >
        <div className="space-y-4">
          {organizations.map((organization) => (
            <div
              key={organization.name}
              className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold text-white">
                      {organization.name}
                    </h2>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                      {organization.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Plan {organization.plan} · {organization.companies}
                  </p>
                </div>
                <Link
                  href="/dashboard"
                  className="flex h-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
                >
                  Entrar
                </Link>
              </div>
            </div>
          ))}

          <Link
            href="/onboarding"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
          >
            Crear nueva organización
          </Link>
        </div>
      </OnboardingCard>
    </AuthShell>
  );
}
