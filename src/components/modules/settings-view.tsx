import { settingsSections } from "@/lib/module-data";
import { PremiumCard } from "@/components/ui/premium-card";
import { ModuleFrame, ModuleHeader, StatusBadge } from "@/components/modules/shared";
import { ThemeSelector } from "@/components/theme/theme-selector";

export function SettingsView() {
  return (
    <ModuleFrame>
      <ModuleHeader
        title="Configuración"
        description="Centro visual para preparar preferencias, automatizaciones, integraciones y seguridad del sistema."
      />

      <PremiumCard className="p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-white">Apariencia</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Escoge el modo visual de OM7. La preferencia se guarda en este
              navegador y puede seguir el tema del sistema operativo.
            </p>
          </div>
          <ThemeSelector />
        </div>
      </PremiumCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsSections.map((section) => (
          <PremiumCard key={section.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-slate-200">
                {section.title.slice(0, 2)}
              </div>
              <StatusBadge>{section.status}</StatusBadge>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">
              {section.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {section.description}
            </p>
            <div className="mt-6 h-10 rounded-xl border border-white/[0.07] bg-black/15" />
          </PremiumCard>
        ))}
      </section>

      <PremiumCard className="p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-white">
              Preparado para crecer
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              La configuración queda presentada como un centro de control, sin
              formularios funcionales todavía. Cada sección puede conectarse
              después a autenticación, permisos, reglas o integraciones.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Roles", "Auditoría", "Integraciones"].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4"
              >
                <p className="text-sm font-medium text-white">{item}</p>
                <p className="mt-2 text-xs text-slate-500">Visual</p>
              </div>
            ))}
          </div>
        </div>
      </PremiumCard>
    </ModuleFrame>
  );
}
