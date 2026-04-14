import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatARS, type IvaPorcentaje } from '@/types'
import {
  Receipt, Plus, Search, ChevronRight, X, Printer,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  Loader2, CreditCard,
} from 'lucide-react'

// ─── Tipos locales ─────────────────────────────────────────────────────────────

type EstadoComprobante = 'borrador' | 'emitida' | 'contingencia' | 'rechazada' | 'anulada'
type TipoComprobante = 'A' | 'B' | 'C' | 'X'

interface ComprobanteRow {
  id: string
  tipo_comprobante: TipoComprobante
  punto_venta: number
  numero: number
  numero_display: string
  estado: EstadoComprobante
  fecha_emision: string
  total: number
  cliente_nombre: string
  cae?: string
  cae_vencimiento?: string
  presupuesto_id?: string
  presupuesto_numero?: number
}

interface PresupuestoAprobado {
  id: string
  numero_presupuesto: number
  total: number
  cliente_id: string
  cliente_nombre: string
  vehiculo: string
  patente: string
  subtotal_sin_iva: number
  iva_monto: number
  descuento: number
  items: any[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoComprobante, string> = {
  borrador:     'Borrador',
  emitida:      'Emitida',
  contingencia: 'Contingencia',
  rechazada:    'Rechazada',
  anulada:      'Anulada',
}

const ESTADO_COLOR: Record<EstadoComprobante, string> = {
  borrador:     'bg-gray-100 text-gray-600',
  emitida:      'bg-green-100 text-green-700',
  contingencia: 'bg-orange-100 text-orange-700',
  rechazada:    'bg-red-100 text-red-700',
  anulada:      'bg-gray-100 text-gray-500 line-through',
}

const ESTADO_ICON: Record<EstadoComprobante, React.ElementType> = {
  borrador:     Clock,
  emitida:      CheckCircle2,
  contingencia: AlertTriangle,
  rechazada:    XCircle,
  anulada:      XCircle,
}

const TIPO_COLOR: Record<TipoComprobante, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-green-100 text-green-700',
  C: 'bg-purple-100 text-purple-700',
  X: 'bg-gray-100 text-gray-600',
}

function formatComprobante(tipo: TipoComprobante, pv: number, num: number) {
  return `${tipo} ${String(pv).padStart(4, '0')}-${String(num).padStart(8, '0')}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturacionPage() {
  const { user } = useAuthStore()
  const [comprobantes, setComprobantes] = useState<ComprobanteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoComprobante | 'todos'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const [showDetalle, setShowDetalle] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const loadComprobantes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comprobantes')
      .select(`
        id, tipo_comprobante, punto_venta, numero, estado,
        fecha_emision, total, cae, cae_vencimiento,
        clientes(nombre),
        presupuestos(id, numero_presupuesto)
      `)
      .order('numero', { ascending: false })
      .limit(200)

    if (data) {
      setComprobantes(data.map((c: any) => ({
        id: c.id,
        tipo_comprobante: c.tipo_comprobante,
        punto_venta: c.punto_venta,
        numero: c.numero,
        numero_display: formatComprobante(c.tipo_comprobante, c.punto_venta, c.numero),
        estado: c.estado,
        fecha_emision: c.fecha_emision,
        total: c.total,
        cliente_nombre: c.clientes?.nombre ?? '—',
        cae: c.cae,
        cae_vencimiento: c.cae_vencimiento,
        presupuesto_id: c.presupuestos?.id,
        presupuesto_numero: c.presupuestos?.numero_presupuesto,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadComprobantes() }, [loadComprobantes])

  const filtrados = comprobantes.filter(c => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    const matchBusqueda = !busqueda ||
      c.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.numero_display.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.cae ?? '').includes(busqueda)
    return matchEstado && matchBusqueda
  })

  async function abrirDetalle(id: string) {
    const { data } = await supabase
      .from('comprobantes')
      .select(`*, clientes(*), comprobante_items(*), presupuestos(id, numero_presupuesto)`)
      .eq('id', id).single()
    if (data) { setDetalle(data); setShowDetalle(true) }
  }

  async function anular(id: string) {
    if (!confirm('¿Confirmar anulación del comprobante?')) return
    const { error } = await supabase.from('comprobantes').update({ estado: 'anulada' }).eq('id', id)
    if (error) { notify('Error: ' + error.message, 'err'); return }
    notify('Comprobante anulado')
    await loadComprobantes()
    setShowDetalle(false)
  }

  async function registrarPago(comprobanteId: string, total: number) {
    const { error } = await supabase.from('cobros').insert({
      comprobante_id: comprobanteId,
      cliente_id: detalle?.cliente_id,
      empresa_id: detalle?.empresa_id,
      total_cobrado: total,
      fecha_cobro: new Date().toISOString().slice(0, 10),
      estado: 'cobrado',
      created_by_id: user?.id,
    })
    if (error) { notify('Error al registrar pago: ' + error.message, 'err'); return }
    await supabase.from('comprobantes').update({ estado: 'emitida' }).eq('id', comprobanteId)
    notify('✅ Pago registrado')
    await loadComprobantes()
    await abrirDetalle(comprobanteId)
  }

  const esAdmin = user?.rol === 'admin' || user?.rol === 'contador'

  const totalFiltrados = filtrados.reduce((s, c) => c.estado !== 'anulada' ? s + c.total : s, 0)

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.tipo === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
        </div>
        {esAdmin && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> Emitir comprobante
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'borrador', 'emitida', 'contingencia', 'rechazada', 'anulada'] as const).map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtroEstado === e
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {e === 'todos' ? 'Todos' : ESTADO_LABEL[e as EstadoComprobante]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input placeholder="Buscar por cliente, número o CAE…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay comprobantes</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                <th className="px-5 py-3">Número</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">CAE</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(c => {
                const EIcon = ESTADO_ICON[c.estado]
                return (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${TIPO_COLOR[c.tipo_comprobante]}`}>
                          {c.tipo_comprobante}
                        </span>
                        <span className="font-mono text-sm">{c.numero_display}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium">{c.cliente_nombre}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {c.fecha_emision.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[c.estado]}`}>
                        <EIcon className="w-3 h-3" />
                        {ESTADO_LABEL[c.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {c.cae
                        ? <span className="font-mono text-xs text-gray-600">{c.cae}</span>
                        : c.estado === 'contingencia'
                          ? <span className="text-xs text-orange-500 italic">Provisional — offline</span>
                          : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">{formatARS(c.total)}</td>
                    <td className="px-2 py-3">
                      <button onClick={() => abrirDetalle(c.id)} className="text-gray-400 hover:text-gray-700">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{filtrados.length} comprobantes</span>
        {filtrados.length > 0 && <span>Total visible: {formatARS(totalFiltrados)}</span>}
      </div>

      {showModal && (
        <FacturacionModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadComprobantes(); notify('✅ Comprobante emitido') }}
          userId={user?.id}
        />
      )}

      {showDetalle && detalle && (
        <ComprobanteDetalle
          comprobante={detalle}
          onClose={() => setShowDetalle(false)}
          onAnular={() => anular(detalle.id)}
          onPago={() => registrarPago(detalle.id, detalle.total)}
          onPrint={() => setShowPrint(true)}
          esAdmin={esAdmin}
        />
      )}

      {showPrint && detalle && (
        <PrintView comprobante={detalle} onClose={() => setShowPrint(false)} />
      )}
    </div>
  )
}

