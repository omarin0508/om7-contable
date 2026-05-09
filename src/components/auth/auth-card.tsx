import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
  className?: string;
};

export function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <section
      className={`rounded-3xl border border-white/[0.08] bg-white/[0.055] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7 ${className}`}
    >
      {children}
    </section>
  );
}
