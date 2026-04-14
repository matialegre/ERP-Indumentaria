# Arquitectura de Sincronización Offline — ERP Mundo Outdoor

> **Versión:** 1.0  
> **Fecha:** 2026-04-12  
> **Autor:** Especialista en Sincronización Offline  
> **Estado:** Documento de diseño — pendiente de implementación

---

## Contexto del sistema actual

El ERP ya cuenta con una **implementación offline funcional** basada en:

| Componente | Tecnología | Estado |
|-----------|-----------|--------|
| Base de datos local | IndexedDB vía `idb` 8.0.3 | ✅ Producción |
| Service Worker | PWA manual (sw.js, 300 líneas) | ✅ Producción |
| Outbox pattern | `pendingOps` en IndexedDB | ✅ Producción |
| Auth offline | SHA-256 cached credentials | ✅ Producción |
| Recibos offline | HTML client-side generation | ✅ Producción |
| Sync UI | SyncStatusPage.jsx | ✅ Producción |

**Lo que falta** — y este documento resuelve — es una estrategia robusta de **resolución de conflictos**, **sincronización bidireccional con garantías**, y un **esquema de eventos de sync** que permita auditoría y recuperación.

---

# SECCIÓN 1: Evaluación de Tecnologías

## 1.1 Matriz comparativa

| Criterio | PowerSync | ElectricSQL | CouchDB/PouchDB | Custom Event Sourcing |
|----------|-----------|-------------|-----------------|----------------------|
| **100% offline sin degradación** | ✅ Completo | ✅ Completo | ✅ Completo | ✅ Completo |
| **Conflictos built-in** | ⚠️ Solo LWW | ✅ CRDT nativo | ✅ Multi-value trees | ✅ A medida |
| **Open source** | ❌ SaaS propietario | ✅ Apache 2.0 | ✅ Apache (ASF) | ✅ Propio |
| **Madurez / comunidad** | ⚠️ Moderada | ⚠️ Post-1.0 (2025) | ✅ 15+ años, 17k★ | Depende de libs |
| **SQLite local + PostgreSQL central** | ✅ Nativo | ✅ Nativo + PGlite | ❌ Requiere bridge | ✅ Control total |
| **Windows (Electron/PWA)** | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí |
| **Costo estimado** | $$$⁄mes SaaS | Dev time + hosting | Dev time + bridge | Dev time alto |
| **Tiempo a producción** | 2–4 semanas | 4–8 semanas | 6+ meses | 2–3 meses |

## 1.2 Análisis detallado

### PowerSync

PowerSync actúa como middleware entre PostgreSQL y SQLite en el cliente. Usa replicación lógica de PostgreSQL para detectar cambios y los empuja al cliente vía HTTP.

**Ventajas:**
- Integración nativa PostgreSQL → SQLite, exactamente nuestro stack
- Menor tiempo a producción (SDK listo, documentación clara)
- Soporte para "Shapes" (replicación parcial por queries)

**Desventajas:**
- **No es open source.** Vendor lock-in real. Si PowerSync cierra o sube precios, hay que migrar toda la capa de sync
- Resolución de conflictos limitada a Last-Write-Wins (LWW), insuficiente para un ERP con stock compartido
- Comunidad más chica, menos battle-tested en escenarios enterprise

**Veredicto:** Bueno para un MVP rápido, pero el lock-in y la falta de resolución avanzada de conflictos lo descartan para un ERP de producción.

### ElectricSQL

Post-pivot (2024–2025), ElectricSQL se estabilizó en v1.0 con un motor de sync basado en Elixir. Lee el WAL de PostgreSQL y sincroniza "shapes" (subsets de datos definidos por WHERE clauses) hacia SQLite en el cliente.

**Ventajas:**
- Open source (Apache 2.0), self-hosteable
- PostgreSQL nativo, no requiere base de datos intermedia
- CRDT-based conflict resolution — muy superior a LWW para nuestro caso
- PGlite (Postgres en WASM, 15k★) como opción futura para el cliente
- Comunidad activa y en crecimiento (10k+ ★)

**Desventajas:**
- Recién alcanzó v1.0 en marzo 2025 — pasó por múltiples pivots arquitecturales
- La API de write-path (cliente → servidor) todavía está en evolución
- Documentación tiene gaps para casos enterprise complejos
- Historial de breaking changes genera incertidumbre a mediano plazo

**Veredicto:** La mejor opción técnica si estuviera más madura. Recomendable evaluar post-v1.2 para producción, pero hoy tiene riesgo de estabilidad.

### CouchDB/PouchDB

Modelo document-oriented con replicación multi-master. PouchDB corre en el browser con IndexedDB como backend.

**Ventajas:**
- El modelo de sync más probado de la industria (15+ años)
- Resolución de conflictos con árbol de revisiones — el más sofisticado de las 4 opciones
- Apache-backed, extremadamente estable
- P2P sync sin servidor intermedio

**Desventajas:**
- **Incompatibilidad arquitectural fundamental.** El ERP usa un modelo relacional (PostgreSQL con 22 tablas, foreign keys, joins). CouchDB es document-oriented. Migrar requeriría:
  - Rediseñar el esquema de datos completo
  - Construir un bridge PostgreSQL ↔ CouchDB que mantenga integridad referencial
  - Reescribir todas las queries del backend
- Problemas conocidos con datasets grandes (JSON.stringify limits en batch syncs)
- El esfuerzo de migración supera los beneficios de la tecnología

**Veredicto:** Excelente tecnología de sync, pero **incompatible con nuestra arquitectura relacional**. Descartada.

### Custom Event Sourcing

Implementación propia usando una tabla de eventos en PostgreSQL, SQLite en el cliente, y CRDTs (vía Automerge o implementación manual) para resolución de conflictos.

**Ventajas:**
- **Control total** sobre el modelo de datos, resolución de conflictos, y lógica de negocio
- Integración nativa con PostgreSQL existente — no requiere middleware externo
- Sin dependencias de terceros para la capa crítica de sync
- La resolución de conflictos se diseña exactamente para el dominio (stock, facturas, OTs)
- Compatible con el outbox pattern que **ya existe** en el frontend (`pendingOps`)

**Desventajas:**
- Mayor esfuerzo de desarrollo (2–3 meses para MVP)
- Requiere expertise en sistemas distribuidos
- Testing es complejo (simular particiones de red, reordenamiento de eventos)
- Mantenimiento a largo plazo recae 100% en el equipo

