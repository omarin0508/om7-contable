import { redirect } from "next/navigation";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import {
  ContextualHelpCard,
  OperationalCard,
} from "@/components/om7/operational-design-system";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getMovementDashboardData } from "@/lib/movement-dashboard";

function formatMoney(value: number | null | undefined, currency: string | null) {
  return formatCurrencyAmount(value, currency);
}

export default async function MovimientosPage() {
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyMovements =
    data.allPayments.filter((payment) =>
      payment.payment_date?.startsWith(currentMonth),
    ).length +
    data.allCollections.filter((collection) =>
      collection.collection_date?.startsWith(currentMonth),
    ).length;
  const netExpected = data.totalPendingCollections - data.totalPendingPayments;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Movimientos"
        description="Cuentas por cobrar, cuentas por pagar y actividad financiera del mes."
        action={<BackLink />}
      />

      <ContextualHelpCard>
        <p>
          Usa esta portada para entrar al workspace correcto: cobrar, pagar,
          revisar actividad reciente o validar el periodo.
        </p>
      </ContextualHelpCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          detail={`${data.pendingInvoices.length} pendientes`}
          label="Por cobrar"
          value={formatMoney(data.totalPendingCollections, currency)}
        />
        <MetricCard
          detail={`${data.pendingPurchases.length} pendientes`}
          label="Por pagar"
          value={formatMoney(data.totalPendingPayments, currency)}
        />
        <MetricCard
          detail="Seguimiento"
          label="Cobros vencidos"
          value={String(data.overdueInvoices.length)}
        />
        <MetricCard
          detail="Seguimiento"
          label="Pagos vencidos"
          value={String(data.overduePurchases.length)}
        />
        <MetricCard
          detail="Mes actual"
          label="Movimientos"
          value={String(monthlyMovements)}
        />
        <MetricCard
          detail="Cobrar - pagar"
          label="Balance esperado"
          value={formatMoney(netExpected, currency)}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        <OperationalCard
          count={`${data.pendingInvoices.length} pendientes`}
          description={`${data.overdueInvoices.length} vencidas`}
          href="/movimientos/cobrar"
          icon="$"
          label="Workspace"
          tone="emerald"
          title="Cuentas por cobrar"
          value={formatMoney(data.totalPendingCollections, currency)}
        />
        <OperationalCard
          count={`${data.pendingPurchases.length} pendientes`}
          description={`${data.overduePurchases.length} vencidas`}
          href="/movimientos/pagar"
          icon="-"
          label="Workspace"
          tone="amber"
          title="Cuentas por pagar"
          value={formatMoney(data.totalPendingPayments, currency)}
        />
        <OperationalCard
          count={`${monthlyMovements} este mes`}
          description="Cobros y pagos registrados"
          href="/movimientos/recientes"
          icon="M"
          label="Workspace"
          tone="cyan"
          title="Movimientos recientes"
          value={String(monthlyMovements)}
        />
        <OperationalCard
          count="Cierre"
          description="Validacion mensual"
          href="/periodos"
          icon="P"
          label="Workspace"
          tone="slate"
          title="Control mensual"
          value={formatMoney(netExpected, currency)}
        />
      </section>
    </ModuleFrame>
  );
}
