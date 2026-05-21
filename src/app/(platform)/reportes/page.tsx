import Link from "next/link";
import type { ReactNode } from "react";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
  StatusBadge,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { ExcelExportButton } from "@/components/reports/excel-export-button";
import {
  getAccountingSummaryForPeriod,
  getJournalTotals,
  listJournalEntriesForPeriod,
  type AccountingPeriodSummary,
  type JournalEntry,
} from "@/lib/accounting-entries";
import {
  getPeriodLabel,
  getPeriodStatusLabel,
  listAccountingPeriods,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import {
  getReviewStatusBadgeClass,
  getReviewStatusLabel,
} from "@/lib/accounting-review-ui";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import {
  getMonthlyReport,
  isDateInPeriod,
  type MonthlyReportPeriod,
  type ReviewStatusSummary,
} from "@/lib/monthly-reports";
import { listPurchases, type Purchase } from "@/lib/purchases";
import { listDocumentsByCompany } from "@/lib/storage";

type ReportView =
  | "contabilidad"
  | "compras-categoria"
  | "documentos"
  | "exportaciones"
  | "facturas"
  | "observados"
  | "periodo"
  | "resumen";

type ReportsPageProps = {
  searchParams?: Promise<{
    month?: string;
    view?: string;
    year?: string;
  }>;
};

type ObservedReportRecord = Purchase | Invoice;

const reportViews: Array<{
  action: string;
  description: string;
  key: ReportView;
  title: string;
}> = [
  {
    action: "Abrir reporte",
    description: "Compras, facturas, balance, pendientes y observados.",
    key: "resumen",
    title: "Resumen mensual",
  },
  {
    action: "Analizar compras",
    description: "Categorias, cantidad de compras y monto acumulado.",
    key: "compras-categoria",
    title: "Compras por categoria",
  },
  {
    action: "Ver facturas",
    description: "Ingresos del periodo y facturas por estado.",
    key: "facturas",
    title: "Facturas e ingresos",
  },
  {
    action: "Revisar bloqueos",
    description: "Pendientes y observados que pueden frenar el cierre.",
    key: "observados",
    title: "Observados y pendientes",
  },
  {
    action: "Ver flujo",
    description: "Documentos recibidos, convertidos, pendientes y errores.",
    key: "documentos",
    title: "Flujo documental",
  },
  {
    action: "Ver periodo",
    description: "Estado del mes, cierre y bloqueos operativos.",
    key: "periodo",
    title: "Reporte de periodo",
  },
  {
    action: "Ver asientos",
    description: "Asientos sugeridos, contabilizados, observados y Debe/Haber.",
    key: "contabilidad",
    title: "Contabilidad asistida",
  },
  {
    action: "Proximamente",
    description: "PDF ejecutivo y Excel detallado con formato profesional.",
    key: "exportaciones",
    title: "Exportaciones",
  },
];

function getDefaultPeriod(): MonthlyReportPeriod {
  const current = new Date();

  return {
    month: current.getMonth() + 1,
    year: current.getFullYear(),
  };
}

function parsePeriod(
  searchParams: Awaited<NonNullable<ReportsPageProps["searchParams"]>>,
) {
  const fallback = getDefaultPeriod();
  const parsedMonth = Number(searchParams.month);
  const parsedYear = Number(searchParams.year);

  return {
    month:
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : fallback.month,
    year:
      Number.isInteger(parsedYear) && parsedYear > 2000
        ? parsedYear
        : fallback.year,
  };
}

function parseView(value: string | undefined): ReportView | "general" {
  return reportViews.some((view) => view.key === value)
    ? (value as ReportView)
    : "general";
}

function getReportHref(view: ReportView | "general", period: MonthlyReportPeriod) {
  const viewParam = view === "general" ? "" : `&view=${view}`;

  return `/reportes?year=${period.year}&month=${period.month}${viewParam}`;
}

function getRecentPeriods(count = 6) {
  const current = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);

    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  });
}

function getRecordTitle(record: ObservedReportRecord) {
  return "supplier_name" in record
    ? record.counterparty?.name ?? record.supplier_name ?? "Sin proveedor"
    : record.counterparty?.name ?? record.proveedor ?? "Sin cliente";
}

