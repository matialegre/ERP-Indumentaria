/**
 * offlineSync.js — Motor de sincronización offline ↔ servidor
 *
 * Responsabilidades:
 *   1. Descargar catálogos (productos, stock, proveedores, locales) al IndexedDB
 *   2. Enviar operaciones pendientes al servidor cuando vuelve internet
 *   3. Detectar estado de conexión en tiempo real
 *   4. Proveer un fallback transparente: primero intenta red, si falla usa cache local
 */
import { api } from "./api";
import {
  getAll, putMany, clearStore, setLastSync, getLastSync,
  getPendingOps, markOpSynced, markOpFailed, countItems,
} from "./offlineDB";
import { getSelectedLocalId } from "../hooks/useSelectedLocal";

/* ═══════════════════════════════════════════════════════ */
/*  CONNECTION STATE                                       */
/* ═══════════════════════════════════════════════════════ */
let _isOnline = navigator.onLine;
const _listeners = new Set();

window.addEventListener("online", () => { _isOnline = true; _notify(); scheduleSync(); });
window.addEventListener("offline", () => { _isOnline = false; _notify(); });

function _notify() {
  _listeners.forEach(fn => { try { fn(_isOnline); } catch {} });
}

/** Subscribe to online/offline changes. Returns unsubscribe function. */
export function onConnectionChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function isOnline() { return _isOnline; }

/* ═══════════════════════════════════════════════════════ */
/*  SYNC PROGRESS OBSERVABLE                               */
/* ═══════════════════════════════════════════════════════ */
const _progressListeners = new Set();
let _syncProgressState = { syncing: false, current: 0, total: 0, currentStore: null };

function _emitProgress(update) {
  _syncProgressState = { ..._syncProgressState, ...update };
  _progressListeners.forEach(fn => { try { fn(_syncProgressState); } catch {} });
}

/** Subscribe to sync progress changes. Returns unsubscribe function. */
export function onSyncProgress(fn) {
  _progressListeners.add(fn);
  fn(_syncProgressState); // emit current state immediately
  return () => _progressListeners.delete(fn);
}

/* ═══════════════════════════════════════════════════════ */
/*  CATALOG SYNC (download server → IndexedDB)             */
/* ═══════════════════════════════════════════════════════ */
const SYNC_INTERVAL = 60 * 1000; // 1 minuto
let _syncTimer = null;

/**
 * Sync a single catalog store from the API.
 * @param {string} storeName - IndexedDB store
 * @param {string} endpoint - API endpoint
 * @param {function} [transform] - optional transform for each item
 */
