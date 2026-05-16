import { getActiveContext } from "@/lib/active-context";
import {
  extractionHasUsefulData,
  type DocumentExtraction,
} from "@/lib/document-processing";
import { assertInternalUser } from "@/lib/permissions";
import { uploadDocumentContent } from "@/lib/storage";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createSupabaseServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailXmlConnection = {
  id: string;
  organization_id: string;
  company_id: string | null;
  user_id: string;
  gmail_email: string | null;
  connected_at: string | null;
  last_test_at: string | null;
  last_list_at: string | null;
  active: boolean;
};

export type GmailXmlCandidate = {
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from: string | null;
  subject: string | null;
  received_at: string | null;
  attachments: GmailXmlAttachmentCandidate[];
  attachment_filenames: string[];
};

export type GmailXmlAttachmentCandidate = {
  gmail_attachment_id: string;
  filename: string;
  mime_type: string | null;
};

export type GmailXmlImportStatus =
  | "pendiente"
  | "procesado"
  | "duplicado"
  | "omitido"
  | "error";

export type GmailXmlImportRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  source: "gmail";
  gmail_message_id: string;
  gmail_thread_id: string | null;
  gmail_attachment_id: string;
  from: string | null;
  subject: string | null;
  received_at: string | null;
  attachment_filename: string | null;
  imported_document_id: string | null;
  import_status: GmailXmlImportStatus;
  error_message: string | null;
  created_at: string | null;
};

export type GmailXmlDashboard = {
  activeContext: Awaited<ReturnType<typeof getActiveContext>>;
  connection: GmailXmlConnection | null;
  candidates: GmailXmlCandidate[];
  recentImports: GmailXmlImportRecord[];
};

type GmailMessagePart = {
  filename?: string;
  mimeType?: string;
  body?: {
    attachmentId?: string;
    data?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: GmailMessagePart[];
  } & GmailMessagePart;
};

type GmailXmlTraceWrite = ReturnType<typeof getImportTrace> & {
  organization_id: string;
  user_id: string;
  import_status: GmailXmlImportStatus;
  imported_document_id?: string | null;
  error_message?: string | null;
};

export type GmailXmlSyncSummary = {
  totalFound: number;
  imported: number;
  duplicates: number;
  omitted: number;
  errors: number;
};

const TRIBUTARY_DOCUMENT_TAGS = [
  "ComprobanteElectronico",
  "FacturaElectronica",
  "TiqueteElectronico",
  "NotaCreditoElectronica",
  "NotaDebitoElectronica",
];

const HACIENDA_RESPONSE_TAGS = [
  "MensajeHacienda",
  "MensajeReceptor",
  "RespuestaHacienda",
  "RespuestaComprobante",
];

function getGmailEnv() {
  const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function encodeState(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeState(state: string) {
  return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as Record<
    string,
    string
  >;
}

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuario no autenticado.");
  }

  return { supabase, user };
}

async function getGmailTraceSupabase(
  fallbackSupabase: SupabaseClient,
): Promise<SupabaseClient> {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim();
  const supabaseEnv = getSupabaseEnv();

  if (!serviceRoleKey || !supabaseEnv) {
    return fallbackSupabase;
  }

  return createSupabaseServiceClient(supabaseEnv.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function logGmailXmlSync(stage: string, context: Record<string, unknown>) {
  console.info("[OM7 Gmail XML sync]", {
    stage,
    ...context,
  });
}

function logGmailXmlSyncError(
  stage: string,
  context: Record<string, unknown>,
  error: unknown,
) {
  console.error("[OM7 Gmail XML sync error]", {
    stage,
    ...context,
    error: getErrorMessage(error, String(error)),
  });
}

async function upsertGmailImportTrace(
  supabase: SupabaseClient,
  payload: GmailXmlTraceWrite,
  stage: string,
) {
  const { data, error } = await supabase
    .from("gmail_xml_imports")
    .upsert(payload, {
      onConflict: "organization_id,user_id,gmail_message_id,gmail_attachment_id",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `[${stage}] No se pudo guardar trazabilidad Gmail XML: ${
        error?.message ?? "sin respuesta de Supabase"
      }`,
    );
  }

  return data.id as string;
}

async function updateGmailImportTrace(
  supabase: SupabaseClient,
  id: string,
  values: {
    imported_document_id?: string | null;
    import_status: GmailXmlImportStatus;
    error_message?: string | null;
  },
  stage: string,
) {
  const { error } = await supabase
    .from("gmail_xml_imports")
    .update(values)
    .eq("id", id);

  if (error) {
    throw new Error(
      `[${stage}] No se pudo actualizar trazabilidad Gmail XML: ${error.message}`,
    );
  }
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gmail API ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

function getHeader(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (header) => header.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? null
  );
}

function getMessageParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) {
    return [];
  }

  return [part, ...(part.parts ?? []).flatMap((child) => getMessageParts(child))];
}