**Veredicto:** La opción más laboriosa pero la que mejor se adapta al ERP existente, y la única que permite resolución de conflictos domain-specific.

## 1.3 Recomendación

### 🏆 Custom Event Sourcing — con estructura híbrida

**Justificación:**

1. **Ya tenemos el 60% construido.** El frontend ya tiene outbox pattern (`pendingOps`), IndexedDB con 11 stores, sync automático cada 5 minutos, y UI de monitoreo. No estamos empezando de cero.

2. **El dominio requiere resolución domain-specific.** Un ERP con stock compartido entre locales no puede resolverse con LWW genérico (PowerSync) ni con CRDTs genéricos. Necesitamos reglas como: "stock negativo genera alerta", "factura offline se marca provisoria", "precio del servidor siempre gana".

3. **Sin vendor lock-in.** Para un ERP que va a correr años en locales retail, depender de un SaaS externo (PowerSync) para la función más crítica (sync offline) es un riesgo inaceptable.

4. **Compatible con evolución futura.** Si ElectricSQL madura (v1.2+), se puede integrar como motor de sync reemplazando nuestra capa custom sin cambiar la lógica de negocio.

**Enfoque híbrido recomendado:**
- **Tabla `eventos_sync`** en PostgreSQL como log de eventos inmutable
- **Outbox mejorado** en IndexedDB (extender el `pendingOps` existente)
- **CRDTs específicos** solo donde se necesitan (contadores de stock)
- **Server-wins** para configuración y precios
- **Merge por campo** para documentos (OTs, clientes)
- **Append-only** para facturas (sin conflicto posible por diseño)

---

# SECCIÓN 2: Estrategia por tipo de dato

## 2.1 STOCK (Contadores)

### Estrategia: G-Counter CRDT + Reconciliación por delta

El stock no se sincroniza como un valor absoluto. Se sincroniza como **operaciones de delta** (venta de 3, ingreso de 10, ajuste de -2). El valor final se recalcula aplicando todos los deltas ordenados causalmente.

### ¿Por qué no Last-Write-Wins?

LWW destruye información. Si Local A tiene stock=5 y vende 3 (stock=2), y Local B tiene stock=5 y vende 3 (stock=2), LWW daría stock=2. El valor correcto es stock=**-1** (se vendieron 6 de 5 disponibles).

### Modelo

```
stock_actual = stock_base + Σ(deltas de todos los dispositivos)
```

Cada dispositivo mantiene su propio **vector de deltas**:

```json
{
  "variant_id": "campera-m-azul",
  "local_id": "local-a",
  "deltas": [
    { "op": "VENTA",   "cantidad": -3, "ts": "2026-04-12T10:00:00", "device": "caja-a1" },
    { "op": "INGRESO", "cantidad": 10, "ts": "2026-04-12T09:00:00", "device": "deposito" }
  ]
}
```

### Ejemplo concreto

**Estado inicial:** Campera M Azul, stock = 5 en ambos locales (total = 10)

| Tiempo | Local A (offline) | Local B (offline) | Servidor |
|--------|-------------------|-------------------|----------|
| 09:00 | stock_local=5 | stock_local=5 | stock_total=10 |
| 10:00 | Vende 3 → delta=-3 | — | — |
| 10:05 | — | Vende 3 → delta=-3 | — |
| 11:00 | Sync: envía delta=-3 | Sync: envía delta=-3 | Recibe ambos deltas |

**Reconciliación en servidor:**

```
stock_total = 10 + (-3 de A) + (-3 de B) = 4
stock_local_a = 5 + (-3) = 2
stock_local_b = 5 + (-3) = 2
```

Si el stock es **centralizado** (un solo pool para ambos locales):

```
stock_central = 10 + (-3) + (-3) = 4   ← correcto, se vendieron 6 de 10
```

Si el stock es **por local** (cada local tiene su propio stock):

```
stock_local_a = 5 + (-3) = 2   ← correcto
stock_local_b = 5 + (-3) = 2   ← correcto
```

**No hay conflicto en este caso** porque cada local opera sobre su propio stock. El conflicto ocurre cuando ambos venden del mismo pool → ver Sección 3.

### Pseudocódigo de reconciliación

```python
def reconciliar_stock(variant_id: str, deltas: list[StockDelta]) -> int:
    # Obtener stock base (último snapshot confirmado)
    stock_base = db.query(StockSnapshot)
        .filter_by(variant_id=variant_id)
        .order_by(desc(timestamp))
        .first().cantidad

    # Aplicar todos los deltas ordenados por timestamp
    deltas_ordenados = sorted(deltas, key=lambda d: d.timestamp_local)
    
    for delta in deltas_ordenados:
        stock_base += delta.cantidad
    
    # Si stock queda negativo, generar alerta
    if stock_base < 0:
        crear_alerta_stock_negativo(variant_id, stock_base, deltas)
    
    return stock_base
```

## 2.2 FACTURAS (Append-only)

### Estrategia: Append-only + numeración provisional offline

Las facturas **nunca se modifican**, solo se anulan creando una nota de crédito. Esto elimina conflictos de edición por diseño.

### Problema de numeración correlativa

AFIP (ente fiscal argentino) requiere numeración correlativa sin gaps. Si dos locales están offline y ambos emiten facturas, ¿cómo se evita duplicar números?

### Solución: Numeración en dos fases

**Fase 1 — Offline:** Se asigna un número provisorio con prefijo del dispositivo:

```
OFF-{device_id}-{secuencia_local}
Ejemplo: OFF-CAJA-A1-00042
```

La factura se emite con este número provisorio. El recibo impreso lo indica claramente:

```
══════════════════════════════
  COMPROBANTE PROVISORIO
  Nro: OFF-CAJA-A1-00042
  Pendiente de fiscalización
══════════════════════════════
```

**Fase 2 — Al sincronizar:** El servidor asigna el número definitivo AFIP en orden de llegada:

```python
def asignar_numero_fiscal(factura_offline: Sale) -> str:
    with db.begin():  # transacción serializable
        ultimo = db.query(func.max(Sale.numero_fiscal))
            .filter_by(
                company_id=factura_offline.company_id,
                punto_venta=factura_offline.punto_venta,
                tipo_comprobante=factura_offline.tipo_comprobante
            ).scalar() or 0
        
        nuevo_numero = ultimo + 1
        factura_offline.numero_fiscal = nuevo_numero
        factura_offline.numero_provisorio = factura_offline.numero_original
        factura_offline.estado = "PENDIENTE_AFIP"
        
        return f"{factura_offline.punto_venta:05d}-{nuevo_numero:08d}"
```

