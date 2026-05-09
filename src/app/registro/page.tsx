import { AuthBenefits } from "@/components/auth/auth-benefits";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RegisterPage() {
  return (
    <AuthShell side={<AuthBenefits />}>
      <AuthCard>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            Crea tu espacio financiero OM7
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            Crear cuenta
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Prepara tu acceso para organizaciones, empresas y clientes.
          </p>
        </div>

        <RegisterForm />
      </AuthCard>
    </AuthShell>
  );
}
