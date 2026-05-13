"use client";

import { useMemo, useState } from "react";
import type {
  CuentaContableCategoria,
  CuentaContableNode,
} from "@/lib/cuentas-contables";

type CatalogoFilter = "all" | "BG" | "ER" | CuentaContableCategoria;

const categoryLabels: Record<CuentaContableCategoria, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  costo: "Costo",
  gasto: "Gasto",
};

const filterOptions: Array<{ label: string; value: CatalogoFilter }> = [
  { label: "Todo", value: "all" },
  { label: "BG", value: "BG" },
  { label: "ER", value: "ER" },
  { label: "Activo", value: "activo" },
  { label: "Pasivo", value: "pasivo" },
  { label: "Patrimonio", value: "patrimonio" },
  { label: "Ingreso", value: "ingreso" },
  { label: "Costo", value: "costo" },
  { label: "Gasto", value: "gasto" },
];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesFilter(node: CuentaContableNode, filter: CatalogoFilter) {
  if (filter === "all") {
    return true;
  }

  return node.tipo_estado === filter || node.categoria === filter;
}

function filterTree(
  nodes: CuentaContableNode[],
  query: string,
  filter: CatalogoFilter,
): CuentaContableNode[] {
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, query, filter);
    const searchable = normalizeSearch(`${node.codigo} ${node.nombre}`);
    const queryMatches = query.length === 0 || searchable.includes(query);
    const ownMatches = queryMatches && matchesFilter(node, filter);

    if (ownMatches || children.length > 0) {
      return [{ ...node, children }];
    }

    return [];
  });
}

function getInitialExpandedIds(nodes: CuentaContableNode[]) {
  const ids = new Set<string>();

  const visit = (node: CuentaContableNode) => {
    if (node.nivel <= 2 || node.children.length > 0) {
      ids.add(node.id);
    }

    node.children.forEach(visit);
  };

  nodes.forEach(visit);

  return ids;
}

function CuentaNode({
  expandedIds,
  node,
  toggleNode,
}: {
  expandedIds: Set<string>;
  node: CuentaContableNode;
  toggleNode: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const movementLabel = node.permite_movimientos ? "Movimiento" : "Sin mov.";

  return (
    <div className="min-w-0">
      <div
        className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3 transition hover:border-cyan-200/20 hover:bg-white/[0.045]"
        style={{ marginLeft: `${Math.max(node.nivel - 1, 0) * 14}px` }}
      >
        <button
          aria-label={isExpanded ? "Colapsar cuenta" : "Expandir cuenta"}
          className={[
            "mt-0.5 grid h-8 w-8 place-items-center rounded-xl border text-sm transition",
            hasChildren
              ? "border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
              : "border-white/[0.07] bg-white/[0.035] text-slate-600",
          ].join(" ")}
          disabled={!hasChildren}
          onClick={() => toggleNode(node.id)}
          type="button"
        >
          {hasChildren ? (isExpanded ? "-" : "+") : ""}
        </button>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-white">
                <span className="font-mono text-cyan-100">{node.codigo}</span>{" "}
                {node.nombre}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Nivel {node.nivel} - naturaleza {node.naturaleza}
                {node.moneda ? ` - ${node.moneda}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="om7-chip om7-chip-cyan">{node.tipo_estado}</span>
              <span className="om7-chip">{categoryLabels[node.categoria]}</span>
              <span className="om7-chip om7-chip-amber">{node.tipo_cuenta}</span>
              <span className="om7-chip om7-chip-emerald">{movementLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <CuentaNode
              expandedIds={expandedIds}
              key={child.id}
              node={child}
              toggleNode={toggleNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CuentasContablesTree({
  accountsCount,
  tree,
}: {
  accountsCount: number;
  tree: CuentaContableNode[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogoFilter>("all");
  const [expandedIds, setExpandedIds] = useState(() => getInitialExpandedIds(tree));
  const normalizedQuery = normalizeSearch(query);
  const visibleTree = useMemo(
    () => filterTree(tree, normalizedQuery, filter),
    [filter, normalizedQuery, tree],
  );

  const toggleNode = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  return (
    <div className="min-w-0">
      <div className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-base font-semibold text-white">Arbol contable</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Jerarquia oficial importada desde el Excel base. Las cuentas de
              detalle son las unicas que permiten movimientos.
            </p>
          </div>
          <span className="om7-chip om7-chip-cyan self-start xl:self-auto">
            {accountsCount} cuentas
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="sr-only">Buscar cuenta</span>
            <input
              className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-200/30 focus:bg-black/25"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por codigo o nombre..."
              type="search"
              value={query}
            />
          </label>
          <div className="om7-no-scrollbar flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1">
            {filterOptions.map((option) => (
              <button
                className={[
                  "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  filter === option.value
                    ? "bg-cyan-300/15 text-cyan-100"
                    : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200",
                ].join(" ")}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3 sm:p-5">
        {visibleTree.length > 0 ? (
          visibleTree.map((node) => (
            <CuentaNode
              expandedIds={expandedIds}
              key={node.id}
              node={node}
              toggleNode={toggleNode}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-white/[0.12] bg-white/[0.025] p-10 text-center">
            <p className="text-base font-semibold text-white">
              No hay cuentas para ese filtro.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ajusta la busqueda o cambia el filtro para volver al catalogo completo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
