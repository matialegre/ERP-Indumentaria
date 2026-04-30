# COMPRAS_DIFF_FEATURES.md
> Generado 2026-04-24 — Fase 0 Auditoría. Fuente: grep+read acotados sobre los 5 archivos ERP + Admin.tsx + Tabs legacy.
> NO modificar manualmente — re-generar si cambia el estado.

---

## Leyenda
- ✓ EXISTE — feature presente y funcional en ERP nuevo
- ⚠ PARCIAL — feature existe pero diferente a legacy (label, UX, nivel de detalle)
- ✗ FALTA — feature ausente, requiere trabajo

---

## 1. Compras — `PedidosComprasPage.jsx` (1872 líneas)
**Gap estimado: MEDIO**

| Feature | Legacy (Admin.tsx Pedidos section) | ERP nuevo | Acción |
|---|---|---|---|
| Sub-tab Pedidos | ✓ | ✓ | OK |
| Sub-tab Locales | ✓ | ✓ | OK |
| Sub-tab Proveedores | ✓ | ✓ | OK |
| Agrupado por estado / local / proveedor | ✓ | ✓ (`groupBy` dropdown) | OK |
| Filtro estado: Activos (BORRADOR+PENDIENTE) | ✓ | ⚠ ERP usa "PENDIENTE" directamente | RENOMBRAR |
| Filtro estado: Completados OK | ✓ (`completados_ok`) | ✗ ERP solo tiene "COMPLETADO" genérico | AGREGAR split OK/CON_DIF |
| Filtro estado: Con Diferencia | ✓ (`completados_dif`) | ✗ idem | AGREGAR |
| Filtro estado: Anulados | ✓ | ✓ | OK |
| Filtro estado: En Ingresos | ✓ | ⚠ equivale a RECIBIDO, pero label diferente | RENOMBRAR |
| Contadores por filtro | ✓ | ✓ (`counts`) | OK |
| Filtro tipo PRE / REP | ✓ | ✗ no existe en esta pantalla | AGREGAR |
| Búsqueda por proveedor / N° / local | ✓ | ✓ | OK |
| Botón "Nueva Nota" | ✓ | ✓ | OK |
| Botón Refresh | ✓ | ✓ | OK |
| Botón Comparar (ComparadorCruzado) | ✓ | ✓ (por fila) | OK |
| Botón Lista de Precios (ExcelConPrecios) | ✓ | ✓ (por fila) | OK |
| Botón Agrupar (dropdown) | ✓ | ✓ | OK |
| Botón Ombak | ✓ | ✓ (por fila) | OK |
| Botón Confirmar / Recibir / Completar / Anular | ✓ | ✓ (por fila, condicional a estado) | OK |
| Botón "Aceptar dif." por fila | ✓ | ⚠ existe via workflow Completar, pero no como acción rápida inline | VERIFICAR |
| Botón papelera / Anular por fila | ✓ | ✓ (Anular) | OK |
| Expand por fila (detalle items) | ✓ | ✓ | OK |
| StatusBadge chip de color por estado | ✓ | ✓ | OK |
| AlertStateBadge (ROJO/AMARILLO/VERDE/ALERTA_REPO) | ✓ | ✓ | OK |
| DaysBadge chip por antigüedad | ✓ | ✓ | OK |
| TypeBadge PRE / REP | ✓ | ✓ | OK |
| Banner "ALERTAS DE REPOSICIÓN" | ✓ | ✓ | OK |
| Filtros banner: Todas / Sin Factura / Con Factura | ✓ | ✓ | OK |
| Badge 99+ en nav | ✓ | ✓ (`badgeKey: pedidos_pendientes`) | OK |

**Faltantes Fase 4:** PRE/REP filter (1), split Completados OK vs Con Diferencia (2), renombrar labels (2 menores). Total: ~5 items.

---

## 2. Ingresos — `IngresoPage.jsx` (1550 líneas)
**Gap estimado: MEDIO-BAJO** (la estructura de secciones es casi idéntica al legacy)

