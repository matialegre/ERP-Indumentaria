/**
 * offlineDB.js — IndexedDB wrapper para modo offline del ERP
 *
 * Stores:
 *   - catalogProducts: catálogo de productos + variantes (lectura offline)
 *   - catalogStock: niveles de stock por variante (lectura offline)
 *   - catalogProviders: proveedores (lectura offline)
 *   - catalogLocals: locales (lectura offline)
 *   - pendingOps: cola de operaciones pendientes (ventas, ajustes) que se sincronizan cuando vuelve internet
 *   - syncMeta: timestamps de última sincronización por store
 *   - offlineReceipts: comprobantes generados offline para reimpresión
 */
import { openDB } from "idb";

const DB_NAME = "mo-erp-offline";
const DB_VERSION = 5;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1 stores — create on fresh install
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("catalogProducts")) {
            db.createObjectStore("catalogProducts", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("catalogStock")) {
            const store = db.createObjectStore("catalogStock", { keyPath: "variant_id" });
            store.createIndex("product_id", "product_id", { unique: false });
          }
          if (!db.objectStoreNames.contains("catalogProviders")) {
            db.createObjectStore("catalogProviders", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("catalogLocals")) {
            db.createObjectStore("catalogLocals", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("pendingOps")) {
            const ops = db.createObjectStore("pendingOps", { keyPath: "localId", autoIncrement: true });
            ops.createIndex("status", "status", { unique: false });
            ops.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!db.objectStoreNames.contains("syncMeta")) {
            db.createObjectStore("syncMeta", { keyPath: "store" });
          }
          if (!db.objectStoreNames.contains("offlineReceipts")) {
            db.createObjectStore("offlineReceipts", { keyPath: "localId" });
          }
        }
        // v2 stores — add for both fresh installs and upgrades from v1
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("recentOrders")) {
            const orders = db.createObjectStore("recentOrders", { keyPath: "id" });
            orders.createIndex("status", "status", { unique: false });
            orders.createIndex("local_id", "local_id", { unique: false });
          }
          if (!db.objectStoreNames.contains("pendingIngresos")) {
            const ingresos = db.createObjectStore("pendingIngresos", { keyPath: "id" });
            ingresos.createIndex("status", "status", { unique: false });
            ingresos.createIndex("local_id", "local_id", { unique: false });
          }
        }
        // v3 stores — offline auth + sales
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains("cachedAuth")) {
            db.createObjectStore("cachedAuth", { keyPath: "username" });
          }
          if (!db.objectStoreNames.contains("offlineSales")) {
            const sales = db.createObjectStore("offlineSales", { keyPath: "localId" });
            sales.createIndex("status", "status", { unique: false });
            sales.createIndex("createdAt", "createdAt", { unique: false });
          }
        }
        // v4 stores — módulo taller (OT offline)
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains("catalogOTs")) {
            const ots = db.createObjectStore("catalogOTs", { keyPath: "id" });
            ots.createIndex("status", "status", { unique: false });
            ots.createIndex("local_id", "local_id", { unique: false });
          }
          if (!db.objectStoreNames.contains("catalogClientes")) {
            const cli = db.createObjectStore("catalogClientes", { keyPath: "id" });
            cli.createIndex("cuit", "cuit", { unique: false });
          }
          if (!db.objectStoreNames.contains("catalogTecnicos")) {
            db.createObjectStore("catalogTecnicos", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("catalogArticulos")) {
            const art = db.createObjectStore("catalogArticulos", { keyPath: "id" });
            art.createIndex("stock", "stock", { unique: false });
          }
          if (!db.objectStoreNames.contains("pendingOTs")) {
            const pot = db.createObjectStore("pendingOTs", { keyPath: "offline_id" });
            pot.createIndex("status", "status", { unique: false });
            pot.createIndex("createdAt", "createdAt", { unique: false });
          }
        }
        // v5 stores — event sourcing (sync events inmutables)
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains("syncEvents")) {
            const se = db.createObjectStore("syncEvents", { keyPath: "event_id" });
            se.createIndex("status", "status", { unique: false });
            se.createIndex("sincronizado", "sincronizado", { unique: false });
            se.createIndex("created_at", "created_at", { unique: false });
          }
        }
      },
    });
  }
  return dbPromise;
}

