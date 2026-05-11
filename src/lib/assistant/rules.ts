import type { AssistantSnapshot } from "@/lib/assistant/context";

export type AssistantAction = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

export type AssistantChecklistItem = {
  completed: boolean;
  label: string;
  value: string;
};

export type AssistantGuidance = {
  actions: AssistantAction[];
  checklist: AssistantChecklistItem[];
  context: string;
  moduleLabel: string;
  nextStep: string;
  progress: number;
  risks: string[];
  title: string;
};

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return value === 1 ? `${value} ${singular}` : `${value} ${pluralLabel}`;
}

function getModuleLabel(pathname: string) {
  if (pathname.startsWith("/documentos/")) {
    return "Workspace documental";
  }

  if (pathname.startsWith("/documentos")) {
    return "Documentos";
  }

  if (pathname.startsWith("/compras")) {
    return "Compras";
  }

  if (pathname.startsWith("/facturas")) {
    return "Facturas";
  }

  if (pathname.startsWith("/periodos")) {
    return "Control mensual";
  }

  if (pathname.startsWith("/dashboard")) {
    return "Dashboard principal";
  }

  if (pathname.startsWith("/contabilidad")) {
    return "Contabilidad asistida";
  }

  if (pathname.startsWith("/movimientos")) {
    return "Caja y movimientos";
  }

  if (pathname.startsWith("/observados")) {
    return "Registros observados";
  }

  if (pathname.startsWith("/reportes")) {
    return "Reportes";
  }

  if (pathname.startsWith("/bandeja")) {
    return "Bandeja diaria";
  }

  return "OM7 Finance OS";
}

function buildChecklist(snapshot: AssistantSnapshot): AssistantChecklistItem[] {
  const pendingRecords =
    snapshot.purchases.pendingReview + snapshot.invoices.pendingReview;
  const observedRecords =
    snapshot.purchases.observed +
    snapshot.invoices.observed +
    snapshot.accounting.observed;

  return [
    {
      completed:
        snapshot.documents.requiresReview === 0 &&
        snapshot.documents.readyToConvert === 0,
      label: "Documentos al dia",
      value:
        snapshot.documents.requiresReview + snapshot.documents.readyToConvert === 0
          ? "Sin pendientes"
          : plural(
              snapshot.documents.requiresReview + snapshot.documents.readyToConvert,
              "pendiente",
            ),
    },
    {
      completed: pendingRecords === 0,
      label: "Registros revisados",
      value: pendingRecords === 0 ? "Listos" : plural(pendingRecords, "registro"),
    },
    {
      completed: observedRecords === 0,
      label: "Sin observaciones",
      value:
        observedRecords === 0
          ? "Sin bloqueos"
          : plural(observedRecords, "observado"),
    },
    {
      completed: snapshot.accounting.pendingToPost === 0,
      label: "Contabilidad",
      value:
        snapshot.accounting.pendingToPost === 0
          ? "Contabilizada"
          : plural(snapshot.accounting.pendingToPost, "asiento"),
    },
    {
      completed: snapshot.period.blockers === 0,
      label: "Cierre mensual",
      value:
        snapshot.period.blockers === 0
          ? "Listo para cierre"
          : plural(snapshot.period.blockers, "bloqueo"),
    },
  ];
}

function getProgress(checklist: AssistantChecklistItem[]) {
  const completed = checklist.filter((item) => item.completed).length;

  return Math.round((completed / checklist.length) * 100);
}

function getGlobalRisks(snapshot: AssistantSnapshot) {
  const risks: string[] = [];

  if (snapshot.documents.errors > 0) {
    risks.push(`${plural(snapshot.documents.errors, "documento")} con error.`);
  }

  if (snapshot.purchases.observed + snapshot.invoices.observed > 0) {
    risks.push(
      `${plural(
        snapshot.purchases.observed + snapshot.invoices.observed,
        "registro observado",
        "registros observados",
      )} antes del cierre.`,
    );
  }

  if (snapshot.accounting.observed > 0) {
    risks.push(`${plural(snapshot.accounting.observed, "asiento observado")}.`);
  }

  if (snapshot.period.status === "closed") {
    risks.push("El periodo actual esta cerrado: las acciones quedan limitadas.");
  }

  return [...risks, ...snapshot.warnings].slice(0, 4);
}

