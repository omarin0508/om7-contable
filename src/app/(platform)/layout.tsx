import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserEmail } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userEmail = await getCurrentUserEmail();

  return <AppShell userEmail={userEmail}>{children}</AppShell>;
}