**Fase 3 — Fiscalización AFIP:**

```python
def fiscalizar_factura(factura: Sale) -> AFIPResponse:
    response = afip_client.autorizar(factura)
    
    if response.ok:
        factura.cae = response.cae
        factura.vencimiento_cae = response.vencimiento
        factura.estado = "EMITIDA"
    else:
        factura.estado = "RECHAZADA_AFIP"
        crear_alerta(
            tipo="FACTURA_RECHAZADA",
            detalle=response.errores,
            factura_id=factura.id
        )
    
    return response
```

### Garantías

- **Sin gaps:** El número fiscal se asigna secuencialmente en el servidor con lock transaccional
- **Sin duplicados:** El `numero_provisorio` es único por dispositivo (UUID del device + secuencia monotónica)
- **Auditable:** Se preserva el mapeo `numero_provisorio → numero_fiscal`
- **Cliente informado:** Si la factura offline es rechazada por AFIP al sincronizar, el cajero recibe una notificación (ver Sección 5.2)

## 2.3 ÓRDENES DE TRABAJO (Documentos largos)

### Estrategia: Merge por campo con timestamp + resolución manual de colisiones

Las OTs son documentos con múltiples campos que pueden ser editados por diferentes personas (mecánico en taller, recepción en mostrador, administración).

### Modelo de merge

Cada campo se trata como una unidad independiente de sincronización. Cuando dos dispositivos modifican el mismo campo del mismo registro offline, se aplica **LWW por campo** (gana el timestamp más reciente), excepto para campos críticos donde se genera alerta manual.

```json
{
  "ot_id": "OT-2026-0042",
  "campos_modificados": {
    "diagnostico": {
      "valor": "Cambio de suela completo",
      "modificado_por": "mecanico-juan",
      "timestamp": "2026-04-12T10:30:00",
      "device": "tablet-taller-1"
    },
    "estado": {
      "valor": "EN_PROGRESO",
      "modificado_por": "recepcion-maria",
      "timestamp": "2026-04-12T10:25:00",
      "device": "pc-recepcion"
    }
  }
}
```

### Reglas de merge

```python
CAMPOS_LWW = [
    "diagnostico", "observaciones", "notas_internas",
    "fecha_estimada", "prioridad"
]

CAMPOS_CONFLICTO_MANUAL = [
    "estado",          # No se puede resolver automáticamente
    "monto_total",     # Requiere revisión humana
    "items_trabajo"    # Lista de trabajos realizados
]

CAMPOS_SERVER_WINS = [
    "precio_hora",     # Viene de configuración
    "descuento_maximo" # Política comercial
]

def merge_ot(ot_server: dict, ot_local: dict, campos_mod: dict) -> MergeResult:
    resultado = MergeResult()
    
    for campo, cambio_local in campos_mod.items():
        valor_server = ot_server.get(campo)
        
        if campo in CAMPOS_SERVER_WINS:
            resultado.usar_valor(campo, valor_server)
            
        elif campo in CAMPOS_LWW:
            # Si el servidor también lo modificó, gana el más reciente
            ts_server = ot_server.get(f"{campo}_updated_at")
            if cambio_local["timestamp"] > ts_server:
                resultado.usar_valor(campo, cambio_local["valor"])
            else:
                resultado.usar_valor(campo, valor_server)
                
        elif campo in CAMPOS_CONFLICTO_MANUAL:
            resultado.marcar_conflicto(campo, 
                valor_local=cambio_local["valor"],
                valor_server=valor_server
            )
    
    return resultado
```

### Flujo de resolución de conflicto manual

1. El sistema detecta colisión en campo crítico (ej: estado)
2. Se genera una notificación al usuario con rol ADMIN o GESTION
3. La UI muestra un modal de resolución:

```
┌─────────────────────────────────────────────┐
│  ⚠️ CONFLICTO EN OT-2026-0042              │
│                                             │
│  Campo: ESTADO                              │
│                                             │
│  Versión del taller (Juan, 10:30):          │
│  ► "FINALIZADO"                             │
│                                             │
│  Versión de recepción (María, 10:25):       │
│  ► "EN_PROGRESO"                            │
│                                             │
│  [ Usar Taller ]  [ Usar Recepción ]        │
│                                             │
│  La versión no elegida se guarda en         │
│  el historial de auditoría.                 │
└─────────────────────────────────────────────┘
```

## 2.4 CONFIGURACIÓN Y PRECIOS

### Estrategia: Server-wins absoluto + propagación push

La configuración y los precios los define la administración central. Los dispositivos **nunca** modifican estos datos; solo los consumen.

### Flujo de propagación

```
Administración actualiza precio
        │
        ▼
PostgreSQL (tabla products, campo precio_venta)
        │
        ├──► SSE /menu_config_events → dispositivos online
        │    (notificación inmediata)
        │
        └──► Sync periódico cada 5 min → dispositivos que estaban offline
             (pull desde syncAllCatalogs())
```

### Implementación actual (ya funciona)

El ERP ya tiene SSE vía `/api/v1/menu_config/events` para notificaciones en tiempo real. Los catálogos se sincronizan cada 5 minutos al IndexedDB (`catalogProducts`, `catalogStock`).

### Mejora propuesta: Versionamiento de catálogo

```python
# Agregar version incremental al catálogo
class CatalogVersion(Base):
    __tablename__ = "catalog_versions"
    
    id = Column(Integer, primary_key=True)
    tabla = Column(String)          # "products", "prices", "config"
    version = Column(BigInteger)    # Incremental
    updated_at = Column(DateTime)
    changed_by = Column(UUID, ForeignKey("users.id"))

# El cliente solo pide cambios desde su última versión conocida
# GET /api/v1/products?since_version=42
# Retorna solo productos modificados desde versión 42
```

Esto reduce drásticamente el volumen de sync: en lugar de descargar todo el catálogo, solo se bajan los cambios.

### Garantías

- **El servidor siempre gana:** Los dispositivos nunca envían cambios de precio o configuración
- **Propagación rápida:** SSE para online, pull para los que estaban offline
- **Sin conflictos posibles:** Flujo unidireccional servidor → clientes
- **Caché local:** Si un dispositivo está offline 7 días, al reconectar se descarga el catálogo actualizado completo (fallback a full sync si delta es muy grande)

