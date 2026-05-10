import { updateExtractionDataAction } from "@/app/(platform)/documentos/actions";
import type { ExtractionSummaryData } from "@/components/documents/extraction-summary";
import { normalizeCurrencyCode } from "@/lib/currency";

type ExtractionReviewFormProps = {
  extractionId: string;
  extractedData: unknown;
  redirectTo: string;
};

type LineItem = Record<string, unknown>;

function toExtractionData(value: unknown): ExtractionSummaryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as ExtractionSummaryData;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function dateValue(value: unknown) {
  return textValue(value).split("T")[0];
}

function getLineValue(line: LineItem, key: string) {
  return line[key] === null || line[key] === undefined ? "" : String(line[key]);
}

function getWarnings(data: ExtractionSummaryData) {
  const warnings: string[] = [];
  const supplierName = data.emisor_nombre ?? data.supplier_name;
  const date = data.fecha_emision ?? data.date;
  const subtotal = Number(data.subtotal ?? 0);
  const tax = Number(data.impuesto ?? data.tax ?? 0);
  const total = Number(data.total ?? 0);

  if (!date) {
    warnings.push("Falta la fecha antes de crear el registro.");
  }

  if (!total) {
    warnings.push("Falta el total antes de crear el registro.");
  }

  if (!supplierName) {
    warnings.push("Proveedor o emisor recomendado para una revision completa.");
  }

  if (
    total &&
    Number.isFinite(subtotal) &&
    Number.isFinite(tax) &&
    Math.abs(subtotal + tax - total) > 1
  ) {
    warnings.push(
      "Subtotal + impuesto no coincide con el total. Puede guardar y continuar si el documento lo justifica.",
    );
  }

  return warnings;
}

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10";
const textareaClass =
  "mt-2 min-h-24 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10";

export function ExtractionReviewForm({
  extractionId,
  extractedData,
  redirectTo,
}: ExtractionReviewFormProps) {
  const data = toExtractionData(extractedData);
  const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
  const warnings = getWarnings(data);

  return (
    <form action={updateExtractionDataAction} className="space-y-5">
      <input name="extractionId" type="hidden" value={extractionId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />

      {warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-sm font-medium text-amber-100">
            Validacion previa
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-white">Resumen editable</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Tipo de documento
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(data.document_kind)}
              name="documentKind"
              placeholder="Factura, tiquete, nota..."
            />
          </label>

          <label className="block xl:col-span-2">
            <span className="text-xs font-medium text-slate-400">Clave</span>
            <input
              className={inputClass}
              defaultValue={textValue(data.clave)}
              name="clave"
              placeholder="Clave fiscal o referencia"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Proveedor / emisor
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(data.emisor_nombre ?? data.supplier_name)}
              name="supplierName"
              placeholder="Nombre del proveedor"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Cedula emisor
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(data.emisor_cedula ?? data.supplier_tax_id)}
              name="supplierTaxId"
              placeholder="Cedula o identificacion"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Numero documento
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(
                data.numero_consecutivo ?? data.document_number,
              )}
              name="documentNumber"
              placeholder="Consecutivo"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Receptor
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(data.receptor_nombre ?? data.customer_name)}
              name="customerName"
              placeholder="Nombre receptor"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Cedula receptor
            </span>
            <input
              className={inputClass}
              defaultValue={textValue(data.receptor_cedula ?? data.customer_tax_id)}
              name="customerTaxId"
              placeholder="Cedula receptor"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Fecha emision
            </span>
            <input
              className={inputClass}
              defaultValue={dateValue(data.fecha_emision ?? data.date)}
              name="date"
              type="date"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-400">Moneda</span>
            <input
              className={inputClass}
              defaultValue={normalizeCurrencyCode(data.moneda ?? data.currency)}
              name="currency"
              placeholder="CRC"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <p className="text-sm font-medium text-white">Totales editables</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Subtotal
            </span>
            <input
              className={inputClass}
              defaultValue={numberValue(data.subtotal)}
              name="subtotal"
              step="0.01"
              type="number"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Impuesto
            </span>
            <input
              className={inputClass}
              defaultValue={numberValue(data.impuesto ?? data.tax)}
              name="tax"
              step="0.01"
              type="number"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">Total</span>
            <input
              className={inputClass}
              defaultValue={numberValue(data.total)}
              name="total"
              step="0.01"
              type="number"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-white">Lineas editables</p>
        {lineItems.length > 0 ? (
          <div className="mt-4 space-y-3">
            {lineItems.map((line, index) => (
              <div
                className="grid gap-3 rounded-xl border border-white/[0.08] bg-black/15 p-3 md:grid-cols-6"
                key={`${getLineValue(line, "detalle")}-${index}`}
              >
                <label className="block md:col-span-2">
                  <span className="text-xs text-slate-500">Detalle</span>
                  <input
                    className={inputClass}
                    defaultValue={getLineValue(line, "detalle")}
                    name={`lineItems[${index}][detalle]`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Cantidad</span>
                  <input
                    className={inputClass}
                    defaultValue={getLineValue(line, "cantidad")}
                    name={`lineItems[${index}][cantidad]`}
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">
                    Precio unitario
                  </span>
                  <input
                    className={inputClass}
                    defaultValue={getLineValue(line, "precio_unitario")}
                    name={`lineItems[${index}][precio_unitario]`}
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Impuesto</span>
                  <input
                    className={inputClass}
                    defaultValue={getLineValue(line, "impuesto")}
                    name={`lineItems[${index}][impuesto]`}
                    step="0.01"
                    type="number"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Total linea</span>
                  <input
                    className={inputClass}
                    defaultValue={getLineValue(line, "total_linea")}
                    name={`lineItems[${index}][total_linea]`}
                    step="0.01"
                    type="number"
                  />
                </label>
                <input
                  name={`lineItems[${index}][unidad]`}
                  type="hidden"
                  value={getLineValue(line, "unidad")}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-white/[0.08] bg-black/15 px-3 py-4 text-sm text-slate-500">
            Este documento no tiene lineas detectadas para corregir.
          </p>
        )}
      </section>

      <label className="block">
        <span className="text-sm font-medium text-slate-300">Notas</span>
        <textarea
          className={textareaClass}
          defaultValue={textValue(data.notes)}
          name="notes"
          placeholder="Notas internas para la compra o factura que se creara..."
        />
      </label>

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white"
        type="submit"
      >
        Guardar correcciones
      </button>
    </form>
  );
}
