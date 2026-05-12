import Link from "next/link";
import { createDefaultAccountsAction } from "@/app/(platform)/contabilidad/actions";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { listAccountingAccounts } from "@/lib/accounting-entries";

type AccountingCatalogPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const accountTypeLabels: Record<string, string> = {
  asset: "Activo",
  bank: "Banco",
  cash: "Caja",
  equity: "Patrimonio",
  expense: "Gasto",
  income: "Ingreso",
  liability: "Pasivo",
  tax: "Impuesto",
};

function getAccountTypeLabel(type: string | null | undefined) {
  return accountTypeLabels[String(type ?? "")] ?? "Cuenta";
}

function getNormalBalanceLabel(value: string | null | undefined) {
  return value === "credit" ? "Haber" : "Debe";
}

export default async function AccountingCatalogPage({
  searchParams,
}: AccountingCatalogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const { accounts, company, organization } = await listAccountingAccounts().catch(
    () => ({
      accounts: [],
      company: null,
      organization: null,
    }),
  );
  const activeCount = accounts.filter((account) => account.is_active).length;
  const systemCount = accounts.filter((account) => account.is_system).length;
  const expenseCount = accounts.filter((account) => account.type === "expense").length;
  const taxCount = accounts.filter((account) => account.type === "tax").length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Catalogo de cuentas"
        description="Base contable minima para que OM7 sugiera asientos Debe/Haber sin configuracion pesada."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <form action={createDefaultAccountsAction}>
              <input
                name="redirectTo"
                type="hidden"
                value="/contabilidad/catalogo"
              />
              <button className="om7-btn-primary px-4 py-2.5" type="submit">
                Preparar cuentas base
              </button>
            </form>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo preparar el catalogo
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      {!company ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona un cliente/empresa
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            El catalogo de cuentas se prepara para la empresa activa.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl border border-amber-200/20 bg-black/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-black/25"
            href="/empresas"
          >
            Ir a clientes/empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={company?.name ?? organization?.name ?? "Sin empresa activa"}
          label="Cuentas activas"
          value={String(activeCount)}
        />
        <MetricCard
          detail="Creadas por OM7"
          label="Sistema"
          value={String(systemCount)}
        />
        <MetricCard
          detail="Para compras y gastos"
          label="Gastos"
          value={String(expenseCount)}
        />
        <MetricCard
          detail="IVA credito/debito"
          label="Impuestos"
          value={String(taxCount)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_0.28fr]">
        <PremiumCard className="overflow-hidden">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">
                  Cuentas disponibles
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  OM7 usa estas cuentas para proponer asientos desde compras y
                  facturas aprobadas.
                </p>
              </div>
              <span className="om7-chip om7-chip-cyan">
                {accounts.length} cuentas
              </span>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              {accounts.length > 0 ? (
                accounts.map((account) => (
                  <div
                    className="rounded-2xl border border-white/[0.08] bg-black/15 p-4 transition hover:border-cyan-200/18 hover:bg-white/[0.045]"
                    key={account.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {account.code} - {account.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getAccountTypeLabel(account.type)} - saldo{" "}
                          {getNormalBalanceLabel(account.normal_balance)}
                        </p>
                      </div>
                      {account.is_system ? (
                        <span className="om7-chip om7-chip-cyan">Sistema</span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center md:col-span-2">
                  <p className="text-base font-semibold text-white">
                    Aun no hay cuentas base.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Usa Preparar cuentas base para crear caja, banco, cuentas
                    por cobrar/pagar, ingresos, gastos e IVA.
                  </p>
                </div>
              )}
            </div>
          </div>
        </PremiumCard>

        <div className="grid gap-4 self-start">
          <PremiumCard className="p-5">
            <p className="text-sm font-semibold text-white">
              Para que sirve
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-400">
              <p>1. Preparas cuentas base una vez por empresa.</p>
              <p>2. OM7 las usa para sugerir asientos desde registros aprobados.</p>
              <p>3. El contador revisa y contabiliza sin crear desde cero.</p>
            </div>
          </PremiumCard>

          <PremiumCard className="p-5">
            <p className="text-sm font-semibold text-white">Siguiente paso</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Cuando el catalogo exista, volve a contabilidad o a una factura
              aprobada para generar el asiento sugerido.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
              href="/contabilidad"
            >
              Volver a asientos
            </Link>
          </PremiumCard>
        </div>
      </section>
    </ModuleFrame>
  );
}