function getRecordCurrency(record: ObservedReportRecord) {
  return "supplier_name" in record ? record.currency : record.moneda;
}

function getPeriodStatus(
  periods: AccountingPeriod[],
  period: MonthlyReportPeriod,
) {
  return (
    periods.find(
      (item) =>
        item.period_year === period.year && item.period_month === period.month,
    )?.status ?? "open"
  );
}

function getStatusTone(summary: ReviewStatusSummary) {
  return summary.status === "observed"
    ? "border-rose-300/15 bg-rose-300/[0.06]"
    : summary.status === "approved"
      ? "border-emerald-300/15 bg-emerald-300/[0.06]"
      : summary.status === "reviewed"
        ? "border-cyan-300/15 bg-cyan-300/[0.06]"
        : "border-amber-300/15 bg-amber-300/[0.06]";
}

function getExcelExportHref(period: MonthlyReportPeriod) {
  return `/reportes/export/excel?year=${period.year}&month=${period.month}`;
}

function ExportActions({ period }: { period: MonthlyReportPeriod }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="om7-btn-secondary cursor-not-allowed px-4 py-2.5 opacity-60"
        disabled
        type="button"
      >
        Exportar PDF
      </button>
      <ExcelExportButton href={getExcelExportHref(period)} />
    </div>
  );
}

function PeriodSelector({
  activeView,
  period,
}: {
  activeView: ReportView | "general";
  period: MonthlyReportPeriod;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {getRecentPeriods().map((item) => {
        const isActive = item.month === period.month && item.year === period.year;

        return (
          <Link
            className={[
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              isActive
                ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
            ].join(" ")}
            href={getReportHref(activeView, item)}
            key={`${item.year}-${item.month}`}
          >
            {getPeriodLabel(item.year, item.month)}
          </Link>
        );
      })}
    </div>
  );
}

