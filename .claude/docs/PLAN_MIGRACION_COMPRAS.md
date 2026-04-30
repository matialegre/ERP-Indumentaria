# Plan de migración UI — Compras / Ingresos / Recepción / Completados / Gestión Pagos

Objetivo: que las 5 pantallas del ERP nuevo se vean y comporten **idénticas al legacy CONTROL REMITOS**, sin regresiones, respetando el código que ya funciona.

## Contexto previo obligatorio

1. Leer `.claude/docs/COMPRAS_MAPA.md` — modelos, enums, rutas, relaciones.
2. Leer `AGENTS.md` — reglas duras del repo.
3. Leer `.claude/skills/karpathy-principles.md` — cambios quirúrgicos, simplicidad, no reventar lo que anda.

## Estado actual (medido, no asumido)

| Pantalla | ERP nuevo | Legacy equivalente | Gap estimado |
|---|---|---|---|
| Compras | `PedidosComprasPage.jsx` 96 KB | `pages/Admin.tsx` (tab Compras) + `Pedidos.tsx` 32 KB | Medio — ajustar UX |
| Ingresos | `IngresoPage.jsx` 89 KB + `FacturasProveedorPage.jsx` 47 KB | `pages/admin/FacturasTab.tsx` 136 KB | Medio — unificar en una sola pantalla con sub-secciones como legacy |
| Recepción | `RecepcionPage.jsx` 67 KB | `pages/admin/RemitosTab.tsx` 53 KB + `HomeReal.tsx` 69 KB | Medio |
| Completados | `CompletadosPage.jsx` 13 KB | Sub-tab de Admin.tsx | **Alto — está casi vacío** |
| Gestión Pagos | `GestionPagosPage.jsx` 63 KB | `pages/admin/GestionPagosTab.tsx` 40 KB + `ProveedoresTab.tsx` 26 KB + `HistoriaProveedoresTab.tsx` 5 KB | Medio — agregar sub-tabs |

## Estrategia

**NO reescribir desde cero.** Para cada pantalla:

1. Auditar feature-by-feature contra el legacy (qué tiene legacy que el nuevo no)
2. Completar solo los huecos (principio Karpathy: cambios quirúrgicos)
3. Mantener intacto lo que ya funciona
4. Desplegar con `DEPLOY_RAPIDO.bat`
5. Validar visualmente contra screenshots del legacy

## Fase 0 — Auditoría (antes de tocar código)

Producir `.claude/docs/COMPRAS_DIFF_FEATURES.md` con tabla por pantalla:

```
| Feature | Legacy | ERP nuevo | Acción |
|---|---|---|---|
| Tab "Con Diferencia" en Compras | SÍ | ? | MIGRAR / OK / N/A |
```

Para cada pantalla listar como mínimo:

### Compras (`PedidosComprasPage.jsx`)
- [ ] Sub-tabs: Pedidos / Locales / Proveedores
- [ ] Filtros de estado: Activos / Completados OK / Con Diferencia / Anulados / En Ingresos (con contador)
- [ ] Filtros de tipo: PRE / REP
- [ ] Botones: Comparar / Lista de Precios / Agrupar / Nueva nota
- [ ] Banner "ALERTAS DE REPOSICIÓN" con filtros Todas / Sin Factura / Con Factura pendiente
- [ ] Columna ESTADO con chip de color (ESP 64d, etc.)
- [ ] Columna DÍAS con chip de alerta
- [ ] Botón "Aceptar dif." por fila
- [ ] Botón acción (papelera) por fila
- [ ] Expand por fila para ver detalle

### Ingresos (`IngresoPage.jsx` o unificar con `FacturasProveedorPage.jsx`)
- [ ] Tabs de sub-estado: Remitos sin RV (+N días) / Falta remito de venta / Cantidades incompletas / Sin documentación / Notas de venta sin asignar
- [ ] Filtros: PRE / REP / Pend. RV / En Recepción
- [ ] Búsqueda por proveedor, N° pedido, N° factura
- [ ] Botones: Carga Avanzada / Re-asociar RV / Nuevo Ingreso
- [ ] Columnas: DÍAS (chip color por antigüedad), TIPO (R/F, REM), N° DOCUMENTO, FECHA, CANT., NOTA PEDIDO, PROVEEDOR, LOCAL, ACCIONES (RV, Ver)
- [ ] Badge rojo con contador en el tab "Ingresos"

