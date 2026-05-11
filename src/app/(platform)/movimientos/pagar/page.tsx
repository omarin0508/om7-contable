import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import {
  getMovementStatusBadgeClass,
  getPaymentStatusKey,
  getPaymentStatusLabel,
  getRemainingAmount,
} from "@/lib/payments";
import {
  getMovementDashboardData,
  isPastDue,
} from "@/lib/movement-dashboard";

type PayablesPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

export default async function PayablesPage({ searchParams }: PayablesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeFilter = resolvedSearchParams.filter ?? "pending";
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
  const visiblePurchases = data.purchases.filter((purchase) => {
    const paid = data.paymentMap.get(purchase.id)?.amount ?? 0;
    const status = getPaymentStatusKey(purchase.total, paid);

    if (activeFilter === "overdue") {
      return status !== "paid" && isPastDue(purchase.purchase_date ?? purchase.created_at);
    }

    if (activeFilter === "paid") {
      return status === "paid";
    }

    return status !== "paid";
  });

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Cuentas por pagar"
        description="Compras, gastos y documentos que representan obligaciones de pago."
        action={<BackLink href="/movimientos" label="Volver a movimientos" />}
      />

      <PremiumCard className="border-cyan-200/12 bg-cyan-300/[0.045] p-5">
        <p className="text-sm font-semibold text-cyan-50">Ayuda OM7</p>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          En este workspace ves obligaciones de pago de la empresa. El siguiente
          paso normalmente es registrar el pago o revisar si el gasto debe
          aprobarse antes.
        </p>
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          detail="Saldo abierto"
          label="Pendiente por pagar"
          value={formatMoney(data.totalPendingPayments, currency)}
        />
        <MetricCard
          detail="Requieren seguimiento"
          label="Vencidas"
          value={String(data.overduePurchases.length)}
        />
        <MetricCard
          detail="Movimientos registrados"
          label="Pagadas"
          value={String(data.purchases.length - data.pendingPurchases.length)}
        />
      </section>

      <section className="flex flex-wrap gap-2">
        {[
          ["pending", "Pendientes"],
          ["overdue", "Vencidas"],
          ["paid", "Pagadas"],
        ].map(([filter, label]) => (
          <Link
            className={[
              "rounded-full border px-3 py-2 text-xs font-semibold transition",
              activeFilter === filter
                ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white",
            ].join(" ")}
            href={`/movimientos/pagar?filter=${filter}`}
            key={filter}
          >
            {label}
          </Link>
        ))}
      </section>

      <section className="grid gap-4">
        {visiblePurchases.length > 0 ? (
          visiblePurchases.map((purchase) => {
            const summary = data.paymentMap.get(purchase.id);
            const paid = summary?.amount ?? 0;
            const status = getPaymentStatusKey(purchase.total, paid);
            const remaining = getRemainingAmount(purchase.total, paid);
            const overdue = status !== "paid" && isPastDue(purchase.purchase_date ?? purchase.created_at);

            return (
              <PremiumCard className="p-5" key={purchase.id}>
                <div className="grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={getMovementStatusBadgeClass(status)}>
                        {getPaymentStatusLabel(purchase.total, paid)}
                      </span>
                      {overdue ? (
                        <span className="om7-chip om7-chip-amber">Vencida</span>
                      ) : null}
                      {purchase.source_document_id ? (
                        <span className="om7-chip om7-chip-cyan">
                          Desde documento
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-white">
                      {purchase.counterparty?.name ??
                        purchase.supplier_name ??
                        "Sin proveedor"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Compra {purchase.document_number ?? "sin numero"} -{" "}
                      {purchase.purchase_date ?? "sin fecha"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Vencimiento: {purchase.purchase_date ?? "No registrado"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-black/15 p-4 text-left lg:text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Saldo
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {formatMoney(remaining, purchase.currency ?? currency)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Pagado {formatMoney(paid, purchase.currency ?? currency)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    className="om7-btn-primary px-4 py-2.5"
                    href="/compras?returnTo=%2Fmovimientos%2Fpagar&returnLabel=Volver%20a%20cuentas%20por%20pagar"
                  >
                    Registrar pago
                  </Link>
                  <Link
                    className="om7-btn-secondary px-4 py-2.5"
                    href="/compras?returnTo=%2Fmovimientos%2Fpagar&returnLabel=Volver%20a%20cuentas%20por%20pagar"
                  >
                    Ver compra
                  </Link>
                  {purchase.source_document_id ? (
                    <Link
                      className="om7-btn-ghost px-4 py-2.5"
                      href={`/documentos/${purchase.source_document_id}`}
                    >
                      Ver documento
                    </Link>
                  ) : null}
                </div>
              </PremiumCard>
            );
          })
        ) : (
          <PremiumCard className="border-dashed p-10 text-center">
            <p className="text-base font-semibold text-white">
              No hay cuentas por pagar en esta vista.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Cambia el filtro o registra compras para iniciar el seguimiento.
            </p>
          </PremiumCard>
        )}
      </section>
    </ModuleFrame>
  );
}
