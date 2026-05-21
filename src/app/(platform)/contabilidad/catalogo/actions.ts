"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/active-context";
import { assertInternalUser, assertMasterCatalogAdmin } from "@/lib/permissions";
import type { CuentaContable } from "@/lib/cuentas-contables";
import { createClient } from "@/lib/supabase/server";

const catalogPath = "/contabilidad/catalogo";

function redirectWithMessage(type: "error" | "success", message: string) {
  redirect(`${catalogPath}?${type}=${encodeURIComponent(message)}`);
}

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

async function getAuthorizedContext() {
  await assertInternalUser();

  const supabase = await createClient();

  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const activeContext = await getActiveContext();

  if (!activeContext.organization) {
    throw new Error("Selecciona una organizacion activa.");
  }

  return {
    organizationId: activeContext.organization.id,
    supabase,
  };
}

async function getCatalogScope(formData: FormData) {
  const scope = textValue(formData, "catalogScope") === "master" ? "master" : "client";
  const context = await getAuthorizedContext();

  if (scope === "master") {
    await assertMasterCatalogAdmin();
  }

  return {
    ...context,
    catalogOrganizationId: scope === "master" ? null : context.organizationId,
    scope,
  };
}

async function accountHasMovements(
  accountId: string,
  organizationId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (!organizationId || !supabase) {
    return false;
  }

  const { count, error } = await supabase
    .from("asiento_lineas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("cuenta_contable_id", accountId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

async function loadCatalogAccount(
  accountId: string,
  organizationId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  let query = supabase
    .from("cuentas_contables")
    .select("*")
    .eq("id", accountId);

  query =
    organizationId === null
      ? query.is("organization_id", null)
      : query.eq("organization_id", organizationId);

  const { data, error } = await query.single();

  if (error) {
    throw new Error(error.message);
  }

  return data as CuentaContable;
}

function validateAccountPayload(payload: {
  categoria: string;
  codigo: string;
  naturaleza: string;
  nivel: number;
  nombre: string;
  tipoCuenta: string;
}) {
  if (!payload.codigo) {
    throw new Error("El codigo de cuenta es requerido.");
  }

  if (!payload.nombre) {
    throw new Error("El nombre de cuenta es requerido.");
  }

  if (
    !["activo", "pasivo", "patrimonio", "ingreso", "costo", "gasto"].includes(
      payload.categoria,
    )
  ) {
    throw new Error("La categoria de cuenta es requerida.");
  }

  if (!["deudora", "acreedora"].includes(payload.naturaleza)) {
    throw new Error("La naturaleza de cuenta es requerida.");
  }

  if (!["acumulativa", "detalle"].includes(payload.tipoCuenta)) {
    throw new Error("El tipo de cuenta es requerido.");
  }

  if (!Number.isInteger(payload.nivel) || payload.nivel < 1) {
    throw new Error("El nivel debe ser un numero entero mayor o igual a 1.");
  }
}

export async function saveCuentaContableAction(formData: FormData) {
  let targetType: "error" | "success" = "success";
  let targetMessage = "Catalogo actualizado.";

  try {
    const { catalogOrganizationId, scope, supabase } = await getCatalogScope(formData);
    const accountId = textValue(formData, "accountId");
    const codigo = textValue(formData, "codigo");
    const nombre = textValue(formData, "nombre");
    const categoria = textValue(formData, "categoria");
    const naturaleza = textValue(formData, "naturaleza");
    const tipoCuenta = textValue(formData, "tipoCuenta");
    const tipoEstado = textValue(formData, "tipoEstado") || "BG";
    const nivel = Number(textValue(formData, "nivel") || "1");
    const parentId = textValue(formData, "cuentaPadreId") || null;
    const descripcion = textValue(formData, "descripcion");
    const activa = booleanValue(formData, "activa");
    const permiteMovimientos =
      tipoCuenta === "detalle" && booleanValue(formData, "permiteMovimientos");
    const centroCostoRequerido = booleanValue(formData, "centroCostoRequerido");
    const isRequired = booleanValue(formData, "isRequired");
    const isRecommended = booleanValue(formData, "isRecommended") || isRequired;

    validateAccountPayload({
      categoria,
      codigo,
      naturaleza,
      nivel,
      nombre,
      tipoCuenta,
    });

    if (parentId && parentId === accountId) {
      throw new Error("Una cuenta no puede ser su propia cuenta padre.");
    }

    let duplicateQuery = supabase
      .from("cuentas_contables")
      .select("id")
      .eq("codigo", codigo)
      .limit(1);
    duplicateQuery =
      catalogOrganizationId === null
        ? duplicateQuery.is("organization_id", null)
        : duplicateQuery.eq("organization_id", catalogOrganizationId);

    const { data: duplicateData, error: duplicateError } = accountId
      ? await duplicateQuery.neq("id", accountId)
      : await duplicateQuery;

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if ((duplicateData ?? []).length > 0) {
      throw new Error("Ya existe una cuenta con ese codigo en este catalogo.");
    }

    if (parentId) {
      const parentQuery = supabase
        .from("cuentas_contables")
        .select("id")
        .eq("id", parentId);
      const { data: parent, error: parentError } =
        catalogOrganizationId === null
          ? await parentQuery.is("organization_id", null).single()
          : await parentQuery.eq("organization_id", catalogOrganizationId).single();

      if (parentError || !parent) {
        throw new Error("La cuenta padre no pertenece a este catalogo.");
      }
    }

    if (accountId) {
      const current = await loadCatalogAccount(
        accountId,
        catalogOrganizationId,
        supabase,
      );
      const hasMovements = await accountHasMovements(
        accountId,
        catalogOrganizationId,
        supabase,
      );
      const metadata = {
        ...(current.metadata ?? {}),
        descripcion,
        is_recommended: isRecommended,
        is_required: isRequired,
        edited_from_catalog_workspace: true,
      };

      if (hasMovements) {
        const criticalChanged =
          current.codigo !== codigo ||
          current.categoria !== categoria ||
          current.naturaleza !== naturaleza ||
          current.nivel !== nivel ||
          current.cuenta_padre_id !== parentId ||
          current.tipo_cuenta !== tipoCuenta ||
          current.permite_movimientos !== permiteMovimientos;

        if (criticalChanged) {
          throw new Error(
            "Esta cuenta ya tiene movimientos. Solo puedes ajustar nombre, notas o activar/desactivar.",
          );
        }

        const updateQuery = supabase
          .from("cuentas_contables")
          .update({
            activa,
            metadata,
            nombre,
          })
          .eq("id", accountId);
        const { error } =
          catalogOrganizationId === null
            ? await updateQuery.is("organization_id", null)
            : await updateQuery.eq("organization_id", catalogOrganizationId);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        const updateQuery = supabase
          .from("cuentas_contables")
          .update({
            activa,
            categoria,
            centro_costo_requerido: centroCostoRequerido,
            codigo,
            cuenta_padre_id: parentId,
            metadata,
            naturaleza,
            nivel,
            nombre,
            permite_movimientos: permiteMovimientos,
            tipo_cuenta: tipoCuenta,
            tipo_estado: tipoEstado,
          })
          .eq("id", accountId);
        const { error } =
          catalogOrganizationId === null
            ? await updateQuery.is("organization_id", null)
            : await updateQuery.eq("organization_id", catalogOrganizationId);

        if (error) {
          throw new Error(error.message);
        }
      }
    } else {
      const { error } = await supabase.from("cuentas_contables").insert({
        activa,
        categoria,
        centro_costo_requerido: centroCostoRequerido,
        codigo,
        cuenta_padre_id: parentId,
        metadata: {
          catalog_source: scope === "master" ? "master" : "custom",
          descripcion,
          is_recommended: isRecommended,
          is_required: isRequired,
        },
        moneda: null,
        naturaleza,
        nivel,
        nombre,
        organization_id: catalogOrganizationId,
        permite_movimientos: permiteMovimientos,
        tipo_cuenta: tipoCuenta,
        tipo_estado: tipoEstado,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath(catalogPath);
  } catch (error) {
    targetType = "error";
    targetMessage =
      error instanceof Error ? error.message : "No se pudo guardar la cuenta.";
  }

  redirectWithMessage(targetType, targetMessage);
}

export async function toggleCuentaContableAction(formData: FormData) {
  let targetType: "error" | "success" = "success";
  let targetMessage = "Cuenta actualizada.";

  try {
    const { catalogOrganizationId, supabase } = await getCatalogScope(formData);
    const accountId = textValue(formData, "accountId");
    const activa =
      formData.has("nextActiva")
        ? textValue(formData, "nextActiva") === "true"
        : booleanValue(formData, "activa");

    if (!accountId) {
      throw new Error("Cuenta requerida.");
    }

    const updateQuery = supabase
      .from("cuentas_contables")
      .update({ activa })
      .eq("id", accountId);
    const { error } =
      catalogOrganizationId === null
        ? await updateQuery.is("organization_id", null)
        : await updateQuery.eq("organization_id", catalogOrganizationId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(catalogPath);
    targetMessage = activa ? "Cuenta activada." : "Cuenta inactivada.";
  } catch (error) {
    targetType = "error";
    targetMessage =
      error instanceof Error ? error.message : "No se pudo actualizar la cuenta.";
  }

  redirectWithMessage(targetType, targetMessage);
}

export async function copySelectedMasterAccountsAction(formData: FormData) {
  let targetType: "error" | "success" = "success";
  let targetMessage = "Cuentas copiadas al catalogo del cliente.";

  try {
    const { organizationId, supabase } = await getAuthorizedContext();
    const selectedIds = new Set(
      formData
        .getAll("selectedAccountId")
        .map((value) => String(value))
        .filter(Boolean),
    );

    if (selectedIds.size === 0) {
      throw new Error("Selecciona al menos una cuenta del catalogo maestro.");
    }

    const { data: globalData, error: globalError } = await supabase
      .from("cuentas_contables")
      .select("*")
      .is("organization_id", null)
      .order("codigo", { ascending: true });

    if (globalError) {
      throw new Error(globalError.message);
    }

    const globalAccounts = (globalData ?? []) as CuentaContable[];
    const globalById = new Map(globalAccounts.map((account) => [account.id, account]));
    const childrenByParent = new Map<string, CuentaContable[]>();

    for (const account of globalAccounts) {
      if (!account.cuenta_padre_id) {
        continue;
      }

      childrenByParent.set(account.cuenta_padre_id, [
        ...(childrenByParent.get(account.cuenta_padre_id) ?? []),
        account,
      ]);
    }

    const idsToCopy = new Set<string>();
    const includeWithChildren = (accountId: string) => {
      const account = globalById.get(accountId);

      if (!account || idsToCopy.has(account.id)) {
        return;
      }

      idsToCopy.add(account.id);
      for (const child of childrenByParent.get(account.id) ?? []) {
        includeWithChildren(child.id);
      }
    };

    for (const accountId of selectedIds) {
      includeWithChildren(accountId);
    }

    for (const accountId of Array.from(idsToCopy)) {
      let current = globalById.get(accountId);

      while (current?.cuenta_padre_id) {
        const parent = globalById.get(current.cuenta_padre_id);

        if (!parent) {
          break;
        }

        idsToCopy.add(parent.id);
        current = parent;
      }
    }

    const { data: existingData, error: existingError } = await supabase
      .from("cuentas_contables")
      .select("*")
      .eq("organization_id", organizationId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingAccounts = (existingData ?? []) as CuentaContable[];
    const existingByCode = new Map(
      existingAccounts.map((account) => [account.codigo, account]),
    );
    const idByGlobalId = new Map<string, string>();

    for (const account of globalAccounts) {
      if (!idsToCopy.has(account.id)) {
        continue;
      }

      const existing = existingByCode.get(account.codigo);

      if (existing) {
        idByGlobalId.set(account.id, existing.id);
        continue;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("cuentas_contables")
        .insert({
          activa: account.activa,
          categoria: account.categoria,
          centro_costo_requerido: account.centro_costo_requerido,
          codigo: account.codigo,
          cuenta_padre_id: null,
          metadata: {
            ...(account.metadata ?? {}),
            catalog_source: "master_selection",
            copied_from_global_account_id: account.id,
          },
          moneda: account.moneda,
          naturaleza: account.naturaleza,
          nivel: account.nivel,
          nombre: account.nombre,
          organization_id: organizationId,
          permite_movimientos: account.permite_movimientos,
          tipo_cuenta: account.tipo_cuenta,
          tipo_estado: account.tipo_estado,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      idByGlobalId.set(account.id, String(inserted.id));
    }

    for (const account of globalAccounts) {
      const copiedId = idByGlobalId.get(account.id);
      const copiedParentId = account.cuenta_padre_id
        ? idByGlobalId.get(account.cuenta_padre_id)
        : null;

      if (!copiedId || !idsToCopy.has(account.id)) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("cuentas_contables")
        .update({ cuenta_padre_id: copiedParentId ?? null })
        .eq("id", copiedId)
        .eq("organization_id", organizationId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    revalidatePath(catalogPath);
    targetMessage = `Cuentas copiadas al catalogo del cliente: ${idsToCopy.size}.`;
  } catch (error) {
    targetType = "error";
    targetMessage =
      error instanceof Error
        ? error.message
        : "No se pudieron copiar las cuentas seleccionadas.";
  }

  redirectWithMessage(targetType, targetMessage);
}
