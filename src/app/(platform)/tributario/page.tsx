import Link from "next/link";
import {
  ContextualHelpCard,
  E7ConfidenceBadge,
  EmptyStateOM7,
  KPIStatCard,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
  WorkspacePanel,
} from "@/components/om7/operational-design-system";
import { BackLink, ModuleHeader } from "@/components/modules/shared";
import { getPeriodLabel } from "@/lib/accounting-periods";
import { formatCurrencyAmount } from "@/lib/currency";
import {
  getTaxCenterData,
  getTaxTreatmentStatusLabel,
  type TaxCenterRecord,
} from "@/lib/tax-center";

type TaxPageProps = {
  searchParams?: Promise<{
    month?: string;
    year?: string;
  }>;
};

function parsePeriodValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getAccountingLabel(status: TaxCenterRecord["accountingStatus"]) {
  if (status === "posted") {
    return "Contabilizado";
  }

  if (status === "reviewed") {
    return "Asiento revisado";
  }

  if (status === "observed") {
    return "Asiento observado";
  }

  if (status === "suggested") {
    return "Asiento sugerido";
  }

  return "Sin asiento";
}

function getAccountingTone(status: TaxCenterRecord["accountingStatus"]) {
  if (status === "posted") {
    return "emerald" as const;
  }

  if (status === "reviewed" || status === "suggested") {
    return "cyan" as const;
  }

  if (status === "observed") {
    return "rose" as const;
  }

  return "amber" as const;
}

function getReviewTone(status: string) {
  if (status === "approved") {
    return "emerald" as const;
  }

  if (status === "reviewed") {
    return "cyan" as const;
  }

  if (status === "observed") {
    return "rose" as const;
  }

  return "amber" as const;
}

function getReviewLabel(status: string) {
  if (status === "approved") {
    return "Aprobada";
  }

  if (status === "reviewed") {
    return "Revisada";
  }

  if (status === "observed") {
    return "Observada";
  }

  return "Pendiente";
}

function getMindTone(status: string) {
  if (status === "optimal") {
    return "emerald" as const;
  }

  if (status === "review_recommended") {
    return "amber" as const;
  }

  return "rose" as const;
}

