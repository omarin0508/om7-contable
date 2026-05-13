import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getPlanillasForActiveCompany,
  type Planilla,
} from "@/lib/contabilizacion-planillas";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  createPlanillaAction,
  generatePayrollAccountingEntryAction,
  revertPayrollAccountingEntryAction,
} from "./actions";

type PlanillasPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getAccountingStatusLabel(status: string | null | undefined) {
  if (status === "contabilizado") {
    return "Contabilizado";
  }

  if (status === "borrador") {
    return "Borrador contable";
  }

  if (status === "anulado") {
    return "Anulado";
  }

  if (status === "error") {
    return "Error contable";
  }

  return "Pendiente contable";
}

function getAccountingStatusTone(status: string | null | undefined) {
  if (status === "contabilizado") {
    return "emerald" as const;
  }

  if (status === "borrador") {
    return "cyan" as const;
  }

  if (status === "anulado" || status === "error") {
    return "rose" as const;
  }

  return "amber" as const;
}

function formatMoney(value: number | null | undefined, currency: string) {
  return formatCurrencyAmount(value, currency);
}

function PayrollAccountingForm({
  action,
  children,
  className,
  motivo,
  planillaId,
  redirectTo,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  motivo?: string;
  planillaId: string;
  redirectTo: string;
}) {
  return (
    <form action={action}>
      <input name="planillaId" type="hidden" value={planillaId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {motivo ? <input name="motivo" type="hidden" value={motivo} /> : null}
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function PayrollCard({
  currency,
  planilla,
}: {
  currency: string;
  planilla: Planilla;
}) {
  const accountingStatus = planilla.estado_contable ?? "pendiente";

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="om7-chip om7-chip-cyan">
              {planilla.tipo_planilla}
            </span>
            <span className="om7-chip om7-chip-emerald">
              {planilla.estado_operativo}
            </span>
            <StatusBadge tone={getAccountingStatusTone(accountingStatus)}>
              {getAccountingStatusLabel(accountingStatus)}
            </StatusBadge>
          </div>
          <h2 className="mt-3 text-base font-semibold text-white">
            {planilla.nombre}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {planilla.periodo_desde} - {planilla.periodo_hasta}
            {planilla.clasificacion_laboral
              ? ` · ${planilla.clasificacion_laboral}`
              : ""}
          </p>
          {planilla.contabilizacion_error ? (
            <p className="mt-3 max-w-2xl text-xs leading-5 text-rose-100/80">
              {planilla.contabilizacion_error}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 text-left sm:grid-cols-2 lg:min-w-96">
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Salarios</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(planilla.total_salarios, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Neto a pagar</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(planilla.total_neto_pagar, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Cargas patronales</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(planilla.total_cargas_sociales, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Obligaciones</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(planilla.total_obligaciones, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {planilla.asiento_contable_id ? (
          <Link
            className="om7-btn-secondary px-3 py-2 text-xs"
            href={`/contabilidad/asientos/${planilla.asiento_contable_id}`}
          >
            Ver asiento
          </Link>
        ) : null}
        {accountingStatus === "pendiente" ||
        accountingStatus === "error" ||
        accountingStatus === "anulado" ? (
          <PayrollAccountingForm
            action={generatePayrollAccountingEntryAction}
            className="om7-btn-primary px-3 py-2 text-xs"
            planillaId={planilla.id}
            redirectTo="/planillas"
          >
            {accountingStatus === "pendiente" ? "Generar asiento" : "Recontabilizar"}
          </PayrollAccountingForm>
        ) : null}
        {accountingStatus === "borrador" ? (
          <PayrollAccountingForm
            action={revertPayrollAccountingEntryAction}
            className="om7-btn-ghost px-3 py-2 text-xs"
            motivo="Reversion de borrador contable de planilla"
            planillaId={planilla.id}
            redirectTo="/planillas"
          >
            Anular borrador
          </PayrollAccountingForm>
        ) : null}
      </div>
    </article>
  );
}

export default async function PlanillasPage({ searchParams }: PlanillasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const data = await getPlanillasForActiveCompany().catch((error) => {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("usuario no autenticado")
    ) {
      redirect("/login");
    }

    throw error;
  });
  const activeCompany = data.activeContext.activeCompany;
  const currency = normalizeCurrencyCode(
    activeCompany?.base_currency ??
      data.activeContext.organization?.base_currency ??
      "CRC",
  );
  const totalSalarios = data.planillas.reduce(
    (sum, planilla) => sum + Number(planilla.total_salarios ?? 0),
    0,
  );
  const contabilizadas = data.planillas.filter(
    (planilla) => planilla.estado_contable === "contabilizado",
  ).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Planillas"
        description="Nomina operativa conectada al motor contable oficial de OM7."
        action={<BackLink href="/dashboard" label="Volver al dashboard" />}
      />

      {resolvedSearchParams.error ? (
        <div className="rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-4 text-sm text-rose-100">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          detail="Empresa activa"
          label="Planillas"
          value={String(data.planillas.length)}
        />
        <MetricCard
          detail="Registros oficiales"
          label="Contabilizadas"
          value={String(contabilizadas)}
        />
        <MetricCard
          detail="Salarios brutos"
          label="Total base"
          value={formatMoney(totalSalarios, currency)}
        />
      </section>

      <PremiumCard className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Nueva planilla QA</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Registra totales operativos; el asiento se genera desde SQL/RPC.
            </p>
          </div>
        </div>
        <form action={createPlanillaAction} className="mt-5 grid gap-3 lg:grid-cols-4">
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="nombre"
            placeholder="Planilla Semana 01"
            required
          />
          <select
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="tipoPlanilla"
          >
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="clasificacionLaboral"
            placeholder="Administrativa"
          />
          <select
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="estadoOperativo"
          >
            <option value="aprobada">Aprobada</option>
            <option value="revisada">Revisada</option>
            <option value="pagada">Pagada</option>
            <option value="borrador">Borrador</option>
          </select>
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="periodoDesde"
            required
            type="date"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="periodoHasta"
            required
            type="date"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            name="fechaPago"
            type="date"
          />
          <input name="moneda" type="hidden" value={currency} />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            min="0"
            name="totalSalarios"
            placeholder="Salarios"
            required
            step="0.01"
            type="number"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            min="0"
            name="totalCargasSociales"
            placeholder="Cargas sociales"
            step="0.01"
            type="number"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            min="0"
            name="totalRetenciones"
            placeholder="Retenciones"
            step="0.01"
            type="number"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            min="0"
            name="totalNetoPagar"
            placeholder="Neto a pagar"
            step="0.01"
            type="number"
          />
          <input
            className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
            min="0"
            name="totalObligaciones"
            placeholder="Obligaciones"
            step="0.01"
            type="number"
          />
          <button className="om7-btn-primary px-4 py-2.5 lg:col-span-4" type="submit">
            Crear planilla
          </button>
        </form>
      </PremiumCard>

      <section className="grid gap-4">
        {data.planillas.length > 0 ? (
          data.planillas.map((planilla) => (
            <PayrollCard
              currency={currency}
              key={planilla.id}
              planilla={planilla}
            />
          ))
        ) : (
          <PremiumCard className="border-dashed p-10 text-center">
            <p className="text-base font-semibold text-white">
              Aun no hay planillas para la empresa activa.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Crea una planilla QA para validar la contabilizacion de nomina.
            </p>
          </PremiumCard>
        )}
      </section>
    </ModuleFrame>
  );
}
