"use client";

import { useEffect, useRef } from "react";

type PurchaseFilterFormProps = {
  activeFilter: string;
  activePeriod: string;
  periodOptions: string[];
  providerFilter: string;
  searchTerm: string;
  supplierOptions: string[];
};

export function PurchaseFilterForm({
  activeFilter,
  activePeriod,
  periodOptions,
  providerFilter,
  searchTerm,
  supplierOptions,
}: PurchaseFilterFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function submitNow() {
    formRef.current?.requestSubmit();
  }

  function submitSoon() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(submitNow, 280);
  }

  return (
    <form
      className="grid flex-1 gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_160px_190px]"
      method="get"
      ref={formRef}
    >
      <input
        className="h-11 min-w-0 rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35"
        defaultValue={searchTerm}
        name="q"
        onChange={submitSoon}
        placeholder="Buscar compra..."
      />
      <select
        className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
        defaultValue={activeFilter}
        name="filter"
        onChange={submitNow}
      >
        <option className="bg-slate-950" value="all">
          Estado: todos
        </option>
        <option className="bg-slate-950" value="accounting_pending">
          Pendientes
        </option>
        <option className="bg-slate-950" value="accounting_approved">
          Aprobadas
        </option>
        <option className="bg-slate-950" value="accounting_observed">
          Observadas
        </option>
        <option className="bg-slate-950" value="review">
          Necesita atencion
        </option>
      </select>
      <select
        className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
        defaultValue={activePeriod}
        name="period"
        onChange={submitNow}
      >
        <option className="bg-slate-950" value="all">
          Periodo: todos
        </option>
        {periodOptions.map((period) => (
          <option className="bg-slate-950" key={period} value={period}>
            {period}
          </option>
        ))}
      </select>
      <select
        className="h-11 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
        defaultValue={providerFilter}
        name="provider"
        onChange={submitNow}
      >
        <option className="bg-slate-950" value="">
          Proveedor: todos
        </option>
        {supplierOptions.map((supplier) => (
          <option className="bg-slate-950" key={supplier} value={supplier}>
            {supplier}
          </option>
        ))}
      </select>
    </form>
  );
}