| Feature | Legacy (FacturasTab.tsx) | ERP nuevo | Acción |
|---|---|---|---|
| Sección SIN_RV (Falta RV) | ✓ | ✓ (pill filter + collapsible) | OK |
| Sección INCOMPLETO | ✓ | ✓ | OK |
| Sección SOLO_FALTA_REM | ✓ | ✓ | OK |
| Sección SOLO_FALTA_FAC | ✓ | ✓ | OK |
| Sección OK | ✓ | ✓ | OK |
| Sección OTROS | ✓ | ✓ | OK |
| Sección SIN_NADA | ✓ | ✓ | OK |
| Contadores por sección en pill | ✓ | ✓ | OK |
| Filtro tipo PRE / REP | ✓ | ✓ | OK |
| Filtro `filtroPendienteRCRV` (Pend. RC/RV) | ✓ | ✗ | AGREGAR |
| Búsqueda por proveedor / N° / factura | ✓ | ✓ | OK |
| Botón "Nuevo Ingreso" | ✓ | ✓ (`onCreate`) | OK |
| Botón "Carga Avanzada" | ✓ | ✓ (importado, integrado) | OK |
| Botón "Re-asociar RV" (rvAutoModal) | ✓ auto-búsqueda RV | ✗ | AGREGAR |
| Alertas: Remitos sin factura (+N días) | ✓ | ✓ (CollapsibleAlert) | OK |
| Alertas: Alertas RV vencido (docs >N días sin RV) | ✓ | ⚠ movido a PedidosComprasPage, verificar cobertura | VERIFICAR |
| Categorías de alerta: ANP / INCOMPLETO / SIN_REM / SIN_RV | ✓ (`alertasFiltroIng`) | ✓ (via section pills) | OK |
| DocPairsGrid (facturas + remitos en paralelo) | ✓ | ✓ | OK |
| Cruzar documentos modal | ✓ | ✓ (CruzarDocumentosModal) | OK |
| ItemsPDF modal | ✓ | ✓ | OK |
| Export CSV | ✓ | ✓ | OK |
| Agrupar por local toggle | ✓ | ✓ | OK |
| Badge rojo en tab nav | ✓ | ✓ (`badgeKey: ingresos_pendientes`) | OK |
| Columnas por doc: DÍAS / TIPO (R/F/REM) / N° / FECHA / CANT / NP / PROVEEDOR / LOCAL / ACCIONES | ✓ | ✓ | OK |
| Estado semáforo por doc | ✓ | ✓ | OK |

**Faltantes Fase 2:** Pend. RC/RV filter (1), Re-asociar RV auto (1). Total: ~2 items.

---

## 3. Recepción — `RecepcionPage.jsx` (1312 líneas)
**Gap estimado: MEDIO**

