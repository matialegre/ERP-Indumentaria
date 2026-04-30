import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { listEmpresas, type EmpresaAPI } from '../lib/api'
import {
  MODULOS,
  MODULOS_POR_CATEGORIA,
  LABEL_CATEGORIA,
  LABEL_RUBRO,
  calcularPrecio,
  type Categoria,
} from '../lib/modules'

const CAT_ORDER: Categoria[] = ['core', 'operaciones', 'integraciones', 'reportes', 'crm', 'rfid']

const CAT_COLORS: Record<Categoria, string> = {
  core: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  operaciones: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  integraciones: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  reportes: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  crm: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  rfid: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
}

const RUBROS: Record<string, string> = {
  INDUMENTARIA: 'Indumentaria',
  MECANICO: 'Mecánico',
  KIOSCO: 'Kiosco',
  DEPOSITO: 'Depósito',
  RESTAURANTE: 'Restaurante',
  FERRETERIA: 'Ferretería',
  FARMACIA: 'Farmacia',
  LIBRERIA: 'Librería',
  OTRO: 'Otro',
}

export default function Modulos() {
  const [empresas, setEmpresas] = useState<EmpresaAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await listEmpresas()
        if (mounted) setEmpresas(Array.isArray(data) ? data : [])
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : 'Error cargando módulos')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const modulosLive = useMemo(() => MODULOS.filter(m => !m.esCore), [])
  const precioMaximo = useMemo(() => calcularPrecio(modulosLive.map(m => m.slug)), [modulosLive])
  const modulosActivosTotales = useMemo(
    () => empresas.reduce((sum, empresa) => sum + empresa.module_count, 0),
    [empresas]
  )

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Módulos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Catálogo live del ERP. Solo se muestran módulos que hoy impactan de verdad en los clientes.
          </p>
        </div>
        <Link
          to="/empresas"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition-colors"
        >
          <Building2 size={15} />
          Gestionar por empresa
        </Link>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-sm text-indigo-200">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-white">Activación real en vivo</p>
            <p className="text-indigo-200/90 mt-1">
              Cuando activás o desactivás un módulo desde una empresa, el ERP cliente lo refresca solo en hasta 15 segundos.
              Si una pantalla queda deshabilitada, el usuario es redirigido al dashboard automáticamente.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Módulos live</p>
          <p className="text-3xl font-bold text-white mt-2">{modulosLive.length}</p>
          <p className="text-xs text-slate-400 mt-1">Activables desde Super Admin</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Core</p>
          <p className="text-3xl font-bold text-white mt-2">{MODULOS_POR_CATEGORIA.core.length}</p>
          <p className="text-xs text-slate-400 mt-1">Siempre incluidos</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Activaciones totales</p>
          <p className="text-3xl font-bold text-white mt-2">{modulosActivosTotales}</p>
          <p className="text-xs text-slate-400 mt-1">Suma de todas las empresas</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Precio full stack</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">${precioMaximo}</p>
          <p className="text-xs text-slate-400 mt-1">Si una empresa activa todos los live</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-4 gap-4">
        {CAT_ORDER.map(cat => (
          <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className={`inline-flex px-2 py-1 rounded-full border text-xs font-semibold ${CAT_COLORS[cat]}`}>
              {LABEL_CATEGORIA[cat]}
            </div>
            <p className="text-2xl font-bold text-white mt-3">{MODULOS_POR_CATEGORIA[cat].length}</p>
            <p className="text-xs text-slate-400 mt-1">
              ${MODULOS_POR_CATEGORIA[cat].reduce((sum, modulo) => sum + modulo.precioUsd, 0)}/mes
            </p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Empresas</h2>
            <p className="text-xs text-slate-400 mt-0.5">Entrá a cada empresa para editar sus módulos</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={13} />
            Recargar
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-300">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Empresa</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Rubro</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Módulos activos</th>
              <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : empresas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  No hay empresas cargadas.
                </td>
              </tr>
            ) : (
              empresas.map(empresa => (
                <tr key={empresa.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-white font-medium">{empresa.app_name ?? empresa.name}</td>
                  <td className="px-4 py-3 text-slate-400">{RUBROS[empresa.industry_type ?? ''] ?? empresa.industry_type ?? 'Sin rubro'}</td>
                  <td className="px-4 py-3 text-slate-300">{empresa.module_count}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/empresas/${empresa.id}`}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                    >
                      Configurar <ChevronRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        {CAT_ORDER.map(cat => (
          <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>
                {LABEL_CATEGORIA[cat]}
              </span>
              <span className="text-xs text-slate-500">
                {MODULOS_POR_CATEGORIA[cat].length} módulo{MODULOS_POR_CATEGORIA[cat].length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="divide-y divide-slate-800/50">
              {MODULOS_POR_CATEGORIA[cat].map(modulo => (
                <div key={modulo.slug} className="flex items-start gap-4 px-5 py-4">
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-200">
                    <Package size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{modulo.nombre}</p>
                      {modulo.esCore && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          Core
                        </span>
                      )}
                      {!modulo.esCore && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{modulo.descripcion}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {modulo.rubros.map(rubro => (
                        <span key={rubro} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {rubro === 'todas' ? 'Todos los rubros' : LABEL_RUBRO[rubro]}
                        </span>
                      ))}
                      {modulo.dependencias.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Requiere: {modulo.dependencias.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-400">
                    ${modulo.precioUsd}/mes
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
