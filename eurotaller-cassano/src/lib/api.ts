/**
 * Cliente HTTP para el backend FastAPI de Eurotaller.
 * Reemplaza al cliente Supabase.
 *
 * Features:
 * - JWT en Authorization header (token en localStorage)
 * - Retry automático con backoff exponencial en errores de red
 * - Modo offline: encola la mutación y retorna respuesta optimista
 * - Estado global online/offline/syncing (suscribible)
 */

import {
  enqueue,
  getAll,
  remove,
  incrementRetries,
} from './offline-queue'

// ─── Configuración ────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000'
const API_PREFIX = `${API_BASE}/api/v1`
const TIMEOUT_MS = 30_000
const MAX_RETRIES = 3
const TOKEN_KEY = 'eurotaller_token'

// ─── Estado global online/syncing ────────────────────────────────────────────

export type ConnStatus = 'online' | 'offline' | 'syncing'

let _status: ConnStatus = navigator.onLine ? 'online' : 'offline'
const _statusListeners = new Set<(s: ConnStatus) => void>()

function _setStatus(s: ConnStatus) {
  if (_status === s) return
  _status = s
  _statusListeners.forEach(fn => fn(s))
}

export function getConnStatus(): ConnStatus { return _status }
export function getIsOnline(): boolean { return navigator.onLine }

/** Suscribirse al estado de conexión. Retorna unsubscribe. */
export function subscribeConnStatus(fn: (s: ConnStatus) => void): () => void {
  _statusListeners.add(fn)
  return () => _statusListeners.delete(fn)
}

// ─── Errores tipados ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
    public offline = false,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const HTTP_MESSAGES: Record<number, string> = {
  400: 'Datos inválidos en la solicitud',
  401: 'Sesión expirada — iniciá sesión de nuevo',
  403: 'No tenés permisos para esta acción',
  404: 'Recurso no encontrado',
  409: 'Conflicto: el recurso ya existe o fue modificado',
  422: 'Datos incompletos o con formato incorrecto',
  429: 'Demasiadas solicitudes, esperá un momento',
  500: 'Error interno del servidor',
  502: 'El servidor no está disponible',
  503: 'Servicio temporalmente no disponible',
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

/** Espera ms milisegundos */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Fetch con timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(tid)
  }
}

// ─── Función base con retry ───────────────────────────────────────────────────

async function _request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  attempt = 1,
): Promise<T> {
  const url = `${API_PREFIX}${path}`
  const options: RequestInit = {
    method,
    headers: buildHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }

  try {
    const res = await fetchWithTimeout(url, options)

    if (res.status === 401) {
      clearToken()
      window.location.href = '/login'
      throw new ApiError('Sesión expirada', 401)
    }

    if (!res.ok) {
      const raw = await res.json().catch(() => null)
      const detail = (raw as Record<string, unknown>)?.detail
      const fallback = HTTP_MESSAGES[res.status] ?? `Error ${res.status}`
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: unknown) => (d as Record<string, string>)?.msg ?? JSON.stringify(d)).join('; ')
          : fallback
      throw new ApiError(message, res.status, raw)
    }

    if (res.status === 204) return null as T

    _setStatus('online')
    return (await res.json()) as T

  } catch (err: unknown) {
    if (err instanceof ApiError) throw err

    const isAbort = err instanceof DOMException && err.name === 'AbortError'
    const isNetwork = err instanceof TypeError && err.message.includes('fetch')

    if ((isAbort || isNetwork) && attempt < MAX_RETRIES) {
      await sleep(300 * 2 ** (attempt - 1)) // 300ms, 600ms, 1200ms
      return _request<T>(method, path, body, attempt + 1)
    }

    _setStatus('offline')
    throw new ApiError(
      isAbort ? 'Sin respuesta del servidor (timeout)' : 'Sin conexión al servidor',
      0,
      undefined,
      true,
    )
  }
}

// ─── Operaciones de sólo lectura (sin encolado offline) ───────────────────────

async function _get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return _request<T>('GET', `${path}${qs}`)
}

// ─── Operaciones de escritura con encolado offline ────────────────────────────

type MutMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Ejecuta una mutación.
 * Si está offline → encola + retorna payload optimista (o null).
 */
async function _mutate<T = unknown>(
  method: MutMethod,
  path: string,
  body?: unknown,
  optimisticPayload?: T,
): Promise<T> {
  if (!navigator.onLine) {
    enqueue({ method, path, body, optimisticPayload })
    _setStatus('offline')
    if (optimisticPayload !== undefined) return optimisticPayload
    // Retorna un objeto vacío con offline_id para que el caller pueda trackear
    return { offline: true, queued: true, path, method } as T
  }
  return _request<T>(method, path, body)
}

// ─── Procesamiento de cola ────────────────────────────────────────────────────

let _processingQueue = false

export async function processQueue(): Promise<void> {
  if (_processingQueue || !navigator.onLine) return
  const ops = getAll()
  if (ops.length === 0) {
    _setStatus('online')
    return
  }

  _processingQueue = true
  _setStatus('syncing')

  for (const op of ops) {
    try {
      await _request(op.method, op.path, op.body)
      remove(op.id)
    } catch (err) {
      if (err instanceof ApiError && err.offline) {
        // Red cortada de nuevo → parar
        break
      }
      // Error del servidor (4xx) → no reintentar, descartar con log
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        console.warn(`[offline-queue] Operación descartada (${err.status}):`, op.path, err.message)
        remove(op.id)
      } else {
        incrementRetries(op.id)
      }
    }
  }

  _processingQueue = false
  _setStatus(navigator.onLine ? 'online' : 'offline')
}

// ─── Listener de reconexión ───────────────────────────────────────────────────

window.addEventListener('online', () => {
  _setStatus('syncing')
  processQueue()
})

window.addEventListener('offline', () => {
  _setStatus('offline')
})

// ─── API pública ──────────────────────────────────────────────────────────────

export const api = {
  /** GET — nunca se encola offline, lanza ApiError si no hay red */
  get: <T = unknown>(path: string, params?: Record<string, string>) =>
    _get<T>(path, params),

  /** POST — se encola offline si no hay red */
  post: <T = unknown>(path: string, body?: unknown, optimistic?: T) =>
    _mutate<T>('POST', path, body, optimistic),

  /** PUT — se encola offline si no hay red */
  put: <T = unknown>(path: string, body?: unknown, optimistic?: T) =>
    _mutate<T>('PUT', path, body, optimistic),

  /** PATCH — se encola offline si no hay red */
  patch: <T = unknown>(path: string, body?: unknown, optimistic?: T) =>
    _mutate<T>('PATCH', path, body, optimistic),

  /** DELETE — se encola offline si no hay red */
  del: <T = unknown>(path: string, optimistic?: T) =>
    _mutate<T>('DELETE', path, undefined, optimistic),

  /** Sube un archivo (multipart) — no soporta offline */
  upload: async (path: string, formData: FormData): Promise<unknown> => {
    const token = getToken()
    const res = await fetch(`${API_PREFIX}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (res.status === 401) { clearToken(); window.location.href = '/login'; throw new ApiError('No autorizado', 401) }
    if (!res.ok) {
      const raw = await res.json().catch(() => null)
      const msg = (raw as Record<string, string>)?.detail ?? `Error ${res.status}`
      throw new ApiError(msg, res.status, raw)
    }
    return res.json()
  },

  /** Procesá la cola manualmente (normalmente se dispara al reconectar) */
  processQueue,
}

export default api
