import Link from "next/link";
import { StatusBadge } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { Icon } from "@/components/ui/icons";
import type { ActiveContext } from "@/lib/active-context";
import type { AdminDashboardMetrics } from "@/lib/admin-dashboard";
import type { AccountingPeriodSummary } from "@/lib/accounting-entries";
import {
  getPeriodLabel,
  getPeriodStatusLabel,
  type AccountingPeriod,
} from "@/lib/accounting-periods";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import type { CounterpartyRecord } from "@/lib/counterparties";
import { formatCurrencyAmount } from "@/lib/currency";
import type {
  AlertaContable,
  DashboardContableEjecutivo,
} from "@/lib/dashboard-contable";
import { getDocumentHumanStatus } from "@/lib/document-ui";
import type { Invoice } from "@/lib/invoices";
import type { CashflowOverview } from "@/lib/payments";
import type { Purchase } from "@/lib/purchases";
import type { listDocumentsByCompany } from "@/lib/storage";

type DashboardDocument = Awaited<
  ReturnType<typeof listDocumentsByCompany>
>["documents"][number];

type DashboardViewProps = {
  activeContext?: ActiveContext;
  adminMetrics?: AdminDashboardMetrics;
  accountingSummary?: AccountingPeriodSummary | null;
  alertasContables?: AlertaContable[];
  counterparties?: CounterpartyRecord[];
  currentPeriod?: AccountingPeriod | null;
  dashboardContable?: DashboardContableEjecutivo | null;
  dashboardContableError?: string | null;
  documents?: DashboardDocument[];
  invoices?: Invoice[];
  paymentOverview?: CashflowOverview | null;
  purchases?: Purchase[];
  viewMode?: "operativo" | "principal";
};

const dashboardPanel =
  "border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.032))] shadow-2xl shadow-black/25 ring-1 ring-cyan-300/[0.04]";

function getDocumentState(document: DashboardDocument) {
  return getDocumentHumanStatus(document).label;
}

function CompactStat({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.13] bg-white/[0.045] p-3 shadow-inner shadow-black/15">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

function LauncherCard({
  action,
  description,
  href,
  icon,
  label,
  metric,
  tone = "cyan",
}: {
  action: string;
  description: string;
  href: string;
  icon: string;
  label: string;
  metric: string;
  tone?: "amber" | "cyan" | "emerald" | "rose";
}) {
  const toneClass = {
    amber: "border-amber-300/22 bg-amber-300/[0.07] text-amber-100",
    cyan: "border-cyan-300/22 bg-cyan-300/[0.07] text-cyan-100",
    emerald: "border-emerald-300/22 bg-emerald-300/[0.07] text-emerald-100",
    rose: "border-rose-300/22 bg-rose-300/[0.07] text-rose-100",
  }[tone];

  return (
    <Link
      className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.055] ${dashboardPanel}`}
      href={href}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${toneClass}`}
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
          <span className="rounded-full border border-white/[0.1] bg-white/[0.045] px-2.5 py-1 text-xs font-semibold text-slate-300">
            {metric}
          </span>
        </div>
        <p className="mt-4 text-base font-semibold text-white">{label}</p>
        <p className="mt-2 text-sm leading-5 text-slate-400">{description}</p>
      </div>
      <div className="mt-4 border-t border-white/[0.1] pt-3 text-sm font-semibold text-cyan-100">
        {action}
      </div>
    </Link>
  );
}

