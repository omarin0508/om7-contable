import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import {
  getReporteBalanceComprobacion,
  getReporteBalanceGeneral,
  getReporteEstadoResultados,
  getReporteFlujoEfectivo,
  getReporteMayorGeneral,
  getReportePresupuestoVsReal,
  getResumenReportesFinancieros,
  type ReporteFinancieroFilters,
  type ReporteFinancieroTipo,
} from "@/lib/reportes-financieros";

export const runtime = "nodejs";

const reportTitles: Record<ReporteFinancieroTipo, string> = {
  "balance-comprobacion": "Balance de Comprobacion",
  "balance-general": "Balance General",
  "estado-resultados": "Estado de Resultados",
  "flujo-efectivo": "Flujo de Efectivo",
  "mayor-general": "Mayor General",
  "presupuesto-vs-real": "Presupuesto vs Real",
};

type ExcelColumnDefinition = {
  header: string;
  key: string;
  width: number;
};

function isReporteFinancieroTipo(
  value: string | null,
): value is ReporteFinancieroTipo {
  return (
    value === "balance-general" ||
    value === "estado-resultados" ||
    value === "balance-comprobacion" ||
    value === "mayor-general" ||
    value === "flujo-efectivo" ||
    value === "presupuesto-vs-real"
  );
}

function getFilters(request: NextRequest): {
  filters: ReporteFinancieroFilters;
  tipo: ReporteFinancieroTipo;
} {
  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo");

  if (!isReporteFinancieroTipo(tipo)) {
    throw new Error("Tipo de reporte no soportado.");
  }

  return {
    filters: {
      cuentaId: params.get("cuentaId"),
      centroCostoId: params.get("centroCostoId"),
      fechaDesde: params.get("fechaDesde"),
      fechaHasta: params.get("fechaHasta"),
      moneda: params.get("moneda") ?? undefined,
      organizationId: params.get("organizationId") ?? undefined,
    },
    tipo,
  };
}

function addPresupuestoVsRealRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReportePresupuestoVsReal>>["rows"],
) {
  setReportColumns(sheet, [
    { header: "Centro de costo", key: "centro_costo_nombre", width: 34 },
    { header: "Presupuesto", key: "presupuesto_nombre", width: 34 },
    { header: "Monto presupuestado", key: "monto_presupuestado", width: 20 },
    { header: "Gasto real", key: "gasto_contable_real", width: 18 },
    { header: "Comprometido", key: "comprometido_contable", width: 18 },
    { header: "Disponible", key: "disponible", width: 18 },
    { header: "% ejecucion", key: "porcentaje_ejecucion", width: 16 },
    { header: "Desviacion", key: "desviacion", width: 18 },
    { header: "Estado", key: "estado", width: 18 },
  ]);
  rows.forEach((row) => sheet.addRow(row));
  addMoneyFormat(sheet, [
    "monto_presupuestado",
    "gasto_contable_real",
    "comprometido_contable",
    "disponible",
    "desviacion",
  ]);
}

function formatPeriod(fechaDesde: string | null, fechaHasta: string | null) {
  if (!fechaDesde && !fechaHasta) {
    return "Todo el historial";
  }

  return `${fechaDesde ?? "Inicio"} - ${fechaHasta ?? "Hoy"}`;
}

function applyWorkbookDefaults(workbook: ExcelJS.Workbook) {
  workbook.creator = "OM7 Finance OS";
  workbook.created = new Date();
  workbook.modified = new Date();
}

function setupWorksheet(
  workbook: ExcelJS.Workbook,
  title: string,
  organizationName: string,
  period: string,
) {
  const sheet = workbook.addWorksheet(title.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "OM7 Finance OS";
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  sheet.getCell("A1").fill = {
    fgColor: { argb: "FF082F37" },
    pattern: "solid",
    type: "pattern",
  };

  sheet.getCell("A3").value = "Reporte";
  sheet.getCell("B3").value = title;
  sheet.getCell("A4").value = "Organizacion";
  sheet.getCell("B4").value = organizationName;
  sheet.getCell("A5").value = "Periodo";
  sheet.getCell("B5").value = period;
  sheet.getCell("A6").value = "Generado";
  sheet.getCell("B6").value = new Date().toLocaleString("es-CR");

  for (const rowNumber of [3, 4, 5, 6]) {
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
  }

  return sheet;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    fgColor: { argb: "FF0F172A" },
    pattern: "solid",
    type: "pattern",
  };
  row.alignment = { vertical: "middle" };
}

function setReportColumns(
  sheet: ExcelJS.Worksheet,
  columns: ExcelColumnDefinition[],
) {
  sheet.columns = columns.map(({ key, width }) => ({ key, width }));
  const headerRow = sheet.getRow(8);
  headerRow.values = columns.map((column) => column.header);
  styleHeader(headerRow);
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    column.width = Math.max(column.width ?? 14, 14);
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        bottom: { color: { argb: "FFE2E8F0" }, style: "thin" },
      };
    });
  });
}

