"""
Middleware de métricas — trackea tiempos de respuesta y requests
Almacena en memoria (sin Redis) con ventana de 5 minutos.
"""

import time
from collections import deque
from threading import Lock
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# ── Almacén de métricas en memoria ────────────────────
_lock = Lock()
_request_times: deque = deque(maxlen=10_000)  # últimas 10k requests
_slow_queries: deque = deque(maxlen=100)       # queries > 1s
_active_requests = 0

# Umbrales configurables
SLOW_REQUEST_MS = 500
SLOW_QUERY_MS = 1000
WINDOW_SECONDS = 300  # 5 minutos


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        global _active_requests

        start = time.perf_counter()
        with _lock:
            _active_requests += 1

        try:
            response = await call_next(request)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            with _lock:
                _active_requests -= 1
                _request_times.append({
                    "ts": time.time(),
                    "path": request.url.path,
                    "method": request.method,
                    "status": response.status_code if 'response' in dir() else 500,
                    "duration_ms": round(duration_ms, 1),
                })

        return response


def record_slow_query(query: str, duration_ms: float):
    """Llamar desde el DB layer cuando una query es lenta"""
    with _lock:
        _slow_queries.append({
            "ts": time.time(),
            "query": query[:200],
            "duration_ms": round(duration_ms, 1),
        })


def get_metrics_snapshot() -> dict:
    """Snapshot de las métricas actuales"""
    now = time.time()
    cutoff = now - WINDOW_SECONDS

    with _lock:
        recent = [r for r in _request_times if r["ts"] > cutoff]
        slow_queries = list(_slow_queries)
        active = _active_requests

    if not recent:
        return {
            "window_seconds": WINDOW_SECONDS,
            "total_requests": 0,
            "active_requests": active,
            "avg_response_ms": 0,
            "p50_ms": 0,
            "p95_ms": 0,
            "p99_ms": 0,
            "max_ms": 0,
            "slow_requests": 0,
            "error_count": 0,
            "requests_per_second": 0,
            "by_endpoint": [],
            "slow_queries": [],
        }

    durations = sorted([r["duration_ms"] for r in recent])
    total = len(durations)
    errors = sum(1 for r in recent if r["status"] >= 500)
    slow = sum(1 for d in durations if d > SLOW_REQUEST_MS)

    # Top endpoints por tiempo
    endpoint_stats = {}
    for r in recent:
        key = f"{r['method']} {r['path']}"
        if key not in endpoint_stats:
            endpoint_stats[key] = {"count": 0, "total_ms": 0, "max_ms": 0}
        endpoint_stats[key]["count"] += 1
        endpoint_stats[key]["total_ms"] += r["duration_ms"]
        endpoint_stats[key]["max_ms"] = max(endpoint_stats[key]["max_ms"], r["duration_ms"])

    by_endpoint = sorted(
        [
            {
                "endpoint": k,
                "count": v["count"],
                "avg_ms": round(v["total_ms"] / v["count"], 1),
                "max_ms": round(v["max_ms"], 1),
            }
            for k, v in endpoint_stats.items()
        ],
        key=lambda x: x["avg_ms"],
        reverse=True,
    )[:15]

    return {
        "window_seconds": WINDOW_SECONDS,
        "total_requests": total,
        "active_requests": active,
        "avg_response_ms": round(sum(durations) / total, 1),
        "p50_ms": round(durations[int(total * 0.5)], 1),
        "p95_ms": round(durations[int(total * 0.95)], 1),
        "p99_ms": round(durations[min(int(total * 0.99), total - 1)], 1),
        "max_ms": round(durations[-1], 1),
        "slow_requests": slow,
        "error_count": errors,
        "requests_per_second": round(total / WINDOW_SECONDS, 2),
        "by_endpoint": by_endpoint,
        "slow_queries": slow_queries[-10:],
    }
