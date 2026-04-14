import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Building2,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Package,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { listEmpresas, type EmpresaAPI } from '../lib/api'

const RUBROS: Record<string, string> = {
  INDUMENTARIA: 'Indumentaria', MECANICO: 'Mecánico', KIOSCO: 'Kiosco',
  DEPOSITO: 'Depósito', RESTAURANTE: 'Restaurante', FERRETERIA: 'Ferretería',
  FARMACIA: 'Farmacia', LIBRERIA: 'Librería', OTRO: 'Otro',
  indumentaria: 'Indumentaria', mecanico: 'Mecánico', kiosco: 'Kiosco',
  deposito: 'Depósito', restaurante: 'Restaurante', ferreteria: 'Ferretería',
  farmacia: 'Farmacia', libreria: 'Librería', otro: 'Otro',
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<EmpresaAPI[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listEmpresas()
      setEmpresas(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando empresas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtradas = empresas.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.name.toLowerCase().includes(q) ||
      (e.industry_type ?? '').toLowerCase().includes(q) ||
      (e.cuit ?? '').includes(q)
    )
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="text-slate-400 text-sm mt-1">
            {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} en el sistema
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Link
            to="/empresas/nueva"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusCircle size={16} />
            Nueva empresa
          </Link>
        </div>
      </div>

      <div className="relative w-64">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-full"
        />
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error} — Verificar que el backend corra en puerto 8000
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Empresa</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Rubro</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">CUIT</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Estado</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Modulos</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Usuarios</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Locales</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                  {search ? 'No hay empresas que coincidan' : 'No hay empresas en el sistema'}
                </td>
              </tr>
            ) : (
              filtradas.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => navigate(`/empresas/${emp.id}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase"
                        style={{ backgroundColor: emp.primary_color ?? '#6366f1' }}
                      >
                        {(emp.app_name ?? emp.name).slice(0, 2)}
                      </div>
                      <div>
                        <span className="font-medium text-white group-hover:text-indigo-300 transition-colors block">
                          {emp.app_name ?? emp.name}
                        </span>
                        {emp.app_name && emp.app_name !== emp.name && (
                          <span className="text-xs text-slate-500">{emp.name}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {RUBROS[emp.industry_type ?? ''] ?? emp.industry_type ?? 'Sin rubro'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{emp.cuit ?? 'Sin CUIT'}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 w-fit text-xs px-2 py-0.5 rounded-full font-medium ${
                      emp.is_active ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-700/40'
                    }`}>
                      {emp.is_active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {emp.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Package size={13} className="text-slate-500" />
                      {emp.module_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums">{emp.user_count}</td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums">{emp.local_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{filtradas.length} de {empresas.length} empresas</span>
          <Link to="/empresas/nueva" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
            Nueva empresa <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}
