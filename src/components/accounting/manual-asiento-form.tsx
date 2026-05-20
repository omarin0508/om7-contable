"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveManualAsientoAction } from "@/app/(platform)/contabilidad/asientos/actions";
import type { AsientoContable } from "@/lib/asientos-contables";
import type { CuentaContable } from "@/lib/cuentas-contables";

type ManualAsientoFormProps = {
  accounts: CuentaContable[];
  asiento?: AsientoContable | null;
  template?: AsientoContable | null;
  disabled?: boolean;
};

type FormLine = {
  key: string;
  accountId: string;
  accountSearch: string;
  credit: string;
  debit: string;
  description: string;
};

type SearchOverlay = {
  index: number;
  left: number;
  query: string;
  top: number;
  width: number;
} | null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function accountLabel(account: CuentaContable) {
  return `${account.codigo} - ${account.nombre}`;
}

function parseAmount(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(value: number, currency = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function makeBlankLine(index: number): FormLine {
  return {
    accountId: "",
    accountSearch: "",
    credit: "",
    debit: "",
    description: "",
    key: `line-${Date.now()}-${index}`,
  };
}

function buildInitialLines(
  accountsById: Map<string, CuentaContable>,
  source?: AsientoContable | null,
) {
  const sourceLines = source?.lineas ?? [];
  const lines = sourceLines.map<FormLine>((line, index) => {
    const account = accountsById.get(line.cuenta_contable_id);

    return {
      accountId: line.cuenta_contable_id,
      accountSearch: account ? accountLabel(account) : "",
      credit: Number(line.credito ?? 0) > 0 ? String(line.credito) : "",
      debit: Number(line.debito ?? 0) > 0 ? String(line.debito) : "",
      description: line.descripcion ?? "",
      key: line.id ?? `line-${index}`,
    };
  });

  while (lines.length < 2) {
    lines.push(makeBlankLine(lines.length));
  }

  return lines;
}

export function ManualAsientoForm({
  accounts,
  asiento = null,
  disabled = false,
  template = null,
}: ManualAsientoFormProps) {
  const source = asiento ?? template;
  const isEditing = Boolean(asiento);
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const [currency, setCurrency] = useState(source?.moneda ?? "CRC");
  const [lines, setLines] = useState<FormLine[]>(() =>
    buildInitialLines(accountsById, source),
  );
  const [searchOverlay, setSearchOverlay] = useState<SearchOverlay>(null);
  const searchInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (summary, line) => ({
          credit: summary.credit + parseAmount(line.credit),
          debit: summary.debit + parseAmount(line.debit),
        }),
        { credit: 0, debit: 0 },
      ),
    [lines],
  );
  const difference = totals.debit - totals.credit;
  const validLines = lines.filter(
    (line) =>
      line.accountId &&
      ((parseAmount(line.debit) > 0 && parseAmount(line.credit) === 0) ||
        (parseAmount(line.credit) > 0 && parseAmount(line.debit) === 0)),
  );
  const isBalanced = totals.debit > 0 && Math.abs(difference) <= 0.004;
  const canSave = !disabled && isBalanced && validLines.length >= 2;
  const redirectTo = isEditing
    ? `/contabilidad/asientos/manual/${asiento?.id}`
    : template
      ? `/contabilidad/asientos/manual?templateId=${template.id}`
      : "/contabilidad/asientos/manual";

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  }

  function addLine() {
    setLines((current) => {
      const next = [...current, makeBlankLine(current.length)];
      window.requestAnimationFrame(() => {
        searchInputRefs.current[next.length - 1]?.focus();
      });
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((current) =>
      current.length <= 2
        ? current.map((line, lineIndex) =>
            lineIndex === index ? makeBlankLine(lineIndex) : line,
          )
        : current.filter((_, lineIndex) => lineIndex !== index),
    );
  }

  function filteredAccounts(query: string) {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return accounts.slice(0, 8);
    }

    return accounts
      .filter((account) =>
        [
          account.codigo,
          account.nombre,
          account.categoria,
          account.naturaleza,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 8);
  }

  const visibleSearchAccounts = searchOverlay
    ? filteredAccounts(searchOverlay.query)
    : [];

  function openSearch(index: number, input: HTMLInputElement, query: string) {
    const rect = input.getBoundingClientRect();

    setSearchOverlay({
      index,
      left: rect.left,
      query,
      top: rect.bottom + 6,
      width: rect.width,
    });
  }

  function closeSearchSoon() {
    window.setTimeout(() => setSearchOverlay(null), 120);
  }

  function selectAccount(index: number, account: CuentaContable) {
    updateLine(index, {
      accountId: account.id,
      accountSearch: accountLabel(account),
    });
    setSearchOverlay(null);
  }

  return (
    <form action={saveManualAsientoAction} className="grid gap-4">
      {asiento ? <input name="asientoId" type="hidden" value={asiento.id} /> : null}
      {template ? (
        <input name="templateSourceId" type="hidden" value={template.id} />
      ) : null}
      <input name="redirectTo" type="hidden" value={redirectTo} />

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)_140px]">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Fecha
            </span>
            <input
              className="om7-input"
              defaultValue={asiento?.fecha ?? todayISO()}
              disabled={disabled}
              name="fecha"
              required
              type="date"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Nombre
            </span>
            <input
              className="om7-input"
              defaultValue={
                asiento?.descripcion ??
                (template ? `${template.descripcion} - copia` : "")
              }
              disabled={disabled}
              name="descripcion"
              placeholder="Ajuste manual"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Moneda
            </span>
            <select
              className="om7-input"
              disabled={disabled}
              name="moneda"
              onChange={(event) => setCurrency(event.target.value)}
              value={currency}
            >
              <option className="bg-slate-950" value="CRC">
                CRC
              </option>
              <option className="bg-slate-950" value="USD">
                USD
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035]">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(260px,1.35fr)_minmax(180px,0.95fr)_130px_130px_48px] gap-2 border-b border-white/[0.07] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Cuenta</span>
              <span>Detalle</span>
              <span>Debe</span>
              <span>Haber</span>
              <span />
            </div>

            <div className="grid gap-2 p-3">
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[minmax(260px,1.35fr)_minmax(180px,0.95fr)_130px_130px_48px] gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-2"
                  key={line.key}
                >
                  <div>
                    <input name="lineAccountId" type="hidden" value={line.accountId} />
                    <input
                      className="om7-input w-full"
                      disabled={disabled}
                      onBlur={closeSearchSoon}
                      onChange={(event) => {
                        updateLine(index, {
                          accountId: "",
                          accountSearch: event.target.value,
                        });
                        openSearch(index, event.currentTarget, event.target.value);
                      }}
                      onFocus={(event) =>
                        openSearch(index, event.currentTarget, line.accountSearch)
                      }
                      placeholder="Buscar por codigo o nombre"
                      ref={(element) => {
                        searchInputRefs.current[index] = element;
                      }}
                      value={line.accountSearch}
                    />
                  </div>
                  <input
                    className="om7-input"
                    disabled={disabled}
                    name="lineDescription"
                    onChange={(event) =>
                      updateLine(index, { description: event.target.value })
                    }
                    placeholder="Detalle"
                    value={line.description}
                  />
                  <input
                    className="om7-input text-right"
                    disabled={disabled}
                    inputMode="decimal"
                    name="lineDebit"
                    onChange={(event) =>
                      updateLine(index, {
                        credit: event.target.value ? "" : line.credit,
                        debit: event.target.value,
                      })
                    }
                    placeholder="0.00"
                    value={line.debit}
                  />
                  <input
                    className="om7-input text-right"
                    disabled={disabled}
                    inputMode="decimal"
                    name="lineCredit"
                    onChange={(event) =>
                      updateLine(index, {
                        credit: event.target.value,
                        debit: event.target.value ? "" : line.debit,
                      })
                    }
                    placeholder="0.00"
                    value={line.credit}
                  />
                    <button
                      className="rounded-xl border border-white/[0.08] bg-white/[0.035] text-sm font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                      disabled={disabled}
                      onClick={() => removeLine(index)}
                      type="button"
                    >
                      x
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {!disabled && searchOverlay ? (
          <div
            className="fixed z-[10000] max-h-72 overflow-auto rounded-xl border border-cyan-200/20 bg-slate-950 p-1 shadow-2xl shadow-black/60"
            style={{
              left: searchOverlay.left,
              top: searchOverlay.top,
              width: searchOverlay.width,
            }}
          >
            {visibleSearchAccounts.length > 0 ? (
              visibleSearchAccounts.map((account) => (
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  key={account.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectAccount(searchOverlay.index, account);
                  }}
                  type="button"
                >
                  <span className="font-mono text-cyan-100">{account.codigo}</span>{" "}
                  {account.nombre}
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {account.categoria} · {account.naturaleza}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">
                Sin coincidencias
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-black/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <button
            className="om7-btn-ghost px-4 py-2.5"
            disabled={disabled}
            onClick={addLine}
            type="button"
          >
            Agregar renglon
          </button>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
              <p className="text-xs text-slate-500">Debe</p>
              <p className="mt-1 font-semibold text-white">
                {formatCurrency(totals.debit, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
              <p className="text-xs text-slate-500">Haber</p>
              <p className="mt-1 font-semibold text-white">
                {formatCurrency(totals.credit, currency)}
              </p>
            </div>
            <div
              className={[
                "rounded-xl border px-4 py-3",
                isBalanced
                  ? "border-emerald-300/20 bg-emerald-300/10"
                  : "border-amber-300/20 bg-amber-300/10",
              ].join(" ")}
            >
              <p className="text-xs text-slate-500">Diferencia</p>
              <p className="mt-1 font-semibold text-white">
                {formatCurrency(Math.abs(difference), currency)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {!disabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {canSave
              ? "Partida doble balanceada."
              : "Completa al menos dos lineas y cuadra debe contra haber."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link className="om7-btn-ghost px-4 py-2.5" href="/contabilidad/asientos">
              Cancelar
            </Link>
            <button
              className="om7-btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSave}
              type="submit"
            >
              {isEditing ? "Guardar cambios" : "Guardar asiento"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
