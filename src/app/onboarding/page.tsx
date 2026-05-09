import Link from "next/link";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingCard } from "@/components/auth/onboarding-card";

const accountTypes = [
  "Firma contable",
  "Empresa",
  "Profesional independiente",
];

export default function OnboardingPage() {
  return (
    <AuthShell>
      <OnboardingCard
        title="Crea tu organización inicial"
        description="Esta será la base para administrar empresas, clientes, usuarios, documentos y reportes cuando conectemos la plataforma real."
      >
        <form className="space-y-5">
          <AuthInput
            label="Nombre de organización o firma contable"
            name="organizationName"
            placeholder="OM7 Advisory"
          />

          <div>
            <p className="text-sm font-medium text-slate-300">Tipo de cuenta</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {accountTypes.map((type) => (
                <label
                  key={type}
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-sm text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/10"
                >
                  <input className="sr-only" name="accountType" type="radio" />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput label="País" name="country" placeholder="Costa Rica" />
            <AuthInput label="Moneda base" name="currency" placeholder="USD" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-sm font-medium text-white">
              Después podrás ampliar tu espacio
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Agrega empresas, clientes, usuarios internos y accesos de consulta
              cuando el modelo multiempresa esté conectado.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Crear organización
          </Link>
        </form>
      </OnboardingCard>
    </AuthShell>
  );
}