export function DashboardView({
  activeContext,
  accountingSummary = null,
  alertasContables = [],
  currentPeriod = null,
  dashboardContable = null,
  dashboardContableError = null,
  documents = [],
  invoices = [],
  paymentOverview = null,
  purchases = [],
}: DashboardViewProps) {
  const activeCompany = activeContext?.activeCompany;
  const suggestedCompany = activeContext?.suggestedCompany;
  const companies = activeContext?.companies ?? [];
  const pendingReviewDocuments = documents.filter(
    (document) => getDocumentState(document) === "Procesado",
  );
  const receivedDocuments = documents.filter(
    (document) => document.related_type === "client_upload",
  );
  const convertedDocuments = documents.filter((document) =>
    ["Convertido a compra", "Convertido a factura"].includes(
      getDocumentState(document),
    ),
  );
  const pendingPurchaseReviews = purchases.filter(
    (purchase) => normalizeReviewStatus(purchase.review_status) === "pending",
  );
  const pendingInvoiceReviews = invoices.filter(
    (invoice) => normalizeReviewStatus(invoice.review_status) === "pending",
  );
  const observedRecords = [
    ...purchases.filter(
      (purchase) => normalizeReviewStatus(purchase.review_status) === "observed",
    ),
    ...invoices.filter(
      (invoice) => normalizeReviewStatus(invoice.review_status) === "observed",
    ),
  ];
  const accountingPending = accountingSummary?.pendingToPost ?? 0;
  const accountingPosted = accountingSummary?.posted ?? 0;
  const cashflowOverview = paymentOverview ?? {
    collectedThisMonth: 0,
    paidThisMonth: 0,
    partialMovements: 0,
    pendingCollections: invoices.length,
    pendingPayments: purchases.length,
  };
  const totalPendingWork =
    pendingReviewDocuments.length +
    pendingPurchaseReviews.length +
    pendingInvoiceReviews.length +
    observedRecords.length;
  const executiveCurrency =
    activeCompany?.base_currency ??
    activeContext?.organization?.base_currency ??
    "CRC";
  const currentPeriodPurchases = purchases.filter((purchase) => {
    if (!currentPeriod) {
      return false;
    }

    const date = new Date(purchase.purchase_date ?? purchase.created_at ?? "");

    return (
      date.getFullYear() === currentPeriod.period_year &&
      date.getMonth() + 1 === currentPeriod.period_month
    );
  });
  const currentPeriodInvoices = invoices.filter((invoice) => {
    if (!currentPeriod) {
      return false;
    }

    const date = new Date(invoice.fecha ?? invoice.created_at ?? "");

    return (
      date.getFullYear() === currentPeriod.period_year &&
      date.getMonth() + 1 === currentPeriod.period_month
    );
  });
  const currentPeriodPending = [
    ...currentPeriodPurchases,
    ...currentPeriodInvoices,
  ].filter((record) => normalizeReviewStatus(record.review_status) === "pending")
    .length;
  const currentPeriodObserved = [
    ...currentPeriodPurchases,
    ...currentPeriodInvoices,
  ].filter((record) => normalizeReviewStatus(record.review_status) === "observed")
    .length;
  const currentPeriodReady =
    currentPeriod !== null &&
    currentPeriodPending === 0 &&
    currentPeriodObserved === 0;
  const modulePending =
    dashboardContable?.total_pendientes_contables ?? accountingPending;
  const balanceStatus = dashboardContable?.balance_cuadra
    ? "Cuadra"
    : dashboardContable
      ? formatCurrencyAmount(dashboardContable.diferencia_balance, executiveCurrency)
      : "No disponible";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),linear-gradient(135deg,rgba(7,17,32,0.98),rgba(10,23,40,0.96))] p-4 shadow-2xl shadow-cyan-950/20 sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              OM7 Finance OS
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Panel principal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Consola compacta para entrar rapido a los workspaces diarios.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.14] bg-black/25 p-3 lg:min-w-72">
            <p className="text-xs text-slate-400">
              {activeCompany ? "Cliente activo" : "Siguiente paso"}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {activeCompany?.name ??
                suggestedCompany?.name ??
                "Crea o selecciona una empresa"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {currentPeriod
                ? `${getPeriodLabel(
                    currentPeriod.period_year,
                    currentPeriod.period_month,
                  )} - ${getPeriodStatusLabel(currentPeriod.status)}`
                : "Periodo mensual pendiente"}
            </p>
          </div>
        </div>
      </section>

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-100">
                Define el contexto de trabajo
              </p>
              <p className="mt-1 text-sm text-amber-100/70">
                {companies.length === 0
                  ? "Crea una empresa para empezar."
                  : "Selecciona una empresa activa para operar."}
              </p>
            </div>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/empresas">
              Ir a empresas
            </Link>
          </div>
        </PremiumCard>
      ) : null}

      {dashboardContableError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-4">
          <p className="text-sm font-semibold text-amber-100">
            Dashboard contable no disponible
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-100/75">
            {dashboardContableError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CompactStat label="Por revisar" value={totalPendingWork} />
        <CompactStat
          detail={observedRecords.length > 0 ? "Con observados" : "Sin bloqueos"}
          label="Bloqueos"
          value={observedRecords.length}
        />
        <CompactStat label="Contabilidad" value={modulePending} />
        <CompactStat label="Balance" value={balanceStatus} />
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        <PremiumCard className={`${dashboardPanel} p-0`}>
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.1] p-4">
            <div>
              <p className="text-base font-semibold text-white">Notificaciones</p>
              <p className="mt-1 text-sm text-slate-500">Avisos resumidos.</p>
            </div>
            <StatusBadge>{alertasContables.length}</StatusBadge>
          </div>
          <details className="m-4 rounded-2xl border border-white/[0.13] bg-white/[0.045] p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
              <span>
                {alertasContables.length > 0
                  ? `${alertasContables.length} avisos`
                  : "Sin avisos"}
              </span>
              <span className="text-cyan-100">Ver</span>
            </summary>
            <div className="mt-3 grid gap-2">
              {alertasContables.length > 0 ? (
                alertasContables.slice(0, 3).map((alerta) => (
                  <div
                    className="rounded-xl border border-white/[0.08] bg-black/15 p-2"
                    key={alerta.alerta_tipo}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white">
                        {alerta.titulo}
                      </p>
                      <span className="text-xs text-cyan-100">
                        {alerta.cantidad}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">
                  Todo en orden para el periodo.
                </p>
              )}
              <Link className="om7-btn-ghost px-3 py-2" href="/contabilidad">
                Revisar
              </Link>
            </div>
          </details>
        </PremiumCard>

        <LauncherCard
          action="Abrir bandeja"
          description="Entrada diaria de documentos y revisiones."
          href="/bandeja"
          icon="inbox"
          label="Bandeja"
          metric={`${pendingReviewDocuments.length} revisar`}
          tone={pendingReviewDocuments.length > 0 ? "amber" : "cyan"}
        />
        <LauncherCard
          action="Ir a contabilidad"
          description="Asientos, catalogo, mayor y cierre."
          href="/contabilidad"
          icon="reports"
          label="Contabilidad"
          metric={`${accountingPending} pend.`}
          tone={accountingPending > 0 ? "amber" : "emerald"}
        />
        <LauncherCard
          action="Ver periodo"
          description="Bloqueos, estado del mes y cierre."
          href="/periodos"
          icon="reports"
          label="Periodo"
          metric={currentPeriodReady ? "Listo" : `${currentPeriodPending + currentPeriodObserved} bloq.`}
          tone={currentPeriodReady ? "emerald" : "amber"}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LauncherCard
          action="Compras"
          description="Gastos, proveedores y pagos."
          href="/compras"
          icon="expenses"
          label="Compras"
          metric={`${pendingPurchaseReviews.length} revisar`}
          tone={pendingPurchaseReviews.length > 0 ? "amber" : "cyan"}
        />
        <LauncherCard
          action="Ventas"
          description="Ingresos, clientes y cobros."
          href="/facturas"
          icon="invoice"
          label="Ventas"
          metric={`${pendingInvoiceReviews.length} revisar`}
          tone={pendingInvoiceReviews.length > 0 ? "amber" : "cyan"}
        />
        <LauncherCard
          action="Movimientos"
          description="Pagos, cobros y caja/bancos."
          href="/movimientos"
          icon="expenses"
          label="Caja"
          metric={`${cashflowOverview.pendingPayments + cashflowOverview.pendingCollections} pend.`}
          tone={
            cashflowOverview.pendingPayments + cashflowOverview.pendingCollections > 0
              ? "amber"
              : "emerald"
          }
        />
        <LauncherCard
          action="Reportes"
          description="Resumen ejecutivo y exportaciones."
          href="/reportes"
          icon="reports"
          label="Reportes"
          metric={`${convertedDocuments.length}/${documents.length}`}
          tone="cyan"
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link className="om7-btn-primary px-4 py-2.5" href="/bandeja">
          Bandeja diaria
        </Link>
        <Link className="om7-btn-ghost px-4 py-2.5" href="/dashboard?view=operativo">
          Ver mapa operativo
        </Link>
        <Link className="om7-btn-ghost px-4 py-2.5" href="/documentos">
          Consulta documentos
        </Link>
        <span className="om7-chip">
          Recibidos {receivedDocuments.length} / Contabilizados {accountingPosted}
        </span>
      </div>
    </div>
  );
}
