import Link from "next/link";
import { uploadClientDocumentAction } from "@/app/cliente/actions";
import { StatusBadge } from "@/components/modules/shared";
import { PremiumCard } from "@/components/ui/premium-card";
import { listClientUploadDocumentsForCurrentUser } from "@/lib/storage";

type ClientPortalPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Recibido",
  processing: "Procesando",
  processed: "Procesado",
  error: "Error",
};

function formatBytes(value: number | null) {
  const bytes = Number(value ?? 0);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClientPortalPage({
  searchParams,
}: ClientPortalPageProps) {
  const params = (await searchParams) ?? {};
  const selectedCompanyId = getParam(params, "companyId");
  const { activeCompany, companies, documents: clientUploads } =
    await listClientUploadDocumentsForCurrentUser(selectedCompanyId);

  return (
    <main className="min-h-screen overflow-hidden bg-[#03050a] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.09),transparent_28%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-cyan-300/[0.035] p-6 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="inline-flex items-center gap-3 rounded-2xl px-1 py-1"
              href="/dashboard"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                OM7
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  OM7 Finance OS
                </span>
                <span className="text-xs text-slate-500">Portal cliente</span>
              </span>
            </Link>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Recepcion documental
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Suba aqui sus facturas XML, PDFs o imagenes para que el equipo
              contable las reciba en el espacio seguro de OM7.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Empresa activa
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {activeCompany?.name ?? "Sin empresa asignada"}
            </p>
          </div>
        </header>

        {!activeCompany ? (
          <PremiumCard className="border-amber-300/15 bg-amber-300/10 p-5">
            <p className="text-sm font-medium text-amber-100">
              Selecciona una empresa antes de recibir documentos
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
              Este portal usa empresas asignadas a tu usuario. Si no ves una
              empresa, solicita acceso al equipo contable.
            </p>
          </PremiumCard>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <PremiumCard className="p-5">
            <p className="text-sm font-medium text-white">Enviar documento</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Los XML se procesan automaticamente. PDFs e imagenes quedan
              recibidos para revision posterior.
            </p>

            <form action={uploadClientDocumentAction} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Empresa
                </span>
                {companies.length > 1 ? (
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                    defaultValue={activeCompany?.id ?? ""}
                    disabled={!activeCompany}
                    name="companyId"
                  >
                    {companies.map((company) => (
                      <option
                        className="bg-slate-950"
                        key={company.id}
                        value={company.id}
                      >
                        {company.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      name="companyId"
                      type="hidden"
                      value={activeCompany?.id ?? ""}
                    />
                    <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-sm text-slate-300">
                      {activeCompany?.name ?? "Sin empresa asignada"}
                    </div>
                  </>
                )}
              </label>

              <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-200/20 bg-cyan-200/[0.04] px-5 py-8 text-center transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.07]">
                <span className="text-sm font-medium text-cyan-100">
                  Elegir XML, PDF o imagen
                </span>
                <span className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                  Archivos privados, asociados a la empresa activa.
                </span>
                <input
                  accept="application/pdf,image/*,.xml,application/xml,text/xml"
                  className="mt-5 block w-full max-w-xs rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-950"
                  disabled={!activeCompany}
                  name="file"
                  required
                  type="file"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">
                  Tipo documento
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm text-white outline-none transition focus:border-cyan-300/35 focus:bg-black/30 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
                  defaultValue="factura"
                  disabled={!activeCompany}
                  name="documentType"
                >
                  <option className="bg-slate-950" value="factura">
                    Factura
                  </option>
                  <option className="bg-slate-950" value="compra">
                    Compra
                  </option>
                  <option className="bg-slate-950" value="otro">
                    Otro
                  </option>
                </select>
              </label>

              <button
                className="flex h-12 w-full items-center justify-center rounded-xl bg-cyan-100 px-4 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!activeCompany}
                type="submit"
              >
                Enviar documento
              </button>
            </form>
          </PremiumCard>

          <PremiumCard className="overflow-hidden">
            <div className="border-b border-white/[0.07] px-5 py-4">
              <p className="text-sm font-medium text-white">
                Documentos enviados
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Historial de archivos enviados desde el portal cliente.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Archivo</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 font-medium">Tamano</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {clientUploads.length > 0 ? (
                    clientUploads.map((document) => (
                      <tr key={document.id}>
                        <td className="px-5 py-4 font-medium text-white">
                          {document.original_filename ?? "Documento"}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {document.document_type}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatBytes(document.size_bytes)}
                        </td>
                        <td className="px-5 py-4 text-slate-400">
                          {formatDate(document.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge>
                            {document.processing_status === "processed" &&
                            document.mime_type?.includes("xml")
                              ? "XML procesado"
                              : statusLabels[document.processing_status] ??
                                document.processing_status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        className="px-5 py-10 text-center text-sm text-slate-500"
                        colSpan={5}
                      >
                        Aun no hay documentos enviados desde este portal.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </section>
      </div>
    </main>
  );
}
