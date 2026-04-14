"""
Router de monitoreo del sistema — métricas, salud, diagnóstico
Solo accesible para SUPERADMIN y ADMIN
"""

import os
import time
import datetime
import platform
import hashlib
import psutil
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.purchase_invoice import PurchaseInvoice, IngresoStatus
from app.models.payment import PaymentVoucher, PaymentStatus
from app.api.deps import get_current_user, require_roles
from app.core.metrics import get_metrics_snapshot

router = APIRouter(prefix="/system", tags=["Sistema"])

# App version for auto-update (bump on each release)
APP_VERSION = "1.0.0"

# Path al index.html del frontend buildeado
_FRONTEND_INDEX = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../../../frontend/dist/index.html")
)

def _get_build_hash() -> str:
    """Devuelve un hash MD5 corto del index.html actual. Cambia con cada build."""
    try:
        with open(_FRONTEND_INDEX, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()[:12]
    except Exception:
        return "unknown"


@router.get("/sidebar-counts")
def sidebar_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Contadores rápidos para badges en la sidebar.
    
    response_cache: target < 50ms — uses only COUNT(*) queries, never loads objects.
    """
    company_id = current_user.company_id if current_user.role != UserRole.SUPERADMIN else None
    co = [PurchaseOrder.company_id == company_id] if company_id else []
    ci = [PurchaseInvoice.company_id == company_id] if company_id else []

    pedidos_pendientes = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.status.in_([PurchaseOrderStatus.BORRADOR, PurchaseOrderStatus.ENVIADO]), *co)
        .scalar() or 0
    )

    ingresos_pendientes = (
        db.query(func.count(PurchaseInvoice.id))
        .filter(PurchaseInvoice.ingreso_status == IngresoStatus.PENDIENTE, *ci)
        .scalar() or 0
    )

    recepcion_pendiente = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.status == PurchaseOrderStatus.ENVIADO, *co)
        .scalar() or 0
    )

    try:
        cp = [PaymentVoucher.company_id == company_id] if company_id else []
        pagos_pendientes = (
            db.query(func.count(PaymentVoucher.id))
            .filter(PaymentVoucher.status.in_([PaymentStatus.POR_PAGAR, PaymentStatus.VENCIDO]), *cp)
            .scalar() or 0
        )
    except Exception:
        pagos_pendientes = 0

    facturas_sin_rv = (
        db.query(func.count(PurchaseInvoice.id))
        .filter(PurchaseInvoice.remito_venta_number == None, *ci)
        .scalar() or 0
    )

    # Alertas reposición: ENVIADO orders older than 10 days with no invoices
    ten_days_ago = datetime.date.today() - datetime.timedelta(days=10)
    alertas_sub = (
        db.query(PurchaseOrder.id)
        .outerjoin(PurchaseInvoice, PurchaseInvoice.purchase_order_id == PurchaseOrder.id)
        .filter(
            PurchaseOrder.status == PurchaseOrderStatus.ENVIADO,
            PurchaseOrder.date <= ten_days_ago,
            *co,
        )
        .group_by(PurchaseOrder.id)
        .having(func.count(PurchaseInvoice.id) == 0)
    )
    alertas_reposicion = alertas_sub.count()

    return {
        "pedidos_pendientes": pedidos_pendientes,
        "ingresos_pendientes": ingresos_pendientes,
        "recepcion_pendiente": recepcion_pendiente,
        "pagos_pendientes": pagos_pendientes,
        "facturas_sin_rv": facturas_sin_rv,
        "alertas_reposicion": alertas_reposicion,
    }


@router.get("/health")
def health_check():
    """Chequeo básico — no requiere auth"""
    return {"status": "ok", "ts": time.time()}


@router.get("/metrics")
def system_metrics(
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Métricas completas del sistema — CPU, RAM, disco, DB, API"""

    # ── Sistema operativo ────────────────────────────
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count()
    mem = psutil.virtual_memory()
    # Use the drive where the ERP data lives; fall back to C:\ if not found
    _disk_path = "D:\\" if os.path.exists("D:\\") else "C:\\"
    disk = psutil.disk_usage(_disk_path)
    boot_time = psutil.boot_time()
    uptime_hours = round((time.time() - boot_time) / 3600, 1)

    # ── GPU ─────────────────────────────────────────
    gpu_info = _get_gpu_metrics()

    # ── Base de datos ────────────────────────────────
    db_stats = _check_database(db)

    # ── Métricas de la API ───────────────────────────
    api_metrics = get_metrics_snapshot()

    # ── Diagnóstico automático ───────────────────────
    alerts = []

    if cpu_percent > 80:
        alerts.append({
            "level": "critical",
            "signal": f"CPU al {cpu_percent}%",
            "action": "Agregar más workers o más cores al VPS",
        })
    elif cpu_percent > 60:
        alerts.append({
            "level": "warning",
            "signal": f"CPU al {cpu_percent}%",
            "action": "Monitorear — si se mantiene, considerar escalar",
        })

    if mem.percent > 90:
        alerts.append({
            "level": "critical",
            "signal": f"RAM al {mem.percent}%",
            "action": "Subir plan del VPS (toma minutos en Hetzner)",
        })
    elif mem.percent > 75:
        alerts.append({
            "level": "warning",
            "signal": f"RAM al {mem.percent}%",
            "action": "Monitorear uso — puede necesitar más RAM pronto",
        })

    if disk.percent > 90:
        alerts.append({
            "level": "critical",
            "signal": f"Disco al {disk.percent}%",
            "action": "Limpiar logs o ampliar disco",
        })

    if api_metrics["avg_response_ms"] > 500:
        alerts.append({
            "level": "critical",
            "signal": f"Respuesta promedio: {api_metrics['avg_response_ms']}ms",
            "action": "Endpoints lentos — revisar queries o separar DB",
        })
    elif api_metrics["p95_ms"] > 500:
        alerts.append({
            "level": "warning",
            "signal": f"P95 respuesta: {api_metrics['p95_ms']}ms",
            "action": "Algunos endpoints lentos — optimizar top queries",
        })

    if db_stats.get("slow_query_ms", 0) > 1000:
        alerts.append({
            "level": "critical",
            "signal": f"Query de DB tardó {db_stats['slow_query_ms']}ms",
            "action": "Agregar réplica de lectura o optimizar queries",
        })

    if db_stats.get("active_connections", 0) > 80:
        alerts.append({
            "level": "warning",
            "signal": f"{db_stats['active_connections']} conexiones activas a la DB",
            "action": "Considerar PgBouncer para pool de conexiones",
        })

    if not alerts:
        alerts.append({
            "level": "ok",
            "signal": "Todo funcionando dentro de parámetros normales",
            "action": "Sin acción requerida",
        })

    # ── Recomendación de escala ──────────────────────
    scale_recommendation = _get_scale_recommendation(
        cpu_percent, mem.percent, db_stats.get("active_connections", 0),
        api_metrics["avg_response_ms"]
    )

    return {
        "system": {
            "os": platform.system(),
            "os_version": platform.version(),
            "hostname": platform.node(),
            "cpu_count": cpu_count,
            "cpu_percent": cpu_percent,
            "ram_total_gb": round(mem.total / (1024**3), 1),
            "ram_used_gb": round(mem.used / (1024**3), 1),
            "ram_percent": mem.percent,
            "disk_total_gb": round(disk.total / (1024**3), 1),
            "disk_used_gb": round(disk.used / (1024**3), 1),
            "disk_percent": disk.percent,
            "uptime_hours": uptime_hours,
        },
        "gpu": gpu_info,
        "database": db_stats,
        "api": api_metrics,
        "alerts": alerts,
        "scale_recommendation": scale_recommendation,
    }


def _get_gpu_metrics() -> dict:
    """Métricas de GPU via nvidia-smi. Devuelve available=False si no hay GPU Nvidia."""
    import subprocess
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if result.returncode == 0:
            gpus = []
            for line in result.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 5:
                    gpus.append({
                        "name": parts[0],
                        "utilization_pct": float(parts[1]),
                        "memory_used_mb": float(parts[2]),
                        "memory_total_mb": float(parts[3]),
                        "temperature_c": float(parts[4]),
                        "memory_pct": round(float(parts[2]) / float(parts[3]) * 100, 1) if float(parts[3]) > 0 else 0,
                    })
            if gpus:
                return {"available": True, "gpus": gpus}
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    return {"available": False}


def _check_database(db: Session) -> dict:
    """Chequeo de salud de PostgreSQL"""
    try:
        # Latencia de la DB
        start = time.perf_counter()
        db.execute(text("SELECT 1"))
        ping_ms = round((time.perf_counter() - start) * 1000, 1)

        # Conexiones activas
        result = db.execute(text(
            "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
        ))
        active_connections = result.scalar() or 0

        # Total conexiones
        result = db.execute(text("SELECT count(*) FROM pg_stat_activity"))
        total_connections = result.scalar() or 0

        # Tamaño de la base
        result = db.execute(text(
            "SELECT pg_size_pretty(pg_database_size(current_database()))"
        ))
        db_size = result.scalar() or "?"

        # Queries más lentas (si pg_stat_statements está habilitado)
        slow_query_ms = 0
        try:
            result = db.execute(text(
                "SELECT max(mean_exec_time) FROM pg_stat_statements WHERE calls > 1"
            ))
            val = result.scalar()
            if val:
                slow_query_ms = round(float(val), 1)
        except Exception:
            db.rollback()  # pg_stat_statements not enabled — reset TX so next query works

        # Cache hit ratio
        result = db.execute(text("""
            SELECT
                CASE WHEN blks_hit + blks_read = 0 THEN 100
                ELSE round(100.0 * blks_hit / (blks_hit + blks_read), 2)
                END as hit_ratio
            FROM pg_stat_database
            WHERE datname = current_database()
        """))
        cache_hit_ratio = float(result.scalar() or 0)

        return {
            "status": "ok",
            "ping_ms": ping_ms,
            "active_connections": active_connections,
            "total_connections": total_connections,
            "db_size": db_size,
            "cache_hit_ratio": cache_hit_ratio,
            "slow_query_ms": slow_query_ms,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def _get_scale_recommendation(cpu: float, ram: float, connections: int, avg_ms: float) -> dict:
    """Recomendación automática basada en métricas"""
    if cpu > 80 or ram > 90 or avg_ms > 500:
        if connections > 200:
            return {
                "current_tier": 4,
                "label": "Arquitectura distribuida",
                "description": "300-500+ usuarios — Separar DB, load balancer, múltiples APIs",
                "cost": "$350-500/mes",
                "urgency": "alta",
            }
        else:
            return {
                "current_tier": 2,
                "label": "Crecimiento — VPS más grande",
                "description": "50-200 usuarios — Más cores/RAM + PgBouncer",
                "cost": "$120-180/mes",
                "urgency": "media",
            }
    elif cpu > 60 or ram > 75 or avg_ms > 300:
        return {
            "current_tier": 1,
            "label": "Arranque — cerca del límite",
            "description": "Monitorear de cerca. Si se mantiene, pasar al siguiente tier.",
            "cost": "$30-65/mes",
            "urgency": "baja",
        }
    else:
        return {
            "current_tier": 1,
            "label": "Arranque — sin problemas",
            "description": "1-50 usuarios — Todo funciona bien en el servidor actual",
            "cost": "$30-65/mes",
            "urgency": "ninguna",
        }


# ── Auto-update endpoints ────────────────────────────────────


@router.get("/version")
def get_app_version():
    """Version check for auto-update — no auth required"""
    # Lee el hash en cada request — sin caché de módulo — funciona sin reiniciar
    import hashlib as _hashlib
    import os as _os
    try:
        _idx = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "../../../../frontend/dist/index.html"))
        with open(_idx, "rb") as _f:
            _build_hash = _hashlib.md5(_f.read()).hexdigest()[:12]
    except Exception:
        _build_hash = "unknown"
    return {
        "version": APP_VERSION,
        "build_hash": _build_hash,
        "mandatory": False,
        "changelog": "Versión inicial con auto-actualización",
        "released_at": "2026-04-10",
    }


@router.get("/download/{filename}")
def download_update(filename: str):
    """Download update ZIP — only serves from DISTRIBUIBLES folder"""
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files allowed")

    # system.py → v1/ → api/ → app/ → backend/ → erp/ → ERP MUNDO OUTDOOR/
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))
    dist_dir = os.path.join(base, "DISTRIBUIBLES")
    filepath = os.path.join(dist_dir, filename)

    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(filepath, media_type="application/zip", filename=filename)


