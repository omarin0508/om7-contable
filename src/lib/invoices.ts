import { getActiveContext } from "@/lib/active-context";
import { createClient } from "@/lib/supabase/server";

export type Invoice = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  tipo_documento: string;
  proveedor: string;
  numero_documento: string | null;
  fecha: string | null;
  moneda: string | null;
  subtotal: number | null;
  impuesto: number | null;
  total: number | null;
  estado: string;
  notas: string | null;
  created_at: string | null;
};

export type CreateInvoiceInput = {
  tipoDocumento: string;
  proveedor: string;
  numeroDocumento?: string;
  fecha?: string;
  moneda?: string;
  subtotal?: number;
  impuesto?: number;
  total?: number;
  estado?: string;
  notas?: string;
};

async function getAuthenticatedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuario no autenticado.");
  }

  return { supabase, user };
}

export async function getInvoicesForActiveCompany() {
  const { supabase } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    return {
      activeContext,
      invoices: [] as Invoice[],
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("organization_id", activeContext.organization.id)
    .eq("company_id", activeContext.activeCompany.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    activeContext,
    invoices: (data ?? []) as Invoice[],
  };
}

export async function createInvoiceForActiveCompany(input: CreateInvoiceInput) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const activeContext = await getActiveContext();

  if (!activeContext.organization || !activeContext.activeCompany) {
    throw new Error("Selecciona una empresa activa antes de crear facturas.");
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: activeContext.organization.id,
      company_id: activeContext.activeCompany.id,
      user_id: user.id,
      tipo_documento: input.tipoDocumento || "factura",
      proveedor: input.proveedor,
      numero_documento: input.numeroDocumento || null,
      fecha: input.fecha || null,
      moneda:
        input.moneda ||
        activeContext.activeCompany.base_currency ||
        activeContext.organization.base_currency ||
        "CRC",
      subtotal: input.subtotal ?? 0,
      impuesto: input.impuesto ?? 0,
      total: input.total ?? 0,
      estado: input.estado || "borrador",
      notas: input.notas || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la factura.");
  }

  return data as Invoice;
}
