import {
  getAccountingSummaryForPeriod,
  getJournalTotals,
  listJournalEntriesForPeriod,
} from "@/lib/accounting-entries";
import { getPeriodLabel } from "@/lib/accounting-periods";
import { normalizeReviewStatus } from "@/lib/accounting-review-ui";
import { formatCurrencyAmount, normalizeCurrencyCode } from "@/lib/currency";
import { getDocumentHumanStatus } from "@/lib/document-ui";
import { getInvoicesForActiveCompany, type Invoice } from "@/lib/invoices";
import { getMonthlyReport, isDateInPeriod } from "@/lib/monthly-reports";
import { listPurchases, type Purchase } from "@/lib/purchases";
import { listDocumentsByCompany } from "@/lib/storage";

type CellValue = string | number | null | undefined;
type SheetRow = {
  cells: CellValue[];
  height?: number;
  style?: number;
};
type WorkbookSheet = {
  name: string;
  rows: SheetRow[];
};

const textEncoder = new TextEncoder();

function escapeXml(value: CellValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function reviewStatusLabel(value: string | null | undefined) {
  const status = normalizeReviewStatus(value);

  if (status === "approved") return "Aprobado";
  if (status === "reviewed") return "Revisado";
  if (status === "observed") return "Observado";

  return "Pendiente";
}

function journalStatusLabel(value: string | null | undefined) {
  if (value === "posted") return "Contabilizado";
  if (value === "reviewed") return "Revisado";
  if (value === "observed") return "Observado";

  return "Sugerido";
}

function getRecordName(record: Purchase | Invoice) {
  return "supplier_name" in record
    ? record.counterparty?.name ?? record.supplier_name ?? "Sin proveedor"
    : record.counterparty?.name ?? record.proveedor ?? "Sin cliente";
}

function getRecordAmount(record: Purchase | Invoice) {
  return Number(record.total ?? 0);
}

function getRecordDate(record: Purchase | Invoice) {
  return "purchase_date" in record
    ? record.purchase_date ?? record.created_at
    : record.fecha ?? record.created_at;
}

function titleRows(title: string, subtitle: string): SheetRow[] {
  return [
    { cells: [title], height: 28, style: 1 },
    { cells: [subtitle], height: 22, style: 2 },
    { cells: [""], style: 0 },
  ];
}

function section(title: string): SheetRow {
  return { cells: [title], style: 4 };
}

function headers(cells: CellValue[]): SheetRow {
  return { cells, style: 3 };
}

function dataRow(cells: CellValue[]): SheetRow {
  return { cells };
}

function totalRow(cells: CellValue[]): SheetRow {
  return { cells, style: 5 };
}

function statusSummaryLabel(status: string | null | undefined) {
  return reviewStatusLabel(status);
}

function emptyNotice(message: string, columns: string[]): SheetRow[] {
  return [
    headers(columns),
    { cells: [message], style: 6 },
  ];
}

function buildExecutiveSummarySheet({
  accountingSummary,
  activeCompanyName,
  currency,
  generatedAt,
  periodLabel,
  report,
}: {
  accountingSummary: Awaited<ReturnType<typeof getAccountingSummaryForPeriod>>;
  activeCompanyName: string;
  currency: string;
  generatedAt: string;
  periodLabel: string;
  report: ReturnType<typeof getMonthlyReport>;
}): WorkbookSheet {
  return {
    name: "Resumen Ejecutivo",
    rows: [
      ...titleRows(
        "Resumen Ejecutivo OM7",
        "Resumen mensual operativo, documental y contable",
      ),
      section("Datos del reporte"),
      dataRow(["Cliente/empresa", activeCompanyName, "Periodo", periodLabel]),
      dataRow(["Fecha generacion", generatedAt, "Sistema", "OM7 Finance OS"]),
      section("Resumen ejecutivo"),
      totalRow(["Total compras", formatCurrencyAmount(report.totalPurchases, currency), "Total facturas", formatCurrencyAmount(report.totalInvoices, currency)]),
      totalRow(["Balance simple", formatCurrencyAmount(report.balance, currency), "Pendientes", report.pending]),
      totalRow(["Observados", report.observed, "Aprobados", report.approved]),
      totalRow(["Documentos convertidos", report.documents.converted, "Documentos sin convertir", report.documents.unconverted]),
      totalRow(["Documentos recibidos", report.documents.received, "Documentos con error", report.documents.errors]),
      totalRow(["Compras registradas", report.purchaseStatus.reduce((sum, item) => sum + item.count, 0), "Facturas registradas", report.invoiceStatus.reduce((sum, item) => sum + item.count, 0)]),
      section("Compras por estado"),
      headers(["Estado", "Cantidad", "Monto", "Monto formateado"]),
      ...report.purchaseStatus.map((item) =>
        dataRow([
          statusSummaryLabel(item.status),
          item.count,
          item.amount,
          formatCurrencyAmount(item.amount, currency),
        ]),
      ),
      section("Facturas por estado"),
      headers(["Estado", "Cantidad", "Monto", "Monto formateado"]),
      ...report.invoiceStatus.map((item) =>
        dataRow([
          statusSummaryLabel(item.status),
          item.count,
          item.amount,
          formatCurrencyAmount(item.amount, currency),
        ]),
      ),
      section("Compras por categoria"),
      headers(["Categoria", "Cantidad", "Monto", "Monto formateado"]),
      ...(report.purchaseCategories.length > 0
        ? report.purchaseCategories.map((item) =>
            dataRow([
              item.label,
              item.count,
              item.amount,
              formatCurrencyAmount(item.amount, currency),
            ]),
          )
        : [{ cells: ["No hay compras por categoria en este periodo."], style: 6 }]),
      section("Resumen contable"),
      totalRow(["Asientos contabilizados", accountingSummary.posted, "Por contabilizar", accountingSummary.pendingToPost]),
      totalRow(["Total Debe", formatCurrencyAmount(accountingSummary.debit, currency), "Total Haber", formatCurrencyAmount(accountingSummary.credit, currency)]),
      totalRow(["Diferencia", formatCurrencyAmount(accountingSummary.difference, currency), "Estado", accountingSummary.isBalanced ? "Cuadra" : "Diferencia"]),
      section("Observaciones activas"),
      headers(["Tipo", "Contraparte", "Monto", "Nota"]),
      ...(report.observedRecords.length > 0
        ? report.observedRecords.slice(0, 10).map((record) =>
            dataRow([
              "supplier_name" in record ? "Compra" : "Factura",
              getRecordName(record),
              formatCurrencyAmount(getRecordAmount(record), currency),
              record.review_notes ?? "Sin nota registrada",
            ]),
          )
        : [{ cells: ["No hay observaciones activas en este periodo."], style: 6 }]),
    ],
  };
}

function buildPurchasesSheet({
  currency,
  period,
  purchases,
}: {
  currency: string;
  period: { year: number; month: number };
  purchases: Purchase[];
}): WorkbookSheet {
  const columns = [
    "Fecha",
    "Proveedor",
    "Categoria",
    "Subtotal",
    "Impuesto",
    "Total",
    "Estado",
    "Periodo",
    "Origen documental",
    "Observaciones",
  ];
  const periodPurchases = purchases.filter((purchase) =>
    isDateInPeriod(purchase.purchase_date ?? purchase.created_at, period),
  );
  const total = periodPurchases.reduce(
    (sum, purchase) => sum + Number(purchase.total ?? 0),
    0,
  );
  const rows =
    periodPurchases.length > 0
      ? [
          headers(columns),
          ...periodPurchases.map((purchase) =>
            dataRow([
              formatDate(purchase.purchase_date ?? purchase.created_at),
              getRecordName(purchase),
              purchase.category ?? "Sin categoria",
              Number(purchase.subtotal ?? 0),
              Number(purchase.tax ?? 0),
              Number(purchase.total ?? 0),
              reviewStatusLabel(purchase.review_status),
              getPeriodLabel(period.year, period.month),
              purchase.source_document_id ? "Desde documento" : "Manual",
              purchase.review_notes ?? purchase.notes ?? "",
            ]),
          ),
          totalRow(["", "", "Total", "", "", total, "", "", "", ""]),
          totalRow(["", "", "Total formateado", "", "", formatCurrencyAmount(total, currency), "", "", "", ""]),
        ]
      : emptyNotice("No hay compras registradas en este periodo.", columns);

  return {
    name: "Compras",
    rows: [
      ...titleRows("Compras", "Compras del periodo con subtotales"),
      ...rows,
    ],
  };
}

function buildInvoicesSheet({
  currency,
  invoices,
  period,
}: {
  currency: string;
  invoices: Invoice[];
  period: { year: number; month: number };
}): WorkbookSheet {
  const columns = [
    "Fecha",
    "Cliente",
    "Tipo",
    "Subtotal",
    "Impuesto",
    "Total",
    "Estado",
    "Periodo",
    "Origen documental",
    "Observaciones",
  ];
  const periodInvoices = invoices.filter((invoice) =>
    isDateInPeriod(invoice.fecha ?? invoice.created_at, period),
  );
  const total = periodInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total ?? 0),
    0,
  );
  const rows =
    periodInvoices.length > 0
      ? [
          headers(columns),
          ...periodInvoices.map((invoice) =>
            dataRow([
              formatDate(invoice.fecha ?? invoice.created_at),
              getRecordName(invoice),
              invoice.tipo_documento ?? "Factura",
              Number(invoice.subtotal ?? 0),
              Number(invoice.impuesto ?? 0),
              Number(invoice.total ?? 0),
              reviewStatusLabel(invoice.review_status),
              getPeriodLabel(period.year, period.month),
              invoice.source_document_id ? "Desde documento" : "Manual",
              invoice.review_notes ?? invoice.notas ?? "",
            ]),
          ),
          totalRow(["", "", "Total", "", "", total, "", "", "", ""]),
          totalRow(["", "", "Total formateado", "", "", formatCurrencyAmount(total, currency), "", "", "", ""]),
        ]
      : emptyNotice("No hay facturas registradas en este periodo.", columns);

  return {
    name: "Facturas",
    rows: [
      ...titleRows("Facturas", "Facturas e ingresos del periodo"),
      ...rows,
    ],
  };
}

