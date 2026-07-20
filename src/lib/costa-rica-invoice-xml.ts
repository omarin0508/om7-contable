import { normalizeCurrencyCode } from "@/lib/currency";

export type CostaRicaInvoiceLineItem = {
  codigo: string;
  detalle: string;
  cantidad: number;
  codigo_tarifa: string;
  unidad: string;
  precio_unitario: number;
  monto_total: number;
  subtotal: number;
  impuesto: number;
  tarifa_iva: number;
  total_linea: number;
};

export type CostaRicaInvoiceXmlData = {
  document_kind: string;
  clave: string;
  numero_consecutivo: string;
  fecha_emision: string;
  emisor_nombre: string;
  emisor_cedula: string;
  receptor_nombre: string;
  receptor_cedula: string;
  moneda: string;
  exchange_rate?: number;
  subtotal: number;
  impuesto: number;
  total: number;
  condicion_venta: string;
  medio_pago: string;
  line_items: CostaRicaInvoiceLineItem[];
};

const DOCUMENT_KIND_BY_TAG: Record<string, string> = {
  FacturaElectronica: "FacturaElectronica",
  TiqueteElectronico: "TiqueteElectronico",
  NotaCreditoElectronica: "NotaCreditoElectronica",
  NotaDebitoElectronica: "NotaDebitoElectronica",
};

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function stripNamespaces(xmlText: string) {
  return xmlText
    .replace(/<\/?[a-zA-Z0-9_-]+:/g, (match) => match.replace(/([</])[^:]+:/, "$1"))
    .replace(/\s+xmlns(:[a-zA-Z0-9_-]+)?="[^"]*"/g, "");
}

function readTag(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : "";
}

function readBlock(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1] ?? "";
}

function readBlocks(xml: string, tagName: string) {
  return Array.from(
    xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "gi")),
  ).map((match) => match[1] ?? "");
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function detectDocumentKind(xml: string) {
  const rootMatch = xml.match(/<([A-Za-z0-9_-]+)(?:\s|>)/);
  const rootName = rootMatch?.[1] ?? "";
  return DOCUMENT_KIND_BY_TAG[rootName] ?? rootName;
}

function readCedula(personBlock: string) {
  const identificacion = readBlock(personBlock, "Identificacion");
  return readTag(identificacion || personBlock, "Numero");
}

function parseLineItem(lineBlock: string): CostaRicaInvoiceLineItem {
  const impuestoBlock = readBlock(lineBlock, "Impuesto");

  return {
    codigo: readTag(lineBlock, "Codigo") || readTag(lineBlock, "CodigoComercial"),
    detalle: readTag(lineBlock, "Detalle"),
    cantidad: toNumber(readTag(lineBlock, "Cantidad")),
    codigo_tarifa: readTag(impuestoBlock, "CodigoTarifa"),
    unidad: readTag(lineBlock, "UnidadMedida"),
    precio_unitario: toNumber(readTag(lineBlock, "PrecioUnitario")),
    monto_total: toNumber(readTag(lineBlock, "MontoTotal")),
    subtotal: toNumber(readTag(lineBlock, "SubTotal")),
    impuesto: toNumber(readTag(impuestoBlock, "Monto")),
    tarifa_iva: toNumber(readTag(impuestoBlock, "Tarifa")),
    total_linea: toNumber(readTag(lineBlock, "MontoTotalLinea")),
  };
}

function readCurrencyData(resumen: string) {
  const currencyBlock =
    readBlock(resumen, "CodigoTipoMoneda") ||
    readBlock(resumen, "Moneda") ||
    resumen;
  const rawCurrency =
    readTag(currencyBlock, "CodigoMoneda") ||
    readTag(resumen, "CodigoMoneda") ||
    readTag(resumen, "CodigoTipoMoneda");
  const exchangeRate = toNumber(
    readTag(currencyBlock, "TipoCambio") || readTag(resumen, "TipoCambio"),
  );

  return {
    exchangeRate,
    moneda: normalizeCurrencyCode(rawCurrency),
  };
}

export function parseCostaRicaInvoiceXml(xmlText: string): CostaRicaInvoiceXmlData {
  const xml = stripNamespaces(xmlText);
  const documentKind = detectDocumentKind(xml);

  if (!DOCUMENT_KIND_BY_TAG[documentKind]) {
    throw new Error("El XML no parece ser un comprobante electronico de Costa Rica soportado.");
  }

  const emisor = readBlock(xml, "Emisor");
  const receptor = readBlock(xml, "Receptor");
  const resumen = readBlock(xml, "ResumenFactura");
  const medioPago = readTag(xml, "MedioPago");
  const lineItems = readBlocks(xml, "LineaDetalle").map(parseLineItem);
  const currencyData = readCurrencyData(resumen);

  return {
    document_kind: documentKind,
    clave: readTag(xml, "Clave"),
    numero_consecutivo: readTag(xml, "NumeroConsecutivo"),
    fecha_emision: readTag(xml, "FechaEmision"),
    emisor_nombre: readTag(emisor, "Nombre"),
    emisor_cedula: readCedula(emisor),
    receptor_nombre: readTag(receptor, "Nombre"),
    receptor_cedula: readCedula(receptor),
    moneda: currencyData.moneda,
    exchange_rate: currencyData.exchangeRate || undefined,
    subtotal:
      toNumber(readTag(resumen, "TotalVentaNeta")) ||
      toNumber(readTag(resumen, "TotalVenta")),
    impuesto: toNumber(readTag(resumen, "TotalImpuesto")),
    total: toNumber(readTag(resumen, "TotalComprobante")),
    condicion_venta: readTag(xml, "CondicionVenta"),
    medio_pago: medioPago,
    line_items: lineItems,
  };
}
