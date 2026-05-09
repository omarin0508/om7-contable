import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  side?: ReactNode;
};

export function AuthShell({ children, side }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03050a] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(16,185,129,0.1),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.84),rgba(2,6,23,0.98))]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <section className="flex flex-col justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 self-start">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.14)]">
              OM7
            </div>
            <div>
              <p className="text-sm font-semibold text-white">OM7 Finance OS</p>
              <p className="text-xs text-slate-500">
                Tu sistema operativo financiero inteligente.
              </p>
            </div>
          </Link>

          <div className="hidden max-w-lg pb-10 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
              SaaS financiero premium
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-white">
              Control, documentos y reportes en una sola plataforma.
            </h1>
            <p className="mt-5 text-sm leading-6 text-slate-400">
              Una base visual lista para conectar autenticacion, organizaciones,
              empresas, permisos y flujos inteligentes.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center py-8">
          <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,460px)_minmax(280px,0.8fr)]">
            {children}
            {side}
          </div>
        </section>
      </div>
    </main>
  );
}
