import { buildGmailXmlDiagnosticExcel } from "@/lib/gmail-xml-diagnostic-excel";

export const runtime = "nodejs";

export async function GET() {
  try {
    const report = await buildGmailXmlDiagnosticExcel();

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