## 2.5 CLIENTES

### Estrategia: Merge por campo + detección de duplicados + alerta manual

Los clientes son editados infrecuentemente pero desde múltiples locales. El riesgo principal es: dos locales editan el mismo cliente offline (ej: actualizan teléfono con valores distintos).

### Reglas de merge

```python
# Campos que se pueden auto-mergear (LWW)
CLIENTE_LWW = [
    "telefono", "email", "direccion", 
    "codigo_postal", "notas"
]

# Campos que requieren revisión manual si difieren
CLIENTE_CONFLICTO = [
    "razon_social",    # Nombre legal, no puede tener ambigüedad
    "cuit",            # Documento fiscal único
    "condicion_iva",   # Afecta facturación
    "limite_credito"   # Política comercial
]

# Campos server-wins
CLIENTE_SERVER = [
    "bloqueado",        # Decisión administrativa
    "deuda_acumulada",  # Calculado por el servidor
    "categoria"         # Clasificación comercial
]
```

### Detección de duplicados

Al sincronizar un cliente nuevo creado offline, el servidor busca duplicados por CUIT/DNI:

```python
def sync_cliente_nuevo(cliente_offline: dict) -> SyncResult:
    existente = db.query(Cliente).filter(
        or_(
            Cliente.cuit == cliente_offline["cuit"],
            Cliente.dni == cliente_offline["dni"],
            func.similarity(Cliente.razon_social, 
                          cliente_offline["razon_social"]) > 0.8
        )
    ).first()
    
    if existente:
        return SyncResult(
            status="DUPLICADO_POSIBLE",
            cliente_existente=existente,
            cliente_nuevo=cliente_offline,
            accion_requerida="MERGE_MANUAL"
        )
    
    return SyncResult(status="CREADO", cliente=crear_cliente(cliente_offline))
```

---

# SECCIÓN 3: El caso más difícil

## Escenario: Sobreventa offline de última unidad

### Datos iniciales

```
Producto:     Campera M Azul (variant_id: "camp-m-azul")
Stock total:  1 unidad (pool centralizado, no por local)
Local A:      Caja A1, dispositivo "caja-a1"
Local B:      Caja B1, dispositivo "caja-b1"
Ambos:        SIN INTERNET desde las 09:50
```

### Timeline paso a paso

#### 10:00 — Local A vende 1 unidad

```
Estado IndexedDB (caja-a1):
  catalogStock["camp-m-azul"] = { cantidad: 1 → 0 }
  
  pendingOps += {
    localId: "offline-1712959200-a1x9k",
    type: "SALE",
    method: "POST",
    endpoint: "/api/v1/sales/",
    payload: {
      items: [{ variant_id: "camp-m-azul", cantidad: 1, precio: 45000 }],
      cliente_id: "cli-123",
      tipo: "TICKET",
      local_id: "local-a"
    },
    status: "PENDING",
    createdAt: 1712959200000
  }
  
  offlineSales += {
    localId: "offline-sale-a1-001",
    items: [...],
    total: 45000,
    status: "PENDING"
  }

Cajero de Local A:
  ► Imprime recibo provisorio OFF-CAJA-A1-00042
  ► Stock en pantalla: Campera M Azul = 0
  ► Todo normal para el cajero
```

#### 10:05 — Local B vende 1 unidad

```
Estado IndexedDB (caja-b1):
  catalogStock["camp-m-azul"] = { cantidad: 1 → 0 }
  ⚠️ Caja B1 todavía ve stock=1 porque no sincronizó desde las 09:50
  
  pendingOps += {
    localId: "offline-1712959500-b1y3m",
    type: "SALE",
    method: "POST",
    endpoint: "/api/v1/sales/",
    payload: {
      items: [{ variant_id: "camp-m-azul", cantidad: 1, precio: 45000 }],
      cliente_id: "cli-456",
      tipo: "TICKET",
      local_id: "local-b"
    },
    status: "PENDING",
    createdAt: 1712959500000
  }

Cajero de Local B:
  ► Imprime recibo provisorio OFF-CAJA-B1-00078
  ► Stock en pantalla: Campera M Azul = 0
  ► Todo normal para el cajero (no sabe que A ya vendió)
```

#### 11:00 — Vuelve internet. Ambos locales sincronizan.

El `flushPendingOps()` se dispara automáticamente 2 segundos después de detectar `online`.

**Paso 1: Local A sincroniza primero** (llegó al servidor 200ms antes)

```python
# Servidor recibe POST /api/v1/sales/ de Local A
def crear_venta_desde_sync(payload, device_id):
    with db.begin():
        variant = db.query(ProductVariant).get("camp-m-azul")
        
        # Verificar stock
        stock_actual = variant.stock  # = 1 (aún no se actualizó)
        cantidad_vendida = payload.items[0].cantidad  # = 1
        
        if stock_actual >= cantidad_vendida:
            # ✅ Hay stock suficiente
            variant.stock -= cantidad_vendida  # 1 - 1 = 0
            venta = Sale(...)
            venta.numero_provisorio = "OFF-CAJA-A1-00042"
            venta.numero_fiscal = asignar_numero_fiscal(venta)
            db.add(venta)
            
            registrar_evento_sync(
                dispositivo="caja-a1",
                tabla="sales",
                operacion="INSERT",
                conflicto=False
            )
            
            return {"status": "ok", "venta_id": venta.id}
```

**Resultado:** Venta A procesada ✅. Stock en servidor = 0.

**Paso 2: Local B sincroniza** (llega 500ms después de A)

