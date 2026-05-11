"use client";

import Link from "next/link";
import { useAssistant } from "@/hooks/assistant/use-assistant";

function ActionLink({
  href,
  label,
  tone,
  onClick,
}: {
  href: string;
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      className={[
        "inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold transition",
        tone === "primary"
          ? "border border-cyan-300/25 bg-cyan-300/14 text-cyan-50 hover:bg-cyan-300/20"
          : "border border-white/[0.08] bg-white/[0.045] text-slate-200 hover:bg-white/[0.075]",
      ].join(" ")}
      href={href}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

function AssistantPanel() {
  const { close, guidance, snapshot } = useAssistant();

  return (
    <aside className="fixed inset-x-3 bottom-20 z-[70] max-h-[76vh] overflow-hidden rounded-3xl border border-white/[0.12] bg-[#05070d]/95 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:inset-x-auto sm:right-5 sm:w-[390px] lg:bottom-6">
      <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_34%),rgba(255,255,255,0.035)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
              {guidance.moduleLabel}
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">
              {guidance.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {snapshot.companyName ?? "Sin cliente activo"} ·{" "}
              {snapshot.period.label}
            </p>
          </div>
          <button
            aria-label="Cerrar copiloto OM7"
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            onClick={close}
            type="button"
          >
            ×
          </button>
        </div>
      </div>

      <div className="om7-scrollbar max-h-[calc(76vh-76px)] overflow-y-auto p-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Que estas viendo
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {guidance.context}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.055] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
            Siguiente paso recomendado
          </p>
          <p className="mt-2 text-sm leading-6 text-cyan-50">
            {guidance.nextStep}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Estado operativo
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {guidance.progress}%
              </p>
            </div>
            <div className="h-14 w-14 rounded-full border border-cyan-300/20 bg-cyan-300/10 p-1">
              <div
                className="grid h-full w-full place-items-center rounded-full bg-[#05070d] text-xs font-semibold text-cyan-100"
                style={{
                  boxShadow: `inset 0 0 0 ${Math.max(
                    3,
                    guidance.progress / 12,
                  )}px rgba(34,211,238,0.22)`,
                }}
              >
                OM7
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {guidance.checklist.map((item) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2"
                key={item.label}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {item.value}
                  </p>
                </div>
                <span
                  className={[
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    item.completed
                      ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.65)]"
                      : "bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.55)]",
                  ].join(" ")}
                />
              </div>
            ))}
          </div>
        </div>

        {guidance.risks.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">
              Riesgos detectados
            </p>
            <div className="mt-2 grid gap-2">
              {guidance.risks.map((risk) => (
                <p className="text-sm leading-5 text-amber-50/90" key={risk}>
                  {risk}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {guidance.actions.map((action) => (
            <ActionLink
              href={action.href}
              key={`${action.href}-${action.label}`}
              label={action.label}
              onClick={close}
              tone={action.tone}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

export function AssistantFloatingButton() {
  const { guidance, isOpen, snapshot, toggle } = useAssistant();
  const hasAttention =
    snapshot.documents.errors > 0 ||
    snapshot.purchases.observed > 0 ||
    snapshot.invoices.observed > 0 ||
    snapshot.accounting.observed > 0;

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="Abrir copiloto operativo OM7"
        className="fixed bottom-20 right-4 z-[70] flex items-center gap-2 rounded-2xl border border-white/[0.14] bg-[#05070d]/82 px-3 py-2.5 text-sm font-semibold text-white shadow-2xl shadow-black/45 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.08] lg:bottom-6 lg:right-6"
        onClick={toggle}
        type="button"
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/12 text-[11px] text-cyan-100">
          OM7
        </span>
        <span className="hidden sm:block">Copiloto</span>
        <span
          className={[
            "h-2 w-2 rounded-full",
            hasAttention ? "bg-amber-300" : "bg-emerald-400",
          ].join(" ")}
        />
        <span className="sr-only">{guidance.nextStep}</span>
      </button>

      {isOpen ? <AssistantPanel /> : null}
    </>
  );
}
