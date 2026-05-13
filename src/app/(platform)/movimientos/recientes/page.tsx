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
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  getMovementDashboardData,
  isThisMonth,
} from "@/lib/movement-dashboard";
import {
  generateCashMovementAccountingEntryAction,
  revertCashMovementAccountingEntryAction,
} from "../actions";

type RecentMovementsPageProps = {
  searchParams?: Promise<{
    type?: string;
  }>;
};

type RecentMovement = {
  accountingError: string | null;
  accountingStatus: string;
  amount: number;
  asientoContableId: string | null;
  date: string;
  href: string;
  id: string;
  label: string;
  method: string;
  type: "collection" | "payment";
};

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

function getAccountingStatusLabel(status: string) {
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

function getAccountingStatusTone(status: string) {
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

function CashMovementAccountingForm({
  action,
  children,
  className,
  movementId,
  motivo,
  redirectTo,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className: string;
  movementId: string;
  motivo?: string;
  redirectTo: string;
}) {
  return (
    <form action={action}>
      <input name="movementId" type="hidden" value={movementId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {motivo ? <input name="motivo" type="hidden" value={motivo} /> : null}
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

export default async function RecentMovementsPage({
  searchParams,
}: RecentMovementsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeType = resolvedSearchParams.type ?? "all";
  const data = await getMovementDashboardData().catch((error) => {
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
  const movements: RecentMovement[] = [
    ...data.allCollections.map((collection) => ({
      accountingError: collection.contabilizacion_error ?? null,
      accountingStatus: collection.estado_contable ?? "pendiente",
      amount: collection.amount,
      asientoContableId: collection.asiento_contable_id ?? null,
      date: collection.collection_date,
      href: "/facturas",
      id: collection.id,
      label: "Cobro de factura",
      method: collection.payment_method?.name ?? "Metodo no registrado",
      type: "collection" as const,
    })),
    ...data.allPayments.map((payment) => ({
      accountingError: payment.contabilizacion_error ?? null,
      accountingStatus: payment.estado_contable ?? "pendiente",
      amount: payment.amount,
      asientoContableId: payment.asiento_contable_id ?? null,
      date: payment.payment_date,
      href: "/compras",
      id: payment.id,
      label: "Pago de compra",
      method: payment.payment_method?.name ?? "Metodo no registrado",
      type: "payment" as const,
    })),
  ]
    .filter((movement) =>
      activeType === "collections"
        ? movement.type === "collection"
        : activeType === "payments"
          ? movement.type === "payment"
          : true,
    )
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const monthlyMovements = movements.filter((movement) =>
    isThisMonth(movement.date),
  );
  const monthlyCollections = data.allCollections
    .filter((collection) => isThisMonth(collection.collection_date))
    .reduce((sum, collection) => sum + Number(collection.amount ?? 0), 0);
  const monthlyPayments = data.allPayments
    .filter((payment) => isThisMonth(payment.payment_date))
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Movimientos recientes"
        description="Historial operativo de cobros, pagos y movimientos registrados."
        action={<BackLink href="/movimientos" label="Volver a movimientos" />}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          detail="Pagos y cobros"
          label="Movimientos del mes"
          value={String(monthlyMovements.length)}
        />
        <MetricCard
          detail="Mes actual"
          label="Cobrado"
          value={formatMoney(monthlyCollections, currency)}
        />
        <MetricCard
          detail="Mes actual"
          label="Pagado"
          value={formatMoney(monthlyPayments, currency)}
        />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          ["all", "Todos"],
          ["collections", "Cobros"],
          ["payments", "Pagos"],
        ].map(([type, label]) => (
          <Link
            className={[
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              activeType === type
                ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
            ].join(" ")}
            href={`/movimientos/recientes?type=${type}`}
            key={type}
          >
            {label}
          </Link>
        ))}
        <Link
          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:text-white"
          href="/reportes"
        >
          Exportar
        </Link>
      </section>

      <section className="grid gap-4">
        {movements.length > 0 ? (
          movements.map((movement) => (
            <div
              className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-cyan-200/18 hover:bg-white/[0.045]"
              key={`${movement.type}-${movement.id}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        movement.type === "collection"
                          ? "om7-chip om7-chip-emerald"
                          : "om7-chip om7-chip-cyan"
                      }
                    >
                      {movement.type === "collection" ? "Cobro" : "Pago"}
                    </span>
                    <StatusBadge tone={getAccountingStatusTone(movement.accountingStatus)}>
                      {getAccountingStatusLabel(movement.accountingStatus)}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {movement.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {movement.method} - {movement.date}
                  </p>
                  {movement.accountingError ? (
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-rose-100/80">
                      {movement.accountingError}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <p className="text-xl font-semibold text-white">
                    {formatMoney(movement.amount, currency)}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link className="om7-btn-ghost px-3 py-2 text-xs" href={movement.href}>
                      Ver origen
                    </Link>
                    {movement.asientoContableId ? (
                      <Link
                        className="om7-btn-secondary px-3 py-2 text-xs"
                        href={`/contabilidad/asientos/${movement.asientoContableId}`}
                      >
                        Ver asiento
                      </Link>
                    ) : null}
                    {movement.accountingStatus === "pendiente" ||
                    movement.accountingStatus === "error" ||
                    movement.accountingStatus === "anulado" ? (
                      <CashMovementAccountingForm
                        action={generateCashMovementAccountingEntryAction}
                        className="om7-btn-primary px-3 py-2 text-xs"
                        movementId={movement.id}
                        redirectTo="/movimientos/recientes"
                      >
                        {movement.accountingStatus === "pendiente"
                          ? "Generar asiento"
                          : "Recontabilizar"}
                      </CashMovementAccountingForm>
                    ) : null}
                    {movement.accountingStatus === "borrador" ? (
                      <CashMovementAccountingForm
                        action={revertCashMovementAccountingEntryAction}
                        className="om7-btn-ghost px-3 py-2 text-xs"
                        movementId={movement.id}
                        motivo="Reversion de borrador contable de caja/banco"
                        redirectTo="/movimientos/recientes"
                      >
                        Anular borrador
                      </CashMovementAccountingForm>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <PremiumCard className="border-dashed p-10 text-center">
            <p className="text-base font-semibold text-white">
              Aun no hay movimientos para esta vista.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Registra pagos o cobros desde compras y facturas.
            </p>
          </PremiumCard>
        )}
      </section>
    </ModuleFrame>
  );
}
