import { PremiumCard } from "@/components/ui/premium-card";

type EmptySectionProps = {
  title: string;
  description: string;
};

export function EmptySection({ title, description }: EmptySectionProps) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PremiumCard className="p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
          OM7 Finance OS
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          {description}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-32 rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          <div className="h-32 rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
          <div className="h-32 rounded-2xl border border-white/[0.07] bg-white/[0.035]" />
        </div>
      </PremiumCard>
    </div>
  );
}