function TaxRecordList({
  currency,
  emptyTitle,
  records,
  taxLabel,
  title,
}: {
  currency: string;
  emptyTitle: string;
  records: TaxCenterRecord[];
  taxLabel: string;
  title: string;
}) {
  return (
    <WorkspacePanel className="p-5">
      <SectionHeader
        description={`${records.length} registro(s) del periodo seleccionado.`}
        title={title}
      />

      {records.length === 0 ? (
        <div className="mt-5">
          <EmptyStateOM7
            description="Cuando existan registros con IVA para este periodo apareceran aqui."
            title={emptyTitle}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {records.map((record) => (
            <article
              className="rounded-2xl border border-white/[0.07] bg-black/15 p-4"
              key={record.id}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={getReviewTone(record.reviewStatus)}>
                      {getReviewLabel(record.reviewStatus)}
                    </StatusBadge>
                    <StatusBadge tone={getAccountingTone(record.accountingStatus)}>
                      {getAccountingLabel(record.accountingStatus)}
                    </StatusBadge>
                    {record.taxTreatment ? (
                      <StatusBadge
                        tone={
                          record.taxTreatment === "creditable"
                            ? "emerald"
                            : record.taxTreatment === "review"
                              ? "amber"
                              : "slate"
                        }
                      >
                        {getTaxTreatmentStatusLabel(record.taxTreatment)}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <h3 className="mt-3 truncate text-base font-semibold text-white">
                    {record.counterparty}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {record.documentNumber ?? "Sin documento"} ·{" "}
                    {record.date ?? "Sin fecha"}
                  </p>
                </div>
                <div className="grid min-w-0 gap-2 text-left sm:grid-cols-3 lg:w-full lg:max-w-[360px]">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Subtotal</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrencyAmount(record.subtotal, currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">{taxLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrencyAmount(record.tax, currency)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {formatCurrencyAmount(record.total, currency)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {record.documentHref ? (
                  <Link className="om7-btn-secondary px-3 py-2 text-xs" href={record.documentHref}>
                    Ver documento
                  </Link>
                ) : null}
                {record.e7Href ? (
                  <Link className="om7-btn-ghost px-3 py-2 text-xs" href={record.e7Href}>
                    Ver validacion E7
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </WorkspacePanel>
  );
}

export default async function TaxCenterPage({ searchParams }: TaxPageProps) {
  const params = searchParams ? await searchParams : {};
  const today = new Date();
  const year = parsePeriodValue(params.year, today.getFullYear());
  const month = Math.min(parsePeriodValue(params.month, today.getMonth() + 1), 12);
  const data = await getTaxCenterData({ month, year });
  const periodLabel = getPeriodLabel(data.period.year, data.period.month);

  return (
    <WorkspaceLayout>
      <ModuleHeader
        action={<BackLink href="/periodos" label="Volver a periodos" />}
        description="Consolidacion mensual de IVA debito, IVA credito, neto tributario y alertas antes del cierre."
        eyebrow="Control mensual"
        title="Centro Tributario OM7"
      />

      <ContextualHelpCard
        actions={
          <>
            <Link className="om7-btn-secondary px-4 py-2.5" href="/facturas">
              Revisar facturas
            </Link>
            <Link className="om7-btn-secondary px-4 py-2.5" href="/compras">
              Revisar compras
            </Link>
            <Link className="om7-btn-primary px-4 py-2.5" href="/periodos">
              Ir a cierre mensual
            </Link>
          </>
        }
      >
        Este modulo consolida el IVA del periodo. Revisa el IVA debito de
        ventas, el IVA credito de compras y el IVA neto antes del cierre
        mensual. Prioriza pendientes, asientos sin contabilizar y compras con
        tratamiento IVA no claro.
      </ContextualHelpCard>

      <WorkspacePanel
        className="p-5 shadow-2xl shadow-black/20"
        tone={getMindTone(data.e7Mind.status)}
      >
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                E7 Mind Tributario
              </p>
              <StatusBadge tone={getMindTone(data.e7Mind.status)}>
                {data.e7Mind.statusLabel}
              </StatusBadge>
              <E7ConfidenceBadge value={data.e7Mind.score / 100} />
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Lectura inteligente del estado tributario del periodo.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {data.e7Mind.summary}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {data.e7Mind.highlights.map((item) => (
                <div
                  className="rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2.5"
                  key={item.label}
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {data.e7Mind.alerts.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {data.e7Mind.alerts.slice(0, 3).map((alert) => (
                  <p
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-sm text-slate-300"
                    key={alert}
                  >
                    {alert}
                  </p>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  "IVA contabilizado correctamente",
                  "Sin alertas criticas",
                  "Periodo listo para revision final",
                ].map((item) => (
                  <p
                    className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2 text-sm text-emerald-100"
                    key={item}
                  >
                    {item}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 rounded-3xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Confianza tributaria
            </p>
            <div className="mt-4 flex items-end gap-2">
              <p className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {data.e7Mind.score}
              </p>
              <p className="pb-1.5 text-sm font-semibold text-slate-400">%</p>
            </div>
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Proximo paso sugerido
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white">
                {data.e7Mind.recommendedStep}
              </p>
            </div>
          </div>
        </div>
      </WorkspacePanel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          detail={`Ventas aprobadas · ${periodLabel}`}
          label="IVA debito fiscal"
          tone="emerald"
          value={formatCurrencyAmount(data.salesTaxDebit, data.currency)}
        />
        <KPIStatCard
          detail={`Compras acreditables · ${periodLabel}`}
          label="IVA credito fiscal"
          tone="cyan"
          value={formatCurrencyAmount(data.purchaseTaxCredit, data.currency)}
        />
        <KPIStatCard
          detail={data.taxNet >= 0 ? "IVA por pagar estimado" : "Saldo a favor estimado"}
          label="IVA neto"
          tone={data.taxNet >= 0 ? "amber" : "emerald"}
          value={formatCurrencyAmount(data.taxNet, data.currency)}
        />
        <KPIStatCard
          detail="Pendientes, observados o revisados con IVA"
          label="IVA pendiente"
          tone={data.pendingDocumentsWithTax > 0 ? "amber" : "emerald"}
          value={String(data.pendingDocumentsWithTax)}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          detail="Subtotal con IVA en facturas"
          label="Ventas gravadas"
          value={formatCurrencyAmount(data.salesTaxableBase, data.currency)}
        />
        <KPIStatCard
          detail="Subtotal con IVA en compras"
          label="Compras gravadas"
          value={formatCurrencyAmount(data.purchaseTaxableBase, data.currency)}
        />
        <KPIStatCard
          detail="IVA credito sin tratamiento claro"
          label="Requiere revision"
          tone={data.purchaseTaxReview > 0 ? "rose" : "emerald"}
          value={formatCurrencyAmount(data.purchaseTaxReview, data.currency)}
        />
        <KPIStatCard
          detail="Lectura desde asientos posted"
          label="IVA en contabilidad"
          value={`${formatCurrencyAmount(data.accountingTaxDebit, data.currency)} / ${formatCurrencyAmount(data.accountingTaxCredit, data.currency)}`}
        />
      </section>

      <WorkspacePanel className="p-5" tone={data.alerts.length > 0 ? "amber" : "emerald"}>
        <SectionHeader
          description={
            data.alerts.length > 0
              ? "Riesgos y diferencias operativas antes del cierre."
              : "No hay alertas tributarias para este periodo."
          }
          title="Alertas tributarias"
        />
        {data.alerts.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {data.alerts.map((alert) => (
              <div
                className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                key={alert.title}
              >
                <StatusBadge tone={alert.tone}>{alert.title}</StatusBadge>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
            El periodo no muestra IVA pendiente, compras con tratamiento dudoso
            ni registros aprobados sin asiento contabilizado.
          </p>
        )}
      </WorkspacePanel>

      <section className="grid gap-5 xl:grid-cols-2">
        <TaxRecordList
          currency={data.currency}
          emptyTitle="Sin facturas con IVA"
          records={data.sales}
          taxLabel="IVA debito"
          title="Ventas / facturas"
        />
        <TaxRecordList
          currency={data.currency}
          emptyTitle="Sin compras con IVA"
          records={data.purchases}
          taxLabel="IVA credito"
          title="Compras / gastos"
        />
      </section>
    </WorkspaceLayout>
  );
}
