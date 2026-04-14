/**
 * syncEngine.js — Orquestador de sincronización offline ↔ servidor
 *
 * Implementa el protocolo de sync de 5 fases:
 *   1. GET /sync/criticos — datos urgentes (precios, bloqueados, conflictos)
 *   2. GET /sync/delta   — cambios desde el último sync
 *   3. Aplicar cambios del servidor al IndexedDB local
 *   4. POST /sync/push   — enviar eventos pendientes al servidor
 *   5. Marcar eventos locales como sincronizados
 *
 * Exports:
 *   startSync()         → Promise<SyncResult>
 *   getLastSyncTime()   → number | null (timestamp ms)
 *   isSyncing()         → boolean
 *   onSyncEvent(fn)     → unsubscribe function
 */

import { api } from "./api";
import { getDeviceId } from "./deviceFingerprint";
import {
  putMany, clearStore, setLastSync, getLastSync,
} from "./offlineDB";
import {
  getPendingEvents, markEventSynced, markEventFailed,
} from "./eventSourcing";
import { isOnline } from "./offlineSync";

// ─── Estado interno ─────────────────────────────────────────
let _syncing = false;
let _lastSyncTime = null;
const _syncListeners = new Set();

// Constantes de control
const LAST_SYNC_KEY = "mo_last_sync_time";
const PUSH_BATCH_SIZE = 50; // eventos por lote al servidor

// ─── Observable interno ─────────────────────────────────────

function _emit(type, payload = {}) {
  const event = { type, timestamp: Date.now(), ...payload };
  _syncListeners.forEach((fn) => { try { fn(event); } catch {} });
}

/**
 * Suscribirse a eventos de sync.
 * @param {function} fn - Recibe { type, timestamp, ...payload }
 *   Tipos: 'start' | 'phase' | 'complete' | 'error' | 'conflict'
 * @returns {function} unsubscribe
 */
export function onSyncEvent(fn) {
  _syncListeners.add(fn);
  return () => _syncListeners.delete(fn);
}

export function isSyncing() {
  return _syncing;
}

export function getLastSyncTime() {
  if (_lastSyncTime) return _lastSyncTime;
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  return stored ? parseInt(stored, 10) : null;
}

function _setLastSyncTime(ts = Date.now()) {
  _lastSyncTime = ts;
  localStorage.setItem(LAST_SYNC_KEY, String(ts));
}

// ─── FASE 1: Datos críticos ──────────────────────────────────

