import { exportMonthlyReportExcel } from "@/lib/report-export-excel";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = new Date();
  const year = Number(url.searchParams.get("year") ?? today.getFullYear());
  const month = Number(url.searchParams.get("month") ?? today.getMonth() + 1);
  const safeYear = Number.isInteger(year) && year > 2000 ? year : today.getFullYear();
  const safeMonth =
    Number.isInteger(month) && month >= 1 && month <= 12
      ? month
      : today.getMonth() + 1;
  const report = await exportMonthlyReportExcel(undefined, safeYear, safeMonth);

  return new Response(report.content, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Type": report.contentType,
    },
  });
}