/* ═══════════════════════════════════════════════════════ */
/*  GENERIC HELPERS                                        */
/* ═══════════════════════════════════════════════════════ */
export async function getAll(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function getById(storeName, id) {
  const db = await getDB();
  return db.get(storeName, id);
}

export async function putItem(storeName, item) {
  const db = await getDB();
  return db.put(storeName, item);
}

export async function putMany(storeName, items) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  for (const item of items) {
    tx.store.put(item);
  }
  await tx.done;
}

export async function clearStore(storeName) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  await tx.store.clear();
  await tx.done;
}

export async function deleteItem(storeName, key) {
  const db = await getDB();
  return db.delete(storeName, key);
}

export async function countItems(storeName) {
  const db = await getDB();
  return db.count(storeName);
}

/* ═══════════════════════════════════════════════════════ */
/*  SYNC METADATA                                          */
/* ═══════════════════════════════════════════════════════ */
export async function getLastSync(storeName) {
  const db = await getDB();
  const meta = await db.get("syncMeta", storeName);
  return meta?.lastSync ?? null;
}

export async function setLastSync(storeName) {
  const db = await getDB();
  await db.put("syncMeta", { store: storeName, lastSync: Date.now() });
}

/* ═══════════════════════════════════════════════════════ */
/*  PENDING OPERATIONS (outbox pattern)                    */
/* ═══════════════════════════════════════════════════════ */

/**
 * Enqueue an operation that will be sent to the server when online.
 * @param {string} type - 'SALE' | 'STOCK_ADJUST' | etc
 * @param {string} method - 'POST' | 'PUT' | 'PATCH'
 * @param {string} endpoint - API endpoint, e.g. '/sales/'
 * @param {object} payload - request body
 * @param {object} [meta] - extra metadata (receipt data, etc.)
 * @returns {number} localId
 */
export async function enqueueOp(type, method, endpoint, payload, meta = {}) {
  const db = await getDB();
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Taggear la operación con el local del dispositivo
  const storeLocalId = localStorage.getItem("selectedLocalId") || null;
  const storeLocalName = localStorage.getItem("selectedLocalName") || null;

  // Inyectar local_id en el payload si hay local seleccionado y no viene ya
  const enrichedPayload = { ...payload };
  if (storeLocalId && !enrichedPayload.local_id) {
    enrichedPayload.local_id = parseInt(storeLocalId);
  }

  await db.put("pendingOps", {
    localId,
    type,
    method,
    endpoint,
    payload: enrichedPayload,
    meta,
    storeLocalId,
    storeLocalName,
    status: "PENDING",
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  });
  return localId;
}

export async function getPendingOps() {
  const db = await getDB();
  return db.getAllFromIndex("pendingOps", "status", "PENDING");
}

export async function markOpSynced(localId, serverResponse) {
  const db = await getDB();
  const op = await db.get("pendingOps", localId);
  if (op) {
    op.status = "SYNCED";
    op.serverResponse = serverResponse;
    op.syncedAt = Date.now();
    await db.put("pendingOps", op);
  }
}

export async function markOpFailed(localId, error) {
  const db = await getDB();
  const op = await db.get("pendingOps", localId);
  if (op) {
    op.attempts += 1;
    op.lastError = error;
    if (op.attempts >= 5) op.status = "FAILED";
    await db.put("pendingOps", op);
  }
}

export async function getFailedOps() {
  const db = await getDB();
  return db.getAllFromIndex("pendingOps", "status", "FAILED");
}

/* ═══════════════════════════════════════════════════════ */
/*  OFFLINE RECEIPTS                                       */
/* ═══════════════════════════════════════════════════════ */
export async function saveReceipt(localId, receiptData) {
  const db = await getDB();
  await db.put("offlineReceipts", { localId, ...receiptData, createdAt: Date.now() });
}

export async function getReceipt(localId) {
  const db = await getDB();
  return db.get("offlineReceipts", localId);
}

export async function getAllReceipts() {
  const db = await getDB();
  return db.getAll("offlineReceipts");
}

