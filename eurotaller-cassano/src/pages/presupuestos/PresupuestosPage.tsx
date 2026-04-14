import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatARS, type EstadoPresupuesto, type IvaPorcentaje } from '@/types'
import {
  FileText, Plus, Search, ChevronRight, X, Trash2,
  CheckCircle2, MessageCircle, Loader2, AlertCircle,
  Clock, XCircle, ArrowRight, Send,
} from 'lucide-react'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface PresupuestoRow {
  id: string
  numero_presupuesto: number
  estado: EstadoPresupuesto
  fecha_emision: string
  fecha_vencimiento: string
  total: number
  cliente_nombre: string
  vehiculo: string
  patente: string
  ot_numero?: number
  ot_id?: string
}

interface ItemForm {
  tipo: 'mano_obra' | 'repuesto' | 'otro'
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: IvaPorcentaje
}

interface OtOption {
  id: string
  numero_ot: number
  descripcion_problema: string
  cliente_nombre: string
  patente: string
  vehiculo: string
  cliente_id: string
  vehiculo_id: string
}

// ─── Helpers de estado ────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoPresupuesto, string> = {
  borrador:   'Borrador',
  enviado:    'Enviado',
  aprobado:   'Aprobado',
  rechazado:  'Rechazado',
  vencido:    'Vencido',
  convertido: 'Convertido',
}

const ESTADO_COLOR: Record<EstadoPresupuesto, string> = {
  borrador:   'bg-gray-100 text-gray-600',
  enviado:    'bg-blue-100 text-blue-700',
  aprobado:   'bg-green-100 text-green-700',
  rechazado:  'bg-red-100 text-red-700',
  vencido:    'bg-orange-100 text-orange-700',
  convertido: 'bg-purple-100 text-purple-700',
}

const ESTADO_ICON: Record<EstadoPresupuesto, React.ElementType> = {
  borrador:   Clock,
  enviado:    Send,
  aprobado:   CheckCircle2,
  rechazado:  XCircle,
  vencido:    AlertCircle,
  convertido: ArrowRight,
}

