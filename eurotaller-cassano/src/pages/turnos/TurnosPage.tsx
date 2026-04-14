import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  Calendar, Plus, X, ChevronLeft, ChevronRight,
  Clock, User, Car, Wrench, CheckCircle2,
  Loader2, AlertCircle,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoTurno = 'pendiente' | 'confirmado' | 'en_curso' | 'completado' | 'cancelado' | 'no_se_presento'

interface TurnoSlot {
  id: string
  fecha_hora_inicio: string
  fecha_hora_fin: string
  estado: EstadoTurno
  servicio_solicitado: string
  notas?: string
  cliente_nombre: string
  cliente_id: string
  patente: string
  vehiculo: string
  vehiculo_id: string
  tecnico_nombre?: string
  tecnico_id?: string
  ot_id?: string
}

interface ClienteOpt { id: string; nombre: string; telefono?: string }
interface VehiculoOpt { id: string; patente: string; marca: string; modelo: string }
interface TecnicoOpt { id: string; nombre_completo: string }

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HORAS_TRABAJO = Array.from({ length: 10 }, (_, i) => 8 + i) // 8 a 17hs

const ESTADO_COLOR: Record<EstadoTurno, string> = {
  pendiente:        'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmado:       'bg-blue-100 text-blue-700 border-blue-200',
  en_curso:         'bg-orange-100 text-orange-700 border-orange-200',
  completado:       'bg-green-100 text-green-700 border-green-200',
  cancelado:        'bg-gray-100 text-gray-400 border-gray-200',
  no_se_presento:   'bg-red-100 text-red-700 border-red-200',
}

const ESTADO_LABEL: Record<EstadoTurno, string> = {
  pendiente:      'Pendiente',
  confirmado:     'Confirmado',
  en_curso:       'En curso',
  completado:     'Completado',
  cancelado:      'Cancelado',
  no_se_presento: 'No se presentó',
}

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function getLunes(d: Date): Date {
  const lunes = new Date(d)
  const dia = d.getDay() === 0 ? 6 : d.getDay() - 1
  lunes.setDate(d.getDate() - dia)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r
}

