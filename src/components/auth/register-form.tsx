"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthInput } from "@/components/auth/auth-input";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    if (!supabase) {
      setError("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError(
        "Cuenta creada, pero Supabase todavia exige confirmacion por email. Desactiva Confirm Email en Supabase para permitir acceso inmediato.",
      );
      setLoading(false);
      return;
    }

    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
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
        label="Contrasena"
        name="password"
        placeholder="Crea una contrasena"
        type="password"
      />
      <AuthInput
        label="Confirmar contrasena"
        name="confirmPassword"
        placeholder="Confirma tu contrasena"
        type="password"
      />

      {error ? (
        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-cyan-100 transition hover:text-white"
        >
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
