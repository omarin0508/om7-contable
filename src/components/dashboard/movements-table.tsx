import { movements } from "@/lib/dashboard-data";
import { PremiumCard } from "@/components/ui/premium-card";

const statusClass = {
  Conciliado: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  Pendiente: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  Revision: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
};

export function MovementsTable() {
  return (
    <PremiumCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div>
          <p className="text-sm font-medium text-white">Movimientos recientes</p>
          <p className="mt-1 text-xs text-slate-500">
            Actividad consolidada de cuentas
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          Ver todo
        </button>
      </div>

      <div className="om7-responsive-table">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.16em] text-slate-600">
            <tr>
              <th className="px-5 py-3 font-medium">Empresa</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {movements.map((movement) => (
              <tr key={`${movement.company}-${movement.date}`} className="text-slate-300">
                <td className="px-5 py-4 font-medium text-white">
                  {movement.company}
                </td>
                <td className="px-5 py-4 text-slate-400">{movement.category}</td>
                <td className="px-5 py-4 font-medium">{movement.amount}</td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass[movement.status]}`}
                  >
                    {movement.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-500">{movement.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PremiumCard>
  );
}
