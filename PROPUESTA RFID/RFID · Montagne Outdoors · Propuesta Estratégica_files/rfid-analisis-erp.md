# 📦 Análisis RFID — Cadena Completa: Mayorista → Minorista
## Para integración en ERP Mundo Outdoor / Montagne

---

## 1. RECEPCIÓN DE MERCADERÍA (Inbound — Mayorista / Proveedor)

### Situación actual sin RFID
- Se cuenta prenda por prenda manualmente
- Errores humanos frecuentes (falta 1 prenda de 500 y nadie se da cuenta)
- El proceso de recepción tarda horas
- No hay registro de quién recibió qué

### Con RFID
| Proceso | Detalle |
|---|---|
| **Lectura masiva** | Se pasan las cajas por un portal lector y se leen 300–500 prendas en segundos sin abrir cajas |
| **Verificación automática** | El sistema compara lo recibido vs. la orden de compra en tiempo real |
| **Alerta de faltantes** | Si vinieron 498 de 500, el sistema lo marca instantáneamente |
| **Registro de operador** | Queda grabado el usuario ERP que confirmó la recepción, fecha y hora |
| **Trazabilidad de origen** | Cada tag tiene ID único → se sabe de qué proveedor, lote, fecha de fabricación vino cada unidad |

**Campos sugeridos en ERP:**
- `rfid_tag_id` (único por prenda)
- `recibido_por` (user_id)
- `fecha_recepcion`
- `orden_compra_id`
- `local_destino`

---

## 2. TRANSFERENCIAS ENTRE DEPÓSITO Y LOCALES

### Con RFID
| Proceso | Detalle |
|---|---|
| **Despacho desde depósito** | Operador pasa el bulto por el portal → sistema genera remito automáticamente con cada RFID escaneado |
| **Recepción en local** | El local escanea y confirma → diferencia detectada automáticamente |
| **Responsabilidad por tramo** | Queda registrado quién despachó y quién recibió. Si falta algo, se sabe exactamente en qué tramo desapareció |
| **Sin conteo manual** | 100 prendas escaneadas en 3 segundos |

**Campos sugeridos en ERP:**
- `transferencia_id`
- `estado`: `EN_TRANSITO` / `RECIBIDO` / `DIFERENCIA`
- `despachado_por` (user_id)
- `recibido_por` (user_id)
- `diferencia_tags[]` (lista de IDs faltantes o sobrantes)

---

## 3. CONTROL DE STOCK EN LOCAL (Inventario en tiempo real)

### Con RFID
| Proceso | Detalle |
|---|---|
| **Inventario sin cerrar el local** | Un empleado camina el local con un lector portátil y en 15 min tiene el inventario completo (vs. cerrar 2 horas) |
| **Stock en tiempo real** | Cada movimiento actualiza el stock automáticamente |
| **Detección de artículos fuera de lugar** | Si una prenda está en el probador cuando debería estar en el perchero, el sistema lo sabe |
| **Alertas de reposición** | Stock por debajo del mínimo → alerta automática |
| **Anti-hurto interno** | Si una prenda sale sin ser vendida, el sistema registra la alarma y qué tag fue |

**Campos sugeridos en ERP:**
- `ubicacion_actual`: `PERCHERO` / `PROBADOR` / `CAJA` / `DEPOSITO_LOCAL` / `VENDIDO` / `ALARMA`
- `ultimo_movimiento_timestamp`
- `ultimo_operador_id`

---

## 4. CONTROL DE PROBADORES 🧥

Este es uno de los casos de uso más potentes y diferenciales para indumentaria.

### Cómo funciona
- En la entrada del probador hay un lector RFID
- El vendedor/cliente lleva prendas al probador → se leen automáticamente
- Al salir del probador → se vuelven a leer

### Lo que el ERP registra
| Evento | Dato registrado |
|---|---|
| Ingreso al probador | Tags ingresados, cantidad, hora, operador que autorizó |
| Egreso del probador | Tags que salieron, cantidad, diferencia |
| ⚠️ Diferencia detectada | Tag que entró pero no salió → alerta inmediata al sistema |
| ✅ Sin diferencia | Prendas vuelven al perchero, stock actualizado |

### Lógica de negocio sugerida
```
SI tags_ingresados != tags_egresados:
  → Estado prenda = ALERTA_PROBADOR
  → Notificación al supervisor
  → Registro en log de incidentes con hora, probador y operador
```

**Campos sugeridos en ERP:**
- `probador_id`
- `sesion_probador_id`
- `prendas_ingresaron[]`
- `prendas_salieron[]`
- `diferencia[]`
- `atendido_por` (vendedor que habilitó)
- `estado_sesion`: `ABIERTA` / `CERRADA_OK` / `CERRADA_CON_DIFERENCIA`

---

## 5. PUNTO DE VENTA — DESACTIVACIÓN DE TAG EN CAJA

### Flujo completo
1. Cajero escanea prenda en el punto de venta (puede ser lector RFID integrado o handscanner)
2. ERP valida que el tag esté en estado activo y pertenezca al local
3. Se procesa la venta
4. **Tag se desactiva automáticamente** (`estado = VENDIDO`)
5. Al pasar por el antena de seguridad de salida → **no suena la alarma** porque el tag ya fue neutralizado

### Si el tag NO fue desactivado (intento de hurto)
- Alarma suena en la salida
- ERP registra qué tag activó la alarma
- Se puede ver en tiempo real desde el dashboard: "TAG ID XXXX — Prenda: Campera M Azul — Valor: $45.000 — Intento de salida sin venta a las 15:42hs"

