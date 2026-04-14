import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Plus, Search, Wrench, ChevronRight } from 'lucide-react'

// Mapeo de status C → labels y colores
const STATUS_LABEL: Record<string, string> = {
  RECEPCION: 'Recepción',
  DIAGNOSTICO: 'Diagnóstico',
  PRESUPUESTO: 'Presupuesto',
  APROBACION_CLIENTE: 'Aprobación',
  EN_EJECUCION: 'En ejecución',
  CONTROL_CALIDAD: 'Ctrl. calidad',
  ENTREGA: 'Listo p/entregar',
  FACTURADO: 'Facturada',
  CERRADO: 'Cerrada',
  CANCELADO: 'Cancelada',
}

const STATUS_COLOR: Record<string, string> = {
  RECEPCION: 'bg-blue-100 text-blue-700',
  DIAGNOSTICO: 'bg-yellow-100 text-yellow-700',
  PRESUPUESTO: 'bg-purple-100 text-purple-700',
  APROBACION_CLIENTE: 'bg-orange-100 text-orange-700',
  EN_EJECUCION: 'bg-indigo-100 text-indigo-700',
  CONTROL_CALIDAD: 'bg-cyan-100 text-cyan-700',
  ENTREGA: 'bg-green-100 text-green-700',
  FACTURADO: 'bg-green-200 text-green-800',
  CERRADO: 'bg-gray-100 text-gray-600',
  CANCELADO: 'bg-red-100 text-red-700',
}

const ALL_STATUSES = Object.keys(STATUS_LABEL)
const TERMINAL = new Set(['CERRADO', 'CANCELADO', 'FACTURADO'])

interface OtRow {
  id: number
  number: string
  status: string
  priority: string
  plate: string | null
  brand: string | null
  model: string | null
  customer_name: string | null
  assigned_mechanic_name: string | null
  reception_notes: string | null
  estimated_total: number | null
  final_total: number | null
  received_at: string | null
  created_at: string | null
}

export default function OTListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFiltro = searchParams.get('status')
  const [ots, setOts] = useState<OtRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    loadOts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro])

  async function loadOts() {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (statusFiltro) params.status = statusFiltro

    const res = await api.get<{ items: any[] }>('/work-orders/', params).catch(() => ({ items: [] }))
    const items: OtRow[] = (res?.items ?? []).map((o: any) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      priority: o.priority,
      plate: o.plate,
      brand: o.brand,
      model: o.model,
      customer_name: o.customer_name,
      assigned_mechanic_name: o.assigned_mechanic_name,
      reception_notes: null,
      estimated_total: o.estimated_total,
      final_total: o.final_total,
      received_at: o.received_at,
      created_at: o.created_at,
    }))

    // Si no hay filtro, excluir terminales
    setOts(statusFiltro ? items : items.filter(o => !TERMINAL.has(o.status)))
    setLoading(false)
  }

  const otsFiltradas = ots.filter((o) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      (o.plate ?? '').toLowerCase().includes(q) ||
      (o.brand ?? '').toLowerCase().includes(q) ||
      (o.model ?? '').toLowerCase().includes(q) ||
      (o.customer_name ?? '').toLowerCase().includes(q) ||
      o.number.toLowerCase().includes(q)
    )
  })

  const diasDesde = (fecha: string | null) => {
    if (!fecha) return 0
    return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Trabajo</h1>
        </div>
        <Link
          to="/ot/nueva"
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva OT
        </Link>
      </div>

      {/* Filtros de estado */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSearchParams({})}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !statusFiltro
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          En proceso
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setSearchParams({ status: s })}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFiltro === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por patente, cliente o N° OT…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : otsFiltradas.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay órdenes de trabajo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                <th className="px-5 py-3">N° OT</th>
                <th className="px-5 py-3">Vehículo</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Técnico</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Días</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {otsFiltradas.map((ot) => {
                const dias = diasDesde(ot.received_at ?? ot.created_at)
                const total = ot.final_total ?? ot.estimated_total ?? 0
                return (
                  <tr key={ot.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/ot/${ot.id}`}
                        className="font-mono font-semibold text-orange-600 hover:underline"
                      >
                        {ot.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold">{ot.plate ?? '—'}</p>
                      <p className="text-gray-500 text-xs">{[ot.brand, ot.model].filter(Boolean).join(' ')}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{ot.customer_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{ot.assigned_mechanic_name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[ot.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[ot.status] ?? ot.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={dias > 7 ? 'text-red-600 font-medium' : dias > 3 ? 'text-yellow-600' : 'text-gray-500'}>
                        {dias}d
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {total > 0 ? `$${total.toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <Link to={`/ot/${ot.id}`} className="text-gray-400 hover:text-gray-600">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{otsFiltradas.length} registros</p>
    </div>
  )
}
