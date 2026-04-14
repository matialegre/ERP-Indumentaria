// URL dinámica: funciona en localhost, LAN, internet, Capacitor (Android/tablet)
// y cuando el frontend se sirve desde el mismo puerto 8000 del backend.
// En modo offline (servidor local 8001), usa erp_server_url de localStorage.
const _isCapacitor = window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost' && !window.location.port;
const _SERVER_IP = '190.211.201.217'; // IP pública del servidor ERP
const _port = window.location.port;
let API_BASE;
if (_isCapacitor) {
  // Android/tablet: assets cargados localmente, API remota
  API_BASE = `http://${_SERVER_IP}:8000/api/v1`;
} else if (_port === '8001') {
  // Modo offline: Electron sirvió el frontend localmente desde el puerto 8001.
  // La URL real del servidor está guardada en localStorage por el main.js.
  const _override = localStorage.getItem('erp_server_url');
  API_BASE = _override ? `${_override}/api/v1` : `http://${_SERVER_IP}:8000/api/v1`;
} else {
  const _apiPort = (_port === "5174" || _port === "5173") ? "8000" : _port || "8000";
  API_BASE = `${window.location.protocol}//${window.location.hostname}:${_apiPort}/api/v1`;
}
const TIMEOUT_MS = 30000; // 30 segundos — consultas pesadas (comisiones, reportes) necesitan más tiempo

// User-friendly error messages by HTTP status
const STATUS_MESSAGES = {
  400: 'Datos inválidos en la solicitud',
  403: 'No tenés permisos para esta acción',
  404: 'Recurso no encontrado',
  409: 'Conflicto: el recurso ya existe o fue modificado',
  422: 'Datos incompletos o con formato incorrecto',
  429: 'Demasiadas solicitudes, esperá un momento',
  500: 'Error interno del servidor',
  502: 'El servidor no está disponible',
  503: 'Servicio temporalmente no disponible',
};

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const timeout = options.timeout || TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      const err = new Error("Sesión expirada — iniciá sesión de nuevo");
      err.status = 401;
      throw err;
    }

    if (res.status === 403) {
      const body = await res.json().catch(() => null);
      const detail = typeof body?.detail === 'string' ? body.detail : '';
      if (detail.startsWith('LICENCIA_SUSPENDIDA') || detail.startsWith('LICENCIA_CANCELADA')) {
        localStorage.removeItem("token");
        const msg = detail.startsWith('LICENCIA_SUSPENDIDA')
          ? 'licencia_suspendida'
          : 'licencia_cancelada';
        window.location.href = `/login?blocked=${msg}`;
        const err = new Error(detail);
        err.status = 403;
        throw err;
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = body?.detail;
      const fallback = STATUS_MESSAGES[res.status] || `Error ${res.status}`;
      const message = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ')
        : fallback;
      const err = new Error(message);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      const e = new Error("Sin respuesta del servidor (timeout)");
      e.status = 0;
      throw e;
    }
    if (err.message === "Failed to fetch" || err.name === "TypeError") {
      const e = new Error("Sin conexión al servidor — verificá tu red");
      e.status = 0;
      e.offline = true;
      throw e;
    }
    throw err;
  }
}

export const api = {
  get: (url) => request(url),
  post: (url, data) => request(url, { method: "POST", body: JSON.stringify(data) }),
  put: (url, data) => request(url, { method: "PUT", body: JSON.stringify(data) }),
  patch: (url, data) => request(url, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: (url) => request(url, { method: "DELETE" }),
  uploadFile: (url, formData) => {
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      if (res.status === 401) { localStorage.removeItem("token"); window.location.href = "/login"; throw new Error("No autorizado"); }
      if (!res.ok) { const err = await res.json().catch(() => ({ detail: "Error del servidor" })); throw new Error(err.detail || `Error ${res.status}`); }
      return res.json();
    });
  },
  postForm: (url, formData) => {
    const token = localStorage.getItem("token");
    return fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    }).then(async (res) => {
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        const err = new Error("Sesión expirada — iniciá sesión de nuevo");
        err.status = 401;
        throw err;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.detail;
        const fallback = STATUS_MESSAGES[res.status] || `Error ${res.status}`;
        const message = typeof detail === 'string' ? detail
          : Array.isArray(detail) ? detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ')
          : fallback;
        const err = new Error(message);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return res.json();
    });
  },
};

// ── Listener para Background Sync desde Service Worker ──
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "FLUSH_PENDING_OPS") {
      // Dynamic import to avoid circular dependency
      import("./offlineSync.js").then(({ flushPendingOps }) => {
        flushPendingOps().catch(() => {});
      });
    }
  });
}
