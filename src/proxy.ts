import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/facturas-inteligentes/:path*",
    "/compras/:path*",
    "/reportes/:path*",
    "/empresas/:path*",
    "/configuracion/:path*",
    "/login",
    "/registro",
  ],
};