function buildObservationsSheet({
  invoices,
  period,
  purchases,
}: {
  invoices: Invoice[];
  period: { year: number; month: number };
  purchases: Purchase[];
}): WorkbookSheet {
  const columns = ["Tipo", "Contraparte", "Monto", "Nota", "Estado", "Fecha"];
  const observedRecords = [...purchases, ...invoices].filter(
    (record) =>
      isDateInPeriod(getRecordDate(record), period) &&
      normalizeReviewStatus(record.review_status) === "observed",
  );
  const rows =
    observedRecords.length > 0
      ? [
          headers(columns),
          ...observedRecords.map((record) =>
            dataRow([
              "supplier_name" in record ? "Compra" : "Factura",
              getRecordName(record),
              getRecordAmount(record),
              record.review_notes ?? "Sin nota registrada",
              reviewStatusLabel(record.review_status),
              formatDate(getRecordDate(record)),
            ]),
          ),
        ]
      : emptyNotice("No hay registros observados en este periodo.", columns);

  return {
    name: "Observados",
    rows: [
      ...titleRows("Observados", "Registros que requieren correccion"),
      ...rows,
    ],
  };
}

function buildAccountingSheet({
  currency,
  entries,
}: {
  currency: string;
  entries: Awaited<ReturnType<typeof listJournalEntriesForPeriod>>["entries"];
}): WorkbookSheet {
  const entryColumns = [
    "Asiento",
    "Estado",
    "Explicacion",
    "Total Debe",
    "Total Haber",
    "Diferencia",
    "Periodo",
  ];
  const lineColumns = [
    "Asiento",
    "Lado",
    "Cuenta",
    "Descripcion",
    "Monto",
    "Monto formateado",
    "Estado",
  ];
  const entryRows =
    entries.length > 0
      ? entries.map((entry) => {
          const totals = getJournalTotals(entry);

          return dataRow([
            `${entry.source_type}-${entry.source_id}`,
            journalStatusLabel(entry.status),
            entry.explanation ?? "",
            totals.debit,
            totals.credit,
            totals.difference,
            getPeriodLabel(entry.period_year, entry.period_month),
          ]);
        })
      : [{ cells: ["No hay asientos en este periodo."], style: 6 }];
  const lineRows =
    entries.flatMap((entry) =>
      (entry.lines ?? []).map((line) =>
        dataRow([
          `${entry.source_type}-${entry.source_id}`,
          line.side === "debit" ? "Debe" : "Haber",
          `${line.account?.code ?? ""} ${line.account?.name ?? ""}`.trim(),
          line.description ?? "",
          Number(line.amount ?? 0),
          formatCurrencyAmount(line.amount, currency),
          journalStatusLabel(entry.status),
        ]),
      ),
    );

  return {
    name: "Contabilidad",
    rows: [
      ...titleRows("Contabilidad", "Asientos sugeridos y contabilizados"),
      section("Asientos"),
      headers(entryColumns),
      ...entryRows,
      section("Lineas Debe/Haber"),
      headers(lineColumns),
      ...(lineRows.length > 0
        ? lineRows
        : [{ cells: ["No hay lineas contables en este periodo."], style: 6 }]),
    ],
  };
}

