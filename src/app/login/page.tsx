import { AuthBenefits } from "@/components/auth/auth-benefits";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath = (await searchParams)?.next ?? "/dashboard";

  return (
    <AuthShell side={<AuthBenefits />}>
      <AuthCard>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            Bienvenido
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            Inicia sesión
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Tu sistema operativo financiero inteligente.
          </p>
        </div>

        <LoginForm nextPath={nextPath} />
      </AuthCard>
    </AuthShell>
  );
}