| Feature | Legacy (RemitosTab.tsx) | ERP nuevo | Acción |
|---|---|---|---|
| Filtro "No llegó" | ✓ (`filtroLlegada: NO_LLEGO`) | ✗ ERP tiene PENDIENTES/CONFIRMADOS pero no "No llegó" como botón | AGREGAR |
| Filtro "Sí llegó" | ✓ (`filtroLlegada: SI_LLEGO`) | ✗ | AGREGAR |
| Filtro "Todos" | ✓ | ⚠ implícito | AGREGAR botón explícito |
| Filtro tipo PRE / REP | ✓ (`filtroTipo: PRE/REP/TODOS`) | ✗ | AGREGAR |
| Stat cards PENDIENTES / SIN RV / CONFIRMADOS | ✗ no en legacy | ✓ (extra ERP) | MANTENER |
| Tab PENDIENTES / PARCIALES / CONFIRMADOS (Ingresos model) | ✗ | ✓ (legacy Ingresos wrapper) | MANTENER |
| Botón "Forzar" ingreso por doc | ✓ | ✓ | OK |
| Botón "Forzar llegada" (override SQL) | ✓ (`forzarLlegada` mutation) | ✓ (`piForzarModal`) | OK |
| Botón "Forzar nota completa" | ✓ | ✗ solo doc individual en ERP | VERIFICAR |
| PdfViewer integrado | ✓ | ✓ | OK |
| Búsqueda | ✓ | ✓ | OK |
| BarcodeScanner | ✗ | ✓ (extra ERP) | MANTENER |
| Columna Local | ✓ | ✓ | OK |
| Columna Proveedor / NP con badge PRE/REP | ✓ | ✓ (TipoBadge) | OK |
| Columna Tipo doc (REM / R/F) | ✓ | ✓ | OK |
| Columna N° Doc | ✓ | ✓ | OK |
| Columna RV | ✓ | ✓ | OK |
| Columna Cant. | ✓ | ✓ | OK |
| Columna "Llegó" con detalle por RV | ✓ (`renderLlego`) | ⚠ en ERP es confirm modal, no badge inline | AJUSTAR |
| Columna Admin (Forzar) | ✓ | ✓ | OK |
| Columna Obs | ✓ | ✓ | OK |
| SemaforoLuz | ✓ | ✓ | OK |
| DiasBadge | ✓ | ✓ | OK |
| Badge 99+ en nav | ✓ | ✓ (`badgeKey: recepcion_pendiente`) | OK |
| Auto-completar docs con Llegó=Sí | ✓ (side-effect) | ✗ | VERIFICAR si necesario |

**Faltantes Fase 3:** No llegó / Sí llegó / Todos filter (3 botones), PRE/REP filter (2 botones). Total: ~5 items.

---

## 4. Completados — `CompletadosPage.jsx` (344 líneas)
**Gap estimado: ALTO — mayor gap del módulo**

| Feature | Legacy (Admin.tsx CompletadosTab) | ERP nuevo | Acción |
|---|---|---|---|
| Agrupado por local (nivel 1 colapsable) | ✓ (bg-green-700 header) | ✓ (bg-green-50 header) | ⚠ AJUSTAR color |
| Contador NP por local | ✓ | ✓ | OK |
| Expand por nota dentro de local (nivel 2) | ✓ (nota header: N°/proveedor/PRE/REP/pedido/remitido) | ✓ | OK |
| Filter "OK" (sin diferencia) | ✓ (`filtroComp: ok`) | ✗ ERP solo tiene filter de días | AGREGAR |
| Filter "Con Diferencia" | ✓ (`filtroComp: dif`) | ✗ | AGREGAR |
| Contador OK / Con Diferencia en toolbar | ✓ | ✗ | AGREGAR |
| Búsqueda por proveedor / NP / RV / N° doc | ✓ | ✓ (por NP / proveedor) | ⚠ AMPLIAR a RV + doc |
| Filter por días (30d / 90d / 180d) | ✗ | ✓ (extra ERP) | MANTENER |
| Export CSV | ✗ | ✓ (extra ERP) | MANTENER |
| Nivel 3: tabla de documentos por nota | ✓ (Estado / Tipo / Fecha / N°Doc / RV / Cant / PDFs / Obs.local) | ✗ ERP no expande a nivel de doc | **AGREGAR — mayor trabajo** |
| Status chip por doc: ✓ OK / Local ✓ / Auto | ✓ | ✗ | AGREGAR junto con nivel 3 |
| Columna RV por doc con botón "!RV" | ✓ (click abre popup asignar RV) | ✗ | AGREGAR |
| Popup "Cargar RV" desde Completados | ✓ | ✗ | AGREGAR |
| Columna PDFs por doc (factura + RV) | ✓ | ✗ | AGREGAR |
| Columna "Obs. local" por doc | ✓ | ✗ | AGREGAR |
| Banner diferencia por nota (Pedido Xu — Remitido Yu) | ✓ (rojo si hayDifReal, ámbar si ANP) | ✗ | AGREGAR |
| Badge ANP por nota | ✓ (`COMPRAS_ACEPTO_DIFERENCIA`) | ✓ (`accepted_difference`) | OK |
| Obs forzado / OBS_FINALIZADO_FORZADO | ✓ (banner ámbar) | ✗ | AGREGAR |
| Botón "Nota de Pedido" (abrir Excel adjunto) | ✓ | ✗ | AGREGAR |
| Botón "Deshacer completado" → vuelve a Recepción | ✓ | ✗ ERP tiene "Archivar" (diferente semántica) | REEMPLAZAR/AGREGAR |
| Badge "Reabrir (diferencia sin aceptar)" estilo rojo | ✓ cuando hayDifReal && !ANP | ✗ | AGREGAR junto con deshacer |
| Refresh manual | ✓ | ✗ | AGREGAR |
| Tabs Completados / Recibidos (pendiente cierre) | ✗ | ✓ (extra ERP) | MANTENER |
| Barra de progreso % recibido por local | ✗ | ✓ (extra ERP) | MANTENER |
| Columnas orden: N° Pedido / Proveedor / Tipo / Fecha / Pedido / Recibido / Facturado / Docs | ⚠ legacy en nivel nota-header, no tabla | ✓ tabla plana por orden | MANTENER (mejor) |