/* ═══════════════════════════════════════════════════════ */
/*  CACHED AUTH (offline login)                            */
/* ═══════════════════════════════════════════════════════ */

/**
 * Guardar credenciales + perfil tras login exitoso online.
 * El password se guarda hasheado con SHA-256 (no en texto plano).
 */
export async function cacheAuthCredentials(username, passwordHash, userProfile) {
  const db = await getDB();
  await db.put("cachedAuth", {
    username,
    passwordHash,
    profile: userProfile,
    token: sessionStorage.getItem("token") || null,
    cachedAt: Date.now(),
  });
}

/**
 * Verificar credenciales offline contra el cache local.
 * @returns {object|null} — perfil del usuario si match, null si no
 */
export async function verifyOfflineAuth(username, passwordHash) {
  const db = await getDB();
  const cached = await db.get("cachedAuth", username);
  if (!cached) return null;
  if (cached.passwordHash !== passwordHash) return null;
  return cached;
}

/**
 * Obtener la sesión cacheada más reciente (para auto-login offline).
 */
export async function getCachedSession() {
  const db = await getDB();
  const all = await db.getAll("cachedAuth");
  if (all.length === 0) return null;
  // Retornar la más reciente
  all.sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
  return all[0];
}

export async function clearCachedAuth(username) {
  const db = await getDB();
  await db.delete("cachedAuth", username);
}

/* ═══════════════════════════════════════════════════════ */
/*  OFFLINE SALES (ventas creadas sin servidor)            */
/* ═══════════════════════════════════════════════════════ */

export async function saveOfflineSale(sale) {
  const db = await getDB();
  await db.put("offlineSales", sale);
}

export async function getOfflineSales() {
  const db = await getDB();
  return db.getAll("offlineSales");
}

export async function getPendingOfflineSales() {
  const db = await getDB();
  return db.getAllFromIndex("offlineSales", "status", "PENDING");
}

export async function markOfflineSaleSynced(localId, serverId) {
  const db = await getDB();
  const sale = await db.get("offlineSales", localId);
  if (sale) {
    sale.status = "SYNCED";
    sale.serverId = serverId;
    sale.syncedAt = Date.now();
    await db.put("offlineSales", sale);
  }
}

/**
 * Actualizar stock local en IndexedDB (decrementar tras venta offline).
 */
export async function decrementLocalStock(variantId, quantity) {
  const db = await getDB();
  const item = await db.get("catalogStock", variantId);
  if (item) {
    item.stock = Math.max(0, (item.stock || 0) - quantity);
    await db.put("catalogStock", item);
  }
}

/* ═══════════════════════════════════════════════════════ */
/*  PENDING OTs (módulo taller — outbox)                   */
/* ═══════════════════════════════════════════════════════ */

/** Guardar una OT pendiente de enviar al servidor */
export async function saveOTPending(otDraft) {
  const db = await getDB();
  const offline_id = otDraft.offline_id ?? `ot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.put("pendingOTs", {
    ...otDraft,
    offline_id,
    status: "PENDING",
    createdAt: otDraft.createdAt ?? Date.now(),
  });
  return offline_id;
}

/** Obtener todas las OTs pendientes de sync */
export async function getPendingOTs() {
  const db = await getDB();
  return db.getAllFromIndex("pendingOTs", "status", "PENDING");
}

/** Marcar OT como sincronizada */
export async function markOTSynced(offline_id, serverId) {
  const db = await getDB();
  const ot = await db.get("pendingOTs", offline_id);
  if (ot) {
    ot.status = "SYNCED";
    ot.serverId = serverId;
    ot.syncedAt = Date.now();
    await db.put("pendingOTs", ot);
  }
}

/** Guardar en cache las OTs activas del servidor */
export async function cacheOTs(ots) {
  const db = await getDB();
  const tx = db.transaction("catalogOTs", "readwrite");
  for (const ot of ots) tx.store.put(ot);
  await tx.done;
}

/** Obtener OTs cacheadas localmente */
export async function getCachedOTs(statusFilter) {
  const db = await getDB();
  if (statusFilter) {
    return db.getAllFromIndex("catalogOTs", "status", statusFilter);
  }
  return db.getAll("catalogOTs");
}

