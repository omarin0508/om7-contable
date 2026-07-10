import { buildGmailXmlDiagnosticExcel } from "@/lib/gmail-xml-diagnostic-excel";
import type { GmailXmlDiagnosticsFilters } from "@/lib/gmail-xml-diagnostics";

export const runtime = "nodejs";

function getFilters(request: Request): GmailXmlDiagnosticsFilters {
  const searchParams = new URL(request.url).searchParams;
  const source = searchParams.get("source");
  const status = searchParams.get("status");

  return {
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    source: source === "gmail" || source === "manual" ? source : "all",
    status:
      status === "pendiente" ||
      status === "procesado" ||
      status === "duplicado" ||
      status === "omitido" ||
      status === "error"
        ? status
        : "all",
  };
}

export async function GET(request: Request) {
  try {
    const report = await buildGmailXmlDiagnosticExcel(getFilters(request));

    return new Response(report.content, {
      headers: {
        "Content-Disposition": `attachment; filename="${report.filename}"`,
        "Content-Type": report.contentType,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el diagnostico Gmail XML.";

    return new Response(message, { status: 500 });
  }
}