```python
# Servidor recibe POST /api/v1/sales/ de Local B
def crear_venta_desde_sync(payload, device_id):
    with db.begin():
        variant = db.query(ProductVariant).get("camp-m-azul")
        
        stock_actual = variant.stock  # = 0 (A ya lo consumió)
        cantidad_vendida = payload.items[0].cantidad  # = 1
        
        if stock_actual >= cantidad_vendida:
            # No entra aquí
            pass
        else:
            # ⚠️ STOCK INSUFICIENTE — SOBREVENTA DETECTADA
            
            # Opción 1: Permitir stock negativo + alerta
            variant.stock -= cantidad_vendida  # 0 - 1 = -1
            venta = Sale(...)
            venta.numero_provisorio = "OFF-CAJA-B1-00078"
            venta.numero_fiscal = asignar_numero_fiscal(venta)
            venta.requiere_revision = True
            venta.motivo_revision = "SOBREVENTA_OFFLINE"
            db.add(venta)
            
            # Crear alerta para administración
            alerta = Notification(
                tipo="STOCK_NEGATIVO",
                titulo="Sobreventa detectada: Campera M Azul",
                mensaje=(
                    f"Stock quedó en -1. "
                    f"Local A vendió 1 ud (10:00, offline). "
                    f"Local B vendió 1 ud (10:05, offline). "
                    f"Había 1 unidad disponible."
                ),
                severity="HIGH",
                requiere_accion=True,
                datos={
                    "variant_id": "camp-m-azul",
                    "stock_resultante": -1,
                    "ventas_involucradas": [venta_a.id, venta_b.id]
                }
            )
            db.add(alerta)
            
            registrar_evento_sync(
                dispositivo="caja-b1",
                tabla="sales",
                operacion="INSERT",
                conflicto=True,
                detalle_conflicto="SOBREVENTA: stock -1"
            )
            
            return {
                "status": "ok_con_alerta",
                "venta_id": venta.id,
                "alerta": "SOBREVENTA_OFFLINE",
                "stock_resultante": -1
            }
```

**Paso 3: Respuesta al cajero de Local B**

```
┌─────────────────────────────────────────────┐
│  ⚠️ ALERTA DE SINCRONIZACIÓN               │
│                                             │
│  La venta OFF-CAJA-B1-00078 se procesó     │
│  correctamente, pero se detectó una         │
│  sobreventa:                                │
│                                             │
│  Campera M Azul: stock = -1                 │
│                                             │
│  Otro local vendió la última unidad         │
│  mientras estábamos sin internet.           │
│                                             │
│  La venta fue registrada. Administración    │
│  fue notificada para resolver.              │
│                                             │
│  [ Entendido ]                              │
└─────────────────────────────────────────────┘
```

### Estado final

| Dato | Valor |
|------|-------|
| Stock Campera M Azul | **-1** (indica sobreventa, requiere reposición) |
| Venta Local A | ✅ Confirmada, número fiscal asignado |
| Venta Local B | ✅ Confirmada, número fiscal asignado, flag `requiere_revision=true` |
| Factura A (OFF-CAJA-A1-00042) | Válida, número fiscal definitivo asignado |
| Factura B (OFF-CAJA-B1-00078) | Válida, número fiscal definitivo asignado, marcada para revisión |
| Alerta administración | ✅ Generada — "STOCK_NEGATIVO" con severity HIGH |

### ¿Por qué NO anulamos la venta de B?

**Decisión de diseño crítica:** La venta de Local B **ya ocurrió en el mundo real**. El cliente ya se llevó la campera. Anular automáticamente la factura sería:
1. Fiscalmente incorrecto (la transacción existió)
2. Operativamente imposible (el cliente ya se fue)
3. Contablemente problemático (el dinero ya se cobró)

La estrategia correcta es **aceptar la sobreventa, alertar, y resolver con reposición de stock**.

### Resolución administrativa

El administrador, al ver la alerta, puede:
1. **Transferir stock** de otro local o depósito → stock vuelve a 0
2. **Crear orden de reposición** al proveedor → stock se normaliza cuando llega
3. **Registrar ajuste de inventario** si hay stock físico no registrado

---

# SECCIÓN 4: Esquema de evento de sync

## 4.1 Esquema propuesto vs. esquema original

### Esquema original (del otro agente)

```sql
eventos_sync (
  id UUID,
  dispositivo_id,
  empresa_id,
  tabla_afectada,
  operacion,
  payload_antes JSON,
  payload_despues JSON,
  timestamp_local,
  timestamp_servidor,
  sincronizado BOOLEAN,
  conflicto BOOLEAN
)
```

### Esquema mejorado propuesto

```sql
CREATE TABLE eventos_sync (
    -- ═══ IDENTIDAD ═══
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key   VARCHAR(128) UNIQUE NOT NULL,
    
    -- ═══ ORIGEN ═══
    dispositivo_id    VARCHAR(64) NOT NULL,
    empresa_id        UUID NOT NULL REFERENCES companies(id),
    usuario_id        UUID REFERENCES users(id),
    
    -- ═══ OPERACIÓN ═══
    tabla_afectada    VARCHAR(64) NOT NULL,
    registro_id       UUID,
    operacion         VARCHAR(16) NOT NULL,  -- INSERT, UPDATE, DELETE, MERGE
    
    -- ═══ PAYLOAD ═══
    payload_antes     JSONB,
    payload_despues   JSONB NOT NULL,
    campos_modificados VARCHAR(255)[],
    
    -- ═══ TEMPORALIDAD ═══
    timestamp_local   TIMESTAMPTZ NOT NULL,
    timestamp_servidor TIMESTAMPTZ DEFAULT NOW(),
    version_catalogo  BIGINT,
    
    -- ═══ ESTADO DE SYNC ═══
    sincronizado      BOOLEAN DEFAULT FALSE,
    conflicto         BOOLEAN DEFAULT FALSE,
    conflicto_tipo    VARCHAR(32),
    conflicto_resuelto BOOLEAN DEFAULT FALSE,
    resuelto_por      UUID REFERENCES users(id),
    resuelto_at       TIMESTAMPTZ,
    
    -- ═══ METADATA ═══
    lote_sync_id      UUID,
    numero_secuencia  BIGINT,
    checksum          VARCHAR(64),
    
    -- ═══ INDICES ═══
    CONSTRAINT chk_operacion CHECK (operacion IN ('INSERT','UPDATE','DELETE','MERGE')),
    CONSTRAINT chk_conflicto_tipo CHECK (
        conflicto_tipo IS NULL OR 
        conflicto_tipo IN ('SOBREVENTA','CAMPO_DIVERGENTE','DUPLICADO','VERSION_OBSOLETA')
    )
);

-- Índices para queries frecuentes
CREATE INDEX idx_eventos_sync_empresa ON eventos_sync(empresa_id);
CREATE INDEX idx_eventos_sync_dispositivo ON eventos_sync(dispositivo_id, timestamp_local);
CREATE INDEX idx_eventos_sync_tabla ON eventos_sync(tabla_afectada, registro_id);
CREATE INDEX idx_eventos_sync_pendientes ON eventos_sync(sincronizado) WHERE NOT sincronizado;
CREATE INDEX idx_eventos_sync_conflictos ON eventos_sync(conflicto) WHERE conflicto AND NOT conflicto_resuelto;
CREATE INDEX idx_eventos_sync_lote ON eventos_sync(lote_sync_id);
```

