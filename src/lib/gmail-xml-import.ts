import { getActiveContext } from "@/lib/active-context";
import {
  extractionHasUsefulData,
  type DocumentExtraction,
} from "@/lib/document-processing";
import { assertInternalUser } from "@/lib/permissions";
import {
  uploadDocumentContent,
  uploadDocumentContentForSystem,
} from "@/lib/storage";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createSupabaseServiceClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_XML_PENDING_LABEL = "OM7/Pendientes";
const GMAIL_XML_IMPORTED_LABEL = "OM7/Importadas";
const GMAIL_XML_DUPLICATED_LABEL = "OM7/Duplicadas";
const GMAIL_XML_ERROR_LABEL = "OM7/Error";
const GMAIL_XML_MAX_RETRY_ATTEMPTS = 3;
const GMAIL_XML_DEFAULT_LIMIT = 20;
const GMAIL_XML_ALLOWED_LIMITS = [20, 50, 100] as const;
const GMAIL_XML_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GMAIL_XML_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export type GmailXmlConnection = {
  id: string;
  organization_id: string;
  company_id: string | null;
  user_id: string;
  gmail_email: string | null;
  connected_at: string | null;
  last_test_at: string | null;
  last_list_at: string | null;
  last_sync_at?: string | null;
  last_sync_status?: "ok" | "error" | null;
  last_sync_error?: string | null;
  auto_sync_enabled?: boolean | null;
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
  company_id: string | null;
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
  sync_mode?: GmailXmlSyncMode | null;
  date_from?: string | null;
  date_to?: string | null;
  gmail_query?: string | null;
  batch_period?: string | null;
  has_more_results?: boolean | null;
  created_at: string | null;
};

export type GmailXmlSyncMode = "daily" | "historical";

export type GmailXmlRunOptions = {
  mode?: GmailXmlSyncMode;
  dateFrom?: string | null;
  dateTo?: string | null;
  batchPeriod?: string | null;
};

export type GmailXmlDashboard = {
  activeContext: Awaited<ReturnType<typeof getActiveContext>>;
  connection: GmailXmlConnection | null;
  currentUserEmail: string | null;
  gmailXmlEnabled: boolean;
  candidates: GmailXmlCandidate[];
  recentImports: GmailXmlImportRecord[];
  lastSyncAt: string | null;
  listLimit: number;
  listedMessages: number;
  listedXmlAttachments: number;
  hasMoreResults: boolean;
  gmailQuery: string | null;
  syncPeriod: GmailXmlSyncPeriod | null;
};

export type GmailXmlSyncPeriod = {
  id: string;
  organization_id: string;
  company_id: string;
  period_key: string;
  date_from: string;
  date_to: string;
  gmail_query: string | null;
  status: string;
  found_count: number;
  processed_count: number;
  imported_count: number;
  duplicated_count: number;
  omitted_count: number;
  error_count: number;
  has_more_results: boolean;
  last_synced_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  company_id: string;
  user_id: string;
  import_status: GmailXmlImportStatus;
  imported_document_id?: string | null;
  error_message?: string | null;
  sync_attempts?: number;
  last_attempt_at?: string | null;
  gmail_labels_updated_at?: string | null;
  sync_mode?: GmailXmlSyncMode;
  date_from?: string | null;
  date_to?: string | null;
  gmail_query?: string | null;
  batch_period?: string | null;
  has_more_results?: boolean;
};

