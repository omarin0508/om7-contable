"use client";

import { useMemo, useState } from "react";

type AccountingAmountCalculatorProps = {
  subtotal: number | null | undefined;
  tax: number | null | undefined;
  taxFieldName: "impuesto" | "tax";
  total: number | null | undefined;
  taxName: string;
};

function normalizeAmount(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function toAmount(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEditableAmount(value: number) {
  return Number(value.toFixed(2)).toString();
}

export function AccountingAmountCalculator({
  subtotal,
  tax,
  taxFieldName,
  taxName,
  total,
}: AccountingAmountCalculatorProps) {
  const [subtotalValue, setSubtotalValue] = useState(
    formatEditableAmount(normalizeAmount(subtotal)),
  );
  const [taxValue, setTaxValue] = useState(formatEditableAmount(normalizeAmount(tax)));
  const [totalValue, setTotalValue] = useState(
    formatEditableAmount(normalizeAmount(total)),
  );

  const difference = useMemo(() => {
    const computed = toAmount(subtotalValue) + toAmount(taxValue);
    return Number((computed - toAmount(totalValue)).toFixed(2));
  }, [subtotalValue, taxValue, totalValue]);

  function syncTotal(nextSubtotal = subtotalValue, nextTax = taxValue) {
    setTotalValue(formatEditableAmount(toAmount(nextSubtotal) + toAmount(nextTax)));
  }

  function applyTaxRate(rate: number) {
    const nextTax = formatEditableAmount(toAmount(subtotalValue) * rate);
    setTaxValue(nextTax);
    syncTotal(subtotalValue, nextTax);
  }

  return (
    <>
      <label className="block">
        <span className="text-xs text-slate-300">Subtotal</span>
        <input
          className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
          name="subtotal"
          onBlur={() => syncTotal()}
          onChange={(event) => setSubtotalValue(event.target.value)}
          step="0.01"
          type="number"
          value={subtotalValue}
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-300">{taxName}</span>
        <input
          className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
          name={taxFieldName}
          onBlur={() => syncTotal()}
          onChange={(event) => setTaxValue(event.target.value)}
          step="0.01"
          type="number"
          value={taxValue}
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-300">Total</span>
        <input
          className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-4 focus:ring-cyan-300/10"
          name="total"
          onChange={(event) => setTotalValue(event.target.value)}
          step="0.01"
          type="number"
          value={totalValue}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-3">
        <button
          className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
          onClick={() => applyTaxRate(0.13)}
          type="button"
        >
          IVA 13%
        </button>
        <button
          className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-100"
          onClick={() => {
            setTaxValue("0");
            syncTotal(subtotalValue, "0");
          }}
          type="button"
        >
          Sin IVA
        </button>
        <span
          className={`text-xs ${
            Math.abs(difference) < 0.01 ? "text-emerald-100/75" : "text-amber-100/80"
          }`}
        >
          {Math.abs(difference) < 0.01
            ? "Montos cuadran"
            : `Diferencia subtotal + impuesto: ${formatEditableAmount(difference)}`}
        </span>
      </div>
    </>
  );
}
