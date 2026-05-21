import Link from "next/link";
import { CatalogoCuentasWorkspace } from "@/components/accounting/catalogo-cuentas-workspace";
import {
  BackLink,
  MetricCard,
  ModuleFrame,
  ModuleHeader,
} from "@/components/modules/shared";
import {
  ContextualHelpCard,
  EmptyStateOM7,
  StatusBadge,
} from "@/components/om7/operational-design-system";
import { PremiumCard } from "@/components/ui/premium-card";
import { listCatalogoContableWorkspace } from "@/lib/cuentas-contables";

export default async function AccountingCatalogPage(props: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const result = await listCatalogoContableWorkspace().catch((error: unknown) => ({
    activeCompany: null,
    accounts: [],
    canEditMaster: false,
    error:
      error instanceof Error && error.message
        ? error.message
        : "No se pudo cargar el catalogo contable.",
    globalAccounts: [],
    organization: null,
    organizationAccounts: [],
    source: "global" as const,
    stats: {
      acumulativa: 0,
      activas: 0,
      bg: 0,
      copiadas: 0,
      detalle: 0,
      er: 0,
      inactivas: 0,
      movimientos: 0,
      personalizadas: 0,
      total: 0,
    },
    tree: [],
    usageByAccountId: {},
  }));
  const {
    accounts,
    activeCompany,
    canEditMaster,
    globalAccounts,
    organization,
    organizationAccounts,
    source,
    stats,
    usageByAccountId,
  } = result;
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

      {searchParams.error ? (
        <PremiumCard className="border-amber-300/20 bg-amber-300/[0.08] p-4">
          <p className="text-sm font-semibold text-amber-100">
            {searchParams.error}
          </p>
        </PremiumCard>
      ) : null}

      {searchParams.success ? (
        <PremiumCard className="border-emerald-300/20 bg-emerald-300/[0.08] p-4">
          <p className="text-sm font-semibold text-emerald-100">
            {searchParams.success}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
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
          detail="Cuentas activas"
          label="Activas"
          value={String(stats.activas)}
        />
        <MetricCard
          detail="Agrupan ramas"
          label="Acumulativas"
          value={String(stats.acumulativa)}
        />
        <MetricCard
          detail="Creadas por el cliente"
          label="Personalizadas"
          value={String(stats.personalizadas)}
        />
        <MetricCard
          detail="Desde maestro OM7"
          label="Copiadas"
          value={String(stats.copiadas)}
        />
      </section>

      <ContextualHelpCard title="Nucleo contable OM7">
        Este catalogo alimenta asientos, mayor, balance de comprobacion, reglas y
        reportes. El Catalogo Maestro funciona como plantilla; para cada cliente
        puedes copiar solo las cuentas necesarias, editar nombres/codigos y
        desactivar lo que no se use.
      </ContextualHelpCard>

      {accounts.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={source === "global" ? "amber" : "emerald"}>
              {source === "global" ? "Viendo plantilla global" : "Catalogo editable"}
            </StatusBadge>
            <StatusBadge tone="cyan">
              {globalAccounts.length} cuentas maestras disponibles
            </StatusBadge>
            {activeCompany ? (
              <StatusBadge tone="slate">{activeCompany.name}</StatusBadge>
            ) : null}
          </div>

          <CatalogoCuentasWorkspace
            accounts={accounts}
            activeCompanyName={activeCompany?.name}
            canEditMaster={canEditMaster}
            globalAccounts={globalAccounts}
            organizationAccounts={organizationAccounts}
            source={source}
            usageByAccountId={usageByAccountId}
          />
        </>
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
