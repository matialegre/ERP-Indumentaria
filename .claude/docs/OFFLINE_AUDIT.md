# Auditoría Offline — ERP Mundo Outdoor

**Fecha**: 2026-04-28
**Total páginas auditadas**: 79 (63 root + 6 taller + 16 crm)

## Resumen ejecutivo

| Categoría | Páginas | % |
|---|---|---|
| ✅ FULL OFFLINE | 11 | 14% |
| ⚠ PARCIAL | 0 | 0% |
| ❌ NO OFFLINE | 55 | 70% |
| 🌐 IMPOSIBLE (APIs externas) | 16 | 16% |

**Conclusión**: la infraestructura offline está sólida (`offlineDB.js`, `offlineSync.js`, `AuthContext.jsx`) pero subutilizada. Solo 11 páginas la usan. El 70% de las pantallas crashean sin red porque hacen `api.get/post` directo sin fallback.

---

## ✅ FULL OFFLINE (11) — funcionan sin red

| Página | Categoría | Cómo lo logra |
|---|---|---|
| `FacturacionPage.jsx` | Core POS | `saveOfflineSale`, `enqueueOp`, `decrementLocalStock`, recibo offline |
| `IngresoPage.jsx` | Core | `enqueueOp`, marca `PENDING_SYNC`, sincroniza al conectar |
| `RecepcionPage.jsx` | Core | `enqueueOp`, lee desde IndexedDB |
| `StockPage.jsx` | Core | `enqueueOp` para ajustes, decrementos en queue |
| `ConsultasPage.jsx` | Lectura | `getAll` desde IndexedDB |
| `ConfigPage.jsx` | Admin | `syncAllCatalogs`, `clearStore` |
| `SyncStatusPage.jsx` | Admin | dashboard de cola pendiente |
| `taller/ClientesTallerPage.jsx` | Taller | `useOfflineQuery` |
| `taller/OTListPage.jsx` | Taller | `useOfflineQuery` |
| `taller/OTNewPage.jsx` | Taller | `useOfflineMutation`, `saveOTPending` |
| `taller/StockTallerPage.jsx` | Taller | `useOfflineQuery` |

---

## 🌐 IMPOSIBLE OFFLINE (16) — APIs externas

Estas pantallas dependen de servicios externos (SQL Server legacy, MercadoLibre, VTEX, Clinkbox). **No se pueden hacer offline por diseño.** Lo único que se puede mejorar es: cachear el último resultado y mostrar "datos al XX/XX/2026 XX:XX".

| Página | API que la bloquea |
|---|---|
| `InformesPage.jsx` | SQL Server (informes_snapshot) |
| `CashFlowPage.jsx` | SQL Server |
| `CajasPage.jsx` | Clinkbox + SQL Server (datos en vivo) |
| `ClinkApiPage.jsx` | Clinkbox API |
| `MercadoLibrePage.jsx` | MercadoLibre API |
| `MegaAdminPage.jsx` | Clinkbox + ML |
| `PropuestasPage.jsx` | Clinkbox |
| `SupertrendPage.jsx` | API externa de competencia |
| `RFIDPropuesta.jsx` | Hardware RFID + Clinkbox |
| `crm/CRMDragonfish.jsx` | Dragonfish API |
| `crm/CRMMeliNeuquen.jsx` | MercadoLibre |
| `crm/CRMMeliIndumentaria.jsx` | MercadoLibre |
| `crm/CRMVtex.jsx` | VTEX |
| `crm/CRMVtexInactivos.jsx` | VTEX |
| `crm/CRMIntegraciones.jsx` | Multi-API |
| `crm/CRMAnalytics.jsx` | Analytics agregadas |

---

## ❌ NO OFFLINE (55) — crashean sin red

Patrón vulnerable usado en todas:
```js
const { data } = useQuery({
  queryFn: () => api.get("/endpoint/")  // ← sin fallback
});
```

### Core operativo (9) — alta prioridad si querés offline real
- `PedidosPage.jsx`
- `ProductosPage.jsx`
- `PedidosComprasPage.jsx`
- `ProveedoresPage.jsx`
- `LocalesPage.jsx`
- `DepositoPage.jsx`
- `FacturasProveedorPage.jsx`
- `ImportacionPage.jsx`
- `UsuariosPage.jsx`

### Reportes & análisis (8)
- `ReportesPage.jsx`, `ConsultasSQLPage.jsx`, `ComisionesPage.jsx`, `ComparadorPage.jsx`, `ResumenPage.jsx`, `RRHHPage.jsx`, `PuntuacionEmpleadosPage.jsx`, `MejorasPage.jsx`

### CRM (8)
- `CRMClientes`, `CRMCampanas`, `CRMMensajes`, `CRMPublicidad`, `CRMReportes`, `CRMContenido`, `CRMClub`, `CRMAIChat`

### Calendario, fichajes, transporte, RFID, admin (24)
- `CalendarioEventosPage`, `FichajePage`, `FichajeCheckInPage`, `TransportePage`, `VencimientosPage`, `MensajesPage`
- 6 páginas RFID (`RFIDDashboard`, `RFIDInventario`, `RFIDLectores`, `RFIDEtiquetas`, `RFIDAlertas`, `RFIDContenido`)
- 7 admin/config (`ConfigModulosPage`, `ConfiguradorMenuPage`, `LicenciasPage`, `MonitoreoPage`, `MobileAppPage`, `KanbanPage`, `NaalooPage`)
- 4 varios (`AsistentePage`, `CompanyWizardPage`, `CalendarioPage`, otras)