function addMoneyFormat(sheet: ExcelJS.Worksheet, columnKeys: string[]) {
  for (const key of columnKeys) {
    const column = sheet.getColumn(key);
    column.numFmt = '"CRC" #,##0.00;[Red]-"CRC" #,##0.00';
  }
}

function addBalanceGeneralRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReporteBalanceGeneral>>["rows"],
) {
  setReportColumns(sheet, [
    { header: "Codigo", key: "codigo", width: 16 },
    { header: "Cuenta", key: "nombre", width: 42 },
    { header: "Categoria", key: "categoria", width: 18 },
    { header: "Nivel", key: "nivel", width: 10 },
    { header: "Tipo", key: "tipo_cuenta", width: 16 },
    { header: "Debito", key: "total_debito", width: 16 },
    { header: "Credito", key: "total_credito", width: 16 },
    { header: "Saldo presentacion", key: "saldo_presentacion", width: 20 },
    { header: "Saldo contrario", key: "tiene_saldo_contrario", width: 18 },
  ]);

  for (const row of rows) {
    const excelRow = sheet.addRow(row);
    excelRow.getCell("nombre").alignment = {
      indent: Math.max(row.nivel - 1, 0),
    };
  }

  addMoneyFormat(sheet, ["total_debito", "total_credito", "saldo_presentacion"]);
}

function addEstadoResultadosRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReporteEstadoResultados>>["rows"],
) {
  setReportColumns(sheet, [
    { header: "Codigo", key: "codigo", width: 16 },
    { header: "Cuenta", key: "nombre", width: 42 },
    { header: "Seccion", key: "seccion", width: 22 },
    { header: "Nivel", key: "nivel", width: 10 },
    { header: "Debito", key: "total_debito", width: 16 },
    { header: "Credito", key: "total_credito", width: 16 },
    { header: "Saldo presentacion", key: "saldo_presentacion", width: 20 },
    { header: "Utilidad neta", key: "utilidad_neta", width: 18 },
  ]);

  for (const row of rows) {
    const excelRow = sheet.addRow(row);
    excelRow.getCell("nombre").alignment = {
      indent: Math.max(row.nivel - 1, 0),
    };
  }

  addMoneyFormat(sheet, [
    "total_debito",
    "total_credito",
    "saldo_presentacion",
    "utilidad_neta",
  ]);
}

function addBalanceComprobacionRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReporteBalanceComprobacion>>["rows"],
) {
  setReportColumns(sheet, [
    { header: "Codigo", key: "codigo", width: 16 },
    { header: "Cuenta", key: "nombre", width: 42 },
    { header: "Categoria", key: "categoria", width: 18 },
    { header: "Naturaleza", key: "naturaleza", width: 16 },
    { header: "Debito", key: "total_debito", width: 16 },
    { header: "Credito", key: "total_credito", width: 16 },
    { header: "Saldo deudor", key: "saldo_deudor", width: 16 },
    { header: "Saldo acreedor", key: "saldo_acreedor", width: 16 },
    { header: "Saldo natural", key: "saldo_natural", width: 18 },
  ]);
  rows.forEach((row) => sheet.addRow(row));
  addMoneyFormat(sheet, [
    "total_debito",
    "total_credito",
    "saldo_deudor",
    "saldo_acreedor",
    "saldo_natural",
  ]);
}

function addMayorGeneralRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReporteMayorGeneral>>["movimientos"],
) {
  setReportColumns(sheet, [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Asiento", key: "numero_asiento", width: 12 },
    { header: "Codigo", key: "codigo", width: 16 },
    { header: "Cuenta", key: "nombre", width: 42 },
    { header: "Descripcion", key: "descripcion_asiento", width: 42 },
    { header: "Modulo", key: "modulo_origen", width: 16 },
    { header: "Referencia", key: "referencia", width: 20 },
    { header: "Debito", key: "debito", width: 16 },
    { header: "Credito", key: "credito", width: 16 },
    { header: "Saldo movimiento", key: "saldo_movimiento_natural", width: 20 },
    { header: "Saldo acumulado", key: "saldo_acumulado_natural", width: 20 },
  ]);
  rows.forEach((row) =>
    sheet.addRow({
      ...row,
      descripcion_asiento: row.descripcion_linea ?? row.descripcion_asiento,
    }),
  );
  addMoneyFormat(sheet, [
    "debito",
    "credito",
    "saldo_movimiento_natural",
    "saldo_acumulado_natural",
  ]);
}

