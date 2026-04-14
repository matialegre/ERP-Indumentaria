/**
 * Cola de operaciones offline — persistida en localStorage.
 * Sin dependencias de red. api.ts es quien ejecuta process().
 */

const QUEUE_KEY = 'eurotaller_offline_queue'

export interface PendingOperation {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body: unknown
  timestamp: string
  retries: number
  /** Respuesta optimista que se devolvió al caller mientras estaba offline */
  optimisticPayload?: unknown
}

// ─── Suscriptores al cambio de cola ──────────────────────────────────────────

type QueueListener = (ops: PendingOperation[]) => void
const _queueListeners = new Set<QueueListener>()

function _notify() {
  const ops = getAll()
  _queueListeners.forEach(fn => fn(ops))
}

/** Suscribirse a cambios en la cola. Retorna unsubscribe. */
export function subscribeQueue(fn: QueueListener): () => void {
  _queueListeners.add(fn)
  return () => _queueListeners.delete(fn)
}

// ─── Operaciones CRUD sobre la cola ──────────────────────────────────────────

/** Lee la cola completa desde localStorage. */
export function getAll(): PendingOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as PendingOperation[]) : []
  } catch {
    return []
  }
}

/** Guarda la cola completa en localStorage. */
function _save(ops: PendingOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops))
  } catch {
    // localStorage lleno — no lanzar, sólo loguear
    console.warn('[offline-queue] No se pudo guardar en localStorage')
  }
}

/**
 * Agrega una operación a la cola.
 * Retorna la operación creada (con id y timestamp generados).
 */
export function enqueue(
  op: Omit<PendingOperation, 'id' | 'timestamp' | 'retries'>
): PendingOperation {
  const full: PendingOperation = {
    ...op,
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    retries: 0,
  }
  const ops = getAll()
  ops.push(full)
  _save(ops)
  _notify()
  return full
}

/** Elimina una operación de la cola por id (llamado tras éxito). */
export function remove(id: string): void {
  const ops = getAll().filter(op => op.id !== id)
  _save(ops)
  _notify()
}

/** Incrementa el contador de reintentos de una operación. */
export function incrementRetries(id: string): void {
  const ops = getAll().map(op =>
    op.id === id ? { ...op, retries: op.retries + 1 } : op
  )
  _save(ops)
  // no notify — no queremos re-render en cada reintento fallido
}

/** Elimina todas las operaciones de la cola. */
export function clear(): void {
  localStorage.removeItem(QUEUE_KEY)
  _notify()
}

/** Número de operaciones pendientes. */
export function count(): number {
  return getAll().length
}
