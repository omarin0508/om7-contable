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
  createReglaContableAction,
  duplicateReglaContableAction,
  toggleReglaContableAction,
  updateReglaContableAction,
} from "@/app/(platform)/contabilidad/reglas/actions";
import {
  getReglasContables,
  type CuentaReglaOption,
  type ReglaContable,
  type ReglaContableModulo,
} from "@/lib/reglas-contables";

type ReglasPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const moduleConfig: Array<{
  modulo: ReglaContableModulo;
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  accountLabels: Record<string, string>;
}> = [
  {
    accountLabels: {
      cuenta_credito_id: "Cuenta credito/proveedor",
      cuenta_debito_id: "Cuenta debito/gasto",
      cuenta_iva_id: "Cuenta IVA",
    },
    modulo: "compras",
    primaryLabel: "Categoria compra",
    title: "Compras",
  },
  {
    accountLabels: {
      cuenta_clientes_id: "Cuenta clientes",
      cuenta_ingreso_id: "Cuenta ingreso",
      cuenta_iva_debito_id: "Cuenta IVA debito",
    },
    modulo: "facturas",
    primaryLabel: "Categoria factura",
    title: "Facturas",
  },
  {
    accountLabels: {
      cuenta_caja_banco_id: "Cuenta caja/banco",
      cuenta_contrapartida_id: "Contrapartida",
      cuenta_iva_id: "Cuenta IVA",
    },
    modulo: "caja",
    primaryLabel: "Tipo movimiento",
    secondaryLabel: "Categoria movimiento",
    title: "Caja/Bancos",
  },
  {
    accountLabels: {
      cuenta_banco_id: "Cuenta banco/caja",
      cuenta_cargas_sociales_id: "Cuenta cargas sociales",
      cuenta_gasto_salarios_id: "Cuenta gasto salarios",
      cuenta_obligaciones_id: "Cuenta obligaciones",
    },
    modulo: "planillas",
    primaryLabel: "Tipo planilla",
    secondaryLabel: "Clasificacion laboral",
    title: "Planillas",
  },
  {
    accountLabels: {
      cuenta_banco_id: "Cuenta banco/caja",
      cuenta_costo_subcontrato_id: "Cuenta costo subcontrato",
      cuenta_proveedor_id: "Cuenta proveedor",
      cuenta_retenciones_id: "Cuenta retenciones",
    },
    modulo: "subcontratos",
    primaryLabel: "Tipo subcontrato",
    secondaryLabel: "Categoria subcontrato",
    title: "Subcontratos",
  },
];

function accountOptionsByCategory(cuentas: CuentaReglaOption[]) {
  return cuentas.reduce<Record<string, CuentaReglaOption[]>>((groups, account) => {
    const key = account.categoria;

    groups[key] = groups[key] ?? [];
    groups[key].push(account);

    return groups;
  }, {});
}

