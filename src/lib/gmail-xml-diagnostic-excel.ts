import ExcelJS from "exceljs";
import {
  getGmailXmlDiagnosticSnapshot,
  type GmailXmlDocumentIvaMatrix,
  type GmailXmlDocumentDiagnosticDetail,
  type GmailXmlDiagnosticsFilters,
  type GmailXmlIvaRateSummary,
  type GmailXmlProviderSummary,
} from "@/lib/gmail-xml-diagnostics";

const moneyFormat = '"CRC" #,##0.00;[Red]-"CRC" #,##0.00';

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "N/D";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date;
}

function safeSheetName(value: string) {
  return value.slice(0, 31);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    fgColor: { argb: "FF0F172A" },
    pattern: "solid",
    type: "pattern",
  };
  row.alignment = { vertical: "middle", wrapText: true };
}

function applyWorksheetStyle(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        bottom: { color: { argb: "FFE2E8F0" }, style: "thin" },
      };
      cell.alignment = {
        ...cell.alignment,
        vertical: "top",
        wrapText: true,
      };
    });
  });

  sheet.columns.forEach((column) => {
    let maxLength = Number(column.width ?? 12);

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = String(cell.value ?? "");
      maxLength = Math.max(maxLength, Math.min(value.length + 2, 48));
    });

    column.width = maxLength;
  });
}

function addTitleBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  span = "A1:H1",
) {
  sheet.mergeCells(span);
  sheet.getCell("A1").value = "OM7 Finance OS";
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  sheet.getCell("A1").fill = {
    fgColor: { argb: "FF082F37" },
    pattern: "solid",
    type: "pattern",
  };
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = { bold: true, size: 14 };
  sheet.getCell("A3").value = subtitle;
  sheet.getCell("A3").font = { color: { argb: "FF475569" } };
}

function addMoneyFormat(sheet: ExcelJS.Worksheet, keys: string[]) {
  for (const key of keys) {
    const column = sheet.getColumn(key);
    column.numFmt = moneyFormat;
    column.alignment = { horizontal: "right", vertical: "top" };
  }
}

function setupTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  columns: Array<{ header: string; key: string; width: number }>,
) {
  sheet.columns = columns.map(({ key, width }) => ({ key, width }));
  const header = sheet.getRow(startRow);
  header.values = columns.map((column) => column.header);
  styleHeader(header);
  sheet.autoFilter = {
    from: { column: 1, row: startRow },
    to: { column: columns.length, row: startRow },
  };
}

function addExecutiveSummary(
  workbook: ExcelJS.Workbook,
  data: Awaited<ReturnType<typeof getGmailXmlDiagnosticSnapshot>>,
) {
  const sheet = workbook.addWorksheet("Resumen Ejecutivo", {
    views: [{ state: "frozen", ySplit: 12 }],
  });
  const companyName =
    data.activeContext.activeCompany?.legal_name ??
    data.activeContext.activeCompany?.name ??
    "Sin empresa activa";
  const organizationName =
    data.activeContext.organization?.name ?? "Sin organizacion activa";

  addTitleBlock(
    sheet,
    "Diagnostico Gmail XML",
    "Reporte ejecutivo para revision de base documental XML",
  );

  sheet.addRow([]);
  sheet.addRow(["Empresa activa", companyName]);
  sheet.addRow(["Organizacion", organizationName]);
  sheet.addRow(["Fecha generacion", new Date()]);
  sheet.addRow([
    "Rango fiscal analizado",
    `${data.kpis?.fiscalDateMin ?? "N/D"} - ${data.kpis?.fiscalDateMax ?? "N/D"}`,
  ]);
  sheet.addRow([]);
  sheet.addRow(["Metrica", "Valor"]);
  styleHeader(sheet.getRow(10));

  const metrics = [
    ["Total documentos", data.kpis?.totalXmlDocuments ?? 0],
    ["Total proveedores", data.kpis?.totalProviders ?? 0],
    ["Subtotal/base imponible", data.kpis?.totalSubtotal ?? 0],
    ["IVA total", data.kpis?.totalIva ?? 0],
    ["Total general", data.kpis?.totalGeneral ?? 0],
    ["Documentos sin proveedor", data.kpis?.documentsWithoutProvider ?? 0],
    ["Documentos pendientes de convertir", data.kpis?.pendingConversion ?? 0],
    ["Duplicados detectados", data.kpis?.duplicatesCount ?? 0],
    ["Documentos sin IVA", data.kpis?.documentsWithoutIva ?? 0],
    ["Errores de extraccion", data.kpis?.extractionErrors ?? 0],
  ];

  metrics.forEach((row) => sheet.addRow(row));
  sheet.addRow([]);
  sheet.addRow([
    "Nota metodologica",
    "Este reporte resume XML ya guardados en la base OM7 para la empresa activa. Las fechas usan fecha fiscal del comprobante cuando esta disponible.",
  ]);
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 48;
  sheet.getColumn(2).numFmt = moneyFormat;
  applyWorksheetStyle(sheet);
}

