"""
Tests mínimos de integración — corren contra el backend levantado en :8000.

Ejecutar:
    cd erp/backend
    .\venv\Scripts\pytest tests_minimal.py -v
"""
import urllib.request
import json
import pytest

BASE = "http://localhost:8000/api/v1"
ADMIN_USER = "admin"
ADMIN_PASS = "MundoAdmin2026!"


# ── Helpers ────────────────────────────────────────────────────────────────

def _request(method: str, path: str, data=None, token: str | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(
        BASE + path, data=body, headers=headers, method=method
    )
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


@pytest.fixture(scope="session")
def token():
    status, body = _request("POST", "/auth/login", {"username": ADMIN_USER, "password": ADMIN_PASS})
    assert status == 200, f"Login failed: {body}"
    return body["access_token"]


# ── Tests ──────────────────────────────────────────────────────────────────

def test_health_no_auth():
    """GET /health responde 200 sin autenticación."""
    status, body = _request("GET", "/health")
    assert status == 200
    assert body["status"] == "ok"
    assert "server_time" in body
    assert "version" in body


def test_login():
    """POST /auth/login devuelve token."""
    status, body = _request("POST", "/auth/login", {"username": ADMIN_USER, "password": ADMIN_PASS})
    assert status == 200
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_me(token):
    """GET /auth/me devuelve usuario autenticado."""
    status, body = _request("GET", "/auth/me", token=token)
    assert status == 200
    assert body["username"] == ADMIN_USER


def test_products_list(token):
    """GET /products/ devuelve respuesta paginada con campo items o total."""
    status, body = _request("GET", "/products/?page=1&page_size=5", token=token)
    assert status == 200
    assert isinstance(body, (list, dict))
    if isinstance(body, dict):
        assert "items" in body or "total" in body


def test_stock_list(token):
    """GET /stock devuelve inventario."""
    status, body = _request("GET", "/stock?page=1&page_size=5", token=token)
    assert status == 200


def test_notifications_list(token):
    """GET /notifications/ devuelve lista."""
    status, body = _request("GET", "/notifications/", token=token)
    assert status == 200
    assert isinstance(body, list)


def test_sync_bootstrap(token):
    """GET /sync/bootstrap devuelve estructura completa."""
    status, body = _request(
        "GET", "/sync/bootstrap?empresa_id=3&dispositivo_id=test-pytest", token=token
    )
    assert status == 200
    assert "productos" in body
    assert "clientes" in body
    assert "config" in body
    assert "timestamp_servidor" in body
    assert isinstance(body["total_productos"], int)


def test_sync_delta(token):
    """GET /sync/delta devuelve cambios incrementales."""
    status, body = _request(
        "GET", "/sync/delta?dispositivo_id=test-pytest&desde=2020-01-01T00:00:00", token=token
    )
    assert status == 200
    assert "productos_modificados" in body
    assert "clientes_modificados" in body
    assert "timestamp_servidor" in body
    assert isinstance(body.get("truncated"), bool)


def test_sync_criticos_unregistered_device(token):
    """GET /sync/criticos con dispositivo no registrado devuelve 404."""
    status, body = _request(
        "GET", "/sync/criticos?dispositivo_id=device-does-not-exist-xyz", token=token
    )
    assert status == 404


def test_sync_push_unregistered_device(token):
    """POST /sync/events con dispositivo no registrado devuelve 404."""
    payload = {
        "device_id": "device-does-not-exist-xyz",
        "events": [{
            "event_id": "pytest-evt-001",
            "aggregate_type": "Customer",
            "aggregate_id": "1",
            "event_type": "Updated",
            "payload": {"display_name": "Test"},
            "sequence_num": 1,
            "version_catalogo": 0,
        }]
    }
    status, body = _request("POST", "/sync/events", payload, token=token)
    assert status == 404


def test_system_metrics(token):
    """GET /system/metrics devuelve métricas del sistema."""
    status, body = _request("GET", "/system/metrics", token=token)
    assert status == 200
    assert "system" in body
    assert "database" in body
    assert "status" in body["database"]  # ok or error (pg_stat_statements optional)
