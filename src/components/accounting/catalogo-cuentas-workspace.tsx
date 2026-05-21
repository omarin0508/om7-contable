"use client";

import { useMemo, useState } from "react";
import {
  copySelectedMasterAccountsAction,
  saveCuentaContableAction,
  toggleCuentaContableAction,
} from "@/app/(platform)/contabilidad/catalogo/actions";
import type {
  CuentaContable,
  CuentaContableCategoria,
  CuentaContableUsage,
} from "@/lib/cuentas-contables";

type CatalogoCuentasWorkspaceProps = {
  accounts: CuentaContable[];
  activeCompanyName?: string | null;
  canEditMaster: boolean;
  globalAccounts: CuentaContable[];
  organizationAccounts: CuentaContable[];
  source: "organization" | "global";
  usageByAccountId: CuentaContableUsage;
};

type FilterState = {
  category: string;
  level: string;
  nature: string;
  query: string;
  status: string;
  type: string;
};

const categoryLabels: Record<CuentaContableCategoria, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  costo: "Costo",
  gasto: "Gasto",
};

const categories = Object.keys(categoryLabels) as CuentaContableCategoria[];
const natureOptions = [
  { label: "Deudora", value: "deudora" },
  { label: "Acreedora", value: "acreedora" },
];
const typeOptions = [
  { label: "Acumulativa", value: "acumulativa" },
  { label: "Detalle", value: "detalle" },
];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function accountDescription(account: CuentaContable | null) {
  const value = account?.metadata?.descripcion ?? account?.metadata?.notes;

  return typeof value === "string" ? value : "";
}

function isCopied(account: CuentaContable) {
  return typeof account.metadata?.copied_from_global_account_id === "string";
}

function isRequired(account: CuentaContable) {
  return (
    account.metadata?.is_required === true ||
    account.metadata?.required === true ||
    account.metadata?.obligatoria === true
  );
}

function isRecommended(account: CuentaContable) {
  return (
    isRequired(account) ||
    account.metadata?.is_recommended === true ||
    account.metadata?.recommended === true ||
    account.metadata?.recomendada === true
  );
}

function accountOrigin(account: CuentaContable) {
  if (!account.organization_id) {
    return "Maestro";
  }

  return isCopied(account) ? "Copiada" : "Personalizada";
}

function buildChildrenByParent(accounts: CuentaContable[]) {
  const childrenByParent = new Map<string, CuentaContable[]>();

  for (const account of accounts) {
    if (!account.cuenta_padre_id) {
      continue;
    }

    childrenByParent.set(account.cuenta_padre_id, [
      ...(childrenByParent.get(account.cuenta_padre_id) ?? []),
      account,
    ]);
  }

  return childrenByParent;
}

function getDescendantIds(account: CuentaContable, accounts: CuentaContable[]) {
  const childrenByParent = buildChildrenByParent(accounts);
  const ids = new Set<string>();
  const visit = (node: CuentaContable) => {
    ids.add(node.id);
    for (const child of childrenByParent.get(node.id) ?? []) {
      visit(child);
    }
  };

  visit(account);

  return ids;
}

function filterAccounts(accounts: CuentaContable[], filters: FilterState) {
  const query = normalizeSearch(filters.query);

  return accounts.filter((account) => {
    const searchable = normalizeSearch(
      `${account.codigo} ${account.nombre} ${account.categoria} ${account.naturaleza}`,
    );
    const matchesQuery = !query || searchable.includes(query);
    const matchesCategory =
      filters.category === "all" || account.categoria === filters.category;
    const matchesNature =
      filters.nature === "all" || account.naturaleza === filters.nature;
    const matchesType = filters.type === "all" || account.tipo_cuenta === filters.type;
    const matchesLevel =
      filters.level === "all" || String(account.nivel) === filters.level;
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" ? account.activa : !account.activa);

    return (
      matchesQuery &&
      matchesCategory &&
      matchesNature &&
      matchesType &&
      matchesLevel &&
      matchesStatus
    );
  });
}

