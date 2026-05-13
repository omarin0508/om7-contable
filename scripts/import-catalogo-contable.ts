import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

type Categoria = "activo" | "pasivo" | "patrimonio" | "ingreso" | "costo" | "gasto";
type Naturaleza = "deudora" | "acreedora";
type TipoEstado = "BG" | "ER";
type TipoCuenta = "acumulativa" | "detalle";

type RawAccount = {
  explicitTipoCuenta: TipoCuenta | null;
  metadata: Record<string, unknown>;
  nombre: string;
  rawCodigo: string;
  rawNaturaleza: string[];
  rawTipoEstado: string;
  sourceBlock: "balance_general" | "estado_resultados";
};

type ParsedAccount = {
  categoria: Categoria;
  centro_costo_requerido: boolean;
  codigo: string;
  explicitTipoCuenta: TipoCuenta | null;
  metadata: Record<string, unknown>;
  moneda: string | null;
  naturaleza: Naturaleza;
  nivel: number;
  nombre: string;
  parentCode: string | null;
  permite_movimientos: boolean;
  tipo_cuenta: TipoCuenta;
  tipo_estado: TipoEstado;
};

type ExistingAccount = {
  codigo: string;
  id: string;
};

type CuentaPayload = {
  activa: boolean;
  categoria: Categoria;
  centro_costo_requerido: boolean;
  codigo: string;
  cuenta_padre_id: string | null;
  metadata: Record<string, unknown>;
  moneda: string | null;
  naturaleza: Naturaleza;
  nivel: number;
  nombre: string;
  organization_id: string | null;
  permite_movimientos: boolean;
  tipo_cuenta: TipoCuenta;
  tipo_estado: TipoEstado;
};

type ImporterDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      cuentas_contables: {
        Insert: CuentaPayload;
        Relationships: [];
        Row: CuentaPayload & { id: string };
        Update: Partial<CuentaPayload>;
      };
    };
    Views: Record<string, never>;
  };
};

type ScriptSupabaseClient = SupabaseClient<ImporterDatabase>;

type ImportBlock = {
  codeIndex: number;
  explicitTipoIndex?: number;
  nameIndex: number;
  natureIndexes: number[];
  sourceBlock: RawAccount["sourceBlock"];
  stateIndex: number;
};

const DEFAULT_FILE_PATH = path.join(
  "data",
  "catalogos",
  "Catalogo de cuentas v1 12 mayo 26.xlsx",
);

const importBlocks: ImportBlock[] = [
  {
    codeIndex: 2,
    explicitTipoIndex: 1,
    nameIndex: 3,
    natureIndexes: [5, 6],
    sourceBlock: "balance_general",
    stateIndex: 4,
  },
  {
    codeIndex: 9,
    nameIndex: 10,
    natureIndexes: [12, 13],
    sourceBlock: "estado_resultados",
    stateIndex: 11,
  },
];

