import { NextRequest } from "next/server";
import {
  normalizeGmailXmlLimit,
  runGmailXmlAutoSync,
} from "@/lib/gmail-xml-import";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("authorization") === `Bearer ${cronSecret}` ||
    request.headers.get("user-agent")?.includes("vercel-cron")
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = normalizeGmailXmlLimit(request.nextUrl.searchParams.get("limit"));
    const summary = await runGmailXmlAutoSync(limit);

    return Response.json({
      ok: true,
      limit,
      summary,
    });
  } catch (error) {
    console.error("[OM7 Gmail XML cron error]", {
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo ejecutar Gmail XML autosync.",
      },
      { status: 500 },
    );
  }
}
