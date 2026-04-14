/**
 * supabase.ts — MIGRADO a FastAPI.
 *
 * Supabase fue eliminado del stack. Este archivo provee:
 * 1. Re-export de api.ts (el cliente HTTP real)
 * 2. Un stub compatible con la API de Supabase para páginas aún no migradas,
 *    usando Proxy para que cualquier cadena de métodos sea válida sin crashear.
 */

export { api, setToken, clearToken, getIsOnline, subscribeConnStatus } from './api'

// ─── Proxy helper — hace cualquier método encadenable ──────────────────────────

function makeStubChain(resolveWith: unknown = { data: [] as unknown[], error: null }): any {
  return new Proxy(
    // Es una función para que `new Proxy(fn, ...)` funcione como constructor si hace falta
    function () { return makeStubChain(resolveWith) },
    {
      apply: () => makeStubChain(resolveWith),
      get: (_t, prop: string) => {
        // Métodos que terminan la cadena como Promises
        if (prop === 'then') return (res: (v: unknown) => void) => Promise.resolve(resolveWith).then(res)
        if (prop === 'catch') return (rej: (e: unknown) => void) => Promise.resolve(resolveWith).catch(rej)
        if (prop === 'finally') return (fn: () => void) => Promise.resolve(resolveWith).finally(fn)

        // Métodos terminales específicos de Supabase que devuelven Promises directamente
        if (prop === 'single')   return () => Promise.resolve({ data: null, error: null })
        if (prop === 'insert')   return (_rows: unknown) => makeStubChain({ data: null, error: null })
        if (prop === 'update')   return (_vals: unknown) => makeStubChain({ data: null, error: null })
        if (prop === 'delete')   return () => makeStubChain({ data: null, error: null })
        if (prop === 'upsert')   return (_rows: unknown) => makeStubChain({ data: null, error: null })

        // Cualquier otra propiedad → volver a devolver el chain (select, eq, order, limit, etc.)
        return () => makeStubChain(resolveWith)
      },
    }
  )
}

// ─── Stub de Supabase compatible ───────────────────────────────────────────────

export const supabase = {
  from: (_table: string) => makeStubChain(),
  rpc: (_fn: string, _params?: unknown) => Promise.resolve({ data: 0, error: null }),
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async (_creds: unknown) => ({
      data: { session: null },
      error: new Error('Supabase eliminado — usá FastAPI login'),
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
}

export default supabase

