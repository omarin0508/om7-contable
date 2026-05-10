export function getClientPortalUrl(origin?: string) {
  const runtimeOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const baseUrl = runtimeOrigin.replace(/\/$/, "");

  return `${baseUrl}/cliente`;
}

export function buildClientPortalMessage(portalUrl: string) {
  return [
    "Hola 👋",
    "",
    "Ya tiene acceso al Portal Cliente de OM7 Finance OS.",
    "",
    "Ingrese aquí:",
    portalUrl,
    "",
    "Desde el portal podrá:",
    "- subir XML de facturas electrónicas",
    "- subir PDFs o imágenes",
    "- enviar documentos para procesamiento contable",
    "",
    "Utilice el correo con el que fue registrado en el sistema.",
  ].join("\n");
}