### Nuevas (no auditadas porque son recientes — pero también ❌)
- `CajasPage.jsx` (incluida arriba en 🌐 porque depende de Clinkbox + SQL Server live)

---

## Auditoría de infraestructura

### `lib/api.js` — ⚠ detecta offline pero sin fallback automático

```js
if (err.message === "Failed to fetch") {
  const e = new Error("Sin conexión al servidor");
  e.offline = true;  // marca pero no resuelve
  throw e;
}
```

El fallback queda delegado a cada page. Las que usan `useOfflineQuery` o `fetchWithFallback` funcionan; las demás crashean.

### `lib/offlineSync.js` — ✅ motor sólido

Sincroniza cada 60s:
- `catalogProducts` (500 items)
- `catalogStock` (filtrado por local)
- `catalogProviders` (500)
- `catalogLocals` (100)
- `recentOrders` (100)
- `pendingIngresos` (200)

Funciones:
- `syncAllCatalogs()` — pull periódico
- `fetchWithFallback()` — intenta red 2.5s, después IndexedDB
- `flushPendingOps()` — empuja cola de escrituras al reconectar
- `onConnectionChange()` — listeners de estado de red

### `context/AuthContext.jsx` — ✅ login offline funcional

- `cacheAuthCredentials()` — guarda username + SHA-256 hash + perfil
- `verifyOfflineAuth()` — valida contra cache local sin backend
- Fallback automático si backend no responde
- Auto-sincroniza catálogos después de login exitoso

**Limitación**: solo funciona si el usuario inició sesión antes online (necesita el cache previo).

---

## Lo que SÍ funciona offline hoy

| Operación | Estado | Condición |
|---|---|---|
| Login | ✅ | Con sesión previa cached |
| Ver catálogo productos | ✅ | Si fue sincronizado |
| Ver stock por local | ✅ | Si fue sincronizado |
| Ver pedidos recientes | ✅ | Últimos 100 |
| Ver ingresos pendientes | ✅ | Últimos 200 |
| **Crear factura POS** | ✅ | Se encola |
| **Recibir mercadería** | ✅ | Se encola |
| **Ajustar stock** | ✅ | Se encola |
| Crear pedido | ❌ | Sin queue de escritura |
| Crear producto | ❌ | Sin queue |
| Ver compras / facturas proveedor | ❌ | Sin cache |
| Reportes | ❌ | Cálculos remotos |
| CRM | ❌ | APIs externas |

---

## Vulnerabilidades concretas

1. **`StockPage` + `FacturacionPage` desincronizados**: si el stock remoto falla pero hay cache, permite vender. Puede generar inconsistencia si después no sincroniza bien (vendiste 5, real había 2 → over-sell).
2. **`ProductosPage` bloqueante**: no se puede dar de alta un producto sin red. Eso bloquea el flujo de compras enteramente.
3. **`PedidosPage` sin queue**: si hay desconexión durante el POST de un pedido, se pierde.
4. **70% del ERP**: patrón `useQuery` sin fallback. Cualquier corte de red rompe la pantalla.

---

## Recomendaciones (Capa 1 → Capa 3)

### Capa 1 — CRÍTICAS (implementar primero)

1. **`ProductosPage` con offlineDB** (catálogo no debe bloquearse sin red)
2. **`PedidosPage` con queue de escritura** (compras no se pierdan)
3. **`ProveedoresPage` + `LocalesPage` con cache** (lectura offline al menos)
4. **Banner global "Modo offline activo"** cuando se detecta sin red — más visible que el widget actual de sync
5. **Indicador "datos sincronizados al ___"** en cada page con cache

### Capa 2 — ÚTILES

6. `FacturasProveedorPage` con cache
7. `MensajesPage` cola de escritura (mensajes en queue, se envían al reconectar)
8. `FichajePage` cache + queue (importante para fichaje en sucursales con red débil)
9. `KanbanPage` cache (las tarjetas no deberían desaparecer sin red)
10. `RFIDInventario` cache (al menos lectura del último estado)

### Capa 3 — BAJA PRIORIDAD

11. Resto de admin / config (estos pueden requerir red, no se usan en flujo crítico)
12. CRM externo: solo cachear última lectura y mostrar advertencia
13. Reportes: cachear last-fetch con timestamp

### NO HACER

- No intentar offline en las 16 🌐 (Informes, Clink, MercadoLibre, VTEX, etc.) — solo cachear el último resultado y mostrar "datos viejos al ___"

---

## Esfuerzo estimado

- **Capa 1 (5 ítems)**: 2-3 días de desarrollo + testing
- **Capa 2 (5 ítems)**: 3-4 días
- **Capa 3 (3 ítems)**: 1-2 días
- **Total**: ~2 semanas para tener el ERP "offline-first real"

---

## Decisión pendiente del usuario

1. **Estrategia de conflictos** (cuando dos usuarios editan offline el mismo registro): last-write-wins, server-authoritative, manual merge?
2. **Tiempo válido del cache de auth** (cuántas horas/días puede usar el ERP offline antes de re-loguear): 24h? 7 días? Permanente?
3. **Tamaño máximo del cache** en IndexedDB (hoy 500 productos / 100 pedidos — ¿escalar?)
4. **¿Capa 3 vale la pena?** (RFID, Kanban offline) — bajo uso, alto costo