function addProviderSummary(
  workbook: ExcelJS.Workbook,
  providers: GmailXmlProviderSummary[],
) {
  const sheet = workbook.addWorksheet(safeSheetName("Resumen por Proveedor"), {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addTitleBlock(sheet, "Resumen por Proveedor", "Totales agrupados por emisor XML");
  setupTable(sheet, 5, [
    { header: "Proveedor", key: "providerName", width: 34 },
    { header: "Tax ID", key: "providerTaxId", width: 18 },
    { header: "Documentos", key: "documentsCount", width: 12 },
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "IVA", key: "iva", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Promedio por documento", key: "averagePerDocument", width: 20 },
    { header: "Fecha desde", key: "oldestDate", width: 16 },
    { header: "Fecha hasta", key: "newestDate", width: 16 },
    { header: "Ultima importacion", key: "lastImportAt", width: 20 },
    { header: "Estado clasificacion", key: "classificationStatus", width: 28 },
    { header: "Contraparte vinculada", key: "linkedCounterpartyName", width: 30 },
  ]);

  providers.forEach((provider) => {
    sheet.addRow({
      ...provider,
      oldestDate: formatDate(provider.oldestDate),
      newestDate: formatDate(provider.newestDate),
      lastImportAt: formatDate(provider.lastImportAt),
    });
  });

  const totalRow = sheet.addRow({
    providerName: "Total",
    documentsCount: providers.reduce((sum, item) => sum + item.documentsCount, 0),
    subtotal: providers.reduce((sum, item) => sum + item.subtotal, 0),
    iva: providers.reduce((sum, item) => sum + item.iva, 0),
    total: providers.reduce((sum, item) => sum + item.total, 0),
  });
  totalRow.font = { bold: true };
  addMoneyFormat(sheet, ["subtotal", "iva", "total", "averagePerDocument"]);
  applyWorksheetStyle(sheet);
}

function addIvaRateSummary(
  workbook: ExcelJS.Workbook,
  rates: GmailXmlIvaRateSummary[],
) {
  const sheet = workbook.addWorksheet(safeSheetName("IVA por Tarifa"), {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addTitleBlock(
    sheet,
    "IVA acumulado por tarifa",
    "Totales clasificados por linea XML y tarifa detectada",
  );
  setupTable(sheet, 5, [
    { header: "Clase IVA", key: "rateLabel", width: 24 },
    { header: "Tarifa %", key: "ratePercent", width: 12 },
    { header: "Documentos", key: "documentsCount", width: 12 },
    { header: "Lineas", key: "linesCount", width: 12 },
    { header: "Base", key: "taxableBase", width: 16 },
    { header: "IVA", key: "iva", width: 16 },
    { header: "Porcion total", key: "totalPortion", width: 18 },
    { header: "% del total", key: "totalShare", width: 14 },
  ]);

  rates.forEach((rate) => {
    sheet.addRow({
      ...rate,
      ratePercent: rate.ratePercent ?? "N/D",
    });
  });

  const totalRow = sheet.addRow({
    rateLabel: "Total",
    documentsCount: rates.reduce((sum, item) => sum + item.documentsCount, 0),
    linesCount: rates.reduce((sum, item) => sum + item.linesCount, 0),
    taxableBase: rates.reduce((sum, item) => sum + item.taxableBase, 0),
    iva: rates.reduce((sum, item) => sum + item.iva, 0),
    totalPortion: rates.reduce((sum, item) => sum + item.totalPortion, 0),
    totalShare: 100,
  });
  totalRow.font = { bold: true };
  addMoneyFormat(sheet, ["taxableBase", "iva", "totalPortion"]);
  sheet.getColumn("totalShare").numFmt = '0.00"%"';
  applyWorksheetStyle(sheet);
}

function addDocumentIvaMatrix(
  workbook: ExcelJS.Workbook,
  matrix: GmailXmlDocumentIvaMatrix,
) {
  const sheet = workbook.addWorksheet(safeSheetName("Facturas por IVA"), {
    views: [{ state: "frozen", ySplit: 5, xSplit: 4 }],
  });
  const dynamicColumns = matrix.rates.map((rate) => ({
    header: rate.rateLabel,
    key: rate.rateKey,
    width: 16,
  }));

  addTitleBlock(
    sheet,
    "Facturas por clase de IVA",
    "Una fila por factura y una columna por tarifa detectada en lineas XML",
    `A1:${String.fromCharCode(65 + Math.min(12, dynamicColumns.length + 7))}1`,
  );
  setupTable(sheet, 5, [
    { header: "Fecha fiscal", key: "fiscalDate", width: 16 },
    { header: "Proveedor", key: "providerName", width: 34 },
    { header: "Tax ID", key: "providerTaxId", width: 18 },
    { header: "Numero comprobante", key: "documentNumber", width: 24 },
    { header: "Clases IVA", key: "ivaClassLabels", width: 34 },
    { header: "Varias clases", key: "hasMultipleIvaClasses", width: 14 },
    ...dynamicColumns,
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "IVA total", key: "iva", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Clave fiscal", key: "fiscalKey", width: 52 },
  ]);

  matrix.rows.forEach((document) => {
    const classesByRate = new Map(
      document.ivaClasses.map((item) => [item.rateKey, item]),
    );
    const row: Record<string, string | number | Date | null> = {
      fiscalDate: formatDate(document.fiscalDate),
      providerName: document.providerName,
      providerTaxId: document.providerTaxId,
      documentNumber: document.documentNumber,
      ivaClassLabels: document.ivaClassLabels.join(" + "),
      hasMultipleIvaClasses: document.hasMultipleIvaClasses ? "Si" : "No",
      subtotal: document.subtotal,
      iva: document.iva,
      total: document.total,
      fiscalKey: document.fiscalKey,
    };

    matrix.rates.forEach((rate) => {
      row[rate.rateKey] = classesByRate.get(rate.rateKey)?.iva ?? 0;
    });

    sheet.addRow(row);
  });

  const totalRow: Record<string, string | number> = {
    fiscalDate: "Total",
    subtotal: matrix.rows.reduce((sum, item) => sum + item.subtotal, 0),
    iva: matrix.rows.reduce((sum, item) => sum + item.iva, 0),
    total: matrix.rows.reduce((sum, item) => sum + item.total, 0),
  };

  matrix.rates.forEach((rate) => {
    totalRow[rate.rateKey] = rate.iva;
  });

  const insertedTotalRow = sheet.addRow(totalRow);
  insertedTotalRow.font = { bold: true };
  addMoneyFormat(sheet, [
    ...matrix.rates.map((rate) => rate.rateKey),
    "subtotal",
    "iva",
    "total",
  ]);
  applyWorksheetStyle(sheet);
}

function addDocumentDetail(
  workbook: ExcelJS.Workbook,
  documents: GmailXmlDocumentDiagnosticDetail[],
) {
  const sheet = workbook.addWorksheet("Detalle Documentos", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addTitleBlock(sheet, "Detalle Documentos", "Documento fiscal deduplicado por clave");
  setupTable(sheet, 5, [
    { header: "Fecha fiscal", key: "fiscalDate", width: 16 },
    { header: "Mes/Ano", key: "monthKey", width: 12 },
    { header: "Proveedor", key: "providerName", width: 34 },
    { header: "Tax ID", key: "providerTaxId", width: 18 },
    { header: "Clave fiscal", key: "fiscalKey", width: 52 },
    { header: "Numero comprobante", key: "documentNumber", width: 24 },
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "IVA", key: "iva", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Estado importacion", key: "importStatus", width: 18 },
    { header: "Estado conversion", key: "conversionStatus", width: 22 },
    { header: "Compra/Factura ID", key: "convertedRecordId", width: 38 },
    { header: "Fuente", key: "source", width: 12 },
    { header: "Fecha importacion", key: "importedAt", width: 20 },
    { header: "Observaciones", key: "observations", width: 42 },
  ]);

  documents.forEach((document) => {
    sheet.addRow({
      ...document,
      fiscalDate: formatDate(document.fiscalDate),
      importedAt: formatDate(document.importedAt),
      observations: document.observations.join("; "),
    });
  });

  addMoneyFormat(sheet, ["subtotal", "iva", "total"]);
  applyWorksheetStyle(sheet);
}

function addQualityAlerts(
  workbook: ExcelJS.Workbook,
  documents: GmailXmlDocumentDiagnosticDetail[],
) {
  const sheet = workbook.addWorksheet(safeSheetName("Alertas Calidad"), {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  addTitleBlock(sheet, "Alertas / Calidad de datos", "Documentos que requieren revision");
  setupTable(sheet, 5, [
    { header: "Tipo alerta", key: "alertType", width: 30 },
    { header: "Proveedor", key: "providerName", width: 34 },
    { header: "Tax ID", key: "providerTaxId", width: 18 },
    { header: "Clave fiscal", key: "fiscalKey", width: 52 },
    { header: "Fecha fiscal", key: "fiscalDate", width: 16 },
    { header: "Total", key: "total", width: 16 },
    { header: "Documento", key: "filename", width: 34 },
    { header: "Observaciones", key: "observations", width: 48 },
  ]);

  documents
    .filter((document) => document.observations.length > 0)
    .forEach((document) => {
      for (const observation of document.observations) {
        sheet.addRow({
          alertType: observation,
          providerName: document.providerName,
          providerTaxId: document.providerTaxId,
          fiscalKey: document.fiscalKey,
          fiscalDate: formatDate(document.fiscalDate),
          total: document.total,
          filename: document.filename,
          observations: document.observations.join("; "),
        });
      }
    });

  addMoneyFormat(sheet, ["total"]);
  applyWorksheetStyle(sheet);
}

export async function buildGmailXmlDiagnosticExcel(
  filters: GmailXmlDiagnosticsFilters = {},
) {
  const data = await getGmailXmlDiagnosticSnapshot(filters);
  const workbook = new ExcelJS.Workbook();
  const companyName =
    data.activeContext.activeCompany?.legal_name ??
    data.activeContext.activeCompany?.name ??
    "cliente";
  const safeCompanyName = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  workbook.creator = "OM7 Finance OS";
  workbook.created = new Date();
  workbook.modified = new Date();

  addExecutiveSummary(workbook, data);
  addIvaRateSummary(workbook, data.ivaRateSummary ?? []);
  addDocumentIvaMatrix(workbook, data.documentIvaMatrix);
  addProviderSummary(workbook, data.providerSummary ?? []);
  addDocumentDetail(workbook, data.documentDetails ?? []);
  addQualityAlerts(workbook, data.documentDetails ?? []);

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    content: buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `om7-gmail-xml-diagnostico-${safeCompanyName || "cliente"}.xlsx`,
  };
}
