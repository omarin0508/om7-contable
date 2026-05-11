import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveE7DistributionAction,
  saveE7DistributionAction,
} from "@/app/(platform)/documentos/[documentId]/distribucion/actions";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import {
  ContextualHelpCard,
  E7ConfidenceBadge,
  EmptyStateOM7,
  SectionHeader,
  WorkspaceSidebar,
} from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getE7DistributionWorkspace } from "@/lib/e7-mind";

type DistributionPageProps = {
  params: Promise<{
    documentId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

const taxOptions = [
  ["iva_credito_fiscal", "IVA credito fiscal"],
  ["iva_debito_fiscal", "IVA debito fiscal"],
  ["exento", "Exento"],
  ["no_acreditable", "No acreditable"],
  ["not_applicable", "No aplica"],
] as const;

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

export default async function E7DistributionPage({
  params,
  searchParams,
}: DistributionPageProps) {
  const { documentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const workspaceResult = await getE7DistributionWorkspace(documentId)
    .then((data) => ({ data, error: null as string | null }))
    .catch((error) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar E7 Mind Contable.",
    }));
  const workspace = workspaceResult.data;

  if (!workspace) {
    if (!workspaceResult.error) {
      notFound();
    }

    return (
      <ModuleFrame>
        <ModuleHeader
          title="E7 Mind Contable"
          description="Workspace de distribucion contable asistida."
          action={
            <BackLink href={`/documentos/${documentId}`} label="Volver al documento" />
          }
        />
        <PremiumCard className="border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-base font-semibold text-amber-50">
            No se pudo abrir el workspace
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            {workspaceResult.error}
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-100/70">
            Si acabas de actualizar OM7, aplica primero{" "}
            <span className="font-semibold">
              supabase/schema-024-e7-mind-distributions.sql
            </span>
            .
          </p>
        </PremiumCard>
      </ModuleFrame>
    );
  }

  const {
    accounts,
    classification,
    counterpartyName,
    document,
    entryLines,
    extraction,
    lines,
    totals,
  } = workspace;
  const currency = normalizeCurrencyCode(
    extraction?.extracted_data?.moneda ??
      extraction?.extracted_data?.currency ??
      "CRC",
  );
  const redirectTo = `/documentos/${document.id}/distribucion`;
  const approvedLines = lines.filter((line) => line.status === "approved").length;
  const lowConfidenceLines = lines.filter(
    (line) => Number(line.confidence_score ?? 0) < 0.65,
  ).length;
  const suggestedProgress =
    lines.length > 0 ? Math.round((approvedLines / lines.length) * 100) : 0;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="E7 Mind Contable"
        description="Workspace de distribucion contable asistida: revisa lineas, IVA, centro de costo y asiento sugerido antes de convertir."
        action={
          <BackLink
            href={`/documentos/${document.id}`}
            label="Volver al documento"
          />
        }
      />

      {resolvedSearchParams.error ? (
        <PremiumCard className="border-rose-300/20 bg-rose-300/10 p-5">
          <p className="text-base font-semibold text-rose-50">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-rose-100/80">
            {resolvedSearchParams.error}
          </p>
        </PremiumCard>
      ) : null}

      {resolvedSearchParams.notice ? (
        <PremiumCard className="border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-base font-semibold text-emerald-50">
            Accion completada
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-100/80">
            {resolvedSearchParams.notice}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={document.original_filename ?? "Documento"}
          label="Documento"
          value={document.display_name ?? document.original_filename ?? "Documento"}
        />
        <MetricCard
          detail={counterpartyName ?? "Sin contraparte aceptada"}
          label="Contraparte"
          value={counterpartyName ? "Detectada" : "Pendiente"}
        />
        <MetricCard
          detail={classification?.rule_applied ?? "Reglas E7"}
          label="Sugerencia"
          value={classification?.suggested_category ?? "Distribucion"}
        />
        <MetricCard
          detail={`${approvedLines} de ${lines.length} lineas aprobadas`}
          label="Estado operativo"
          value={`${suggestedProgress}%`}
        />
      </section>

      <ContextualHelpCard
        actions={
          <>
            <span className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-3 text-sm text-slate-200">
              {lowConfidenceLines} confianza baja
            </span>
            <span className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-3 text-sm text-slate-200">
              IVA: {formatMoney(totals.tax, currency)}
            </span>
          </>
        }
      >
        <p>
              Estas validando sugerencias, no digitando contabilidad desde cero.
              Revisa las lineas con confianza baja, confirma IVA y centro de
              costo, guarda ajustes y luego aprueba la distribucion.
        </p>
      </ContextualHelpCard>

      {!extraction ? (
        <EmptyStateOM7
          action={
            <Link
              className="om7-btn-secondary inline-flex px-4 py-2.5"
              href={`/documentos/${document.id}`}
            >
              Volver al documento
            </Link>
          }
          description="Primero procesa o revisa el documento para que E7 Mind pueda sugerir lineas contables."
          title="Todavia no hay extraccion para distribuir."
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <PremiumCard className="overflow-hidden">
            <div className="border-b border-white/[0.07] p-5">
              <SectionHeader
                description="Ajusta cuenta, categoria, centro de costo e IVA solo cuando haga falta."
                title="Lineas detectadas y distribucion"
              />
            </div>

            <form action={saveE7DistributionAction} className="p-5">
              <input name="documentId" type="hidden" value={document.id} />
              <input name="redirectTo" type="hidden" value={redirectTo} />

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <article
                    className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4"
                    key={line.id}
                  >
                    <input
                      name={`lines[${index}][id]`}
                      type="hidden"
                      value={line.id}
                    />
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(170px,220px)]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <E7ConfidenceBadge value={line.confidence_score} />
                          <span className="om7-chip text-slate-300">
                            Regla: {line.rule_applied}
                          </span>
                          <span className="om7-chip text-slate-300">
                            {taxOptions.find(
                              ([value]) => value === line.tax_treatment,
                            )?.[1] ?? "IVA por revisar"}
                          </span>
                        </div>
                        <h2 className="mt-4 text-base font-semibold text-white">
                          {line.line_description}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Sugerido: {line.suggested_category ?? "Sin categoria"} ·{" "}
                          {line.suggested_account ?? "Sin cuenta"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-left lg:text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Total linea
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {formatMoney(line.total, currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          IVA {formatMoney(line.tax, currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                          Cuenta
                        </span>
                        <input
                          className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                          defaultValue={
                            line.final_account ?? line.suggested_account ?? ""
                          }
                          list="account-options"
                          name={`lines[${index}][account]`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                          Categoria
                        </span>
                        <input
                          className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                          defaultValue={
                            line.final_category ?? line.suggested_category ?? ""
                          }
                          name={`lines[${index}][category]`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                          Centro costo
                        </span>
                        <input
                          className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                          defaultValue={
                            line.final_cost_center ??
                            line.suggested_cost_center ??
                            ""
                          }
                          name={`lines[${index}][costCenter]`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-300">
                          IVA
                        </span>
                        <select
                          className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
                          defaultValue={String(line.tax_treatment)}
                          name={`lines[${index}][taxTreatment]`}
                        >
                          {taxOptions.map(([value, label]) => (
                            <option className="bg-slate-950" key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>

              <datalist id="account-options">
                {accounts.map((account) => (
                  <option
                    key={account.id}
                    value={`${account.code} ${account.name}`}
                  />
                ))}
              </datalist>

              <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button className="om7-btn-secondary px-4 py-2.5" type="submit">
                  Guardar ajustes
                </button>
              </div>
            </form>
          </PremiumCard>

          <WorkspaceSidebar>
            <PremiumCard className="p-5">
              <p className="text-base font-semibold text-white">
                Documento original
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Fecha</span>
                  <span>
                    {extraction.extracted_data?.fecha_emision ??
                      extraction.extracted_data?.date ??
                      "Sin fecha"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{formatMoney(totals.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">IVA</span>
                  <span>{formatMoney(totals.tax, currency)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-white/[0.07] pt-3">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-semibold text-white">
                    {formatMoney(totals.total, currency)}
                  </span>
                </div>
              </div>
            </PremiumCard>

            <PremiumCard className="p-5">
              <p className="text-base font-semibold text-white">
                Asiento sugerido
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Vista preliminar construida desde la distribucion validada.
              </p>

              <div className="mt-5 space-y-4">
                {["debit", "credit"].map((side) => (
                  <div
                    className="rounded-2xl border border-white/[0.07] bg-black/15 p-4"
                    key={side}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
                      {side === "debit" ? "Debe" : "Haber"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {entryLines
                        .filter((line) => line.side === side)
                        .map((line) => (
                          <div
                            className="flex justify-between gap-3 text-sm"
                            key={`${side}-${line.account}`}
                          >
                            <span className="min-w-0 text-slate-300">
                              {line.account}
                            </span>
                            <span className="shrink-0 font-semibold text-white">
                              {formatMoney(line.amount, currency)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-400">Debe</span>
                  <span className="font-semibold text-white">
                    {formatMoney(totals.debit, currency)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-3 text-sm">
                  <span className="text-slate-400">Haber</span>
                  <span className="font-semibold text-white">
                    {formatMoney(totals.credit, currency)}
                  </span>
                </div>
                <div className="mt-3 border-t border-white/[0.07] pt-3">
                  <span
                    className={
                      Math.abs(totals.difference) < 0.01
                        ? "om7-chip om7-chip-emerald"
                        : "om7-chip om7-chip-amber"
                    }
                  >
                    {Math.abs(totals.difference) < 0.01
                      ? "Cuadra"
                      : `Diferencia ${formatMoney(totals.difference, currency)}`}
                  </span>
                </div>
              </div>

              <form action={approveE7DistributionAction} className="mt-5">
                <input name="documentId" type="hidden" value={document.id} />
                <input name="redirectTo" type="hidden" value={redirectTo} />
                <button
                  className="om7-btn-primary w-full px-4 py-2.5"
                  disabled={lines.length === 0 || Math.abs(totals.difference) >= 0.01}
                  type="submit"
                >
                  Aprobar y sincronizar registro
                </button>
              </form>
            </PremiumCard>
          </WorkspaceSidebar>
        </div>
      )}
    </ModuleFrame>
  );
}