async function syncCatalog(storeName, endpoint, transform) {
  try {
    const data = await api.get(endpoint);
    const items = Array.isArray(data) ? data : data?.items ?? [];
    const transformed = transform ? items.map(transform) : items;
    await clearStore(storeName);
    if (transformed.length > 0) {
      await putMany(storeName, transformed);
    }
    await setLastSync(storeName);
    return { ok: true, count: transformed.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Catalog definitions for sync progress tracking */
const CATALOG_DEFS = [
  {
    key: "products", store: "catalogProducts", label: "Productos",
    endpoint: "/products/?limit=500",
    transform: (p) => ({
      id: p.id, name: p.name, brand: p.brand, category: p.category,
      base_cost: p.base_cost, code: p.code, is_active: p.is_active,
      variants: p.variants || [],
    }),
  },
  {
    key: "stock", store: "catalogStock", label: "Stock",
    endpoint: "/stock?limit=500",
    transform: (s) => ({
      variant_id: s.variant_id ?? s.id, product_id: s.product_id,
      product_name: s.product_name, sku: s.sku, size: s.size, color: s.color,
      stock: s.stock ?? s.quantity ?? 0, local_id: s.local_id, local_name: s.local_name,
    }),
  },
  {
    key: "providers", store: "catalogProviders", label: "Proveedores",
    endpoint: "/providers/?limit=500&skip=0",
    transform: (p) => ({ id: p.id, name: p.name, cuit: p.cuit, contact: p.contact }),
  },
  {
    key: "locals", store: "catalogLocals", label: "Locales",
    endpoint: "/locals/?limit=100",
    transform: null,
  },
  {
    key: "recentOrders", store: "recentOrders", label: "Pedidos",
    endpoint: "/purchase-orders/?status=ENVIADO&limit=100",
    transform: (o) => ({
      id: o.id, number: o.number, prefix: o.prefix, status: o.status, type: o.type,
      date: o.date, provider_id: o.provider_id, provider_name: o.provider_name,
      local_id: o.local_id, local_name: o.local_name,
      invoice_count: o.invoice_count, alert_state: o.alert_state,
    }),
  },
  {
    key: "pendingIngresos", store: "pendingIngresos", label: "Ingresos",
    endpoint: "/purchase-invoices/?status=ROJO&limit=200",
    transform: (inv) => ({
      id: inv.id, number: inv.number, type: inv.type, status: inv.status, date: inv.date,
      purchase_order_id: inv.purchase_order_id, purchase_order_number: inv.purchase_order_number,
      provider_id: inv.provider_id, provider_name: inv.provider_name,
      local_id: inv.local_id, local_name: inv.local_name,
      remito_venta_number: inv.remito_venta_number, amount: inv.amount,
      ingreso_status: inv.ingreso_status,
    }),
  },
];

/**
 * Resolver el endpoint dinámico de stock según el local seleccionado.
 * Si hay un local asignado, filtramos stock solo de ese local (ahorra ancho de banda).
 */
function resolveEndpoint(def) {
  if (def.key === "stock") {
    const localId = getSelectedLocalId();
    if (localId) {
      const sep = def.endpoint.includes("?") ? "&" : "?";
      return `${def.endpoint}${sep}local_id=${localId}`;
    }
  }
  return def.endpoint;
}

/** Sync all catalogs. Called periodically and on reconnect. */
export async function syncAllCatalogs() {
  if (!_isOnline) return { ok: false, reason: "offline" };

  const total = CATALOG_DEFS.length;
  _emitProgress({ syncing: true, current: 0, total, currentStore: null });

  const results = {};

  for (let i = 0; i < CATALOG_DEFS.length; i++) {
    const def = CATALOG_DEFS[i];
    _emitProgress({ current: i + 1, currentStore: def.store, currentLabel: def.label });
    const endpoint = resolveEndpoint(def);
    results[def.key] = await syncCatalog(def.store, endpoint, def.transform);
  }

  _emitProgress({ syncing: false, current: total, total, currentStore: null, currentLabel: null });

  return { ok: true, results };
}

/** Catalog definitions exposed for UI display */
export { CATALOG_DEFS };

/** Re-export getSelectedLocalId para uso desde otros módulos */
export { getSelectedLocalId } from "../hooks/useSelectedLocal";

/** Start periodic sync (every 5 min while online). */
export function startPeriodicSync() {
  if (_syncTimer) return;
  // Do initial sync
  syncAllCatalogs().catch(() => {});
  _syncTimer = setInterval(() => {
    if (_isOnline) syncAllCatalogs().catch(() => {});
  }, SYNC_INTERVAL);
}

export function stopPeriodicSync() {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }
}

/* ═══════════════════════════════════════════════════════ */
/*  OUTBOX SYNC (upload pending ops → server)              */
/* ═══════════════════════════════════════════════════════ */
let _syncing = false;

/** Try to send all pending operations to the server. */
export async function flushPendingOps() {
  if (_syncing || !_isOnline) return { flushed: 0, failed: 0 };
  _syncing = true;
  let flushed = 0;
  let failed = 0;

  try {
    const ops = await getPendingOps();
    for (const op of ops) {
      try {
        let response;
        switch (op.method) {
          case "POST":
            response = await api.post(op.endpoint, op.payload);
            break;
          case "PUT":
            response = await api.put(op.endpoint, op.payload);
            break;
          case "PATCH":
            response = await api.patch(op.endpoint, op.payload);
            break;
          default:
            response = await api.post(op.endpoint, op.payload);
        }
        await markOpSynced(op.localId, response);
        flushed++;
      } catch (err) {
        await markOpFailed(op.localId, err.message);
        failed++;
      }
    }
  } finally {
    _syncing = false;
  }
  return { flushed, failed };
}

/** Auto-flush when coming back online. */
function scheduleSync() {
  // Small delay to let connection stabilize
  setTimeout(() => {
    flushPendingOps().catch(() => {});
  }, 2000);
}

// Also flush on page load if there are pending ops
if (_isOnline) {
  setTimeout(() => flushPendingOps().catch(() => {}), 5000);
}

/* ═══════════════════════════════════════════════════════ */
/*  OFFLINE READ HELPERS                                   */
/* ═══════════════════════════════════════════════════════ */

/**
 * Try to fetch from network with a short timeout.
 * If it fails, return data from IndexedDB.
 *
 * @param {string} endpoint - API endpoint
 * @param {string} storeName - IndexedDB store to fall back to
 * @param {object} [options]
 * @param {number} [options.timeout=2500] - ms before falling back to cache
 * @param {function} [options.filter] - filter function for cached data
 * @returns {{ data: any[], source: 'network'|'cache', stale: boolean }}
 */
export async function fetchWithFallback(endpoint, storeName, options = {}) {
  const { timeout = 2500, filter } = options;

  // If explicitly offline, go straight to cache
  if (!_isOnline) {
    let data = await getAll(storeName);
    if (filter) data = data.filter(filter);
    const lastSync = await getLastSync(storeName);
    return { data, source: "cache", stale: true, lastSync };
  }

  // Try network with short timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const token = sessionStorage.getItem("token");
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json?.items ?? [];
    return { data, source: "network", stale: false, lastSync: Date.now() };
  } catch {
    clearTimeout(timer);
    // Fallback to IndexedDB
    let data = await getAll(storeName);
    if (filter) data = data.filter(filter);
    const lastSync = await getLastSync(storeName);
    return { data, source: "cache", stale: true, lastSync };
  }
}

/* ═══════════════════════════════════════════════════════ */
/*  SYNC STATUS                                            */
/* ═══════════════════════════════════════════════════════ */

/** Get a summary of the offline state for display. */
export async function getSyncStatus() {
  const pending = await getPendingOps();
  const productCount = await countItems("catalogProducts");
  const stockCount = await countItems("catalogStock");
  const orderCount = await countItems("recentOrders");
  const ingresoCount = await countItems("pendingIngresos");
  const lastProductSync = await getLastSync("catalogProducts");
  const lastStockSync = await getLastSync("catalogStock");

  return {
    isOnline: _isOnline,
    pendingOps: pending.length,
    cachedProducts: productCount,
    cachedStock: stockCount,
    cachedOrders: orderCount,
    cachedPendingIngresos: ingresoCount,
    lastProductSync,
    lastStockSync,
  };
}
