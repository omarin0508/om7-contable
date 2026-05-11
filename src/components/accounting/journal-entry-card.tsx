import {
  suggestJournalEntryAction,
  updateJournalEntryStatusAction,
} from "@/app/(platform)/contabilidad/actions";
import {
  getJournalTotals,
  type JournalEntry,
} from "@/lib/accounting-entries";
import { formatCurrencyAmount } from "@/lib/currency";

function getJournalStatusLabel(status: string | null | undefined) {
  if (status === "posted") {
    return "Contabilizado";
  }

  if (status === "reviewed") {
    return "Revisado";
  }

  if (status === "observed") {
    return "Observado";
  }

  return "Sugerido";
}

function getJournalStatusClass(status: string | null | undefined) {
  if (status === "posted") {
    return "om7-chip om7-chip-emerald";
  }

  if (status === "reviewed") {
    return "om7-chip om7-chip-cyan";
  }

  if (status === "observed") {
    return "om7-chip om7-chip-amber";
  }

  return "om7-chip text-slate-400";
}

function JournalStatusForm({
  entryId,
  redirectTo,
  status,
  label,
  primary = false,
}: {
  entryId: string;
  label: string;
  primary?: boolean;
  redirectTo: string;
  status: "observed" | "posted" | "reviewed";
}) {
  return (
    <form action={updateJournalEntryStatusAction}>
      <input name="entryId" type="hidden" value={entryId} />
      <input name="journalStatus" type="hidden" value={status} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button
        className={[
          primary ? "om7-btn-primary" : "om7-btn-secondary",
          "px-3 py-2 text-xs",
        ].join(" ")}
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}

export function JournalEntryCard({
  currency,
  entry,
  locked = false,
  lockedReason = "Periodo cerrado. Este asiento queda en solo lectura.",
  redirectTo,
  sourceId,
  sourceType,
}: {
  currency: string | null;
  entry?: JournalEntry | null;
  locked?: boolean;
  lockedReason?: string;
  redirectTo: string;
  sourceId: string;
  sourceType: "invoice" | "purchase";
}) {
  if (!entry) {
    return (
      <div className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              Asiento sugerido
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              OM7 puede generar una propuesta Debe/Haber cuando el registro
              este aprobado.
            </p>
          </div>
          {locked ? (
            <span className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-slate-400">
              {lockedReason}
            </span>
          ) : (
            <form action={suggestJournalEntryAction}>
              <input name="sourceType" type="hidden" value={sourceType} />
              <input name="sourceId" type="hidden" value={sourceId} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-primary px-4 py-2.5" type="submit">
                Generar asiento
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const totals = getJournalTotals(entry);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="om7-chip om7-chip-cyan">Asiento sugerido</span>
            <span className={getJournalStatusClass(entry.status)}>
              {getJournalStatusLabel(entry.status)}
            </span>
            <span
              className={
                totals.isBalanced
                  ? "om7-chip om7-chip-emerald"
                  : "om7-chip om7-chip-rose"
              }
            >
              {totals.isBalanced ? "Cuadra" : "Diferencia"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {entry.explanation ?? "OM7 preparo este asiento segun el registro aprobado."}
          </p>
        </div>
        <div className="grid gap-2 text-left sm:grid-cols-3 lg:min-w-[360px]">
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <p className="text-xs text-slate-500">Debe</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatCurrencyAmount(totals.debit, currency)}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <p className="text-xs text-slate-500">Haber</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatCurrencyAmount(totals.credit, currency)}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <p className="text-xs text-slate-500">Diferencia</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatCurrencyAmount(totals.difference, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 max-h-56 overflow-y-auto overscroll-contain">
        <div className="grid gap-2">
          {(entry.lines ?? []).map((line) => (
            <div
              className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 sm:grid-cols-[0.8fr_1fr_0.7fr]"
              key={line.id}
            >
              <span
                className={
                  line.side === "debit"
                    ? "text-sm font-semibold text-cyan-100"
                    : "text-sm font-semibold text-emerald-100"
                }
              >
                {line.side === "debit" ? "Debe" : "Haber"}
              </span>
              <span className="min-w-0 truncate text-sm text-slate-300">
                {line.account?.code} · {line.account?.name}
              </span>
              <span className="text-sm font-semibold text-white sm:text-right">
                {formatCurrencyAmount(line.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {locked ? (
          <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            {lockedReason}
          </p>
        ) : null}
        {!locked && entry.status !== "posted" ? (
          <>
            {entry.status !== "reviewed" ? (
              <JournalStatusForm
                entryId={entry.id}
                label="Revisar"
                redirectTo={redirectTo}
                status="reviewed"
              />
            ) : null}
            {totals.isBalanced ? (
              <JournalStatusForm
                entryId={entry.id}
                label="Contabilizar"
                primary
                redirectTo={redirectTo}
                status="posted"
              />
            ) : (
              <span className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs text-rose-100">
                Corrija la diferencia antes de contabilizar
              </span>
            )}
            <details className="rounded-xl border border-amber-300/10 bg-amber-300/[0.04] px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-amber-100">
                Observar
              </summary>
              <form action={updateJournalEntryStatusAction} className="mt-3 space-y-2">
                <input name="entryId" type="hidden" value={entry.id} />
                <input name="journalStatus" type="hidden" value="observed" />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <textarea
                  className="min-h-16 w-full rounded-xl border border-amber-200/15 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-200/40 focus:ring-4 focus:ring-amber-200/10"
                  name="journalNote"
                  placeholder="Motivo de la observacion..."
                  required
                />
                <button className="om7-btn-secondary px-3 py-2 text-xs" type="submit">
                  Guardar observacion
                </button>
              </form>
            </details>
          </>
        ) : null}
      </div>
    </div>
  );
}