function buildDocumentFlowSheet({
  documents,
  period,
}: {
  documents: Awaited<ReturnType<typeof listDocumentsByCompany>>["documents"];
  period: { year: number; month: number };
}): WorkbookSheet {
  const columns = [
    "Documento",
    "Fecha recibido",
    "Tipo",
    "Estado",
    "Convertido",
    "Contraparte detectada",
    "Sugerencia OM7",
  ];
  const periodDocuments = documents.filter((document) =>
    isDateInPeriod(document.created_at, period),
  );
  const rows =
    periodDocuments.length > 0
      ? [
          headers(columns),
          ...periodDocuments.map((document) => {
            const status = getDocumentHumanStatus(document);

            return dataRow([
              document.display_name ?? document.original_filename ?? "Documento",
              formatDate(document.created_at),
              document.document_type,
              status.label,
              document.converted_at ? "Si" : "No",
              "Por trazabilidad documental",
              document.extraction?.extraction_provider ?? "Sin sugerencia registrada",
            ]);
          }),
        ]
      : emptyNotice("No hay documentos recibidos en este periodo.", columns);

  return {
    name: "Flujo Documental",
    rows: [
      ...titleRows("Flujo documental", "Documentos recibidos y convertidos"),
      ...rows,
    ],
  };
}