## 4.2 Justificación de cambios

### Campos agregados

| Campo | Justificación |
|-------|---------------|
| `idempotency_key` | **Crítico.** Evita que un evento se procese dos veces si la red falla mid-sync. El cliente genera `{device_id}-{timestamp}-{random}` y el servidor rechaza duplicados con el UNIQUE constraint. Sin esto, una venta podría registrarse doble. |
| `usuario_id` | Necesario para auditoría. ¿Quién hizo esta operación? El `dispositivo_id` no es suficiente porque múltiples usuarios pueden usar el mismo dispositivo. |
| `registro_id` | UUID del registro afectado (ej: el ID de la venta, del producto). Sin esto, para encontrar todos los eventos de un registro hay que buscar dentro del JSON — ineficiente. |
| `campos_modificados` | Array de nombres de campo que cambiaron. Permite merge por campo sin parsear el JSON completo. Ejemplo: `["telefono", "email"]` |
| `conflicto_tipo` | Un boolean `conflicto` no alcanza. Necesitamos saber **qué tipo** de conflicto para aplicar la estrategia correcta (SOBREVENTA ≠ DUPLICADO ≠ VERSION_OBSOLETA). |
| `conflicto_resuelto` / `resuelto_por` / `resuelto_at` | Auditoría de resolución de conflictos. ¿Quién lo resolvió? ¿Cuándo? |
| `lote_sync_id` | Agrupa eventos que se sincronizaron juntos (un flush de pendingOps puede tener 15 operaciones). Permite rollback de lote completo si falla uno crítico. |
| `numero_secuencia` | Orden causal de los eventos dentro del dispositivo. El timestamp puede ser unreliable (relojes desincronizados), pero la secuencia es monotónica. |
| `version_catalogo` | ¿Contra qué versión del catálogo se generó este evento? Si el evento se generó con precios de versión 42 pero el servidor ya está en versión 50, hay que decidir si se acepta o se rechaza. |
| `checksum` | Hash SHA-256 del payload para verificar integridad. Detecta corrupción de datos en tránsito. |

### Campos sin cambios

| Campo | Razón de mantenerlo |
|-------|-------------------|
| `id` | Identificador único del evento, correcto como UUID |
| `dispositivo_id` | Identifica el origen, necesario |
| `empresa_id` | Multi-tenant, obligatorio |
| `tabla_afectada` | Necesario para routing de merge |
| `operacion` | Tipo de operación, necesario |
| `payload_antes` / `payload_despues` | Snapshot completo para auditoría y rollback |
| `timestamp_local` / `timestamp_servidor` | Ambos necesarios: el local para ordenar causalmente, el servidor para el log canónico |
| `sincronizado` | Flag de estado, necesario |
| `conflicto` | Boolean rápido para queries de "¿hay conflictos pendientes?" |

### Campos que podrían eliminarse

Ninguno. Todos los campos del esquema original son necesarios.

### Tipo de dato cambiado

| Campo | Original | Propuesto | Razón |
|-------|----------|-----------|-------|
| `payload_antes` / `payload_despues` | `JSON` | `JSONB` | JSONB permite indexar y hacer queries dentro del JSON (operador `@>`, `->>`). JSON es solo text con validación. Para un ERP necesitamos poder buscar dentro de los payloads. |

## 4.3 Esquema IndexedDB correspondiente (cliente)

```javascript
// En offlineDB.js — nueva versión del store pendingOps
const SYNC_EVENT_SCHEMA = {
  localId: "auto-increment",     // PK local
  idempotencyKey: "string",      // {device}-{ts}-{rand} — UNIQUE
  dispositivoId: "string",
  empresaId: "string",
  usuarioId: "string",
  tablaAfectada: "string",
  registroId: "string|null",
  operacion: "string",           // INSERT, UPDATE, DELETE
  payloadAntes: "object|null",
  payloadDespues: "object",
  camposModificados: "string[]",
  timestampLocal: "number",      // Date.now()
  versionCatalogo: "number|null",
  sincronizado: "boolean",       // false hasta sync exitoso
  conflicto: "boolean",
  conflictoTipo: "string|null",
  intentos: "number",            // retry count
  ultimoError: "string|null",
  checksum: "string"
};
```

---

# SECCIÓN 5: Casos borde completos

## 5.1 Stock negativo al sincronizar

### Escenario

Múltiples locales venden del mismo pool de stock offline. Al sincronizar, la suma de ventas excede el stock disponible.

### Flujo

```
DETECCIÓN:
  ► Al procesar POST /sales/ desde sync offline
  ► Query: SELECT stock FROM product_variants WHERE id = ?
  ► Si stock - cantidad_vendida < 0 → SOBREVENTA

SISTEMA HACE:
  1. Procesa la venta igualmente (ya ocurrió físicamente)
  2. Permite stock negativo en la base de datos
  3. Marca la venta con requiere_revision = true
  4. Registra evento_sync con conflicto = true, 
     conflicto_tipo = 'SOBREVENTA'
  5. Crea Notification con severity = 'HIGH'
  6. Envía SSE a todos los dispositivos online: 
     "stock actualizado para variant X"

USUARIO VE (cajero que sincroniza):
  ► Banner: "Venta sincronizada con alerta: stock insuficiente 
     en servidor. Administración fue notificada."
  ► La venta aparece con ícono ⚠️ en el listado

USUARIO VE (administrador):
  ► Notificación push: "SOBREVENTA: Campera M Azul, stock = -2"
  ► Dashboard muestra contador de alertas pendientes
  ► Puede resolver: transferir stock, crear pedido proveedor, 
     o registrar ajuste

RESOLUCIÓN:
  ► Admin resuelve → conflicto_resuelto = true
  ► Se registra quién resolvió y cuándo
  ► Stock se normaliza (≥ 0) después de la acción correctiva
```

## 5.2 Factura offline rechazada por AFIP al sincronizar

### Escenario

Se emitió un ticket/factura offline con datos incorrectos (ej: CUIT inválido del cliente, monto excede límite para ticket). Al sincronizar, el servidor intenta fiscalizar con AFIP y falla.

### Flujo

