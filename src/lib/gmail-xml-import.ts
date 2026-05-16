import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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
  attachment_filenames: string[];
};

export type GmailXmlDashboard = {
  activeContext: Awaited<ReturnType<typeof getActiveContext>>;
  connection: GmailXmlConnection | null;
  candidates: GmailXmlCandidate[];
};

type GmailMessagePart = {
  filename?: string;
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
  return getMessageParts(message.payload)
    .map((part) => part.filename?.trim() ?? "")
    .filter((filename) => filename.toLowerCase().endsWith(".xml"));
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
  const search = new URLSearchParams({
    q: "filename:xml has:attachment",
    maxResults: String(limit),
  });
  const listResponse = await gmailFetch<{ messages?: Array<{ id: string }> }>(
    accessToken,
    `/messages?${search.toString()}`,
  );
  const messages: GmailXmlCandidate[] = [];

  for (const item of listResponse.messages ?? []) {
    const message = await gmailFetch<GmailMessage>(
      accessToken,
      `/messages/${item.id}?format=full&metadataHeaders=From&metadataHeaders=Subject`,
    );
    const attachmentFilenames = getXmlAttachmentFilenames(message);

    if (attachmentFilenames.length === 0) {
      continue;
    }

    messages.push({
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId ?? null,
      from: getHeader(message, "from"),
      subject: getHeader(message, "subject"),
      received_at: message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null,
      attachment_filenames: attachmentFilenames,
    });
  }

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

export async function getGmailXmlDashboard(
  shouldListMessages = false,
): Promise<GmailXmlDashboard> {
  await assertInternalUser();
  const activeContext = await getActiveContext();
  const { supabase, user } = await getAuthenticatedSupabase();

  if (!activeContext.organization) {
    return { activeContext, connection: null, candidates: [] };
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
  };
}
