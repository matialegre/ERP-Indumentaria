import { useState } from 'react'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { login } from '../lib/api'

interface Props {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(user, pass)
      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="bg-red-600/20 rounded-2xl p-4 border border-red-500/30">
            <Shield className="w-12 h-12 text-red-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-1">Super Admin</h1>
        <p className="text-slate-400 text-center text-sm mb-8">Acceso restringido — Solo Matías</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Usuario</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-500"
              placeholder="admin1"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:border-red-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !user || !pass}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Credenciales de acceso</p>
          <p className="text-xs font-mono text-slate-300">usuario: <span className="text-red-400">admin1</span> · contraseña: <span className="text-red-400">admin</span></p>
        </div>
        <p className="text-center text-slate-600 text-xs mt-4">
          ERP Plataforma · Panel de Control
        </p>
      </div>
    </div>
  )
}
