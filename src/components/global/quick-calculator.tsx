"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ToolId = "basic" | "iva" | "margin" | "rule3" | "currency";
type Operation = "add" | "subtract" | "multiply" | "divide";

type CalculatorContext = {
  module: string;
  pathname: string;
};

type ToolDefinition = {
  id: ToolId;
  label: string;
  shortLabel: string;
};

const tools: ToolDefinition[] = [
  { id: "basic", label: "Normal", shortLabel: "Calc" },
  { id: "iva", label: "IVA", shortLabel: "IVA" },
  { id: "margin", label: "Margen", shortLabel: "Margen" },
  { id: "rule3", label: "Regla 3", shortLabel: "R3" },
  { id: "currency", label: "CRC/USD", shortLabel: "FX" },
];

const operationLabels: Record<Operation, string> = {
  add: "+",
  subtract: "-",
  multiply: "x",
  divide: "/",
};

function useCalculatorContext(): CalculatorContext {
  const pathname = usePathname();

  return useMemo(() => {
    const segment = pathname.split("/").filter(Boolean)[0] ?? "inicio";
    const moduleLabels: Record<string, string> = {
      compras: "Compras",
      facturas: "Facturas",
      presupuestos: "Presupuestos",
      documentos: "Documentos",
      planillas: "Planillas",
      periodos: "Periodos",
      tributario: "Tributario",
    };

    return {
      module: moduleLabels[segment] ?? "OM7 Finance OS",
      pathname,
    };
  }, [pathname]);
}

function parseAmount(value: string): number {
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("es-CR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...options,
  }).format(value);
}