**Faltantes Fase 1 (en orden de prioridad):**
1. Filter OK / Con Diferencia + contadores (1 bloque)
2. Nivel 3 tabla de documentos por nota (mayor esfuerzo)
3. RV popup / "!RV" button por doc
4. PDFs por doc (PdfViewer ya existe)
5. Banner diferencia por nota
6. Status chips por doc (OK / Local ✓ / Auto)
7. Obs forzado display
8. "Nota de Pedido" file button
9. Botón "Deshacer completado"
10. Color header local (dark green bg-green-700)
11. Refresh button
12. Ampliar search a RV + N° doc

Total: **12 items** — mayores son #2 (nivel 3 docs) y #3 (RV popup).

---

## 5. Gestión Pagos — `GestionPagosPage.jsx` (1338 líneas)
**Gap estimado: MEDIO-ALTO**

| Feature | Legacy (GestionPagosTab.tsx + ProveedoresTab.tsx + HistoriaProveedoresTab.tsx) | ERP nuevo | Acción |
|---|---|---|---|
| Tab "Resumen" | ✓ (ResumenTab.tsx 57 KB, separado) | ✓ (ResumenTab inline, KPI cards) | ⚠ AMPLIAR contenido |
| Tab "Comprobantes" | ✓ (vista principal GestionPagosTab) | ✓ (VouchersTab) | OK |
| Tab "Cuentas Bancarias" | ✓ | ✓ (BankAccountsTab) | OK |
| Tab "Notas de Crédito" | ✓ | ✓ (CreditNotesTab) | OK |
| Tab "Facturas Todas" | ✓ | ✓ (FacturasTodasTab) | OK |
| Tab "Historial" | ✓ | ✓ (HistorialTab — fechas + tipos) | OK |
| Tab "ABM Proveedores" | ✓ (ProveedoresTab) | ✓ (ProveedoresAbmTab) | ⚠ DIFERENTE UX |
| Tab "Historia Proveedores" | ✓ (HistoriaProveedoresTab) | ✗ HistoriaProveedor componente existe pero no es tab aquí | AGREGAR tab |
| Tab "Anulación de Pagos" | ✓ | ✗ | AGREGAR tab |
| Tab "RM Indumentaria SRL" | ✓ (sub-vista empresa) | ✗ | AGREGAR (verificar si aplica multi-tenant) |
| Sidebar con logos de marcas | ✓ (Montagne, Miding, Kodiak, etc.) | ✗ | AGREGAR |
| ABM Proveedores: spreadsheet editable (doble click en celda) | ✓ (horizontal scrollable, ~15 categorías de columnas) | ✗ ERP usa form modal (ProviderEditCard) | REDISEÑAR tab |
| ABM Proveedores: categorías de columnas (Datos Básicos / Contacto / Fiscal / Ret. IVA / Ret. IIBB / Ret. IIBB 1 / Ret. Ganancias / SUSS / Contabilidad / Estado-Admin / Comercial / Dirección / Operaciones / Varios / Sistema) | ✓ | ✗ | AGREGAR al rediseñar |
| ABM Proveedores: contador "179 proveedores — doble click en celda para editar" | ✓ | ⚠ tiene contador pero sin doble click | AGREGAR |
| Botón "Importar Tango PDF" | ✓ (providers.py tiene lógica) | ✗ | AGREGAR |
| Botón "Anulados" en Comprobantes | ✓ | ⚠ filtro por estado ANULADO existe | OK |
| Botón "CSV" export | ✓ | ✓ (en VouchersTab) | OK |
| CrucePreciosModal por comprobante | ✓ | ✓ | OK |
| Filtro estado Comprobantes: Por Pagar / Vencido / Parcial / Pagado / Todos | ✓ | ✓ (select dropdown) | ⚠ CAMBIAR a pills como legacy |
| Filtro proveedor en Comprobantes | ✓ | ✓ | OK |
| Búsqueda en Comprobantes | ✓ | ✓ | OK |
| Sort por columna en tabla Comprobantes | ✓ | ✗ | AGREGAR |
| Resumen por proveedor (vista toggle) | ✓ | ✓ (ResumenTab) | OK |
| Print minuta PDF | ✓ | ✓ | OK |
| Badge 99+ en nav | ✓ | ✓ (`badgeKey: pagos_pendientes`) | OK |

