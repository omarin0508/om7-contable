"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthInput } from "@/components/auth/auth-input";
import { createClient } from "@/lib/supabase/client";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (!supabase) {
      setError("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const isUnconfirmedEmail =
        signInError.message.toLowerCase().includes("email not confirmed") ||
        signInError.code === "email_not_confirmed";

      setError(
        isUnconfirmedEmail
          ? "Este usuario existe, pero Supabase todavia requiere confirmar el email. Desactiva Confirm Email en Supabase Auth y confirma o recrea este usuario."
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
      <AuthInput
        label="Email"
        name="email"
        placeholder="tu@empresa.com"
        type="email"
      />
      <AuthInput
        label="Contrasena"
        name="password"
        placeholder="Ingresa tu contrasena"
        type="password"
      />

      {error ? (
        <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

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
          Olvide mi contrasena
        </Link>
      </div>

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
