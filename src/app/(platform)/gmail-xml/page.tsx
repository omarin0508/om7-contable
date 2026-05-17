import Link from "next/link";
import {
  connectGmailXmlAction,
  listGmailXmlMessagesAction,
  syncGmailXmlAttachmentsAction,
  testGmailXmlConnectionAction,
} from "@/app/(platform)/gmail-xml/actions";
import { GmailSubmitButton } from "@/components/gmail/gmail-submit-button";
import { ModuleFrame } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import {
  getGmailXmlDashboard,
  normalizeGmailXmlLimit,
} from "@/lib/gmail-xml-import";

type GmailXmlPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function isDateOnly(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toDateInputValue(date);
}

function getDefaultHistoricalRange() {
  const now = new Date();
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    dateFrom: toDateInputValue(firstDay),
    dateTo: toDateInputValue(nextMonth),
  };
}

function getHistoricalRange(
  params: Record<string, string | string[] | undefined>,
) {
  const defaults = getDefaultHistoricalRange();
  const block = getParam(params, "block") === "15d"
    ? "15d"
    : getParam(params, "block") === "custom"
      ? "custom"
      : "monthly";
  const dateFromParam = getParam(params, "dateFrom");
  const dateToParam = getParam(params, "dateTo");
  const dateFrom = isDateOnly(dateFromParam) ? dateFromParam : defaults.dateFrom;
  const dateTo = isDateOnly(dateToParam)
    ? dateToParam
    : block === "15d"
      ? addDays(dateFrom, 15)
      : block === "monthly"
        ? addMonths(dateFrom, 1)
        : defaults.dateTo;
  const batchPeriod = dateFrom.slice(0, 7);

  return {
    block,
    dateFrom,
    dateTo,
    batchPeriod,
    previousFrom: block === "15d" ? addDays(dateFrom, -15) : addMonths(dateFrom, -1),
    previousTo: block === "15d" ? dateFrom : addMonths(dateTo, -1),
    nextFrom: block === "15d" ? dateTo : addMonths(dateFrom, 1),
    nextTo: block === "15d" ? addDays(dateTo, 15) : addMonths(dateTo, 1),
  };
}

