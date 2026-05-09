import Link from "next/link";
import { AuthBenefits } from "@/components/auth/auth-benefits";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
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

        <form className="mt-7 space-y-4">
          <AuthInput
            label="Nombre completo"
            name="fullName"
            placeholder="Oscar Marin"
          />
          <AuthInput
            label="Email"
            name="email"
            placeholder="tu@empresa.com"
            type="email"
          />
          <AuthInput
            label="Contraseña"
            name="password"
            placeholder="Crea una contraseña"
            type="password"
          />
          <AuthInput
            label="Confirmar contraseña"
            name="confirmPassword"
            placeholder="Confirma tu contraseña"
            type="password"
          />

          <Link
            href="/onboarding"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Crear cuenta
          </Link>

          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-cyan-100 transition hover:text-white"
            >
              Iniciar sesión
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