function formatFechaLocal(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatHoraLocal(fechaHora: string): string {
  return fechaHora.slice(11, 16)
}

function turnoEnDia(turno: TurnoSlot, dia: Date): boolean {
  return turno.fecha_hora_inicio.slice(0, 10) === formatFechaLocal(dia)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TurnosPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [semanaBase, setSemanaBase] = useState(() => getLunes(new Date()))
  const [turnos, setTurnos] = useState<TurnoSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<TurnoSlot | null>(null)
  const [vistaMode, setVistaMode] = useState<'semana' | 'dia'>('semana')
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => new Date())
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const dias = Array.from({ length: 7 }, (_, i) => addDias(semanaBase, i))

  const loadTurnos = useCallback(async () => {
    setLoading(true)
    const desde = formatFechaLocal(semanaBase)
    const hasta = formatFechaLocal(addDias(semanaBase, 7))

    const { data } = await supabase
      .from('turnos')
      .select(`
        id, fecha_hora_inicio, fecha_hora_fin,
        estado, servicio_solicitado, notas,
        cliente_id, vehiculo_id, tecnico_id, ot_id,
        clientes(nombre),
        vehiculos(patente, marca, modelo),
        tecnicos(nombre_completo)
      `)
      .gte('fecha_hora_inicio', desde)
      .lt('fecha_hora_inicio', hasta)
      .order('fecha_hora_inicio')

    if (data) {
      setTurnos(data.map((t: any) => ({
        id: t.id,
        fecha_hora_inicio: t.fecha_hora_inicio,
        fecha_hora_fin: t.fecha_hora_fin,
        estado: t.estado,
        servicio_solicitado: t.servicio_solicitado,
        notas: t.notas,
        cliente_nombre: t.clientes?.nombre ?? '—',
        cliente_id: t.cliente_id,
        patente: t.vehiculos?.patente ?? '—',
        vehiculo: `${t.vehiculos?.marca ?? ''} ${t.vehiculos?.modelo ?? ''}`.trim(),
        vehiculo_id: t.vehiculo_id,
        tecnico_nombre: t.tecnicos?.nombre_completo,
        tecnico_id: t.tecnico_id,
        ot_id: t.ot_id,
      })))
    }
    setLoading(false)
  }, [semanaBase])

  useEffect(() => { loadTurnos() }, [loadTurnos])

  async function confirmarLlegada(turno: TurnoSlot) {
    // Crear OT desde el turno
    const { data: ot, error: otErr } = await supabase.from('ordenes_trabajo').insert({
      cliente_id: turno.cliente_id,
      vehiculo_id: turno.vehiculo_id,
      estado: 'recibido',
      km_entrada: 0,
      descripcion_problema: turno.servicio_solicitado,
      turno_id: turno.id,
    }).select('id, numero_ot').single()

    if (otErr || !ot) { notify('Error al crear OT: ' + otErr?.message, 'err'); return }

    await supabase.from('turnos').update({
      estado: 'en_curso',
      ot_id: ot.id,
    }).eq('id', turno.id)

    notify(`✅ OT #${String(ot.numero_ot).padStart(4, '0')} creada — redirigiendo…`)
    await loadTurnos()
    setTimeout(() => navigate(`/ot/${ot.id}`), 1200)
  }

  async function cambiarEstado(id: string, estado: EstadoTurno) {
    await supabase.from('turnos').update({ estado }).eq('id', id)
    notify('Estado actualizado')
    await loadTurnos()
    setTurnoSeleccionado(null)
  }

  const esAdmin = user?.rol === 'admin' || user?.rol === 'recepcionista'

  const turnosDia = vistaMode === 'dia'
    ? turnos.filter(t => turnoEnDia(t, diaSeleccionado))
    : []

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.tipo === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Vista toggle */}
          <div className="flex border rounded-lg overflow-hidden text-sm">
            {(['semana', 'dia'] as const).map(v => (
              <button key={v} onClick={() => setVistaMode(v)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                  vistaMode === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                {v === 'semana' ? 'Semana' : 'Día'}
              </button>
            ))}
          </div>
          {esAdmin && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" /> Nuevo turno
            </button>
          )}
        </div>
      </div>

      {/* Navegación semana */}
      <div className="flex items-center gap-3">
        <button onClick={() => setSemanaBase(d => addDias(d, -7))}
          className="p-1.5 rounded-lg border hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
        <div className="text-sm font-medium text-gray-700">
          {DIAS[0]} {semanaBase.getDate()} {MESES[semanaBase.getMonth()]} — {' '}
          {DIAS[6]} {addDias(semanaBase, 6).getDate()} {MESES[addDias(semanaBase, 6).getMonth()]} {semanaBase.getFullYear()}
        </div>
        <button onClick={() => setSemanaBase(d => addDias(d, 7))}
          className="p-1.5 rounded-lg border hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => setSemanaBase(getLunes(new Date()))}
          className="px-3 py-1.5 text-xs border rounded-lg text-gray-500 hover:bg-gray-50">Hoy</button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />Cargando turnos…
        </div>
      ) : vistaMode === 'semana' ? (
        <VistaSemana
          dias={dias} turnos={turnos} horas={HORAS_TRABAJO}
          onSelectTurno={t => setTurnoSeleccionado(t)}
          onDayClick={d => { setDiaSeleccionado(d); setVistaMode('dia') }}
        />
      ) : (
        <VistaDia
          dia={diaSeleccionado} turnos={turnosDia}
          horas={HORAS_TRABAJO}
          onSelectTurno={t => setTurnoSeleccionado(t)}
          onChangeDia={d => setDiaSeleccionado(d)}
        />
      )}

      {showModal && (
        <TurnoModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadTurnos(); notify('✅ Turno agendado') }}
          userId={user?.id}
        />
      )}

      {turnoSeleccionado && (
        <TurnoDetalle
          turno={turnoSeleccionado}
          onClose={() => setTurnoSeleccionado(null)}
          onConfirmarLlegada={() => confirmarLlegada(turnoSeleccionado)}
          onCambiarEstado={(e) => cambiarEstado(turnoSeleccionado.id, e)}
          esAdmin={esAdmin}
        />
      )}
    </div>
  )
}

// ─── Vista semanal ────────────────────────────────────────────────────────────