const IVA_OPCIONES: IvaPorcentaje[] = [0, 10.5, 21.0, 27.0]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PresupuestosPage() {
  const { user } = useAuthStore()
  const [presupuestos, setPresupuestos] = useState<PresupuestoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoPresupuesto | 'todos'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const [showDetalle, setShowDetalle] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const loadPresupuestos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('presupuestos')
      .select(`
        id, numero_presupuesto, estado,
        fecha_emision, fecha_vencimiento, total,
        clientes(nombre),
        vehiculos(patente, marca, modelo),
        ordenes_trabajo(numero_ot, id)
      `)
      .order('numero_presupuesto', { ascending: false })
      .limit(200)

    if (!error && data) {
      setPresupuestos(data.map((p: any) => ({
        id: p.id,
        numero_presupuesto: p.numero_presupuesto,
        estado: p.estado,
        fecha_emision: p.fecha_emision,
        fecha_vencimiento: p.fecha_vencimiento,
        total: p.total,
        cliente_nombre: p.clientes?.nombre ?? '—',
        vehiculo: `${p.vehiculos?.marca ?? ''} ${p.vehiculos?.modelo ?? ''}`.trim(),
        patente: p.vehiculos?.patente ?? '—',
        ot_numero: p.ordenes_trabajo?.numero_ot,
        ot_id: p.ordenes_trabajo?.id,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadPresupuestos() }, [loadPresupuestos])

  const filtrados = presupuestos.filter(p => {
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    const matchBusqueda = !busqueda ||
      p.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.patente.toLowerCase().includes(busqueda.toLowerCase()) ||
      String(p.numero_presupuesto).includes(busqueda)
    return matchEstado && matchBusqueda
  })

  async function abrirDetalle(id: string) {
    const { data } = await supabase
      .from('presupuestos')
      .select(`
        *, clientes(*), vehiculos(*),
        presupuesto_items(*),
        ordenes_trabajo(id, numero_ot, estado)
      `)
      .eq('id', id)
      .single()
    if (data) { setDetalle(data); setShowDetalle(true) }
  }

  async function cambiarEstado(id: string, nuevoEstado: EstadoPresupuesto, otId?: string) {
    const { error } = await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)
    if (error) { notify('Error al cambiar estado: ' + error.message, 'err'); return }

    // Si se aprueba, avanzar OT a en_reparacion
    if (nuevoEstado === 'aprobado' && otId) {
      const { data: otData } = await supabase
        .from('ordenes_trabajo').select('estado').eq('id', otId).single()
      if (otData && ['diagnostico', 'esperando_repuestos', 'recibido'].includes(otData.estado)) {
        await supabase.from('ordenes_trabajo').update({ estado: 'en_reparacion' }).eq('id', otId)
      }
    }

    const msgs: Record<string, string> = {
      aprobado:  '✅ Presupuesto aprobado — OT avanzada a "En Reparación"',
      enviado:   '📤 Marcado como enviado',
      rechazado: '❌ Marcado como rechazado',
    }
    notify(msgs[nuevoEstado] ?? 'Estado actualizado')
    await loadPresupuestos()
    await abrirDetalle(id)
  }

  function enviarWhatsApp(row: PresupuestoRow) {
    const tel = (detalle?.clientes?.telefono ?? '').replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Hola ${detalle?.clientes?.nombre ?? row.cliente_nombre}! ` +
      `Te enviamos el presupuesto #${String(row.numero_presupuesto).padStart(4, '0')} ` +
      `para su ${row.patente} por un total de ${formatARS(row.total)}. ¿Lo aprobamos?`
    )
    if (tel) {
      window.open(`https://wa.me/54${tel}?text=${msg}`, '_blank')
    } else {
      notify('⚠️ El cliente no tiene teléfono registrado', 'err')
    }
    cambiarEstado(row.id, 'enviado')
  }

  const esAdmin = user?.rol === 'admin' || user?.rol === 'recepcionista'

  return (
    <div className="p-6 space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.tipo === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
        </div>
        {esAdmin && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> Nuevo presupuesto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'vencido', 'convertido'] as const).map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtroEstado === e
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {e === 'todos' ? 'Todos' : ESTADO_LABEL[e as EstadoPresupuesto]}
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input placeholder="Buscar por cliente, patente o N°…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay presupuestos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                <th className="px-5 py-3">N°</th>
                <th className="px-5 py-3">Cliente / Vehículo</th>
                <th className="px-5 py-3">OT</th>
                <th className="px-5 py-3">Emisión</th>
                <th className="px-5 py-3">Vencimiento</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(p => {
                const EIcon = ESTADO_ICON[p.estado]
                const hoy = new Date().toISOString().slice(0, 10)
                const estaVencido = p.estado === 'enviado' && p.fecha_vencimiento < hoy
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${estaVencido ? 'bg-orange-50' : ''}`}>
                    <td className="px-5 py-3 font-mono font-semibold text-orange-600">
                      #{String(p.numero_presupuesto).padStart(4, '0')}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{p.cliente_nombre}</p>
                      <p className="text-xs text-gray-400">{p.patente} — {p.vehiculo}</p>
                    </td>
                    <td className="px-5 py-3">
                      {p.ot_id ? (
                        <Link to={`/ot/${p.ot_id}`} className="text-xs text-orange-600 hover:underline font-mono"
                          onClick={e => e.stopPropagation()}>
                          OT #{String(p.ot_numero).padStart(4, '0')}
                        </Link>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {p.fecha_emision.split('-').reverse().join('/')}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <span className={estaVencido ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                        {p.fecha_vencimiento.split('-').reverse().join('/')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[p.estado]}`}>
                        <EIcon className="w-3 h-3" />
                        {ESTADO_LABEL[p.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">{formatARS(p.total)}</td>
                    <td className="px-2 py-3">
                      <button onClick={() => abrirDetalle(p.id)} className="text-gray-400 hover:text-gray-700">
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
      <p className="text-xs text-gray-400 text-right">{filtrados.length} registros</p>

      {/* Modal nuevo */}
      {showModal && (
        <PresupuestoModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadPresupuestos(); notify('✅ Presupuesto creado') }}
          userId={user?.id}
        />
      )}

      {/* Detalle */}
      {showDetalle && detalle && (
        <PresupuestoDetalle
          presupuesto={detalle}
          onClose={() => setShowDetalle(false)}
          onCambiarEstado={(id, estado) => cambiarEstado(id, estado, detalle?.ordenes_trabajo?.id)}
          onWhatsApp={() => enviarWhatsApp(presupuestos.find(p => p.id === detalle.id)!)}
          esAdmin={esAdmin}
        />
      )}
    </div>
  )
}

// ─── Modal: Crear presupuesto ─────────────────────────────────────────────────

function PresupuestoModal({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [otOptions, setOtOptions] = useState<OtOption[]>([])
  const [otSeleccionada, setOtSeleccionada] = useState<OtOption | null>(null)
  const [items, setItems] = useState<ItemForm[]>([
    { tipo: 'mano_obra', descripcion: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: 21.0 },
  ])
  const [descuento, setDescuento] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('ordenes_trabajo')
      .select(`id, numero_ot, descripcion_problema, cliente_id, vehiculo_id,
        clientes(nombre), vehiculos(patente, marca, modelo)`)
      .in('estado', ['recibido', 'diagnostico', 'esperando_repuestos', 'en_reparacion'])
      .order('numero_ot', { ascending: false })
      .limit(100)
      .then(({ data }: { data: any }) => setOtOptions((data ?? []).map((o: any) => ({
        id: o.id,
        numero_ot: o.numero_ot,
        descripcion_problema: o.descripcion_problema,
        cliente_nombre: o.clientes?.nombre ?? '—',
        patente: o.vehiculos?.patente ?? '—',
        vehiculo: `${o.vehiculos?.marca ?? ''} ${o.vehiculos?.modelo ?? ''}`.trim(),
        cliente_id: o.cliente_id,
        vehiculo_id: o.vehiculo_id,
      }))))
  }, [])

  // Precargar items desde OT
  useEffect(() => {
    if (!otSeleccionada) return
    ;(async () => {
      const [{ data: mo }, { data: rep }] = await Promise.all([
        supabase.from('ot_items_mano_obra').select('*').eq('ot_id', otSeleccionada.id),
        supabase.from('ot_items_repuestos').select('*').eq('ot_id', otSeleccionada.id),
      ])
      const newItems: ItemForm[] = [
        ...(mo ?? []).map((i: any): ItemForm => ({
          tipo: 'mano_obra', descripcion: i.descripcion,
          cantidad: i.horas, precio_unitario: i.precio_hora, iva_porcentaje: 21.0,
        })),
        ...(rep ?? []).map((i: any): ItemForm => ({
          tipo: 'repuesto', descripcion: i.descripcion,
          cantidad: i.cantidad, precio_unitario: i.precio_unitario, iva_porcentaje: 21.0,
        })),
      ]
      if (newItems.length > 0) setItems(newItems)
    })()
  }, [otSeleccionada])

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const ivaMonto = items.reduce((s, i) => s + i.cantidad * i.precio_unitario * (i.iva_porcentaje / 100), 0)
  const total = subtotal + ivaMonto - descuento

  const addItem = () => setItems(prev => [
    ...prev, { tipo: 'repuesto', descripcion: '', cantidad: 1, precio_unitario: 0, iva_porcentaje: 21.0 },
  ])
  const updateItem = (i: number, field: keyof ItemForm, val: unknown) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  async function handleSave() {
    const validItems = items.filter(i => i.descripcion.trim())
    if (!otSeleccionada && validItems.length === 0) {
      setError('Cargá al menos un ítem con descripción'); return
    }
    setSaving(true); setError('')

    const hoy = new Date().toISOString().slice(0, 10)
    const vto = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    const moItems = validItems.filter(i => i.tipo === 'mano_obra')
    const repItems = validItems.filter(i => i.tipo !== 'mano_obra')
    const subtotalMO = moItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
    const subtotalRep = repItems.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)

    const { data: pres, error: presErr } = await supabase.from('presupuestos').insert({
      ot_id: otSeleccionada?.id ?? null,
      cliente_id: otSeleccionada?.cliente_id ?? null,
      vehiculo_id: otSeleccionada?.vehiculo_id ?? null,
      fecha_emision: hoy, fecha_vencimiento: vto, estado: 'borrador',
      subtotal_mano_obra: subtotalMO, subtotal_repuestos: subtotalRep,
      descuento, subtotal_sin_iva: subtotal, iva_monto: ivaMonto, total,
      observaciones: observaciones || null, created_by_id: userId ?? null,
    }).select('id').single()

    if (presErr || !pres) {
      setError('Error al guardar: ' + presErr?.message); setSaving(false); return
    }

    if (validItems.length > 0) {
      await supabase.from('presupuesto_items').insert(validItems.map(i => ({
        presupuesto_id: pres.id, tipo: i.tipo, descripcion: i.descripcion,
        cantidad: i.cantidad, precio_unitario: i.precio_unitario,
        iva_porcentaje: i.iva_porcentaje, subtotal: i.cantidad * i.precio_unitario,
      })))
    }
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Nuevo presupuesto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* OT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orden de Trabajo asociada <span className="text-gray-400 font-normal">(opcional — precarga ítems)</span>
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              onChange={e => setOtSeleccionada(otOptions.find(o => o.id === e.target.value) ?? null)}>
              <option value="">Sin OT asociada</option>
              {otOptions.map(o => (
                <option key={o.id} value={o.id}>
                  OT #{String(o.numero_ot).padStart(4, '0')} — {o.patente} — {o.cliente_nombre}
                </option>
              ))}
            </select>
            {otSeleccionada && (
              <p className="text-xs text-blue-600 mt-1 italic">
                ✓ Ítems precargados desde OT: "{otSeleccionada.descripcion_problema}"
              </p>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Ítems</p>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1">
              <span className="col-span-2">Tipo</span>
              <span className="col-span-4">Descripción</span>
              <span className="col-span-1 text-right">Cant.</span>
              <span className="col-span-2 text-right">P. Unit.</span>
              <span className="col-span-2 text-right">IVA</span>
              <span className="col-span-1"></span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <select value={item.tipo} onChange={e => updateItem(i, 'tipo', e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none">
                    <option value="mano_obra">M.O.</option>
                    <option value="repuesto">Repuesto</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <input value={item.descripcion} onChange={e => updateItem(i, 'descripcion', e.target.value)}
                    placeholder="Descripción"
                    className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                </div>
                <div className="col-span-1">
                  <input type="number" step="0.5" min="0" value={item.cantidad}
                    onChange={e => updateItem(i, 'cantidad', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded px-2 py-1.5 text-xs text-right focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" value={item.precio_unitario}
                    onChange={e => updateItem(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                    className="w-full border rounded px-2 py-1.5 text-xs text-right focus:ring-1 focus:ring-orange-400 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <select value={item.iva_porcentaje}
                    onChange={e => updateItem(i, 'iva_porcentaje', parseFloat(e.target.value) as IvaPorcentaje)}
                    className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none">
                    {IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Descuento + obs */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Descuento ($)</label>
            <input type="number" min="0" value={descuento}
              onChange={e => setDescuento(parseFloat(e.target.value) || 0)}
              className="w-36 border rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              placeholder="Notas internas, condiciones, validez…" />
          </div>

          {/* Totales */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal (sin IVA)</span><span>{formatARS(subtotal)}</span></div>
            <div className="flex justify-between text-gray-600"><span>IVA estimado</span><span>{formatARS(ivaMonto)}</span></div>
            {descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento</span><span>— {formatARS(descuento)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total</span><span>{formatARS(total)}</span></div>
            <p className="text-xs text-gray-400">Vence automáticamente a las 72hs</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar presupuesto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel detalle ────────────────────────────────────────────────────────────

function PresupuestoDetalle({
  presupuesto, onClose, onCambiarEstado, onWhatsApp, esAdmin,
}: {
  presupuesto: any
  onClose: () => void
  onCambiarEstado: (id: string, estado: EstadoPresupuesto) => Promise<void>
  onWhatsApp: () => void
  esAdmin: boolean
}) {
  const [loading, setLoading] = useState(false)
  const p = presupuesto
  const items: any[] = p.presupuesto_items ?? []
  const moItems = items.filter((i: any) => i.tipo === 'mano_obra')
  const repItems = items.filter((i: any) => i.tipo !== 'mano_obra')

  async function doEstado(e: EstadoPresupuesto) {
    setLoading(true)
    await onCambiarEstado(p.id, e)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="font-semibold text-lg">
              Presupuesto #{String(p.numero_presupuesto).padStart(4, '0')}
            </h2>
            <p className="text-sm text-gray-500">{p.clientes?.nombre} — {p.vehiculos?.patente}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[p.estado as EstadoPresupuesto]}`}>
              {ESTADO_LABEL[p.estado as EstadoPresupuesto]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Emisión</p>
              <p>{p.fecha_emision.split('-').reverse().join('/')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Vencimiento</p>
              <p>{p.fecha_vencimiento.split('-').reverse().join('/')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">OT Asociada</p>
              {p.ordenes_trabajo?.id
                ? <Link to={`/ot/${p.ordenes_trabajo.id}`} onClick={onClose}
                    className="text-orange-600 hover:underline text-sm font-mono">
                    OT #{String(p.ordenes_trabajo.numero_ot).padStart(4, '0')}
                  </Link>
                : <span className="text-gray-400">—</span>
              }
            </div>
          </div>

          {moItems.length > 0 && <ItemsTable title="Mano de obra" items={moItems} unidad="h" />}
          {repItems.length > 0 && <ItemsTable title="Repuestos y otros" items={repItems} />}
          {items.length === 0 && <p className="text-sm text-gray-400 italic">Sin ítems cargados</p>}

          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Mano de obra</span><span>{formatARS(p.subtotal_mano_obra)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Repuestos</span><span>{formatARS(p.subtotal_repuestos)}</span></div>
            <div className="flex justify-between text-gray-600"><span>IVA</span><span>{formatARS(p.iva_monto)}</span></div>
            {p.descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento</span><span>— {formatARS(p.descuento)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>{formatARS(p.total)}</span></div>
          </div>

          {p.observaciones && (
            <p className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{p.observaciones}</p>
          )}

          {/* Acciones */}
          {esAdmin && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Acciones</p>
              <div className="flex flex-wrap gap-2">
                {(p.estado === 'borrador' || p.estado === 'enviado') && (
                  <button onClick={onWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
                    <MessageCircle className="w-4 h-4" />
                    {p.estado === 'enviado' ? 'Reenviar WhatsApp' : 'Enviar por WhatsApp'}
                  </button>
                )}
                {p.estado === 'borrador' && (
                  <button onClick={() => doEstado('enviado')} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-medium rounded-lg">
                    <Send className="w-4 h-4" /> Marcar enviado
                  </button>
                )}
                {p.estado === 'enviado' && (
                  <>
                    <button onClick={() => doEstado('aprobado')} disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Aprobar
                    </button>
                    <button onClick={() => doEstado('rechazado')} disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg">
                      <XCircle className="w-4 h-4" /> Rechazado
                    </button>
                  </>
                )}
                {p.estado === 'aprobado' && (
                  <Link to="/facturacion"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
                    onClick={onClose}>
                    <ArrowRight className="w-4 h-4" /> Emitir factura →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tabla de ítems (reutilizable) ────────────────────────────────────────────

function ItemsTable({ title, items, unidad }: { title: string; items: any[]; unidad?: string }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b">
            <th className="px-4 py-2 text-left">Descripción</th>
            <th className="px-4 py-2 text-right">Cant.</th>
            <th className="px-4 py-2 text-right">P. Unit.</th>
            <th className="px-4 py-2 text-right">IVA</th>
            <th className="px-4 py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((it: any) => (
            <tr key={it.id}>
              <td className="px-4 py-2">{it.descripcion}</td>
              <td className="px-4 py-2 text-right">{it.cantidad}{unidad ?? ''}</td>
              <td className="px-4 py-2 text-right">{formatARS(it.precio_unitario)}</td>
              <td className="px-4 py-2 text-right text-gray-400">{it.iva_porcentaje}%</td>
              <td className="px-4 py-2 text-right font-medium">{formatARS(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
