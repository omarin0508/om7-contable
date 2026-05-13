import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getBalanceGeneral,
  getResumenFinanciero,
} from "@/lib/estados-financieros";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value ?? 0));
}

const sectionLabels: Record<string, string> = {
  activo: "Activos",
  pasivo: "Pasivos",
  patrimonio: "Patrimonio",
};

export default async function BalanceGeneralPage() {
  const [balanceResult, resumenResult] = await Promise.all([
    getBalanceGeneral().catch((error: unknown) => ({
      error:
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el Balance General.",
      organizationId: null,
      rows: [],
    })),
    getResumenFinanciero().catch(() => ({
      resumen: {
        balance_cuadra: true,
        diferencia_balance: 0,
        total_activos: 0,
        total_pasivos: 0,
        total_patrimonio: 0,
      },
    })),
  ]);
  const actionError = "error" in balanceResult ? balanceResult.error : null;
  const rows = balanceResult.rows;
  const resumen = resumenResult.resumen;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Balance General"
        description="Activos, pasivos y patrimonio calculados desde saldos jerarquicos oficiales en SQL."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/estados-financieros" label="Volver" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/estado-resultados">
              Estado Resultados
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
        <MetricCard detail="Activo" label="Activos" value={formatCurrency(resumen.total_activos)} />
        <MetricCard detail="Pasivo" label="Pasivos" value={formatCurrency(resumen.total_pasivos)} />
        <MetricCard detail="Patrimonio" label="Patrimonio" value={formatCurrency(resumen.total_patrimonio)} />
        <MetricCard detail={resumen.balance_cuadra ? "Cuadra" : "Revisar"} label="Diferencia" value={formatCurrency(resumen.diferencia_balance)} />
      </section>

      <PremiumCard className="overflow-hidden">
        <div className="border-b border-white/[0.07] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Cuentas BG</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                El saldo presentado proviene de `get_balance_general`.
              </p>
            </div>
            <StatusBadge tone={resumen.balance_cuadra ? "emerald" : "amber"}>
              {resumen.balance_cuadra ? "Balance cuadra" : "Con diferencia"}
            </StatusBadge>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Seccion</th>
                <th>Naturaleza</th>
                <th>Debito</th>
                <th>Credito</th>
                <th>Saldo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.codigo}>
                    <td style={{ paddingLeft: `${Math.max(row.nivel - 1, 0) * 18 + 16}px` }}>
                      <p className="font-mono text-cyan-100">{row.codigo}</p>
                      <p className="mt-1 text-sm text-white">{row.nombre}</p>
                    </td>
                    <td>{sectionLabels[row.categoria] ?? row.categoria}</td>
                    <td>{row.naturaleza}</td>
                    <td>{formatCurrency(row.total_debito)}</td>
                    <td>{formatCurrency(row.total_credito)}</td>
                    <td>{formatCurrency(row.saldo_presentacion)}</td>
                    <td>
                      {row.tiene_saldo_contrario ? (
                        <StatusBadge tone="amber">Saldo contrario</StatusBadge>
                      ) : (
                        <StatusBadge tone="emerald">Normal</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="p-8 text-center">
                      <p className="text-base font-semibold text-white">
                        Sin movimientos de Balance General.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Solo asientos contabilizados alimentan este estado.
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