export function buildAssistantGuidance(
  pathname: string,
  snapshot: AssistantSnapshot,
): AssistantGuidance {
  const checklist = buildChecklist(snapshot);
  const moduleLabel = getModuleLabel(pathname);
  const risks = getGlobalRisks(snapshot);
  const pendingDocuments =
    snapshot.documents.requiresReview + snapshot.documents.readyToConvert;
  const pendingRecords =
    snapshot.purchases.pendingReview + snapshot.invoices.pendingReview;
  const observedRecords = snapshot.purchases.observed + snapshot.invoices.observed;
  const baseActions: AssistantAction[] = [
    { href: "/bandeja", label: "Ir a bandeja", tone: "primary" },
    { href: "/observados", label: "Ver observados" },
    { href: "/periodos", label: "Control mensual" },
  ];
  let context =
    "Estas viendo el sistema operativo financiero. OM7 resume el trabajo diario, documentos, registros y cierre mensual.";
  let nextStep =
    pendingDocuments > 0
      ? "Empeza por la bandeja diaria para revisar y convertir documentos pendientes."
      : "Revisa los registros pendientes y continua hacia contabilidad o cierre mensual.";
  let actions = baseActions;

  if (pathname.startsWith("/documentos/")) {
    context =
      "Estas en el workspace de un documento. Aqui se revisa la extraccion, se confirma la sugerencia OM7 y se convierte en compra o factura.";
    nextStep =
      snapshot.documents.readyToConvert > 0
        ? "Si los datos ya estan revisados, el siguiente paso es convertir el documento evitando duplicados."
        : "Confirma proveedor, cliente, totales y clasificacion antes de convertir.";
    actions = [
      { href: "/documentos", label: "Volver a documentos" },
      { href: "/bandeja", label: "Abrir bandeja", tone: "primary" },
    ];
  } else if (pathname.startsWith("/documentos")) {
    context =
      "Esta es la bandeja documental: aqui entran XML, PDF e imagenes antes de convertirse en registros operativos.";
    nextStep =
      pendingDocuments > 0
        ? "Abri el documento mas urgente y completa revision o conversion."
        : "No hay documentos criticos; podes revisar compras, facturas o periodo.";
    actions = [
      { href: "/bandeja", label: "Ver cola diaria", tone: "primary" },
      { href: "/compras", label: "Compras" },
      { href: "/facturas", label: "Facturas" },
    ];
  } else if (pathname.startsWith("/compras")) {
    context =
      "Estas en compras: cada registro debe revisarse, aprobarse, pagarse si aplica y generar asiento sugerido.";
    nextStep =
      snapshot.purchases.observed > 0
        ? "Primero corrige las compras observadas para desbloquear el cierre."
        : snapshot.purchases.pendingReview > 0
          ? "Marca como revisadas o aprueba las compras pendientes."
          : "Si ya estan aprobadas, revisa pagos y asientos sugeridos.";
    actions = [
      { href: "/compras?filter=accounting_pending", label: "Compras pendientes", tone: "primary" },
      { href: "/movimientos", label: "Pagos" },
      { href: "/contabilidad", label: "Asientos" },
    ];
  } else if (pathname.startsWith("/facturas")) {
    context =
      "Estas en facturas: OM7 controla revision, cobro, trazabilidad documental y asiento sugerido.";
    nextStep =
      snapshot.invoices.observed > 0
        ? "Atende las facturas observadas antes de cerrar el mes."
        : snapshot.invoices.pendingReview > 0
          ? "Aproba o revisa las facturas pendientes."
          : "Revisa cobros y genera los asientos de las facturas aprobadas.";
    actions = [
      { href: "/facturas?filter=accounting_pending", label: "Facturas pendientes", tone: "primary" },
      { href: "/movimientos", label: "Cobros" },
      { href: "/contabilidad", label: "Asientos" },
    ];
  } else if (pathname.startsWith("/periodos")) {
    context =
      "Estas en control mensual: aqui se valida si el mes puede cerrarse sin observaciones ni pendientes.";
    nextStep =
      snapshot.period.blockers > 0
        ? "Resolve pendientes y observados antes de intentar cerrar el periodo."
        : "El mes se ve listo para cierre operativo.";
    actions = [
      { href: "/observados", label: "Ver bloqueos", tone: "primary" },
      { href: "/reportes", label: "Reportes" },
      { href: "/contabilidad", label: "Contabilidad" },
    ];
  } else if (pathname.startsWith("/contabilidad")) {
    context =
      "Estas en contabilidad asistida: OM7 propone asientos Debe/Haber desde compras y facturas aprobadas.";
    nextStep =
      snapshot.accounting.pendingToPost > 0
        ? "Revisa y contabiliza los asientos pendientes que cuadren."
        : "No hay asientos pendientes; revisa reportes o cierre mensual.";
    actions = [
      { href: "/contabilidad", label: "Asientos", tone: "primary" },
      { href: "/periodos", label: "Periodo" },
      { href: "/reportes?view=contabilidad", label: "Reporte contable" },
    ];
  } else if (pathname.startsWith("/dashboard")) {
    context =
      "Estas en la portada ejecutiva. El dashboard orienta; el trabajo profundo vive en bandeja, compras, facturas, contabilidad y periodos.";
    nextStep =
      observedRecords > 0
        ? "Atende observados primero: son bloqueos reales para cierre."
        : pendingDocuments > 0
          ? "Entra a bandeja diaria para convertir lo que ya llego."
          : pendingRecords > 0
            ? "Revisa compras y facturas pendientes."
            : "Avanza a contabilidad o reportes.";
    actions = baseActions;
  }

  return {
    actions,
    checklist,
    context,
    moduleLabel,
    nextStep,
    progress: getProgress(checklist),
    risks,
    title: "Copiloto operativo OM7",
  };
}