async function _fetchCriticos(deviceId) {
  const lastSync = getLastSyncTime();
  const desde = lastSync
    ? new Date(lastSync).toISOString()
    : "2020-01-01T00:00:00Z";

  try {
    const data = await api.get(
      `/sync/criticos?dispositivo_id=${deviceId}&desde=${encodeURIComponent(desde)}`
    );
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function _applyCriticos(criticos) {
  if (!criticos?.data) return;
  const { precios_actualizados, productos_discontinuados, clientes_bloqueados } = criticos.data;

  // Actualizar precios urgentes en IndexedDB
  if (precios_actualizados?.length) {
    await putMany("catalogArticulos", precios_actualizados);
  }

  // Marcar productos discontinuados
  if (productos_discontinuados?.length) {
    const inactiveIds = new Set(productos_discontinuados.map((p) => p.id));
    const allProducts = await import("./offlineDB").then((m) =>
      m.getAll("catalogProducts")
    );
    const updated = allProducts.map((p) =>
      inactiveIds.has(p.id) ? { ...p, is_active: false } : p
    );
    if (updated.length) await putMany("catalogProducts", updated);
  }

  // Guardar clientes bloqueados para verificación en ventas
  if (clientes_bloqueados?.length) {
    await putMany("catalogClientes", clientes_bloqueados);
  }
}

// ─── FASE 2: Delta sync ──────────────────────────────────────

async function _fetchDelta(deviceId) {
  const lastSync = getLastSyncTime();
  const desde = lastSync
    ? new Date(lastSync).toISOString()
    : "2020-01-01T00:00:00Z";

  try {
    const data = await api.get(
      `/sync/delta?dispositivo_id=${deviceId}&desde=${encodeURIComponent(desde)}`
    );
    return { ok: true, data, truncated: data.truncated || false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function _applyDelta(delta) {
  if (!delta?.data) return { applied: 0 };
  const {
    productos_modificados = [],
    clientes_modificados = [],
    precios_modificados = [],
    timestamp_servidor,
  } = delta.data;

  let applied = 0;

  if (productos_modificados.length) {
    await putMany("catalogProducts", productos_modificados);
    applied += productos_modificados.length;
  }

  if (clientes_modificados.length) {
    await putMany("catalogClientes", clientes_modificados);
    applied += clientes_modificados.length;
  }

  if (precios_modificados.length) {
    await putMany("catalogArticulos", precios_modificados);
    applied += precios_modificados.length;
  }

  if (timestamp_servidor) {
    await setLastSync("delta");
  }

  return { applied };
}

// ─── FASE 4: Push de eventos pendientes ─────────────────────

async function _pushPendingEvents(deviceId) {
  const pending = await getPendingEvents();
  if (pending.length === 0) return { pushed: 0, failed: 0, conflicts: 0 };

  let pushed = 0;
  let failed = 0;
  let conflicts = 0;

  // Enviar en lotes para no saturar el servidor
  for (let i = 0; i < pending.length; i += PUSH_BATCH_SIZE) {
    const batch = pending.slice(i, i + PUSH_BATCH_SIZE);
    try {
      const response = await api.post("/sync/push", {
        device_id: deviceId,
        events: batch.map((e, idx) => ({
          event_id: e.event_id,
          aggregate_type: e.aggregate_type,
          aggregate_id: e.aggregate_id,
          event_type: e.event_type,
          payload_antes: e.payload_antes ?? null,
          payload: e.payload,
          campos_modificados: e.campos_modificados ?? null,
          metadata: e.metadata ?? null,
          sequence_num: i + idx + 1,
          version_catalogo: e.version_catalogo ?? 0,
        })),
      });

      // Procesar resultados por evento
      const results = response?.results ?? [];
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        const event = batch[j];

        if (result?.conflicto) {
          conflicts++;
          _emit("conflict", {
            eventId: event.event_id,
            tabla: event.aggregate_type,
            tipo: result.tipo_conflicto,
            mensaje: result.mensaje,
          });
          // Marcar sincronizado de todas formas (el servidor lo registró)
          await markEventSynced(event.event_id, result);
          pushed++;
        } else {
          await markEventSynced(event.event_id, result);
          pushed++;
        }
      }
    } catch (err) {
      // Si el lote falla, marcar todos como fallidos con reintentos
      for (const event of batch) {
        await markEventFailed(event.event_id, err.message);
        failed++;
      }
    }
  }

  return { pushed, failed, conflicts };
}

// ─── ORQUESTADOR PRINCIPAL ───────────────────────────────────

/**
 * Ejecutar el ciclo completo de sincronización.
 *
 * @returns {Promise<SyncResult>}
 *   { ok, phases: { criticos, delta, push }, duration_ms, conflicts, error? }
 */
export async function startSync() {
  if (_syncing) {
    return { ok: false, error: "sync_already_running" };
  }
  if (!isOnline()) {
    return { ok: false, error: "offline" };
  }

  _syncing = true;
  const startTime = Date.now();
  _emit("start");

  const result = {
    ok: true,
    phases: {},
    duration_ms: 0,
    conflicts: 0,
    error: null,
  };

  try {
    const deviceId = getDeviceId();

    // ── Fase 1: Datos críticos ──────────────────────────────
    _emit("phase", { phase: 1, name: "criticos" });
    const criticos = await _fetchCriticos(deviceId);
    result.phases.criticos = criticos.ok ? "ok" : `error: ${criticos.error}`;
    if (criticos.ok) {
      await _applyCriticos(criticos);
    }

    // ── Fase 2: Delta sync ──────────────────────────────────
    _emit("phase", { phase: 2, name: "delta" });
    const delta = await _fetchDelta(deviceId);
    result.phases.delta = delta.ok ? "ok" : `error: ${delta.error}`;

    if (delta.ok && delta.truncated) {
      // Delta demasiado grande — hacer bootstrap completo
      result.phases.delta = "truncated → bootstrap needed";
      _emit("phase", { phase: 2, name: "bootstrap_needed" });
      // No aplicamos delta truncado — el frontend debe llamar /sync/bootstrap
    } else if (delta.ok) {
      const { applied } = await _applyDelta(delta);
      result.phases.delta = `ok (${applied} records)`;
    }

    // ── Fase 3: Aplicar conflictos del servidor ─────────────
    _emit("phase", { phase: 3, name: "apply_conflicts" });
    const serverConflicts = delta.data?.conflictos_pendientes ?? [];
    result.phases.conflicts = `${serverConflicts.length} pending`;
    if (serverConflicts.length > 0) {
      serverConflicts.forEach((c) => {
        _emit("conflict", {
          eventId: c.event_id,
          tabla: c.tabla_afectada,
          tipo: c.conflict_type,
          status: c.status,
        });
      });
      result.conflicts = serverConflicts.length;
    }

    // ── Fase 4: Push de eventos pendientes ──────────────────
    _emit("phase", { phase: 4, name: "push" });
    const pushResult = await _pushPendingEvents(deviceId);
    result.phases.push = `pushed: ${pushResult.pushed}, failed: ${pushResult.failed}, conflicts: ${pushResult.conflicts}`;
    result.conflicts += pushResult.conflicts;

    // ── Fase 5: Marcar timestamp del sync ───────────────────
    _setLastSyncTime();
    result.phases.completed = new Date().toISOString();

  } catch (err) {
    result.ok = false;
    result.error = err.message;
    _emit("error", { message: err.message });
  } finally {
    _syncing = false;
    result.duration_ms = Date.now() - startTime;
    _emit("complete", { result });
  }

  return result;
}

// ─── Auto-sync al reconectar ─────────────────────────────────

import { onConnectionChange } from "./offlineSync";

let _autoSyncEnabled = false;
let _autoSyncUnsubscribe = null;

/**
 * Activar sync automático al reconectarse.
 * Se llama una sola vez al inicializar la app.
 */
export function enableAutoSync() {
  if (_autoSyncEnabled) return;
  _autoSyncEnabled = true;
  _autoSyncUnsubscribe = onConnectionChange((online) => {
    if (online) {
      // Pequeño delay para que la conexión se estabilice
      setTimeout(() => startSync().catch(() => {}), 3000);
    }
  });
}

export function disableAutoSync() {
  if (_autoSyncUnsubscribe) {
    _autoSyncUnsubscribe();
    _autoSyncUnsubscribe = null;
  }
  _autoSyncEnabled = false;
}

// Ejecutar sync inicial si hay eventos pendientes y hay conexión
if (typeof window !== "undefined") {
  setTimeout(async () => {
    if (isOnline()) {
      const { getPendingEventCount } = await import("./eventSourcing");
      const count = await getPendingEventCount();
      if (count > 0) {
        startSync().catch(() => {});
      }
    }
  }, 8000); // 8s después de cargar la página
}