function VistaSemana({ dias, turnos, horas, onSelectTurno, onDayClick }: {
  dias: Date[]
  turnos: TurnoSlot[]
  horas: number[]
  onSelectTurno: (t: TurnoSlot) => void
  onDayClick: (d: Date) => void
}) {
  const hoy = formatFechaLocal(new Date())

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header días */}
      <div className="grid grid-cols-8 border-b">
        <div className="px-3 py-3 text-xs text-gray-400">Hora</div>
        {dias.map((d, i) => {
          const fechaStr = formatFechaLocal(d)
          const esHoy = fechaStr === hoy
          const turnosDia = turnos.filter(t => turnoEnDia(t, d))
          return (
            <button key={i} onClick={() => onDayClick(d)}
              className={`px-3 py-3 text-center hover:bg-gray-50 transition-colors ${esHoy ? 'bg-orange-50' : ''}`}>
              <p className="text-xs text-gray-400">{DIAS[i]}</p>
              <p className={`text-lg font-bold ${esHoy ? 'text-orange-600' : 'text-gray-800'}`}>{d.getDate()}</p>
              {turnosDia.length > 0 && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5" />
              )}
            </button>
          )
        })}
      </div>

      {/* Grid horario */}
      <div className="max-h-[480px] overflow-y-auto">
        {horas.map(hora => (
          <div key={hora} className="grid grid-cols-8 border-b border-dashed border-gray-100 min-h-[60px]">
            <div className="px-3 py-2 text-xs text-gray-400 border-r">{hora}:00</div>
            {dias.map((dia, di) => {
              const turnosDiaHora = turnos.filter(t => {
                if (!turnoEnDia(t, dia)) return false
                const h = parseInt(t.fecha_hora_inicio.slice(11, 13))
                return h === hora
              })
              return (
                <div key={di} className="p-1 border-r last:border-r-0 space-y-1">
                  {turnosDiaHora.map(t => (
                    <button key={t.id} onClick={() => onSelectTurno(t)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs border ${ESTADO_COLOR[t.estado]} hover:opacity-80 transition-opacity`}>
                      <p className="font-medium truncate">{formatHoraLocal(t.fecha_hora_inicio)} {t.cliente_nombre}</p>
                      <p className="truncate opacity-70">{t.patente}</p>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vista diaria ─────────────────────────────────────────────────────────────

function VistaDia({ dia, turnos, horas, onSelectTurno, onChangeDia }: {
  dia: Date
  turnos: TurnoSlot[]
  horas: number[]
  onSelectTurno: (t: TurnoSlot) => void
  onChangeDia: (d: Date) => void
}) {
  const hoy = formatFechaLocal(new Date())

  return (
    <div className="space-y-3">
      {/* Navegación día */}
      <div className="flex items-center gap-2">
        <button onClick={() => onChangeDia(addDias(dia, -1))}
          className="p-1.5 rounded border hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-medium text-gray-700 min-w-[160px] text-center">
          {DIAS[(dia.getDay() === 0 ? 6 : dia.getDay() - 1)]} {dia.getDate()} de {MESES[dia.getMonth()]}
          {formatFechaLocal(dia) === hoy && <span className="ml-1 text-orange-500 text-xs">(hoy)</span>}
        </span>
        <button onClick={() => onChangeDia(addDias(dia, 1))}
          className="p-1.5 rounded border hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {/* Turnos del día */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {horas.map(hora => {
          const turnosHora = turnos.filter(t => parseInt(t.fecha_hora_inicio.slice(11, 13)) === hora)
          return (
            <div key={hora} className={`flex gap-4 border-b border-dashed border-gray-100 min-h-[64px] p-3 ${turnosHora.length === 0 ? 'hover:bg-gray-50/50' : ''}`}>
              <div className="text-xs text-gray-400 w-12 pt-0.5 flex-shrink-0">{hora}:00</div>
              <div className="flex-1 space-y-2">
                {turnosHora.length === 0
                  ? <p className="text-xs text-gray-300 italic">Libre</p>
                  : turnosHora.map(t => (
                      <button key={t.id} onClick={() => onSelectTurno(t)}
                        className={`w-full text-left rounded-xl border p-3 ${ESTADO_COLOR[t.estado]} hover:opacity-90 transition-opacity`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">
                              {formatHoraLocal(t.fecha_hora_inicio)} — {t.cliente_nombre}
                            </p>
                            <p className="text-xs opacity-75 mt-0.5">
                              {t.patente} · {t.vehiculo}
                            </p>
                            <p className="text-xs mt-1 italic opacity-80">{t.servicio_solicitado}</p>
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 border capitalize">
                            {ESTADO_LABEL[t.estado]}
                          </span>
                        </div>
                        {t.tecnico_nombre && (
                          <p className="text-xs opacity-60 mt-1">🔧 {t.tecnico_nombre}</p>
                        )}
                      </button>
                    ))
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Modal: nuevo turno ───────────────────────────────────────────────────────

function TurnoModal({
  onClose, onSaved, userId,
}: { onClose: () => void; onSaved: () => void; userId?: string }) {
  const [clientes, setClientes] = useState<ClienteOpt[]>([])
  const [vehiculos, setVehiculos] = useState<VehiculoOpt[]>([])
  const [tecnicos, setTecnicos] = useState<TecnicoOpt[]>([])
  const [clienteId, setClienteId] = useState('')
  const [vehiculoId, setVehiculoId] = useState('')
  const [tecnicoId, setTecnicoId] = useState('')
  const [fecha, setFecha] = useState(() => formatFechaLocal(new Date()))
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFin, setHoraFin] = useState('10:00')
  const [servicio, setServicio] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nombre').order('nombre').limit(200),
      supabase.from('tecnicos').select('id, nombre_completo').eq('activo', true).order('nombre_completo'),
    ]).then(([{ data: cl }, { data: tec }]) => {
      setClientes(cl ?? [])
      setTecnicos(tec ?? [])
    })
  }, [])

  useEffect(() => {
    if (!clienteId) { setVehiculos([]); return }
    supabase.from('vehiculos').select('id, patente, marca, modelo')
      .eq('cliente_id', clienteId).then(({ data }: { data: any }) => setVehiculos(data ?? []))
  }, [clienteId])

  async function handleSave() {
    if (!clienteId || !vehiculoId || !servicio) {
      setError('Cliente, vehículo y servicio son obligatorios'); return
    }
    setSaving(true); setError('')

    const fechaHoraInicio = `${fecha}T${horaInicio}:00`
    const fechaHoraFin = `${fecha}T${horaFin}:00`

    const { error: saveErr } = await supabase.from('turnos').insert({
      cliente_id: clienteId,
      vehiculo_id: vehiculoId,
      tecnico_id: tecnicoId || null,
      fecha_hora_inicio: fechaHoraInicio,
      fecha_hora_fin: fechaHoraFin,
      estado: 'pendiente',
      servicio_solicitado: servicio,
      notas: notas || null,
      created_by_id: userId ?? null,
    })

    if (saveErr) { setError('Error: ' + saveErr.message); setSaving(false); return }
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Nuevo turno</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
              <option value="">— Seleccioná cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehículo *</label>
            <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)}
              disabled={!clienteId}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400">
              <option value="">— Seleccioná vehículo —</option>
              {vehiculos.map(v => (
                <option key={v.id} value={v.id}>{v.patente} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
              <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
            </div>
            <div className="self-end pb-0.5 text-xs text-gray-400 flex items-end">
              <Clock className="w-3.5 h-3.5 mr-1" /> {horaInicio}–{horaFin}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servicio solicitado *</label>
            <input value={servicio} onChange={e => setServicio(e.target.value)}
              placeholder="Ej: Cambio de aceite y filtros, revisión frenos…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mecánico asignado <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
              <option value="">Sin asignar</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre_completo}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Notas adicionales para la recepción…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-white">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Agendar turno'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel detalle del turno ──────────────────────────────────────────────────

function TurnoDetalle({ turno, onClose, onConfirmarLlegada, onCambiarEstado, esAdmin }: {
  turno: TurnoSlot
  onClose: () => void
  onConfirmarLlegada: () => void
  onCambiarEstado: (e: EstadoTurno) => void
  esAdmin: boolean
}) {
  const [loadingOT, setLoadingOT] = useState(false)

  async function doConfirmarLlegada() {
    setLoadingOT(true)
    await onConfirmarLlegada()
    setLoadingOT(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">Detalle del turno</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {turno.fecha_hora_inicio.split('T')[0].split('-').reverse().join('/')} a las {formatHoraLocal(turno.fecha_hora_inicio)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLOR[turno.estado]}`}>
              {ESTADO_LABEL[turno.estado]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium">{turno.cliente_nombre}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{turno.patente} — {turno.vehiculo}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Wrench className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span>{turno.servicio_solicitado}</span>
            </div>
            {turno.tecnico_nombre && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>🔧</span><span>{turno.tecnico_nombre}</span>
              </div>
            )}
            {turno.notas && (
              <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">{turno.notas}</p>
            )}
          </div>

          {turno.ot_id && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>OT ya creada para este turno</span>
            </div>
          )}

          {esAdmin && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Acciones</p>
              <div className="flex flex-wrap gap-2">
                {(turno.estado === 'pendiente' || turno.estado === 'confirmado') && !turno.ot_id && (
                  <button onClick={doConfirmarLlegada} disabled={loadingOT}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">
                    {loadingOT
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando OT…</>
                      : <><CheckCircle2 className="w-4 h-4" /> Confirmar llegada → crear OT</>}
                  </button>
                )}
                {turno.estado === 'pendiente' && (
                  <button onClick={() => onCambiarEstado('confirmado')}
                    className="px-3 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium rounded-lg">
                    Confirmar turno
                  </button>
                )}
                {(turno.estado === 'pendiente' || turno.estado === 'confirmado') && (
                  <button onClick={() => onCambiarEstado('cancelado')}
                    className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg">
                    Cancelar
                  </button>
                )}
                {turno.estado === 'pendiente' && (
                  <button onClick={() => onCambiarEstado('no_se_presento')}
                    className="px-3 py-2 border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-medium rounded-lg">
                    No se presentó
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
