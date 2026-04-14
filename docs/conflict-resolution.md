# Manual de Resolución de Conflictos — ERP Mundo Outdoor

> **Este es el documento de referencia oficial.** Todos los módulos del sistema deben implementar  
> la lógica de resolución exactamente como se describe aquí. No hay excepciones sin aprobación explícita.

**Última actualización:** 2026-04-12  
**Basado en:** `schema/002_sync.sql` v2.0, `schema/004_negocio.sql`, `docs/schema-decisions.md`

---

## Decisiones del dueño — Incorporadas a este documento

| Tema | Decisión | Impacto |
|------|----------|---------|
| **Stock negativo** | ✅ Permitido con alerta | La venta se acepta siempre. El sistema alerta, no bloquea. |
| **Contingencia AFIP offline** | ✅ Serie C con numeración separada | Las facturas offline van a `tipo_comprobante = 'FC'`, punto de venta especial de contingencia. |
| **Notificación WhatsApp** | ✅ Stub completo, no envía | El código existe con interfaz completa, pero retorna mock sin llamada real. |
| **Fotos de OT** | ✅ Servidor propio con abstracción | Las fotos se sincronizan separado del evento de la OT, via storage service abstracto. |

---

## Índice

1. [Stock — Sobreventa offline](#sección-1--stock)
2. [Facturas AFIP — Rechazo al sincronizar](#sección-2--facturas-afip)
3. [Órdenes de Trabajo — Edición simultánea offline](#sección-3--órdenes-de-trabajo)
4. [Clientes — Edición en múltiples locales](#sección-4--clientes)
5. [Dispositivo 7 días offline](#sección-5--dispositivo-7-días-offline)
6. [Algoritmo central del procesador de eventos](#sección-6--algoritmo-central)

---

---

# SECCIÓN 1 — STOCK

## Caso: Dos dispositivos venden offline, el stock queda negativo

### Premisas del modelo

- El stock se maneja **por local** (cada local tiene su propio pool físico).
- `movimientos_stock` es la **fuente de verdad**. `variantes_producto.stock_actual` es un cache.
- El conflicto de sobreventa ocurre cuando dos dispositivos del **mismo local** (ej: caja 1 y caja 2) tienen datos de stock desincronizados y ambos venden offline antes del próximo sync.
- También puede ocurrir si el stock de un local fue comprometido por una transferencia que no propagó a tiempo.
- **Decisión del dueño: stock negativo es PERMITIDO.** La venta nunca se anula. El sistema genera alerta y el admin resuelve.

### Escenario de referencia

```
Producto:  Campera M Azul (variante_id: "var-camp-m-azul")
Local:     Local Centro
Stock inicial en Local Centro: 1 unidad

Caja 1 (dispositivo "caja-c1"):  ve stock = 1 (sync a las 09:50)
Caja 2 (dispositivo "caja-c2"):  ve stock = 1 (sync a las 09:50)

[Ambas sin internet desde 09:52]

10:00 — Caja 1 vende 1 unidad a Cliente García
10:05 — Caja 2 vende 1 unidad a Cliente López
11:00 — Vuelve internet, ambas sincronizan
```

### Flujo paso a paso

#### Paso 1 — Caja 1 vende offline (10:00)

```
IndexedDB (caja-c1):
  catalogStock["var-camp-m-azul"] → 1 → 0

  pendingOps.push({
    idempotency_key: "caja-c1-1712959200000-a8f3b2c1",
    operacion: "INSERT",
    tabla_afectada: "movimientos_stock",
    payload_despues: {
      variante_id: "var-camp-m-azul",
      tipo: "EGRESO",
      cantidad: 1,
      local_id: "local-centro",
      referencia_tipo: "factura",
      referencia_id: "factura-offline-c1-001",
      usuario_id: "cajero-ana",
      timestamp_local: "2026-04-12T10:00:00.000Z"
    },
    numero_secuencia: 42,
    version_catalogo: 58
  })
  
  offlineSales.push({ id: "factura-offline-c1-001", estado: "contingencia", ... })
  
UI Caja 1: stock muestra 0. Imprime comprobante OFF-CAJA-C1-00042.
```

#### Paso 2 — Caja 2 vende offline (10:05)

```
IndexedDB (caja-c2):
  catalogStock["var-camp-m-azul"] → 1 → 0
  ⚠️  Caja 2 sigue viendo stock=1 porque no sincronizó desde las 09:50.

  pendingOps.push({
    idempotency_key: "caja-c2-1712959500000-d4e7f9a2",
    operacion: "INSERT",
    tabla_afectada: "movimientos_stock",
    payload_despues: {
      variante_id: "var-camp-m-azul",
      tipo: "EGRESO",
      cantidad: 1,
      local_id: "local-centro",
      referencia_tipo: "factura",
      referencia_id: "factura-offline-c2-078",
      usuario_id: "cajero-luis",
      timestamp_local: "2026-04-12T10:05:00.000Z"
    },
    numero_secuencia: 17,
    version_catalogo: 58
  })
  
UI Caja 2: stock muestra 0. Imprime comprobante OFF-CAJA-C2-00078.
```

#### Paso 3 — Vuelve internet. Fase 1: servidor envía críticos (11:00)

Antes de procesar los pendientes de los dispositivos, el servidor revisa si hay datos críticos que propagar. En este caso no hay bloqueos nuevos ni precios críticos → la Fase 1 es vacía.

#### Paso 4 — Fase 2: servidor procesa Caja 1

```
Servidor recibe lote de Caja 1.
Verifica idempotency_key "caja-c1-...-a8f3b2c1" → no existe → procesar.

BEGIN TRANSACTION;

  -- Obtener stock actual del local con LOCK para evitar race condition
  stock_actual = SELECT SUM(
      CASE WHEN tipo IN ('INGRESO','TRANSFERENCIA_IN') THEN cantidad
           WHEN tipo IN ('EGRESO','TRANSFERENCIA_OUT','AJUSTE_NEGATIVO') THEN -cantidad
           ELSE 0 END
    )
    FROM movimientos_stock
    WHERE variante_id = 'var-camp-m-azul'
      AND local_id = 'local-centro'
    FOR UPDATE;
  -- stock_actual = 1

  stock_resultante = 1 - 1 = 0

  INSERT INTO movimientos_stock (
    id, variante_id, empresa_id, tipo, cantidad,
    stock_resultante, local_id, referencia_tipo, referencia_id,
    usuario_id, dispositivo_id, timestamp_local
  ) VALUES (
    gen_uuid(), 'var-camp-m-azul', 'emp-1', 'EGRESO', 1,
    0, 'local-centro', 'factura', 'factura-offline-c1-001',
    'cajero-ana', 'caja-c1', '2026-04-12T10:00:00Z'
  );

  UPDATE variantes_producto SET stock_actual = stock_actual - 1
    WHERE id = 'var-camp-m-azul';
  -- stock_actual en variantes_producto queda: 0

  UPDATE eventos_sync SET
    sincronizado = true,
    timestamp_servidor = NOW(),
    conflicto = false
  WHERE idempotency_key = 'caja-c1-...-a8f3b2c1';

COMMIT;

Retorna a Caja 1: { status: "ok", stock_resultante: 0 }
```

#### Paso 5 — Fase 2: servidor procesa Caja 2

```
Servidor recibe lote de Caja 2.
Verifica idempotency_key "caja-c2-...-d4e7f9a2" → no existe → procesar.

BEGIN TRANSACTION;

  stock_actual = SELECT SUM(...) FROM movimientos_stock
    WHERE variante_id = 'var-camp-m-azul' AND local_id = 'local-centro'
    FOR UPDATE;
  -- stock_actual = 0  ← Caja 1 ya lo consumió

  stock_resultante = 0 - 1 = -1  ← SOBREVENTA DETECTADA

  -- DECISIÓN: stock negativo es PERMITIDO. Se procesa igual.
  
  INSERT INTO movimientos_stock (
    ..., tipo: 'EGRESO', cantidad: 1, stock_resultante: -1, ...
  );

  UPDATE variantes_producto SET stock_actual = -1
    WHERE id = 'var-camp-m-azul';
  -- stock_actual en variantes_producto queda: -1

  -- Registrar el conflicto en eventos_sync
  UPDATE eventos_sync SET
    sincronizado = true,
    timestamp_servidor = NOW(),
    conflicto = true,
    conflicto_tipo = 'SOBREVENTA',
    resolucion_conflicto = JSON('{
      "accion": "VENTA_ACEPTADA_STOCK_NEGATIVO",
      "stock_antes": 0,
      "cantidad_vendida": 1,
      "stock_resultante": -1,
      "movimiento_previo_id": "<id del movimiento de Caja 1>",
      "timestamp_resolucion": "2026-04-12T11:00:05Z"
    }')
  WHERE idempotency_key = 'caja-c2-...-d4e7f9a2';

  -- Marcar la factura como requiere revisión
  UPDATE facturas SET
    requiere_revision = true,
    motivo_revision = 'SOBREVENTA_OFFLINE'
  WHERE id = 'factura-offline-c2-078';

  -- Generar notificación para el admin
  INSERT INTO notificaciones (
    empresa_id, tipo, severity, titulo, mensaje, datos_json, created_at
  ) VALUES (
    'emp-1', 'STOCK_NEGATIVO', 'HIGH',
    'Sobreventa: Campera M Azul',
    'Stock de Campera M Azul (Local Centro) quedó en -1. ' ||
    'Dos cajas vendieron offline simultáneamente. Se vendieron 2 unidades con stock = 1.',
    JSON('{
      "variante_id": "var-camp-m-azul",
      "local_id": "local-centro",
      "stock_resultante": -1,
      "facturas": ["factura-offline-c1-001", "factura-offline-c2-078"],
      "dispositivos": ["caja-c1", "caja-c2"],
      "requiere_accion": true
    }'),
    NOW()
  );

COMMIT;

Retorna a Caja 2: {
  status: "ok_con_alerta",
  stock_resultante: -1,
  alerta: { tipo: "SOBREVENTA", mensaje: "..." }
}
```

### Qué ve cada usuario

**Cajero de Caja 1 (Ana):** No ve nada inusual. Su venta se procesó normalmente. Stock actualizado a 0.

**Cajero de Caja 2 (Luis):**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  ALERTA DE SINCRONIZACIÓN                       │
│                                                     │
│  Tu venta de Campera M Azul fue registrada.         │
│                                                     │
│  ATENCIÓN: Mientras estabas sin conexión, otra caja │
│  ya había vendido la última unidad.                  │
│  Stock actual: -1 (requiere reposición)              │
│                                                     │
│  La venta quedó registrada como válida.             │
│  Administración fue notificada.                      │
│                                                     │
│  [ Entendido ]                                      │
└─────────────────────────────────────────────────────┘
```

**Administrador:**
- Panel de alertas: badge rojo "1 conflicto de stock pendiente"
- Notificación push (si tiene PWA instalada)
- Email de resumen si configurado

### Qué ve y hace el admin

```
Panel: ALERTAS DE STOCK → "Campera M Azul — Local Centro — Stock: -1"

Opciones:
  [ Transferir stock desde depósito ]
    → Genera TRANSFERENCIA_OUT en depósito + TRANSFERENCIA_IN en Local Centro
    → Stock vuelve a ≥ 0

  [ Registrar ajuste de inventario ]  
    → Si había stock físico no registrado
    → Genera movimiento AJUSTE con motivo "CORRECCIÓN_POST_CONFLICTO"
    
  [ Crear pedido a proveedor ]
    → Registra la necesidad de reposición
    → Stock sigue negativo hasta que llegue la mercadería

  [ Marcar como resuelto manualmente ]
    → Admin confirma que entiende la situación y la tomó en cuenta
    → conflicto_resuelto = true, resuelto_por = admin_id, resuelto_at = NOW()
```

### Estado final del sistema

| Dato | Valor | Nota |
|------|-------|------|
| `movimientos_stock` (caja-c1) | EGRESO 1, stock_resultante=0 | Registrado sin conflicto |
| `movimientos_stock` (caja-c2) | EGRESO 1, stock_resultante=-1 | Registrado con stock negativo |
| `variantes_producto.stock_actual` | **-1** | Indica sobreventa, requiere acción |
| Factura Caja 1 | `estado=contingencia`, `requiere_revision=false` | Normal |
| Factura Caja 2 | `estado=contingencia`, `requiere_revision=true`, `motivo='SOBREVENTA_OFFLINE'` | Marcada para revisión |
| `eventos_sync` (caja-c2) | `conflicto=true`, `conflicto_tipo='SOBREVENTA'` | Pendiente de resolver por admin |
| Notificación | `severity=HIGH`, activa | En panel de admin |

### Pseudocódigo del detector de conflictos de stock

```python
def detectar_conflicto_stock(
    evento: EventoSync,
    movimiento: dict,
    db: Database
) -> ConflictoResult:
    """
    Detecta sobreventas al procesar un movimiento EGRESO.
    Llamado DENTRO de una transacción serializable con FOR UPDATE.
    """
    
    # Solo aplica a egresos (ventas, transferencias salientes)
    if movimiento["tipo"] not in ("EGRESO", "TRANSFERENCIA_OUT"):
        return ConflictoResult(tiene_conflicto=False)
    
    # Calcular stock actual del local (fuente de verdad: movimientos)
    stock_actual = db.query("""
        SELECT COALESCE(SUM(
            CASE 
                WHEN tipo IN ('INGRESO', 'TRANSFERENCIA_IN') THEN cantidad
                WHEN tipo IN ('EGRESO', 'TRANSFERENCIA_OUT') THEN -cantidad
                WHEN tipo = 'AJUSTE' THEN cantidad  -- puede ser + o - según signo
                ELSE 0
            END
        ), 0)
        FROM movimientos_stock
        WHERE variante_id = :variante_id
          AND local_id = :local_id
          AND empresa_id = :empresa_id
        FOR UPDATE  -- bloqueo de lectura para evitar race condition
    """, variante_id=movimiento["variante_id"],
         local_id=movimiento["local_id"],
         empresa_id=evento.empresa_id)
    
    stock_resultante = stock_actual - movimiento["cantidad"]
    
    if stock_resultante >= 0:
        # No hay conflicto
        return ConflictoResult(
            tiene_conflicto=False,
            stock_resultante=stock_resultante
        )
    
    # SOBREVENTA DETECTADA
    # Buscar el movimiento que "ganó" (el que se procesó antes)
    movimiento_previo = db.query("""
        SELECT id, dispositivo_id, timestamp_local
        FROM movimientos_stock
        WHERE variante_id = :variante_id
          AND local_id = :local_id
          AND tipo = 'EGRESO'
        ORDER BY created_at DESC
        LIMIT 1
    """, ...)
    
    return ConflictoResult(
        tiene_conflicto=True,
        tipo_conflicto="SOBREVENTA",
        stock_resultante=stock_resultante,
        aceptar_igual=True,   # DECISIÓN DEL DUEÑO: siempre aceptar
        severity="HIGH",
        detalle={
            "stock_antes": stock_actual,
            "cantidad_vendida": movimiento["cantidad"],
            "stock_resultante": stock_resultante,
            "movimiento_previo_id": movimiento_previo["id"] if movimiento_previo else None,
            "dispositivo_ganador": movimiento_previo["dispositivo_id"] if movimiento_previo else None
        }
    )


def aplicar_movimiento_stock(
    evento: EventoSync,
    movimiento: dict,
    conflicto: ConflictoResult,
    db: Database
):
    """
    Aplica el movimiento independientemente de si hay conflicto.
    La decisión de aceptar stock negativo está en la política, no en esta función.
    """
    
    # Siempre insertar el movimiento
    db.execute("""
        INSERT INTO movimientos_stock 
        (..., stock_resultante, ...)
        VALUES (..., :stock_resultante, ...)
    """, stock_resultante=conflicto.stock_resultante)
    
    # Actualizar cache (puede quedar negativo — es correcto)
    db.execute("""
        UPDATE variantes_producto 
        SET stock_actual = :nuevo_stock
        WHERE id = :variante_id
    """, nuevo_stock=conflicto.stock_resultante)
    
    if conflicto.tiene_conflicto:
        # Registrar conflicto en eventos_sync
        registrar_conflicto_en_evento(evento, conflicto)
        
        # Marcar factura asociada para revisión
        if movimiento.get("referencia_tipo") == "factura":
            marcar_factura_requiere_revision(
                factura_id=movimiento["referencia_id"],
                motivo="SOBREVENTA_OFFLINE"
            )
        
        # Generar notificación al admin
        crear_notificacion_stock_negativo(
            empresa_id=evento.empresa_id,
            variante_id=movimiento["variante_id"],
            local_id=movimiento["local_id"],
            stock_resultante=conflicto.stock_resultante,
            evento_id=evento.id
        )
    
    # Actualizar evento como sincronizado
    db.execute("""
        UPDATE eventos_sync SET
            sincronizado = true,
            timestamp_servidor = :ahora,
            conflicto = :tiene_conflicto,
            conflicto_tipo = :tipo,
            resolucion_conflicto = :resolucion
        WHERE id = :evento_id
    """, ...)
```

---

---

# SECCIÓN 2 — FACTURAS AFIP

## Caso: Factura de contingencia offline rechazada por AFIP al sincronizar

### Premisas del modelo

- Las facturas son **append-only**: una vez emitida, nunca se modifica. Los errores se corrigen con notas de crédito.
- **Decisión del dueño: contingencia AFIP = Serie C con numeración separada.**
  - `tipo_comprobante = 'FC'` (Factura C de contingencia)
  - `punto_venta = 999` (punto de venta de contingencia, separado del punto de venta normal)
  - Numeración propia: `OFF-{device_id}-{seq_local}` como provisorio
- **WhatsApp = stub completo.** El código llama a `whatsapp_service.send()`, que retorna `{ ok: true, message_id: "mock-..." }` sin enviar nada real.
- El pago ya se cobró al cliente. No se anula automáticamente.

### Ciclo de vida de la factura

```
[OFFLINE]                           [SERVIDOR]              [AFIP]
                                    
 borrador                           
    ↓ (cajero confirma venta)       
 contingencia ──── sync ──────────► pendiente_afip ───────► emitida
 (numero_provisorio)                                       (con CAE)
                                                    └──────► rechazada_afip
                                                           (con error_afip)
 
 Desde cualquier estado confirmado:
    anulada (requiere nota_credito en AFIP si ya tenía CAE)
```

### Escenario de referencia

```
Dispositivo: Caja A1 (tablet, sin internet desde 09:50)
Cliente: Comercial Sur SRL (CUIT: 30-71234567-8, condicion_iva: RI)
Servicio: Cambio de amortiguadores + mano de obra, total $185.000

11:00 — Cajero emite factura offline
11:30 — Vuelve internet
11:30 — Sistema intenta autorizar con AFIP → ERROR: "CUIT inválido"
```

### Por qué AFIP puede rechazar una factura offline

| Código de error AFIP | Causa | Recuperable |
|---------------------|-------|-------------|
| `10016` | CUIT del receptor inválido o inexistente en padrón | Sí — corregir CUIT y reenviar |
| `10044` | Monto máximo para tipo de comprobante excedido | Sí — cambiar tipo de comprobante |
| `10145` | Punto de venta no autorizado | No — requiere habilitación en AFIP |
| `10148` | Fecha de emisión fuera de rango (> 5 días atrás) | No — requiere nota de crédito |
| `10184` | CAE ya emitido para ese número fiscal | No — duplicado, requiere anulación |
| `600` | Servicio AFIP no disponible | Sí — reintentar automáticamente |

### Flujo paso a paso

#### Paso 1 — Cajero emite factura offline (11:00)

```
IndexedDB (caja-a1):
  offlineSales.push({
    id: "factura-offline-a1-015",
    tipo_comprobante: "FC",         -- Factura C de contingencia (DECISIÓN DEL DUEÑO)
    punto_venta: 999,               -- punto de venta de contingencia
    numero_provisorio: "OFF-CAJA-A1-00015",
    cliente_id: "cli-comercial-sur",
    estado: "contingencia",
    total: 185000,
    iva_total: 32184.87,
    timestamp_local: "2026-04-12T11:00:00Z",
    version_catalogo: 58
  })

  pendingOps.push({
    idempotency_key: "caja-a1-1712962800000-f1c8d3e5",
    tabla_afectada: "facturas",
    operacion: "INSERT",
    payload_despues: { ...factura completa... }
  })

UI Caja A1:
  Imprime comprobante:
  ══════════════════════════════
    COMPROBANTE DE CONTINGENCIA
    FC - Pto. Venta 999
    Nro provisorio: OFF-CAJA-A1-00015
    *** PENDIENTE DE FISCALIZACIÓN ***
    Válido como comprobante de pago.
    Se reemplazará por factura fiscal
    al restablecer la conexión.
  ══════════════════════════════
```

#### Paso 2 — Vuelve internet. Fase 1 del sync (11:30)

```
Servidor → Caja A1: [no hay críticos pendientes]
Caja A1 → Servidor: lote de pendingOps
```

#### Paso 3 — Servidor procesa la factura (Fase 2)

```python
# Servidor recibe INSERT de factura "factura-offline-a1-015"

def procesar_factura_offline(evento: EventoSync, factura: dict) -> dict:
    
    # 1. Verificar idempotencia
    if existe_en_db(evento.idempotency_key):
        return {"status": "ya_procesado", "factura_id": factura["id"]}
    
    # 2. Validaciones previas al intento AFIP
    cliente = get_cliente(factura["cliente_id"])
    
    # 2a. ¿Cliente bloqueado?
    if cliente.bloqueado:
        return crear_conflicto_cliente_bloqueado(factura, cliente)
    
    # 2b. ¿Qué tipo de factura emitir?
    # La contingencia siempre va como FC (Factura C), punto_venta=999
    # Al sincronizar, el servidor puede recategorizarla si corresponde
    # pero SOLO con aprobación del admin (no automático)
    
    # 3. Insertar en DB con estado pendiente_afip
    factura["estado"] = "pendiente_afip"
    factura["numero_fiscal"] = asignar_numero_fiscal(
        empresa_id=factura["empresa_id"],
        tipo_comprobante=factura["tipo_comprobante"],  # FC
        punto_venta=factura["punto_venta"]             # 999
    )
    
    db.insert("facturas", factura)
    
    # 4. Intentar autorizar con AFIP
    resultado_afip = afip_client.autorizar_comprobante({
        "tipo": 11,                          # código AFIP para Factura C
        "punto_venta": factura["punto_venta"],
        "numero": factura["numero_fiscal"],
        "fecha": factura["timestamp_local"][:10],
        "cuit_receptor": cliente.cuit_dni,
        "importe_total": factura["total"],
        "importe_neto": factura["subtotal"],
        "importe_iva": factura["iva_total"]
    })
    
    if resultado_afip.success:
        # ✅ AFIP aprobó
        db.update("facturas", factura["id"], {
            "estado": "emitida",
            "cae": resultado_afip.cae,
            "cae_vencimiento": resultado_afip.vencimiento,
            "timestamp_fiscal": resultado_afip.timestamp,
            "numero_provisorio": factura["numero_provisorio"]  # se preserva para trazabilidad
        })
        
        notificar_cliente_factura_emitida(cliente, factura, resultado_afip.cae)
        
        return {"status": "ok", "cae": resultado_afip.cae}
    
    else:
        # ❌ AFIP rechazó
        return procesar_rechazo_afip(factura, cliente, resultado_afip)


def procesar_rechazo_afip(
    factura: dict,
    cliente: dict,
    error_afip: AFIPError
) -> dict:
    
    # Determinar si el rechazo es recuperable
    es_recuperable = error_afip.codigo in (600, 601, 602)  # errores de servicio
    
    db.update("facturas", factura["id"], {
        "estado": "rechazada_afip",
        "error_afip": json.dumps({
            "codigo": error_afip.codigo,
            "mensaje": error_afip.mensaje,
            "observaciones": error_afip.observaciones,
            "timestamp": datetime.utcnow().isoformat()
        }),
        "requiere_revision": True,
        "motivo_revision": "RECHAZO_AFIP"
    })
    
    # Registrar conflicto en eventos_sync
    db.update("eventos_sync", {
        "where": f"idempotency_key = '{factura['idempotency_key']}'",
        "conflicto": True,
        "conflicto_tipo": "RECHAZO_FISCAL",
        "resolucion_conflicto": json.dumps({
            "accion": "FACTURA_MARCADA_RECHAZADA",
            "codigo_afip": error_afip.codigo,
            "mensaje_afip": error_afip.mensaje,
            "recuperable": es_recuperable
        })
    })
    
    # Notificar al local de origen
    crear_notificacion(
        empresa_id=factura["empresa_id"],
        tipo="FACTURA_RECHAZADA_AFIP",
        severity="HIGH",
        titulo=f"Factura {factura['numero_provisorio']} rechazada por AFIP",
        mensaje=f"Error {error_afip.codigo}: {error_afip.mensaje}",
        datos={
            "factura_id": factura["id"],
            "numero_provisorio": factura["numero_provisorio"],
            "codigo_afip": error_afip.codigo,
            "recuperable": es_recuperable,
            "cliente_nombre": cliente.nombre,
            "total": factura["total"],
            "dispositivo_origen": factura["dispositivo_id"]
        }
    )
    
    # WhatsApp stub — no envía, pero el código existe completo
    whatsapp_service.send(
        to=cliente.datos_json.get("telefono_whatsapp"),
        template="factura_requiere_accion",
        params={
            "nombre_cliente": cliente.nombre,
            "numero_factura": factura["numero_provisorio"],
            "negocio": factura["empresa_nombre"]
        }
    )
    # ↑ Retorna { ok: True, message_id: "mock-...", enviado: False }
    
    return {
        "status": "rechazado_afip",
        "factura_id": factura["id"],
        "codigo_error": error_afip.codigo,
        "recuperable": es_recuperable
    }
```

#### Paso 4 — Qué ve el cajero en Caja A1

```
Banner en pantalla (OfflineBanner):
  "⚠️  Sync completado con 1 alerta"

Al hacer click:
┌──────────────────────────────────────────────────────────┐
│  ❌ FACTURA RECHAZADA POR AFIP                           │
│                                                          │
│  Comprobante: OFF-CAJA-A1-00015                          │
│  Cliente: Comercial Sur SRL                              │
│  Total: $185.000                                         │
│                                                          │
│  Error AFIP 10016:                                       │
│  "CUIT del receptor no está inscripto en el padrón"      │
│                                                          │
│  El pago ya fue cobrado. La factura NO fue anulada.      │
│  Administración fue notificada y resolverá.              │
│                                                          │
│  ¿Qué podés hacer ahora?                                 │
│  → Verificar el CUIT con el cliente                      │
│  → Consultar a administración                            │
│                                                          │
│  [ Ver detalle ]  [ Entendido ]                          │
└──────────────────────────────────────────────────────────┘
```

#### Paso 5 — Qué hace el administrador

```
Panel: FACTURAS RECHAZADAS → "FC-999-00015 — Comercial Sur SRL — $185.000"

Opciones disponibles:
```

| Opción | Cuándo usarla | Qué hace el sistema |
|--------|---------------|---------------------|
| **Corregir CUIT y reenviar** | CUIT ingresado mal offline | Actualiza cliente.cuit_dni, reintenta AFIP |
| **Cambiar tipo de comprobante** | Monto excedía límite para FC | Crea nueva factura con tipo correcto (FB/FA), reintenta AFIP |
| **Emitir nota de crédito + nueva factura** | Rechazo no recuperable | Crea NC en AFIP anulando la incorrecta, emite nueva con datos correctos |
| **Aceptar como contingencia interna** | Cliente paga en efectivo, no necesita CAE | Marca factura como `anulada` fiscalmente, genera comprobante interno |
| **Reenviar a AFIP** | Error transitorio del servicio (código 600) | Pone en cola de reintento automático (próximo intento en 15 min) |

#### ¿Qué pasa con el pago ya cobrado?

**El pago no se revierte automáticamente.** El cajero ya entregó el servicio y cobró. Las opciones son:

1. **Se emite correctamente:** El cliente recibe la factura definitiva por WhatsApp/email. El pago queda aplicado a esa factura.
2. **Se emite nota de crédito + nueva factura:** El monto sigue siendo el mismo, solo cambia el documento.
3. **Si hay diferencia de monto** (ej: cambio de tipo de comprobante implica IVA distinto): El admin registra un ajuste de caja manualmente.

**El sistema NUNCA anula el cobro automáticamente.** Ese es un proceso manual y deliberado.

### Estado final del sistema

| Dato | Valor |
|------|-------|
| `facturas.estado` | `rechazada_afip` (temporariamente) |
| `facturas.error_afip` | JSON con código y mensaje AFIP |
| `facturas.requiere_revision` | `true` |
| `eventos_sync.conflicto_tipo` | `RECHAZO_FISCAL` |
| Notificación admin | Activa, severity HIGH |
| WhatsApp al cliente | Mock enviado (sin efecto real) |
| Pago cobrado | Intacto — no se modifica |

---

---

# SECCIÓN 3 — ÓRDENES DE TRABAJO

## Caso: Mecánico y recepción editan la misma OT offline simultáneamente

### Escenario de referencia

```
OT-2026-0042 — Honda Civic KJL-549
Estado actual: EN_PROGRESO

09:00 — Juan (mecánico, tablet-taller) descarga la OT. Va offline.
09:00 — María (recepción, pc-recepcion) descarga la OT. Va offline.

09:30 — Juan edita offline:
  - diagnostico: "Cambio freno delantero derecho + ajuste alineación"
  - notas_internas: "El disco tiene 40% de vida útil"
  - estado: "FINALIZADA"  ← CAMPO CRÍTICO
  - prioridad: "ALTA"

10:15 — María edita offline:
  - observaciones: "Cliente llama a las 11, confirmar precio antes de entregar"
  - estado: "EN_PROGRESO"  ← CONFLICTO CON JUAN
  - fecha_estimada: "2026-04-12T17:00:00Z"

11:00 — Ambos reconectan y sincronizan.
```

### Tabla de estrategia por campo

| Campo OT | Tipo | Estrategia | Razonamiento |
|----------|------|-----------|--------------|
| `diagnostico` | LWW | Gana el timestamp más reciente | Dato técnico — el mecánico actualiza con info más reciente |
| `observaciones` | LWW | Gana el timestamp más reciente | Información al cliente — se complementan raramente |
| `notas_internas` | LWW | Gana el timestamp más reciente | Dato interno del taller |
| `fecha_estimada` | LWW | Gana el timestamp más reciente | Estimación — la más reciente es la más válida |
| `prioridad` | LWW | Gana el timestamp más reciente | Decisión operativa |
| `km_entrada` | LWW | Gana el primer valor (INSERT) | El KM solo se registra una vez al ingreso |
| `km_salida` | LWW | Gana el primer valor non-null | El KM de salida se registra al finalizar |
| `estado` | **MANUAL** | Conflicto manual con UI | Determina el flujo de trabajo — ambigüedad peligrosa |
| `total_final` | **MANUAL** | Conflicto manual con UI | Impacto financiero directo |
| `aprobado_por` / `aprobado_timestamp` | **MANUAL** | Conflicto manual si divergen | Solo una persona puede aprobar el presupuesto |
| `presupuesto_total` | RECALCULAR | Se recalcula de `ot_items` | Derivado, no editable directamente |
| **Items agregados** (nuevos) | AUTO-MERGE | Se aceptan ambos | Cada item tiene UUID propio — no hay colisión |
| **Items editados** (mismo ID) | **MANUAL** | Conflicto manual | Precio o cantidad del mismo item diverge |
| **Items eliminados** | **MANUAL** | Conflicto manual si el otro lo editó | No se puede eliminar lo que el otro modificó silenciosamente |
| `timestamps de transición` (`ts_finalizada`, etc.) | SERVER | Solo el servidor los asigna | Marca oficial del estado |

### Flujo de merge en el servidor

```python
def merge_ot(
    ot_server: dict,
    evento_a: EventoSync,  # evento de Juan (mecánico)
    evento_b: EventoSync,  # evento de María (recepción)
    db: Database
) -> MergeResult:
    """
    Se llama cuando el servidor detecta dos eventos UPDATE para la misma OT.
    Los eventos llegan en orden de numero_secuencia por dispositivo.
    """
    
    cambios_a = json.loads(evento_a.campos_modificados)  # ["diagnostico","notas_internas","estado","prioridad"]
    cambios_b = json.loads(evento_b.campos_modificados)  # ["observaciones","estado","fecha_estimada"]
    
    payload_a = json.loads(evento_a.payload_despues)
    payload_b = json.loads(evento_b.payload_despues)
    
    resultado = {}
    conflictos_manuales = []
    campos_auto_mergeados = []
    
    # Unión de todos los campos modificados
    todos_los_campos = set(cambios_a) | set(cambios_b)
    
    for campo in todos_los_campos:
        modificado_por_a = campo in cambios_a
        modificado_por_b = campo in cambios_b
        
        if campo in CAMPOS_SERVER_WINS:
            # Ignorar ambos cambios offline — el servidor manda
            resultado[campo] = ot_server[campo]
            
        elif modificado_por_a and not modificado_por_b:
            # Solo A lo modificó → aceptar sin conflicto
            resultado[campo] = payload_a[campo]
            campos_auto_mergeados.append(campo)
            
        elif modificado_por_b and not modificado_por_a:
            # Solo B lo modificó → aceptar sin conflicto
            resultado[campo] = payload_b[campo]
            campos_auto_mergeados.append(campo)
            
        else:
            # AMBOS modificaron el mismo campo
            if campo in CAMPOS_LWW:
                # Last Write Wins — gana el timestamp más reciente
                ts_a = evento_a.timestamp_local
                ts_b = evento_b.timestamp_local
                
                if ts_a > ts_b:
                    resultado[campo] = payload_a[campo]
                    campos_auto_mergeados.append(campo)
                else:
                    resultado[campo] = payload_b[campo]
                    campos_auto_mergeados.append(campo)
                    
            elif campo in CAMPOS_CONFLICTO_MANUAL:
                # No auto-resolver — mantener valor actual del servidor
                resultado[campo] = ot_server[campo]
                conflictos_manuales.append({
                    "campo": campo,
                    "valor_servidor": ot_server[campo],
                    "valor_a": payload_a[campo],
                    "valor_b": payload_b[campo],
                    "autor_a": evento_a.usuario_id,
                    "autor_b": evento_b.usuario_id,
                    "ts_a": evento_a.timestamp_local,
                    "ts_b": evento_b.timestamp_local
                })
    
    # Aplicar los campos auto-mergeados
    if resultado:
        db.update("ordenes_trabajo", ot_server["id"], {
            **{k: v for k, v in resultado.items() if k not in [c["campo"] for c in conflictos_manuales]},
            "version": ot_server["version"] + 1,
            "updated_at": datetime.utcnow().isoformat()
        })
    
    # Si hay conflictos manuales, marcar la OT y generar alerta
    if conflictos_manuales:
        db.update("ordenes_trabajo", ot_server["id"], {
            "requiere_revision": True,
            "motivo_revision": "CAMPO_DIVERGENTE"
        })
        
        crear_notificacion(
            tipo="OT_CONFLICTO_MANUAL",
            severity="MEDIUM",
            titulo=f"OT {ot_server['numero_ot']}: conflicto en campos {[c['campo'] for c in conflictos_manuales]}",
            datos={
                "ot_id": ot_server["id"],
                "conflictos": conflictos_manuales
            }
        )
    
    return MergeResult(
        campos_aplicados=campos_auto_mergeados,
        conflictos_pendientes=conflictos_manuales
    )
```

### Resultado para el escenario de referencia

| Campo | Valor de Juan (A) | Valor de María (B) | Resultado | Método |
|-------|------------------|--------------------|-----------|--------|
| `diagnostico` | "Cambio freno..." | *(no modificó)* | Valor de Juan ✅ | Solo A |
| `notas_internas` | "El disco tiene 40%..." | *(no modificó)* | Valor de Juan ✅ | Solo A |
| `prioridad` | "ALTA" | *(no modificó)* | "ALTA" ✅ | Solo A |
| `observaciones` | *(no modificó)* | "Cliente llama a las 11..." | Valor de María ✅ | Solo B |
| `fecha_estimada` | *(no modificó)* | "17:00" | "17:00" ✅ | Solo B |
| `estado` | "FINALIZADA" | "EN_PROGRESO" | **EN_PROGRESO** (sin cambio) ⚠️ | CONFLICTO MANUAL |

### UI de resolución de conflicto (modal para admin/supervisor)

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠️  CONFLICTO EN OT-2026-0042 — Honda Civic KJL-549          │
│                                                                │
│  5 de 6 campos se fusionaron automáticamente. ✅               │
│  1 campo requiere tu decisión:                                 │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Campo: ESTADO                                           │  │
│  │                                                          │  │
│  │  Juan (Mecánico, 09:30):                                 │  │
│  │  ► "FINALIZADA"                                          │  │
│  │                                                          │  │
│  │  María (Recepción, 10:15):                               │  │
│  │  ► "EN_PROGRESO"                                         │  │
│  │                                                          │  │
│  │  Estado actual (sin cambio): "EN_PROGRESO"               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [ Usar "FINALIZADA" (Juan) ]  [ Usar "EN_PROGRESO" (María) ] │
│                                                                │
│  La opción no elegida se guarda en historial de auditoría.    │
└────────────────────────────────────────────────────────────────┘
```

### Constantes de clasificación de campos

```python
CAMPOS_LWW = {
    "ordenes_trabajo": [
        "diagnostico", "observaciones", "notas_internas",
        "fecha_estimada", "prioridad", "km_salida"
    ],
    "ot_items": [
        "descripcion", "cantidad", "precio_unitario", "descuento_pct"
    ]
}

CAMPOS_CONFLICTO_MANUAL = {
    "ordenes_trabajo": [
        "estado",           # flujo de trabajo crítico
        "total_final",      # impacto financiero
        "aprobado_por",     # solo una persona puede aprobar
        "aprobado_timestamp"
    ]
}

CAMPOS_SERVER_WINS = {
    "ordenes_trabajo": [
        # estos no vienen del negocio OT, vienen de config
        # si algún día se agregan: precio_hora, descuento_maximo
    ]
}

# Regla especial para ot_items
ITEMS_NUEVOS_SIEMPRE_SE_ACEPTAN = True
# Cada item tiene UUID propio generado en el device → no hay colisión posible
# Si Juan agrega 2 items y María agrega 3 items offline,
# al sincronizar la OT tendrá 5 items nuevos. ✅
```

---

---

# SECCIÓN 4 — CLIENTES

## Caso: Mismo cliente editado en 2 locales offline simultáneamente

### Separación datos maestros vs. datos comerciales

| Tipo | Campos | Estrategia | Justificación |
|------|--------|-----------|---------------|
| **Datos maestros** (identidad legal) | `nombre`, `razon_social`, `cuit_dni`, `condicion_iva`, `tipo_contribuyente` | **MANUAL** | Impactan en la validez de facturas AFIP. Un CUIT incorrecto causa rechazos fiscales. |
| **Datos comerciales** (política) | `bloqueado`, `deuda_acumulada`, `categoria`, `limite_credito`, `condicion_pago_dias` | **SERVER-WINS** | Solo la administración central los define. Un local no puede desbloquear a un cliente bloqueado. |
| **Datos de contacto** (operativos) | `telefono`, `email`, `direccion`, `localidad`, `provincia`, `notas` (en `datos_json`) | **LWW por campo** | Actualizaciones frecuentes, bajo riesgo. La más reciente es la más correcta. |

### Escenario de referencia

```
Cliente: "Deportes Patagonia SRL" (CUIT: 30-70987654-3)
Base en servidor: nombre="Deportes Patagonia SRL", 
                  telefono="2944 123456", email="compras@depat.com"

[Ambos locales sin internet desde 10:00]

10:30 — Local Bariloche edita offline:
  nombre → "DEPORTES PATAGONIA S.R.L."  (mayúsculas, punto legal)
  telefono → "2944 987654"  (nuevo teléfono)

10:45 — Local Neuquén edita offline:
  nombre → "Deportes Patagonia"  (versión corta)
  email → "admin@depat.com.ar"  (nuevo email)
  
11:00 — Ambos reconectan.
```

### Pseudocódigo del merge de clientes

```python
def merge_cliente(
    cliente_servidor: dict,
    evento_local: EventoSync,
    evento_neuquen: EventoSync,
    db: Database
) -> MergeResult:
    
    cambios_loc = json.loads(evento_local.campos_modificados)
    cambios_neu = json.loads(evento_neuquen.campos_modificados)
    
    payload_loc = json.loads(evento_local.payload_despues)
    payload_neu = json.loads(evento_neuquen.payload_despues)
    datos_json_loc = json.loads(payload_loc.get("datos_json", "{}"))
    datos_json_neu = json.loads(payload_neu.get("datos_json", "{}"))
    
    conflictos_manuales = []
    campos_aplicados = {}
    nuevo_datos_json = json.loads(cliente_servidor.get("datos_json", "{}"))
    
    # ─── Datos maestros (conflicto manual si difieren) ───
    CAMPOS_MAESTROS = ["nombre", "razon_social", "cuit_dni", "condicion_iva", "tipo_contribuyente"]
    
    for campo in CAMPOS_MAESTROS:
        modificado_loc = campo in cambios_loc
        modificado_neu = campo in cambios_neu
        
        if modificado_loc and modificado_neu:
            val_loc = payload_loc.get(campo)
            val_neu = payload_neu.get(campo)
            
            if val_loc == val_neu:
                # Misma edición en ambos → no hay conflicto real
                campos_aplicados[campo] = val_loc
            else:
                # Divergen → CONFLICTO MANUAL
                conflictos_manuales.append({
                    "tipo": "DATO_MAESTRO",
                    "campo": campo,
                    "valor_servidor": cliente_servidor.get(campo),
                    "valor_bariloche": val_loc,
                    "valor_neuquen": val_neu
                })
        elif modificado_loc:
            campos_aplicados[campo] = payload_loc[campo]
        elif modificado_neu:
            campos_aplicados[campo] = payload_neu[campo]
    
    # ─── Datos comerciales (server-wins: ignorar cambios offline) ───
    CAMPOS_COMERCIALES = ["bloqueado", "deuda_acumulada", "categoria",
                         "limite_credito", "condicion_pago_dias"]
    
    for campo in CAMPOS_COMERCIALES:
        if campo in cambios_loc or campo in cambios_neu:
            # Registrar intento ignorado para auditoría
            log_intento_modificacion_server_wins(
                campo=campo,
                intentos=[
                    {"device": evento_local.dispositivo_id, "valor": payload_loc.get(campo)},
                    {"device": evento_neuquen.dispositivo_id, "valor": payload_neu.get(campo)}
                ]
            )
            # No aplicar — el servidor mantiene su valor
    
    # ─── Datos de contacto en datos_json (LWW por subcampo) ───
    CAMPOS_CONTACTO = ["telefono", "email", "direccion", "localidad", "provincia", "notas"]
    
    for campo in CAMPOS_CONTACTO:
        val_loc = datos_json_loc.get(campo)
        val_neu = datos_json_neu.get(campo)
        
        modificado_loc_json = val_loc != json.loads(cliente_servidor.get("datos_json", "{}")).get(campo)
        modificado_neu_json = val_neu != json.loads(cliente_servidor.get("datos_json", "{}")).get(campo)
        
        if modificado_loc_json and modificado_neu_json and val_loc != val_neu:
            # LWW — gana el más reciente
            if evento_local.timestamp_local > evento_neuquen.timestamp_local:
                nuevo_datos_json[campo] = val_loc
            else:
                nuevo_datos_json[campo] = val_neu
        elif modificado_loc_json:
            nuevo_datos_json[campo] = val_loc
        elif modificado_neu_json:
            nuevo_datos_json[campo] = val_neu
    
    # Aplicar lo que no tiene conflicto
    update_fields = {**campos_aplicados, "datos_json": json.dumps(nuevo_datos_json)}
    
    if conflictos_manuales:
        update_fields["requiere_revision"] = True
        update_fields["motivo_revision"] = "CAMPO_DIVERGENTE"
        crear_notificacion_conflicto_cliente(cliente_servidor, conflictos_manuales)
    
    db.update("clientes", cliente_servidor["id"], {
        **update_fields,
        "version": cliente_servidor["version"] + 1,
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return MergeResult(campos_aplicados=list(campos_aplicados.keys()),
                       conflictos=conflictos_manuales)
```

### Resultado para el escenario de referencia

| Campo | Local Bariloche | Local Neuquén | Resultado | Método |
|-------|----------------|---------------|-----------|--------|
| `nombre` | "DEPORTES PATAGONIA S.R.L." | "Deportes Patagonia" | **Sin cambio** ⚠️ | CONFLICTO MANUAL |
| `telefono` (datos_json) | "2944 987654" | *(no modificó)* | "2944 987654" ✅ | Solo Bariloche |
| `email` (datos_json) | *(no modificó)* | "admin@depat.com.ar" | "admin@depat.com.ar" ✅ | Solo Neuquén |

### Caso especial: cliente nuevo creado offline en dos locales

Si ambos locales crean un cliente con el mismo CUIT sin internet:

```python
def detectar_duplicado_cliente_offline(
    cliente_nuevo: dict,
    db: Database
) -> DuplicadoResult:
    
    # Búsqueda exacta por CUIT (más confiable)
    if cliente_nuevo.get("cuit_dni"):
        existente = db.query("""
            SELECT * FROM clientes 
            WHERE empresa_id = :empresa_id 
              AND cuit_dni = :cuit
              AND activo = true
        """, empresa_id=cliente_nuevo["empresa_id"],
             cuit=cliente_nuevo["cuit_dni"])
        
        if existente:
            return DuplicadoResult(
                es_duplicado=True,
                tipo="CUIT_EXACTO",
                cliente_existente=existente,
                confianza=1.0
            )
    
    # Búsqueda por similitud de nombre (para clientes sin CUIT)
    # Solo si no hay CUIT → más ambiguo
    similares = db.query("""
        SELECT *, (
            -- Algoritmo simple de similitud: coincidencia de palabras
            length(nombre) - abs(length(nombre) - length(:nombre))
        ) AS score
        FROM clientes
        WHERE empresa_id = :empresa_id
          AND activo = true
        ORDER BY score DESC
        LIMIT 3
    """, ...)
    
    for similar in similares:
        ratio = similarity_ratio(cliente_nuevo["nombre"], similar["nombre"])
        if ratio > 0.85:
            return DuplicadoResult(
                es_duplicado=True,
                tipo="NOMBRE_SIMILAR",
                cliente_existente=similar,
                confianza=ratio
            )
    
    return DuplicadoResult(es_duplicado=False)
```

Si se detecta un duplicado posible:
- El servidor NO crea el nuevo cliente automáticamente
- El evento queda con `conflicto=true`, `conflicto_tipo='DUPLICADO'`
- El admin recibe alerta con los dos registros para decidir: fusionar, crear por separado, o descartar uno

---

---

# SECCIÓN 5 — DISPOSITIVO 7 DÍAS OFFLINE

## Caso: Tablet sin internet 7 días. Al reconectar, el mundo cambió.

### Qué puede haber cambiado en 7 días

```
Cuando un dispositivo estuvo 7 días sin sync, al reconectar puede encontrar:

1. PRECIOS CAMBIADOS: 50+ productos actualizados (cambio de temporada)
2. PRODUCTOS DISCONTINUADOS: productos marcados activo=false
3. CLIENTES BLOQUEADOS: clientes que acumularon deuda y fueron bloqueados
4. NUEVOS PRODUCTOS: ítems que no tiene en su catálogo local
5. VARIANTES AGOTADAS: stock en 0 o negativo en otros locales
6. CAMBIOS DE CONFIGURACIÓN: IVA, descuentos, horarios
7. VENTAS PROPIAS PENDIENTES: operaciones que hizo offline sin sync
```

### Flujo de reconciliación completa en 3 fases

#### Fase 1 — CRÍTICOS: el servidor actualiza el dispositivo ANTES de procesar nada

```python
def preparar_criticos_para_dispositivo(
    device_id: str,
    empresa_id: str,
    ultimo_sync: str,           # timestamp del último sync exitoso
    version_catalogo_local: int # versión que tiene el dispositivo
) -> dict:
    """
    Retorna los datos críticos que el dispositivo DEBE procesar
    antes de que el servidor toque sus pendingOps.
    """
    
    criticos = {}
    
    # ─── Bloqueos de clientes (cambios desde último sync) ───
    clientes_bloqueados_nuevos = db.query("""
        SELECT id, nombre, cuit_dni, bloqueado, deuda_acumulada
        FROM clientes
        WHERE empresa_id = :empresa_id
          AND bloqueado = true
          AND updated_at > :ultimo_sync
    """, empresa_id=empresa_id, ultimo_sync=ultimo_sync)
    
    if clientes_bloqueados_nuevos:
        criticos["clientes_bloqueados"] = clientes_bloqueados_nuevos
    
    # ─── Productos discontinuados ───
    productos_inactivos = db.query("""
        SELECT id, nombre, activo
        FROM productos
        WHERE empresa_id = :empresa_id
          AND activo = false
          AND updated_at > :ultimo_sync
    """, ...)
    
    if productos_inactivos:
        criticos["productos_discontinuados"] = productos_inactivos
    
    # ─── Cambios de precios críticos (>20% de variación) ───
    cambios_precio = db.query("""
        SELECT p.id, p.nombre, p.precio_venta, pe.precio_venta AS precio_anterior
        FROM productos p
        JOIN catalog_versions cv ON cv.tabla = 'productos'
        WHERE p.empresa_id = :empresa_id
          AND p.updated_at > :ultimo_sync
    """, ...)
    
    if cambios_precio:
        criticos["precios_actualizados"] = cambios_precio
    
    # ─── Delta de catálogo ───
    version_servidor = get_catalog_version_actual(empresa_id)
    dias_offline = (datetime.now() - datetime.fromisoformat(ultimo_sync)).days
    
    if dias_offline > 7 or (version_servidor - version_catalogo_local) > 100:
        # Demasiado desfase — full sync
        criticos["tipo_sync_catalogo"] = "FULL"
        criticos["url_catalogo_completo"] = f"/api/v1/sync/catalogo-completo?empresa={empresa_id}"
    else:
        # Sync incremental
        criticos["tipo_sync_catalogo"] = "INCREMENTAL"
        criticos["cambios_desde_version"] = version_catalogo_local
    
    return criticos
```

**El dispositivo recibe los críticos y los aplica ANTES de enviar sus pendingOps:**

```javascript
// En offlineSync.js — frontend
async function sincronizarCompleto() {
    
    // Fase 1: Recibir críticos
    const criticos = await api.post('/api/v1/sync/criticos', {
        device_id: DEVICE_ID,
        ultimo_sync: await getLastSyncTimestamp(),
        version_catalogo: await getVersionCatalogo()
    });
    
    // Aplicar bloqueos ANTES de seguir
    if (criticos.clientes_bloqueados?.length > 0) {
        await db.clientes.bulkPut(criticos.clientes_bloqueados);
        mostrarAlerta(`${criticos.clientes_bloqueados.length} clientes fueron bloqueados mientras estabas offline`);
    }
    
    // Marcar productos discontinuados
    if (criticos.productos_discontinuados?.length > 0) {
        for (const p of criticos.productos_discontinuados) {
            await db.catalogProducts.put({ ...p, activo: false });
        }
    }
    
    // Fase 2: Enviar pendingOps (AHORA, con el contexto actualizado)
    await flushPendingOps();
    
    // Fase 3: Sync de catálogo
    if (criticos.tipo_sync_catalogo === 'FULL') {
        await syncCatalogoCompleto(criticos.url_catalogo_completo);
    } else {
        await syncCatalogoIncremental(criticos.cambios_desde_version);
    }
}
```

#### Fase 2 — PENDINGOPS: proceso de las operaciones offline

Al procesar las operaciones del dispositivo con datos de 7 días atrás, pueden aparecer múltiples conflictos:

```python
def procesar_operacion_con_contexto_viejo(
    evento: EventoSync,
    payload: dict,
    version_catalogo_evento: int,
    version_catalogo_actual: int,
    db: Database
) -> dict:
    
    resultado = {"status": "ok", "alertas": []}
    
    # ─── ¿Precio desactualizado? ───
    if version_catalogo_evento < version_catalogo_actual:
        delta_versiones = version_catalogo_actual - version_catalogo_evento
        dias_aprox = delta_versiones / 2  # estimado, 2 versiones/día
        
        resultado["alertas"].append({
            "tipo": "VERSION_OBSOLETA",
            "mensaje": f"Esta operación usó precios de hace ~{dias_aprox:.0f} versiones",
            "version_evento": version_catalogo_evento,
            "version_actual": version_catalogo_actual,
            "severity": "LOW" if delta_versiones < 10 else "MEDIUM" if delta_versiones < 50 else "HIGH"
        })
        
        # Verificar diferencia de precios
        if evento.tabla_afectada in ("facturas", "movimientos_stock"):
            diferencias = calcular_diferencias_precio(payload, version_catalogo_evento, db)
            if diferencias:
                resultado["alertas"].append({
                    "tipo": "DIFERENCIA_PRECIO",
                    "impacto_total": sum(d["diferencia"] for d in diferencias),
                    "detalle": diferencias
                })
    
    # ─── ¿Venta a cliente bloqueado? ───
    if evento.tabla_afectada == "facturas":
        cliente_id = payload.get("cliente_id")
        if cliente_id:
            cliente = db.get("clientes", cliente_id)
            if cliente and cliente.bloqueado:
                resultado["alertas"].append({
                    "tipo": "CLIENTE_BLOQUEADO",
                    "severity": "HIGH",
                    "mensaje": f"La venta se realizó a {cliente.nombre} que está bloqueado",
                    "deuda": cliente.deuda_acumulada
                })
                db.update("facturas", payload["id"], {
                    "requiere_revision": True,
                    "motivo_revision": "CLIENTE_BLOQUEADO"
                })
    
    # ─── ¿Producto discontinuado? ───
    if evento.tabla_afectada == "movimientos_stock":
        variante_id = payload.get("variante_id")
        if variante_id:
            producto_activo = db.query("""
                SELECT p.activo FROM productos p
                JOIN variantes_producto v ON v.producto_id = p.id
                WHERE v.id = :variante_id
            """, variante_id=variante_id)
            
            if not producto_activo:
                resultado["alertas"].append({
                    "tipo": "PRODUCTO_DISCONTINUADO",
                    "severity": "MEDIUM",
                    "mensaje": "Este producto fue discontinuado mientras estabas offline",
                    "variante_id": variante_id
                })
                # Se acepta el movimiento (ya ocurrió), pero se registra la anomalía
    
    return resultado
```

#### Fase 3 — CATALOGO: sync incremental o full

```python
def sync_catalogo(
    empresa_id: str,
    tipo: str,  # "FULL" | "INCREMENTAL"
    desde_version: int = None
) -> dict:
    
    if tipo == "FULL":
        # Serializar catálogo completo (productos, variantes, stock por local)
        return {
            "productos": get_all_productos(empresa_id),
            "variantes": get_all_variantes(empresa_id),
            "stock_por_local": get_stock_snapshot(empresa_id),
            "version": get_catalog_version_actual(empresa_id),
            "es_full_sync": True
        }
    
    else:  # INCREMENTAL
        return {
            "productos_modificados": get_productos_desde(empresa_id, desde_version),
            "variantes_modificadas": get_variantes_desde(empresa_id, desde_version),
            "movimientos_nuevos": get_movimientos_desde(empresa_id, desde_version),
            "version": get_catalog_version_actual(empresa_id),
            "es_full_sync": False
        }
```

### Qué ve el usuario del dispositivo que reconecta

```
Pantalla de sincronización (SyncStatusPage):

🔄 Sincronizando...

Fase 1 — Actualizaciones críticas:
  ✅  3 clientes bloqueados actualizados en tu catálogo local
  ✅  12 productos discontinuados marcados como inactivos
  ✅  Precios de 47 productos actualizados

Fase 2 — Tus operaciones offline:
  ✅  8 ventas sincronizadas
  ⚠️  2 ventas con alertas de precio desactualizado
  ⚠️  1 venta a cliente bloqueado (Comercial Sur SRL)

Fase 3 — Catálogo completo:
  ✅  Descargados 523 productos, 1847 variantes
      (se realizó sync completo por 7 días offline)

────────────────────────────────────
Total pendiente de revisión: 3 operaciones
[ Ver alertas ]  [ Cerrar ]
```

### Warning preventivo por días offline

```javascript
// Mostrado SIEMPRE que haya transcurrido tiempo sin sync
function getOfflineWarningLevel(horasOffline) {
    if (horasOffline < 4)   return null;          // sin warning
    if (horasOffline < 24)  return "LOW";          // banner informativo gris
    if (horasOffline < 72)  return "MEDIUM";       // banner amarillo
    if (horasOffline < 168) return "HIGH";         // banner naranja
    return "CRITICAL";                              // banner rojo, bloquea ventas a crédito
}

// Con CRITICAL:
// "🔴 Llevas 7+ días sin sincronizar. Los precios pueden estar muy desactualizados.
//  Las ventas a CUENTA CORRIENTE están DESHABILITADAS hasta reconectar.
//  Las ventas en EFECTIVO son permitidas con precio sujeto a revisión."
```

---

---

# SECCIÓN 6 — ALGORITMO CENTRAL

## Procesador unificado de eventos de sync

Este es el único algoritmo que maneja todos los tipos de conflicto. Todos los módulos llaman a `procesar_evento()`.

```python
# ─────────────────────────────────────────────────────────────────
# PROCESADOR CENTRAL DE EVENTOS OFFLINE
# Archivo: app/sync/processor.py
#
# Entrada: un EventoSync del dispositivo cliente
# Salida:  EventoResult con status, conflictos, y acciones tomadas
#
# INVARIANTES:
#   1. Un evento NUNCA se procesa dos veces (idempotency_key)
#   2. Las transacciones son SERIALIZABLES para evitar race conditions
#   3. El stock NUNCA se modifica fuera de esta función
#   4. Todo conflicto queda registrado en eventos_sync antes de retornar
# ─────────────────────────────────────────────────────────────────


class EventoResult:
    status: str          # "ok" | "ok_con_alertas" | "conflicto_registrado" | "ya_procesado" | "error"
    evento_id: str
    alertas: list        # lista de alertas generadas (puede ser vacía)
    accion_tomada: str   # descripción de lo que hizo el servidor
    requiere_atencion: bool


def procesar_evento(evento: EventoSync, db: Database) -> EventoResult:
    """
    Punto de entrada único para procesar eventos offline.
    Se llama una vez por evento en el lote de sync.
    """
    
    # ═══════════════════════════════════════════════════
    # PASO 0: IDEMPOTENCIA — nunca procesar dos veces
    # ═══════════════════════════════════════════════════
    
    existente = db.query(
        "SELECT id, sincronizado FROM eventos_sync WHERE idempotency_key = :key",
        key=evento.idempotency_key
    )
    
    if existente and existente.sincronizado:
        return EventoResult(
            status="ya_procesado",
            evento_id=existente.id,
            accion_tomada="IDEMPOTENCIA: evento ya fue procesado, retornando resultado original"
        )
    
    # ═══════════════════════════════════════════════════
    # PASO 1: VALIDACIÓN DE INTEGRIDAD
    # ═══════════════════════════════════════════════════
    
    if evento.checksum:
        checksum_calculado = calcular_checksum(evento)
        if checksum_calculado != evento.checksum:
            registrar_en_cola_sync(evento, tipo_error="CHECKSUM")
            return EventoResult(
                status="error",
                accion_tomada="CHECKSUM_INVALIDO: evento rechazado, posible corrupción en tránsito"
            )
    
    # ═══════════════════════════════════════════════════
    # PASO 2: ROUTING POR TABLA + OPERACIÓN
    # ═══════════════════════════════════════════════════
    
    handler = HANDLERS.get((evento.tabla_afectada, evento.operacion))
    
    if not handler:
        # Tabla/operación desconocida — aceptar sin procesamiento especial
        return aplicar_evento_generico(evento, db)
    
    # ═══════════════════════════════════════════════════
    # PASO 3: DETECCIÓN DE CONFLICTOS (antes de aplicar)
    # ═══════════════════════════════════════════════════
    
    with db.transaction(isolation="SERIALIZABLE"):
        
        conflicto = detectar_conflicto(evento, db)
        
        # ─── Aplicar el evento (siempre, independiente del conflicto) ───
        resultado_aplicacion = handler(evento, conflicto, db)
        
        # ─── Registrar en eventos_sync ───
        db.update("eventos_sync", evento.id, {
            "sincronizado": True,
            "timestamp_servidor": datetime.utcnow().isoformat(),
            "conflicto": conflicto.tiene_conflicto,
            "conflicto_tipo": conflicto.tipo if conflicto.tiene_conflicto else None,
            "resolucion_conflicto": json.dumps(conflicto.resolucion) if conflicto.tiene_conflicto else None
        })
    
    # ═══════════════════════════════════════════════════
    # PASO 4: POST-PROCESAMIENTO (fuera de la transacción)
    # ═══════════════════════════════════════════════════
    
    alertas = []
    
    if conflicto.tiene_conflicto:
        alerta = crear_notificacion_segun_tipo(evento, conflicto)
        alertas.append(alerta)
        
        # Notificación WhatsApp (stub)
        if debe_notificar_cliente(conflicto.tipo):
            whatsapp_service.send(...)
    
    # Actualizar caches desnormalizados
    invalidar_caches_afectados(evento)
    
    # Propagar a otros dispositivos online via SSE
    sse_broadcaster.emit(
        canal=f"empresa-{evento.empresa_id}",
        evento={
            "tipo": "SYNC_UPDATE",
            "tabla": evento.tabla_afectada,
            "registro_id": evento.registro_id,
            "version": resultado_aplicacion.get("nueva_version")
        }
    )
    
    return EventoResult(
        status="ok_con_alertas" if alertas else "ok",
        evento_id=evento.id,
        alertas=alertas,
        accion_tomada=resultado_aplicacion.get("descripcion"),
        requiere_atencion=conflicto.tiene_conflicto and not conflicto.auto_resuelto
    )


def detectar_conflicto(evento: EventoSync, db: Database) -> ConflictoDetectado:
    """
    Detecta el tipo de conflicto ANTES de aplicar el evento.
    Llamado dentro de una transacción SERIALIZABLE.
    """
    
    tabla = evento.tabla_afectada
    payload = json.loads(evento.payload_despues or "{}")
    
    # ─── 1. Verificar versión del registro (optimistic concurrency) ───
    if evento.operacion == "UPDATE":
        version_servidor = db.query(
            f"SELECT version FROM {tabla} WHERE id = :id",
            id=evento.registro_id
        )
        if version_servidor and version_servidor > evento.version:
            # Alguien más modificó el registro — puede ser conflicto
            # Determinar si es conflicto real según los campos
            return ConflictoDetectado(
                tiene_conflicto=True,
                tipo="CAMPO_DIVERGENTE",
                version_esperada=evento.version,
                version_actual=version_servidor,
                auto_resuelto=False  # requiere merge
            )
    
    # ─── 2. Verificar stock (para movimientos EGRESO) ───
    if tabla == "movimientos_stock" and payload.get("tipo") in ("EGRESO", "TRANSFERENCIA_OUT"):
        return detectar_conflicto_stock(evento, payload, db)
    
    # ─── 3. Verificar cliente bloqueado (para facturas) ───
    if tabla == "facturas" and evento.operacion == "INSERT":
        cliente = db.get("clientes", payload.get("cliente_id"))
        if cliente and cliente.bloqueado:
            return ConflictoDetectado(
                tiene_conflicto=True,
                tipo="CLIENTE_BLOQUEADO",
                cliente=cliente,
                auto_resuelto=False
            )
    
    # ─── 4. Verificar versión de catálogo (para ventas con precios viejos) ───
    if tabla == "facturas" and evento.version_catalogo:
        version_actual = get_catalog_version_actual(evento.empresa_id)
        if evento.version_catalogo < version_actual - 20:  # tolerancia de 20 versiones
            return ConflictoDetectado(
                tiene_conflicto=True,
                tipo="VERSION_OBSOLETA",
                version_catalogo_evento=evento.version_catalogo,
                version_catalogo_actual=version_actual,
                auto_resuelto=True  # se acepta, solo se alerta
            )
    
    # ─── 5. Verificar duplicados (para INSERT de clientes) ───
    if tabla == "clientes" and evento.operacion == "INSERT":
        duplicado = detectar_duplicado_cliente_offline(payload, db)
        if duplicado.es_duplicado:
            return ConflictoDetectado(
                tiene_conflicto=True,
                tipo="DUPLICADO",
                cliente_existente=duplicado.cliente_existente,
                auto_resuelto=False
            )
    
    # Sin conflicto
    return ConflictoDetectado(tiene_conflicto=False)


# ─────────────────────────────────────────────────────────────────
# TABLA DE ROUTING: (tabla, operacion) → handler
# ─────────────────────────────────────────────────────────────────

HANDLERS = {
    # Stock
    ("movimientos_stock", "INSERT"):        handler_movimiento_stock,
    
    # Facturas
    ("facturas", "INSERT"):                 handler_factura_insert,
    ("factura_items", "INSERT"):            handler_factura_item_insert,
    
    # Órdenes de trabajo
    ("ordenes_trabajo", "INSERT"):          handler_ot_insert,
    ("ordenes_trabajo", "UPDATE"):          handler_ot_update,
    ("ot_items", "INSERT"):                 handler_ot_item_insert,
    ("ot_items", "UPDATE"):                 handler_ot_item_update,
    ("ot_items", "DELETE"):                 handler_ot_item_delete,
    
    # Clientes y vehículos
    ("clientes", "INSERT"):                 handler_cliente_insert,
    ("clientes", "UPDATE"):                 handler_cliente_update,
    ("vehiculos", "INSERT"):                handler_vehiculo_insert,
    ("vehiculos", "UPDATE"):                handler_vehiculo_update,
    
    # Catálogo (read-only para devices — solo el servidor escribe)
    ("productos", "INSERT"):                handler_rechazar_escritura_catalogo,
    ("productos", "UPDATE"):                handler_rechazar_escritura_catalogo,
    ("variantes_producto", "INSERT"):       handler_rechazar_escritura_catalogo,
}


# ─────────────────────────────────────────────────────────────────
# PROCESAMIENTO DE LOTES
# ─────────────────────────────────────────────────────────────────

def procesar_lote_sync(
    lote: SyncBatch,
    db: Database
) -> SyncBatchResult:
    """
    Procesa un lote completo de eventos de un dispositivo.
    Los eventos se procesan en orden: (dispositivo_id, numero_secuencia).
    Si un evento crítico falla, los siguientes pueden procesarse igual
    (no hay rollback de lote por defecto — decisión de negocio).
    """
    
    resultados = []
    
    # Ordenar por orden causal del dispositivo
    eventos_ordenados = sorted(
        lote.eventos,
        key=lambda e: (e.dispositivo_id, e.numero_secuencia or 0)
    )
    
    for evento in eventos_ordenados:
        try:
            resultado = procesar_evento(evento, db)
            resultados.append(resultado)
            
        except Exception as e:
            # Un error no debe bloquear el resto del lote
            # Registrar en cola_sync para reintento
            registrar_en_cola_sync(
                evento=evento,
                tipo_error=clasificar_error(e),
                error_mensaje=str(e)
            )
            resultados.append(EventoResult(
                status="error",
                evento_id=evento.id,
                accion_tomada=f"ERROR: {str(e)[:200]}"
            ))
    
    # Actualizar ultimo_sync del dispositivo
    db.update("dispositivos", lote.dispositivo_id, {
        "ultimo_sync": datetime.utcnow().isoformat()
    })
    
    return SyncBatchResult(
        total=len(lote.eventos),
        ok=sum(1 for r in resultados if r.status in ("ok", "ok_con_alertas", "ya_procesado")),
        con_conflicto=sum(1 for r in resultados if r.requiere_atencion),
        errores=sum(1 for r in resultados if r.status == "error"),
        resultados=resultados
    )
```

### Matriz de conflictos y handlers

| `conflicto_tipo` | Detectado en | Auto-resolución | Acción del sistema | Acción requerida |
|-----------------|-------------|-----------------|-------------------|-----------------|
| `SOBREVENTA` | `movimientos_stock` EGRESO | ✅ Sí — acepta y alerta | Stock negativo, factura marcada, notificación HIGH | Admin: transferir stock / ajustar |
| `RECHAZO_FISCAL` | `facturas` INSERT | ❌ No | Factura en estado `rechazada_afip`, notificación HIGH | Admin: corregir y reenviar / NC |
| `CAMPO_DIVERGENTE` | `ordenes_trabajo` UPDATE, `clientes` UPDATE | ✅ Parcial — LWW para campos simples | Merge automático + conflicto manual para críticos, notificación MEDIUM | Admin: resolver campos críticos en UI |
| `DUPLICADO` | `clientes` INSERT | ❌ No | Evento queda pendiente, notificación MEDIUM | Admin: fusionar / crear / descartar |
| `VERSION_OBSOLETA` | `facturas` INSERT | ✅ Sí — acepta y alerta | Factura marcada, reporte de diferencia de precio, notificación LOW/MEDIUM | Admin: revisar impacto económico |
| `CLIENTE_BLOQUEADO` | `facturas` INSERT | ✅ Sí — acepta y alerta | Venta aceptada, factura marcada, notificación CRITICAL | Admin: decidir aprobar / anular / cobrar |

### Severidades y canales de notificación

| Severity | Canales | Tiempo de respuesta esperado |
|----------|---------|------------------------------|
| `CRITICAL` | Push notification + Banner rojo + Email + WhatsApp stub | Inmediato |
| `HIGH` | Push notification + Banner naranja + Email | < 1 hora |
| `MEDIUM` | Banner amarillo + Panel de alertas | < 4 horas |
| `LOW` | Panel de alertas (sin banner) | Siguiente jornada |

---

## Resumen de reglas fundamentales

1. **Una venta que ocurrió no se anula automáticamente nunca.** Puede marcarse para revisión, pero el registro permanece.
2. **El stock puede ser negativo.** Es una señal operativa, no un error del sistema.
3. **El servidor siempre gana en precios, configuración y estado de clientes.** Los dispositivos solo consumen esos datos.
4. **LWW se aplica solo a campos de contacto y datos técnicos de baja criticidad.** Nada fiscal, nada de stock.
5. **Los conflictos no bloquean el flujo.** Se procesan, se registran, se alerta, y el negocio sigue.
6. **La idempotencia es garantía de infraestructura.** Ningún evento se procesa dos veces, pase lo que pase con la red.
7. **El orden causal es `(dispositivo_id, numero_secuencia)`.** Los timestamps del dispositivo son orientativos.
