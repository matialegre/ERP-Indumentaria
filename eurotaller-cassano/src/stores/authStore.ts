import { create } from 'zustand'
import { api, setToken, clearToken } from '@/lib/api'

// Tipo de usuario según la API FastAPI
interface FastAPIUser {
  id: number
  username: string
  full_name: string | null
  email: string | null
  role: string
  company_id: number | null
  is_active: boolean
}

// Shim compatible con el tipo Usuario de B para no romper todo el resto del código
export interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: string
  activo: boolean
  created_at: string
  // Campos extras de FastAPI
  _raw?: FastAPIUser
}

interface AuthState {
  user: Usuario | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadUser: () => Promise<void>
}

function mapUser(u: FastAPIUser): Usuario {
  const parts = (u.full_name ?? u.username ?? '').split(' ')
  return {
    id: String(u.id),
    nombre: parts[0] ?? u.username,
    apellido: parts.slice(1).join(' '),
    email: u.email ?? '',
    rol: u.role.toLowerCase() as Usuario['rol'],
    activo: u.is_active,
    created_at: new Date().toISOString(),
    _raw: u,
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  loadUser: async () => {
    set({ loading: true })
    try {
      const u = await api.get<FastAPIUser>('/auth/me')
      set({ user: mapUser(u), loading: false })
    } catch {
      clearToken()
      set({ user: null, loading: false })
    }
  },

  signIn: async (username: string, password: string) => {
    const data = await api.post<{ access_token: string }>('/auth/login', { username, password })
    setToken(data.access_token)
    const u = await api.get<FastAPIUser>('/auth/me')
    set({ user: mapUser(u) })
  },

  signOut: () => {
    clearToken()
    set({ user: null })
    return Promise.resolve()
  },
}))

export type { RolUsuario } from '@/types'

/** Hook: ¿tiene el usuario alguno de los roles requeridos? */
export const hasRole = (user: Usuario | null, ...roles: string[]): boolean => {
  if (!user) return false
  return roles.some(r => r.toLowerCase() === user.rol.toLowerCase())
}
