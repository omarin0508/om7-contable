import Link from "next/link";
import { AuthBenefits } from "@/components/auth/auth-benefits";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
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

        <form className="mt-7 space-y-4">
          <AuthInput
            label="Email"
            name="email"
            placeholder="tu@empresa.com"
            type="email"
          />
          <AuthInput
            label="Contraseña"
            name="password"
            placeholder="Ingresa tu contraseña"
            type="password"
          />

          <div className="flex items-center justify-between text-sm">
            <Link
              href="/registro"
              className="font-medium text-cyan-100 transition hover:text-white"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="text-slate-500 transition hover:text-slate-300"
            >
              Olvidé mi contraseña
            </Link>
          </div>

          <Link
            href="/seleccionar-organizacion"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            Ingresar
          </Link>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