// ─── Modal: emitir comprobante ────────────────────────────────────────────────

function FacturacionModal({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [presupuestos, setPresupuestos] = useState<PresupuestoAprobado[]>([])
  const [presSeleccionado, setPresSeleccionado] = useState<PresupuestoAprobado | null>(null)
  const [tipo, setTipo] = useState<TipoComprobante>('B')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [esOffline] = useState(!navigator.onLine)

  useEffect(() => {
    supabase.from('presupuestos')
      .select(`id, numero_presupuesto, total, cliente_id,
        subtotal_sin_iva, iva_monto, descuento,
        clientes(nombre),
        vehiculos(patente, marca, modelo),
        presupuesto_items(*)`)
      .eq('estado', 'aprobado')
      .then(({ data }: { data: any }) => {
        setPresupuestos((data ?? []).map((p: any) => ({
          total: p.total, cliente_id: p.cliente_id,
          cliente_nombre: p.clientes?.nombre ?? '—',
          vehiculo: `${p.vehiculos?.marca ?? ''} ${p.vehiculos?.modelo ?? ''}`.trim(),
          patente: p.vehiculos?.patente ?? '—',
          subtotal_sin_iva: p.subtotal_sin_iva, iva_monto: p.iva_monto,
          descuento: p.descuento, items: p.presupuesto_items ?? [],
        })))
      })
  }, [])

  async function handleEmitir() {
    if (!presSeleccionado) { setError('Seleccioná un presupuesto aprobado'); return }
    setSaving(true); setError('')

    const estado: EstadoComprobante = esOffline ? 'contingencia' : 'borrador'
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: comp, error: compErr } = await supabase.from('comprobantes').insert({
      presupuesto_id: presSeleccionado.id,
      cliente_id: presSeleccionado.cliente_id,
      tipo_comprobante: tipo,
      punto_venta: 1,
      estado,
      fecha_emision: hoy,
      subtotal_gravado: presSeleccionado.subtotal_sin_iva,
      iva_monto: presSeleccionado.iva_monto,
      total: presSeleccionado.total,
      created_by_id: userId ?? null,
    }).select('id').single()

    if (compErr || !comp) {
      setError('Error al emitir: ' + compErr?.message); setSaving(false); return
    }

    if (presSeleccionado.items.length > 0) {
      await supabase.from('comprobante_items').insert(
        presSeleccionado.items.map((i: any) => ({
          comprobante_id: comp.id, descripcion: i.descripcion,
          cantidad: i.cantidad, precio_unitario: i.precio_unitario,
          iva_porcentaje: i.iva_porcentaje as IvaPorcentaje,
          subtotal: i.subtotal,
        }))
      )
    }

    await supabase.from('presupuestos').update({ estado: 'convertido' }).eq('id', presSeleccionado.id)
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Emitir comprobante</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {esOffline && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Sin conexión — se emitirá en <strong>Contingencia</strong> (numeración serie C provisoria)</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de comprobante</label>
            <div className="flex gap-2">
              {(['A', 'B', 'C', 'X'] as TipoComprobante[]).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all ${
                    tipo === t ? TIPO_COLOR[t] + ' border-current' : 'text-gray-400 border-gray-200 hover:bg-gray-50'
                  }`}>{t}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              A = Resp. Inscripto · B = Consumidor Final · C = Contingencia · X = Interno
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto aprobado</label>
            {presupuestos.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
                No hay presupuestos aprobados pendientes de facturar.
                <br /><span className="text-xs">Aprobá un presupuesto primero.</span>
              </div>
            ) : (
              <select className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                onChange={e => setPresSeleccionado(presupuestos.find(p => p.id === e.target.value) ?? null)}>
                <option value="">— Seleccioná un presupuesto —</option>
                {presupuestos.map(p => (
                  <option key={p.id} value={p.id}>
                    #{String(p.numero_presupuesto).padStart(4, '0')} — {p.patente} — {p.cliente_nombre} — {formatARS(p.total)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {presSeleccionado && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (sin IVA)</span>
                <span>{formatARS(presSeleccionado.subtotal_sin_iva)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IVA</span>
                <span>{formatARS(presSeleccionado.iva_monto)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1.5">
                <span>Total</span>
                <span>{formatARS(presSeleccionado.total)}</span>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-white">
            Cancelar
          </button>
          <button onClick={handleEmitir} disabled={saving || !presSeleccionado}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Emitiendo…</> : 'Emitir comprobante'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel detalle del comprobante ────────────────────────────────────────────

function ComprobanteDetalle({
  comprobante, onClose, onAnular, onPago, onPrint, esAdmin,
}: {
  comprobante: any
  onClose: () => void
  onAnular: () => void
  onPago: () => void
  onPrint: () => void
  esAdmin: boolean
}) {
  const c = comprobante
  const items: any[] = c.comprobante_items ?? []
  const EIcon = ESTADO_ICON[c.estado as EstadoComprobante]

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-sm font-bold ${TIPO_COLOR[c.tipo_comprobante as TipoComprobante]}`}>
                {c.tipo_comprobante}
              </span>
              <h2 className="font-semibold text-lg font-mono">
                {formatComprobante(c.tipo_comprobante, c.punto_venta, c.numero)}
              </h2>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{c.clientes?.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[c.estado as EstadoComprobante]}`}>
              <EIcon className="w-3 h-3" />
              {ESTADO_LABEL[c.estado as EstadoComprobante]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Fecha de emisión</p>
              <p>{c.fecha_emision.split('-').reverse().join('/')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Condición IVA cliente</p>
              <p>{c.clientes?.condicion_iva ?? '—'}</p>
            </div>
            {c.cae && (
              <>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">CAE</p>
                  <p className="font-mono text-sm">{c.cae}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Vto. CAE</p>
                  <p>{(c.cae_vencimiento ?? '').split('-').reverse().join('/')}</p>
                </div>
              </>
            )}
            {c.estado === 'contingencia' && (
              <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Comprobante emitido en <strong>contingencia</strong> — número provisional.
                Al recuperar conexión, debe enviarse a AFIP para obtener CAE definitivo.
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 bg-gray-50 border-b">
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">P. Unit.</th>
                    <th className="px-4 py-2 text-right">IVA</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2">{i.descripcion}</td>
                      <td className="px-4 py-2 text-right">{i.cantidad}</td>
                      <td className="px-4 py-2 text-right">{formatARS(i.precio_unitario)}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{i.iva_porcentaje}%</td>
                      <td className="px-4 py-2 text-right font-medium">{formatARS(i.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal gravado</span><span>{formatARS(c.subtotal_gravado)}</span></div>
            <div className="flex justify-between text-gray-600"><span>IVA</span><span>{formatARS(c.iva_monto)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{formatARS(c.total)}</span></div>
          </div>

          {esAdmin && c.estado !== 'anulada' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Acciones</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={onPrint}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg">
                  <Printer className="w-4 h-4" /> Imprimir / PDF
                </button>
                {(c.estado === 'borrador' || c.estado === 'contingencia') && (
                  <button onClick={onPago}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
                    <CreditCard className="w-4 h-4" /> Registrar cobro
                  </button>
                )}
                {c.estado !== 'contingencia' && (
                  <button onClick={onAnular}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg">
                    <XCircle className="w-4 h-4" /> Anular
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vista de impresión ───────────────────────────────────────────────────────

function PrintView({ comprobante: c, onClose }: { comprobante: any; onClose: () => void }) {
  const items: any[] = c.comprobante_items ?? []

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Vista previa de impresión</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div id="print-area" className="p-8 font-mono text-sm space-y-4">
          <div className="text-center border-b pb-4">
            <p className="text-xl font-bold">{c.tipo_comprobante}</p>
            <p className="text-gray-600">{formatComprobante(c.tipo_comprobante, c.punto_venta, c.numero)}</p>
            <p className="text-xs text-gray-400 mt-1">Punto de venta: {String(c.punto_venta).padStart(4, '0')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-400">Cliente: </span>{c.clientes?.nombre}</div>
            <div><span className="text-gray-400">Fecha: </span>{c.fecha_emision.split('-').reverse().join('/')}</div>
            {c.clientes?.cuit_cuil && (
              <div><span className="text-gray-400">CUIT: </span>{c.clientes.cuit_cuil}</div>
            )}
            {c.cae && (
              <div className="col-span-2"><span className="text-gray-400">CAE: </span>{c.cae}</div>
            )}
            {c.estado === 'contingencia' && (
              <div className="col-span-2 text-orange-600 font-bold">⚠ COMPROBANTE PROVISIONAL — SIN CAE</div>
            )}
          </div>

          <table className="w-full border-t text-xs">
            <thead>
              <tr className="border-b text-gray-400">
                <th className="py-1 text-left">Descripción</th>
                <th className="py-1 text-right">Cant.</th>
                <th className="py-1 text-right">Precio</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.id} className="border-b border-dotted border-gray-200">
                  <td className="py-1">{i.descripcion}</td>
                  <td className="py-1 text-right">{i.cantidad}</td>
                  <td className="py-1 text-right">{formatARS(i.precio_unitario)}</td>
                  <td className="py-1 text-right">{formatARS(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-right space-y-0.5 text-xs border-t pt-2">
            <div className="flex justify-end gap-4"><span className="text-gray-400">Subtotal</span><span>{formatARS(c.subtotal_gravado)}</span></div>
            <div className="flex justify-end gap-4"><span className="text-gray-400">IVA</span><span>{formatARS(c.iva_monto)}</span></div>
            <div className="flex justify-end gap-4 font-bold text-sm border-t pt-1 mt-1"><span>TOTAL</span><span>{formatARS(c.total)}</span></div>
          </div>

          <p className="text-center text-xs text-gray-400 border-t pt-3">
            Gracias por su preferencia
          </p>
        </div>
      </div>
    </div>
  )
}