### Recepción (`RecepcionPage.jsx`)
- [ ] Filtros: No llegó / Sí llegó / Todos (+ Todos / REP / PRE)
- [ ] Badge "99+" en el tab
- [ ] Columnas: Local, Proveedor/NP (con NP debajo y badge REP/PRE), Tipo, Fecha, N° Doc., RV, Cant., Llegó (botón), PDFs, Admin (Forzar), Obs.
- [ ] Botón "Forzar" en columna Admin
- [ ] Botón PDFs con preview inline

### Completados (`CompletadosPage.jsx`) — **mayor gap**
- [ ] Listado de notas de pedido COMPLETADAS
- [ ] Filtros y búsqueda
- [ ] Columnas con totales y comparativo pedido vs recibido
- [ ] Links a facturas vinculadas

### Gestión Pagos (`GestionPagosPage.jsx`)
- [ ] Sub-tabs: RM Indumentaria SRL / Resumen / Proveedores / Facturas Todas / Historial Pagos / Historia Proveedores / Anulación de Pagos
- [ ] Tab Proveedores: vista editable spreadsheet-like con categorías horizontales (Datos Básicos, Contacto, Fiscal, Ret. IVA, Ret. IIBB, Ret. IIBB 1, Ret. Ganancias, SUSS, Contabilidad, Estado/Admin, Comercial, Dirección, Operaciones, Varios, Sistema) — cada una con contador
- [ ] Sidebar con logos de marcas (Montagne, Miding, Kodiak, etc.)
- [ ] Botones: Anulados / CSV / Importar Tango PDF
- [ ] Contador de proveedores (ej "179 proveedores — doble click en celda para editar")

## Hallazgos visuales confirmados (Compras — screenshots 24-abr-2026)

Comparación lado a lado entre legacy y ERP nuevo en la pantalla Compras:

### Bug crítico: CANT=0 en todas las filas

En el ERP nuevo, la columna CANT muestra `0` en todas las notas de pedido. En el legacy muestra valores reales (4871u, 4317u, 2704u, etc.).

**Causa probable** (verificar, no asumir):
- El backend no suma `PurchaseOrderItem.quantity_ordered` al serializar `PurchaseOrder`
- O el campo `total_ordered` existe en el modelo pero nunca se recalcula al crear/editar items
- O el frontend está leyendo el campo equivocado

**Pasos de diagnóstico**:
1. `GET /api/v1/purchase-orders` — ver qué devuelve para `total_ordered` / `cant` / `quantity`
2. Mirar `erp/backend/app/api/v1/purchase_orders.py` — buscar dónde se serializa la lista y si incluye `sum(items.quantity_ordered)`
3. Mirar `PedidosComprasPage.jsx` — ver qué campo lee para mostrar CANT

La columna "FALTA" (que en el ERP muestra solo ✓) también es un cálculo: `total_ordered - total_received - total_facturado`. Si `total_ordered=0`, todo sale ✓. El bug raíz es el mismo.

### UI gap específico (Compras)

| Feature legacy | ERP nuevo |
|---|---|
| Sub-tabs horizontales: **Pedidos / Locales / Proveedores** | ✅ Existe |
| Filtros estado: **Activos (48) / Completados OK / Con Diferencia / Anulados / En Ingresos (17)** con contadores | ❌ Tiene `Todos / Borrador / Pendiente / Recibido / Completado / Anulado` (distinto) |
| Filtros tipo: **PRE / REP** | ❌ Falta |
| Botones top: **Comparar / Lista de Precios / Agrupar / + Nueva nota** | ⚠️ Solo Agrupar + Nueva nota |
| Banner rojo: **ALERTAS DE REPOSICIÓN — N pendientes** con filtros Todas/Sin Factura/Con Factura pendiente | ❌ Falta completo |
| Columna ESTADO con chips: **FALTA 2251, ESP 64d, etc.** | ⚠️ Solo texto "COMPLETADO/ANULADO" |
| Columna OBSERVACIONES | ❌ Falta |
| Columna DÍAS con chip de color por antigüedad | ⚠️ Existe pero sin color |
| Botón **Cruzar** por fila (abre ComparadorCruzado) | ❌ Falta — el componente existe en `components/ComparadorCruzado.jsx`, solo falta integrar |
| Expand de fila con: **Artículos / Facturado / Faltan** + **DOCUMENTOS VINCULADOS** (lista FAC + lista REM con dropdown "Vincular a...") + botón verde **Aceptar diferencia** | ❌ Falta completo |
| Badge rojo con contador en tab superior "Compras" | ❌ Falta |

