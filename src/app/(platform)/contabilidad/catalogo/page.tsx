import Link from "next/link";
import { CuentasContablesTree } from "@/components/accounting/cuentas-contables-tree";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import {
  ContextualHelpCard,
  EmptyStateOM7,
  SectionHeader,
  StatusBadge,
} from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { listCuentasContables } from "@/lib/cuentas-contables";

export default async function AccountingCatalogPage() {
  const result = await listCuentasContables().catch((error: unknown) => ({
    accounts: [],
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el catalogo contable.",
    organization: null,
    source: "global" as const,
    stats: {
      acumulativa: 0,
      bg: 0,
      detalle: 0,
      er: 0,
      movimientos: 0,
      total: 0,
    },
    tree: [],
  }));
  const { accounts, organization, source, stats, tree } = result;
  const actionError = "error" in result ? result.error : null;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Catalogo contable OM7"
        description="Nucleo oficial de cuentas contables para conectar compras, facturas, planillas, caja, presupuestos y reportes a una estructura real."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            Catalogo contable pendiente
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
          <p className="mt-3 text-sm leading-6 text-amber-100/70">
            Ejecuta primero la migracion{" "}
            <span className="font-mono">supabase/schema-025-cuentas-contables.sql</span>{" "}
            y luego importa el Excel oficial con{" "}
            <span className="font-mono">npm run import:catalogo</span>.
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={organization?.name ?? "Sin organizacion activa"}
          label="Cuentas"
          value={String(stats.total)}
        />
        <MetricCard
          detail="Permiten movimientos"
          label="Detalle"
          value={String(stats.detalle)}
        />
        <MetricCard
          detail="Balance general"
          label="BG"
          value={String(stats.bg)}
        />
        <MetricCard
          detail="Estado de resultados"
          label="ER"
          value={String(stats.er)}
        />
      </section>

      <ContextualHelpCard title="Nucleo contable OM7">
        Este catalogo es la base persistente que usaran los modulos operativos
        para registrar movimientos contra cuentas reales. En esta fase solo se
        prepara estructura, jerarquia, importacion y navegacion; los asientos y
        estados financieros siguen en sus flujos actuales.
      </ContextualHelpCard>

      {accounts.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <PremiumCard className="min-w-0 overflow-hidden">
            <CuentasContablesTree accountsCount={accounts.length} tree={tree} />
          </PremiumCard>

          <div className="grid content-start gap-4">
            <PremiumCard className="p-5">
              <SectionHeader
                description="Resumen operativo de la estructura importada."
                action={
                  <StatusBadge tone={source === "global" ? "amber" : "emerald"}>
                    {source === "global" ? "Plantilla global" : "Organizacion"}
                  </StatusBadge>
                }
                title="Estado del catalogo"
              />
              <div className="mt-5 grid gap-2">
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2">
                  <span className="text-sm text-slate-400">Acumulativas</span>
                  <StatusBadge tone="cyan">{stats.acumulativa}</StatusBadge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2">
                  <span className="text-sm text-slate-400">Movimientos</span>
                  <StatusBadge tone="emerald">{stats.movimientos}</StatusBadge>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/15 px-3 py-2">
                  <span className="text-sm text-slate-400">Naturaleza</span>
                  <StatusBadge tone="slate">Debe/Haber</StatusBadge>
                </div>
              </div>
            </PremiumCard>

            <PremiumCard className="p-5">
              <p className="text-sm font-semibold text-white">
                Importacion idempotente
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                El importador usa upsert por organizacion y codigo. Puedes
                correrlo nuevamente cuando el Excel oficial cambie sin duplicar
                cuentas.
              </p>
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 p-3 font-mono text-xs leading-6 text-slate-300">
                npm run import:catalogo -- --file=&quot;Catalogo de cuentas v1 12 mayo 26.xlsx&quot; --organization=&quot;ORG_ID&quot;
              </div>
            </PremiumCard>
          </div>
        </section>
      ) : (
        <EmptyStateOM7
          action={
            <Link className="om7-btn-primary px-4 py-2.5" href="/contabilidad">
              Volver a contabilidad
            </Link>
          }
          description="Cuando ejecutes la migracion y el importador, OM7 mostrara aqui el arbol jerarquico oficial del catalogo contable."
          title="Catalogo oficial aun no importado"
        />
      )}
    </ModuleFrame>
  );
}
