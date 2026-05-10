"use client";

import { useTransition } from "react";
import type { Company } from "@/lib/organizations";

type CompanySelectorProps = {
  activeCompanyId?: string | null;
  companies: Company[];
  onSelect: (formData: FormData) => void;
};

export function CompanySelector({
  activeCompanyId,
  companies,
  onSelect,
}: CompanySelectorProps) {
  const [pending, startTransition] = useTransition();

  if (companies.length === 0) {
    return null;
  }

  return (
    <form
      action={onSelect}
      className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 sm:flex"
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
        Empresa
      </span>
      <select
        className="max-w-44 bg-transparent text-xs font-medium text-slate-100 outline-none"
        defaultValue={activeCompanyId ?? ""}
        disabled={pending}
        name="companyId"
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          const formData = new FormData(form);
          startTransition(() => onSelect(formData));
        }}
      >
        <option className="bg-slate-950" value="">
          Seleccionar
        </option>
        {companies.map((company) => (
          <option className="bg-slate-950" key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </form>
  );
}
