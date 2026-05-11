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
    "/cliente/:path*",
    "/reportes/:path*",
    "/empresas/:path*",
    "/configuracion/:path*",
    "/onboarding/:path*",
    "/tributario/:path*",
    "/login",
    "/registro",
  ],
};