function StatusSummaryGrid({
  currency,
  items,
}: {
  currency: string;
  items: ReviewStatusSummary[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          className={`rounded-2xl border p-4 ${getStatusTone(item)}`}
          key={item.status}
        >
          <span className={getReviewStatusBadgeClass(item.status)}>
            {getReviewStatusLabel(item.status)}
          </span>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-white">{item.count}</p>
              <p className="mt-1 text-xs text-slate-500">registros</p>
            </div>
            <p className="text-sm font-semibold text-slate-100">
              {formatCurrencyAmount(item.amount, currency)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyReportState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-8 text-center">
      <p className="text-sm font-semibold text-white">Sin datos suficientes</p>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function getEmptyAccountingSummary(): AccountingPeriodSummary {
  return {
    credit: 0,
    debit: 0,
    difference: 0,
    isBalanced: true,
    observed: 0,
    pendingToPost: 0,
    posted: 0,
    reviewed: 0,
    suggested: 0,
    totalEntries: 0,
  };
}

function AccountingStatusCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <p className="text-xs text-slate-500">{detail}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-300">{label}</p>
    </div>
  );
}

function ReportCard({
  action,
  description,
  href,
  metric,
  title,
}: {
  action: string;
  description: string;
  href: string;
  metric: string;
  title: string;
}) {
  return (
    <Link
      className="group rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),rgba(255,255,255,0.035)] p-5 shadow-2xl shadow-black/15 transition hover:border-cyan-300/25 hover:bg-white/[0.055]"
      href={href}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
            Reporte
          </p>
          <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-xs text-slate-300">
          {metric}
        </span>
      </div>
      <p className="mt-4 min-h-12 text-sm leading-6 text-slate-500">
        {description}
      </p>
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <span className="text-xs text-slate-500">Sub-dashboard</span>
        <span className="text-sm font-semibold text-cyan-100 transition group-hover:text-white">
          {action}
        </span>
      </div>
    </Link>
  );
}

function ReportShell({
  children,
  description,
  period,
  title,
}: {
  children: ReactNode;
  description: string;
  period: MonthlyReportPeriod;
  title: string;
}) {
  return (
    <PremiumCard className="overflow-hidden">
      <div className="border-b border-white/[0.07] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-base font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {description} · {getPeriodLabel(period.year, period.month)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BackLink
              href={getReportHref("general", period)}
              label="Volver a reportes"
            />
            <ExportActions period={period} />
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </PremiumCard>
  );
}

function ReportsModal({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <div
      className="invisible fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 opacity-0 backdrop-blur-sm transition target:visible target:opacity-100 sm:p-6"
      id={id}
    >
      <div className="flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-[#07111f] shadow-2xl shadow-cyan-950/30">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 bg-[#06101c] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
              OM7 Finance OS
            </p>
            <p className="mt-1 truncate text-xl font-semibold text-white">
              {title}
            </p>
          </div>
          <a
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
            href="#panel-reportes"
          >
            Cerrar
          </a>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 om7-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPeriod = parsePeriod(resolvedSearchParams);
  const activeView = parseView(resolvedSearchParams.view);
  const [
    { activeContext, purchases },
    { invoices },
    { documents },
    periodsResult,
    accountingSummary,
    journalEntriesResult,
  ] = await Promise.all([
    listPurchases(),
    getInvoicesForActiveCompany(),
    listDocumentsByCompany(),
    listAccountingPeriods().catch(() => ({
      periods: [] as AccountingPeriod[],
    })),
    getAccountingSummaryForPeriod(
      undefined,
      selectedPeriod.year,
      selectedPeriod.month,
    ).catch(() => getEmptyAccountingSummary()),
    listJournalEntriesForPeriod(
      undefined,
      selectedPeriod.year,
      selectedPeriod.month,
    ).catch(() => ({
      entries: [] as JournalEntry[],
    })),
  ]);
  const activeCompany = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const report = getMonthlyReport({
    documents,
    invoices,
    period: selectedPeriod,
    purchases,
  });
  const periodStatus = getPeriodStatus(periodsResult.periods, selectedPeriod);
  const periodPurchases = purchases.filter((purchase) =>
    isDateInPeriod(purchase.purchase_date ?? purchase.created_at, selectedPeriod),
  );
  const periodInvoices = invoices.filter((invoice) =>
    isDateInPeriod(invoice.fecha ?? invoice.created_at, selectedPeriod),
  );
  const hasAttention = report.pending > 0 || report.observed > 0;
  const consoleCards = [
    {
      action: "Abrir",
      description: "Balance operativo, compras, facturas y bloqueos del mes.",
      href: "#modal-resumen",
      metric: formatCurrencyAmount(report.balance, currency),
      title: "Resumen mensual",
    },
    {
      action: "Analizar",
      description: "Categorias de gasto y concentracion de compras.",
      href: "#modal-compras",
      metric: `${report.purchaseCategories.length} categorias`,
      title: "Compras",
    },
    {
      action: "Ver",
      description: "Ingresos del periodo y facturas por estado.",
      href: "#modal-facturas",
      metric: formatCurrencyAmount(report.totalInvoices, currency),
      title: "Facturas",
    },
    {
      action: "Revisar",
      description: "Pendientes y observados que frenan cierre.",
      href: "#modal-bloqueos",
      metric: `${report.observed} observados`,
      title: "Bloqueos",
    },
    {
      action: "Validar",
      description: "Asientos, Debe/Haber y estado contable del mes.",
      href: "#modal-contabilidad",
      metric: `${accountingSummary.totalEntries} asientos`,
      title: "Contabilidad",
    },
    {
      action: "Exportar",
      description: "Excel detallado y estructura de PDF ejecutivo.",
      href: "#modal-exportaciones",
      metric: "PDF / Excel",
      title: "Exportaciones",
    },
  ];

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Reportes"
        description="Centro general de analisis mensual: escoge un reporte, revisa bloqueos y prepara exportaciones sin entrar en tablas pesadas."
        action={
          activeView === "general" ? (
            <BackLink />
          ) : (
            <BackLink
              href={getReportHref("general", selectedPeriod)}
              label="Volver a reportes"
            />
          )
        }
      />

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona un cliente/empresa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Los reportes mensuales se calculan para el cliente/empresa activo.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a clientes/empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="sticky top-[var(--om7-actions-sticky-top,12.5rem)] z-40 rounded-2xl border border-white/16 bg-[#06101c] p-2 shadow-2xl shadow-black/25 lg:top-[var(--om7-actions-sticky-top-lg,9.25rem)]">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto om7-scrollbar">
          {[
            ["#modal-resumen", "Resumen"],
            ["#modal-compras", "Compras"],
            ["#modal-facturas", "Facturas"],
            ["#modal-bloqueos", "Bloqueos"],
            ["#modal-contabilidad", "Contabilidad"],
            ["#modal-exportaciones", "Exportaciones"],
          ].map(([href, label]) => (
            <a
              className="grid h-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm font-semibold text-slate-300 transition hover:border-cyan-200/25 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <div id="panel-reportes">
      <PremiumCard className="p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Cockpit de reportes
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {activeCompany?.name ?? "Sin cliente activo"} ·{" "}
                {getPeriodLabel(selectedPeriod.year, selectedPeriod.month)}
              </p>
            </div>
            <StatusBadge>{getPeriodStatusLabel(periodStatus)}</StatusBadge>
          </div>
          <PeriodSelector activeView={activeView} period={selectedPeriod} />
        </div>
      </PremiumCard>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${periodPurchases.length} registros`}
          label="Compras"
          value={formatCurrencyAmount(report.totalPurchases, currency)}
        />
        <MetricCard
          detail={`${periodInvoices.length} registros`}
          label="Facturas"
          value={formatCurrencyAmount(report.totalInvoices, currency)}
        />
        <MetricCard
          detail={report.balance >= 0 ? "Resultado positivo" : "Gasto mayor"}
          label="Balance simple"
          value={formatCurrencyAmount(report.balance, currency)}
        />
        <MetricCard
          detail={hasAttention ? "Requiere accion" : "Listo para cierre"}
          label="Estado del mes"
          value={hasAttention ? "Atencion" : "Ordenado"}
        />
      </section>

      {activeView === "general" ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {consoleCards.map((card) => (
              <ReportCard
                action={card.action}
                description={card.description}
                href={card.href}
                key={card.title}
                metric={card.metric}
                title={card.title}
              />
            ))}
          </section>

          <ReportsModal id="modal-resumen" title="Resumen mensual">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                detail={`${periodPurchases.length} compras`}
                label="Total compras"
                value={formatCurrencyAmount(report.totalPurchases, currency)}
              />
              <MetricCard
                detail={`${periodInvoices.length} facturas`}
                label="Total facturas"
                value={formatCurrencyAmount(report.totalInvoices, currency)}
              />
              <MetricCard
                detail={hasAttention ? "Requiere accion" : "Listo para cierre"}
                label="Pendientes"
                value={String(report.pending)}
              />
              <MetricCard
                detail="Bloquean cierre"
                label="Observados"
                value={String(report.observed)}
              />
            </section>
          </ReportsModal>

          <ReportsModal id="modal-compras" title="Compras por categoria">
            <div className="max-h-[62vh] overflow-y-auto om7-scrollbar">
              <div className="grid gap-3">
                {report.purchaseCategories.length > 0 ? (
                  report.purchaseCategories.map((category) => (
                    <div
                      className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                      key={category.key}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {category.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {category.count} compras
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-cyan-50">
                          {formatCurrencyAmount(category.amount, currency)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyReportState text="No hay compras registradas en este periodo." />
                )}
              </div>
            </div>
          </ReportsModal>

          <ReportsModal id="modal-facturas" title="Facturas e ingresos">
            <StatusSummaryGrid currency={currency} items={report.invoiceStatus} />
          </ReportsModal>

          <ReportsModal id="modal-bloqueos" title="Bloqueos del periodo">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                detail="Compras + facturas"
                label="Pendientes"
                value={String(report.pending)}
              />
              <MetricCard
                detail="Necesitan correccion"
                label="Observados"
                value={String(report.observed)}
              />
              <MetricCard
                detail="Listos para cierre"
                label="Aprobados"
                value={String(report.approved)}
              />
            </div>
            <div className="mt-5 max-h-[52vh] overflow-y-auto om7-scrollbar">
              <div className="grid gap-3">
                {report.observedRecords.length > 0 ? (
                  report.observedRecords.map((record) => {
                    const isPurchase = "supplier_name" in record;

                    return (
                      <div
                        className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4"
                        key={`${isPurchase ? "purchase" : "invoice"}-${record.id}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="om7-chip om7-chip-amber">
                                {isPurchase ? "Compra" : "Factura"}
                              </span>
                              <span className={getReviewStatusBadgeClass("observed")}>
                                {getReviewStatusLabel("observed")}
                              </span>
                            </div>
                            <p className="mt-3 truncate text-sm font-semibold text-white">
                              {getRecordTitle(record)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-amber-100/75">
                              {record.review_notes ?? "Sin nota registrada"}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-semibold text-white">
                            {formatCurrencyAmount(record.total, getRecordCurrency(record))}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyReportState text="No hay observaciones activas para este periodo." />
                )}
              </div>
            </div>
          </ReportsModal>

          <ReportsModal id="modal-contabilidad" title="Contabilidad asistida">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AccountingStatusCard
                detail="Entradas del periodo"
                label="Total asientos"
                value={String(accountingSummary.totalEntries)}
              />
              <AccountingStatusCard
                detail="Ya registrados"
                label="Contabilizados"
                value={String(accountingSummary.posted)}
              />
              <AccountingStatusCard
                detail="Necesitan correccion"
                label="Observados"
                value={String(accountingSummary.observed)}
              />
              <AccountingStatusCard
                detail="Sugeridos, revisados u observados"
                label="Por contabilizar"
                value={String(accountingSummary.pendingToPost)}
              />
            </section>
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {accountingSummary.isBalanced ? "Cuadra" : "Con diferencia"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Diferencia Debe/Haber:{" "}
                    {formatCurrencyAmount(accountingSummary.difference, currency)}
                  </p>
                </div>
                <Link className="om7-btn-secondary px-4 py-2.5" href="/contabilidad">
                  Abrir contabilidad
                </Link>
              </div>
            </div>
          </ReportsModal>

          <ReportsModal id="modal-exportaciones" title="Exportaciones">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  detail:
                    "Incluira encabezado, cliente/empresa, periodo, fecha de generacion, resumen ejecutivo, resumen contable, Debe/Haber, observaciones y trazabilidad.",
                  title: "PDF ejecutivo",
                },
                {
                  detail:
                    "Incluira totales, subtotales, detalle justificado, categorias, estados, documentos origen, asientos contabilizados y pendientes de contabilizar.",
                  title: "Excel detallado",
                },
              ].map((item) => (
                <div
                  className="rounded-2xl border border-white/[0.08] bg-black/15 p-5"
                  key={item.title}
                >
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {item.detail}
                  </p>
                  <div className="mt-5">
                    <ExportActions period={selectedPeriod} />
                  </div>
                </div>
              ))}
            </div>
          </ReportsModal>
        </>
      ) : null}

      {activeView === "resumen" ? (
        <ReportShell
          description="Balance operativo y estado del mes"
          period={selectedPeriod}
          title="Resumen mensual"
        >
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail={`${periodPurchases.length} compras`}
              label="Total compras"
              value={formatCurrencyAmount(report.totalPurchases, currency)}
            />
            <MetricCard
              detail={`${periodInvoices.length} facturas`}
              label="Total facturas"
              value={formatCurrencyAmount(report.totalInvoices, currency)}
            />
            <MetricCard
              detail={hasAttention ? "Requiere accion" : "Listo para cierre"}
              label="Pendientes"
              value={String(report.pending)}
            />
            <MetricCard
              detail="Bloquean cierre"
              label="Observados"
              value={String(report.observed)}
            />
          </section>
        </ReportShell>
      ) : null}

      {activeView === "compras-categoria" ? (
        <ReportShell
          description="Concentracion de gastos del periodo"
          period={selectedPeriod}
          title="Compras por categoria"
        >
          <div className="max-h-[520px] overflow-y-auto overscroll-contain">
            <div className="grid gap-3">
              {report.purchaseCategories.length > 0 ? (
                report.purchaseCategories.map((category) => (
                  <div
                    className="rounded-2xl border border-white/[0.08] bg-black/15 p-4"
                    key={category.key}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {category.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.count} compras
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-cyan-50">
                        {formatCurrencyAmount(category.amount, currency)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyReportState text="No hay compras registradas en este periodo." />
              )}
            </div>
          </div>
        </ReportShell>
      ) : null}

      {activeView === "facturas" ? (
        <ReportShell
          description="Ingresos y estado de revision de facturas"
          period={selectedPeriod}
          title="Facturas e ingresos"
        >
          <StatusSummaryGrid currency={currency} items={report.invoiceStatus} />
        </ReportShell>
      ) : null}

      {activeView === "observados" ? (
        <ReportShell
          description="Bloqueos activos del periodo"
          period={selectedPeriod}
          title="Observados y pendientes"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              detail="Compras + facturas"
              label="Pendientes"
              value={String(report.pending)}
            />
            <MetricCard
              detail="Necesitan correccion"
              label="Observados"
              value={String(report.observed)}
            />
            <MetricCard
              detail="Listos para cierre"
              label="Aprobados"
              value={String(report.approved)}
            />
          </div>
          <div className="mt-5 max-h-[430px] overflow-y-auto overscroll-contain">
            <div className="grid gap-3">
              {report.observedRecords.length > 0 ? (
                report.observedRecords.map((record) => {
                  const isPurchase = "supplier_name" in record;

                  return (
                    <div
                      className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4"
                      key={`${isPurchase ? "purchase" : "invoice"}-${record.id}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="om7-chip om7-chip-amber">
                              {isPurchase ? "Compra" : "Factura"}
                            </span>
                            <span className={getReviewStatusBadgeClass("observed")}>
                              {getReviewStatusLabel("observed")}
                            </span>
                          </div>
                          <p className="mt-3 truncate text-sm font-semibold text-white">
                            {getRecordTitle(record)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-amber-100/75">
                            {record.review_notes ?? "Sin nota registrada"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-white">
                          {formatCurrencyAmount(record.total, getRecordCurrency(record))}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyReportState text="No hay observaciones activas para este periodo." />
              )}
            </div>
          </div>
        </ReportShell>
      ) : null}

      {activeView === "documentos" ? (
        <ReportShell
          description="Recibidos, convertidos y pendientes de accion"
          period={selectedPeriod}
          title="Flujo documental"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Recibidos", report.documents.received, "Portal y cargas internas"],
              ["Convertidos", report.documents.converted, "Ya generaron registro"],
              ["Pendientes", report.documents.pending, "Falta accion"],
              ["Errores", report.documents.errors, "Requieren atencion"],
              ["Sin convertir", report.documents.unconverted, "Aun no cierran ciclo"],
            ].map(([label, value, detail]) => (
              <div
                className="rounded-2xl border border-white/[0.07] bg-black/15 p-4"
                key={label}
              >
                <p className="text-xs text-slate-500">{detail}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-300">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </ReportShell>
      ) : null}

      {activeView === "periodo" ? (
        <ReportShell
          description="Estado del mes y preparacion de cierre"
          period={selectedPeriod}
          title="Reporte de periodo"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              detail="Estado administrativo"
              label="Periodo"
              value={getPeriodStatusLabel(periodStatus)}
            />
            <MetricCard
              detail="Bloquean cierre"
              label="Observados"
              value={String(report.observed)}
            />
            <MetricCard
              detail="Falta revisar"
              label="Pendientes"
              value={String(report.pending)}
            />
            <MetricCard
              detail={hasAttention ? "Resolver antes de cerrar" : "Sin bloqueos"}
              label="Cierre"
              value={hasAttention ? "Con bloqueos" : "Listo"}
            />
          </div>
        </ReportShell>
      ) : null}

      {activeView === "contabilidad" ? (
        <ReportShell
          description="Asientos sugeridos, revisados y contabilizados"
          period={selectedPeriod}
          title="Contabilidad asistida"
        >
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AccountingStatusCard
              detail="Entradas del periodo"
              label="Total asientos"
              value={String(accountingSummary.totalEntries)}
            />
            <AccountingStatusCard
              detail="OM7 preparo propuesta"
              label="Sugeridos"
              value={String(accountingSummary.suggested)}
            />
            <AccountingStatusCard
              detail="Revisados sin contabilizar"
              label="Revisados"
              value={String(accountingSummary.reviewed)}
            />
            <AccountingStatusCard
              detail="Ya registrados"
              label="Contabilizados"
              value={String(accountingSummary.posted)}
            />
            <AccountingStatusCard
              detail="Necesitan correccion"
              label="Observados"
              value={String(accountingSummary.observed)}
            />
            <AccountingStatusCard
              detail="Sugeridos, revisados u observados"
              label="Por contabilizar"
              value={String(accountingSummary.pendingToPost)}
            />
            <AccountingStatusCard
              detail="Movimiento Debe"
              label="Total debe"
              value={formatCurrencyAmount(accountingSummary.debit, currency)}
            />
            <AccountingStatusCard
              detail="Movimiento Haber"
              label="Total haber"
              value={formatCurrencyAmount(accountingSummary.credit, currency)}
            />
          </section>

          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {accountingSummary.isBalanced ? "Cuadra" : "Con diferencia"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Diferencia Debe/Haber:{" "}
                  {formatCurrencyAmount(accountingSummary.difference, currency)}
                </p>
              </div>
              <Link className="om7-btn-secondary px-4 py-2.5" href="/contabilidad">
                Abrir contabilidad
              </Link>
            </div>
          </div>

          <div className="mt-5 max-h-[430px] overflow-y-auto overscroll-contain">
            <div className="grid gap-3">
              {journalEntriesResult.entries.length > 0 ? (
                journalEntriesResult.entries.slice(0, 8).map((entry) => {
                  const totals = getJournalTotals(entry);

                  return (
                    <div
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                      key={entry.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="om7-chip om7-chip-cyan">
                              {entry.source_type === "purchase" ? "Compra" : "Factura"}
                            </span>
                            <span className="om7-chip text-slate-300">
                              {entry.status === "posted"
                                ? "Contabilizado"
                                : entry.status === "reviewed"
                                  ? "Revisado"
                                  : entry.status === "observed"
                                    ? "Observado"
                                    : "Sugerido"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-white">
                            Asiento {entry.source_type === "purchase" ? "de compra" : "de factura"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                            {entry.explanation ?? "Sin explicacion registrada"}
                          </p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-sm font-semibold text-white">
                            {totals.isBalanced ? "Cuadra" : "Diferencia"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Debe {formatCurrencyAmount(totals.debit, currency)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Haber {formatCurrencyAmount(totals.credit, currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyReportState text="No hay asientos en este periodo." />
              )}
            </div>
          </div>
        </ReportShell>
      ) : null}

      {activeView === "exportaciones" ? (
        <ReportShell
          description="Estructura visual para PDF ejecutivo y Excel detallado"
          period={selectedPeriod}
          title="Exportaciones"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                detail:
                  "Incluira encabezado, cliente/empresa, periodo, fecha de generacion, resumen ejecutivo, resumen contable, Debe/Haber, observaciones y trazabilidad.",
                title: "PDF ejecutivo",
              },
              {
                detail:
                  "Incluira totales, subtotales, detalle justificado, categorias, estados, documentos origen, asientos contabilizados y pendientes de contabilizar.",
                title: "Excel detallado",
              },
            ].map((item) => (
              <div
                className="rounded-2xl border border-white/[0.08] bg-black/15 p-5"
                key={item.title}
              >
                <p className="text-base font-semibold text-white">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {item.detail}
                </p>
                <div className="mt-5">
                  <ExportActions period={selectedPeriod} />
                </div>
              </div>
            ))}
          </div>
        </ReportShell>
      ) : null}
    </ModuleFrame>
  );
}
