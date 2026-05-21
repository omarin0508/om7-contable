import {
  acceptDocumentClassificationAction,
  classifyDocumentExtractionAction,
  createCounterpartyRuleFromClassificationAction,
  editDocumentClassificationAction,
  rejectDocumentClassificationAction,
} from "@/app/(platform)/documentos/actions";
import type { DocumentCounterpartyMatchRecord } from "@/lib/counterparties";
import type {
  CounterpartyRuleRecord,
  DocumentClassificationRecord,
} from "@/lib/document-classification";

type DocumentClassificationCardProps = {
  activeCounterpartyRule?: CounterpartyRuleRecord | null;
  classification: DocumentClassificationRecord | null;
  counterpartyMatch?: DocumentCounterpartyMatchRecord | null;
  extractionId: string;
  redirectTo: string;
};

const flowLabels: Record<string, string> = {
  expense: "Gasto",
  income: "Ingreso",
  purchase: "Compra",
  sale: "Venta",
  unknown: "Sin definir",
};

const statusLabels: Record<string, string> = {
  accepted: "Aceptada",
  edited: "Editada",
  rejected: "Rechazada",
  suggested: "Sugerida",
};

function formatConfidence(value: number | null | undefined) {
  const confidence = Number(value ?? 0);

  if (confidence <= 1) {
    return `${Math.round(confidence * 100)}%`;
  }

  return `${Math.round(confidence)}%`;
}

