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
  counterparties?: CounterpartyRecord[];
  currentPeriod?: AccountingPeriod | null;
  documents?: DashboardDocument[];
  invoices?: Invoice[];
  paymentOverview?: CashflowOverview | null;
  purchases?: Purchase[];
  viewMode?: "operativo" | "principal";
};

const workflowSteps = [
  {
    description: "Portal cliente y cargas internas.",
    href: "/cliente",
    key: "received",
    label: "Cliente sube documento",
  },
  {
    description: "XML CR, OCR e IA Vision.",
    href: "/documentos",
    key: "processed",
    label: "OM7 procesa",
  },
  {
    description: "Validacion humana y datos corregidos.",
    href: "/bandeja",
    key: "review",
    label: "Contador revisa",
  },
  {
    description: "Compra o factura creada.",
    href: "/compras",
    key: "converted",
    label: "Compra/Factura",
  },
  {
    description: "Debe/Haber sugerido y revisable.",
    href: "/contabilidad",
    key: "accounting",
    label: "Asiento sugerido",
  },
  {
    description: "Cierre mensual y reportes ejecutivos.",
    href: "/periodos",
    key: "period",
    label: "Periodo/Reporte",
  },
];

const dashboardCardFrame =
  "border border-white/[0.18] bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.032)),radial-gradient(circle_at_top_right,rgba(34,211,238,0.095),transparent_36%)] shadow-[0_22px_70px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.075)] ring-1 ring-cyan-100/[0.045]";

const dashboardHoverFrame =
  "transition hover:-translate-y-0.5 hover:border-cyan-300/36 hover:bg-cyan-300/[0.06] hover:shadow-[0_26px_82px_rgba(8,47,73,0.30),inset_0_1px_0_rgba(255,255,255,0.10)]";

function getDocumentState(document: DashboardDocument) {
  return getDocumentHumanStatus(document).label;
}

function MiniStat({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/20 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-white sm:text-xl">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-300/80">{detail}</p> : null}
    </div>
  );
}

