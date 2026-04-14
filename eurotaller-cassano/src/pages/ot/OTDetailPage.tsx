// Página de detalle de OT — migrada de Supabase a FastAPI
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { formatARS } from '@/types'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  RECEPCION: 'Recepción',
  DIAGNOSTICO: 'Diagnóstico',
  PRESUPUESTO: 'Presupuesto',
  APROBACION_CLIENTE: 'Aprobación cliente',
  EN_EJECUCION: 'En ejecución',
  CONTROL_CALIDAD: 'Control de calidad',
  ENTREGA: 'Listo para entregar',
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

const NEXT_LABEL: Record<string, string> = {
  RECEPCION: '→ Pasar a Diagnóstico',
  DIAGNOSTICO: '→ Pasar a Presupuesto',
  PRESUPUESTO: '→ Enviar a Aprobación',
  APROBACION_CLIENTE: '→ Iniciar Ejecución',
  EN_EJECUCION: '→ Control de Calidad',
  CONTROL_CALIDAD: '→ Marcar Lista para entregar',
  ENTREGA: '→ Registrar Entrega',
}

const TERMINAL = new Set(['FACTURADO', 'CERRADO', 'CANCELADO'])

export default function OTDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ot, setOt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!id) return
    loadOT()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadOT() {
    setLoading(true)
    const data = await api.get<any>(`/work-orders/${id}`).catch(() => null)
    setOt(data)
    setLoading(false)
  }

  async function advance() {
    if (!ot) return
    setAdvancing(true)
    await api.patch(`/work-orders/${ot.id}/advance`, {}).catch(console.error)
    await loadOT()
    setAdvancing(false)
  }

  async function cancel() {
    if (!ot || !confirm('¿Cancelar esta OT?')) return
    setCancelling(true)
    await api.patch(`/work-orders/${ot.id}/cancel`, {}).catch(console.error)
    await loadOT()
    setCancelling(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando…</div>
  if (!ot) return <div className="p-8 text-red-500">OT no encontrada</div>

  const dias = Math.floor((Date.now() - new Date(ot.received_at ?? ot.created_at).getTime()) / 86400000)
  const canAdvance = NEXT_LABEL[ot.status] !== undefined
  const canCancel = !TERMINAL.has(ot.status)

  const itemsMO = (ot.items ?? []).filter((i: any) => i.type === 'MANO_DE_OBRA')
  const itemsRep = (ot.items ?? []).filter((i: any) => i.type === 'REPUESTO')

  const subtotalMO = itemsMO.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0)
  const subtotalRep = itemsRep.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ot')} className="text-gray-400 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{ot.number}</h1>
            <p className="text-sm text-gray-500">
              {[ot.plate, ot.brand, ot.model].filter(Boolean).join(' — ')}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[ot.status] ?? ''}`}>
          {STATUS_LABEL[ot.status] ?? ot.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Vehículo y cliente */}
          <div className="bg-white border rounded-xl p-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vehículo</p>
              <p className="font-semibold">{ot.plate ?? '—'}</p>
              <p className="text-sm text-gray-600">{[ot.brand, ot.model, ot.year].filter(Boolean).join(' ')}</p>
              {ot.color && <p className="text-xs text-gray-400">{ot.color}</p>}
              {ot.km_in && <p className="text-xs text-gray-400">KM entrada: {ot.km_in.toLocaleString()}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cliente</p>
              <p className="font-semibold">{ot.customer_name ?? '—'}</p>
              <p className="text-sm text-gray-600">{ot.customer_phone ?? ''}</p>
              <p className="text-xs text-gray-400">{ot.customer_email ?? ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mecánico</p>
              <p className="font-semibold">
                {ot.assigned_mechanic_name ?? <span className="text-gray-400 italic">Sin asignar</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fechas</p>
              {ot.received_at && <p className="text-sm">Ingreso: {new Date(ot.received_at).toLocaleDateString('es-AR')}</p>}
              {ot.delivered_at && <p className="text-sm text-green-600">Entrega: {new Date(ot.delivered_at).toLocaleDateString('es-AR')}</p>}
              <p className="text-xs text-gray-400 mt-1">{dias} días en taller</p>
            </div>
          </div>

          {/* Notas */}
          {(ot.reception_notes || ot.diagnosis_notes || ot.delivery_notes) && (
            <div className="bg-white border rounded-xl p-5 space-y-3">
              {ot.reception_notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Problema / recepción</p>
                  <p className="text-sm text-gray-800">{ot.reception_notes}</p>
                </div>
              )}
              {ot.diagnosis_notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Diagnóstico</p>
                  <p className="text-sm text-gray-800">{ot.diagnosis_notes}</p>
                </div>
              )}
              {ot.delivery_notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notas de entrega</p>
                  <p className="text-sm text-gray-800">{ot.delivery_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Items mano de obra */}
          {itemsMO.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <p className="text-sm font-medium text-gray-700">Mano de obra</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Horas</th>
                    <th className="px-4 py-2 text-right">$/h</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itemsMO.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">{item.description}</td>
                      <td className="px-4 py-2 text-right">{item.hours}h</td>
                      <td className="px-4 py-2 text-right">{formatARS(item.hourly_rate ?? 0)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatARS(item.subtotal ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Items repuestos */}
          {itemsRep.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <p className="text-sm font-medium text-gray-700">Repuestos</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">P. Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itemsRep.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        {item.product_name ?? item.description ?? '—'}
                        {item.variant_sku && <span className="text-xs text-gray-400 ml-1">({item.variant_sku})</span>}
                      </td>
                      <td className="px-4 py-2 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-right">{formatARS(item.unit_price ?? 0)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatARS(item.subtotal ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Columna derecha: Totales y acciones */}
        <div className="space-y-4">
          {/* Totales */}
          <div className="bg-white border rounded-xl p-5 space-y-2">
            <p className="text-sm font-semibold text-gray-700 border-b pb-2 mb-3">Resumen</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Mano de obra</span>
              <span>{formatARS(subtotalMO)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Repuestos</span>
              <span>{formatARS(subtotalRep)}</span>
            </div>
            {ot.discount_pct > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento ({ot.discount_pct}%)</span>
                <span>- {formatARS((subtotalMO + subtotalRep) * ot.discount_pct / 100)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
              <span>Total</span>
              <span>{formatARS(ot.final_total ?? ot.estimated_total ?? subtotalMO + subtotalRep)}</span>
            </div>
          </div>

          {/* Acciones de estado */}
          <div className="bg-white border rounded-xl p-5 space-y-2">
            <p className="text-sm font-semibold text-gray-700 mb-3">Acciones</p>

            {canAdvance && (
              <button
                onClick={advance}
                disabled={advancing}
                className="w-full py-2 rounded-lg text-sm font-medium border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
              >
                {advancing ? 'Actualizando…' : NEXT_LABEL[ot.status]}
              </button>
            )}

            {canCancel && (
              <button
                onClick={cancel}
                disabled={cancelling}
                className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {cancelling ? 'Cancelando…' : 'Cancelar OT'}
              </button>
            )}

            {TERMINAL.has(ot.status) && (
              <p className="text-xs text-gray-400 text-center pt-1">Esta OT está cerrada</p>
            )}
          </div>

          {ot.status === 'ENTREGA' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Stock descontado</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Los repuestos fueron descontados automáticamente del inventario.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
