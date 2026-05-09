import type { ReactNode } from "react";
import { AuthCard } from "@/components/auth/auth-card";

type OnboardingCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function OnboardingCard({
  title,
  description,
  children,
}: OnboardingCardProps) {
  return (
    <AuthCard className="lg:col-span-2">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            Onboarding OM7
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
        {children}
      </div>
    </AuthCard>
  );
}
