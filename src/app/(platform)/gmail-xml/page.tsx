import Link from "next/link";
import {
  connectGmailXmlAction,
  listGmailXmlMessagesAction,
  testGmailXmlConnectionAction,
} from "@/app/(platform)/gmail-xml/actions";
import { ModuleFrame } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { getGmailXmlDashboard } from "@/lib/gmail-xml-import";

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

function formatDate(value: string | null) {
  if (!value) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function GmailXmlPage({ searchParams }: GmailXmlPageProps) {
  const params = (await searchParams) ?? {};
  const notice = getParam(params, "notice");
  const error = getParam(params, "error");
  const shouldListMessages = getParam(params, "list") === "xml";
  const { activeContext, connection, candidates } =
    await getGmailXmlDashboard(shouldListMessages);

  return (
    <ModuleFrame>
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),rgba(255,255,255,0.045)] shadow-2xl shadow-cyan-950/20">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/75">
              Prueba de conexion Gmail
            </p>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Importacion Gmail XML
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Conecta una cuenta Gmail y valida lectura basica de correos con
              adjuntos XML. Esta fase no descarga, no importa y no modifica
              correos.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <form action={connectGmailXmlAction}>
                <button className="om7-btn-primary px-4 py-3" type="submit">
                  {connection ? "Reconectar Gmail" : "Conectar Gmail"}
                </button>
              </form>
              <form action={testGmailXmlConnectionAction}>
                <button
                  className="om7-btn-secondary px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!connection}
                  type="submit"
                >
                  Probar conexion
                </button>
              </form>
              <form action={listGmailXmlMessagesAction}>
                <button
                  className="om7-btn-ghost px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!connection}
                  type="submit"
                >
                  Listar correos XML
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-slate-100">
              <p className="text-2xl font-semibold tracking-tight">
                {connection ? "OK" : "Pendiente"}
              </p>
              <p className="mt-1 text-xs text-current/70">estado de conexion</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-100">
              <p className="text-2xl font-semibold tracking-tight">
                {candidates.length}
              </p>
              <p className="mt-1 text-xs text-current/70">correos XML listados</p>
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
          </div>
        </PremiumCard>

        <PremiumCard className="overflow-hidden p-0">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <p className="text-sm font-semibold text-white">
              Correos con adjuntos XML
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Vista de lectura basica. Los adjuntos no se descargan ni se
              importan.
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
    </ModuleFrame>
  );
}
