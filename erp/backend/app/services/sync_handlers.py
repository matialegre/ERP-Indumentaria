"""
sync_handlers.py — HANDLERS routing table para procesamiento de eventos de sync.

Cada handler recibe un evento y opera DENTRO de una transacción SERIALIZABLE
que ya fue abierta por push_events. Los handlers deben:

  1. Leer el estado actual desde la DB (nunca confiar en el payload del cliente).
  2. Aplicar la lógica de negocio del conflict-resolution.md.
  3. Registrar conflictos en sync_conflicts y notificaciones.
  4. Retornar HandlerResult (no hace commit — eso lo hace el caller).

Referencia: docs/conflict-resolution.md (sections 1–4 + section 6)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.sync import SyncConflict, ConflictType, ConflictResolution, AfipQueue, AfipQueueStatus
from app.models.notification import Notification, NotificationType, NotificationStatus
from app.models.product import ProductVariant
from app.models.customer import Customer, CustomerCompany
from app.models.work_order import WorkOrder, WOStatus

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════
# RESULTADO DE HANDLER
# ══════════════════════════════════════════════════════

@dataclass
class HandlerResult:
    """
    Resultado que retorna cada handler.
    El caller (push_events) lo usa para armar la respuesta y hacer commit.
    """
    conflicts: list[SyncConflict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    accion_tomada: str = "generic_applied"


# ══════════════════════════════════════════════════════
# HANDLER: MOVIMIENTOS DE STOCK
# ══════════════════════════════════════════════════════

# Tipos de movimiento que reducen stock
_TIPOS_EGRESO = {"EGRESO", "TRANSFERENCIA_OUT", "AJUSTE_NEGATIVO"}
# Tipos que aumentan stock
_TIPOS_INGRESO = {"INGRESO", "TRANSFERENCIA_IN", "AJUSTE_POSITIVO"}


def handle_stock_movement(ev, sync_event, device, user, db: Session) -> HandlerResult:
    """
    Handler para eventos de movimientos de stock.

    GAP-2: calcula el stock resultante leyendo desde la DB, nunca del payload.
    Usa SELECT FOR UPDATE para prevenir race conditions (requiere TX SERIALIZABLE).

    Decisión del dueño (DN-1): stock negativo PERMITIDO.
    La venta nunca se anula. Se genera alerta HIGH para el admin.

    Ref: conflict-resolution.md §1 — pseudocódigo detectar_conflicto_stock
    """
    result = HandlerResult(accion_tomada="stock_movement_applied")
    payload = ev.payload or {}

    tipo = payload.get("type") or payload.get("tipo")
    variant_id = payload.get("variant_id")
    quantity = payload.get("quantity") or payload.get("cantidad", 0)

    # Solo calcular stock para operaciones de egreso
    if tipo not in _TIPOS_EGRESO:
        # Ingreso o ajuste positivo — actualizar cache directamente
        if variant_id and quantity:
            _update_stock_cache(variant_id, abs(quantity), db)
        return result

    if not variant_id or not quantity:
        result.warnings.append("Stock event missing variant_id or quantity — skipped stock check")
        return result

    # ── Leer stock REAL desde la DB con bloqueo FOR UPDATE ──────────────
    # Esto es crítico: el cliente puede haber enviado un resulting_stock incorrecto.
    # SELECT FOR UPDATE dentro de TX SERIALIZABLE previene race conditions.
    row = db.execute(
        text("""
            SELECT stock
            FROM product_variants
            WHERE id = :vid
            FOR UPDATE
        """),
        {"vid": variant_id},
    ).fetchone()

    if row is None:
        result.warnings.append(f"variant_id={variant_id} not found — stock not updated")
        return result

    stock_actual = row[0] or 0
    cantidad_egreso = abs(quantity)
    stock_resultante = stock_actual - cantidad_egreso

    # ── Actualizar cache (siempre, independiente del resultado) ──────────
    db.execute(
        text("UPDATE product_variants SET stock = :nuevo WHERE id = :vid"),
        {"nuevo": stock_resultante, "vid": variant_id},
    )

    if stock_resultante >= 0:
        return result

    # ══════════════════════════════════════════════════
    # SOBREVENTA DETECTADA — stock_resultante < 0
    # Decisión: ACEPTAR la venta, generar alerta HIGH
    # ══════════════════════════════════════════════════

    logger.warning(
        "SOBREVENTA: company=%s variant=%s local=%s stock_antes=%s cantidad=%s resultante=%s event=%s",
        user.company_id, variant_id, device.local_id,
        stock_actual, cantidad_egreso, stock_resultante, sync_event.id,
    )

    conflict = SyncConflict(
        event_id=sync_event.id,
        conflict_type=ConflictType.STOCK_NEGATIVE,
        aggregate_type=sync_event.aggregate_type,
        aggregate_id=sync_event.aggregate_id,
        description=(
            f"Sobreventa detectada: stock_antes={stock_actual}, "
            f"cantidad_vendida={cantidad_egreso}, "
            f"stock_resultante={stock_resultante} "
            f"(variant_id={variant_id}, local_id={device.local_id})"
        ),
        resolution=ConflictResolution.AUTO_RESOLVED,
        resolution_data={
            "stock_antes": stock_actual,
            "cantidad_vendida": cantidad_egreso,
            "stock_resultante": stock_resultante,
            "accion": "VENTA_ACEPTADA_STOCK_NEGATIVO",
            "device_id": device.id,
            "local_id": device.local_id,
        },
        company_id=user.company_id,
    )
    db.add(conflict)
    db.flush()
    result.conflicts.append(conflict)

    # Notificación al admin (HIGH severity) — GAP-6: incluir related_sync_event_id y device_id
    notif = Notification(
        type=NotificationType.URGENTE,
        status=NotificationStatus.NO_LEIDA,
        title=f"⚠️ Sobreventa — variante #{variant_id}",
        message=(
            f"Stock de variante #{variant_id} quedó en {stock_resultante} "
            f"(Local: {device.local_id or 'desconocido'}). "
            f"Dos dispositivos vendieron offline simultáneamente. "
            f"Evento: {sync_event.id[:8]}."
        ),
        to_role="ADMIN",
        company_id=user.company_id,
        related_sync_event_id=sync_event.id,  # GAP-6
        device_id=device.id,                   # GAP-6
    )
    db.add(notif)

    # Marcar la referencia (venta/factura) para revisión si viene en el payload
    ref_id = payload.get("reference_id") or payload.get("referencia_id")
    ref_type = payload.get("reference_type") or payload.get("referencia_tipo")
    if ref_id and ref_type in ("sale", "factura", "venta"):
        _marcar_venta_requiere_revision(ref_id, "SOBREVENTA_OFFLINE", db)

    result.accion_tomada = "stock_negative_accepted_with_alert"
    return result


def _update_stock_cache(variant_id, delta: int, db: Session) -> None:
    """Suma delta al stock cache (para ingresos/ajustes positivos)."""
    db.execute(
        text("UPDATE product_variants SET stock = stock + :delta WHERE id = :vid"),
        {"delta": delta, "vid": variant_id},
    )


def _marcar_venta_requiere_revision(sale_id, motivo: str, db: Session) -> None:
    """
    Intenta marcar la venta asociada como requiere revisión.
    Silencia errores si el modelo no tiene el campo (compatibilidad).
    """
    try:
        db.execute(
            text("""
                UPDATE sales
                SET notes = COALESCE(notes || ' | ', '') || :motivo
                WHERE id = :sid
            """),
            {"motivo": f"[SYNC-CONFLICT:{motivo}]", "sid": sale_id},
        )
    except Exception:
        pass  # La tabla puede no tener el campo aún


# ══════════════════════════════════════════════════════
# HANDLER: VENTAS / FACTURAS
# ══════════════════════════════════════════════════════

def handle_sale(ev, sync_event, device, user, db: Session) -> HandlerResult:
    """
    Handler para eventos de ventas/facturas (aggregate_type="Sale" o "sales").

    Crea la venta en la DB a partir del payload del evento de sync.
    Si la venta ya existe (por número de comprobante + local), detecta
    duplicado y la retorna sin error.

    Para facturas de contingencia offline (type=FACTURA_A/B emitidas sin internet):
    - Encola en afip_queue con status=PENDING para validación posterior.
    - La validación AFIP es asíncrona (no bloquea el sync).

    Ref: conflict-resolution.md §2 — Facturas AFIP rechazadas
    Decisión DN-3: contingencia con punto_venta=999 o serie C separada.
    """
    from app.models.sale import Sale, SaleItem, SaleType, SaleStatus
    from datetime import date as dt_date

    result = HandlerResult(accion_tomada="sale_registered")
    payload = ev.payload or {}

    sale_type_str = payload.get("type") or payload.get("tipo") or "TICKET"
    sale_number = payload.get("number") or payload.get("numero") or ""
    sale_date_str = payload.get("date") or payload.get("fecha") or str(dt_date.today())
    local_id = payload.get("local_id")
    is_offline = payload.get("offline", False) or payload.get("es_offline", False) or payload.get("_offline_emitted", False)
    items_data = payload.get("items") or []

    # ── Normalizar tipo ──────────────────────────────────────────────────
    try:
        sale_type = SaleType(sale_type_str)
    except ValueError:
        sale_type = SaleType.TICKET

    # ── Verificar duplicado por número + empresa ─────────────────────────
    if sale_number:
        existing_sale = db.query(Sale).filter(
            Sale.number == sale_number,
            Sale.company_id == user.company_id,
        ).first()
        if existing_sale:
            result.accion_tomada = "sale_duplicate_skipped"
            result.warnings.append(f"Venta #{sale_number} ya existe en la DB (id={existing_sale.id}), ignorada")
            return result

    # ── Si hay conflicto de número, auto-asignar siguiente ───────────────
    # Solo para ventas offline con número OFL- o X-
    if not sale_number or sale_number.startswith("OFL-") or sale_number.startswith("X-"):
        # Asignar número offline definitivo con prefijo X-
        last_x = db.execute(
            text("""
                SELECT MAX(CAST(REGEXP_REPLACE(number, '[^0-9]', '', 'g') AS INTEGER))
                FROM sales
                WHERE number LIKE 'X-%' AND company_id = :cid
            """),
            {"cid": user.company_id},
        ).scalar() or 0
        sale_number = f"X-{str(last_x + 1).zfill(6)}"
        result.warnings.append(f"Número offline asignado: {sale_number}")

    # ── Crear la venta ───────────────────────────────────────────────────
    try:
        sale_date = dt_date.fromisoformat(sale_date_str) if sale_date_str else dt_date.today()
    except (ValueError, TypeError):
        sale_date = dt_date.today()

    sale = Sale(
        type=sale_type,
        number=sale_number,
        date=sale_date,
        status=SaleStatus.EMITIDA if is_offline else SaleStatus.BORRADOR,
        customer_name=payload.get("customer_name") or "Consumidor Final",
        customer_cuit=payload.get("customer_cuit"),
        notes=payload.get("notes"),
        subtotal=payload.get("subtotal"),
        tax=payload.get("tax"),
        total=payload.get("total"),
        local_id=int(local_id) if local_id else (device.local_id or None),
        company_id=user.company_id,
        created_by_id=user.id,
    )
    db.add(sale)
    db.flush()  # Obtener el ID asignado

    # ── Crear items de la venta ──────────────────────────────────────────
    for item_data in items_data:
        variant_id = item_data.get("variant_id")
        quantity = item_data.get("quantity", 1)
        unit_price = item_data.get("unit_price", 0)
        discount_pct = item_data.get("discount_pct", 0)

        if not variant_id:
            continue

        item = SaleItem(
            sale_id=sale.id,
            variant_id=int(variant_id),
            quantity=int(quantity),
            unit_price=float(unit_price),
            discount_pct=float(discount_pct) if discount_pct else 0,
        )
        db.add(item)

        # Descontar stock (los handlers de stock se encargan de validar)
        db.execute(
            text("UPDATE product_variants SET stock = stock - :qty WHERE id = :vid"),
            {"qty": int(quantity), "vid": int(variant_id)},
        )

    db.flush()

    result.accion_tomada = "sale_created"

    # ── Encolar para AFIP si es factura fiscal offline ───────────────────
    if is_offline and sale_type in (SaleType.FACTURA_A, SaleType.FACTURA_B):
        _encolar_afip(sale.id, user.company_id, db)
        result.accion_tomada = "sale_created_afip_queued"

    # Emitir alerta si es offline (para que el admin sepa que llegó)
    if is_offline:
        notif = Notification(
            type=NotificationType.INFO,
            status=NotificationStatus.NO_LEIDA,
            title=f"🔄 Venta offline sincronizada — {sale_number}",
            message=(
                f"Venta {sale_number} de {payload.get('customer_name', 'consumidor final')} "
                f"(Local: {local_id or device.local_id or 'sin asignar'}) "
                f"sincronizada desde modo offline. Total: ${payload.get('total', 0)}"
            ),
            to_role="ADMIN",
            company_id=user.company_id,
            related_sync_event_id=sync_event.id,
            device_id=device.id,
        )
        db.add(notif)

    return result


def _encolar_afip(sale_id, company_id: int, db: Session) -> None:
    """Encola una venta para validación AFIP asíncrona (no bloquea el sync)."""
    existing = db.query(AfipQueue).filter(AfipQueue.sale_id == sale_id).first()
    if existing:
        return  # Ya encolada

    try:
        item = AfipQueue(
            sale_id=sale_id,
            company_id=company_id,
            status=AfipQueueStatus.PENDING,
            is_contingency=True,
        )
        db.add(item)
        db.flush()
    except Exception as e:
        # La FK puede fallar si la venta aún no existe en la DB local del servidor
        logger.warning("No se pudo encolar AFIP para sale_id=%s: %s", sale_id, e)


# ══════════════════════════════════════════════════════
# HANDLER: ÓRDENES DE TRABAJO
# ══════════════════════════════════════════════════════

# Estrategias de merge por campo (ref: conflict-resolution.md §3, tabla de campos)
WO_FIELD_STRATEGIES: dict[str, str] = {
    # SERVER_WINS: el servidor siempre tiene la última palabra
    "status":                "SERVER_WINS",
    "fecha_entrega_estimada": "SERVER_WINS",
    "priority":              "SERVER_WINS",
    # LWW: gana el timestamp_local más reciente
    "assigned_mechanic_id":  "LWW",
    "fuel_level":            "LWW",
    "km_in":                 "MANUAL",
    "km_out":                "MANUAL",
    # MERGE_APPEND: ambas versiones se concatenan con separador
    "diagnosis_notes":       "MERGE_APPEND",
    "reception_notes":       "MERGE_APPEND",
    "delivery_notes":        "MERGE_APPEND",
    # MANUAL: si divergen, requieren resolución humana
    "estimated_total":       "MANUAL",
    "final_total":           "MANUAL",
    "discount_pct":          "MANUAL",
}


def handle_work_order(ev, sync_event, device, user, db: Session) -> HandlerResult:
    """
    Handler para actualizaciones de órdenes de trabajo.

    Aplica merge field-level según WO_FIELD_STRATEGIES:
      - SERVER_WINS: ignora el valor del cliente, mantiene el del servidor.
      - LWW: gana el evento con mayor timestamp_local.
      - MERGE_APPEND: concatena ambos valores con separador " | ".
      - MANUAL: si divergen, deja el valor del servidor y crea conflicto MANUAL_PENDING.

    Requiere payload_antes y campos_modificados para hacer merge correcto.
    Sin ellos, trata el UPDATE como stale y crea STALE_UPDATE.

    Ref: conflict-resolution.md §3
    """
    result = HandlerResult(accion_tomada="work_order_applied")

    if ev.event_type not in ("Updated", "UPDATE"):
        return result  # INSERT/DELETE sin merge especial

    if not ev.payload_antes or not ev.campos_modificados:
        # Sin before-state no podemos hacer merge field-level
        # Crear conflicto STALE_UPDATE para resolución manual
        conflict = SyncConflict(
            event_id=sync_event.id,
            conflict_type=ConflictType.STALE_UPDATE,
            aggregate_type=sync_event.aggregate_type,
            aggregate_id=sync_event.aggregate_id,
            description=(
                f"UPDATE de OT {sync_event.aggregate_id} sin payload_antes o campos_modificados. "
                f"No es posible hacer merge field-level. Requiere resolución manual."
            ),
            resolution=ConflictResolution.MANUAL_PENDING,
            company_id=user.company_id,
        )
        db.add(conflict)
        db.flush()
        result.conflicts.append(conflict)
        result.accion_tomada = "work_order_stale_update_manual"
        return result

    # Leer el estado actual del servidor para la OT
    wo_id_str = sync_event.aggregate_id
    try:
        wo_id = int(wo_id_str)
    except (ValueError, TypeError):
        result.warnings.append(f"aggregate_id={wo_id_str!r} no es un entero válido para WorkOrder")
        return result

    wo = db.query(WorkOrder).filter(
        WorkOrder.id == wo_id,
        WorkOrder.company_id == user.company_id,
    ).with_for_update().first()

    if not wo:
        result.warnings.append(f"WorkOrder id={wo_id} no encontrado — aplicando evento genérico")
        return result

    campos = ev.campos_modificados
    payload_nuevo = ev.payload or {}
    payload_antes = ev.payload_antes or {}

    for campo in campos:
        estrategia = WO_FIELD_STRATEGIES.get(campo, "LWW")
        valor_servidor = getattr(wo, campo, None)
        valor_nuevo = payload_nuevo.get(campo)
        valor_antes = payload_antes.get(campo)

        if valor_nuevo is None:
            continue  # El campo no viene en el payload — skip

        if estrategia == "SERVER_WINS":
            # No modificar el servidor. El cliente recibirá el valor del servidor en el pull.
            continue

        elif estrategia == "LWW":
            # Gana el timestamp_local más reciente
            ts_server = _get_wo_last_modified_ts(wo)
            ts_event_str = (ev.metadata or {}).get("timestamp_local", "")
            ts_event = _parse_ts(ts_event_str)
            if ts_event and ts_server and ts_event > ts_server:
                setattr(wo, campo, valor_nuevo)
            # Si el servidor es más nuevo, no hacemos nada

        elif estrategia == "MERGE_APPEND":
            # Concatenar ambos valores (texto)
            if valor_servidor and valor_nuevo and valor_servidor != valor_nuevo:
                # Evitar duplicados si el texto del cliente ya está en el servidor
                if str(valor_nuevo) not in str(valor_servidor):
                    setattr(wo, campo, f"{valor_servidor} | {valor_nuevo}")
            elif not valor_servidor and valor_nuevo:
                setattr(wo, campo, valor_nuevo)

        elif estrategia == "MANUAL":
            # Si el cliente intentó cambiar un valor que ya cambió en el servidor
            if valor_servidor != valor_antes and valor_servidor != valor_nuevo:
                conflict = SyncConflict(
                    event_id=sync_event.id,
                    conflict_type=ConflictType.FIELD_COLLISION,
                    aggregate_type=sync_event.aggregate_type,
                    aggregate_id=sync_event.aggregate_id,
                    description=(
                        f"Campo '{campo}' divergente en OT {wo_id}: "
                        f"servidor={valor_servidor!r}, "
                        f"cliente_antes={valor_antes!r}, "
                        f"cliente_nuevo={valor_nuevo!r}"
                    ),
                    resolution=ConflictResolution.MANUAL_PENDING,
                    resolution_data={
                        "campo": campo,
                        "valor_servidor": str(valor_servidor),
                        "valor_cliente_antes": str(valor_antes),
                        "valor_cliente_nuevo": str(valor_nuevo),
                        "wo_id": wo_id,
                    },
                    company_id=user.company_id,
                )
                db.add(conflict)
                db.flush()
                result.conflicts.append(conflict)
                # El servidor conserva su valor para campos MANUAL divergentes

    db.flush()
    result.accion_tomada = f"work_order_merged ({len(campos)} campos)"
    return result


def _get_wo_last_modified_ts(wo: WorkOrder) -> Optional[datetime]:
    """Retorna el timestamp de última modificación del WorkOrder."""
    return getattr(wo, "updated_at", None) or getattr(wo, "created_at", None)


def _parse_ts(ts_str: str) -> Optional[datetime]:
    """Parsea un string ISO 8601 a datetime. Retorna None si falla."""
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


# ══════════════════════════════════════════════════════
# HANDLER: CLIENTES
# ══════════════════════════════════════════════════════

# Estrategia por tipo de dato del cliente
# Ref: conflict-resolution.md §4
CUSTOMER_MASTER_FIELDS = {"cuit_dni", "customer_type", "tax_condition", "first_name", "last_name", "business_name", "display_name"}
CUSTOMER_CONTACT_FIELDS = {"phone", "phone2", "email", "address", "city", "province", "postal_code", "notes"}
CUSTOMER_COMMERCIAL_FIELDS = {"credit_limit", "payment_terms_days", "discount_pct", "is_active"}  # En CustomerCompany


def handle_customer(ev, sync_event, device, user, db: Session) -> HandlerResult:
    """
    Handler para eventos de clientes.

    Estrategia de merge (ref: conflict-resolution.md §4):
      - Datos maestros (cuit, nombre, tipo): MANUAL si divergen → conflicto FIELD_COLLISION
      - Datos de contacto (email, teléfono): LWW por timestamp_local
      - Datos comerciales (límite crédito, estado): SERVER_WINS siempre

    Requiere payload_antes para detectar divergencias reales.
    Sin payload_antes: si el registro existe en el servidor, crear STALE_UPDATE.
    """
    result = HandlerResult(accion_tomada="customer_applied")

    if ev.event_type not in ("Updated", "UPDATE"):
        return result  # INSERT sin merge especial (nuevos clientes siempre se aceptan)

    payload_nuevo = ev.payload or {}
    payload_antes = ev.payload_antes or {}
    campos = ev.campos_modificados or list(payload_nuevo.keys())

    # Intentar encontrar el cliente en el servidor
    customer_id_str = sync_event.aggregate_id
    try:
        customer_id = int(customer_id_str)
    except (ValueError, TypeError):
        result.warnings.append(f"aggregate_id={customer_id_str!r} no válido para Customer")
        return result

    customer = db.query(Customer).filter(
        Customer.id == customer_id,
    ).with_for_update().first()

    if not customer:
        result.warnings.append(f"Customer id={customer_id} no encontrado — evento ignorado")
        return result

    for campo in campos:
        valor_servidor = getattr(customer, campo, None)
        valor_nuevo = payload_nuevo.get(campo)
        valor_antes = payload_antes.get(campo)

        if valor_nuevo is None:
            continue

        if campo in CUSTOMER_COMMERCIAL_FIELDS:
            # SERVER_WINS: nunca tocar límites de crédito desde el dispositivo
            continue

        elif campo in CUSTOMER_MASTER_FIELDS:
            # MANUAL: si el servidor ya tiene un valor diferente al que el cliente vio antes
            if valor_servidor is not None and valor_antes is not None and str(valor_servidor) != str(valor_antes):
                # Divergencia real: el servidor fue modificado mientras el cliente estaba offline
                conflict = SyncConflict(
                    event_id=sync_event.id,
                    conflict_type=ConflictType.FIELD_COLLISION,
                    aggregate_type=sync_event.aggregate_type,
                    aggregate_id=sync_event.aggregate_id,
                    description=(
                        f"Dato maestro '{campo}' del cliente #{customer_id} diverge: "
                        f"servidor={valor_servidor!r}, "
                        f"cliente_vio={valor_antes!r}, "
                        f"cliente_propone={valor_nuevo!r}"
                    ),
                    resolution=ConflictResolution.MANUAL_PENDING,
                    resolution_data={
                        "campo": campo,
                        "valor_servidor": str(valor_servidor),
                        "valor_cliente_antes": str(valor_antes),
                        "valor_cliente_nuevo": str(valor_nuevo),
                        "customer_id": customer_id,
                    },
                    company_id=user.company_id,
                )
                db.add(conflict)
                db.flush()
                result.conflicts.append(conflict)
                # SERVER_WINS para dato maestro en conflicto

            elif str(valor_servidor) == str(valor_antes) or valor_servidor is None:
                # No divergencia — aplicar el cambio del cliente
                setattr(customer, campo, valor_nuevo)

        elif campo in CUSTOMER_CONTACT_FIELDS:
            # LWW por timestamp_local
            ts_event_str = (ev.metadata or {}).get("timestamp_local", "")
            ts_event = _parse_ts(ts_event_str)
            ts_server = _get_customer_last_modified_ts(customer)
            if ts_event and ts_server and ts_event > ts_server:
                setattr(customer, campo, valor_nuevo)
            elif not ts_server:
                setattr(customer, campo, valor_nuevo)

    db.flush()
    result.accion_tomada = f"customer_merged ({len(campos)} campos)"
    return result


def _get_customer_last_modified_ts(customer: Customer) -> Optional[datetime]:
    return getattr(customer, "updated_at", None) or getattr(customer, "created_at", None)


# ══════════════════════════════════════════════════════
# GAP-7: CAPA DE TRADUCCIÓN DE NOMBRES (Python ↔ SQL)
# ══════════════════════════════════════════════════════
#
# El sistema Python usa nombres en PascalCase/camelCase (EventIn):
#   aggregate_type, event_type, aggregate_id
#
# El schema SQL (002_sync.sql / 004_negocio.sql) usa nombres en español/snake_case:
#   tabla_afectada, operacion, registro_id
#
# Esta capa traduce en ambas direcciones sin renombrar los modelos ORM.
# Ref: docs/sync-api-coverage.md §GAP-7

# Traducción de nombres de campo Python → SQL
FIELD_MAP: dict[str, str] = {
    "aggregate_type":   "tabla_afectada",
    "event_type":       "operacion",
    "aggregate_id":     "registro_id",
    "payload":          "payload_despues",     # payload actual = estado después
    "payload_antes":    "payload_antes",        # mismo nombre en ambos lados
    "campos_modificados": "campos_modificados", # mismo nombre
    "sequence_num":     "numero_secuencia",
    "version_catalogo": "version_catalogo",     # mismo nombre
    "device_id":        "dispositivo_id",
    "company_id":       "empresa_id",
    "user_id":          "usuario_id",
}

# Traducción inversa: SQL → Python
FIELD_MAP_REVERSE: dict[str, str] = {v: k for k, v in FIELD_MAP.items()}

# Traducción de aggregate_type Python → nombre de tabla SQL
AGGREGATE_TYPE_MAP: dict[str, str] = {
    "StockMovement":     "movimientos_stock",
    "stock_movements":   "movimientos_stock",
    "Sale":              "ventas",
    "sales":             "ventas",
    "WorkOrder":         "ordenes_trabajo",
    "work_orders":       "ordenes_trabajo",
    "Customer":          "clientes",
    "customers":         "clientes",
    "Product":           "productos",
    "products":          "productos",
    "ProductVariant":    "variantes_producto",
    "product_variants":  "variantes_producto",
    "Invoice":           "facturas",
    "invoices":          "facturas",
}

# Traducción inversa: tabla SQL → aggregate_type Python
AGGREGATE_TYPE_MAP_REVERSE: dict[str, str] = {v: k for k, v in AGGREGATE_TYPE_MAP.items()}

# Traducción de event_type Python → operacion SQL
EVENT_TYPE_MAP: dict[str, str] = {
    "Created":  "INSERT",
    "Updated":  "UPDATE",
    "Deleted":  "DELETE",
    "Merged":   "MERGE",
    "INSERT":   "INSERT",
    "UPDATE":   "UPDATE",
    "DELETE":   "DELETE",
    "MERGE":    "MERGE",
}


def to_sql_names(aggregate_type: str, event_type: str) -> tuple[str, str]:
    """
    Traduce los nombres Python a nombres SQL del schema 002_sync.sql.
    Útil para almacenar eventos con la convención de nombres del schema SQL.

    Ejemplo:
        to_sql_names("StockMovement", "Created")  → ("movimientos_stock", "INSERT")
        to_sql_names("work_orders", "UPDATE")      → ("ordenes_trabajo", "UPDATE")
    """
    tabla = AGGREGATE_TYPE_MAP.get(aggregate_type, aggregate_type)
    operacion = EVENT_TYPE_MAP.get(event_type, event_type)
    return tabla, operacion


def to_python_names(tabla_afectada: str, operacion: str) -> tuple[str, str]:
    """
    Traduce los nombres SQL a nombres Python para compatibilidad con EventIn.
    Útil al procesar eventos almacenados con convención SQL.

    Ejemplo:
        to_python_names("movimientos_stock", "INSERT") → ("StockMovement", "Created")
        to_python_names("ordenes_trabajo",   "UPDATE") → ("WorkOrder", "Updated")
    """
    aggregate_type = AGGREGATE_TYPE_MAP_REVERSE.get(tabla_afectada, tabla_afectada)
    event_type_map_reverse = {v: k for k, v in EVENT_TYPE_MAP.items() if k not in ("INSERT", "UPDATE", "DELETE", "MERGE")}
    event_type = event_type_map_reverse.get(operacion, operacion)
    return aggregate_type, event_type


def normalize_handler_key(aggregate_type: str, event_type: str) -> tuple[str, str]:
    """
    Normaliza la clave para buscar en HANDLERS.
    Intenta primero la clave exacta, luego la versión SQL normalizada.
    El HANDLERS dict tiene ambas variantes para eficiencia,
    pero esta función permite búsqueda uniforme.
    """
    return (aggregate_type, event_type)


# ══════════════════════════════════════════════════════
# HANDLERS ROUTING TABLE
# ══════════════════════════════════════════════════════
#
# Clave: (aggregate_type, event_type)
# Valor: función handler(ev, sync_event, device, user, db) → HandlerResult
#
# Los event_type que llegan del cliente son los definidos en EventIn.
# Los aggregate_type corresponden a los nombres de tabla/modelo que usa el cliente.
#
# GAP-7: El dict incluye claves en AMBAS convenciones (Python y SQL) para
# que funcione independientemente del naming que use el cliente.
#
# Ref: conflict-resolution.md §6 — HANDLERS routing table

HANDLERS: dict[tuple[str, str], callable] = {
    # Stock movements — detección de sobreventa (GAP-2)
    ("StockMovement", "Created"):       handle_stock_movement,
    ("StockMovement", "INSERT"):        handle_stock_movement,
    ("StockMovement", "StockAdjusted"): handle_stock_movement,
    ("stock_movements", "INSERT"):      handle_stock_movement,
    ("movimientos_stock", "INSERT"):    handle_stock_movement,  # GAP-7: SQL naming

    # Ventas / Facturas — encolar AFIP para contingencia (GAP-5)
    ("Sale", "Created"):                handle_sale,
    ("Sale", "INSERT"):                 handle_sale,
    ("sales", "INSERT"):                handle_sale,
    ("ventas", "INSERT"):               handle_sale,            # GAP-7: SQL naming

    # Órdenes de trabajo — merge por campo (GAP-5)
    ("WorkOrder", "Updated"):           handle_work_order,
    ("WorkOrder", "UPDATE"):            handle_work_order,
    ("work_orders", "UPDATE"):          handle_work_order,
    ("ordenes_trabajo", "UPDATE"):      handle_work_order,      # GAP-7: SQL naming

    # Clientes — merge master vs contact vs commercial (GAP-5)
    ("Customer", "Updated"):            handle_customer,
    ("Customer", "UPDATE"):             handle_customer,
    ("customers", "UPDATE"):            handle_customer,
    ("clientes", "UPDATE"):             handle_customer,        # GAP-7: SQL naming
}
