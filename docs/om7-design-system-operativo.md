# OM7 Design System Operativo

Base visual y UX para mantener OM7 Finance OS coherente, premium y practico.

## Principio

Dashboard no es workspace.

- Dashboard: resume, orienta y dirige.
- Workspace: opera, edita, valida y cierra un flujo.

## Componentes Base

Archivo:

`src/components/om7/operational-design-system.tsx`

Componentes:

- `DashboardHero`: portada ejecutiva de dashboards.
- `WorkspaceLayout`: ancho, espaciado y ritmo de modulo.
- `WorkspaceHeader`: header operativo para subprogramas.
- `WorkspaceSidebar`: columna lateral de acciones, ayuda o checklist.
- `WorkspacePanel`: card/panel base premium con tono.
- `ContextualHelpCard`: ayuda breve, contextual y no invasiva.
- `KPIStatCard`: metrica compacta.
- `OperationalCard`: entrada navegable a workspace/subprograma.
- `StatusBadge`: estado humano con tono visual.
- `E7ConfidenceBadge`: confianza Alta/Media/Baja.
- `EmptyStateOM7`: estado vacio con accion clara.
- `QuickActionsBar`: acciones inmediatas agrupadas.
- `SectionHeader`: titulo compacto de seccion.
- `WorkspaceChecklist`: progreso operativo.
- `FloatingAssistantButton`: export del asistente contextual global.

## Reglas Visuales

- Cards: `rounded-2xl` o `rounded-3xl` segun jerarquia.
- Bordes: siempre visibles y sutiles, nunca planos invisibles.
- Hover: elevacion ligera, borde mas claro, glow suave.
- Texto secundario: usar `text-slate-300` o `text-slate-400`; evitar grises muy oscuros.
- Dashboards: pocas cards grandes, no listas largas.
- Workspaces: panel principal + lateral, con edicion y validacion.
- Scroll interno: solo en bandejas largas, no en portadas ejecutivas.

## Reglas UX

- Toda accion debe dar resultado visible: cambio de estado, mensaje o navegacion.
- La ayuda contextual explica el siguiente paso, no documenta todo el modulo.
- Mantener navegacion circular: dashboard -> workspace -> detalle -> volver.
- Usar progressive disclosure: detalles solo donde se necesitan.
- Evitar duplicar CTA cerca; una accion principal por bloque.

## Migracion Fase 1

Aplicado como base compartida en:

- Headers y KPIs via `src/components/modules/shared.tsx`.
- Movimientos: ayuda contextual y cards operativas.
- E7 Mind Distribucion: ayuda, empty state, confidence badge, section header y sidebar.

Siguiente paso recomendado:

- Migrar gradualmente `Documentos`, `Compras` y `Facturas` a `WorkspacePanel`, `QuickActionsBar` y `EmptyStateOM7` sin cambiar logica.
