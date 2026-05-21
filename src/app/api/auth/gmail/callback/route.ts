import { exchangeGmailOAuthCode } from "@/lib/gmail-xml-import";

function getOAuthErrorMessage(error: string) {
  if (error === "access_denied") {
    return "Conexion cancelada. Podes intentar conectar Gmail nuevamente.";
  }

  return "Google no completo la conexion Gmail. Podes intentar conectar Gmail nuevamente.";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return Response.redirect(
      new URL(
        `/gmail-xml?error=${encodeURIComponent(getOAuthErrorMessage(oauthError))}`,
        request.url,
      ),
    );
  }

  if (!code || !state) {
    return Response.redirect(
      new URL(
        `/gmail-xml?error=${encodeURIComponent("Gmail no devolvio codigo OAuth.")}`,
        request.url,
      ),
    );
  }

  try {
    await exchangeGmailOAuthCode(code, state);
    return Response.redirect(
      new URL(
        `/gmail-xml?notice=${encodeURIComponent("Gmail conectado correctamente.")}`,
        request.url,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar Gmail OAuth.";
    return Response.redirect(
      new URL(`/gmail-xml?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
