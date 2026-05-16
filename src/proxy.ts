import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bandeja/:path*",
    "/facturas/:path*",
    "/facturas-inteligentes/:path*",
    "/compras/:path*",
    "/documentos/:path*",
    "/gmail-xml/:path*",
    "/cliente/:path*",
    "/contabilidad/:path*",
    "/contrapartes/:path*",
    "/reportes/:path*",
    "/periodos/:path*",
    "/movimientos/:path*",
    "/observados/:path*",
    "/planillas/:path*",
    "/subcontratos/:path*",
    "/empresas/:path*",
    "/configuracion/:path*",
    "/onboarding/:path*",
    "/tributario/:path*",
    "/visor-documento/:path*",
    "/login",
    "/registro",
  ],
};
