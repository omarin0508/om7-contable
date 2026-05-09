import type { ReactNode } from "react";

type PremiumCardProps = {
  children: ReactNode;
  className?: string;
};

export function PremiumCard({ children, className = "" }: PremiumCardProps) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-2xl shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}
