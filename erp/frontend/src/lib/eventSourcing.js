/**
 * eventSourcing.js — Event Store local para sync offline
 *
 * Implementa el patrón Event Sourcing en el cliente:
 * cada operación que modifica datos genera un evento inmutable
 * que se almacena en IndexedDB y se envía al servidor al reconectar.
 *
 * El formato de evento es compatible con el endpoint POST /api/v1/sync/push
 * y con el schema eventos_sync de la DB.
 *
 * Exports:
 *   createEvent(tabla, operacion, payloadAntes, payloadDespues, camposModificados)
 *   getPendingEvents()
 *   markEventSynced(eventId)
 *   markEventFailed(eventId, error)
 *   getPendingEventCount()
 */

import { getDeviceId } from "./deviceFingerprint";
import { putItem, getAll, getById } from "./offlineDB";

// ────────────────────────────────────────────────
// UUID v7 — genera UUIDs con timestamp embebido (ms-precision)
// No requiere dependencias externas.
// Spec: https://www.ietf.org/rfc/rfc9562.html#section-5.7
// ────────────────────────────────────────────────

function uuidv7() {
  const ms = BigInt(Date.now());
  // 48 bits de timestamp ms
  const tsHex = ms.toString(16).padStart(12, "0");
  // 12 bits de random para sub-ms (rand_a en spec)
  const randA = Math.floor(Math.random() * 0xfff).toString(16).padStart(3, "0");
  // 62 bits de random (rand_b en spec)
  const randB = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
  ).join("");

  // Version 7 → primer nibble del tercer grupo = 7
  // Variant 10 → primeros 2 bits del cuarto grupo = 10xxxxxx
  const group3 = "7" + randA;
  const group4Byte = (0x80 | (parseInt(randB.slice(0, 2), 16) & 0x3f))
    .toString(16)
    .padStart(2, "0");
  const group4 = group4Byte + randB.slice(2, 6);
  const group5 = randB.slice(6);

  return [
    tsHex.slice(0, 8),
    tsHex.slice(8, 12),
    group3,
    group4,
    group5,
  ].join("-");
}

// ────────────────────────────────────────────────
// IndexedDB store name para eventos de sync
// (separado de pendingOps que es el store legado)
// ────────────────────────────────────────────────
const SYNC_EVENTS_STORE = "syncEvents";

// Tabla de operaciones válidas (espejo del backend)
export const OPERACIONES = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  AJUSTE: "AJUSTE",
  VENTA: "VENTA",
  TRANSFERENCIA: "TRANSFERENCIA",
};

/**
 * Crear un nuevo evento de sync y guardarlo en IndexedDB.
 *
 * @param {string} tabla - Nombre de la tabla afectada (ej: "product_variants", "sales")
 * @param {string} operacion - Tipo de operación (ver OPERACIONES)
 * @param {object|null} payloadAntes - Estado ANTES del cambio (null para INSERT)
 * @param {object} payloadDespues - Estado DESPUÉS del cambio
 * @param {string[]} [camposModificados] - Lista de campos que cambiaron (para UPDATE)
 * @returns {Promise<string>} ID del evento creado
 */
export async function createEvent(
  tabla,
  operacion,
  payloadAntes,
  payloadDespues,
  camposModificados = null
) {
  const eventId = uuidv7();
  const deviceId = getDeviceId();
  const empresaId = parseInt(localStorage.getItem("companyId") || "0");

  // Obtener versión del catálogo del dispositivo (si está guardada)
  const versionCatalogo = parseInt(
    localStorage.getItem("catalog_version") || "0"
  );

  const event = {
    // Identificación del evento
    event_id: eventId,
    device_id: deviceId,
    empresa_id: empresaId,

    // Qué pasó
    aggregate_type: tabla,     // nombre de tabla (compatible con backend GAP-7 mapping)
    aggregate_id: String(payloadDespues?.id || payloadDespues?.variant_id || ""),
    event_type: operacion,

    // Estado antes/después
    payload_antes: payloadAntes ?? null,
    payload: payloadDespues,

    // Metadata de merge
    campos_modificados: camposModificados,
    version_catalogo: versionCatalogo,

    // Control de sync
    timestamp_local: new Date().toISOString(),
    sincronizado: false,
    status: "PENDING",
    attempts: 0,
    last_error: null,
    created_at: Date.now(),

    // sequence_num se asigna en orden FIFO al enviar
    sequence_num: Date.now(),
  };

  await _ensureSyncEventsStore();
  await putItem(SYNC_EVENTS_STORE, event);
  return eventId;
}

/**
 * Obtener todos los eventos pendientes de sincronizar, ordenados por timestamp.
 * @returns {Promise<Array>}
 */
export async function getPendingEvents() {
  await _ensureSyncEventsStore();
  const all = await getAll(SYNC_EVENTS_STORE);
  return all
    .filter((e) => e.sincronizado === false && e.status !== "FAILED")
    .sort((a, b) => a.created_at - b.created_at);
}

/**
 * Marcar un evento como sincronizado exitosamente.
 * @param {string} eventId
 * @param {object} [serverResponse]
 */
export async function markEventSynced(eventId, serverResponse = null) {
  await _ensureSyncEventsStore();
  const event = await getById(SYNC_EVENTS_STORE, eventId);
  if (event) {
    event.sincronizado = true;
    event.status = "SYNCED";
    event.synced_at = Date.now();
    event.server_response = serverResponse;
    await putItem(SYNC_EVENTS_STORE, event);
  }
}

/**
 * Marcar un evento como fallido.
 * @param {string} eventId
 * @param {string} error
 */
export async function markEventFailed(eventId, error) {
  await _ensureSyncEventsStore();
  const event = await getById(SYNC_EVENTS_STORE, eventId);
  if (event) {
    event.attempts = (event.attempts || 0) + 1;
    event.last_error = error;
    // Después de 5 intentos marca como FAILED para no reintentar infinitamente
    if (event.attempts >= 5) {
      event.status = "FAILED";
    }
    await putItem(SYNC_EVENTS_STORE, event);
  }
}

/**
 * Contar eventos pendientes (para badge en UI).
 * @returns {Promise<number>}
 */
export async function getPendingEventCount() {
  const pending = await getPendingEvents();
  return pending.length;
}

// ────────────────────────────────────────────────
// Helpers para store syncEvents en IndexedDB v5
// offlineDB.js usa versionado — si el store no existe,
// necesitamos una versión más alta del DB.
// Por ahora usamos un fallback a localStorage si el store
// no está disponible (evita romper hasta que se migre offlineDB)
// ────────────────────────────────────────────────

let _syncEventsAvailable = null;

async function _ensureSyncEventsStore() {
  if (_syncEventsAvailable !== null) return;
  try {
    await getAll(SYNC_EVENTS_STORE);
    _syncEventsAvailable = true;
  } catch {
    // Store no existe aún — se resolverá cuando offlineDB.js se actualice a v5
    _syncEventsAvailable = false;
    console.warn(
      "[eventSourcing] syncEvents store not available — using pendingOps fallback"
    );
  }
}