function OperatingCenterCard({
  action,
  description,
  href,
  icon,
  label,
  primaryMetric,
  secondaryMetric,
  tone = "cyan",
}: {
  action: string;
  description: string;
  href: string;
  icon: string;
  label: string;
  primaryMetric: string;
  secondaryMetric: string;
  tone?: "amber" | "cyan" | "emerald" | "rose";
}) {
  const toneClass = {
    amber: "border-amber-300/20 bg-amber-300/[0.06] text-amber-100",
    cyan: "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100",
    rose: "border-rose-300/20 bg-rose-300/[0.06] text-rose-100",
  }[tone];

  return (
    <Link
      className={`group flex min-h-0 flex-col justify-between rounded-2xl p-4 sm:min-h-44 sm:p-5 ${dashboardCardFrame} ${dashboardHoverFrame}`}
      href={href}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${toneClass}`}
          >
            <Icon name={icon} className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-xs font-semibold text-slate-300 transition group-hover:text-cyan-100">
            {action}
          </span>
        </div>
        <p className="mt-4 text-base font-semibold text-white">{label}</p>
        <p className="mt-2 min-h-10 text-sm leading-6 text-slate-300">
          {description}
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
        <p className="text-sm text-slate-400">Foco</p>
        <p className="break-words text-right text-sm font-semibold text-white">
          {primaryMetric} <span className="text-slate-500">/</span> {secondaryMetric}
        </p>
      </div>
    </Link>
  );
}

export function DashboardView({
  activeContext,
  accountingSummary = null,
  currentPeriod = null,
  documents = [],
  invoices = [],
  paymentOverview = null,
  purchases = [],
  viewMode = "principal",
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
  const approvedRecords = [
    ...purchases.filter(
      (purchase) => normalizeReviewStatus(purchase.review_status) === "approved",
    ),
    ...invoices.filter(
      (invoice) => normalizeReviewStatus(invoice.review_status) === "approved",
    ),
  ];
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
  const workflowCounts: Record<string, number> = {
    accounting: accountingSummary?.totalEntries ?? 0,
    converted: convertedDocuments.length,
    period: currentPeriodReady ? 1 : currentPeriodPending + currentPeriodObserved,
    processed: documents.filter((document) =>
      ["Requiere revisión", "Listo para convertir"].includes(
        getDocumentState(document),
      ),
    ).length,
    received: receivedDocuments.length,
    review: pendingReviewDocuments.length,
  };
  const accountingTotal = accountingSummary?.totalEntries ?? 0;
  const accountingPosted = accountingSummary?.posted ?? 0;
  const accountingPending = accountingSummary?.pendingToPost ?? 0;
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
  const monthBlockers = currentPeriodPending + currentPeriodObserved;
  const systemSignals = [
    {
      detail: "Documentos y registros que requieren accion.",
      label: "Por revisar",
      value: totalPendingWork,
    },
    {
      detail: "Registros con correcciones pendientes.",
      label: "Observados",
      value: observedRecords.length,
    },
    {
      detail: currentPeriod
        ? getPeriodStatusLabel(currentPeriod.status)
        : "Sin periodo activo",
      label: "Periodo",
      value: currentPeriodReady ? "Listo" : monthBlockers,
    },
    {
      detail: "Asientos pendientes de contabilizar.",
      label: "Contabilidad",
      value: accountingPending,
    },
  ];

  if (viewMode === "operativo") {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="overflow-hidden rounded-3xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%),rgba(255,255,255,0.045)] p-4 shadow-2xl shadow-cyan-950/20 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/80">
                Centro operativo OM7
              </p>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Mapa del sistema
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Una vista breve para entender donde trabajar, que esta
                bloqueado y como se conectan los modulos.
              </p>
            </div>
            <Link className="om7-btn-ghost px-4 py-2.5" href="/dashboard">
              Volver al panel
            </Link>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <PremiumCard className={`${dashboardCardFrame} p-5`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-white">
                  Estado ejecutivo del mes
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {currentPeriod
                    ? `${getPeriodLabel(
                        currentPeriod.period_year,
                        currentPeriod.period_month,
                      )} - ${getPeriodStatusLabel(currentPeriod.status)}`
                    : "Activa periodos para controlar el cierre mensual."}
                </p>
              </div>
              <StatusBadge>
                {currentPeriodReady ? "Listo para cierre" : "Con pendientes"}
              </StatusBadge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniStat label="Por revisar" value={currentPeriodPending} />
              <MiniStat label="Observados" value={currentPeriodObserved} />
              <MiniStat label="Aprobados" value={approvedRecords.length} />
              <MiniStat label="Por contabilizar" value={accountingPending} />
            </div>
          </PremiumCard>

          <PremiumCard className={`${dashboardCardFrame} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">
                  Contabilidad asistida
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Resumen de asientos sugeridos y estado contable del periodo.
                </p>
              </div>
              <StatusBadge>Asistido</StatusBadge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniStat detail="Propuestas del periodo" label="Asientos" value={accountingTotal} />
              <MiniStat detail="Ya registrados" label="Contabilizados" value={accountingPosted} />
              <MiniStat detail="Pendientes" label="Por contabilizar" value={accountingPending} />
            </div>
          </PremiumCard>

          <PremiumCard className={`${dashboardCardFrame} p-5`}>
            <p className="text-base font-semibold text-white">
              Estado general
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Senales minimas para saber si conviene entrar a bandeja,
              observados, periodo o contabilidad.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {systemSignals.map((signal) => (
                <MiniStat
                  detail={signal.detail}
                  key={signal.label}
                  label={signal.label}
                  value={signal.value}
                />
              ))}
            </div>
          </PremiumCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <PremiumCard className="border-white/[0.13] p-5 ring-1 ring-white/[0.035]">
            <p className="text-base font-semibold text-white">
              Accesos del flujo
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Bandeja", "/bandeja", "inbox", "Revisar entrada diaria"],
                ["Compras", "/compras", "expenses", "Gastos y proveedores"],
                ["Facturas", "/facturas", "invoice", "Ingresos y clientes"],
                ["Movimientos", "/movimientos", "expenses", "Pagos y cobros"],
                ["Contabilidad", "/contabilidad", "reports", "Asientos sugeridos"],
                ["Periodos", "/periodos", "reports", "Cierre mensual"],
                ["Reportes", "/reportes", "reports", "Resumen ejecutivo"],
              ].map(([label, href, icon, description]) => (
                <Link
                  className="group rounded-2xl border border-white/[0.13] bg-black/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition hover:border-cyan-300/28 hover:bg-cyan-300/[0.05]"
                  href={href}
                  key={label}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100">
                    <Icon name={icon} className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300/85">
                    {description}
                  </p>
                </Link>
              ))}
            </div>
          </PremiumCard>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%),rgba(255,255,255,0.045)] p-4 shadow-2xl shadow-cyan-950/20 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80 sm:text-xs sm:tracking-[0.26em]">
              OM7 Finance OS - by April7th
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Panel principal
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Vista rapida del trabajo diario, documentos, registros y cierre
              del mes.
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 rounded-3xl border border-white/[0.08] bg-black/25 p-4 lg:min-w-72">
            <div>
              <p className="text-xs text-slate-400">
                {activeCompany ? "Cliente / empresa activa" : "Siguiente paso"}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {activeCompany?.name ??
                  suggestedCompany?.name ??
                  "Crea o selecciona una empresa"}
              </p>
              <p className="mt-2 text-xs text-slate-300/85">
                {currentPeriod
                  ? `${getPeriodLabel(
                      currentPeriod.period_year,
                      currentPeriod.period_month,
                    )} - ${getPeriodStatusLabel(currentPeriod.status)}`
                  : "Periodo mensual pendiente"}
              </p>
            </div>
            <Link className="om7-btn-primary justify-center px-4 py-2.5" href="/bandeja">
              Ir a Bandeja diaria
            </Link>
          </div>
        </div>
      </section>

      {!activeCompany ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Define el contexto de trabajo
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            {companies.length === 0
              ? "Crea una empresa para empezar a recibir documentos y registrar movimientos."
              : "Selecciona una empresa activa para leer compras, facturas y documentos."}
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <PremiumCard className="border-cyan-300/24 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_38%),rgba(255,255,255,0.055)] p-5 shadow-[0_26px_86px_rgba(8,47,73,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-cyan-200/[0.06] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
              Mapa operativo
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Flujo operativo
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              El camino simple de OM7: documento, revision, registro,
              contabilidad y cierre.
            </p>
          </div>
          <StatusBadge>Flujo central</StatusBadge>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-6">
          {workflowSteps.map((step, index) => (
            <Link
              className="group relative rounded-2xl border border-white/[0.18] bg-black/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_14px_42px_rgba(0,0,0,0.16)] ring-1 ring-cyan-100/[0.035] transition hover:border-cyan-300/34 hover:bg-cyan-300/[0.06] lg:min-h-40"
              href={step.href}
              key={step.key}
            >
              {index < workflowSteps.length - 1 ? (
                <span className="absolute right-[-14px] top-8 hidden h-px w-7 bg-cyan-300/35 lg:block" />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/[0.1] text-xs font-semibold text-cyan-100">
                  {index + 1}
                </span>
                <span className="rounded-full border border-white/[0.1] bg-white/[0.055] px-2 py-1 text-xs text-slate-200">
                  {workflowCounts[step.key]}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold text-white">
                {step.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-300/85">
                {step.description}
              </p>
            </Link>
          ))}
        </div>
      </PremiumCard>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <OperatingCenterCard
          action="Abrir bandeja"
          description="Donde se revisa lo recibido hoy y se decide el siguiente paso del documento."
          href="/bandeja"
          icon="inbox"
          label="Bandeja diaria"
          primaryMetric={String(pendingReviewDocuments.length)}
          secondaryMetric={String(receivedDocuments.length)}
          tone={pendingReviewDocuments.length > 0 ? "amber" : "cyan"}
        />
        <OperatingCenterCard
          action="Ver pendientes"
          description="Lo que falta revisar, corregir o desbloquear antes de seguir con el mes."
          href={observedRecords.length > 0 ? "/observados" : "/compras?filter=accounting_pending"}
          icon="inbox"
          label="Trabajo pendiente"
          primaryMetric={String(totalPendingWork)}
          secondaryMetric={String(observedRecords.length)}
          tone={observedRecords.length > 0 ? "rose" : "amber"}
        />
        <OperatingCenterCard
          action="Ir a contabilidad"
          description="Asientos sugeridos por OM7 para revisar, observar y contabilizar."
          href="/contabilidad"
          icon="reports"
          label="Contabilidad"
          primaryMetric={String(accountingPending)}
          secondaryMetric={String(accountingTotal)}
          tone={accountingPending > 0 ? "amber" : "emerald"}
        />
        <OperatingCenterCard
          action="Ver movimientos"
          description="Pagos, cobros y saldos pendientes sin convertir OM7 en banco complejo."
          href="/movimientos"
          icon="expenses"
          label="Caja y movimientos"
          primaryMetric={String(
            cashflowOverview.pendingPayments + cashflowOverview.pendingCollections,
          )}
          secondaryMetric={String(cashflowOverview.partialMovements)}
          tone={
            cashflowOverview.pendingPayments + cashflowOverview.pendingCollections > 0
              ? "amber"
              : "emerald"
          }
        />
        <OperatingCenterCard
          action="Ver periodos"
          description="Estado del mes, bloqueos y preparacion del cierre mensual."
          href="/periodos"
          icon="reports"
          label="Periodo mensual"
          primaryMetric={currentPeriodReady ? "Listo" : String(monthBlockers)}
          secondaryMetric={currentPeriod ? getPeriodStatusLabel(currentPeriod.status) : "Sin periodo"}
          tone={currentPeriodReady ? "emerald" : "amber"}
        />
        <OperatingCenterCard
          action="Abrir reportes"
          description="Resumen ejecutivo, flujo documental, contabilidad y exportaciones."
          href="/reportes"
          icon="reports"
          label="Reportes"
          primaryMetric={String(convertedDocuments.length)}
          secondaryMetric={String(documents.length)}
          tone="cyan"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Link
          className={`group flex min-h-44 flex-col justify-between rounded-2xl p-5 ${dashboardCardFrame} ${dashboardHoverFrame}`}
          href="/periodos"
        >
          <div>
            <span className={currentPeriodReady ? "om7-chip om7-chip-emerald" : "om7-chip om7-chip-amber"}>
              {currentPeriodReady ? "Listo para cierre" : "Con bloqueos"}
            </span>
            <p className="mt-4 text-base font-semibold text-white">
              Periodo mensual
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {currentPeriod
                ? `${getPeriodLabel(
                    currentPeriod.period_year,
                    currentPeriod.period_month,
                  )} - ${getPeriodStatusLabel(currentPeriod.status)}`
                : "Activa el mes para controlar el cierre."}
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Pendientes {currentPeriodPending} · observados {currentPeriodObserved}
          </p>
        </Link>

        <Link
          className={`group flex min-h-44 flex-col justify-between rounded-2xl p-5 ${dashboardCardFrame} ${dashboardHoverFrame}`}
          href="/contabilidad"
        >
          <div>
            <span className="om7-chip om7-chip-cyan">Asistido</span>
            <p className="mt-4 text-base font-semibold text-white">
              Contabilidad asistida
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Asientos sugeridos, revisados y listos para contabilizar.
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Por contabilizar {accountingPending} · contabilizados {accountingPosted}
          </p>
        </Link>

        <Link
          className={`group flex min-h-44 flex-col justify-between rounded-2xl p-5 ${dashboardCardFrame} ${dashboardHoverFrame}`}
          href="/dashboard?view=operativo"
        >
          <div>
            <span className="om7-chip om7-chip-cyan">Mapa</span>
            <p className="mt-4 text-base font-semibold text-white">
              Centro operativo OM7
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Vista compacta de bloqueos, accesos y direccionamiento del sistema.
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Por revisar {totalPendingWork} · bloqueos {monthBlockers}
          </p>
        </Link>
      </section>
    </div>
  );
}
