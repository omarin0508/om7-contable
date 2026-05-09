import { AuthCard } from "@/components/auth/auth-card";

const benefits = [
  "Lectura inteligente de documentos",
  "Control multiempresa",
  "Reportes ejecutivos",
  "Portal cliente",
];

export function AuthBenefits() {
  return (
    <AuthCard className="hidden lg:block">
      <p className="text-sm font-medium text-white">Incluido en la plataforma</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Una experiencia preparada para equipos, firmas contables y clientes con
        acceso controlado.
      </p>

      <div className="mt-6 space-y-3">
        {benefits.map((benefit) => (
          <div
            key={benefit}
            className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
            <span className="text-sm text-slate-300">{benefit}</span>
          </div>
        ))}
      </div>
    </AuthCard>
  );
}
