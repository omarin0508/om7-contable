import { redirect } from "next/navigation";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingCard } from "@/components/auth/onboarding-card";
import { getActiveOrganization } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { createInitialOrganization } from "@/app/onboarding/actions";

const accountTypes = [
  "Firma contable",
  "Empresa",
  "Profesional independiente",
];

export default async function OnboardingPage() {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/login");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let activeOrganization: Awaited<ReturnType<typeof getActiveOrganization>> =
    null;

  try {
    activeOrganization = await getActiveOrganization();
  } catch {
    // If the schema has not been executed yet, keep onboarding visible.
  }

  if (activeOrganization) {
    redirect("/dashboard");
  }

  return (
    <AuthShell>
      <OnboardingCard
        title="Crea tu organizacion inicial"
        description="Esta sera la base para administrar empresas, clientes, usuarios, documentos y reportes cuando conectemos la plataforma real."
      >
        <form action={createInitialOrganization} className="space-y-5">
          <AuthInput
            label="Nombre de organizacion o firma contable"
            name="organizationName"
            placeholder="OM7 Advisory"
          />

          <div>
            <p className="text-sm font-medium text-slate-300">Tipo de cuenta</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {accountTypes.map((type, index) => (
                <label
                  key={type}
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-sm text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/10"
                >
                  <input
                    className="mr-2 accent-cyan-200"
                    defaultChecked={index === 0}
                    name="accountType"
                    type="radio"
                    value={type}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput label="Pais" name="country" placeholder="Costa Rica" />
            <AuthInput label="Moneda base" name="currency" placeholder="CRC" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-sm font-medium text-white">
              Despues podras ampliar tu espacio
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Agrega empresas, clientes, usuarios internos y accesos de consulta
              cuando el modelo multiempresa este conectado.
            </p>
          </div>

          <button
            className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
            type="submit"
          >
            Crear organizacion
          </button>
        </form>
      </OnboardingCard>
    </AuthShell>
  );
}