function SelectField({
  defaultValue,
  name,
  options,
}: {
  defaultValue?: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <select
      className="h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
      defaultValue={defaultValue}
      name={name}
    >
      {options.map((option) => (
        <option className="bg-slate-950" key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ToggleAccountForm({
  account,
  scope,
}: {
  account: CuentaContable;
  scope: "client" | "master";
}) {
  return (
    <form action={toggleCuentaContableAction}>
      <input name="catalogScope" type="hidden" value={scope} />
      <input name="accountId" type="hidden" value={account.id} />
      <input name="activa" type="hidden" value={account.activa ? "false" : "true"} />
      <button
        className="rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
        type="submit"
      >
        {account.activa ? "Inactivar" : "Activar"}
      </button>
    </form>
  );
}

export function CatalogoCuentasWorkspace({
  accounts,
  activeCompanyName,
  canEditMaster,
  globalAccounts,
  organizationAccounts,
  source,
  usageByAccountId,
}: CatalogoCuentasWorkspaceProps) {
  const [mode, setMode] = useState<"cliente" | "maestro">("cliente");
  const [editingAccountId, setEditingAccountId] = useState<string | "new" | null>(
    null,
  );
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    level: "all",
    nature: "all",
    query: "",
    status: "all",
    type: "all",
  });
  const [selectedMasterIds, setSelectedMasterIds] = useState<Set<string>>(
    () => new Set(),
  );

  const organizationCodes = useMemo(
    () => new Set(organizationAccounts.map((account) => account.codigo)),
    [organizationAccounts],
  );
  const parentOptions = organizationAccounts.filter(
    (account) => account.tipo_cuenta === "acumulativa",
  );
  const masterParentOptions = globalAccounts.filter(
    (account) => account.tipo_cuenta === "acumulativa",
  );
  const displayAccounts = mode === "cliente" ? accounts : globalAccounts;
  const visibleAccounts = useMemo(
    () => filterAccounts(displayAccounts, filters),
    [displayAccounts, filters],
  );
  const levels = useMemo(
    () =>
      Array.from(new Set(displayAccounts.map((account) => account.nivel)))
        .sort((left, right) => left - right)
        .map((level) => String(level)),
    [displayAccounts],
  );
  const accountsById = useMemo(
    () => new Map(displayAccounts.map((account) => [account.id, account])),
    [displayAccounts],
  );
  const editingAccount =
    editingAccountId && editingAccountId !== "new"
      ? displayAccounts.find((account) => account.id === editingAccountId) ?? null
      : null;
  const editingHasMovements =
    editingAccountId && editingAccountId !== "new"
      ? (usageByAccountId[editingAccountId] ?? 0) > 0
      : false;
  const canEditCatalog = source === "organization";
  const activeScope = mode === "maestro" ? "master" : "client";
  const canEditActiveScope = mode === "maestro" ? canEditMaster : canEditCatalog;
  const canEditPanel = editingAccountId === "new" || canEditActiveScope;

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleMasterAccount = (account: CuentaContable) => {
    const branchIds = getDescendantIds(account, globalAccounts);

    setSelectedMasterIds((current) => {
      const next = new Set(current);
      const shouldSelect = !Array.from(branchIds).every((id) => next.has(id));

      for (const id of branchIds) {
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return next;
    });
  };

  const selectMasterCategory = (category: CuentaContableCategoria) => {
    setSelectedMasterIds((current) => {
      const next = new Set(current);

      for (const account of globalAccounts) {
        if (account.categoria === category) {
          next.add(account.id);
        }
      }

      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/20 bg-[#06101f]/95 shadow-2xl shadow-cyan-950/30">
      <header className="border-b border-white/15 bg-white/[0.035] px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
              Workspace contable
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Catalogo de cuentas editable
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              El catalogo maestro es la base. Puedes copiar solo las cuentas que
              este cliente realmente usara y luego personalizarlas sin mezclar
              datos entre organizaciones.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={[
                "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                mode === "cliente"
                  ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white",
              ].join(" ")}
              onClick={() => setMode("cliente")}
              type="button"
            >
              Catalogo cliente
            </button>
            <button
              className={[
                "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                mode === "maestro"
                  ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white",
              ].join(" ")}
              onClick={() => setMode("maestro")}
              type="button"
            >
              Catalogo maestro
            </button>
            <button
              className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/30"
              onClick={() => {
                setNewParentId(null);
                setEditingAccountId("new");
              }}
              type="button"
            >
              {mode === "maestro" ? "Nueva cuenta maestra" : "Nueva cuenta"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid border-b border-white/15 bg-slate-950/25 md:grid-cols-3 md:divide-x md:divide-white/15 xl:grid-cols-6">
        {[
          ["Total", accounts.length],
          ["Activas", accounts.filter((account) => account.activa).length],
          ["Detalle", accounts.filter((account) => account.tipo_cuenta === "detalle").length],
          [
            "Acumulativas",
            accounts.filter((account) => account.tipo_cuenta === "acumulativa").length,
          ],
          ["Personalizadas", accounts.filter((account) => accountOrigin(account) === "Personalizada").length],
          ["Copiadas", accounts.filter((account) => accountOrigin(account) === "Copiada").length],
        ].map(([label, value]) => (
          <div className="border-b border-white/15 px-4 py-3 md:border-b-0" key={label}>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="border-b border-white/15 bg-white/[0.018] px-4 py-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_150px_150px_120px_130px]">
          <input
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Buscar por codigo, nombre, categoria o naturaleza..."
            type="search"
            value={filters.query}
          />
          <select
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none"
            onChange={(event) => setFilter("category", event.target.value)}
            value={filters.category}
          >
            <option className="bg-slate-950" value="all">
              Categoria
            </option>
            {categories.map((category) => (
              <option className="bg-slate-950" key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none"
            onChange={(event) => setFilter("nature", event.target.value)}
            value={filters.nature}
          >
            <option className="bg-slate-950" value="all">
              Naturaleza
            </option>
            {natureOptions.map((option) => (
              <option className="bg-slate-950" key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none"
            onChange={(event) => setFilter("type", event.target.value)}
            value={filters.type}
          >
            <option className="bg-slate-950" value="all">
              Tipo
            </option>
            {typeOptions.map((option) => (
              <option className="bg-slate-950" key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none"
            onChange={(event) => setFilter("level", event.target.value)}
            value={filters.level}
          >
            <option className="bg-slate-950" value="all">
              Nivel
            </option>
            {levels.map((level) => (
              <option className="bg-slate-950" key={level} value={level}>
                Nivel {level}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-slate-950/45 px-3 text-sm text-white outline-none"
            onChange={(event) => setFilter("status", event.target.value)}
            value={filters.status}
          >
            <option className="bg-slate-950" value="all">
              Estado
            </option>
            <option className="bg-slate-950" value="active">
              Activas
            </option>
            <option className="bg-slate-950" value="inactive">
              Inactivas
            </option>
          </select>
        </div>
      </div>

      {mode === "maestro" ? (
        <div>
          <div className="flex flex-col gap-3 border-b border-white/15 bg-cyan-300/[0.035] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-100">
                Seleccion desde Catalogo Maestro
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Selecciona cuentas, ramas completas o categorias. Las cuentas que
                ya existen se omiten automaticamente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                  key={category}
                  onClick={() => selectMasterCategory(category)}
                  type="button"
                >
                  {categoryLabels[category]}
                </button>
              ))}
              <button
                className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-white"
                onClick={() => setSelectedMasterIds(new Set())}
                type="button"
              >
                Limpiar
              </button>
              <form action={copySelectedMasterAccountsAction}>
                {Array.from(selectedMasterIds).map((id) => (
                  <input
                    key={id}
                    name="selectedAccountId"
                    type="hidden"
                    value={id}
                  />
                ))}
                <button className="om7-btn-primary px-4 py-2" type="submit">
                  Copiar seleccionadas ({selectedMasterIds.size})
                </button>
              </form>
            </div>
          </div>
          <CatalogTable
            accounts={visibleAccounts}
            accountsById={accountsById}
            mode={mode}
            canEditMaster={canEditMaster}
            onEdit={setEditingAccountId}
            onNewChild={(parentId) => {
              setNewParentId(parentId);
              setEditingAccountId("new");
            }}
            onToggleMaster={toggleMasterAccount}
            organizationCodes={organizationCodes}
            selectedMasterIds={selectedMasterIds}
            usageByAccountId={usageByAccountId}
          />
        </div>
      ) : (
        <CatalogTable
          accounts={visibleAccounts}
          accountsById={accountsById}
          canEdit={canEditCatalog}
          canEditMaster={canEditMaster}
          mode={mode}
          onEdit={setEditingAccountId}
          onNewChild={(parentId) => {
            setNewParentId(parentId);
            setEditingAccountId("new");
          }}
          organizationCodes={organizationCodes}
          selectedMasterIds={selectedMasterIds}
          usageByAccountId={usageByAccountId}
        />
      )}

      <footer className="border-t border-white/15 bg-white/[0.025] px-5 py-4">
        <div className="flex flex-col gap-2 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
          <p>
            Las cuentas con movimientos no deben eliminarse; se pueden desactivar
            o ajustar solo en campos no criticos.
          </p>
          <p className="text-slate-500">
            Contexto: {activeCompanyName ?? "organizacion activa"}
          </p>
        </div>
      </footer>

      {editingAccountId ? (
        <AccountEditorPanel
          account={editingAccount}
          canEdit={canEditPanel}
          defaultParentId={newParentId}
          hasMovements={Boolean(editingHasMovements)}
          onClose={() => setEditingAccountId(null)}
          parentOptions={(mode === "maestro" ? masterParentOptions : parentOptions).filter(
            (account) => account.id !== editingAccount?.id,
          )}
          scope={activeScope}
        />
      ) : null}
    </section>
  );
}

function CatalogTable({
  accounts,
  accountsById,
  canEdit = false,
  canEditMaster = false,
  mode,
  onEdit,
  onNewChild,
  onToggleMaster,
  organizationCodes,
  selectedMasterIds,
  usageByAccountId,
}: {
  accounts: CuentaContable[];
  accountsById: Map<string, CuentaContable>;
  canEdit?: boolean;
  canEditMaster?: boolean;
  mode: "cliente" | "maestro";
  onEdit: (id: string) => void;
  onNewChild: (parentId: string) => void;
  onToggleMaster?: (account: CuentaContable) => void;
  organizationCodes: Set<string>;
  selectedMasterIds: Set<string>;
  usageByAccountId: CuentaContableUsage;
}) {
  return (
    <div className="om7-scrollbar max-h-[52vh] overflow-auto overscroll-contain sm:max-h-[58vh]">
      <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
        <colgroup>
          {mode === "maestro" ? <col className="w-12" /> : null}
          <col className="w-28" />
          <col className="w-[28%]" />
          <col className="w-32" />
          <col className="w-28" />
          <col className="w-20" />
          <col className="w-32" />
          <col className="w-[18%]" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-36" />
        </colgroup>
        <thead className="sticky top-0 z-30 shadow-[0_14px_28px_rgba(0,0,0,0.42)]">
          <tr className="border-b border-white/20 bg-[#0b1728] text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
            {mode === "maestro" ? (
              <th className="border-r border-white/15 bg-[#0b1728] px-3 py-3 text-center" />
            ) : null}
            {[
              "Codigo",
              "Nombre de cuenta",
              "Categoria",
              "Naturaleza",
              "Nivel",
              "Tipo",
              "Cuenta padre",
              "Estado",
              "Origen",
              "Acciones",
            ].map((heading) => (
              <th
                className="border-r border-white/15 bg-[#0b1728] px-3 py-3 text-left last:border-r-0"
                key={heading}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const parent = account.cuenta_padre_id
              ? accountsById.get(account.cuenta_padre_id)
              : null;
            const movementCount = usageByAccountId[account.id] ?? 0;
            const alreadyExists = organizationCodes.has(account.codigo);

            return (
              <tr
                className="border-b border-white/15 odd:bg-white/[0.008] transition hover:bg-cyan-500/[0.035]"
                key={account.id}
              >
                {mode === "maestro" ? (
                  <td className="border-r border-white/15 px-3 py-2 text-center">
                    <input
                      checked={selectedMasterIds.has(account.id)}
                      className="h-4 w-4 accent-cyan-300"
                      onChange={() => onToggleMaster?.(account)}
                      type="checkbox"
                    />
                  </td>
                ) : null}
                <td className="border-r border-white/15 px-3 py-2 font-mono text-cyan-100">
                  {account.codigo}
                </td>
                <td className="border-r border-white/15 px-3 py-2">
                  <div
                    className="truncate font-medium text-white"
                    style={{ paddingLeft: `${Math.max(account.nivel - 1, 0) * 14}px` }}
                  >
                    {account.nombre}
                  </div>
                  {movementCount > 0 ? (
                    <p className="mt-1 text-[11px] text-amber-200/75">
                      {movementCount} movimientos
                    </p>
                  ) : null}
                </td>
                <td className="border-r border-white/15 px-3 py-2 text-slate-300">
                  {categoryLabels[account.categoria]}
                </td>
                <td className="border-r border-white/15 px-3 py-2 text-slate-300">
                  {account.naturaleza}
                </td>
                <td className="border-r border-white/15 px-3 py-2 text-slate-300">
                  {account.nivel}
                </td>
                <td className="border-r border-white/15 px-3 py-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 text-xs text-slate-300">
                    {account.tipo_cuenta === "acumulativa"
                      ? "Acumulativa"
                      : "Detalle"}
                  </span>
                </td>
                <td className="border-r border-white/15 px-3 py-2 text-slate-400">
                  {parent ? `${parent.codigo} ${parent.nombre}` : "Raiz"}
                </td>
                <td className="border-r border-white/15 px-3 py-2">
                  <span
                    className={[
                      "rounded-full border px-2 py-1 text-xs font-semibold",
                      account.activa
                        ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100"
                        : "border-slate-400/20 bg-white/[0.025] text-slate-400",
                    ].join(" ")}
                  >
                    {account.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="border-r border-white/15 px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 text-xs text-cyan-100">
                      {accountOrigin(account)}
                    </span>
                    {isRequired(account) ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1 text-xs text-amber-100">
                        Obligatoria
                      </span>
                    ) : isRecommended(account) ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.025] px-2 py-1 text-xs text-slate-300">
                        Recomendada
                      </span>
                    ) : null}
                    {mode === "maestro" && alreadyExists ? (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2 py-1 text-xs text-emerald-100">
                        Ya existe
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="border-r border-white/15 px-3 py-2">
                  {(mode === "cliente" && canEdit) ||
                  (mode === "maestro" && canEditMaster) ? (
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/30"
                        onClick={() => onEdit(account.id)}
                        type="button"
                      >
                        Editar
                      </button>
                      {account.tipo_cuenta === "acumulativa" ? (
                        <button
                          className="rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
                          onClick={() => onNewChild(account.id)}
                          type="button"
                        >
                          Hija
                        </button>
                      ) : null}
                      <ToggleAccountForm
                        account={account}
                        scope={mode === "maestro" ? "master" : "client"}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Solo lectura</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {accounts.length === 0 ? (
        <div className="border-t border-white/15 px-5 py-12 text-center">
          <p className="font-semibold text-white">No hay cuentas para este filtro.</p>
          <p className="mt-2 text-sm text-slate-500">
            Ajusta la busqueda o cambia los filtros superiores.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AccountEditorPanel({
  account,
  canEdit,
  defaultParentId,
  hasMovements,
  onClose,
  parentOptions,
  scope,
}: {
  account: CuentaContable | null;
  canEdit: boolean;
  defaultParentId: string | null;
  hasMovements: boolean;
  onClose: () => void;
  parentOptions: CuentaContable[];
  scope: "client" | "master";
}) {
  const isNew = !account;

  return (
    <div className="fixed inset-0 z-[9100] flex justify-end bg-slate-950/35 backdrop-blur-[1px]">
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-white/20 bg-[#06101f]/98 shadow-2xl shadow-cyan-950/30">
        <header className="border-b border-white/15 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                Cuenta contable
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {isNew ? "Nueva cuenta" : "Editar cuenta"}
              </h3>
              {hasMovements ? (
                <p className="mt-2 text-sm leading-6 text-amber-100/75">
                  Esta cuenta tiene movimientos. OM7 bloquea cambios criticos de
                  estructura y permite nombre, notas o estado.
                </p>
              ) : null}
            </div>
            <button
              className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              onClick={onClose}
              type="button"
            >
              Cerrar
            </button>
          </div>
        </header>

        <form action={saveCuentaContableAction} className="min-h-0 flex-1 overflow-y-auto">
          <input name="catalogScope" type="hidden" value={scope} />
          {account ? <input name="accountId" type="hidden" value={account.id} /> : null}
          <fieldset
            className="grid gap-4 p-5"
            disabled={!canEdit}
          >
            <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Codigo
                </span>
                <input
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 font-mono text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
                  defaultValue={account?.codigo ?? ""}
                  name="codigo"
                  required
                  readOnly={hasMovements}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Nombre
                </span>
                <input
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
                  defaultValue={account?.nombre ?? ""}
                  name="nombre"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Categoria
                </span>
                <SelectField
                  defaultValue={account?.categoria ?? "activo"}
                  name="categoria"
                  options={categories.map((category) => ({
                    label: categoryLabels[category],
                    value: category,
                  }))}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Naturaleza
                </span>
                <SelectField
                  defaultValue={account?.naturaleza ?? "deudora"}
                  name="naturaleza"
                  options={natureOptions}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Nivel
                </span>
                <input
                  className="h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
                  defaultValue={account?.nivel ?? 1}
                  min={1}
                  name="nivel"
                  readOnly={hasMovements}
                  required
                  type="number"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Estado financiero
                </span>
                <SelectField
                  defaultValue={account?.tipo_estado ?? "BG"}
                  name="tipoEstado"
                  options={[
                    { label: "BG", value: "BG" },
                    { label: "ER", value: "ER" },
                  ]}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Tipo
                </span>
                <SelectField
                  defaultValue={account?.tipo_cuenta ?? "detalle"}
                  name="tipoCuenta"
                  options={typeOptions}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Cuenta padre
              </span>
              <select
                className="h-10 rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
                defaultValue={account?.cuenta_padre_id ?? defaultParentId ?? ""}
                name="cuentaPadreId"
              >
                <option className="bg-slate-950" value="">
                  Sin cuenta padre
                </option>
                {parentOptions.map((parent) => (
                  <option className="bg-slate-950" key={parent.id} value={parent.id}>
                    {parent.codigo} - {parent.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 rounded-2xl border border-white/15 bg-white/[0.025] p-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={account?.activa ?? true}
                  name="activa"
                  type="checkbox"
                />
                Activa
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={account?.permite_movimientos ?? true}
                  name="permiteMovimientos"
                  type="checkbox"
                />
                Permite movimientos
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={account?.centro_costo_requerido ?? false}
                  name="centroCostoRequerido"
                  type="checkbox"
                />
                Centro costo
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/15 bg-white/[0.025] p-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={account ? isRequired(account) : false}
                  name="isRequired"
                  type="checkbox"
                />
                Obligatoria
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  className="h-4 w-4 accent-cyan-300"
                  defaultChecked={account ? isRecommended(account) : false}
                  name="isRecommended"
                  type="checkbox"
                />
                Recomendada
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Notas / descripcion
              </span>
              <textarea
                className="min-h-28 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-500/20"
                defaultValue={accountDescription(account)}
                name="descripcion"
                placeholder="Uso operativo de la cuenta, reglas internas o notas del cliente."
              />
            </label>
          </fieldset>

          <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-white/15 bg-[#06101f]/98 px-5 py-4">
            {account ? (
              <button
                className="rounded-xl border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-amber-300/30 hover:text-amber-100"
                disabled={!canEdit}
                formAction={toggleCuentaContableAction}
                name="nextActiva"
                type="submit"
                value={account.activa ? "false" : "true"}
              >
                {account.activa ? "Desactivar" : "Activar"}
              </button>
            ) : null}
            <button
              className="om7-btn-ghost px-4 py-2.5"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="om7-btn-primary px-4 py-2.5" disabled={!canEdit} type="submit">
              Guardar cuenta
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
