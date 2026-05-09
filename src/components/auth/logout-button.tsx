"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();

    if (supabase) {
      await supabase.auth.signOut();
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
      disabled={loading}
      onClick={handleLogout}
      type="button"
    >
      {loading ? "Saliendo" : "Salir"}
    </button>
  );
}
