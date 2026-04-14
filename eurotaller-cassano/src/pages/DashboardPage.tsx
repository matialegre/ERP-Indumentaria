import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatARS } from '@/types'
import {
  Wrench, Car, AlertTriangle, Clock,
  TrendingUp, CheckCircle2, ArrowRight,
} from 'lucide-react'

interface DashboardData {
  by_status: Record<string, number>
  total_active: number
  month_count: number
  month_revenue: number
}

interface OtResumen {
  id: number
  number: string
  status: string
  plate: string | null
  brand: string | null
  model: string | null
  customer_name: string | null
  dias_en_taller: number
  final_total: number | null
}

const STATUS_LABEL: Record<string, string> = {
  RECEPCION: 'Recepción',
  DIAGNOSTICO: 'Diagnóstico',
  PRESUPUESTO: 'Presupuesto',
  APROBACION_CLIENTE: 'Aprobación',
  EN_EJECUCION: 'En ejecución',
  CONTROL_CALIDAD: 'Ctrl. calidad',
  ENTREGA: '✓ Listo',
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

const TERMINAL = new Set(['CERRADO', 'CANCELADO', 'FACTURADO'])

export default function DashboardPage() {
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [otsRecientes, setOtsRecientes] = useState<OtResumen[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [dashData, otsData] = await Promise.all([
        api.get<DashboardData>('/work-orders/dashboard').catch(() => null),
        api.get<{ items: any[] }>('/work-orders/', { limit: '8' }).catch(() => ({ items: [] })),
      ])

      setDash(dashData)

      const otsAbiertas = (otsData?.items ?? []).filter(
        (o: any) => !TERMINAL.has(o.status)
      )
      setOtsRecientes(
        otsAbiertas.map((o: any) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          plate: o.plate,
          brand: o.brand,
          model: o.model,
          customer_name: o.customer_name,
          dias_en_taller: Math.floor(
            (Date.now() - new Date(o.received_at ?? o.created_at).getTime()) / 86400000
          ),
          final_total: o.final_total,
        }))
      )
      setLoading(false)
    }
    loadData()
  }, [])

  const otsAbiertas = dash
    ? Object.entries(dash.by_status)
        .filter(([k]) => !TERMINAL.has(k) && k !== 'ENTREGA')
        .reduce((s, [, v]) => s + v, 0)
    : 0
  const otsListas = dash?.by_status['ENTREGA'] ?? 0

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Cargando dashboard…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="OTs en proceso" value={otsAbiertas} icon={Wrench} color="blue" link="/ot" />
        <StatCard label="Listas para entregar" value={otsListas} icon={CheckCircle2} color="green" link="/ot?status=ENTREGA" />
        <StatCard label="Trabajos este mes" value={dash?.month_count ?? 0} icon={Clock} color="purple" link="/ot" />
        <StatCard
          label="Facturación del mes"
          value={formatARS(dash?.month_revenue ?? 0)}
          icon={TrendingUp}
          color="orange"
          link="/facturacion"
          isText
        />
      </div>

      {/* Breakdown por estado */}
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(dash.by_status)
            .filter(([, v]) => v > 0)
            .map(([st, count]) => (
              <Link
                key={st}
                to={`/ot?status=${st}`}
                className="bg-white border rounded-xl p-3 flex flex-col gap-1 hover:shadow-md transition-shadow"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${STATUS_COLOR[st] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[st] ?? st}
                </span>
                <span className="text-2xl font-bold text-gray-900">{count}</span>
              </Link>
            ))}
        </div>
      )}

      {/* OTs abiertas recientes */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Órdenes de Trabajo activas
          </h2>
          <Link to="/ot" className="text-sm text-orange-600 hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                <th className="px-5 py-3">N° OT</th>
                <th className="px-5 py-3">Vehículo</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Días</th>
              </tr>
            </thead>
            <tbody>
              {otsRecientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    No hay órdenes activas
                  </td>
                </tr>
              ) : (
                otsRecientes.map((ot) => (
                  <tr key={ot.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono font-medium">
                      <Link to={`/ot/${ot.id}`} className="text-orange-600 hover:underline">
                        {ot.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{ot.plate ?? '—'}</p>
                      <p className="text-gray-500 text-xs">{[ot.brand, ot.model].filter(Boolean).join(' ')}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{ot.customer_name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[ot.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[ot.status] ?? ot.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={ot.dias_en_taller > 7 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {ot.dias_en_taller}d
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ElementType
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'yellow' | 'gray'
  link: string
  isText?: boolean
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   text: 'text-blue-700' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  text: 'text-green-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    text: 'text-red-700' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-700' },
  gray:   { bg: 'bg-gray-50',   icon: 'text-gray-400',   text: 'text-gray-600' },
}

function StatCard({ label, value, icon: Icon, color, link, isText }: StatCardProps) {
  const c = COLOR_MAP[color]
  return (
    <Link to={link} className={`${c.bg} rounded-xl p-4 flex flex-col gap-2 hover:shadow-md transition-shadow`}>
      <Icon className={`w-5 h-5 ${c.icon}`} />
      <p className={`${isText ? 'text-base' : 'text-2xl'} font-bold ${c.text}`}>{value}</p>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
    </Link>
  )
}

// Necesario para que Car no genere error de unused import
void Car
void AlertTriangle