**Campos sugeridos en ERP:**
- `estado_tag`: `ACTIVO` / `VENDIDO` / `ALARMA` / `ANULADO` / `DEVUELTO`
- `vendido_en_ticket_id`
- `desactivado_por` (user_id cajero)
- `timestamp_desactivacion`
- `alarma_triggered`: bool

---

## 6. DEVOLUCIONES Y RE-INGRESO DE STOCK

| Proceso | Detalle |
|---|---|
| **Devolución en caja** | Se escanea el tag → ERP verifica que fue vendido en ese local → reactiva tag → vuelve al stock |
| **Control de original** | Si el tag fue falsificado o reemplazado, el sistema detecta que el ID no existe en la base |
| **Reingreso al perchero** | Estado pasa de `DEVUELTO` a `EN_LOCAL_PERCHERO` |

---

## 7. TRAZABILIDAD COMPLETA — HISTORIA DE VIDA DE UNA PRENDA

Cada prenda tendría su "historia de vida" completa consultable en el ERP:

```
TAG: A3F2-9810-XX

[12/03/2025 09:15] RECIBIDO en depósito central — Operador: deposito_user1 — OC: #4521
[15/03/2025 10:30] TRANSFERIDO a Local Palermo — Despachado: deposito_user1
[15/03/2025 14:10] RECIBIDO en Local Palermo — Recibido: local_palermo_encargada
[18/03/2025 16:45] INGRESÓ a PROBADOR #2 — Vendedor: vendedor_luisa
[18/03/2025 16:52] SALIÓ de PROBADOR #2 — OK (sin diferencia)
[22/03/2025 11:20] VENDIDO — Ticket: #8834 — Caja: caja1 — Cajero: cajero_pedro
[22/03/2025 11:20] TAG DESACTIVADO
```

---

## 8. CONTROL DE OPERADORES — AUDITORÍA

Cada acción queda vinculada a un usuario del ERP:

| Acción | Registro |
|---|---|
| Recibir mercadería | user_id + timestamp + local |
| Despachar transferencia | user_id + timestamp |
| Habilitar probador | user_id + vendedor + probador_id |
| Procesar venta | user_id cajero + ticket |
| Anular tag / devolución | user_id + motivo |
| Tomar inventario | user_id + duración + diferencias encontradas |

Esto permite detectar patrones sospechosos:
- Un vendedor que habilita muchos probadores con diferencias recurrentes
- Un cajero que procesa muchas anulaciones
- Horarios con mayor índice de alarmas

---

## 9. KPIs Y MÉTRICAS QUE HABILITA EL RFID EN EL ERP

| Métrica | Descripción |
|---|---|
| **Tasa de diferencia en probadores** | (sesiones con diferencia / total sesiones) × 100 |
| **Tiempo promedio de inventario** | Minutos que tarda el conteo por local |
| **Exactitud de stock** | % de coincidencia entre stock físico RFID y stock lógico del sistema |
| **Prendas en alarma** | Cantidad de tags que activaron alarma de salida en el período |
| **Tasa de devoluciones** | Prendas reingresadas vs vendidas |
| **Shrinkage por local** | Pérdida por hurto/error medida en $ y unidades |

---

## 10. MÓDULOS A DESARROLLAR EN EL ERP

| Módulo | Descripción |
|---|---|
| `rfid_tags` | Tabla maestra de tags: ID, estado, prenda vinculada, historial |
| `rfid_eventos` | Log de cada evento (scan, venta, alarma, etc.) |
| `rfid_probadores` | Sesiones de probador: ingreso/egreso/diferencia |
| `rfid_transferencias` | Despachos y recepciones con verificación de tags |
| `rfid_inventarios` | Sesiones de toma de inventario por local |
| `rfid_alarmas` | Registro de alarmas en salida |
| `rfid_dashboard` | Vista en tiempo real: stock por local, alertas activas, prendas en probador |

---

## 11. TABLA DE ESTADOS DE UN TAG

```
CREADO → EN_DEPÓSITO → EN_TRANSITO → EN_LOCAL → EN_PROBADOR → EN_LOCAL (si vuelve)
                                                              → ALERTA_PROBADOR
                                          → VENDIDO → DESACTIVADO
                                          → ALARMA_SALIDA
                                          → DEVUELTO → EN_LOCAL
                                          → ANULADO (prenda dañada/baja)
```

---

## 12. COSTOS ORIENTATIVOS (para análisis de ROI)

| Componente | Costo aprox. |
|---|---|
| Tag RFID por prenda | USD 0,05 – 0,15 |
| Lector portal (entrada/salida depósito) | USD 2.000 – 5.000 |
| Lector portátil (inventario) | USD 500 – 1.500 |
| Antena de seguridad (salida local) | USD 800 – 2.000 |
| Lector probador | USD 300 – 800 |
| Impresora de tags RFID | USD 1.500 – 4.000 |
| Software / integración ERP | desarrollo propio |

### Comparación costo-beneficio
- **1 prenda robada** de valor promedio $40.000 ARS ≈ costo de 200–800 tags
- **Inventario manual** 2 veces al año × 8 horas × 3 personas = 48 hs hombre → con RFID: 1 persona, 30 min
- **Diferencias en recepción** no detectadas: pérdidas directas sin evidencia → con RFID: detectadas 100% al instante
- **Shrinkage promedio en indumentaria argentina**: 1,5–3% de la facturación anual → en una empresa con $10M anuales = $150.000–$300.000 de pérdida prevenible

---

*Documento generado para integración en ERP Mundo Outdoor / Módulo RFID*
*Versión 1.0 — Abril 2025*
