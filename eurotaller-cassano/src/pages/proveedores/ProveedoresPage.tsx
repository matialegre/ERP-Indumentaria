import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import {
  Building2, Search, Plus, X, Edit2, Loader2, Check, AlertCircle,
  Phone, Mail, MapPin, ExternalLink,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProviderOut {
  id: number
  name: string
  cuit: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  company_id?: number
}

interface ProviderForm {
  name: string
  cuit: string
  contact_name: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: ProviderForm = {
  name: '', cuit: '', contact_name: '', phone: '', email: '', address: '', notes: '',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Page() {
  const [providers, setProviders] = useState<ProviderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState<ProviderOut | 'new' | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const params = q ? `?search=${encodeURIComponent(q)}&limit=50` : '?limit=50'
      const data = await api.get<{ items: ProviderOut[]; total: number } | ProviderOut[]>(`/providers/${params}`)
      if (Array.isArray(data)) {
        setProviders(data)
        setTotal(data.length)
      } else {
        setProviders(data.items ?? [])
        setTotal(data.total ?? 0)
      }
    } catch {
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  let debounce: ReturnType<typeof setTimeout>
  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(debounce)
    debounce = setTimeout(() => load(val), 400)
  }

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
          <Building2 className="w-6 h-6 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
            <p className="text-sm text-gray-400">{total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal('new')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo proveedor
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Buscar por nombre, CUIT o contacto…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-sm"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
            <p className="text-sm">Cargando proveedores…</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'Sin resultados para esa búsqueda' : 'No hay proveedores registrados'}</p>
            {!search && (
              <button onClick={() => setShowModal('new')}
                className="mt-3 text-orange-600 text-sm underline">Agregar el primer proveedor</button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Proveedor</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">CUIT</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">Contacto</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Teléfono</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden xl:table-cell">Email</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    {p.address && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />{p.address}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-gray-700">{p.cuit || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-700 hidden lg:table-cell">{p.contact_name || '—'}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    {p.phone ? (
                      <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-orange-600 hover:underline">
                        <Phone className="w-3 h-3" />{p.phone}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell">
                    {p.email ? (
                      <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-orange-600 hover:underline">
                        <Mail className="w-3 h-3" />{p.email}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                      ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <button onClick={() => setShowModal(p)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Link a stock */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <ExternalLink className="w-4 h-4" />
        <span>Para ver historial de compras por proveedor, usá el módulo de</span>
        <a href="/stock" className="text-orange-600 underline">Stock e Ingresos</a>
      </div>

      {/* Modal */}
      {showModal && (
        <ProviderModal
          provider={showModal === 'new' ? undefined : showModal}
          onClose={() => setShowModal(null)}
          onSaved={() => {
            setShowModal(null)
            notify(showModal === 'new' ? '✅ Proveedor creado' : '✅ Proveedor actualizado')
            load(search)
          }}
        />
      )}
    </div>
  )
}

// ─── Modal crear/editar ────────────────────────────────────────────────────────

function ProviderModal({ provider, onClose, onSaved }: {
  provider?: ProviderOut
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProviderForm>(
    provider
      ? {
          name: provider.name,
          cuit: provider.cuit,
          contact_name: provider.contact_name ?? '',
          phone: provider.phone ?? '',
          email: provider.email ?? '',
          address: provider.address ?? '',
          notes: provider.notes ?? '',
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (f: keyof ProviderForm, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const body = {
      name: form.name.trim(),
      cuit: form.cuit.trim() || null,
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    }
    try {
      if (provider) {
        await api.put(`/providers/${provider.id}`, body)
      } else {
        await api.post('/providers/', body)
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
          <h2 className="font-semibold">{provider ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón social *</label>
            <input value={form.name} onChange={e => upd('name', e.target.value)}
              placeholder="Repuestos García S.A."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
            <input value={form.cuit} onChange={e => upd('cuit', e.target.value)}
              placeholder="20-12345678-9"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Persona de contacto</label>
            <input value={form.contact_name} onChange={e => upd('contact_name', e.target.value)}
              placeholder="Juan García"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)}
              placeholder="011 4321-5678"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => upd('email', e.target.value)}
              placeholder="ventas@proveedor.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input value={form.address} onChange={e => upd('address', e.target.value)}
              placeholder="Av. Corrientes 1234, CABA"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} value={form.notes} onChange={e => upd('notes', e.target.value)}
              placeholder="Horarios de atención, productos principales…"
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
              : <><Check className="w-4 h-4" /> {provider ? 'Guardar cambios' : 'Crear proveedor'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