type GmailXmlSyncConnection = {
  id: string;
  organization_id: string;
  company_id: string | null;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type GmailXmlSyncContext = {
  connection: GmailXmlSyncConnection;
  organizationId: string;
  companyId: string;
  userId: string;
  supabase: SupabaseClient;
  traceSupabase: SupabaseClient;
  system: boolean;
  usePendingLabel: boolean;
  updateLabels: boolean;
  limit: number;
  options?: GmailXmlRunOptions;
};

export type GmailXmlSyncSummary = {
  totalFound: number;
  messagesScanned: number;
  hasMoreResults: boolean;
  imported: number;
  duplicates: number;
  omitted: number;
  errors: number;
  labelsUpdated: number;
};

export type GmailXmlAutoSyncSummary = GmailXmlSyncSummary & {
  connections: number;
};

type GmailXmlMessagePage = {
  messages: Array<{
    message: GmailMessage;
    attachments: GmailXmlAttachmentCandidate[];
  }>;
  scannedMessages: number;
  xmlAttachments: number;
  hasMoreResults: boolean;
  nextPageToken: string | null;
  query: string;
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
  const redirectUri = validateGmailRedirectUri(
    process.env.GMAIL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI,
  );

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function validateGmailRedirectUri(value: string | undefined) {
  const redirectUri = value?.trim();

  if (!redirectUri) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("GOOGLE_REDIRECT_URI no es una URL valida.");
  }

  if (parsed.search || parsed.hash) {
    throw new Error("GOOGLE_REDIRECT_URI debe configurarse sin query ni hash.");
  }

  if (!parsed.pathname.endsWith("/api/auth/gmail/callback")) {
    throw new Error(
      "GOOGLE_REDIRECT_URI debe coincidir exactamente con /api/auth/gmail/callback.",
    );
  }

  return parsed.toString();
}

function encodeState(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeState(state: string) {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as Record<
      string,
      string
    >;
  } catch {
    throw new Error("La sesion OAuth de Gmail no es valida. Intenta conectar de nuevo.");
  }
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

function createGmailXmlServiceSupabase() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim();
  const supabaseEnv = getSupabaseEnv();

  if (!serviceRoleKey || !supabaseEnv) {
    throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY para autosync Gmail XML.");
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

export function normalizeGmailXmlLimit(value: unknown) {
  const limit = Number(value);

  return GMAIL_XML_ALLOWED_LIMITS.includes(
    limit as (typeof GMAIL_XML_ALLOWED_LIMITS)[number],
  )
    ? limit
    : GMAIL_XML_DEFAULT_LIMIT;
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

function isGmailXmlEnabledCompany(company: {
  gmail_xml_enabled?: boolean | null;
} | null) {
  return company?.gmail_xml_enabled === true;
}

async function isGmailXmlEnabledContext(
  supabase: SupabaseClient,
  organizationId: string,
  companyId: string | null,
) {
  if (!companyId) {
    return false;
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("gmail_xml_enabled")
    .eq("id", companyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message);
  }

  return isGmailXmlEnabledCompany(company);
}

async function assertGmailXmlEnabledContext(
  supabase: SupabaseClient,
  activeContext: Awaited<ReturnType<typeof getActiveContext>>,
) {
  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa antes de usar Gmail XML.");
  }

  if (!activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de usar Gmail XML.");
  }

  const allowed = await isGmailXmlEnabledContext(
    supabase,
    activeContext.organization.id,
    activeContext.activeCompany.id,
  );

  if (!allowed) {
    throw new Error(
      "Gmail XML no esta habilitado para esta empresa.",
    );
  }
}

async function upsertGmailImportTrace(
  supabase: SupabaseClient,
  payload: GmailXmlTraceWrite,
  stage: string,
) {
  const { data, error } = await supabase
    .from("gmail_xml_imports")
    .upsert(payload, {
      onConflict:
        "organization_id,company_id,user_id,gmail_message_id,gmail_attachment_id",
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
    gmail_labels_updated_at?: string | null;
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

function normalizeDateOnly(value: string | null | undefined) {
  const clean = String(value ?? "").trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function formatGmailQueryDate(value: string) {
  return value.replaceAll("-", "/");
}

function normalizeGmailXmlRunOptions(
  options?: GmailXmlRunOptions,
): Required<GmailXmlRunOptions> {
  const mode: GmailXmlSyncMode = options?.mode === "historical"
    ? "historical"
    : "daily";
  const dateFrom = normalizeDateOnly(options?.dateFrom);
  const dateTo = normalizeDateOnly(options?.dateTo);

  if (mode === "historical") {
    if (!dateFrom || !dateTo) {
      throw new Error("Selecciona fecha desde y fecha hasta para la carga historica.");
    }

    if (dateFrom >= dateTo) {
      throw new Error("La fecha desde debe ser menor que la fecha hasta.");
    }
  }

  return {
    mode,
    dateFrom,
    dateTo,
    batchPeriod: options?.batchPeriod?.trim() || dateFrom?.slice(0, 7) || null,
  };
}

function buildGmailXmlQuery(
  options: Required<GmailXmlRunOptions>,
  usePendingLabel: boolean,
) {
  if (options.mode === "historical") {
    return [
      `after:${formatGmailQueryDate(options.dateFrom ?? "")}`,
      `before:${formatGmailQueryDate(options.dateTo ?? "")}`,
      "has:attachment",
      "filename:xml",
    ].join(" ");
  }

  return usePendingLabel
    ? `label:"${GMAIL_XML_PENDING_LABEL}" filename:xml has:attachment`
    : "has:attachment filename:xml";
}

function getXmlTagValue(xmlText: string, tagName: string) {
  const match = xmlText.match(
    new RegExp(`<(?:[A-Za-z0-9_-]+:)?${tagName}[^>]*>([^<]+)<`, "i"),
  );

  return normalizeText(match?.[1]);
}

function getXmlClave(xmlText: string) {
  return getXmlTagValue(xmlText, "Clave");
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

async function getLatestDocumentExtraction(
  documentId: string,
  supabaseClient?: SupabaseClient,
) {
  const supabase =
    supabaseClient ?? (await getAuthenticatedSupabase()).supabase;
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

async function findDuplicateXmlClave({
  clave,
  documentId,
  companyId,
  organizationId,
  supabaseClient,
}: {
  clave: unknown;
  documentId?: string;
  companyId: string;
  organizationId: string;
  supabaseClient?: SupabaseClient;
}) {
  const cleanClave = normalizeText(clave);

  if (!cleanClave) {
    return null;
  }

  const supabase =
    supabaseClient ?? (await getAuthenticatedSupabase()).supabase;
  let query = supabase
    .from("document_extractions")
    .select("document_id")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("extraction_provider", "xml-parser-cr")
    .eq("extracted_data->>clave", cleanClave)
    .limit(1);

  if (documentId) {
    query = query.neq("document_id", documentId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.document_id ? String(data.document_id) : null;
}

async function getRecentGmailXmlImports() {
  const activeContext = await getActiveContext();
  const { supabase, user } = await getAuthenticatedSupabase();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return [] as GmailXmlImportRecord[];
  }

  const { data, error } = await supabase
    .from("gmail_xml_imports")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
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
  limit = GMAIL_XML_DEFAULT_LIMIT,
  usePendingLabel = false,
  options?: GmailXmlRunOptions,
): Promise<GmailXmlMessagePage> {
  const normalizedLimit = normalizeGmailXmlLimit(limit);
  const normalizedOptions = normalizeGmailXmlRunOptions(options);
  const query = buildGmailXmlQuery(normalizedOptions, usePendingLabel);
  const messages: Array<{
    message: GmailMessage;
    attachments: GmailXmlAttachmentCandidate[];
  }> = [];
  let scannedMessages = 0;
  let nextPageToken: string | null = null;

  do {
    const pageSize = Math.min(100, normalizedLimit - scannedMessages);
    const search = new URLSearchParams({
      q: query,
      maxResults: String(pageSize),
    });

    if (nextPageToken) {
      search.set("pageToken", nextPageToken);
    }

    const listResponse = await gmailFetch<{
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    }>(
      accessToken,
      `/messages?${search.toString()}`,
    );
    const pageItems = listResponse.messages ?? [];

    scannedMessages += pageItems.length;
    nextPageToken = listResponse.nextPageToken ?? null;

    for (const item of pageItems) {
      const message = await gmailFetch<GmailMessage>(
        accessToken,
        `/messages/${item.id}?format=full&metadataHeaders=From&metadataHeaders=Subject`,
      );
      const attachments = getXmlAttachments(message);

      if (attachments.length > 0) {
        messages.push({ message, attachments });
      }
    }
  } while (nextPageToken && scannedMessages < normalizedLimit);

  return {
    messages,
    scannedMessages,
    xmlAttachments: messages.reduce(
      (count, item) => count + uniqueAttachments(item.attachments).length,
      0,
    ),
    hasMoreResults: Boolean(nextPageToken),
    nextPageToken,
    query,
  };
}

async function getOrCreateGmailLabels(accessToken: string) {
  const labelResponse = await gmailFetch<{
    labels?: Array<{ id: string; name: string }>;
  }>(accessToken, "/labels");
  const labels = new Map(
    (labelResponse.labels ?? []).map((label) => [label.name, label.id]),
  );

  async function ensureLabel(name: string) {
    const existing = labels.get(name);

    if (existing) {
      return existing;
    }

    const created = await gmailFetch<{ id: string; name: string }>(
      accessToken,
      "/labels",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        }),
      },
    );

    labels.set(created.name, created.id);
    return created.id;
  }

  return {
    pending: await ensureLabel(GMAIL_XML_PENDING_LABEL),
    imported: await ensureLabel(GMAIL_XML_IMPORTED_LABEL),
    duplicated: await ensureLabel(GMAIL_XML_DUPLICATED_LABEL),
    error: await ensureLabel(GMAIL_XML_ERROR_LABEL),
  };
}

function getResultLabelId(
  labels: Awaited<ReturnType<typeof getOrCreateGmailLabels>>,
  status: GmailXmlImportStatus,
) {
  if (status === "procesado" || status === "omitido") {
    return labels.imported;
  }

  if (status === "duplicado") {
    return labels.duplicated;
  }

  return labels.error;
}

async function updateGmailMessageLabels(
  accessToken: string,
  messageId: string,
  labels: Awaited<ReturnType<typeof getOrCreateGmailLabels>>,
  status: GmailXmlImportStatus,
) {
  await gmailFetch<{ id: string }>(accessToken, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: [getResultLabelId(labels, status)],
      removeLabelIds:
        status === "procesado" || status === "duplicado" || status === "omitido"
          ? [labels.pending]
          : [],
    }),
  });
}

async function tryUpdateGmailMessageLabels(
  accessToken: string,
  messageId: string,
  labels: Awaited<ReturnType<typeof getOrCreateGmailLabels>> | null,
  status: GmailXmlImportStatus,
  context: Record<string, unknown>,
) {
  if (!labels) {
    return false;
  }

  try {
    await updateGmailMessageLabels(accessToken, messageId, labels, status);
    return true;
  } catch (error) {
    logGmailXmlSyncError("gmail_label_update_failed", context, error);
    return false;
  }
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
  return `Sincronizacion lista: ${summary.totalFound} XML encontrados en ${summary.messagesScanned} correos revisados, ${summary.imported} importados, ${summary.duplicates} duplicados, ${summary.omitted} omitidos, ${summary.errors} errores, ${summary.labelsUpdated} labels actualizados${summary.hasMoreResults ? ". Hay mas resultados pendientes" : ""}.`;
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

function getTraceRunMetadata(
  options: Required<GmailXmlRunOptions>,
  query: string,
  hasMoreResults: boolean,
) {
  return {
    sync_mode: options.mode,
    date_from: options.dateFrom,
    date_to: options.dateTo,
    gmail_query: query,
    batch_period: options.batchPeriod,
    has_more_results: hasMoreResults,
  };
}

async function getGmailXmlSyncPeriod(
  supabase: SupabaseClient,
  organizationId: string,
  companyId: string,
  options: Required<GmailXmlRunOptions>,
) {
  if (options.mode !== "historical" || !options.batchPeriod) {
    return null;
  }

  const { data, error } = await supabase
    .from("gmail_xml_sync_periods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("company_id", companyId)
    .eq("period_key", options.batchPeriod)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return null;
    }

    throw new Error(error.message);
  }

  return (data as GmailXmlSyncPeriod | null) ?? null;
}

async function upsertGmailXmlSyncPeriod(
  supabase: SupabaseClient,
  payload: {
    organization_id: string;
    company_id: string;
    period_key: string;
    date_from: string;
    date_to: string;
    gmail_query: string;
    status: string;
    found_count: number;
    processed_count?: number;
    imported_count?: number;
    duplicated_count?: number;
    omitted_count?: number;
    error_count?: number;
    has_more_results: boolean;
    last_synced_at?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("gmail_xml_sync_periods")
    .upsert(payload, {
      onConflict: "organization_id,company_id,period_key",
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "42P01") {
      return null;
    }

    throw new Error(error?.message ?? "No se pudo guardar el periodo Gmail XML.");
  }

  return data as GmailXmlSyncPeriod;
}

async function assertHistoricalPeriodIsOpen(
  supabase: SupabaseClient,
  organizationId: string,
  companyId: string,
  options: Required<GmailXmlRunOptions>,
) {
  const period = await getGmailXmlSyncPeriod(
    supabase,
    organizationId,
    companyId,
    options,
  );

  if (period?.status === "cerrado") {
    throw new Error("Este periodo historico esta cerrado. Reabre el periodo antes de sincronizar.");
  }
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
}, supabaseClient?: SupabaseClient) {
  const supabase =
    supabaseClient ?? (await getAuthenticatedSupabase()).supabase;
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

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de usar Gmail.");
  }

  await assertGmailXmlEnabledContext(supabase, activeContext);

  const { data: connection, error } = await supabase
    .from("gmail_xml_connections")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
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
  const { supabase } = await getAuthenticatedSupabase();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de conectar Gmail.");
  }

  await assertGmailXmlEnabledContext(supabase, activeContext);

  const env = getGmailEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", GMAIL_XML_SCOPES.join(" "));
  url.searchParams.set(
    "state",
    encodeState({
      userId: currentUser.userId,
      organizationId: activeContext.organization.id,
      companyId: activeContext.activeCompany?.id ?? "",
      nonce: randomUUID(),
      issuedAt: String(Date.now()),
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

  const issuedAt = Number(stateData.issuedAt);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > GMAIL_XML_OAUTH_STATE_TTL_MS) {
    throw new Error("La sesion OAuth de Gmail expiro. Intenta conectar de nuevo.");
  }

  if (!stateData.nonce) {
    throw new Error("La sesion OAuth de Gmail no es valida. Intenta conectar de nuevo.");
  }

  const activeContext = await getActiveContext();
  if (
    activeContext.organization?.id !== stateData.organizationId ||
    activeContext.activeCompany?.id !== stateData.companyId
  ) {
    throw new Error(
      "La empresa activa cambio durante OAuth. Selecciona la empresa correcta e intenta conectar de nuevo.",
    );
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
      company_id: stateData.companyId,
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
    { onConflict: "organization_id,user_id,company_id" },
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

export async function listGmailXmlMessages(
  limit = GMAIL_XML_DEFAULT_LIMIT,
  options?: GmailXmlRunOptions,
): Promise<GmailXmlMessagePage & { candidates: GmailXmlCandidate[] }> {
  const { activeContext, connection } = await getActiveConnection();
  const normalizedOptions = normalizeGmailXmlRunOptions(options);
  const accessToken = await getConnectionAccessToken(connection);
  const page = await getGmailXmlMessagesWithAttachments(
    accessToken,
    limit,
    normalizedOptions.mode === "daily",
    normalizedOptions,
  );
  const candidates = page.messages.map(({ message, attachments }) => ({
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

  if (
    normalizedOptions.mode === "historical" &&
    activeContext.organization &&
    activeContext.activeCompany &&
    normalizedOptions.batchPeriod
  ) {
    await upsertGmailXmlSyncPeriod(supabase, {
      organization_id: activeContext.organization.id,
      company_id: activeContext.activeCompany.id,
      period_key: normalizedOptions.batchPeriod,
      date_from: normalizedOptions.dateFrom ?? "",
      date_to: normalizedOptions.dateTo ?? "",
      gmail_query: page.query,
      status: "buscado",
      found_count: page.xmlAttachments,
      processed_count: 0,
      imported_count: 0,
      duplicated_count: 0,
      omitted_count: 0,
      error_count: 0,
      has_more_results: page.hasMoreResults,
      last_synced_at: null,
    });
  }

  return {
    ...page,
    candidates,
  };
}

async function syncGmailXmlConnection(
  context: GmailXmlSyncContext,
): Promise<GmailXmlSyncSummary> {
  const {
    connection,
    organizationId,
    companyId,
    userId,
    supabase,
    traceSupabase,
    system,
    usePendingLabel,
    updateLabels,
    limit,
    options,
  } = context;
  const normalizedOptions = normalizeGmailXmlRunOptions(options);
  if (normalizedOptions.mode === "historical") {
    await assertHistoricalPeriodIsOpen(
      traceSupabase,
      organizationId,
      companyId,
      normalizedOptions,
    );
  }
  const accessToken = await getConnectionAccessToken(connection, supabase);
  let labels: Awaited<ReturnType<typeof getOrCreateGmailLabels>> | null = null;

  if (updateLabels) {
    try {
      labels = await getOrCreateGmailLabels(accessToken);
    } catch (error) {
      logGmailXmlSyncError(
        "gmail_labels_init_failed",
        {
          organization_id: organizationId,
          user_id: userId,
        },
        error,
      );
    }
  }
  const gmailPage = await getGmailXmlMessagesWithAttachments(
    accessToken,
    limit,
    usePendingLabel && Boolean(labels),
    normalizedOptions,
  );
  const traceRunMetadata = getTraceRunMetadata(
    normalizedOptions,
    gmailPage.query,
    gmailPage.hasMoreResults,
  );
  const summary: GmailXmlSyncSummary = {
    totalFound: gmailPage.xmlAttachments,
    messagesScanned: gmailPage.scannedMessages,
    hasMoreResults: gmailPage.hasMoreResults,
    imported: 0,
    duplicates: 0,
    omitted: 0,
    errors: 0,
    labelsUpdated: 0,
  };
  const baseLogContext = {
    organization_id: organizationId,
    company_id: companyId,
    user_id: userId,
  };

  logGmailXmlSync("attachments_found", {
    ...baseLogContext,
    count: summary.totalFound,
    messages_scanned: summary.messagesScanned,
    has_more_results: summary.hasMoreResults,
    query: gmailPage.query,
  });

  for (const { message, attachments } of gmailPage.messages) {
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
          .select("id, import_status, sync_attempts")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .eq("user_id", userId)
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
          if (
            await tryUpdateGmailMessageLabels(
              accessToken,
              trace.gmail_message_id,
              labels,
              existing.import_status as GmailXmlImportStatus,
              logContext,
            )
          ) {
            summary.labelsUpdated += 1;
          }
          continue;
        }

        const currentAttempts = Number(existing?.sync_attempts ?? 0);

        if (existing?.import_status === "error" && currentAttempts >= GMAIL_XML_MAX_RETRY_ATTEMPTS) {
          summary.errors += 1;
          if (
            await tryUpdateGmailMessageLabels(
              accessToken,
              trace.gmail_message_id,
              labels,
              "error",
              logContext,
            )
          ) {
            summary.labelsUpdated += 1;
          }
          continue;
        }

        const importRowId = await upsertGmailImportTrace(
          traceSupabase,
          {
            ...trace,
            ...traceRunMetadata,
            organization_id: organizationId,
            company_id: companyId,
            user_id: userId,
            import_status: "pendiente",
            imported_document_id: null,
            error_message: null,
            sync_attempts: currentAttempts + 1,
            last_attempt_at: new Date().toISOString(),
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
          const xmlClave = getXmlClave(xmlText);

          if (!classification.importable) {
            await updateGmailImportTrace(
              traceSupabase,
              importRowId,
              {
                imported_document_id: null,
                import_status: "omitido",
                error_message: classification.reason,
                gmail_labels_updated_at: labels ? new Date().toISOString() : null,
              },
              "trace_omitted",
            );
            logGmailXmlSync("attachment_omitted", {
              ...logContext,
              reason: classification.reason,
            });

            summary.omitted += 1;
            if (
              await tryUpdateGmailMessageLabels(
                accessToken,
                trace.gmail_message_id,
                labels,
                "omitido",
                logContext,
              )
            ) {
              summary.labelsUpdated += 1;
            }
            continue;
          }

          const existingDocumentId = await findDuplicateXmlClave({
            clave: xmlClave,
            companyId,
            organizationId,
            supabaseClient: traceSupabase,
          });

          if (existingDocumentId) {
            await updateGmailImportTrace(
              traceSupabase,
              importRowId,
              {
                imported_document_id: existingDocumentId,
                import_status: "duplicado",
                error_message: "Duplicado fiscal protegido por clave XML existente.",
                gmail_labels_updated_at: labels ? new Date().toISOString() : null,
              },
              "trace_duplicate_before_upload",
            );
            logGmailXmlSync("duplicate_before_upload", {
              ...logContext,
              imported_document_id: existingDocumentId,
            });
            summary.duplicates += 1;
            if (
              await tryUpdateGmailMessageLabels(
                accessToken,
                trace.gmail_message_id,
                labels,
                "duplicado",
                logContext,
              )
            ) {
              summary.labelsUpdated += 1;
            }
            continue;
          }

          logGmailXmlSync("upload_pipeline", logContext);
          const uploadInput = {
            content,
            filename: trace.attachment_filename,
            mimeType: attachment.mime_type || "application/xml",
            relatedType: "general",
            companyId,
            documentType: "factura",
            metadata: {
              ...trace,
              organization_id: organizationId,
              company_id: companyId,
              user_id: userId,
            },
          } as const;
          const result = system
            ? await uploadDocumentContentForSystem(uploadInput, {
                userId,
                companyId,
              })
            : await uploadDocumentContent(uploadInput);
          const extraction = await getLatestDocumentExtraction(
            result.document.id,
            traceSupabase,
          );
          const extractedData = getExtractionData(extraction);
          const duplicateDocumentId = extractionHasUsefulData(extraction)
            ? await findDuplicateXmlClave({
                clave: extractedData.clave,
                documentId: result.document.id,
                companyId,
                organizationId,
                supabaseClient: traceSupabase,
              })
            : null;
          const status: GmailXmlImportStatus =
            result.warningCode || extraction?.extraction_status === "error"
              ? "error"
              : duplicateDocumentId
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
              imported_document_id: duplicateDocumentId || result.document.id,
              import_status: status,
              error_message: errorMessage,
              gmail_labels_updated_at: labels ? new Date().toISOString() : null,
            },
            "trace_import_result",
          );
          logGmailXmlSync("trace_import_result", {
            ...logContext,
            import_status: status,
            imported_document_id: duplicateDocumentId || result.document.id,
          });

          if (status === "procesado") {
            summary.imported += 1;
          } else if (status === "duplicado") {
            summary.duplicates += 1;
          } else {
            summary.errors += 1;
          }
          if (
            await tryUpdateGmailMessageLabels(
              accessToken,
              trace.gmail_message_id,
              labels,
              status,
              logContext,
            )
          ) {
            summary.labelsUpdated += 1;
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
              gmail_labels_updated_at: labels ? new Date().toISOString() : null,
            },
            "trace_error",
          );
          if (
            await tryUpdateGmailMessageLabels(
              accessToken,
              trace.gmail_message_id,
              labels,
              "error",
              logContext,
            )
          ) {
            summary.labelsUpdated += 1;
          }
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error, "No se pudo preparar el XML.");
        logGmailXmlSyncError("attachment_prepare_failed", logContext, error);
        summary.errors += 1;

        await upsertGmailImportTrace(
          traceSupabase,
          {
            ...trace,
            ...traceRunMetadata,
            organization_id: organizationId,
            company_id: companyId,
            user_id: userId,
            import_status: "error",
            imported_document_id: null,
            error_message: errorMessage,
            sync_attempts: 1,
            last_attempt_at: new Date().toISOString(),
            gmail_labels_updated_at: labels ? new Date().toISOString() : null,
          },
          "trace_prepare_error",
        );
        if (
          await tryUpdateGmailMessageLabels(
            accessToken,
            trace.gmail_message_id,
            labels,
            "error",
            logContext,
          )
        ) {
          summary.labelsUpdated += 1;
        }
      }
    }
  }

  await supabase
    .from("gmail_xml_connections")
    .update({
      last_list_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
      last_sync_summary: summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (normalizedOptions.mode === "historical" && normalizedOptions.batchPeriod) {
    await upsertGmailXmlSyncPeriod(traceSupabase, {
      organization_id: organizationId,
      company_id: companyId,
      period_key: normalizedOptions.batchPeriod,
      date_from: normalizedOptions.dateFrom ?? "",
      date_to: normalizedOptions.dateTo ?? "",
      gmail_query: gmailPage.query,
      status: summary.errors > 0 ? "pendiente_revision" : "importado",
      found_count: summary.totalFound,
      processed_count:
        summary.imported + summary.duplicates + summary.omitted + summary.errors,
      imported_count: summary.imported,
      duplicated_count: summary.duplicates,
      omitted_count: summary.omitted,
      error_count: summary.errors,
      has_more_results: summary.hasMoreResults,
      last_synced_at: new Date().toISOString(),
    });
  }

  return summary;
}

export async function syncGmailXmlAttachments(
  limit = GMAIL_XML_DEFAULT_LIMIT,
  options?: GmailXmlRunOptions,
): Promise<GmailXmlSyncSummary> {
  const { activeContext, connection } = await getActiveConnection();
  const { supabase, user } = await getAuthenticatedSupabase();
  const traceSupabase = await getGmailTraceSupabase(supabase);

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de importar XML desde Gmail.");
  }

  if (
    !(await isGmailXmlEnabledContext(
      traceSupabase,
      activeContext.organization.id,
      activeContext.activeCompany.id,
    ))
  ) {
    throw new Error(
      "Gmail XML no esta habilitado para esta empresa.",
    );
  }

  return syncGmailXmlConnection({
    connection: {
      ...(connection as GmailXmlSyncConnection),
      organization_id: activeContext.organization.id,
      company_id: activeContext.activeCompany.id,
      user_id: user.id,
    },
    organizationId: activeContext.organization.id,
    companyId: activeContext.activeCompany.id,
    userId: user.id,
    supabase,
    traceSupabase,
    system: true,
    usePendingLabel: true,
    updateLabels: true,
    limit: normalizeGmailXmlLimit(limit),
    options,
  });
}

async function getSyncCompanyId(
  supabase: SupabaseClient,
  connection: GmailXmlSyncConnection,
) {
  if (connection.company_id) {
    return connection.company_id;
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("organization_id", connection.organization_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "La conexion Gmail no tiene empresa asociada.");
  }

  return data.id as string;
}

function mergeAutoSyncSummary(
  target: GmailXmlAutoSyncSummary,
  summary: GmailXmlSyncSummary,
) {
  target.totalFound += summary.totalFound;
  target.messagesScanned += summary.messagesScanned;
  target.hasMoreResults = target.hasMoreResults || summary.hasMoreResults;
  target.imported += summary.imported;
  target.duplicates += summary.duplicates;
  target.omitted += summary.omitted;
  target.errors += summary.errors;
  target.labelsUpdated += summary.labelsUpdated;
}

export async function runGmailXmlAutoSync(
  limitPerConnection = GMAIL_XML_DEFAULT_LIMIT,
): Promise<GmailXmlAutoSyncSummary> {
  const normalizedLimit = normalizeGmailXmlLimit(limitPerConnection);
  const supabase = createGmailXmlServiceSupabase();
  const { data, error } = await supabase
    .from("gmail_xml_connections")
    .select(
      "id, organization_id, company_id, user_id, access_token, refresh_token, expires_at",
    )
    .eq("active", true)
    .eq("auto_sync_enabled", true)
    .not("company_id", "is", null)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const total: GmailXmlAutoSyncSummary = {
    connections: data?.length ?? 0,
    totalFound: 0,
    messagesScanned: 0,
    hasMoreResults: false,
    imported: 0,
    duplicates: 0,
    omitted: 0,
    errors: 0,
    labelsUpdated: 0,
  };

  for (const connection of (data ?? []) as GmailXmlSyncConnection[]) {
    try {
      const companyId = await getSyncCompanyId(supabase, connection);

      if (
        !(await isGmailXmlEnabledContext(
          supabase,
          connection.organization_id,
          companyId,
        ))
      ) {
        logGmailXmlSync("auto_sync_skipped_disabled_company", {
          organization_id: connection.organization_id,
          company_id: companyId,
          user_id: connection.user_id,
          connection_id: connection.id,
        });
        continue;
      }

      const summary = await syncGmailXmlConnection({
        connection,
        organizationId: connection.organization_id,
        companyId,
        userId: connection.user_id,
        supabase,
        traceSupabase: supabase,
        system: true,
        usePendingLabel: true,
        updateLabels: true,
        limit: normalizedLimit,
        options: { mode: "daily" },
      });

      mergeAutoSyncSummary(total, summary);
    } catch (error) {
      total.errors += 1;
      const errorMessage = getErrorMessage(error, "No se pudo ejecutar autosync Gmail XML.");
      logGmailXmlSyncError(
        "auto_sync_connection_failed",
        {
          organization_id: connection.organization_id,
          user_id: connection.user_id,
          connection_id: connection.id,
        },
        error,
      );
      await supabase
        .from("gmail_xml_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }
  }

  return total;
}

export async function getGmailXmlDashboard(
  shouldListMessages = false,
  limit = GMAIL_XML_DEFAULT_LIMIT,
  options?: GmailXmlRunOptions,
): Promise<GmailXmlDashboard> {
  await assertInternalUser();
  const activeContext = await getActiveContext();
  const { supabase, user } = await getAuthenticatedSupabase();

  const normalizedLimit = normalizeGmailXmlLimit(limit);

  if (!activeContext.organization) {
    return {
      activeContext,
      connection: null,
      currentUserEmail: user.email ?? null,
      gmailXmlEnabled: false,
      candidates: [],
      recentImports: [],
      lastSyncAt: null,
      listLimit: normalizedLimit,
      listedMessages: 0,
      listedXmlAttachments: 0,
      hasMoreResults: false,
      gmailQuery: null,
      syncPeriod: null,
    };
  }

  let connection: GmailXmlConnection | null = null;

  if (activeContext.activeCompany) {
    const { data: scopedConnection, error: connectionError } = await supabase
      .from("gmail_xml_connections")
      .select(
        "id, organization_id, company_id, user_id, gmail_email, connected_at, last_test_at, last_list_at, last_sync_at, last_sync_status, last_sync_error, auto_sync_enabled, active",
      )
      .eq("organization_id", activeContext.organization.id)
      .eq("company_id", activeContext.activeCompany.id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    connection = (scopedConnection as GmailXmlConnection | null) ?? null;
  }

  const gmailXmlEnabled = await isGmailXmlEnabledContext(
    supabase,
    activeContext.organization.id,
    activeContext.activeCompany?.id ?? null,
  );
  const normalizedOptions = normalizeGmailXmlRunOptions(options);
  const syncPeriod = activeContext.activeCompany
    ? await getGmailXmlSyncPeriod(
        supabase,
        activeContext.organization.id,
        activeContext.activeCompany.id,
        normalizedOptions,
      )
    : null;

  const listPage = connection && shouldListMessages && gmailXmlEnabled
    ? await listGmailXmlMessages(normalizedLimit, normalizedOptions)
    : null;

  return {
    activeContext,
    connection,
    currentUserEmail: user.email ?? null,
    gmailXmlEnabled,
    candidates: listPage?.candidates ?? [],
    recentImports: await getRecentGmailXmlImports(),
    lastSyncAt: connection?.last_sync_at ?? null,
    listLimit: normalizedLimit,
    listedMessages: listPage?.scannedMessages ?? 0,
    listedXmlAttachments: listPage?.xmlAttachments ?? 0,
    hasMoreResults: listPage?.hasMoreResults ?? false,
    gmailQuery: listPage?.query ?? null,
    syncPeriod: listPage && activeContext.activeCompany && normalizedOptions.mode === "historical"
      ? await getGmailXmlSyncPeriod(
          supabase,
          activeContext.organization.id,
          activeContext.activeCompany.id,
          normalizedOptions,
        )
      : syncPeriod,
  };
}