function getXmlAttachmentFilenames(message: GmailMessage) {
  return getXmlAttachments(message)
    .map((attachment) => attachment.filename);
}

function getXmlAttachments(message: GmailMessage): GmailXmlAttachmentCandidate[] {
  return getMessageParts(message.payload)
    .map((part) => ({
      filename: part.filename?.trim() ?? "",
      gmail_attachment_id: part.body?.attachmentId ?? "",
      mime_type: part.mimeType ?? null,
    }))
    .filter(
      (part) =>
        part.filename.toLowerCase().endsWith(".xml") &&
        part.gmail_attachment_id,
    );
}

function decodeBase64Url(data: string) {
  return new Uint8Array(Buffer.from(data, "base64url"));
}

function getExtractionData(extraction: DocumentExtraction | null) {
  const data = extraction?.extracted_data;

  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function isProcessedStatus(status: unknown) {
  return ["procesado", "duplicado", "omitido"].includes(String(status));
}

function stripNamespaces(xmlText: string) {
  return xmlText
    .replace(/<\/?[a-zA-Z0-9_-]+:/g, (match) => match.replace(/([</])[^:]+:/, "$1"))
    .replace(/\s+xmlns(:[a-zA-Z0-9_-]+)?="[^"]*"/g, "");
}

function getXmlRootName(xmlText: string) {
  const xml = stripNamespaces(xmlText).replace(/^\uFEFF/, "").trim();
  const rootMatch = xml.match(/^<\?xml[\s\S]*?\?>\s*<([A-Za-z0-9_-]+)(?:\s|>)/i)
    ?? xml.match(/^<([A-Za-z0-9_-]+)(?:\s|>)/i);

  return rootMatch?.[1] ?? "";
}

function hasXmlTag(xmlText: string, tagName: string) {
  return new RegExp(`<(?:[A-Za-z0-9_-]+:)?${tagName}(?:\\s|>)`, "i").test(xmlText);
}

function isHaciendaResponseFilename(filename: string) {
  const cleanFilename = filename.toLowerCase();

  return (
    cleanFilename.includes("_respuesta") ||
    cleanFilename.includes("-respuesta") ||
    cleanFilename.includes("respuesta.xml") ||
    cleanFilename.endsWith("respuesta.xml")
  );
}

function classifyXmlAttachment(filename: string, xmlText: string) {
  const rootName = getXmlRootName(xmlText);

  if (
    isHaciendaResponseFilename(filename) ||
    HACIENDA_RESPONSE_TAGS.includes(rootName) ||
    HACIENDA_RESPONSE_TAGS.some((tag) => hasXmlTag(xmlText, tag))
  ) {
    return {
      importable: false,
      reason: "XML omitido: respuesta de Hacienda, no es comprobante tributario.",
    };
  }

  if (
    TRIBUTARY_DOCUMENT_TAGS.includes(rootName) ||
    TRIBUTARY_DOCUMENT_TAGS.some((tag) => hasXmlTag(xmlText, tag))
  ) {
    return {
      importable: true,
      reason: null,
    };
  }

  return {
    importable: false,
    reason: `XML omitido: tipo no soportado (${rootName || "sin raiz detectada"}).`,
  };
}

async function getLatestDocumentExtraction(documentId: string) {
  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_extractions")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DocumentExtraction | null) ?? null;
}

async function hasDuplicateXmlClave({
  clave,
  documentId,
  organizationId,
}: {
  clave: unknown;
  documentId: string;
  organizationId: string;
}) {
  const cleanClave = normalizeText(clave);

  if (!cleanClave) {
    return false;
  }

  const { supabase } = await getAuthenticatedSupabase();
  const { data, error } = await supabase
    .from("document_extractions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("extraction_provider", "xml-parser-cr")
    .eq("extracted_data->>clave", cleanClave)
    .neq("document_id", documentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function getRecentGmailXmlImports() {
  const activeContext = await getActiveContext();
  const { supabase, user } = await getAuthenticatedSupabase();

  if (!activeContext.organization) {
    return [] as GmailXmlImportRecord[];
  }

  const { data, error } = await supabase
    .from("gmail_xml_imports")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === "42P01") {
      return [] as GmailXmlImportRecord[];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as GmailXmlImportRecord[];
}

async function getGmailXmlMessagesWithAttachments(
  accessToken: string,
  limit = 10,
) {
  const search = new URLSearchParams({
    q: "filename:xml has:attachment",
    maxResults: String(limit),
  });
  const listResponse = await gmailFetch<{ messages?: Array<{ id: string }> }>(
    accessToken,
    `/messages?${search.toString()}`,
  );
  const messages: Array<{
    message: GmailMessage;
    attachments: GmailXmlAttachmentCandidate[];
  }> = [];

  for (const item of listResponse.messages ?? []) {
    const message = await gmailFetch<GmailMessage>(
      accessToken,
      `/messages/${item.id}?format=full&metadataHeaders=From&metadataHeaders=Subject`,
    );
    const attachments = getXmlAttachments(message);

    if (attachments.length > 0) {
      messages.push({ message, attachments });
    }
  }

  return messages;
}

async function downloadGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
) {
  const attachment = await gmailFetch<{ data?: string }>(
    accessToken,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );

  if (!attachment.data) {
    throw new Error("Gmail no devolvio contenido para el adjunto XML.");
  }

  return decodeBase64Url(attachment.data);
}

function getImportTrace(message: GmailMessage, attachment: GmailXmlAttachmentCandidate) {
  return {
    source: "gmail" as const,
    gmail_message_id: message.id,
    gmail_thread_id: message.threadId ?? null,
    gmail_attachment_id: attachment.gmail_attachment_id,
    from: getHeader(message, "from"),
    subject: getHeader(message, "subject"),
    received_at: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
    attachment_filename: attachment.filename,
  };
}

function getSyncNotice(summary: GmailXmlSyncSummary) {
  return `Sincronizacion lista: ${summary.totalFound} XML encontrados, ${summary.imported} importados, ${summary.duplicates} duplicados, ${summary.omitted} omitidos, ${summary.errors} errores.`;
}

export function formatGmailXmlSyncNotice(summary: GmailXmlSyncSummary) {
  return getSyncNotice(summary);
}

function assertXmlAttachment(attachment: GmailXmlAttachmentCandidate) {
  if (!attachment.filename.toLowerCase().endsWith(".xml")) {
    throw new Error("El adjunto no es un archivo XML.");
  }

  if (!attachment.gmail_attachment_id) {
    throw new Error("El adjunto XML no tiene attachmentId de Gmail.");
  }
}

function getAttachmentCandidateKey(attachment: GmailXmlAttachmentCandidate) {
  return `${attachment.gmail_attachment_id}:${attachment.filename}`;
}

function uniqueAttachments(attachments: GmailXmlAttachmentCandidate[]) {
  const seen = new Set<string>();

  return attachments.filter((attachment) => {
    const key = getAttachmentCandidateKey(attachment);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function refreshAccessToken(refreshToken: string) {
  const env = getGmailEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo refrescar Gmail OAuth: ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
}

async function getConnectionAccessToken(connection: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
}) {
  const { supabase } = await getAuthenticatedSupabase();
  const expiresAt = connection.expires_at
    ? Date.parse(connection.expires_at)
    : 0;

  if (connection.access_token && expiresAt > Date.now() + 60_000) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error("La conexion Gmail no tiene refresh token. Conecta Gmail de nuevo.");
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const nextExpiresAt = new Date(
    Date.now() + (refreshed.expires_in ?? 3600) * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("gmail_xml_connections")
    .update({
      access_token: refreshed.access_token,
      expires_at: nextExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error(error.message);
  }

  return refreshed.access_token;
}

async function getActiveConnection() {
  const currentUser = await assertInternalUser();
  const activeContext = await getActiveContext();
  const { supabase } = await getAuthenticatedSupabase();

  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa antes de usar Gmail.");
  }

  const { data: connection, error } = await supabase
    .from("gmail_xml_connections")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("user_id", currentUser.userId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!connection) {
    throw new Error("Conecta Gmail antes de probar la conexion.");
  }

  return {
    activeContext,
    connection: connection as {
      id: string;
      access_token: string | null;
      refresh_token: string | null;
      expires_at: string | null;
    },
  };
}

export async function getGmailConnectUrl() {
  const currentUser = await assertInternalUser();
  const activeContext = await getActiveContext();

  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa antes de conectar Gmail.");
  }

  const env = getGmailEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set(
    "scope",
    [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  );
  url.searchParams.set(
    "state",
    encodeState({
      userId: currentUser.userId,
      organizationId: activeContext.organization.id,
      companyId: activeContext.activeCompany?.id ?? "",
    }),
  );

  return url.toString();
}

export async function exchangeGmailOAuthCode(code: string, state: string) {
  const currentUser = await assertInternalUser();
  const stateData = decodeState(state);

  if (stateData.userId !== currentUser.userId) {
    throw new Error("La sesion OAuth no coincide con el usuario activo.");
  }

  const env = getGmailEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo conectar Gmail: ${await response.text()}`);
  }

  const token = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const profileResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    },
  );
  const profile = profileResponse.ok
    ? ((await profileResponse.json()) as { email?: string })
    : {};
  const { supabase } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + (token.expires_in ?? 3600) * 1000,
  ).toISOString();

  const { error } = await supabase.from("gmail_xml_connections").upsert(
    {
      organization_id: stateData.organizationId,
      company_id: stateData.companyId || null,
      user_id: currentUser.userId,
      gmail_email: profile.email ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      connected_at: now,
      last_test_at: now,
      active: true,
      updated_at: now,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function testGmailConnection() {
  const { connection } = await getActiveConnection();
  const accessToken = await getConnectionAccessToken(connection);
  const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profile.ok) {
    throw new Error(`No se pudo leer la cuenta Gmail: ${await profile.text()}`);
  }

  const account = (await profile.json()) as { email?: string };
  const { supabase } = await getAuthenticatedSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("gmail_xml_connections")
    .update({
      gmail_email: account.email ?? null,
      last_test_at: now,
      updated_at: now,
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error(error.message);
  }

  return account.email ?? "Cuenta Gmail conectada";
}

export async function listGmailXmlMessages(limit = 10): Promise<GmailXmlCandidate[]> {
  const { connection } = await getActiveConnection();
  const accessToken = await getConnectionAccessToken(connection);
  const gmailMessages = await getGmailXmlMessagesWithAttachments(accessToken, limit);
  const messages = gmailMessages.map(({ message, attachments }) => ({
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId ?? null,
      from: getHeader(message, "from"),
      subject: getHeader(message, "subject"),
      received_at: message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null,
      attachments: uniqueAttachments(attachments),
      attachment_filenames: getXmlAttachmentFilenames(message),
    }));

  const { supabase } = await getAuthenticatedSupabase();
  await supabase
    .from("gmail_xml_connections")
    .update({
      last_list_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return messages;
}

export async function syncGmailXmlAttachments(limit = 10): Promise<GmailXmlSyncSummary> {
  const { activeContext, connection } = await getActiveConnection();
  const { supabase, user } = await getAuthenticatedSupabase();
  const traceSupabase = await getGmailTraceSupabase(supabase);

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de importar XML desde Gmail.");
  }

  const accessToken = await getConnectionAccessToken(connection);
  const gmailMessages = await getGmailXmlMessagesWithAttachments(accessToken, limit);
  const summary: GmailXmlSyncSummary = {
    totalFound: gmailMessages.reduce(
      (count, item) => count + uniqueAttachments(item.attachments).length,
      0,
    ),
    imported: 0,
    duplicates: 0,
    omitted: 0,
    errors: 0,
  };
  const baseLogContext = {
    organization_id: activeContext.organization.id,
    user_id: user.id,
  };

  logGmailXmlSync("attachments_found", {
    ...baseLogContext,
    count: summary.totalFound,
  });

  for (const { message, attachments } of gmailMessages) {
    for (const attachment of uniqueAttachments(attachments)) {
      const trace = getImportTrace(message, attachment);
      const logContext = {
        ...baseLogContext,
        gmail_message_id: trace.gmail_message_id,
        gmail_attachment_id: trace.gmail_attachment_id,
        filename: trace.attachment_filename,
      };

      try {
        assertXmlAttachment(attachment);
        logGmailXmlSync("attachment_detected", logContext);

        const { data: existing, error: existingError } = await traceSupabase
          .from("gmail_xml_imports")
          .select("id, import_status")
          .eq("organization_id", activeContext.organization.id)
          .eq("user_id", user.id)
          .eq("gmail_message_id", trace.gmail_message_id)
          .eq("gmail_attachment_id", trace.gmail_attachment_id)
          .maybeSingle();

        if (existingError) {
          throw new Error(existingError.message);
        }

        if (existing && isProcessedStatus(existing.import_status)) {
          logGmailXmlSync("attachment_already_processed", {
            ...logContext,
            import_status: existing.import_status,
          });
          if (existing.import_status === "omitido") {
            summary.omitted += 1;
          } else {
            summary.duplicates += 1;
          }
          continue;
        }

        const importRowId = await upsertGmailImportTrace(
          traceSupabase,
          {
            ...trace,
            organization_id: activeContext.organization.id,
            user_id: user.id,
            import_status: "pendiente",
            imported_document_id: null,
            error_message: null,
          },
          "trace_pending",
        );
        logGmailXmlSync("trace_pending", logContext);

        try {
          logGmailXmlSync("download_attachment", logContext);
          const content = await downloadGmailAttachment(
            accessToken,
            trace.gmail_message_id,
            trace.gmail_attachment_id,
          );
          const xmlText = new TextDecoder("utf-8").decode(content);
          const classification = classifyXmlAttachment(
            trace.attachment_filename,
            xmlText,
          );

          if (!classification.importable) {
            await updateGmailImportTrace(
              traceSupabase,
              importRowId,
              {
                imported_document_id: null,
                import_status: "omitido",
                error_message: classification.reason,
              },
              "trace_omitted",
            );
            logGmailXmlSync("attachment_omitted", {
              ...logContext,
              reason: classification.reason,
            });

            summary.omitted += 1;
            continue;
          }

          logGmailXmlSync("upload_pipeline", logContext);
          const result = await uploadDocumentContent({
            content,
            filename: trace.attachment_filename,
            mimeType: attachment.mime_type || "application/xml",
            relatedType: "general",
            companyId: activeContext.activeCompany.id,
            documentType: "factura",
            metadata: {
              ...trace,
              organization_id: activeContext.organization.id,
              user_id: user.id,
            },
          });
          const extraction = await getLatestDocumentExtraction(result.document.id);
          const extractedData = getExtractionData(extraction);
          const duplicateByClave =
            extractionHasUsefulData(extraction) &&
            (await hasDuplicateXmlClave({
              clave: extractedData.clave,
              documentId: result.document.id,
              organizationId: activeContext.organization.id,
            }));
          const status: GmailXmlImportStatus =
            result.warningCode || extraction?.extraction_status === "error"
              ? "error"
              : duplicateByClave
                ? "duplicado"
                : "procesado";
          const errorMessage =
            status === "error"
              ? extraction?.error_message ?? "No se pudo procesar el XML."
              : null;

          await updateGmailImportTrace(
            traceSupabase,
            importRowId,
            {
              imported_document_id: result.document.id,
              import_status: status,
              error_message: errorMessage,
            },
            "trace_import_result",
          );
          logGmailXmlSync("trace_import_result", {
            ...logContext,
            import_status: status,
            imported_document_id: result.document.id,
          });

          if (status === "procesado") {
            summary.imported += 1;
          } else if (status === "duplicado") {
            summary.duplicates += 1;
          } else {
            summary.errors += 1;
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error, "No se pudo importar el XML.");
          logGmailXmlSyncError("attachment_failed", logContext, error);
          summary.errors += 1;
          await updateGmailImportTrace(
            traceSupabase,
            importRowId,
            {
              import_status: "error",
              error_message: errorMessage,
            },
            "trace_error",
          );
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error, "No se pudo preparar el XML.");
        logGmailXmlSyncError("attachment_prepare_failed", logContext, error);
        summary.errors += 1;

        await upsertGmailImportTrace(
          traceSupabase,
          {
            ...trace,
            organization_id: activeContext.organization.id,
            user_id: user.id,
            import_status: "error",
            imported_document_id: null,
            error_message: errorMessage,
          },
          "trace_prepare_error",
        );
      }
    }
  }

  await supabase
    .from("gmail_xml_connections")
    .update({
      last_list_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return summary;
}

export async function getGmailXmlDashboard(
  shouldListMessages = false,
): Promise<GmailXmlDashboard> {
  await assertInternalUser();
  const activeContext = await getActiveContext();
  const { supabase, user } = await getAuthenticatedSupabase();

  if (!activeContext.organization) {
    return {
      activeContext,
      connection: null,
      candidates: [],
      recentImports: [],
    };
  }

  const { data: connection, error } = await supabase
    .from("gmail_xml_connections")
    .select(
      "id, organization_id, company_id, user_id, gmail_email, connected_at, last_test_at, last_list_at, active",
    )
    .eq("organization_id", activeContext.organization.id)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeContext,
    connection: (connection as GmailXmlConnection | null) ?? null,
    candidates: connection && shouldListMessages ? await listGmailXmlMessages() : [],
    recentImports: await getRecentGmailXmlImports(),
  };
}
