import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { validarPatente } from '@/types'
import {
  Car, Search, Plus, X, ChevronRight, ChevronDown, Wrench,
  Calendar, Loader2, AlertCircle, Edit2, Check,
} from 'lucide-react'

// ─── Tipos locales (mapeados al backend API) ───────────────────────────────────

interface VehicleRow {
  id: number
  customer_id: number
  plate: string
  brand: string
  model: string
  year?: number
  color?: string
  vin?: string
  fuel_type?: string
  last_km?: number
  vtv_expiry?: string
  notes?: string
  is_active: boolean
}

interface CustomerResult {
  id: number
  display_name: string
  phone?: string
  cuit_dni: string
  vehicles: VehicleRow[]
}

interface OTHistoryItem {
  id: number
  numero_ot: number
  estado: string
  descripcion_problema: string
  created_at: string
  km_entrada?: number
}

interface VehicleForm {
  plate: string
  brand: string
  model: string
  year: string
  color: string
  vin: string
  fuel_type: string
  last_km: string
  vtv_expiry: string
  notes: string
}

const FUEL_TYPES = ['NAFTERO', 'DIESEL', 'GNC', 'NAFTA_GNC', 'ELECTRICO', 'HIBRIDO']

const EMPTY_FORM: VehicleForm = {
  plate: '', brand: '', model: '', year: '', color: '',
  vin: '', fuel_type: 'NAFTERO', last_km: '', vtv_expiry: '', notes: '',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VehiculosPage() {
  const { user } = useAuthStore()
  const [busqueda, setBusqueda] = useState('')
  const [results, setResults] = useState<CustomerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<{ vehicle: VehicleRow; customerName: string } | null>(null)
  const [otHistory, setOtHistory] = useState<OTHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showVehicleModal, setShowVehicleModal] = useState<{ customerId: number; vehicle?: VehicleRow } | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    try {
      // Search returns CustomerListOut (no vehicles) — then load full customer for matches
      const data = await api.get<CustomerResult[]>(`/customers/search?q=${encodeURIComponent(term)}&limit=15`)
      // Load vehicles for each customer
      const withVehicles = await Promise.all(
        (data ?? []).map(async c => {
          try {
            const full = await api.get<{ vehicles: VehicleRow[] }>(`/customers/${c.id}`)
            return { ...c, vehicles: full.vehicles ?? [] }
          } catch {
            return { ...c, vehicles: [] }
          }
        })
      )
      setResults(withVehicles)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (val: string) => {
    setBusqueda(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  async function abrirHistorial(vehicle: VehicleRow, customerName: string) {
    setSelectedVehicle({ vehicle, customerName })
    setOtHistory([])
    setHistoryLoading(true)
    try {
      const data = await api.get<{ work_orders: OTHistoryItem[] }>(
        `/customers/vehicles/${encodeURIComponent(vehicle.plate)}/history`
      )
      setOtHistory(data.work_orders ?? (data as unknown as OTHistoryItem[]) ?? [])
    } catch {
      setOtHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const esAdmin = user?.rol === 'admin' || user?.rol === 'recepcionista'

  // Flatten vehicles for count display
  const totalVehiculos = results.reduce((s, c) => s + c.vehicles.length, 0)

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
          <Car className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Vehículos</h1>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">Buscar por patente o nombre de cliente</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busqueda}
              onChange={e => handleInput(e.target.value)}
              placeholder="Ej: AB123CD o González…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button onClick={() => doSearch(busqueda)}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
        {searched && !loading && (
          <p className="text-xs text-gray-400 mt-2">
            {results.length === 0
              ? 'Sin resultados'
              : `${results.length} cliente${results.length !== 1 ? 's' : ''} · ${totalVehiculos} vehículo${totalVehiculos !== 1 ? 's' : ''}`
            }
          </p>
        )}
      </div>

      {/* Estado inicial */}
      {!searched && (
        <div className="text-center py-16 text-gray-400">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Buscá por patente o nombre de cliente</p>
          <p className="text-xs mt-1">El buscador encuentra vehículos por patente (ABC123 o AB123CD) y clientes por nombre</p>
        </div>
      )}

      {/* Resultados */}
      {searched && results.length > 0 && (
        <div className="space-y-3">
          {results.map(customer => (
            <div key={customer.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Fila cliente */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
              >
                <div>
                  <p className="font-semibold text-gray-900">{customer.display_name}</p>
                  <p className="text-xs text-gray-400">{customer.cuit_dni} {customer.phone ? `· ${customer.phone}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    {customer.vehicles.length} vehículo{customer.vehicles.length !== 1 ? 's' : ''}
                  </span>
                  {esAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowVehicleModal({ customerId: customer.id }) }}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 border border-orange-200 px-2 py-1 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar vehículo
                    </button>
                  )}
                  {expandedCustomer === customer.id
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Vehículos del cliente */}
              {expandedCustomer === customer.id && (
                <div className="border-t divide-y divide-gray-100">
                  {customer.vehicles.length === 0 ? (
                    <p className="px-5 py-3 text-sm text-gray-400 italic">Sin vehículos registrados</p>
                  ) : (
                    customer.vehicles.map(v => (
                      <div key={v.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-orange-50 cursor-pointer"
                        onClick={() => abrirHistorial(v, customer.display_name)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Car className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-mono font-semibold text-orange-700 text-sm">{v.plate}</p>
                            <p className="text-sm text-gray-700">{v.brand} {v.model} {v.year ? `(${v.year})` : ''}</p>
                            <p className="text-xs text-gray-400">
                              {v.color ? `${v.color} · ` : ''}
                              {v.fuel_type ? `${v.fuel_type} · ` : ''}
                              {v.last_km ? `${v.last_km.toLocaleString()} km` : ''}
                              {v.vtv_expiry ? ` · VTV: ${v.vtv_expiry.split('-').reverse().join('/')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {esAdmin && (
                            <button
                              onClick={e => { e.stopPropagation(); setShowVehicleModal({ customerId: customer.id, vehicle: v }) }}
                              className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Panel historial OT */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-orange-600" />
                  <h2 className="font-semibold text-lg font-mono">{selectedVehicle.vehicle.plate}</h2>
                </div>
                <p className="text-sm text-gray-500">
                  {selectedVehicle.vehicle.brand} {selectedVehicle.vehicle.model}
                  {selectedVehicle.vehicle.year ? ` (${selectedVehicle.vehicle.year})` : ''} · {selectedVehicle.customerName}
                </p>
              </div>
              <button onClick={() => setSelectedVehicle(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Datos del vehículo */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedVehicle.vehicle.vin && (
                  <div><p className="text-xs text-gray-400">VIN/Chasis</p><p className="font-mono">{selectedVehicle.vehicle.vin}</p></div>
                )}
                {selectedVehicle.vehicle.color && (
                  <div><p className="text-xs text-gray-400">Color</p><p>{selectedVehicle.vehicle.color}</p></div>
                )}
                {selectedVehicle.vehicle.fuel_type && (
                  <div><p className="text-xs text-gray-400">Combustible</p><p>{selectedVehicle.vehicle.fuel_type}</p></div>
                )}
                {selectedVehicle.vehicle.last_km !== undefined && (
                  <div><p className="text-xs text-gray-400">Último km registrado</p><p>{selectedVehicle.vehicle.last_km?.toLocaleString()} km</p></div>
                )}
                {selectedVehicle.vehicle.vtv_expiry && (
                  <div>
                    <p className="text-xs text-gray-400">Vto. VTV</p>
                    <p className={new Date(selectedVehicle.vehicle.vtv_expiry) < new Date() ? 'text-red-600 font-medium' : ''}>
                      {selectedVehicle.vehicle.vtv_expiry.split('-').reverse().join('/')}
                    </p>
                  </div>
                )}
              </div>
              {selectedVehicle.vehicle.notes && (
                <p className="text-sm text-gray-500 italic border-l-2 border-gray-200 pl-3">{selectedVehicle.vehicle.notes}</p>
              )}

              {/* Historial OTs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-semibold text-gray-700">Historial de Órdenes de Trabajo</p>
                </div>
                {historyLoading ? (
                  <div className="py-6 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 mx-auto animate-spin mb-1" />
                    <p className="text-xs">Cargando historial…</p>
                  </div>
                ) : otHistory.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-3">Sin órdenes de trabajo previas</p>
                ) : (
                  <div className="space-y-2">
                    {otHistory.map(ot => (
                      <Link
                        key={ot.id}
                        to={`/ot/${ot.id}`}
                        onClick={() => setSelectedVehicle(null)}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-orange-50 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-orange-600 font-semibold">
                              OT #{String(ot.numero_ot).padStart(4, '0')}
                            </span>
                            <span className="text-xs text-gray-400 capitalize">{ot.estado?.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">{ot.descripcion_problema}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {ot.created_at?.slice(0, 10).split('-').reverse().join('/')}
                            {ot.km_entrada ? ` · ${ot.km_entrada.toLocaleString()} km` : ''}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar vehículo */}
      {showVehicleModal && (
        <VehicleModal
          customerId={showVehicleModal.customerId}
          vehicle={showVehicleModal.vehicle}
          onClose={() => setShowVehicleModal(null)}
          onSaved={() => {
            setShowVehicleModal(null)
            notify(showVehicleModal.vehicle ? '✅ Vehículo actualizado' : '✅ Vehículo creado')
            doSearch(busqueda)
          }}
        />
      )}
    </div>
  )
}

// ─── Modal crear/editar vehículo ──────────────────────────────────────────────

function VehicleModal({ customerId, vehicle, onClose, onSaved }: {
  customerId: number
  vehicle?: VehicleRow
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<VehicleForm>(
    vehicle
      ? {
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year?.toString() ?? '',
          color: vehicle.color ?? '',
          vin: vehicle.vin ?? '',
          fuel_type: vehicle.fuel_type ?? 'NAFTERO',
          last_km: vehicle.last_km?.toString() ?? '',
          vtv_expiry: vehicle.vtv_expiry ?? '',
          notes: vehicle.notes ?? '',
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (field: keyof VehicleForm, val: string) =>
    setForm(p => ({ ...p, [field]: val }))

  async function handleSave() {
    if (!form.plate.trim() || !form.brand.trim() || !form.model.trim()) {
      setError('Patente, marca y modelo son obligatorios'); return
    }
    const patenteNorm = form.plate.toUpperCase().replace(/\s/g, '')
    if (!validarPatente(patenteNorm)) {
      setError('Patente inválida — usá formato ABC123 (viejo) o AB123CD (Mercosur)'); return
    }
    setSaving(true); setError('')

    const body = {
      plate: patenteNorm,
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year ? parseInt(form.year) : null,
      color: form.color.trim() || null,
      vin: form.vin.trim() || null,
      fuel_type: form.fuel_type || null,
      last_km: form.last_km ? parseInt(form.last_km) : null,
      vtv_expiry: form.vtv_expiry || null,
      notes: form.notes.trim() || null,
    }

    try {
      if (vehicle) {
        await api.put(`/customers/${customerId}/vehicles/${vehicle.id}`, body)
      } else {
        await api.post(`/customers/${customerId}/vehicles`, body)
      }
      onSaved()
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-semibold">{vehicle ? 'Editar vehículo' : 'Agregar vehículo'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          {/* Patente */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patente *</label>
            <input
              value={form.plate}
              onChange={e => update('plate', e.target.value.toUpperCase())}
              placeholder="AB123CD"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Formato: ABC123 (viejo) o AB123CD (Mercosur)</p>
          </div>

          {[
            { field: 'brand', label: 'Marca *', placeholder: 'Renault' },
            { field: 'model', label: 'Modelo *', placeholder: 'Sandero' },
            { field: 'year', label: 'Año', placeholder: '2019', type: 'number' },
            { field: 'color', label: 'Color', placeholder: 'Blanco' },
            { field: 'last_km', label: 'Km actual', placeholder: '85000', type: 'number' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type ?? 'text'}
                value={form[f.field as keyof VehicleForm]}
                onChange={e => update(f.field as keyof VehicleForm, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Combustible</label>
            <select value={form.fuel_type} onChange={e => update('fuel_type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VIN / N° Chasis</label>
            <input value={form.vin} onChange={e => update('vin', e.target.value)}
              placeholder="17 caracteres"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vto. VTV</label>
            <input type="date" value={form.vtv_expiry} onChange={e => update('vtv_expiry', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} value={form.notes} onChange={e => update('notes', e.target.value)}
              placeholder="Observaciones, accesorios, modificaciones…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          {error && (
            <div className="col-span-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl sticky bottom-0">
          <button onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-white">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg flex items-center gap-2">
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              : <><Check className="w-4 h-4" /> {vehicle ? 'Guardar cambios' : 'Agregar'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
