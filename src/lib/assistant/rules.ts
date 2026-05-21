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
    return "Workspace de bandeja";
  }

  if (pathname.startsWith("/documentos")) {
    return "Consulta de documentos";
  }

  if (pathname.startsWith("/compras")) {
    return "Compras";
  }

  if (pathname.startsWith("/facturas")) {
    return "Ventas";
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
      label: "Bandeja al dia",
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
    { href: "__close", label: "Seguir aqui", tone: "primary" },
    { href: "/bandeja", label: "Ir a bandeja" },
    { href: "/observados", label: "Ver observados" },
  ];
  let context =
    "Estas viendo el sistema operativo financiero. OM7 resume el trabajo diario, la bandeja, registros y cierre mensual.";
  let nextStep =
    pendingDocuments > 0
      ? "Empeza por la bandeja diaria para clasificar y dar salida a documentos pendientes."
      : "Revisa los registros pendientes y continua hacia contabilidad o cierre mensual.";
  let actions = baseActions;

  if (pathname.startsWith("/documentos/")) {
    context =
      "Estas en el workspace de Bandeja. Aqui se revisa la extraccion, se confirma la sugerencia OM7 y se da salida a Compra o Venta.";
    nextStep =
      snapshot.documents.readyToConvert > 0
        ? "Si los datos ya estan revisados, el siguiente paso es dar salida evitando duplicados."
        : "Confirma proveedor, cliente, totales y clasificacion antes de dar salida.";
    actions = [
      { href: "__close", label: "Seguir revisando", tone: "primary" },
      { href: "/bandeja", label: "Volver a bandeja" },
      { href: "/documentos", label: "Consulta documentos" },
    ];
  } else if (pathname.startsWith("/documentos")) {
    context =
      "Esta es la consulta de documentos ingresados: aqui se ve el original, trazabilidad y relacion con compras o ventas.";
    nextStep =
      pendingDocuments > 0
        ? "Volvi a Bandeja para completar clasificacion y salida."
        : "No hay documentos criticos; podes revisar compras, ventas o periodo.";
    actions = [
      { href: "__close", label: "Seguir consultando", tone: "primary" },
      { href: "/bandeja", label: "Trabajar bandeja" },
      { href: "/compras", label: "Compras" },
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
      { href: "/compras?filter=accounting_approved", label: "Aprobadas" },
      { href: "/movimientos/pagar", label: "Cuentas por pagar" },
    ];
  } else if (pathname.startsWith("/facturas")) {
    context =
      "Estas en ventas: OM7 controla revision, cobro, trazabilidad documental y asiento sugerido.";
    nextStep =
      snapshot.invoices.observed > 0
        ? "Atende las ventas observadas antes de cerrar el mes."
        : snapshot.invoices.pendingReview > 0
          ? "Marca como revisadas las ventas pendientes; luego aprobalas para habilitar cobro, asiento y cierre."
          : "Revisa cobros y genera los asientos de las ventas aprobadas.";
    actions = [
      { href: "/facturas?filter=accounting_pending", label: "Ventas pendientes", tone: "primary" },
      { href: "/facturas?filter=accounting_approved", label: "Aprobadas" },
      { href: "/movimientos/cobrar", label: "Cuentas por cobrar" },
    ];
  } else if (pathname.startsWith("/movimientos/cobrar")) {
    context =
      "Estas en cuentas por cobrar. OM7 prioriza que revises saldos, vencidos y cobros sin salir de este workspace.";
    nextStep =
      "Primero trabaja aqui: confirma pendientes, registra cobros desde ventas y vuelve a este workspace para continuar.";
    actions = [
      { href: "__close", label: "Seguir aqui", tone: "primary" },
      { href: "/movimientos/cobrar?filter=overdue", label: "Ver vencidas" },
      {
        href: "/facturas?returnTo=%2Fmovimientos%2Fcobrar&returnLabel=Volver%20a%20cuentas%20por%20cobrar",
        label: "Registrar cobro",
      },
    ];
  } else if (pathname.startsWith("/movimientos/pagar")) {
    context =
      "Estas en cuentas por pagar. OM7 prioriza que revises obligaciones y pagos sin perder el rastro del workspace.";
    nextStep =
      "Primero trabaja aqui: revisa pendientes o vencidas, registra pagos desde compras y vuelve a cuentas por pagar.";
    actions = [
      { href: "__close", label: "Seguir aqui", tone: "primary" },
      { href: "/movimientos/pagar?filter=overdue", label: "Ver vencidas" },
      {
        href: "/compras?returnTo=%2Fmovimientos%2Fpagar&returnLabel=Volver%20a%20cuentas%20por%20pagar",
        label: "Registrar pago",
      },
    ];
  } else if (pathname.startsWith("/movimientos/recientes")) {
    context =
      "Estas en movimientos recientes. Esta vista sirve para revisar actividad sin abandonar el modulo de movimientos.";
    nextStep =
      "Filtra aqui por cobros o pagos; si necesitas accionar, entra al registro y conserva el retorno al workspace.";
    actions = [
      { href: "__close", label: "Seguir aqui", tone: "primary" },
      { href: "/movimientos/recientes?type=collections", label: "Cobros" },
      { href: "/movimientos/recientes?type=payments", label: "Pagos" },
    ];
  } else if (pathname.startsWith("/movimientos")) {
    context =
      "Estas en el dashboard de movimientos. Esta portada resume y te lleva a cada workspace sin mezclar listas.";
    nextStep =
      "Elegí el workspace principal y mantené el rastro: cobrar, pagar, recientes o control mensual.";
    actions = [
      { href: "__close", label: "Seguir aqui", tone: "primary" },
      { href: "/movimientos/cobrar", label: "Cuentas por cobrar" },
      { href: "/movimientos/pagar", label: "Cuentas por pagar" },
    ];
  } else if (pathname.startsWith("/periodos")) {
    context =
      "Estas en control mensual: aqui se valida si el mes puede cerrarse sin observaciones ni pendientes.";
    nextStep =
      snapshot.period.blockers > 0
        ? "Resolve pendientes y observados antes de intentar cerrar el periodo."
        : "El mes se ve listo para cierre operativo.";
    actions = [
      { href: "__close", label: "Seguir en periodos", tone: "primary" },
      { href: "/observados", label: "Ver bloqueos" },
      { href: "/reportes", label: "Reportes" },
    ];
  } else if (pathname.startsWith("/contabilidad")) {
    context =
      "Estas en contabilidad asistida: OM7 propone asientos Debe/Haber desde compras y ventas aprobadas.";
    nextStep =
      snapshot.accounting.pendingToPost > 0
        ? "Revisa y contabiliza los asientos pendientes que cuadren."
        : "No hay asientos pendientes; revisa reportes o cierre mensual.";
    actions = [
      { href: "__close", label: "Seguir aqui", tone: "primary" },
      { href: "/contabilidad/catalogo", label: "Catalogo" },
      { href: "/reportes?view=contabilidad", label: "Reporte contable" },
    ];
  } else if (pathname.startsWith("/dashboard")) {
    context =
      "Estas en la portada ejecutiva. El dashboard orienta; el trabajo profundo vive en bandeja, compras, ventas, contabilidad y periodos.";
    nextStep =
      observedRecords > 0
        ? "Atende observados primero: son bloqueos reales para cierre."
        : pendingDocuments > 0
          ? "Entra a bandeja diaria para convertir lo que ya llego."
          : pendingRecords > 0
            ? "Revisa compras y ventas pendientes."
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