**Faltantes Fase 5 (en orden de prioridad):**
1. Historia Proveedores tab (componente ya existe, solo agregar tab)
2. Anulación de Pagos tab
3. ABM Proveedores: rediseñar como spreadsheet editable con categorías
4. Sidebar logos de marcas
5. Importar Tango PDF botón
6. Sort por columna en Comprobantes
7. Filtro Comprobantes: cambiar select a pills
8. Tab "RM Indumentaria SRL" (verificar si aplica)

Total: **8 items** — mayor es #3 (spreadsheet proveedores).

---

## Resumen ejecutivo

| Fase | Pantalla | Gap | Items faltantes | Prioridad |
|---|---|---|---|---|
| **Fase 1** | CompletadosPage | **ALTO** | **12** | 🔴 URGENTE |
| **Fase 2** | IngresoPage | BAJO | 2 | 🟡 NORMAL |
| **Fase 3** | RecepcionPage | MEDIO | 5 | 🟡 NORMAL |
| **Fase 4** | PedidosComprasPage | MEDIO | 5 | 🟡 NORMAL |
| **Fase 5** | GestionPagosPage | MEDIO-ALTO | 8 | 🟠 IMPORTANTE |

**Total acumulado: 32 features** a agregar/ajustar.

### Items por fase de mayor a menor impacto visual:

**Fase 1 (Completados) — hacerlo primero:**
- Tabla de documentos por nota (nivel 3) — el mayor gap visual
- Filter OK vs Con Diferencia
- RV popup desde Completados
- Botón Deshacer completado

**Fase 5 (Gestión Pagos) — el trabajo más largo:**
- Spreadsheet editable en ABM Proveedores
- 3 tabs nuevas (Historia Proveedores, Anulación, RM Ind.)

**Fases 2, 3, 4 — quirúrgicas, pocas líneas c/u:**
- Agregar 2-3 filter buttons a cada pantalla

### Componentes ya existentes (NO crear duplicados):
- `HistoriaProveedor.jsx` → usar en Fase 5
- `PdfViewer.jsx` → usar en Fase 1 (PDFs de docs en Completados)
- `CargaAvanzada.jsx` → ya integrado en Ingresos ✓
- `ComparadorCruzado.jsx` → ya integrado en Compras ✓
- `CrucePreciosModal.jsx` → ya integrado en Gestión Pagos ✓
