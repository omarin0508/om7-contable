"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type DocumentSearchOption = {
  amount: string;
  date: string;
  href: string;
  kind: string;
  origin: string;
  status: string;
  subtitle: string;
  title: string;
};

type DocumentSearchSelectProps = {
  emptyLabel?: string;
  initialQuery?: string;
  options: DocumentSearchOption[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function DocumentSearchSelect({
  emptyLabel = "No hay documentos para estos filtros.",
  initialQuery = "",
  options,
}: DocumentSearchSelectProps) {
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    if (!normalizedQuery) {
      return options.slice(0, 24);
    }

    return options
      .filter((option) =>
        normalize(
          [
            option.title,
            option.subtitle,
            option.date,
            option.amount,
            option.kind,
            option.origin,
            option.status,
          ].join(" "),
        ).includes(normalizedQuery),
      )
      .slice(0, 24);
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.045] p-4">
      <div className="relative" ref={rootRef}>
        <label className="block flex-1">
          <span className="text-sm font-semibold text-white">
            Seleccione un documento
          </span>
          <div className="mt-2 flex h-12 rounded-xl border border-cyan-300/22 bg-black/25 focus-within:border-cyan-300/50">
            <input
              className="min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-slate-500"
              onChange={(event) => {
                setQuery(event.target.value);
                setExpanded(true);
              }}
              onFocus={() => setExpanded(true)}
              placeholder="Buscar o seleccionar documento..."
              value={query}
            />
            {query ? (
              <button
                aria-label="Limpiar busqueda"
                className="grid w-10 place-items-center text-sm font-semibold text-slate-500 transition hover:text-white"
                onClick={() => {
                  setQuery("");
                  setExpanded(true);
                }}
                type="button"
              >
                X
              </button>
            ) : null}
            <button
              aria-label="Abrir selector"
              className="grid w-11 place-items-center border-l border-white/[0.08] text-sm font-semibold text-cyan-100 transition hover:bg-white/[0.05]"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              v
            </button>
          </div>
        </label>

        {expanded ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[22rem] overflow-y-auto rounded-2xl border border-cyan-300/18 bg-[#07111f] p-2 shadow-2xl shadow-black/45 om7-scrollbar">
          <div className="grid gap-2">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <Link
                  className="rounded-xl border border-white/[0.08] bg-black/16 p-3 transition hover:border-cyan-300/28 hover:bg-white/[0.045]"
                  href={option.href}
                  key={option.href}
                  onClick={() => setExpanded(false)}
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="om7-chip">{option.status}</span>
                        <span className="om7-chip text-slate-400">{option.kind}</span>
                        <span className="om7-chip om7-chip-cyan">{option.origin}</span>
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-white">
                        {option.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {option.subtitle}
                      </p>
                    </div>
                    <div className="grid gap-1 text-left text-xs text-slate-400 sm:grid-cols-2 lg:min-w-56 lg:text-right">
                      <span>{option.date}</span>
                      <span className="font-semibold text-slate-100">{option.amount}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-white/[0.1] bg-black/10 px-4 py-8 text-center text-sm text-slate-500">
                {emptyLabel}
              </p>
            )}
          </div>
        </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {options.length} documentos disponibles con los filtros actuales.
      </p>
    </div>
  );
}
