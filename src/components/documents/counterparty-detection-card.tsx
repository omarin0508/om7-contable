import {
  acceptCounterpartyMatchAction,
  createCounterpartyFromMatchAction,
  detectDocumentCounterpartyAction,
  editCounterpartyMatchAction,
} from "@/app/(platform)/documentos/actions";
import type { DocumentCounterpartyMatchRecord } from "@/lib/counterparties";

type CounterpartyDetectionCardProps = {
  extractionId: string;
  match: DocumentCounterpartyMatchRecord | null;
  redirectTo: string;
};

const typeLabels: Record<string, string> = {
  both: "Proveedor/cliente",
  customer: "Cliente",
  supplier: "Proveedor",
};

const statusLabels: Record<string, string> = {
  accepted: "encontrado",
  created: "nuevo",
  edited: "ajustado",
  rejected: "rechazado",
  suggested: "sugerido",
};

const matchLabels: Record<string, string> = {
  exact: "encontrado",
  none: "nuevo",
  probable: "posible coincidencia",
};

function formatConfidence(value: number | null | undefined) {
  const confidence = Number(value ?? 0);

  if (confidence <= 1) {
    return `${Math.round(confidence * 100)}%`;
  }

  return `${Math.round(confidence)}%`;
}

export function CounterpartyDetectionCard({
  extractionId,
  match,
  redirectTo,
}: CounterpartyDetectionCardProps) {
  return (
    <section
      className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_30%),rgba(255,255,255,0.035)] p-5"
      id="contraparte"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-base font-semibold text-white">
            Contraparte detectada
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            OM7 busca proveedor o cliente por cedula, nombre normalizado y
            similitud basica antes de crear nuevos registros.
          </p>
        </div>
        {match ? (
          <span className="om7-chip om7-chip-cyan">
            {statusLabels[match.status] ?? match.status}
          </span>
        ) : null}
      </div>

      {!match ? (
        <div className="mt-5 rounded-2xl border border-dashed border-emerald-300/20 bg-emerald-300/[0.04] p-4">
          <p className="text-sm font-medium text-emerald-50">
            Aun no se ha detectado contraparte.
          </p>
          <p className="mt-1 text-sm leading-6 text-emerald-100/70">
            Detecte proveedor/cliente para evitar duplicados y acelerar la
            conversion.
          </p>
          <form action={detectDocumentCounterpartyAction} className="mt-4">
            <input name="extractionId" type="hidden" value={extractionId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <button className="om7-btn-primary px-4 py-2.5" type="submit">
              Detectar contraparte
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Tipo</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {typeLabels[match.counterparty_type] ?? match.counterparty_type}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Nombre</p>
              <p className="mt-1 break-words text-sm font-semibold text-white">
                {match.name || "Sin nombre"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Cedula</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {match.tax_id || "Sin cedula"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Confianza</p>
              <p className="mt-1 text-sm font-semibold text-emerald-50">
                {formatConfidence(match.confidence_score)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="om7-chip">
                {matchLabels[match.match_status] ?? match.match_status}
              </span>
              {match.counterparty_id ? (
                <span className="om7-chip om7-chip-cyan">catalogo</span>
              ) : (
                <span className="om7-chip">sin registro</span>
              )}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {match.explanation || "Sin explicacion disponible."}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {match.counterparty_id ? (
              <form action={acceptCounterpartyMatchAction}>
                <input name="matchId" type="hidden" value={match.id} />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <button className="om7-btn-primary px-4 py-2.5" type="submit">
                  Usar existente
                </button>
              </form>
            ) : null}
            <form action={createCounterpartyFromMatchAction}>
              <input name="matchId" type="hidden" value={match.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-secondary px-4 py-2.5" type="submit">
                Crear nuevo {match.counterparty_type === "customer" ? "cliente" : "proveedor"}
              </button>
            </form>
          </div>

          <details className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              Cambiar / seleccionar manualmente
            </summary>
            <form
              action={editCounterpartyMatchAction}
              className="mt-4 grid gap-4 md:grid-cols-3"
            >
              <input name="matchId" type="hidden" value={match.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Tipo
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={match.counterparty_type}
                  name="counterpartyType"
                >
                  <option className="bg-slate-950" value="supplier">
                    Proveedor
                  </option>
                  <option className="bg-slate-950" value="customer">
                    Cliente
                  </option>
                  <option className="bg-slate-950" value="both">
                    Ambos
                  </option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Nombre
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={match.name ?? ""}
                  name="name"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Cedula
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={match.tax_id ?? ""}
                  name="taxId"
                />
              </label>
              <div className="md:col-span-3">
                <button className="om7-btn-secondary px-4 py-2.5" type="submit">
                  Guardar ajuste
                </button>
              </div>
            </form>
          </details>
        </>
      )}
    </section>
  );
}