function loadLocalEnv() {
  const envPath = path.resolve(".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getArgValue(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

function hasArg(name: string) {
  return process.argv.includes(`--${name}`);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta variable de entorno ${name}.`);
  }

  return value;
}

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCode(value: string) {
  return value.replace(/,/g, ".").replace(/-/g, ".").replace(/\s+/g, "");
}

function looksLikeCode(value: string) {
  return /^[0-9]+(?:[.][0-9A-Za-z]+)*$/.test(normalizeCode(value));
}

function splitCode(codigo: string) {
  return codigo.split(".").filter(Boolean);
}

function inferNivel(codigo: string) {
  return Math.max(splitCode(codigo).length, 1);
}

function normalizeTipoCuenta(value: string): TipoCuenta | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "detalle") {
    return "detalle";
  }

  if (normalized === "acumulativa") {
    return "acumulativa";
  }

  return null;
}

function normalizeTipoEstado(value: string, codigo: string): TipoEstado {
  const normalized = value.toUpperCase().trim();

  if (normalized === "BG" || normalized === "ER") {
    return normalized;
  }

  return ["1", "2", "3"].includes(splitCode(codigo)[0] ?? "") ? "BG" : "ER";
}

function normalizeNaturaleza(values: string[], codigo: string, nombre: string): Naturaleza {
  const normalizedValues = values
    .map((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim(),
    )
    .filter(Boolean);
  const normalizedName = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    normalizedValues.includes("deudora") &&
    !normalizedValues.includes("acreedora")
  ) {
    return "deudora";
  }

  if (
    normalizedValues.includes("acreedora") &&
    !normalizedValues.includes("deudora")
  ) {
    return "acreedora";
  }

  if (
    normalizedName.includes("gasto") ||
    normalizedName.includes("costo") ||
    splitCode(codigo)[0] === "6"
  ) {
    return "deudora";
  }

  return ["1", "5"].includes(splitCode(codigo)[0] ?? "") ? "deudora" : "acreedora";
}

function inferCategoria(codigo: string, nombre: string, naturaleza: Naturaleza): Categoria {
  const firstSegment = splitCode(codigo)[0] ?? "";
  const normalizedName = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (firstSegment === "1") {
    return "activo";
  }

  if (firstSegment === "2") {
    return "pasivo";
  }

  if (firstSegment === "3") {
    return "patrimonio";
  }

  if (normalizedName.includes("costo")) {
    return "costo";
  }

  if (normalizedName.includes("gasto")) {
    return "gasto";
  }

  if (normalizedName.includes("ingreso") || normalizedName.includes("venta")) {
    return "ingreso";
  }

  if (firstSegment === "5") {
    return "costo";
  }

  if (firstSegment === "6") {
    return "gasto";
  }

  return naturaleza === "deudora" ? "gasto" : "ingreso";
}

function inferCurrency(nombre: string) {
  const upperName = nombre.toUpperCase();

  if (upperName.includes("USD") || upperName.includes("DOLAR")) {
    return "USD";
  }

  if (upperName.includes("CRC") || upperName.includes("COLON")) {
    return "CRC";
  }

  return null;
}

function getParentPrefix(codigo: string) {
  const segments = splitCode(codigo);

  return segments.length > 1 ? segments.slice(0, -1).join(".") : null;
}

function getNextSiblingCode(codigo: string, usedCodes: Set<string>) {
  const segments = splitCode(codigo);
  const parentPrefix = segments.length > 1 ? segments.slice(0, -1).join(".") : null;
  const lastSegment = segments[segments.length - 1] ?? "1";
  const lastNumber = Number.parseInt(lastSegment, 10);
  const siblingPrefix = parentPrefix ? `${parentPrefix}.` : "";
  let nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 2;
  let candidate = `${siblingPrefix}${nextNumber}`;

  while (usedCodes.has(candidate)) {
    nextNumber += 1;
    candidate = `${siblingPrefix}${nextNumber}`;
  }

  return candidate;
}

function normalizeCodeForBlock(
  rawCodigo: string,
  stackByLevel: Map<number, string>,
  usedCodes: Set<string>,
) {
  const rawNormalized = normalizeCode(rawCodigo);
  const nivel = inferNivel(rawNormalized);
  const parentFromStack = stackByLevel.get(nivel - 1) ?? null;
  let codigo = rawNormalized;

  if (parentFromStack) {
    const parentRoot = splitCode(parentFromStack)[0];
    const rawRoot = splitCode(rawNormalized)[0];

    if (parentRoot && rawRoot && parentRoot !== rawRoot) {
      const lastSegment = splitCode(rawNormalized).at(-1) ?? rawNormalized;
      codigo = `${parentFromStack}.${lastSegment}`;
    }
  }

  let normalizedDuplicate = false;

  if (usedCodes.has(codigo)) {
    codigo = getNextSiblingCode(codigo, usedCodes);
    normalizedDuplicate = true;
  }

  return {
    codigo,
    normalizedDuplicate,
  };
}

function parseBlockRows(
  rows: unknown[][],
  block: ImportBlock,
  sourceFileName: string,
) {
  const accounts: RawAccount[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const cells = row.map(normalizeCell);
    const rawCodigo = normalizeCode(cells[block.codeIndex] ?? "");
    const nombre = normalizeCell(cells[block.nameIndex]);
    const rawTipoEstado = normalizeCell(cells[block.stateIndex]);

    if (!looksLikeCode(rawCodigo) || !nombre) {
      continue;
    }

    accounts.push({
      explicitTipoCuenta:
        block.explicitTipoIndex === undefined
          ? null
          : normalizeTipoCuenta(cells[block.explicitTipoIndex] ?? ""),
      metadata: {
        import_block: block.sourceBlock,
        import_source: sourceFileName,
        source_row: rowIndex + 1,
        source_raw_code: rawCodigo,
      },
      nombre,
      rawCodigo,
      rawNaturaleza: block.natureIndexes.map((index) => normalizeCell(cells[index])),
      rawTipoEstado,
      sourceBlock: block.sourceBlock,
    });
  }

  return accounts;
}

function parseWorkbook(filePath: string) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El Excel no contiene hojas.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    blankrows: false,
    defval: null,
    header: 1,
    raw: false,
  });
  const sourceFileName = path.basename(filePath);
  const rawAccountsByBlock = importBlocks.flatMap((block) =>
    parseBlockRows(rows, block, sourceFileName),
  );
  const usedCodes = new Set<string>();
  const parentCodes = new Set<string>();
  const parsedAccounts: ParsedAccount[] = [];
  const duplicateFixes: Array<{ from: string; name: string; to: string }> = [];

  for (const block of importBlocks) {
    const blockAccounts = rawAccountsByBlock.filter(
      (account) => account.sourceBlock === block.sourceBlock,
    );
    const stackByLevel = new Map<number, string>();

    for (const rawAccount of blockAccounts) {
      const { codigo, normalizedDuplicate } = normalizeCodeForBlock(
        rawAccount.rawCodigo,
        stackByLevel,
        usedCodes,
      );
      const nivel = inferNivel(codigo);
      const parentCodeFromStack = stackByLevel.get(nivel - 1) ?? null;
      const parentCodeFromPrefix = getParentPrefix(codigo);
      const parentCode =
        parentCodeFromStack ??
        (parentCodeFromPrefix && usedCodes.has(parentCodeFromPrefix)
          ? parentCodeFromPrefix
          : null);
      const tipo_estado = normalizeTipoEstado(rawAccount.rawTipoEstado, codigo);
      const naturaleza = normalizeNaturaleza(
        rawAccount.rawNaturaleza,
        codigo,
        rawAccount.nombre,
      );
      const categoria = inferCategoria(codigo, rawAccount.nombre, naturaleza);

      if (parentCode) {
        parentCodes.add(parentCode);
      }

      if (normalizedDuplicate) {
        duplicateFixes.push({
          from: rawAccount.rawCodigo,
          name: rawAccount.nombre,
          to: codigo,
        });
      }

      parsedAccounts.push({
        categoria,
        centro_costo_requerido: categoria === "costo" || categoria === "gasto",
        codigo,
        explicitTipoCuenta: rawAccount.explicitTipoCuenta,
        metadata: {
          ...rawAccount.metadata,
          normalized_code: codigo,
        },
        moneda: inferCurrency(rawAccount.nombre),
        naturaleza,
        nivel,
        nombre: rawAccount.nombre,
        parentCode,
        permite_movimientos: false,
        tipo_cuenta: "acumulativa",
        tipo_estado,
      });

      usedCodes.add(codigo);
      stackByLevel.set(nivel, codigo);

      for (const existingLevel of Array.from(stackByLevel.keys())) {
        if (existingLevel > nivel) {
          stackByLevel.delete(existingLevel);
        }
      }
    }
  }

  const accounts = parsedAccounts.map((account) => {
    const tipo_cuenta =
      account.explicitTipoCuenta ??
      (parentCodes.has(account.codigo) ? "acumulativa" : "detalle");
    const finalTipoCuenta =
      parentCodes.has(account.codigo) && tipo_cuenta === "detalle"
        ? "acumulativa"
        : tipo_cuenta;

    return {
      ...account,
      permite_movimientos: finalTipoCuenta === "detalle",
      tipo_cuenta: finalTipoCuenta,
    };
  });

  return {
    accounts,
    duplicateFixes,
    sheetName,
    sheetNames: workbook.SheetNames,
  };
}

async function upsertAccounts(
  supabase: ScriptSupabaseClient,
  organizationId: string | null,
  payload: CuentaPayload[],
) {
  let createdCount = 0;
  let updatedCount = 0;
  const codes = payload.map((account) => account.codigo);
  const existingQuery = supabase
    .from("cuentas_contables")
    .select("id,codigo")
    .in("codigo", codes);
  const { data: existingAccounts, error: existingError } =
    organizationId === null
      ? await existingQuery.is("organization_id", null)
      : await existingQuery.eq("organization_id", organizationId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingByCode = new Map(
    ((existingAccounts ?? []) as ExistingAccount[]).map((account) => [
      account.codigo,
      account,
    ]),
  );
  const toInsert = payload.filter((account) => !existingByCode.has(account.codigo));
  const toUpdate = payload.filter((account) => existingByCode.has(account.codigo));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("cuentas_contables")
      .insert(toInsert);

    if (insertError) {
      throw new Error(insertError.message);
    }

    createdCount = toInsert.length;
  }

  for (const account of toUpdate) {
    const existing = existingByCode.get(account.codigo);

    if (!existing) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("cuentas_contables")
      .update(account)
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    updatedCount += 1;
  }

  return { createdCount, updatedCount };
}

async function main() {
  loadLocalEnv();

  const filePath = path.resolve(getArgValue("file") ?? DEFAULT_FILE_PATH);
  const isGlobalImport = hasArg("global");
  const organizationId = isGlobalImport
    ? null
    : (getArgValue("organization") ?? process.env.CATALOGO_ORGANIZATION_ID ?? null);
  const isDryRun = hasArg("dry-run");

  if (!existsSync(filePath)) {
    throw new Error(`No encontre el Excel: ${filePath}`);
  }

  const { accounts, duplicateFixes, sheetName, sheetNames } = parseWorkbook(filePath);
  const acumulativas = accounts.filter((account) => account.tipo_cuenta === "acumulativa");
  const detalles = accounts.filter((account) => account.tipo_cuenta === "detalle");

  console.log("OM7 Catalogo Contable Importer");
  console.log(`Archivo: ${filePath}`);
  console.log(`Hojas detectadas: ${sheetNames.join(", ")}`);
  console.log(`Hoja usada: ${sheetName}`);
  console.log(`Cuentas detectadas: ${accounts.length}`);
  console.log(`Acumulativas: ${acumulativas.length}`);
  console.log(`Detalle: ${detalles.length}`);
  console.log(
    `Destino: ${isGlobalImport ? "catalogo global OM7" : `organizacion ${organizationId ?? "(pendiente)"}`}`,
  );

  if (duplicateFixes.length > 0) {
    console.log("Codigos normalizados por duplicado/conflicto:");
    duplicateFixes.forEach((fix) => {
      console.log(`- ${fix.from} -> ${fix.to} (${fix.name})`);
    });
  }

  if (accounts.length === 0) {
    throw new Error("No se detectaron cuentas contables en el Excel.");
  }

  if (isDryRun) {
    console.log("Dry-run activo: no se escribio en Supabase.");
    return;
  }

  if (!isGlobalImport && !organizationId) {
    throw new Error(
      "Falta organization id. Usa --global, --organization=<uuid> o CATALOGO_ORGANIZATION_ID.",
    );
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para importar con privilegios de servicio.");
  }

  const supabase = createClient<ImporterDatabase>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const basePayload = accounts.map((account) => ({
    activa: true,
    categoria: account.categoria,
    centro_costo_requerido: account.centro_costo_requerido,
    codigo: account.codigo,
    cuenta_padre_id: null,
    metadata: account.metadata,
    moneda: account.moneda,
    naturaleza: account.naturaleza,
    nivel: account.nivel,
    nombre: account.nombre,
    organization_id: organizationId,
    permite_movimientos: account.permite_movimientos,
    tipo_cuenta: account.tipo_cuenta,
    tipo_estado: account.tipo_estado,
  }));
  const { createdCount, updatedCount } = await upsertAccounts(
    supabase,
    organizationId,
    basePayload,
  );

  const storedQuery = supabase
    .from("cuentas_contables")
    .select("id,codigo")
    .in(
      "codigo",
      accounts.map((account) => account.codigo),
    );
  const { data: storedAccounts, error: selectError } =
    organizationId === null
      ? await storedQuery.is("organization_id", null)
      : await storedQuery.eq("organization_id", organizationId);

  if (selectError) {
    throw new Error(selectError.message);
  }

  const idByCode = new Map(
    ((storedAccounts ?? []) as ExistingAccount[]).map((account) => [
      account.codigo,
      account.id,
    ]),
  );
  let linkedParents = 0;

  for (const account of accounts) {
    const accountId = idByCode.get(account.codigo);
    const parentId = account.parentCode ? idByCode.get(account.parentCode) : null;

    if (!accountId) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("cuentas_contables")
      .update({ cuenta_padre_id: parentId ?? null })
      .eq("id", accountId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (parentId) {
      linkedParents += 1;
    }
  }

  console.log("Importacion completada.");
  console.log(`Cuentas creadas: ${createdCount}`);
  console.log(`Cuentas actualizadas: ${updatedCount}`);
  console.log(`Relaciones padre-hijo asignadas: ${linkedParents}`);
  console.log(`Destino: ${organizationId === null ? "catalogo global OM7" : organizationId}`);
}

main().catch((error: unknown) => {
  console.error("Error importando catalogo contable OM7:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
