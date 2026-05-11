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
  getMovementDashboardData,
  isThisMonth,
} from "@/lib/movement-dashboard";

type RecentMovementsPageProps = {
  searchParams?: Promise<{
    type?: string;
  }>;
};

type RecentMovement = {
  amount: number;
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
      amount: collection.amount,
      date: collection.collection_date,
      href: "/facturas",
      id: `collection-${collection.id}`,
      label: "Cobro de factura",
      method: collection.payment_method?.name ?? "Metodo no registrado",
      type: "collection" as const,
    })),
    ...data.allPayments.map((payment) => ({
      amount: payment.amount,
      date: payment.payment_date,
      href: "/compras",
      id: `payment-${payment.id}`,
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
            <Link
              className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-cyan-200/18 hover:bg-white/[0.045]"
              href={movement.href}
              key={movement.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span
                    className={
                      movement.type === "collection"
                        ? "om7-chip om7-chip-emerald"
                        : "om7-chip om7-chip-cyan"
                    }
                  >
                    {movement.type === "collection" ? "Cobro" : "Pago"}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">
                    {movement.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {movement.method} - {movement.date}
                  </p>
                </div>
                <p className="text-xl font-semibold text-white">
                  {formatMoney(movement.amount, currency)}
                </p>
              </div>
            </Link>
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
