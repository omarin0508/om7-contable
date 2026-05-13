import Link from "next/link";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { StatusBadge } from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { listCuentasContables } from "@/lib/cuentas-contables";
import { getBalanceComprobacion } from "@/lib/reportes-contables";

type BalanceComprobacionPageProps = {
  searchParams?: Promise<{
    cuentaId?: string;
    desde?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    hasta?: string;
    soloMovimiento?: string;
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
  const fechaDesde = params.fechaDesde ?? params.desde ?? null;
  const fechaHasta = params.fechaHasta ?? params.hasta ?? null;
  const cuentaId = params.cuentaId ?? null;
  const soloMovimiento = params.soloMovimiento !== "false";
  const result = await getBalanceComprobacion({
    cuentaId,
    fechaDesde,
    fechaHasta,
    incluirCuentasSinMovimiento: !soloMovimiento,
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
  const cuentasResult = await listCuentasContables().catch(() => ({
    accounts: [],
    organization: null,
  }));
  const { rows, summary } = result;
  const actionError = "error" in result ? result.error : null;
  const isBalanced = Math.abs(summary.diferencia) < 0.01;
  const organizationId = result.organizationId ?? cuentasResult.organization?.id ?? "";
  const accounts = cuentasResult.accounts
    .filter((account) => account.tipo_cuenta === "detalle")
    .sort((left, right) =>
      left.codigo.localeCompare(right.codigo, "es", { numeric: true }),
    );
  const selectedAccount = accounts.find((account) => account.id === cuentaId);
  const saldosContrarios = rows.filter((row) => row.tiene_saldo_contrario).length;
  const excelParams = new URLSearchParams({ tipo: "balance-comprobacion" });

  if (organizationId) {
    excelParams.set("organizationId", organizationId);
  }

  if (fechaDesde) {
    excelParams.set("fechaDesde", fechaDesde);
  }

  if (fechaHasta) {
    excelParams.set("fechaHasta", fechaHasta);
  }

  if (cuentaId) {
    excelParams.set("cuentaId", cuentaId);
  }

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Balance de Comprobación"
        description="Totales por cuenta detalle contabilizada. OM7 calcula debitos, creditos y saldos naturales desde SQL."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad/asientos" label="Volver a asientos" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/mayor">
              Mayor general
            </Link>
            <Link
              className="om7-btn-primary px-4 py-2.5"
              href={`/contabilidad/reportes/exportar/excel?${excelParams.toString()}`}
            >
              Exportar Excel
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

      <PremiumCard className="p-5">
        <form className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-medium text-slate-300">
            Fecha desde
            <input
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-200/40"
              defaultValue={fechaDesde ?? ""}
              name="fechaDesde"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-300">
            Fecha hasta
            <input
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-200/40"
              defaultValue={fechaHasta ?? ""}
              name="fechaHasta"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-300">
            Cuenta
            <select
              className="rounded-xl border border-white/[0.08] bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-200/40"
              defaultValue={cuentaId ?? ""}
              name="cuentaId"
            >
              <option value="">Todas las cuentas</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.codigo} - {account.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="grid gap-2 text-sm font-medium text-slate-300">
              Solo con movimiento
              <select
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-200/40"
                defaultValue={String(soloMovimiento)}
                name="soloMovimiento"
              >
                <option value="true">Si</option>
                <option value="false">No</option>
              </select>
            </label>
            <button className="om7-btn-primary px-4 py-2.5" type="submit">
              Aplicar
            </button>
          </div>
        </form>
        {!soloMovimiento ? (
          <p className="mt-3 text-xs leading-5 text-amber-200/80">
            La RPC oficial de balance de comprobacion devuelve cuentas detalle con
            debitos o creditos del periodo. Las cuentas sin movimiento quedan fuera
            por definicion backend.
          </p>
        ) : null}
      </PremiumCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
        <MetricCard
          detail="Estado oficial"
          label="Control"
          value={isBalanced ? "Cuadra" : "No cuadra"}
        />
        <MetricCard
          detail="Alertas por naturaleza"
          label="Saldos contrarios"
          value={String(saldosContrarios)}
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
                Solo incluye cuentas detalle con movimientos oficiales del periodo.
                {selectedAccount ? ` Filtro: ${selectedAccount.codigo}.` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={isBalanced ? "emerald" : "amber"}>
                {isBalanced ? "Cuadra" : "Diferencia"}
              </StatusBadge>
              {saldosContrarios > 0 ? (
                <StatusBadge tone="rose">Saldo contrario</StatusBadge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="om7-responsive-table">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Cuenta</th>
                <th>Categoría</th>
                <th>Naturaleza</th>
                <th>Débitos</th>
                <th>Créditos</th>
                <th>Saldo deudor</th>
                <th>Saldo acreedor</th>
                <th>Saldo natural</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.codigo}>
                    <td>
                      <p className="font-mono text-cyan-100">{row.codigo}</p>
                    </td>
                    <td>
                      <p
                        className="text-sm font-semibold text-white"
                        style={{ paddingLeft: `${Math.max(Number(row.nivel ?? 1) - 1, 0) * 14}px` }}
                      >
                        {row.nombre}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Nivel {row.nivel ?? 1}
                      </p>
                    </td>
                    <td>{row.categoria}</td>
                    <td>{row.naturaleza}</td>
                    <td>{formatCurrency(row.total_debito)}</td>
                    <td>{formatCurrency(row.total_credito)}</td>
                    <td>{formatCurrency(row.saldo_deudor)}</td>
                    <td>{formatCurrency(row.saldo_acreedor)}</td>
                    <td>{formatCurrency(row.saldo_natural)}</td>
                    <td>
                      <StatusBadge
                        tone={row.tiene_saldo_contrario ? "rose" : "emerald"}
                      >
                        {row.tiene_saldo_contrario ? "Saldo contrario" : "OK"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
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
