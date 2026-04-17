"""
sync_agent.py — Agente de sincronización servidor local ↔ servidor central

Corre en el servidor local de cada sucursal (PC dedicada o Raspberry Pi).
Cada 60 segundos sincroniza con el servidor central:
  1. PULL: baja delta del central y lo aplica a la DB local
  2. PUSH: sube eventos locales pendientes al central

Uso:
    python sync_agent.py [--interval 60]

Como servicio de Windows:
    python sync_agent.py install
    net start ERPSyncAgent

Variables de entorno necesarias:
    CENTRAL_URL     URL del servidor central (default: http://190.211.201.217:8000)
    CENTRAL_USER    Usuario de servicio para autenticarse (default: sync_agent@mundooutdoor.com)
    CENTRAL_PASS    Contraseña del usuario de servicio
    DEVICE_ID       UUID del dispositivo registrado en el central (obtenido en primer run)
    DATABASE_URL    URL de la DB local PostgreSQL
"""

import sys
import os
import time
import json
import logging
import argparse
import requests
from datetime import datetime, timezone
from pathlib import Path

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sync_agent.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("sync_agent")

# ─── Config ───────────────────────────────────────────────────────────────────

STATE_FILE = Path("sync_agent_state.json")

CENTRAL_URL = os.getenv("CENTRAL_URL", "http://190.211.201.217:8000")
CENTRAL_USER = os.getenv("CENTRAL_USER", "sync_agent@mundooutdoor.com")
CENTRAL_PASS = os.getenv("CENTRAL_PASS", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
DEVICE_ID = os.getenv("DEVICE_ID", "")


def load_state() -> dict:
    """Carga el estado persistente del agente (último seq sincronizado, token, etc.)."""
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")


# ─── Auth ─────────────────────────────────────────────────────────────────────

_token: str | None = None
_token_expiry: float = 0


def get_token() -> str:
    """Obtiene un JWT del servidor central, renovando si es necesario."""
    global _token, _token_expiry

    if _token and time.time() < _token_expiry:
        return _token

    if not CENTRAL_PASS:
        raise RuntimeError("CENTRAL_PASS no configurada — necesaria para autenticarse")

    log.info("Autenticando contra el central...")
    resp = requests.post(
        f"{CENTRAL_URL}/api/v1/auth/login",
        data={"username": CENTRAL_USER, "password": CENTRAL_PASS},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    _token = data["access_token"]
    _token_expiry = time.time() + 25 * 60  # renovar 5 min antes de que expire (30 min)
    log.info("Autenticación exitosa")
    return _token


def auth_headers() -> dict:
    return {"Authorization": f"Bearer {get_token()}"}


# ─── Pull (central → local) ───────────────────────────────────────────────────

def pull_delta(state: dict) -> dict:
    """
    Baja el delta del central desde `last_central_seq`.
    Aplica los cambios a la DB local.
    Retorna el state actualizado.
    """
    since_seq = state.get("last_central_seq", 0)
    log.info(f"Pulling delta desde seq={since_seq}...")

    try:
        resp = requests.get(
            f"{CENTRAL_URL}/api/v1/sync/delta",
            params={"since_seq": since_seq},
            headers=auth_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        delta = resp.json()
    except requests.exceptions.ConnectionError:
        log.warning("Sin conexión al central — saltando pull")
        return state
    except Exception as e:
        log.error(f"Error en pull: {e}")
        return state

    # Extraer entidades del delta
    products = delta.get("productos_modificados", [])
    clients = delta.get("clientes_modificados", [])
    prices = delta.get("precios_modificados", [])
    sales = delta.get("ventas_modificadas", [])
    providers = delta.get("proveedores_modificados", [])
    stock = delta.get("stock", [])
    locals_data = delta.get("locales", [])
    server_seq = delta.get("server_sequence", since_seq)

    log.info(
        f"Delta recibido: {len(products)} productos, {len(clients)} clientes, "
        f"{len(sales)} ventas, {len(stock)} stock, {len(providers)} proveedores"
    )

    # Aplicar a DB local
    if DATABASE_URL:
        _apply_delta_to_local_db(
            products, clients, prices, sales, providers, stock, locals_data
        )
    else:
        log.warning("DATABASE_URL no configurada — delta recibido pero no aplicado a DB local")

    state["last_central_seq"] = server_seq
    state["last_pull_at"] = datetime.now(timezone.utc).isoformat()
    return state


def _apply_delta_to_local_db(
    products, clients, prices, sales, providers, stock, locals_data
) -> None:
    """Aplica el delta recibido a la base de datos local usando SQLAlchemy."""
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        Session = sessionmaker(bind=engine)
        with Session() as db:
            # Upsert productos (product_variants)
            for item in stock:
                db.execute(
                    text("""
                        INSERT INTO product_variants (id, stock, updated_at)
                        VALUES (:id, :stock, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            stock = EXCLUDED.stock,
                            updated_at = NOW()
                    """),
                    {"id": item["variant_id"], "stock": item.get("stock", 0)},
                )

            # Upsert clientes
            for c in clients:
                db.execute(
                    text("""
                        INSERT INTO customers (id, display_name, email, phone, cuit_dni, company_id, updated_at)
                        VALUES (:id, :name, :email, :phone, :cuit, :cid, NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            display_name = EXCLUDED.display_name,
                            email = EXCLUDED.email,
                            phone = EXCLUDED.phone,
                            updated_at = NOW()
                    """),
                    {
                        "id": c["id"], "name": c.get("display_name", ""),
                        "email": c.get("email"), "phone": c.get("phone"),
                        "cuit": c.get("cuit_dni"), "cid": c.get("company_id"),
                    },
                )

            db.commit()
            log.info("Delta aplicado a DB local exitosamente")
    except Exception as e:
        log.error(f"Error aplicando delta a DB local: {e}")


# ─── Push (local → central) ───────────────────────────────────────────────────

def push_pending_events(state: dict) -> dict:
    """
    Lee eventos locales con status=PENDING (no sincronizados con el central)
    y los empuja al central.
    """
    if not DATABASE_URL:
        log.warning("DATABASE_URL no configurada — saltando push")
        return state

    device_id = state.get("device_id") or DEVICE_ID
    if not device_id:
        log.warning("DEVICE_ID no configurado — saltando push (registrar dispositivo primero)")
        return state

    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        Session = sessionmaker(bind=engine)
        with Session() as db:
            rows = db.execute(
                text("""
                    SELECT id, aggregate_type, aggregate_id, event_type, payload, created_at
                    FROM sync_events
                    WHERE is_synced_to_central = false OR is_synced_to_central IS NULL
                    ORDER BY server_sequence ASC
                    LIMIT 100
                """)
            ).fetchall()

            if not rows:
                return state

            log.info(f"Pushing {len(rows)} eventos pendientes al central...")
            events = [
                {
                    "event_id": str(row.id),
                    "aggregate_type": row.aggregate_type,
                    "aggregate_id": str(row.aggregate_id) if row.aggregate_id else None,
                    "event_type": row.event_type,
                    "payload": row.payload if isinstance(row.payload, dict) else {},
                    "client_ts": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]

            try:
                resp = requests.post(
                    f"{CENTRAL_URL}/api/v1/sync/events",
                    json={"device_id": device_id, "events": events},
                    headers=auth_headers(),
                    timeout=30,
                )
                resp.raise_for_status()
                result = resp.json()
                log.info(f"Push result: processed={result.get('processed')}, conflicts={len(result.get('conflicts', []))}")

                # Marcar como sincronizados
                event_ids = [str(r.id) for r in rows]
                db.execute(
                    text("""
                        UPDATE sync_events
                        SET is_synced_to_central = true, synced_at = NOW()
                        WHERE id = ANY(:ids)
                    """),
                    {"ids": event_ids},
                )
                db.commit()

                state["last_push_at"] = datetime.now(timezone.utc).isoformat()
                state["last_push_processed"] = result.get("processed", 0)
            except requests.exceptions.ConnectionError:
                log.warning("Sin conexión al central — push diferido")

    except Exception as e:
        log.error(f"Error en push: {e}")

    return state


# ─── Device Registration ───────────────────────────────────────────────────────

def ensure_device_registered(state: dict) -> dict:
    """Registra este servidor local como dispositivo en el central si aún no tiene ID."""
    if state.get("device_id"):
        return state

    import platform
    log.info("Registrando servidor local como dispositivo en el central...")
    try:
        resp = requests.post(
            f"{CENTRAL_URL}/api/v1/sync/register-device",
            json={
                "device_fingerprint": _get_server_fingerprint(),
                "platform": f"local-server/{platform.node()}",
                "user_agent": f"sync_agent/1.0 Python/{sys.version.split()[0]}",
            },
            headers=auth_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        device_id = data.get("device_id")
        if device_id:
            state["device_id"] = device_id
            log.info(f"Dispositivo registrado: device_id={device_id}")
        else:
            log.warning(f"Respuesta inesperada del registro: {data}")
    except Exception as e:
        log.error(f"No se pudo registrar el dispositivo: {e}")

    return state


def _get_server_fingerprint() -> str:
    """Genera un fingerprint estable para este servidor."""
    import hashlib
    import platform
    state = load_state()
    if state.get("server_fingerprint"):
        return state["server_fingerprint"]
    raw = f"{platform.node()}-{platform.machine()}-{os.getcwd()}"
    fp = "SRV-" + hashlib.sha256(raw.encode()).hexdigest()[:32].upper()
    state["server_fingerprint"] = fp
    save_state(state)
    return fp


# ─── Main loop ────────────────────────────────────────────────────────────────

def run_sync_cycle(state: dict) -> dict:
    """Ejecuta un ciclo completo de sync: pull → push."""
    log.info("─" * 60)
    log.info("Iniciando ciclo de sync...")

    state = ensure_device_registered(state)
    state = pull_delta(state)
    state = push_pending_events(state)
    state["last_cycle_at"] = datetime.now(timezone.utc).isoformat()

    save_state(state)
    return state


def main():
    parser = argparse.ArgumentParser(description="ERP Mundo Outdoor — Sync Agent")
    parser.add_argument("--interval", type=int, default=60, help="Segundos entre ciclos (default: 60)")
    parser.add_argument("--once", action="store_true", help="Ejecutar un solo ciclo y salir")
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("ERP Mundo Outdoor — Sync Agent v1.0")
    log.info(f"Central URL: {CENTRAL_URL}")
    log.info(f"Interval: {args.interval}s")
    log.info("=" * 60)

    if not CENTRAL_PASS and not os.getenv("CENTRAL_PASS"):
        log.error("CENTRAL_PASS no configurada. Configurar variable de entorno antes de iniciar.")
        sys.exit(1)

    state = load_state()

    if args.once:
        run_sync_cycle(state)
        return

    while True:
        try:
            state = run_sync_cycle(state)
        except KeyboardInterrupt:
            log.info("Agente detenido por el usuario")
            break
        except Exception as e:
            log.error(f"Error inesperado en ciclo: {e}", exc_info=True)

        log.info(f"Próximo ciclo en {args.interval}s...")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
