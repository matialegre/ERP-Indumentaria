/**
 * API client para Super Admin — conecta al backend FastAPI como MEGAADMIN.
 * Guarda el token en localStorage bajo la clave 'sa_token'.
 */

const API_BASE = 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'sa_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  })
  if (res.status === 401 || res.status === 403) {
    clearToken()
    window.location.reload()
    throw new Error(res.status === 403 ? 'Sin permisos — usá la cuenta admin1' : 'Sesión expirada')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail || `Error ${res.status}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const data = await request<{ access_token: string; user?: { role: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(data.access_token)
  // Verificar que sea MEGAADMIN
  const me = await request<{ role: string }>('/auth/me')
  if (me.role !== 'MEGAADMIN') {
    clearToken()
    throw new Error(`El usuario "${username}" no es MEGAADMIN — usá la cuenta admin1`)
  }
}

// ── Empresas ────────────────────────────────────────────────────────────────

export interface EmpresaAPI {
  id: number
  name: string
  cuit: string
  industry_type: string | null
  is_active: boolean
  user_count: number
  local_count: number
  module_count: number
  app_name: string | null
  primary_color: string | null
  created_at: string
}

export interface EmpresaDetailAPI {
  id: number
  name: string
  cuit: string
  address: string | null
  phone: string | null
  email: string | null
  industry_type: string | null
  is_active: boolean
  app_name: string | null
  primary_color: string | null
  created_at: string
  users: UserBriefAPI[]
  locals: LocalBriefAPI[]
  modules: ModuleBriefAPI[]
}

export interface UserBriefAPI {
  id: number
  username: string
  full_name: string
  email: string | null
  role: string
  is_active: boolean
  modules_override: string[] | null
}

export interface LocalBriefAPI {
  id: number
  name: string
  code: string
  is_active: boolean
}

export interface ModuleBriefAPI {
  id: number
  module_slug: string
  is_active: boolean
  custom_name: string | null
}

export function listEmpresas(): Promise<EmpresaAPI[]> {
  return request('/mega/companies')
}

export function getEmpresa(id: number): Promise<EmpresaDetailAPI> {
  return request(`/mega/companies/${id}`)
}

export function toggleCompanyActive(companyId: number): Promise<{ is_active: boolean }> {
  return request(`/mega/companies/${companyId}/toggle`, { method: 'PATCH' })
}

export function saveModules(companyId: number, slugs: string[]): Promise<void> {
  return request(`/mega/companies/${companyId}/modules`, {
    method: 'PATCH',
    body: JSON.stringify({ module_slugs: slugs }),
  })
}

// ── Usuarios ────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  username: string
  password: string
  full_name: string
  email?: string
  role: string
  company_id: number
  modules_override?: string[] | null
}

export function createUser(payload: CreateUserPayload): Promise<UserBriefAPI> {
  return request('/users/', { method: 'POST', body: JSON.stringify(payload) })
}

export function listUsers(companyId?: number): Promise<UserBriefAPI[]> {
  const qs = companyId ? `?company_id=${companyId}` : ''
  return request(`/users/${qs}`)
}

export function saveUserModules(userId: number, modulesOverride: string[] | null): Promise<UserBriefAPI> {
  return request<UserBriefAPI>(`/mega/users/${userId}/modules`, {
    method: 'PATCH',
    body: JSON.stringify({ modules_override: modulesOverride !== null ? modulesOverride.map(s => s.toUpperCase()) : null }),
  })
}

export function getUser(userId: number): Promise<UserBriefAPI> {
  return request<UserBriefAPI>(`/mega/users/${userId}`)
}
