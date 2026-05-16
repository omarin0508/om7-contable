import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

const protectedRoutes = [
  "/dashboard",
  "/bandeja",
  "/facturas",
  "/facturas-inteligentes",
  "/compras",
  "/documentos",
  "/gmail-xml",
  "/cliente",
  "/contabilidad",
  "/contrapartes",
  "/observados",
  "/reportes",
  "/periodos",
  "/movimientos",
  "/planillas",
  "/subcontratos",
  "/tributario",
  "/empresas",
  "/configuracion",
  "/onboarding",
  "/visor-documento",
];

const authRoutes = ["/login", "/registro"];
const clientAllowedRoutes = ["/cliente", "/visor-documento"];

function isRoute(pathname: string, routes: string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  const pathname = request.nextUrl.pathname;

  if (!env) {
    if (isRoute(pathname, protectedRoutes)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next({
      request,
    });
  }

  if (!hasSupabaseAuthCookie(request)) {
    if (isRoute(pathname, protectedRoutes)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next({
      request,
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isRoute(pathname, protectedRoutes)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isRoute(pathname, protectedRoutes) && !isRoute(pathname, clientAllowedRoutes)) {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");
    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");
    const internalRoles = new Set([
      "owner",
      "platform_owner",
      "org_owner",
      "admin",
      "staff",
      "accountant",
      "assistant",
    ]);
    const isInternal = (memberships ?? []).some((membership) =>
      internalRoles.has(String(membership.role)),
    );
    const isClient = (companyUsers ?? []).some(
      (companyUser) => String(companyUser.role) === "client",
    );

    if (isClient && !isInternal) {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }
  }

  if (user && isRoute(pathname, authRoutes)) {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");
    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active");
    const internalRoles = new Set([
      "owner",
      "platform_owner",
      "org_owner",
      "admin",
      "staff",
      "accountant",
      "assistant",
    ]);
    const isInternal = (memberships ?? []).some((membership) =>
      internalRoles.has(String(membership.role)),
    );
    const isClient = (companyUsers ?? []).some(
      (companyUser) => String(companyUser.role) === "client",
    );

    if (isClient && !isInternal) {
      return NextResponse.redirect(new URL("/cliente", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