function columnName(index: number) {
  let name = "";
  let n = index;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
}

function buildWorksheetXml(sheet: WorkbookSheet) {
  const maxColumns = Math.max(12, ...sheet.rows.map((row) => row.cells.length));
  const columns = Array.from({ length: maxColumns }, (_, index) => {
    const width =
      index === 0
        ? 36
        : index === 1
          ? 32
          : index < 4
            ? 24
            : index < 8
              ? 18
              : 22;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const rows = sheet.rows
    .map((rowData, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const heightAttr = rowData.height
        ? ` ht="${rowData.height}" customHeight="1"`
        : "";
      const cells = Array.from({ length: maxColumns }, (_, cellIndex) => {
        const value = rowData.cells[cellIndex] ?? "";
        const cellRef = `${columnName(cellIndex + 1)}${rowNumber}`;
        const styleAttr = rowData.style ? ` s="${rowData.style}"` : "";

        if (typeof value === "number") {
          return `<c r="${cellRef}"${styleAttr}><v>${value}</v></c>`;
        }

        return `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t>${escapeXml(value)}</t></is></c>`;
      }).join("");

      return `<row r="${rowNumber}"${heightAttr}>${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <cols>${columns}</cols>
  <sheetData>${rows}</sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:F1"/>
    <mergeCell ref="A2:F2"/>
  </mergeCells>
</worksheet>`;
}

function buildWorkbookXml(sheets: WorkbookSheet[]) {
  const sheetEntries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
</workbook>`;
}

function buildWorkbookRelsXml(sheets: WorkbookSheet[]) {
  const sheetRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildContentTypesXml(sheets: WorkbookSheet[]) {
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${overrides}
</Types>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Arial"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF07111F"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFCFFAFE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFDDE7F0"/></left><right style="thin"><color rgb="FFDDE7F0"/></right><top style="thin"><color rgb="FFDDE7F0"/></top><bottom style="thin"><color rgb="FFDDE7F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
</styleSheet>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function buildZip(files: Array<{ name: string; content: string }>) {
  const output: number[] = [];
  const central: number[] = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = 0x0021;

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const contentBytes = textEncoder.encode(file.content);
    const checksum = crc32(contentBytes);

    writeUint32(output, 0x04034b50);
    writeUint16(output, 20);
    writeUint16(output, 0);
    writeUint16(output, 0);
    writeUint16(output, dosTime);
    writeUint16(output, dosDate);
    writeUint32(output, checksum);
    writeUint32(output, contentBytes.length);
    writeUint32(output, contentBytes.length);
    writeUint16(output, nameBytes.length);
    writeUint16(output, 0);
    output.push(...nameBytes, ...contentBytes);

    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, dosTime);
    writeUint16(central, dosDate);
    writeUint32(central, checksum);
    writeUint32(central, contentBytes.length);
    writeUint32(central, contentBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    central.push(...nameBytes);

    offset = output.length;
  }

  const centralOffset = output.length;
  output.push(...central);
  writeUint32(output, 0x06054b50);
  writeUint16(output, 0);
  writeUint16(output, 0);
  writeUint16(output, files.length);
  writeUint16(output, files.length);
  writeUint32(output, central.length);
  writeUint32(output, centralOffset);
  writeUint16(output, 0);

  return new Uint8Array(output);
}

function buildWorkbook(sheets: WorkbookSheet[]) {
  const files = [
    {
      content: buildContentTypesXml(sheets),
      name: "[Content_Types].xml",
    },
    {
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      name: "_rels/.rels",
    },
    {
      content: buildWorkbookXml(sheets),
      name: "xl/workbook.xml",
    },
    {
      content: buildWorkbookRelsXml(sheets),
      name: "xl/_rels/workbook.xml.rels",
    },
    {
      content: buildStylesXml(),
      name: "xl/styles.xml",
    },
    ...sheets.map((sheet, index) => ({
      content: buildWorksheetXml(sheet),
      name: `xl/worksheets/sheet${index + 1}.xml`,
    })),
  ];

  return buildZip(files);
}

export async function exportMonthlyReportExcel(
  companyId: string | undefined,
  year: number,
  month: number,
) {
  const [
    { activeContext, purchases },
    { invoices },
    { documents },
    accountingSummary,
    journalEntriesResult,
  ] = await Promise.all([
    listPurchases(),
    getInvoicesForActiveCompany(),
    listDocumentsByCompany(),
    getAccountingSummaryForPeriod(companyId, year, month),
    listJournalEntriesForPeriod(companyId, year, month),
  ]);
  const company = activeContext.activeCompany;
  const organization = activeContext.organization;
  const currency = normalizeCurrencyCode(
    company?.base_currency ?? organization?.base_currency ?? "CRC",
  );
  const period = { month, year };
  const periodLabel = getPeriodLabel(year, month);
  const generatedAt = new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const report = getMonthlyReport({
    documents,
    invoices,
    period,
    purchases,
  });
  const companyName = company?.name ?? "Cliente sin seleccionar";
  const content = buildWorkbook([
    buildExecutiveSummarySheet({
      accountingSummary,
      activeCompanyName: companyName,
      currency,
      generatedAt,
      periodLabel,
      report,
    }),
    buildPurchasesSheet({ currency, period, purchases }),
    buildInvoicesSheet({ currency, invoices, period }),
    buildObservationsSheet({ invoices, period, purchases }),
    buildAccountingSheet({
      currency,
      entries: journalEntriesResult.entries,
    }),
    buildDocumentFlowSheet({ documents, period }),
  ]);
  const safeCompanyName = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return {
    content,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `om7-reporte-${safeCompanyName || "cliente"}-${year}-${String(month).padStart(2, "0")}.xlsx`,
  };
}