```
DETECCIÓN:
  ► Al asignar número fiscal y llamar a AFIP WebService
  ► AFIP retorna error (ej: "CUIT inexistente", 
     "Monto excede límite para Factura C")

SISTEMA HACE:
  1. NO anula la venta (la transacción comercial existió)
  2. Marca la factura: estado = 'RECHAZADA_AFIP'
  3. Guarda el detalle del error AFIP en la factura
  4. Crea Notification para el local de origen + admin
  5. Registra evento_sync con conflicto_tipo = 'RECHAZO_FISCAL'
  6. Mantiene el número provisorio visible

USUARIO VE (cajero del local):
  ► Notificación: "Factura OFF-CAJA-B1-00078 rechazada por AFIP"
  ► Detalle del error: "CUIT 20-12345678-9 no existe en padrón"
  ► Opciones:
     - Corregir datos del cliente y reenviar
     - Anular y re-emitir con datos correctos
     - Escalar a administración

USUARIO VE (administrador):
  ► Lista de facturas rechazadas en panel de alertas
  ► Para cada una: motivo AFIP, datos originales, opciones de acción

RESOLUCIÓN:
  ► Opción A: Corregir datos → reenviar a AFIP → obtener CAE
  ► Opción B: Emitir nota de crédito provisoria + nueva factura correcta
  ► En ambos casos: se actualiza el evento_sync como resuelto
```

## 5.3 Dispositivo offline 7 días, precios cambiaron

### Escenario

Una tablet de vendedor estuvo sin internet 7 días. Durante ese tiempo, se actualizaron precios de 200 productos. El vendedor hizo 15 ventas offline con precios viejos.

### Flujo

```
DETECCIÓN:
  ► Al sincronizar, el servidor compara version_catalogo del 
     evento con la versión actual
  ► Evento dice version_catalogo = 42
  ► Servidor está en version_catalogo = 58
  ► Delta = 16 versiones → flag PRECIO_DESACTUALIZADO

SISTEMA HACE:
  1. Para cada venta offline:
     a. Compara precio usado vs precio actual
     b. Si precio_usado < precio_actual: 
        pérdida = diferencia × cantidad
     c. Si precio_usado > precio_actual: 
        posible sobrecobro al cliente
  2. Procesa las ventas con los precios originales 
     (el precio al momento de la venta es el válido legalmente)
  3. Genera reporte de diferencias de precio
  4. Envía catálogo actualizado completo al dispositivo 
     (full sync, no incremental, porque el delta es muy grande)
  5. Registra evento_sync con conflicto_tipo = 'VERSION_OBSOLETA'

USUARIO VE (vendedor):
  ► "Se sincronizaron 15 ventas. Tu catálogo estaba 
     desactualizado (7 días). Se descargaron 200 precios nuevos."
  ► Lista de ventas con diferencia de precio marcada
  ► NO se anulan las ventas (fueron válidas al momento)

USUARIO VE (administrador):
  ► Reporte: "15 ventas con precios desactualizados"
  ► Impacto económico: "+$45.000 / -$12.000"
  ► Puede decidir si ajustar o aceptar

PREVENCIÓN:
  ► El dispositivo muestra warning permanente después 
     de 24h sin sync:
     "⚠️ Catálogo desactualizado. Los precios pueden no 
      ser los vigentes. Conectá a internet para actualizar."
  ► Después de 72h sin sync:
     "🔴 PRECIOS NO CONFIABLES. Última actualización: 
      hace 3 días. Verificá precios por teléfono antes 
      de cerrar ventas grandes."
```

## 5.4 OT editada por mecánico y recepción simultáneamente

### Escenario

OT-2026-0042 editada offline por:
- Mecánico Juan (tablet taller): agrega diagnóstico y cambia estado a "FINALIZADO"
- Recepcionista María (PC recepción): agrega nota del cliente y cambia estado a "ESPERANDO_REPUESTO"

### Flujo

```
DETECCIÓN:
  ► Al sincronizar, el servidor detecta 2 eventos UPDATE 
     para el mismo registro_id con campos superpuestos
  ► Aplica reglas de merge por campo (ver Sección 2.3)

SISTEMA HACE:

  Campos sin conflicto (distintos campos):
    diagnostico → usa valor de Juan (único que lo modificó)
    notas_cliente → usa valor de María (única que lo modificó)
    → Auto-merge exitoso ✅

  Campo con conflicto (mismo campo, valores distintos):
    estado: Juan="FINALIZADO" vs María="ESPERANDO_REPUESTO"
    → CONFLICTO MANUAL ⚠️

  1. Aplica auto-merge de campos sin conflicto
  2. Para el campo "estado": guarda ambas versiones, 
     no aplica ninguna
  3. Estado actual del registro queda como estaba antes 
     de los cambios offline (EN_PROGRESO)
  4. Crea notificación para ADMIN/GESTION con UI de resolución
  5. Registra evento_sync con conflicto_tipo = 'CAMPO_DIVERGENTE'

USUARIO VE (mecánico Juan):
  ► "Tu diagnóstico fue guardado. Hay un conflicto en 
     el campo ESTADO que requiere resolución."
  ► La OT muestra ícono ⚠️ al lado de "estado"

USUARIO VE (recepcionista María):
  ► "Tu nota del cliente fue guardada. Hay un conflicto 
     en el campo ESTADO que requiere resolución."

USUARIO VE (administrador):
  ► Modal de resolución (ver mockup en Sección 2.3)
  ► Elige "ESPERANDO_REPUESTO" (Juan se equivocó, falta un repuesto)
  ► Se registra: resuelto_por = admin, resuelto_at = now()

RESULTADO FINAL:
  diagnostico:   "Cambio de suela completo" (de Juan) ✅
  notas_cliente: "Cliente pide urgencia" (de María) ✅  
  estado:        "ESPERANDO_REPUESTO" (resuelto por admin) ✅
```

## 5.5 Cliente bloqueado por deuda, venta offline ya hecha

### Escenario

- Administración bloquea al cliente "Comercial Sur SRL" por deuda de $500.000 (jueves 15:00)
- Local A está offline desde las 14:00
- Cajero de Local A hace venta a crédito a "Comercial Sur SRL" por $120.000 a las 16:00
- Local A reconecta a las 17:00

### Flujo

