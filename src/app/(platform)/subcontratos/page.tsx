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
  getSubcontractsForActiveCompany,
  type Subcontrato,
  type SubcontratoPago,
} from "@/lib/contabilizacion-subcontratos";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  createSubcontractAction,
  createSubcontractPaymentAction,
  generateSubcontractAccountingEntryAction,
  revertSubcontractAccountingEntryAction,
} from "./actions";

type SubcontractsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function formatMoney(value: number | null | undefined, currency: string) {
  return formatCurrencyAmount(value, currency);
}

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

function SubcontractAccountingForm({
  action,
  children,
  className,
  motivo,
  redirectTo,
  subcontratoPagoId,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  motivo?: string;
  redirectTo: string;
  subcontratoPagoId: string;
}) {
  return (
    <form action={action}>
      <input name="subcontratoPagoId" type="hidden" value={subcontratoPagoId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {motivo ? <input name="motivo" type="hidden" value={motivo} /> : null}
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

function SubcontractCard({
  currency,
  subcontrato,
}: {
  currency: string;
  subcontrato: Subcontrato;
}) {
  const progress =
    Number(subcontrato.monto_total ?? 0) > 0
      ? Math.min(
          100,
          (Number(subcontrato.monto_pagado ?? 0) /
            Number(subcontrato.monto_total ?? 0)) *
            100,
        )
      : 0;

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="om7-chip om7-chip-cyan">
              {subcontrato.tipo_subcontrato}
            </span>
            <span className="om7-chip om7-chip-emerald">
              {subcontrato.estado_operativo}
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold text-white">
            {subcontrato.nombre}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {subcontrato.subcontratista_nombre}
            {subcontrato.categoria_subcontrato
              ? ` · ${subcontrato.categoria_subcontrato}`
              : ""}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-slate-500">Monto contratado</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {formatMoney(subcontrato.monto_total, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pagado {formatMoney(subcontrato.monto_pagado, currency)} ·{" "}
            {progress.toFixed(0)}%
          </p>
        </div>
      </div>
    </article>
  );
}

function PaymentCard({
  currency,
  pago,
}: {
  currency: string;
  pago: SubcontratoPago;
}) {
  const accountingStatus = pago.estado_contable ?? "pendiente";

  return (
    <article className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="om7-chip om7-chip-cyan">
              {pago.estado_operativo}
            </span>
            <StatusBadge tone={getAccountingStatusTone(accountingStatus)}>
              {getAccountingStatusLabel(accountingStatus)}
            </StatusBadge>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-white">
            {pago.subcontrato?.nombre ?? "Subcontrato"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {pago.subcontrato?.subcontratista_nombre ?? "Subcontratista"} ·{" "}
            {pago.fecha_pago}
          </p>
          {pago.contabilizacion_error ? (
            <p className="mt-3 max-w-2xl text-xs leading-5 text-rose-100/80">
              {pago.contabilizacion_error}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 text-left sm:grid-cols-3 lg:min-w-[32rem]">
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Bruto</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(pago.monto_bruto, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Retencion</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(pago.monto_retencion, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-3">
            <p className="text-xs text-slate-500">Neto</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {formatMoney(pago.monto_neto, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {pago.asiento_contable_id ? (
          <Link
            className="om7-btn-secondary px-3 py-2 text-xs"
            href={`/contabilidad/asientos/${pago.asiento_contable_id}`}
          >
            Ver asiento
          </Link>
        ) : null}
        {accountingStatus === "pendiente" ||
        accountingStatus === "error" ||
        accountingStatus === "anulado" ? (
          <SubcontractAccountingForm
            action={generateSubcontractAccountingEntryAction}
            className="om7-btn-primary px-3 py-2 text-xs"
            redirectTo="/subcontratos"
            subcontratoPagoId={pago.id}
          >
            {accountingStatus === "pendiente" ? "Generar asiento" : "Recontabilizar"}
          </SubcontractAccountingForm>
        ) : null}
        {accountingStatus === "borrador" ? (
          <SubcontractAccountingForm
            action={revertSubcontractAccountingEntryAction}
            className="om7-btn-ghost px-3 py-2 text-xs"
            motivo="Reversion de borrador contable de subcontrato"
            redirectTo="/subcontratos"
            subcontratoPagoId={pago.id}
          >
            Anular borrador
          </SubcontractAccountingForm>
        ) : null}
      </div>
    </article>
  );
}

export default async function SubcontractsPage({
  searchParams,
}: SubcontractsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const data = await getSubcontractsForActiveCompany().catch((error) => {
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
  const totalContratado = data.subcontracts.reduce(
    (sum, subcontrato) => sum + Number(subcontrato.monto_total ?? 0),
    0,
  );
  const contabilizados = data.payments.filter(
    (payment) => payment.estado_contable === "contabilizado",
  ).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Subcontratos"
        description="Pagos parciales y retenciones conectados al motor contable oficial."
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
          label="Subcontratos"
          value={String(data.subcontracts.length)}
        />
        <MetricCard
          detail="Pagos oficiales"
          label="Contabilizados"
          value={String(contabilizados)}
        />
        <MetricCard
          detail="Monto contratado"
          label="Total base"
          value={formatMoney(totalContratado, currency)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PremiumCard className="p-5">
          <p className="text-sm font-semibold text-white">Nuevo subcontrato QA</p>
          <form action={createSubcontractAction} className="mt-5 grid gap-3">
            <input
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
              name="nombre"
              placeholder="Subcontrato obra gris"
              required
            />
            <input
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
              name="subcontratistaNombre"
              placeholder="Subcontratista"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="tipoSubcontrato"
              >
                <option value="obra">Obra</option>
                <option value="servicio">Servicio</option>
              </select>
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="categoriaSubcontrato"
                placeholder="Estructura"
              />
              <select
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="estadoOperativo"
              >
                <option value="aprobado">Aprobado</option>
                <option value="en_ejecucion">En ejecucion</option>
                <option value="cerrado">Cerrado</option>
                <option value="borrador">Borrador</option>
              </select>
              <input name="moneda" type="hidden" value={currency} />
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                min="0"
                name="montoTotal"
                placeholder="Monto total"
                required
                step="0.01"
                type="number"
              />
            </div>
            <button className="om7-btn-primary px-4 py-2.5" type="submit">
              Crear subcontrato
            </button>
          </form>
        </PremiumCard>

        <PremiumCard className="p-5">
          <p className="text-sm font-semibold text-white">Registrar pago QA</p>
          <form action={createSubcontractPaymentAction} className="mt-5 grid gap-3">
            <select
              className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
              name="subcontratoId"
              required
            >
              <option value="">Selecciona subcontrato</option>
              {data.subcontracts.map((subcontrato) => (
                <option key={subcontrato.id} value={subcontrato.id}>
                  {subcontrato.nombre}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="fechaPago"
                type="date"
              />
              <select
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="estadoOperativo"
              >
                <option value="aprobado">Aprobado</option>
                <option value="pagado">Pagado</option>
                <option value="revisado">Revisado</option>
                <option value="borrador">Borrador</option>
              </select>
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                min="0"
                name="montoBruto"
                placeholder="Monto bruto"
                required
                step="0.01"
                type="number"
              />
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                min="0"
                name="montoRetencion"
                placeholder="Retencion"
                step="0.01"
                type="number"
              />
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                min="0"
                name="montoNeto"
                placeholder="Neto pagado"
                step="0.01"
                type="number"
              />
              <input
                className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/40 focus:ring-4 focus:ring-cyan-200/10"
                name="numeroDocumento"
                placeholder="Documento"
              />
            </div>
            <button className="om7-btn-primary px-4 py-2.5" type="submit">
              Registrar pago
            </button>
          </form>
        </PremiumCard>
      </section>

      <section className="grid gap-4">
        <p className="text-sm font-semibold text-white">Subcontratos activos</p>
        {data.subcontracts.length > 0 ? (
          data.subcontracts.map((subcontrato) => (
            <SubcontractCard
              currency={currency}
              key={subcontrato.id}
              subcontrato={subcontrato}
            />
          ))
        ) : (
          <PremiumCard className="border-dashed p-8 text-center">
            <p className="text-base font-semibold text-white">
              Aun no hay subcontratos.
            </p>
          </PremiumCard>
        )}
      </section>

      <section className="grid gap-4">
        <p className="text-sm font-semibold text-white">Pagos de subcontratos</p>
        {data.payments.length > 0 ? (
          data.payments.map((pago) => (
            <PaymentCard currency={currency} key={pago.id} pago={pago} />
          ))
        ) : (
          <PremiumCard className="border-dashed p-8 text-center">
            <p className="text-base font-semibold text-white">
              Aun no hay pagos de subcontratos.
            </p>
          </PremiumCard>
        )}
      </section>
    </ModuleFrame>
  );
}
