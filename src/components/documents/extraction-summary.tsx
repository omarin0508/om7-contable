import { normalizeCurrencyCode } from "@/lib/currency";

type ExtractionLineItem = Record<string, unknown>;

export type ExtractionSummaryData = {
  document_kind?: unknown;
  clave?: unknown;
  numero_consecutivo?: unknown;
  fecha_emision?: unknown;
  emisor_nombre?: unknown;
  emisor_cedula?: unknown;
  receptor_nombre?: unknown;
  receptor_cedula?: unknown;
  moneda?: unknown;
  subtotal?: unknown;
  impuesto?: unknown;
  tax?: unknown;
  total?: unknown;
  notes?: unknown;
  supplier_name?: unknown;
  supplier_tax_id?: unknown;
  customer_name?: unknown;
  customer_tax_id?: unknown;
  document_number?: unknown;
  date?: unknown;
  currency?: unknown;
  line_items?: ExtractionLineItem[];
};

type ExtractionSummaryProps = {
  extractedData: unknown;
  showTechnicalJson?: boolean;
};

type SummaryField = [label: string, value: unknown];

function toExtractionData(value: unknown): ExtractionSummaryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as ExtractionSummaryData;
}

function displayValue(value: unknown, fallback = "No disponible") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function displayMoney(value: unknown, currency: unknown) {
  const amount = Number(value ?? 0);
  const currencyCode = normalizeCurrencyCode(currency);

  if (!Number.isFinite(amount)) {
    return displayValue(value);
  }

  return `${currencyCode} ${amount.toLocaleString("es-CR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function getLineValue(line: ExtractionLineItem, key: string) {
  return displayValue(line[key], "-");
}

function getLineTaxRate(line: ExtractionLineItem) {
  return displayValue(
    line.tarifa_iva ?? line.tax_rate ?? line.rate ?? line.tarifa ?? line.porcentaje_iva,
    "-",
  );
}

export function getExtractionReference(extractedData: unknown) {
  const data = toExtractionData(extractedData);

  return displayValue(data.clave || data.numero_consecutivo, "");
}

export function ExtractionSummary({
  extractedData,
  showTechnicalJson = true,
}: ExtractionSummaryProps) {
  const data = toExtractionData(extractedData);
  const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
  const fields: SummaryField[] = [
    ["Tipo de documento", data.document_kind],
    ["Clave", data.clave],
    ["Consecutivo", data.numero_consecutivo ?? data.document_number],
    ["Fecha emision", data.fecha_emision ?? data.date],
    ["Emisor", data.emisor_nombre ?? data.supplier_name],
    ["Cedula emisor", data.emisor_cedula ?? data.supplier_tax_id],
    ["Receptor", data.receptor_nombre ?? data.customer_name],
    ["Cedula receptor", data.receptor_cedula ?? data.customer_tax_id],
    ["Moneda", data.moneda ?? data.currency],
  ];
  const totals: SummaryField[] = [
    ["Subtotal", data.subtotal],
    ["Impuesto", data.impuesto ?? data.tax],
    ["Total", data.total],
  ];
  const currency = data.moneda ?? data.currency;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
        <p className="text-sm font-medium text-white">Datos detectados</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(([label, value]) => (
            <div
              className="rounded-xl border border-white/[0.06] bg-black/15 p-3"
              key={label}
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 break-words text-sm font-medium text-slate-100">
                {displayValue(value)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
        <p className="text-sm font-medium text-white">Totales</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {totals.map(([label, value]) => (
            <div
              className="rounded-xl border border-white/[0.06] bg-black/15 p-3"
              key={label}
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold text-cyan-50">
                {displayMoney(value, currency)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-sm font-medium text-white">Lineas del documento</p>
        {lineItems.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {lineItems.map((line, index) => (
              <article
                className="rounded-xl border border-white/[0.08] bg-black/15 p-3"
                key={`${getLineValue(line, "detalle")}-${index}`}
              >
                <p className="break-words text-sm font-medium text-slate-100">
                  {getLineValue(line, "detalle")}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  {[
                    ["Cantidad", getLineValue(line, "cantidad")],
                    ["Unidad", getLineValue(line, "unidad")],
                    ["Precio unitario", getLineValue(line, "precio_unitario")],
                    ["Tarifa IVA", getLineTaxRate(line)],
                    ["Impuesto", getLineValue(line, "impuesto")],
                    ["Total linea", getLineValue(line, "total_linea")],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                      key={label}
                    >
                      <p className="text-[11px] text-slate-500">{label}</p>
                      <p className="mt-1 text-xs font-medium text-slate-200">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-white/[0.08] bg-black/15 px-3 py-4 text-sm text-slate-500">
            No se detectaron lineas para este documento.
          </p>
        )}
      </section>

      {showTechnicalJson ? (
        <details className="rounded-2xl border border-white/[0.08] bg-black/15 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-200">
            Ver datos tecnicos
          </summary>
          <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/[0.08] bg-black/25 p-4 text-xs leading-5 text-slate-300">
            {JSON.stringify(extractedData ?? {}, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