function AccountSelect({
  accountsByCategory,
  defaultValue,
  label,
  name,
  required = false,
}: {
  accountsByCategory: Record<string, CuentaReglaOption[]>;
  defaultValue?: string | null;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-300">
      {label}
      <select
        className="om7-input"
        defaultValue={defaultValue ?? ""}
        name={name}
        required={required}
      >
        <option value="">Sin cuenta</option>
        {Object.entries(accountsByCategory).map(([category, accounts]) => (
          <optgroup key={category} label={category}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.codigo} - {account.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function RuleForm({
  accountsByCategory,
  config,
  rule,
}: {
  accountsByCategory: Record<string, CuentaReglaOption[]>;
  config: (typeof moduleConfig)[number];
  rule?: ReglaContable;
}) {
  const accountByField = new Map(
    rule?.cuentas.map((account) => [account.campo, account.cuenta_id]) ?? [],
  );
  const action = rule ? updateReglaContableAction : createReglaContableAction;

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
      <input name="modulo" type="hidden" value={config.modulo} />
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <input name="activa" type="hidden" value={String(rule?.activa ?? true)} />
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-xs font-semibold text-slate-300">
          {config.primaryLabel}
          <input
            className="om7-input"
            defaultValue={rule?.clave ?? ""}
            name="clave"
            required
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-300">
          {config.secondaryLabel ?? "Clasificacion"}
          <input
            className="om7-input"
            defaultValue={rule?.clave_secundaria ?? ""}
            name="claveSecundaria"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-300">
          Prioridad
          <input
            className="om7-input"
            defaultValue={rule?.prioridad ?? 100}
            min={1}
            name="prioridad"
            type="number"
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-300">
          <input
            defaultChecked={rule?.requiere_centro_costo ?? false}
            name="requiereCentroCosto"
            type="checkbox"
          />
          Requiere centro costo
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Object.entries(config.accountLabels).map(([field, label], index) => (
          <AccountSelect
            accountsByCategory={accountsByCategory}
            defaultValue={accountByField.get(field)}
            key={field}
            label={label}
            name={field}
            required={index < 2}
          />
        ))}
      </div>
      <div>
        <button className="om7-btn-primary px-4 py-2.5" type="submit">
          {rule ? "Guardar regla" : "Crear regla"}
        </button>
      </div>
    </form>
  );
}

function RuleRow({
  config,
  rule,
}: {
  config: (typeof moduleConfig)[number];
  rule: ReglaContable;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={rule.activa ? "emerald" : "slate"}>
              {rule.activa ? "Activa" : "Inactiva"}
            </StatusBadge>
            <StatusBadge tone={rule.organization_id ? "cyan" : "amber"}>
              {rule.organization_id ? "Organizacion" : "Global"}
            </StatusBadge>
            <StatusBadge tone="slate">Prioridad {rule.prioridad}</StatusBadge>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            {rule.clave}
            {rule.clave_secundaria ? ` / ${rule.clave_secundaria}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Actualizada: {rule.updated_at ?? "Sin fecha"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rule.organization_id ? (
            <form action={toggleReglaContableAction}>
              <input name="modulo" type="hidden" value={config.modulo} />
              <input name="ruleId" type="hidden" value={rule.id} />
              <input name="activa" type="hidden" value={String(!rule.activa)} />
              <button className="om7-btn-ghost px-3 py-2 text-xs" type="submit">
                {rule.activa ? "Desactivar" : "Activar"}
              </button>
            </form>
          ) : (
            <form action={duplicateReglaContableAction}>
              <input name="modulo" type="hidden" value={config.modulo} />
              <input name="ruleId" type="hidden" value={rule.id} />
              <button className="om7-btn-ghost px-3 py-2 text-xs" type="submit">
                Duplicar a organizacion
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {rule.cuentas.map((account) => (
          <div
            className="rounded-xl border border-white/[0.07] bg-black/15 p-3"
            key={account.campo}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {config.accountLabels[account.campo] ?? account.campo}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {account.cuenta_codigo
                ? `${account.cuenta_codigo} - ${account.cuenta_nombre}`
                : "Sin cuenta"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ReglasContablesPage({
  searchParams,
}: ReglasPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const actionError = resolvedSearchParams.error ?? null;
  const { cuentas, reglas } = await getReglasContables();
  const accountsByCategory = accountOptionsByCategory(cuentas);
  const allRules = Object.values(reglas).flat();
  const activeRules = allRules.filter((rule) => rule.activa).length;
  const globalRules = allRules.filter((rule) => !rule.organization_id).length;
  const orgRules = allRules.filter((rule) => rule.organization_id).length;

  return (
    <ModuleFrame>
      <ModuleHeader
        title="Reglas contables"
        description="Administracion segura de reglas por modulo. La generacion de asientos permanece en SQL/RPC."
        action={
          <div className="flex flex-wrap gap-2">
            <BackLink href="/contabilidad" label="Volver a contabilidad" />
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/catalogo">
              Catalogo
            </Link>
          </div>
        }
      />

      {actionError ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/[0.08] p-5">
          <p className="text-sm font-semibold text-amber-100">
            No se pudo completar la accion
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            {actionError}
          </p>
        </PremiumCard>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Todos los modulos" label="Reglas" value={String(allRules.length)} />
        <MetricCard detail="Disponibles para motor contable" label="Activas" value={String(activeRules)} />
        <MetricCard detail="Seeds/base OM7" label="Globales" value={String(globalRules)} />
        <MetricCard detail="Personalizadas" label="Organizacion" value={String(orgRules)} />
      </section>

      <PremiumCard className="p-5">
        <p className="text-base font-semibold text-white">Selector de cuentas</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Los formularios solo listan cuentas detalle, activas y con movimientos
          permitidos. La RPC `validar_regla_contable` vuelve a verificar cuentas
          y conflictos antes de guardar.
        </p>
      </PremiumCard>

      {moduleConfig.map((config) => (
        <PremiumCard className="overflow-hidden" key={config.modulo}>
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-base font-semibold text-white">{config.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Crear, editar prioridad/cuentas y activar reglas de {config.title}.
                </p>
              </div>
              <StatusBadge tone="cyan">
                {reglas[config.modulo].length} reglas
              </StatusBadge>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:p-5">
            <RuleForm accountsByCategory={accountsByCategory} config={config} />
            {reglas[config.modulo].map((rule) => (
              <div key={rule.id}>
                <RuleRow config={config} rule={rule} />
                {rule.organization_id ? (
                  <div className="mt-3">
                    <RuleForm
                      accountsByCategory={accountsByCategory}
                      config={config}
                      rule={rule}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </PremiumCard>
      ))}
    </ModuleFrame>
  );
}