### Problema de datos

El ERP nuevo parece tener solo **datos de prueba** (5 notas MIDING S-001 a S-005, todas con 0 items). El legacy tiene 48 activas + 17 en ingresos. Esto confirma que los datos reales **no fueron migrados** del legacy al nuevo, o que las notas del nuevo son de seeds iniciales.

No migrar datos en esta fase — primero cerrar UI + lógica. La migración de datos va aparte.

---

## Fase 1 — Compras (máxima prioridad, lo que el usuario vio roto)

**Sub-fase 1.A — Fix del bug CANT=0** (antes de cualquier UI)

1. Inspeccionar qué devuelve `GET /api/v1/purchase-orders` hoy. Logs o curl.
2. En `purchase_orders.py` (leer solo las funciones de listado — NO los 46 KB completos): verificar si el schema de respuesta incluye totales calculados.
3. Si el modelo tiene `total_ordered` pero no se recalcula: agregar un `@property` o computar en el endpoint como `sum(item.quantity_ordered for item in po.items)`.
4. Exponer también `total_received`, `total_invoiced`, `total_missing` si no están.
5. Verificar en `PedidosComprasPage.jsx` qué campo lee y ajustar.
6. Criterio de éxito: la columna CANT muestra el total de unidades pedidas, no `0`.

**Sub-fase 1.B — Banner "Alertas de Reposición"**

Feature: arriba del listado de Compras, un banner rojo con las notas tipo REP que están demoradas (sin factura o con factura pendiente) y cuya antigüedad supera el `Provider.days_alert_sin_rv`.

1. Endpoint nuevo o reusado: `GET /api/v1/purchase-orders/alertas-reposicion?company_id=...`
2. Query: `type=REPOSICION AND status IN (PENDIENTE, RECIBIDO) AND age_days > provider.days_alert_sin_rv`
3. Componente `AlertasReposicionBanner.jsx` con filtros Todas / Sin Factura (0) / Con Factura pendiente (N)
4. Cada fila: estado (ESP Nd), N° pedido, proveedor, local, PEDIDO (total unidades), FACTURADO, FALTAN, ÚLT.FAC, acciones Ver + Aceptar diferencia + papelera
5. Criterio de éxito: si existe una nota REP con antigüedad > días_alerta, aparece en el banner.

**Sub-fase 1.C — Filtros + columnas**

1. Reemplazar filtros de estado por: **Activos / Completados OK / Con Diferencia / Anulados / En Ingresos** con contadores en tiempo real
2. Agregar toggles **PRE / REP** (filtro por `type`)
3. Agregar columna OBSERVACIONES (leer `PurchaseOrder.observations`)
4. Chip de color en ESTADO (rojo: FALTA, verde: COMPLETADO, gris: ANULADO, amarillo: PARCIAL)
5. Chip de color en DÍAS (verde <7d, amarillo 7-30d, rojo >30d)

**Sub-fase 1.D — Expand de fila con documentos vinculados**

1. Click en la flecha → expande y carga `GET /api/v1/purchase-orders/{id}/detalle-vinculado`
2. Muestra resumen: Artículos, Facturado, Faltan
3. Lista de FAC (facturas vinculadas) con fecha, número, cantidad, RV
4. Lista de REM (remitos) con dropdown "Vincular a..." si `linked_to_id` es NULL
5. Botón verde "Aceptar diferencia" → PUT que setea `accepted_difference=true` y `accepted_difference_obs`
6. Acciones por fila: Cruzar (abre ComparadorCruzado inline), ver PDF, editar, eliminar