function formatCurrency(value: number, currency = "CRC"): string {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: currency === "CRC" ? 0 : 2,
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function NumberField({
  label,
  onChange,
  placeholder,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </span>
      <span className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3 py-2.5 transition focus-within:border-cyan-200/35 focus-within:bg-white/[0.07]">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
        {suffix ? (
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function ResultTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-300/16 bg-cyan-300/[0.07] text-cyan-50"
      : tone === "success"
        ? "border-emerald-300/16 bg-emerald-300/[0.07] text-emerald-50"
        : "border-white/[0.08] bg-white/[0.04] text-white";

  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tracking-normal">
        {value}
      </p>
    </div>
  );
}

function ToolSwitch({
  activeTool,
  onChange,
}: {
  activeTool: ToolId;
  onChange: (tool: ToolId) => void;
}) {
  return (
    <div className="om7-scrollbar flex gap-1.5 overflow-x-auto border-b border-white/[0.08] px-4 pb-3">
      {tools.map((tool) => {
        const isActive = tool.id === activeTool;

        return (
          <button
            className={[
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              isActive
                ? "border-cyan-200/30 bg-cyan-300/12 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.16)]"
                : "border-white/[0.08] bg-white/[0.035] text-slate-400 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white",
            ].join(" ")}
            key={tool.id}
            onClick={() => onChange(tool.id)}
            type="button"
          >
            <span className="sm:hidden">{tool.shortLabel}</span>
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function calculateBasicValue(
  leftValue: number,
  rightValue: number,
  operation: Operation,
) {
  if (operation === "add") return leftValue + rightValue;
  if (operation === "subtract") return leftValue - rightValue;
  if (operation === "multiply") return leftValue * rightValue;
  return rightValue === 0 ? 0 : leftValue / rightValue;
}

function CalculatorKey({
  children,
  onClick,
  tone = "default",
}: {
  children: string;
  onClick: () => void;
  tone?: "default" | "operator" | "accent" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "border-cyan-200/35 bg-cyan-300/16 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.14)]"
      : tone === "operator"
        ? "border-white/[0.12] bg-white/[0.075] text-cyan-50 hover:border-cyan-200/28"
        : tone === "muted"
          ? "border-white/[0.08] bg-white/[0.04] text-slate-300"
          : "border-white/[0.08] bg-white/[0.055] text-white";

  return (
    <button
      className={`h-12 rounded-2xl border text-base font-semibold transition hover:-translate-y-0.5 hover:bg-white/[0.095] active:translate-y-0 ${toneClass}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function BasicCalculator() {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback((digit: string) => {
    setDisplay((current) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return digit;
      }

      return current === "0" ? digit : `${current}${digit}`;
    });
  }, [waitingForOperand]);

  const inputDecimal = useCallback(() => {
    setDisplay((current) => {
      if (waitingForOperand) {
        setWaitingForOperand(false);
        return "0.";
      }

      return current.includes(".") ? current : `${current}.`;
    });
  }, [waitingForOperand]);

  const clearCalculator = useCallback(() => {
    setDisplay("0");
    setStoredValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const deleteLastDigit = useCallback(() => {
    setDisplay((current) =>
      current.length > 1 && !waitingForOperand ? current.slice(0, -1) : "0",
    );
  }, [waitingForOperand]);

  const toggleSign = useCallback(() => {
    setDisplay((current) =>
      current === "0" ? current : String(parseAmount(current) * -1),
    );
  }, []);

  const applyPercent = useCallback(() => {
    setDisplay((current) => String(parseAmount(current) / 100));
  }, []);

  const chooseOperation = useCallback((nextOperation: Operation) => {
    const inputValue = parseAmount(display);

    if (storedValue === null) {
      setStoredValue(inputValue);
    } else if (operation) {
      const result = calculateBasicValue(storedValue, inputValue, operation);
      setStoredValue(result);
      setDisplay(String(result));
    }

    setOperation(nextOperation);
    setWaitingForOperand(true);
  }, [display, operation, storedValue]);

  const performEquals = useCallback(() => {
    if (storedValue === null || operation === null) return;

    const result = calculateBasicValue(storedValue, parseAmount(display), operation);
    setDisplay(String(result));
    setStoredValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }, [display, operation, storedValue]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        inputDigit(event.key);
        return;
      }

      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        inputDecimal();
        return;
      }

      if (event.key === "+") {
        event.preventDefault();
        chooseOperation("add");
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        chooseOperation("subtract");
        return;
      }

      if (event.key === "*" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        chooseOperation("multiply");
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        chooseOperation("divide");
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        performEquals();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        deleteLastDigit();
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        clearCalculator();
        return;
      }

      if (event.key === "%") {
        event.preventDefault();
        applyPercent();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    applyPercent,
    chooseOperation,
    clearCalculator,
    deleteLastDigit,
    inputDecimal,
    inputDigit,
    performEquals,
  ]);

  const expressionLabel =
    storedValue !== null && operation
      ? `${formatAmount(storedValue)} ${operationLabels[operation]}`
      : "Listo para calcular";

  return (
    <div className="grid gap-3">
      <div className="rounded-3xl border border-white/[0.1] bg-black/35 p-4 shadow-inner shadow-black/30">
        <p className="truncate text-right text-xs font-semibold uppercase text-slate-500">
          {expressionLabel}
        </p>
        <p className="mt-2 min-h-10 truncate text-right text-4xl font-semibold tracking-normal text-white">
          {formatAmount(parseAmount(display), { maximumFractionDigits: 8 })}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <CalculatorKey onClick={clearCalculator} tone="muted">
          C
        </CalculatorKey>
        <CalculatorKey onClick={toggleSign} tone="muted">
          +/-
        </CalculatorKey>
        <CalculatorKey onClick={applyPercent} tone="muted">
          %
        </CalculatorKey>
        <CalculatorKey onClick={() => chooseOperation("divide")} tone="operator">
          /
        </CalculatorKey>

        {["7", "8", "9"].map((digit) => (
          <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>
            {digit}
          </CalculatorKey>
        ))}
        <CalculatorKey onClick={() => chooseOperation("multiply")} tone="operator">
          x
        </CalculatorKey>

        {["4", "5", "6"].map((digit) => (
          <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>
            {digit}
          </CalculatorKey>
        ))}
        <CalculatorKey onClick={() => chooseOperation("subtract")} tone="operator">
          -
        </CalculatorKey>

        {["1", "2", "3"].map((digit) => (
          <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>
            {digit}
          </CalculatorKey>
        ))}
        <CalculatorKey onClick={() => chooseOperation("add")} tone="operator">
          +
        </CalculatorKey>

        <CalculatorKey onClick={deleteLastDigit} tone="muted">
          DEL
        </CalculatorKey>
        <CalculatorKey onClick={() => inputDigit("0")}>0</CalculatorKey>
        <CalculatorKey onClick={inputDecimal}>.</CalculatorKey>
        <CalculatorKey onClick={performEquals} tone="accent">
          =
        </CalculatorKey>
      </div>
    </div>
  );
}

function IvaCalculator() {
  const [amount, setAmount] = useState("100000");
  const [rate, setRate] = useState("13");
  const [mode, setMode] = useState<"add" | "extract">("add");

  const values = useMemo(() => {
    const base = parseAmount(amount);
    const taxRate = parseAmount(rate) / 100;

    if (mode === "extract") {
      const subtotal = taxRate > 0 ? base / (1 + taxRate) : base;
      const tax = base - subtotal;
      return { subtotal, tax, total: base };
    }

    const tax = base * taxRate;
    return { subtotal: base, tax, total: base + tax };
  }, [amount, mode, rate]);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <NumberField label="Monto" onChange={setAmount} value={amount} />
        <NumberField label="IVA" onChange={setRate} suffix="%" value={rate} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["add", "Agregar IVA"],
          ["extract", "Extraer IVA"],
        ].map(([id, label]) => (
          <button
            className={[
              "h-10 rounded-2xl border text-xs font-semibold transition",
              mode === id
                ? "border-cyan-200/30 bg-cyan-300/12 text-cyan-50"
                : "border-white/[0.08] bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]",
            ].join(" ")}
            key={id}
            onClick={() => setMode(id as "add" | "extract")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ResultTile label="Subtotal" value={formatCurrency(values.subtotal)} />
        <ResultTile label="IVA" tone="accent" value={formatCurrency(values.tax)} />
        <ResultTile label="Total" tone="success" value={formatCurrency(values.total)} />
      </div>
    </div>
  );
}

function MarginCalculator() {
  const [cost, setCost] = useState("75000");
  const [price, setPrice] = useState("100000");

  const values = useMemo(() => {
    const costValue = parseAmount(cost);
    const priceValue = parseAmount(price);
    const profit = priceValue - costValue;
    const margin = priceValue > 0 ? (profit / priceValue) * 100 : 0;
    const markup = costValue > 0 ? (profit / costValue) * 100 : 0;

    return { margin, markup, profit };
  }, [cost, price]);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Costo" onChange={setCost} value={cost} />
        <NumberField label="Venta" onChange={setPrice} value={price} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ResultTile label="Utilidad" tone="success" value={formatCurrency(values.profit)} />
        <ResultTile label="Margen" tone="accent" value={`${formatAmount(values.margin)}%`} />
        <ResultTile label="Markup" value={`${formatAmount(values.markup)}%`} />
      </div>
    </div>
  );
}

function RuleOfThreeCalculator() {
  const [a, setA] = useState("100");
  const [b, setB] = useState("13");
  const [c, setC] = useState("250");

  const result = useMemo(() => {
    const first = parseAmount(a);
    return first === 0 ? 0 : (parseAmount(b) * parseAmount(c)) / first;
  }, [a, b, c]);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="A" onChange={setA} value={a} />
        <NumberField label="B" onChange={setB} value={b} />
        <NumberField label="C" onChange={setC} value={c} />
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Si A equivale a B, C equivale al resultado.
      </p>
      <ResultTile label="Resultado" tone="accent" value={formatAmount(result)} />
    </div>
  );
}

function CurrencyCalculator() {
  const [amount, setAmount] = useState("100000");
  const [rate, setRate] = useState("520");
  const [direction, setDirection] = useState<"crc-usd" | "usd-crc">("crc-usd");

  const result = useMemo(() => {
    const value = parseAmount(amount);
    const exchangeRate = parseAmount(rate);

    if (exchangeRate === 0) return 0;
    return direction === "crc-usd" ? value / exchangeRate : value * exchangeRate;
  }, [amount, direction, rate]);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <NumberField label="Monto" onChange={setAmount} value={amount} />
        <NumberField label="TC" onChange={setRate} value={rate} />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["crc-usd", "CRC a USD"],
          ["usd-crc", "USD a CRC"],
        ].map(([id, label]) => (
          <button
            className={[
              "h-10 rounded-2xl border text-xs font-semibold transition",
              direction === id
                ? "border-cyan-200/30 bg-cyan-300/12 text-cyan-50"
                : "border-white/[0.08] bg-white/[0.035] text-slate-300 hover:bg-white/[0.07]",
            ].join(" ")}
            key={id}
            onClick={() => setDirection(id as "crc-usd" | "usd-crc")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <ResultTile
        label="Convertido"
        tone="accent"
        value={formatCurrency(result, direction === "crc-usd" ? "USD" : "CRC")}
      />
    </div>
  );
}

function ActiveTool({ activeTool }: { activeTool: ToolId }) {
  if (activeTool === "iva") return <IvaCalculator />;
  if (activeTool === "margin") return <MarginCalculator />;
  if (activeTool === "rule3") return <RuleOfThreeCalculator />;
  if (activeTool === "currency") return <CurrencyCalculator />;
  return <BasicCalculator />;
}

export function QuickCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("basic");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const calculatorContext = useCalculatorContext();

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className="fixed bottom-28 right-4 z-[10000] sm:right-6 lg:bottom-24 lg:right-8"
      ref={rootRef}
    >
      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-[2px]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              transition={{ duration: 0.16 }}
            />
            <motion.aside
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-[10000] mb-3 w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-[1.75rem] border border-cyan-100/18 bg-[#03050a]/98 shadow-[0_28px_90px_rgba(0,0,0,0.72),0_0_34px_rgba(34,211,238,0.12)] backdrop-blur-2xl"
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="border-b border-white/[0.1] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.24),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/75">
                      Quick Calculator
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      Calculadora OM7
                    </h2>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      Contexto listo para {calculatorContext.module}
                    </p>
                  </div>
                  <button
                    aria-label="Cerrar calculadora rapida"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-white/[0.06] text-sm text-slate-300 transition hover:bg-white/[0.11] hover:text-white"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <ToolSwitch activeTool={activeTool} onChange={setActiveTool} />
                <div className="om7-scrollbar max-h-[62vh] overflow-y-auto p-4">
                  <ActiveTool activeTool={activeTool} />
                  <div className="mt-3 rounded-2xl border border-cyan-100/10 bg-cyan-300/[0.045] px-3 py-2.5">
                    <p className="text-xs leading-5 text-slate-300">
                      Preparada para acciones contextuales futuras por modulo:
                      compras, facturas, presupuestos y centros de costo.
                    </p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <motion.button
        aria-expanded={isOpen}
        aria-label="Abrir calculadora rapida OM7"
        className="group flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.12] bg-[#05070d]/88 text-sm font-semibold text-white shadow-2xl shadow-cyan-950/35 backdrop-blur-2xl transition hover:border-cyan-200/35 hover:bg-white/[0.08] hover:shadow-cyan-500/15"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/12 text-lg text-cyan-50 transition group-hover:bg-cyan-300/18">
          %
        </span>
      </motion.button>
    </div>
  );
}
