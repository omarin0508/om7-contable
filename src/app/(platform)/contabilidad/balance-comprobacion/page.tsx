import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { getBalanceComprobacion } from "@/lib/reportes-contables";

type BalanceComprobacionPageProps = {
  searchParams?: Promise<{
    cuentaId?: string;
    desde?: string;
    hasta?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

export default async function BalanceComprobacionPage({
  searchParams,
}: BalanceComprobacionPageProps) {
  const params = searchParams ? await searchParams : {};
  const result = await getBalanceComprobacion({
    cuentaId: params.cuentaId ?? null,
    fechaDesde: params.desde ?? null,
    fechaHasta: params.hasta ?? null,
  }).catch((error: unknown) => ({
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el balance de comprobacion.",
    organizationId: null,
    rows: [],
    summary: {
      diferencia: 0,
      totalCredito: 0,
      totalDebito: 0,
    },
  }));
  const { rows, summary } = result;
  const actionError = "error" in result ? result.error : null;
  const isBalanced = Math.abs(summary.diferencia) < 0.01;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Balance de comprobacion"
        description="Totales por cuenta detalle contabilizada. OM7 calcula debitos, creditos y saldos naturales desde SQL."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/mayor">
              Mayor general
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Balance no disponible
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Cuentas con movimiento"
          label="Cuentas"
          value={String(rows.length)}
        />
        <MetricCard
          detail="Total oficial SQL"
          label="Debitos"
          value={formatCurrency(summary.totalDebito)}
        />
        <MetricCard
          detail="Total oficial SQL"
          label="Creditos"
          value={formatCurrency(summary.totalCredito)}
        />
        <MetricCard
          detail={isBalanced ? "Balanceado" : "Revisar diferencia"}
          label="Diferencia"
          value={formatCurrency(summary.diferencia)}
        />
      </section>

      {!isBalanced ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Debitos y creditos no coinciden
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            La diferencia proviene del cálculo oficial de base de datos.
            Revisá asientos contabilizados del periodo.
          </p>
        </PremiumCard>
      ) : null}

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                Cuentas del balance
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Solo incluye cuentas detalle con movimientos o saldo.
              </p>
            </div>
            <StatusBadge tone={isBalanced ? "emerald" : "amber"}>
              {isBalanced ? "Cuadra" : "Con diferencia"}
            </StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Categoria</th>
                <th>Naturaleza</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Saldo deudor</th>
                <th>Saldo acreedor</th>
                <th>Saldo natural</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.codigo}>
                    <td>
                      <p className="font-mono text-cyan-100">{row.codigo}</p>
                      <p className="mt-1 text-sm text-white">{row.nombre}</p>
                    </td>
                    <td>{row.categoria}</td>
                    <td>{row.naturaleza}</td>
                    <td>{formatCurrency(row.total_debito)}</td>
                    <td>{formatCurrency(row.total_credito)}</td>
                    <td>{formatCurrency(row.saldo_deudor)}</td>
                    <td>{formatCurrency(row.saldo_acreedor)}</td>
                    <td>{formatCurrency(row.saldo_natural)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        No hay cuentas con saldo.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Solo los asientos contabilizados alimentan este reporte.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