export function DocumentClassificationCard({
  activeCounterpartyRule,
  classification,
  counterpartyMatch,
  extractionId,
  redirectTo,
}: DocumentClassificationCardProps) {
  const canSaveCounterpartyRule = Boolean(
    classification &&
      (classification.status === "accepted" || classification.status === "edited") &&
      counterpartyMatch?.counterparty_id,
  );

  return (
    <section
      className="rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.1),transparent_32%),rgba(255,255,255,0.035)] p-5"
      id="clasificacion"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-base font-semibold text-white">
            Clasificacion de salida
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Defina si el documento sale como Compra, Venta u Otro antes de
            continuar el flujo.
          </p>
        </div>
        {classification ? (
          <div className="flex flex-wrap gap-2">
            {activeCounterpartyRule ? (
              <span className="om7-chip border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                Regla de proveedor aplicada
              </span>
            ) : null}
            <span className="om7-chip om7-chip-cyan">
              {statusLabels[classification.status] ?? classification.status}
            </span>
          </div>
        ) : null}
      </div>

      {!classification ? (
        <div className="mt-5 rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[0.04] p-4">
          <p className="text-sm font-medium text-cyan-50">
            Este documento aun no tiene salida definida.
          </p>
          <p className="mt-1 text-sm leading-6 text-cyan-100/70">
            Genere una sugerencia o ajuste manualmente la clasificacion antes
            de enviarlo al modulo operativo.
          </p>
          <form action={classifyDocumentExtractionAction} className="mt-4">
            <input name="extractionId" type="hidden" value={extractionId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <button className="om7-btn-primary px-4 py-2.5" type="submit">
              Clasificar documento
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Salida sugerida</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {flowLabels[classification.flow_type] ?? classification.flow_type}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Categoria</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {classification.suggested_category ?? "Sin categoria"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Cuenta sugerida</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {classification.suggested_account ?? "Sin cuenta"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-3">
              <p className="text-xs text-slate-500">Confianza</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {formatConfidence(classification.confidence_score)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
              Regla aplicada
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {classification.rule_applied}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {classification.explanation || "Sin explicacion disponible."}
            </p>
            {classification.needs_review ? (
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                Revise esta sugerencia antes de aceptarla.
              </p>
            ) : null}
            {activeCounterpartyRule ? (
              <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-emerald-100">
                Regla activa: {activeCounterpartyRule.rule_name}. OM7 usara
                esta memoria para futuras facturas de la misma contraparte.
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={acceptDocumentClassificationAction}>
              <input
                name="classificationId"
                type="hidden"
                value={classification.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-primary px-4 py-2.5" type="submit">
                Confirmar salida
              </button>
            </form>
            <form action={rejectDocumentClassificationAction}>
              <input
                name="classificationId"
                type="hidden"
                value={classification.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="om7-btn-ghost px-4 py-2.5" type="submit">
                Rechazar
              </button>
            </form>
          </div>

          <details className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              Ajustar salida
            </summary>
            <form
              action={editDocumentClassificationAction}
              className="mt-4 grid gap-4 md:grid-cols-2"
            >
              <input
                name="classificationId"
                type="hidden"
                value={classification.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Salida
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.flow_type}
                  name="flowType"
                >
                  {Object.entries(flowLabels).map(([value, label]) => (
                    <option className="bg-slate-950" key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Categoria
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.suggested_category ?? ""}
                  name="suggestedCategory"
                  placeholder="Combustibles"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Cuenta sugerida
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.suggested_account ?? ""}
                  name="suggestedAccount"
                  placeholder="Gasto combustible"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Centro de costo
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.suggested_cost_center_id ?? ""}
                  name="suggestedCostCenterId"
                  placeholder="Pendiente"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Confianza 0-1
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.confidence_score}
                  name="confidenceScore"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">
                  Regla
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.rule_applied}
                  name="ruleApplied"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-slate-400">
                  Explicacion
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-white/[0.12] bg-white/[0.07] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/45 focus:ring-4 focus:ring-cyan-300/10"
                  defaultValue={classification.explanation}
                  name="explanation"
                />
              </label>
              <div className="md:col-span-2">
                <button className="om7-btn-secondary px-4 py-2.5" type="submit">
                  Guardar edicion
                </button>
              </div>
            </form>
          </details>

          {canSaveCounterpartyRule ? (
            <details className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.05] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-emerald-100">
                Guardar como regla para esta contraparte
              </summary>
              <p className="mt-3 text-sm leading-6 text-emerald-100/70">
                OM7 recordara esta categoria y cuenta para la proxima factura
                del mismo proveedor o cliente.
              </p>
              <form
                action={createCounterpartyRuleFromClassificationAction}
                className="mt-4 grid gap-4 md:grid-cols-2"
              >
                <input
                  name="classificationId"
                  type="hidden"
                  value={classification.id}
                />
                <input
                  name="matchId"
                  type="hidden"
                  value={counterpartyMatch?.id ?? ""}
                />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold text-emerald-100/80">
                    Nombre de regla
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200/20 bg-white/[0.08] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-200/50 focus:ring-4 focus:ring-emerald-300/10"
                    defaultValue={
                      classification.suggested_category ||
                      classification.suggested_account ||
                      "Regla aprendida"
                    }
                    name="ruleName"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-emerald-100/80">
                    Categoria
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200/20 bg-white/[0.08] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-200/50 focus:ring-4 focus:ring-emerald-300/10"
                    defaultValue={classification.suggested_category ?? ""}
                    name="suggestedCategory"
                    placeholder="Combustibles"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-emerald-100/80">
                    Cuenta sugerida
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200/20 bg-white/[0.08] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-200/50 focus:ring-4 focus:ring-emerald-300/10"
                    defaultValue={classification.suggested_account ?? ""}
                    name="suggestedAccount"
                    placeholder="Gasto combustible"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold text-emerald-100/80">
                    Centro de costo opcional
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-emerald-200/20 bg-white/[0.08] px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-200/50 focus:ring-4 focus:ring-emerald-300/10"
                    defaultValue={classification.suggested_cost_center_id ?? ""}
                    name="suggestedCostCenterId"
                    placeholder="Sin centro de costo"
                  />
                </label>
                <div className="md:col-span-2">
                  <button className="om7-btn-primary px-4 py-2.5" type="submit">
                    Guardar regla
                  </button>
                </div>
              </form>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