**Sub-fase 1.E — Botones top + badges**

1. Integrar botón Comparar → abre selector de nota y lanza `ComparadorCruzado`
2. Integrar botón Lista de Precios → abre `ComparadorListaFacturas`
3. Badge rojo con contador en nav "Compras" (notas activas + alertas)

**Deploy al final de cada sub-fase**: `DEPLOY_RAPIDO.bat`.

---

## Fase 2 — Completados (mayor gap relativo, pero más acotado)

Archivo: `erp/frontend/src/pages/CompletadosPage.jsx`

1. Abrir archivo actual — entender qué hay
2. Abrir legacy equivalente en `Admin.tsx` con grep acotado (NO leer los 352 KB — buscar solo la sección "Completados")
3. Implementar lo que falte:
   - Listado
   - Filtros
   - Columnas comparativas
4. `DEPLOY_RAPIDO.bat`
5. Verificar visualmente

Criterio de éxito: la pantalla Completados del ERP muestra los mismos datos que la del legacy para la misma empresa, con al menos las mismas columnas y filtros.

## Fase 3 — Ingresos (unificar estructura sub-tabs)

1. Decidir: ¿mantener `IngresoPage` + `FacturasProveedorPage` separadas, o unificar como en legacy?
2. Recomendación: unificar bajo una sola page con sub-tabs internos que repliquen el legacy (Remitos sin RV / Falta RV / Cant. incompletas / Sin docs / NV sin asignar)
3. Agregar badge de contador en nav (`AppLayout.jsx`)
4. Agregar botones faltantes (Carga Avanzada ya existe como componente `components/CargaAvanzada.jsx` — integrarlo)

## Fase 4 — Recepción

1. Ajustar filtros a No llegó / Sí llegó / Todos (+ PRE/REP)
2. Agregar botón "Forzar" en columna Admin
3. Integrar `PdfViewer` (ya existe en `components/PdfViewer.jsx`)
4. Badge "99+" en nav cuando hay muchos pendientes

## Fase 5 — Gestión Pagos (la más compleja)

1. Agregar sub-tabs top
2. Rearmar tab Proveedores como spreadsheet editable con categorías
3. Sidebar con logos de marcas
4. Importar Tango PDF → ya existe lógica en `providers.py`, solo UI

## Reglas para cada fase

- **Branch por fase** (ej `compras/fase-1-completados`)
- **Un solo commit por feature** con mensaje claro
- **NO tocar backend** salvo que el feature lo requiera sí o sí; si hace falta, pedir confirmación
- **NO tocar modelos** — el schema está OK, no reescribir
- **Respetar multi-tenant**: toda query debe scope a `company_id`
- **Respetar roles**: ADMIN / COMPRAS / GESTION_PAGOS / LOCAL según corresponda
- **Deploy obligatorio** al terminar fase: `DEPLOY_RAPIDO.bat`
- **Pasar por `@code-reviewer`** antes de cerrar fase
- **Mostrar screenshot antes/después** al usuario si es posible

## Anti-patterns a evitar

- ❌ Reescribir la página completa por "quedar más lindo"
- ❌ Cambiar nombres de variables/funciones existentes
- ❌ Migrar a TypeScript
- ❌ Agregar librería de componentes UI nueva
- ❌ Leer `Admin.tsx` (352 KB) completo
- ❌ Crear endpoints nuevos si los existentes cubren la funcionalidad
- ❌ "Mejorar" el modelo de datos
- ❌ Mezclar dos fases en un commit

## Criterio de cierre global

Cuando las 5 pantallas del ERP:
- muestran los mismos tabs y contadores que el legacy
- tienen los mismos filtros y acciones
- integran los comparadores / upload masivo
- pasan QA visual contra screenshots

Se considera migración de UI completa. La dualidad de modelos (`Pedido`/`Ingreso` legacy vs `PurchaseOrder`/`PurchaseInvoice`) queda para una fase posterior de deprecación.