function formatBlockLabel(dateFrom: string, block: string) {
  if (block === "15d") {
    return "15 dias";
  }

  if (block === "custom") {
    return "personalizado";
  }

  return new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateFrom}T00:00:00.000Z`));
}

function formatDate(value: string | null) {
  if (!value) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "error") {
    return "om7-chip om7-chip-rose";
  }

  if (status === "duplicado") {
    return "om7-chip om7-chip-amber";
  }

  if (status === "procesado") {
    return "om7-chip om7-chip-emerald";
  }

  if (status === "omitido") {
    return "om7-chip";
  }

  return "om7-chip om7-chip-cyan";
}

function getImportResultDetail(item: {
  import_status: string;
  imported_document_id: string | null;
  error_message: string | null;
}) {
  if (item.import_status === "procesado") {
    return item.imported_document_id
      ? "Documento creado correctamente en OM7."
      : "Procesado sin documento asociado.";
  }

  if (item.import_status === "duplicado") {
    return item.error_message || "Duplicado protegido; no se creo documento nuevo.";
  }

  if (item.import_status === "omitido") {
    return item.error_message || "XML omitido; no corresponde al pipeline documental.";
  }

  if (item.import_status === "error") {
    return item.error_message || "Error tecnico pendiente de revisar.";
  }

  return item.error_message || "Pendiente de procesamiento.";
}

function resultDetailClass(status: string) {
  if (status === "error") {
    return "text-rose-200/85";
  }

  if (status === "duplicado") {
    return "text-amber-100/85";
  }

  if (status === "omitido") {
    return "text-slate-400";
  }

  if (status === "procesado") {
    return "text-emerald-100/85";
  }

  return "text-slate-500";
}

export default async function GmailXmlPage({ searchParams }: GmailXmlPageProps) {
  const params = (await searchParams) ?? {};
  const notice = getParam(params, "notice");
  const error = getParam(params, "error");
  const mode = getParam(params, "mode") === "historical" ? "historical" : "daily";
  const historicalRange = getHistoricalRange(params);
  const shouldListMessages = getParam(params, "list") === "xml";
  const limit = normalizeGmailXmlLimit(getParam(params, "limit"));
  const {
    activeContext,
    connection,
    currentUserEmail,
    gmailXmlEnabled,
    candidates,
    recentImports,
    lastSyncAt,
    listLimit,
    listedMessages,
    listedXmlAttachments,
    hasMoreResults,
    gmailQuery,
    syncPeriod,
  } = await getGmailXmlDashboard(shouldListMessages, limit, {
    mode,
    dateFrom: mode === "historical" ? historicalRange.dateFrom : null,
    dateTo: mode === "historical" ? historicalRange.dateTo : null,
    batchPeriod: mode === "historical" ? historicalRange.batchPeriod : null,
  });
  const activeOrganizationName =
    activeContext.organization?.name ?? "Sin organizacion activa";
  const activeCompanyName =
    activeContext.activeCompany?.legal_name ??
    activeContext.activeCompany?.name ??
    "Sin empresa activa";
  const importedCount = recentImports.filter(
    (item) => item.import_status === "procesado",
  ).length;
  const duplicateCount = recentImports.filter(
    (item) => item.import_status === "duplicado",
  ).length;
  const errorCount = recentImports.filter(
    (item) => item.import_status === "error",
  ).length;
  const omittedCount = recentImports.filter(
    (item) => item.import_status === "omitido",
  ).length;
  const syncDisabledReason = !activeContext.activeCompany
    ? "Selecciona una empresa activa antes de sincronizar XML."
    : !gmailXmlEnabled
      ? "Gmail XML no esta habilitado para esta empresa."
      : !connection
        ? "Conecta Gmail antes de sincronizar XML."
        : connection.organization_id !== activeContext.organization?.id
          ? "La conexion Gmail no pertenece a la organizacion activa."
          : null;
  const gmailActionsDisabledReason = !gmailXmlEnabled
    ? "Gmail XML no esta habilitado para esta empresa."
    : null;
  const connectionStatusText = !gmailXmlEnabled
    ? "Modulo inactivo"
    : connection
      ? "Gmail conectado."
      : "Gmail XML habilitado, pendiente de conexion.";
  const canSync = !syncDisabledReason;
  const periodClosed = mode === "historical" && syncPeriod?.status === "cerrado";
  const canSyncPeriod = canSync && !periodClosed;
  const currentModeLabel = mode === "historical"
    ? "Carga historica"
    : "Operacion diaria";
  const blockLabel = formatBlockLabel(historicalRange.dateFrom, historicalRange.block);
  const latestError = recentImports.find(
    (item) => item.import_status === "error" && item.error_message,
  );

  return (
    <ModuleFrame>
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),rgba(255,255,255,0.045)] shadow-2xl shadow-cyan-950/20">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Fuente externa Gmail
            </p>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Importacion Gmail XML
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Busca correos con XML en Gmail y sincroniza adjuntos hacia el
              pipeline documental oficial de OM7.
            </p>
            <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm text-cyan-50">
              <p className="font-semibold">
                Esta bandeja Gmail esta vinculada a la organizacion activa.
              </p>
              <p className="mt-1 text-cyan-50/75">
                Empresa activa: {activeCompanyName}. Organizacion:{" "}
                {activeOrganizationName}.
              </p>
            </div>
            <PremiumCard className="mt-4 border-white/[0.08] bg-black/10 p-4">
              <p className="text-sm font-semibold text-white">Repositorio OM7</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                El diagnostico consulta documentos e imports ya guardados en la
                base de datos OM7; no busca correos en Gmail ni importa nada.
              </p>
              <Link className="mt-3 inline-flex om7-btn-ghost px-4 py-2.5" href="/gmail-xml/diagnostico">
                Abrir diagnostico
              </Link>
            </PremiumCard>
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={connectGmailXmlAction}>
                <GmailSubmitButton
                  className="om7-btn-primary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(gmailActionsDisabledReason)}
                  pendingLabel={connection ? "Reconectando..." : "Conectando..."}
                >
                  {connection ? "Reconectar Gmail" : "Conectar Gmail"}
                </GmailSubmitButton>
              </form>
              <form action={testGmailXmlConnectionAction}>
                <GmailSubmitButton
                  className="om7-btn-secondary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!connection || Boolean(gmailActionsDisabledReason)}
                  pendingLabel="Probando..."
                >
                  Probar conexion
                </GmailSubmitButton>
              </form>
              <form action={listGmailXmlMessagesAction}>
                <input name="limit" type="hidden" value={listLimit} />
                <input name="mode" type="hidden" value={mode} />
                <input name="dateFrom" type="hidden" value={historicalRange.dateFrom} />
                <input name="dateTo" type="hidden" value={historicalRange.dateTo} />
                <input name="batchPeriod" type="hidden" value={historicalRange.batchPeriod} />
                <GmailSubmitButton
                  className="om7-btn-ghost px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!connection || Boolean(gmailActionsDisabledReason)}
                  pendingLabel="Listando..."
                >
                  Listar correos XML
                </GmailSubmitButton>
              </form>
              <form action={syncGmailXmlAttachmentsAction}>
                <input name="limit" type="hidden" value={listLimit} />
                <input name="mode" type="hidden" value={mode} />
                <input name="dateFrom" type="hidden" value={historicalRange.dateFrom} />
                <input name="dateTo" type="hidden" value={historicalRange.dateTo} />
                <input name="batchPeriod" type="hidden" value={historicalRange.batchPeriod} />
                <GmailSubmitButton
                  className="om7-btn-primary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSync}
                  pendingLabel="Sincronizando XML..."
                >
                  {mode === "historical" ? "Sincronizar periodo" : "Sincronizar pendientes"}
                </GmailSubmitButton>
              </form>
            </div>
            <PremiumCard className="mt-5 border-white/[0.08] bg-black/10 p-4">
              <div className="flex flex-wrap gap-2">
                <Link
                  className={mode === "daily" ? "om7-chip om7-chip-cyan" : "om7-chip"}
                  href={`/gmail-xml?mode=daily&limit=${listLimit}`}
                >
                  Operacion diaria
                </Link>
                <Link
                  className={mode === "historical" ? "om7-chip om7-chip-cyan" : "om7-chip"}
                  href={`/gmail-xml?mode=historical&block=${historicalRange.block}&dateFrom=${historicalRange.dateFrom}&dateTo=${historicalRange.dateTo}&limit=${listLimit}`}
                >
                  Carga historica
                </Link>
              </div>

              {mode === "historical" ? (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-amber-100/80">
                    Este filtro busca en Gmail, no en la base de datos. La carga
                    historica siempre requiere fecha desde y fecha hasta.
                  </p>
                  <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" action="/gmail-xml">
                    <input name="mode" type="hidden" value="historical" />
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">Fecha desde</span>
                      <input
                        className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                        defaultValue={historicalRange.dateFrom}
                        name="dateFrom"
                        type="date"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">Fecha hasta</span>
                      <input
                        className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                        defaultValue={historicalRange.dateTo}
                        name="dateTo"
                        type="date"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">Bloque</span>
                      <select
                        className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                        defaultValue={historicalRange.block}
                        name="block"
                      >
                        <option className="bg-slate-950" value="monthly">mensual</option>
                        <option className="bg-slate-950" value="15d">15 dias</option>
                        <option className="bg-slate-950" value="custom">personalizado</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">Limite</span>
                      <select
                        className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none"
                        defaultValue={listLimit}
                        name="limit"
                      >
                        {[20, 50, 100].map((option) => (
                          <option className="bg-slate-950" key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="om7-btn-secondary mt-5 h-10 px-4" type="submit">
                      Aplicar bloque
                    </button>
                  </form>

                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm text-cyan-50">
                    <p className="font-semibold">Bloque actual: {blockLabel}</p>
                    <p className="mt-1 text-cyan-50/75">
                      Desde {historicalRange.dateFrom} hasta {historicalRange.dateTo}
                    </p>
                    <p className="mt-1 text-cyan-50/75">
                      Estado del periodo: {syncPeriod?.status ?? "pendiente"}.
                      Encontrados: {syncPeriod?.found_count ?? 0}. Procesados:{" "}
                      {syncPeriod?.processed_count ?? 0}.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="om7-btn-ghost px-4 py-2.5"
                      href={`/gmail-xml?mode=historical&block=${historicalRange.block}&dateFrom=${historicalRange.previousFrom}&dateTo=${historicalRange.previousTo}&limit=${listLimit}`}
                    >
                      Bloque anterior
                    </Link>
                    <form action={listGmailXmlMessagesAction}>
                      <input name="mode" type="hidden" value="historical" />
                      <input name="dateFrom" type="hidden" value={historicalRange.dateFrom} />
                      <input name="dateTo" type="hidden" value={historicalRange.dateTo} />
                      <input name="batchPeriod" type="hidden" value={historicalRange.batchPeriod} />
                      <input name="limit" type="hidden" value={listLimit} />
                      <GmailSubmitButton
                        className="om7-btn-secondary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!connection || Boolean(gmailActionsDisabledReason)}
                        pendingLabel="Buscando..."
                      >
                        Buscar XML del periodo
                      </GmailSubmitButton>
                    </form>
                    <form action={syncGmailXmlAttachmentsAction}>
                      <input name="mode" type="hidden" value="historical" />
                      <input name="dateFrom" type="hidden" value={historicalRange.dateFrom} />
                      <input name="dateTo" type="hidden" value={historicalRange.dateTo} />
                      <input name="batchPeriod" type="hidden" value={historicalRange.batchPeriod} />
                      <input name="limit" type="hidden" value={listLimit} />
                      <GmailSubmitButton
                        className="om7-btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canSyncPeriod}
                        pendingLabel="Sincronizando..."
                      >
                        Sincronizar periodo
                      </GmailSubmitButton>
                    </form>
                    <Link
                      className="om7-btn-ghost px-4 py-2.5"
                      href={`/gmail-xml?mode=historical&block=${historicalRange.block}&dateFrom=${historicalRange.nextFrom}&dateTo=${historicalRange.nextTo}&limit=${listLimit}`}
                    >
                      Siguiente bloque
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Este modo procesa correos nuevos o pendientes. Cuando existen
                  labels operativos usa OM7/Pendientes; si no hay label
                  disponible, usa una busqueda controlada de adjuntos XML con el
                  limite configurado.
                </p>
              )}
            </PremiumCard>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Limite por corrida</span>
              {[20, 50, 100].map((option) => (
                <Link
                  className={
                    option === listLimit
                      ? "om7-chip om7-chip-cyan"
                      : "om7-chip"
                  }
                  href={
                    mode === "historical"
                      ? `/gmail-xml?mode=historical&block=${historicalRange.block}&dateFrom=${historicalRange.dateFrom}&dateTo=${historicalRange.dateTo}&list=xml&limit=${option}`
                      : `/gmail-xml?mode=daily&list=xml&limit=${option}`
                  }
                  key={option}
                >
                  {option}
                </Link>
              ))}
            </div>
            {gmailActionsDisabledReason ? (
              <p className="mt-3 text-sm text-amber-200/85">
                {gmailActionsDisabledReason}
              </p>
            ) : syncDisabledReason ? (
              <p className="mt-3 text-sm text-amber-200/85">
                {syncDisabledReason}
              </p>
            ) : (
              <p className="mt-3 text-sm text-cyan-100/75">
                {connectionStatusText}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-100 sm:col-span-2">
              <p className="text-base font-semibold tracking-tight">
                {activeCompanyName}
              </p>
              <p className="mt-1 text-xs text-current/70">
                empresa activa
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100 sm:col-span-2">
              <p className="text-base font-semibold tracking-tight">
                {activeOrganizationName}
              </p>
              <p className="mt-1 text-xs text-current/70">
                organizacion
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100">
              <p className="text-2xl font-semibold tracking-tight">
                {connection ? "OK" : "Pendiente"}
              </p>
              <p className="mt-1 text-xs text-current/70">estado de conexion</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100">
              <p className="text-base font-semibold tracking-tight">
                {currentModeLabel}
              </p>
              <p className="mt-1 text-xs text-current/70">modo activo</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-100">
              <p className="text-2xl font-semibold tracking-tight">
                {candidates.length}
              </p>
              <p className="mt-1 text-xs text-current/70">correos XML listados</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-100">
              <p className="text-2xl font-semibold tracking-tight">
                {listedXmlAttachments}
              </p>
              <p className="mt-1 text-xs text-current/70">XML en esta pagina</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-emerald-100">
              <p className="text-2xl font-semibold tracking-tight">
                {importedCount}
              </p>
              <p className="mt-1 text-xs text-current/70">XML importados</p>
            </div>
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-rose-100">
              <p className="text-2xl font-semibold tracking-tight">
                {errorCount}
              </p>
              <p className="mt-1 text-xs text-current/70">errores recientes</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100">
              <p className="text-2xl font-semibold tracking-tight">
                {omittedCount}
              </p>
              <p className="mt-1 text-xs text-current/70">omitidos</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100 sm:col-span-2">
              <p className="text-base font-semibold tracking-tight">
                {formatDate(lastSyncAt)}
              </p>
              <p className="mt-1 text-xs text-current/70">ultima sincronizacion</p>
            </div>
          </div>
        </div>
      </section>

      {notice ? (
        <PremiumCard className="border-emerald-300/15 bg-emerald-300/10 p-4">
          <p className="text-sm font-medium text-emerald-100">{notice}</p>
        </PremiumCard>
      ) : null}

      {error ? (
        <PremiumCard className="border-rose-300/15 bg-rose-300/10 p-4">
          <p className="text-sm font-medium text-rose-100">{error}</p>
        </PremiumCard>
      ) : null}

      {!gmailXmlEnabled ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-4">
          <p className="text-sm font-semibold text-amber-100">
            Gmail XML no esta habilitado para esta empresa.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            Para usar este modulo, habilita Gmail XML para esta empresa y
            conecta una cuenta Gmail dedicada.
          </p>
        </PremiumCard>
      ) : null}

      {latestError?.error_message ? (
        <PremiumCard className="border-rose-300/15 bg-rose-300/10 p-4">
          <p className="text-sm font-semibold text-rose-100">
            Ultimo error de sincronizacion
          </p>
          <p className="mt-2 text-sm leading-6 text-rose-100/80">
            {latestError.error_message}
          </p>
        </PremiumCard>
      ) : null}

      {!activeContext.organization ? (
        <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
          <p className="text-sm font-medium text-amber-100">
            Selecciona una organizacion activa
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/75">
            La conexion Gmail se guarda asociada a la organizacion activa.
          </p>
          <Link className="mt-4 inline-flex om7-btn-ghost px-4 py-2.5" href="/empresas">
            Ir a empresas
          </Link>
        </PremiumCard>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <PremiumCard className="p-5">
          <p className="text-sm font-semibold text-white">Estado de conexion</p>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="flex items-center justify-between gap-3">
              <span>Cuenta Gmail</span>
              <span className="font-medium text-slate-100">
                {connection?.gmail_email ?? "Sin conectar"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Usuario OM7</span>
              <span className="text-right font-medium text-slate-100">
                {currentUserEmail ?? "No disponible"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Organizacion</span>
              <span className="text-right font-medium text-slate-100">
                {activeOrganizationName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Cliente</span>
              <span className="text-right font-medium text-slate-100">
                {activeCompanyName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Estado</span>
              <span className={connection ? "om7-chip om7-chip-emerald" : "om7-chip"}>
                {connection ? "Conectada" : "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Conectada desde</span>
              <span className="text-right font-medium text-slate-100">
                {formatDate(connection?.connected_at ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ultima prueba</span>
              <span className="text-right font-medium text-slate-100">
                {formatDate(connection?.last_test_at ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ultimo listado</span>
              <span className="text-right font-medium text-slate-100">
                {formatDate(connection?.last_list_at ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Ultima sincronizacion</span>
              <span className="text-right font-medium text-slate-100">
                {formatDate(connection?.last_sync_at ?? null)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Autosync</span>
              <span
                className={
                  connection?.auto_sync_enabled
                    ? "om7-chip om7-chip-emerald"
                    : "om7-chip"
                }
              >
                {connection?.auto_sync_enabled ? "Activo" : "Pendiente"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Estado autosync</span>
              <span
                className={
                  connection?.last_sync_status === "error"
                    ? "om7-chip om7-chip-rose"
                    : connection?.last_sync_status === "ok"
                      ? "om7-chip om7-chip-emerald"
                      : "om7-chip"
                }
              >
                {connection?.last_sync_status ?? "Sin ejecutar"}
              </span>
            </div>
            {connection?.last_sync_error ? (
              <div className="rounded-xl border border-rose-300/15 bg-rose-300/10 p-3 text-rose-100">
                <p className="text-xs font-semibold">Error autosync</p>
                <p className="mt-1 text-xs leading-5 text-rose-100/80">
                  {connection.last_sync_error}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span>Duplicados recientes</span>
              <span className="text-right font-medium text-amber-100">
                {duplicateCount}
              </span>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard className="overflow-hidden p-0">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <p className="text-sm font-semibold text-white">
              Correos con adjuntos XML
            </p>
            <p className="mt-1 text-xs text-slate-500">
              La lista no modifica Gmail. La sincronizacion descarga solo XML y
              los manda al pipeline documental actual.
            </p>
            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-4">
              <span className="om7-chip">correos revisados: {listedMessages}</span>
              <span className="om7-chip">XML encontrados: {listedXmlAttachments}</span>
              <span className={hasMoreResults ? "om7-chip om7-chip-amber" : "om7-chip"}>
                {hasMoreResults ? "hay mas resultados" : "sin pagina pendiente"}
              </span>
              <span className="om7-chip">limite: {listLimit}</span>
            </div>
            {gmailQuery ? (
              <p className="mt-2 text-xs text-slate-500">
                Busqueda Gmail: {gmailQuery}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              ZIP u otros adjuntos comprimidos no se importan todavia; esta
              vista solo procesa adjuntos con nombre .xml.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Correo</th>
                  <th className="px-5 py-3">Adjuntos XML</th>
                  <th className="px-5 py-3">Recibido</th>
                  <th className="px-5 py-3">Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {candidates.map((item) => (
                  <tr key={item.gmail_message_id} className="align-top text-slate-300">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-100">
                        {item.subject || "Sin asunto"}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {item.from || "Remitente no disponible"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {item.attachment_filenames.map((filename) => (
                          <p className="font-medium text-cyan-100" key={filename}>
                            {filename}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {formatDate(item.received_at)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-slate-500">
                        {item.gmail_message_id}
                      </p>
                    </td>
                  </tr>
                ))}

                {candidates.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={4}>
                      {shouldListMessages
                        ? "No se encontraron correos con adjuntos XML."
                        : "Usa Listar correos XML para hacer una lectura basica."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      </section>

      <PremiumCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.08] px-5 py-4">
          <p className="text-sm font-semibold text-white">Ultimos XML procesados</p>
          <p className="mt-1 text-xs text-slate-500">
            Trazabilidad Gmail guardada por adjunto.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/[0.08] text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Correo</th>
                <th className="px-5 py-3">Adjunto</th>
                <th className="px-5 py-3">Documento OM7</th>
                <th className="px-5 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {recentImports.map((item) => (
                <tr key={item.id} className="align-top text-slate-300">
                  <td className="px-5 py-4">
                    <span className={statusClass(item.import_status)}>
                      {item.import_status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-100">
                      {item.subject || "Sin asunto"}
                    </p>
                    <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                      {item.from || "Remitente no disponible"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-cyan-100">
                      {item.attachment_filename || "documento.xml"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.gmail_attachment_id}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {item.imported_document_id ? (
                      <Link
                        className="text-cyan-100 underline decoration-cyan-100/30 underline-offset-4"
                        href={`/documentos/${item.imported_document_id}`}
                      >
                        Ver documento
                      </Link>
                    ) : (
                      <span className="text-slate-500">Sin documento</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p
                      className={[
                        "max-w-md text-xs leading-5",
                        resultDetailClass(item.import_status),
                      ].join(" ")}
                    >
                      {getImportResultDetail(item)}
                    </p>
                  </td>
                </tr>
              ))}

              {recentImports.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={5}>
                    Todavia no hay XML procesados desde Gmail.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