```
DETECCIÓN:
  ► Al sincronizar la venta, el servidor detecta:
     1. Cliente.bloqueado = true (desde 15:00)
     2. Venta.timestamp_local = 16:00 (posterior al bloqueo)
     3. Tipo de venta: CUENTA_CORRIENTE (a crédito)

SISTEMA HACE:
  1. Procesa la venta (ya ocurrió físicamente)
  2. Marca la venta con:
     - requiere_revision = true
     - motivo_revision = "CLIENTE_BLOQUEADO"
  3. NO bloquea automáticamente la factura 
     (la transacción comercial existió)
  4. Crea alerta de severity CRITICAL para admin:
     "Venta a crédito $120.000 a cliente bloqueado 
      Comercial Sur SRL (deuda: $500.000)"
  5. Actualiza IndexedDB del dispositivo:
     cliente.bloqueado = true
     (futuras ventas offline serán rechazadas localmente)

USUARIO VE (cajero de Local A):
  ► Alerta inmediata post-sync:
     "⚠️ ATENCIÓN: Comercial Sur SRL está bloqueado 
      por deuda desde las 15:00. La venta de $120.000 
      fue registrada pero requiere aprobación de 
      administración."
  ► A partir de ahora, al intentar vender a ese cliente:
     "🚫 Cliente bloqueado. No se permiten ventas 
      a cuenta corriente."

USUARIO VE (administrador):
  ► Notificación CRITICAL con opciones:
     [ Aprobar venta ] → se confirma, deuda sube a $620.000
     [ Convertir a contado ] → se requiere cobro inmediato
     [ Anular venta ] → nota de crédito + devolver mercadería

PREVENCIÓN FUTURA:
  ► Los estados de bloqueo de clientes se propagan 
     con prioridad máxima en cada sync (incluso parcial)
  ► El outbox del servidor mantiene una cola de 
     "bloqueos pendientes de propagar" que se envía 
     ANTES de aceptar nuevas operaciones del dispositivo
```

### Orden de sync mejorado para este caso

```python
async def sync_dispositivo(device_id: str, payload: SyncPayload):
    # PASO 1: Enviar actualizaciones críticas ANTES de procesar
    bloqueos_pendientes = get_bloqueos_no_propagados(device_id)
    precios_criticos = get_cambios_criticos_no_propagados(device_id)
    
    # El dispositivo debe procesar estos antes de seguir vendiendo
    yield SyncResponse(
        fase="ACTUALIZACIONES_CRITICAS",
        bloqueos=bloqueos_pendientes,
        precios=precios_criticos
    )
    
    # PASO 2: Procesar operaciones del dispositivo
    for op in payload.operaciones:
        resultado = procesar_operacion(op)
        yield SyncResponse(fase="OPERACION", resultado=resultado)
    
    # PASO 3: Enviar catálogo actualizado
    cambios = get_cambios_catalogo(device_id, payload.version_catalogo)
    yield SyncResponse(fase="CATALOGO", cambios=cambios)
```

---

# Apéndice A: Diagrama de flujo de sincronización completo

```
┌──────────────┐                              ┌──────────────┐
│  DISPOSITIVO │                              │   SERVIDOR   │
│  (IndexedDB) │                              │ (PostgreSQL) │
└──────┬───────┘                              └──────┬───────┘
       │                                              │
       │  ══ OPERACIÓN OFFLINE ══                     │
       │                                              │
       ├─ Usuario realiza acción                      │
       ├─ Validación local (stock, precios cache)     │
       ├─ Guardar en pendingOps                       │
       ├─ Generar idempotency_key                     │
       ├─ Calcular checksum                           │
       ├─ Actualizar UI local                         │
       │                                              │
       │  ══ INTERNET VUELVE ══                       │
       │                                              │
       ├─ online event (2s delay) ──────────────────► │
       │                                              │
       │  ══ FASE 1: RECIBIR CRÍTICOS ══              │
       │                                              │
       │ ◄──────────────── bloqueos + precios críticos│
       ├─ Aplicar bloqueos a IndexedDB                │
       ├─ Actualizar precios críticos                 │
       │                                              │
       │  ══ FASE 2: ENVIAR PENDIENTES ══             │
       │                                              │
       ├─ POST /sync/batch ─────────────────────────► │
       │  { lote_sync_id, eventos[] }                 ├─ Verificar idempotency
       │                                              ├─ Validar checksum
       │                                              ├─ Por cada evento:
       │                                              │  ├─ ¿Conflicto?
       │                                              │  │  SI → resolver/alertar
       │                                              │  │  NO → aplicar
       │                                              │  └─ Registrar en 
       │                                              │     eventos_sync
       │ ◄──────────────── resultados por evento      │
       ├─ Marcar sincronizado=true                    │
       ├─ Mostrar alertas si conflictos               │
       │                                              │
       │  ══ FASE 3: RECIBIR CATÁLOGO ══              │
       │                                              │
       │ ◄──────────────── cambios desde versión N    │
       ├─ Actualizar IndexedDB catalogs               │
       ├─ Actualizar version_catalogo local           │
       │                                              │
       │  ══ FIN ══                                   │
       ▼                                              ▼
```

# Apéndice B: Checklist de implementación

| # | Componente | Prioridad | Dependencia |
|---|-----------|-----------|-------------|
| 1 | Tabla `eventos_sync` + migración Alembic | P0 | — |
| 2 | Endpoint `POST /api/v1/sync/batch` | P0 | #1 |
| 3 | Mejorar `pendingOps` con idempotency_key y checksum | P0 | — |
| 4 | Lógica de resolución de stock (delta, no absoluto) | P0 | #1, #2 |
| 5 | Numeración fiscal en dos fases (provisorio → definitivo) | P0 | #2 |
| 6 | Merge por campo para OTs y clientes | P1 | #2 |
| 7 | Versionamiento de catálogo (`catalog_versions`) | P1 | — |
| 8 | Sync en 3 fases (críticos → pendientes → catálogo) | P1 | #2, #7 |
| 9 | UI de resolución de conflictos | P1 | #6 |
| 10 | Warnings de catálogo desactualizado (24h, 72h) | P2 | #7 |
| 11 | Propagación prioritaria de bloqueos | P2 | #8 |
| 12 | Reportes de diferencias de precio post-sync | P2 | #7 |

---

> **Próximos pasos:** Este documento establece la arquitectura. La implementación comienza por la tabla `eventos_sync` (migración Alembic) y el endpoint de sync batch, ya que son la base sobre la cual se construyen todas las demás piezas.