function addFlujoEfectivoRows(
  sheet: ExcelJS.Worksheet,
  rows: Awaited<ReturnType<typeof getReporteFlujoEfectivo>>["movimientos"],
) {
  setReportColumns(sheet, [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Asiento", key: "numero_asiento", width: 12 },
    { header: "Clasificacion", key: "clasificacion_flujo", width: 22 },
    { header: "Codigo caja/banco", key: "codigo_cuenta", width: 18 },
    { header: "Cuenta caja/banco", key: "nombre_cuenta", width: 34 },
    { header: "Descripcion", key: "descripcion", width: 42 },
    { header: "Modulo", key: "modulo_origen", width: 16 },
    { header: "Referencia", key: "referencia", width: 22 },
    { header: "Entrada", key: "entrada", width: 16 },
    { header: "Salida", key: "salida", width: 16 },
    { header: "Flujo neto", key: "flujo_neto", width: 18 },
    { header: "Saldo acumulado", key: "saldo_acumulado", width: 20 },
  ]);
  rows.forEach((row) => sheet.addRow(row));
  addMoneyFormat(sheet, [
    "entrada",
    "salida",
    "flujo_neto",
    "saldo_acumulado",
  ]);
}

function getFileName(tipo: ReporteFinancieroTipo) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `om7-${tipo}-${stamp}.xlsx`;
}

export async function GET(request: NextRequest) {
  try {
    const { filters, tipo } = getFilters(request);
    const workbook = new ExcelJS.Workbook();
    applyWorkbookDefaults(workbook);

    if (tipo === "flujo-efectivo") {
      const report = await getReporteFlujoEfectivo(filters);
      const title = reportTitles[tipo];
      const sheet = setupWorksheet(
        workbook,
        title,
        report.context.organizationName,
        formatPeriod(report.context.fechaDesde, report.context.fechaHasta),
      );

      addFlujoEfectivoRows(sheet, report.movimientos);
      sheet.addRow([]);
      sheet.addRow(["Resumen flujo oficial"]);
      sheet.addRow(["Saldo inicial", report.resumen.saldo_inicial]);
      sheet.addRow(["Entradas", report.resumen.total_entradas]);
      sheet.addRow(["Salidas", report.resumen.total_salidas]);
      sheet.addRow(["Flujo neto", report.resumen.flujo_neto]);
      sheet.addRow(["Saldo final", report.resumen.saldo_final]);
      sheet.addRow(["Cobros clientes", report.resumen.cobros_clientes]);
      sheet.addRow(["Pagos proveedores", report.resumen.pagos_proveedores]);
      sheet.addRow(["Pagos planilla", report.resumen.pagos_planilla]);
      sheet.addRow(["Pagos subcontratos", report.resumen.pagos_subcontratos]);
      sheet.addRow(["Transferencias neto", report.resumen.transferencias_neto]);
      sheet.addRow(["Otros neto", report.resumen.otros_neto]);
      styleSheet(sheet);

      const buffer = await workbook.xlsx.writeBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${getFileName(tipo)}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }

    if (tipo === "presupuesto-vs-real") {
      const report = await getReportePresupuestoVsReal(filters);
      const title = reportTitles[tipo];
      const sheet = setupWorksheet(
        workbook,
        title,
        report.context.organizationName,
        formatPeriod(report.context.fechaDesde, report.context.fechaHasta),
      );

      addPresupuestoVsRealRows(sheet, report.rows);
      sheet.addRow([]);
      sheet.addRow(["Resumen presupuesto vs real"]);
      sheet.addRow(["Presupuesto total", report.resumen.montoPresupuestado]);
      sheet.addRow(["Gasto real", report.resumen.gastoContableReal]);
      sheet.addRow(["Comprometido", report.resumen.comprometidoContable]);
      sheet.addRow(["Disponible", report.resumen.disponible]);
      sheet.addRow(["% ejecucion", report.resumen.porcentajeEjecucion]);
      styleSheet(sheet);

      const buffer = await workbook.xlsx.writeBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${getFileName(tipo)}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }

    const resumen = await getResumenReportesFinancieros(filters);
    const title = reportTitles[tipo];
    const sheet = setupWorksheet(
      workbook,
      title,
      resumen.context.organizationName,
      formatPeriod(resumen.context.fechaDesde, resumen.context.fechaHasta),
    );

    if (tipo === "balance-general") {
      const report = await getReporteBalanceGeneral(filters);
      addBalanceGeneralRows(sheet, report.rows);
    }

    if (tipo === "estado-resultados") {
      const report = await getReporteEstadoResultados(filters);
      addEstadoResultadosRows(sheet, report.rows);
    }

    if (tipo === "balance-comprobacion") {
      const report = await getReporteBalanceComprobacion(filters);
      addBalanceComprobacionRows(sheet, report.rows);
    }

    if (tipo === "mayor-general") {
      const report = await getReporteMayorGeneral(filters);
      addMayorGeneralRows(sheet, report.movimientos);
    }

    sheet.addRow([]);
    sheet.addRow(["Resumen oficial"]);
    sheet.addRow(["Activos", resumen.resumen.total_activos]);
    sheet.addRow(["Pasivos", resumen.resumen.total_pasivos]);
    sheet.addRow(["Patrimonio", resumen.resumen.total_patrimonio]);
    sheet.addRow(["Diferencia balance", resumen.resumen.diferencia_balance]);
    sheet.addRow(["Utilidad neta", resumen.resumen.utilidad_neta]);
    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${getFileName(tipo)}"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo exportar el Excel.";

    return Response.json({ error: message }, { status: 400 });
  }
}
