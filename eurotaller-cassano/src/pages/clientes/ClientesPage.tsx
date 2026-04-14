import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Users, Plus, Search, Phone, Mail } from 'lucide-react'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    api.get<{ items: any[] }>('/customers/', { limit: '200' })
      .then(r => setClientes(r?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtrados = clientes.filter(c =>
    !busqueda ||
    (c.display_name ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.cuit_dni ?? '').includes(busqueda) ||
    (c.phone ?? '').includes(busqueda)
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        </div>
        <button className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          placeholder="Buscar por nombre, CUIT/DNI o teléfono…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400">Sin clientes</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">CUIT/DNI</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3 text-right">Saldo</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.display_name}</p>
                    {c.city && <p className="text-xs text-gray-400">{c.city}</p>}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{c.cuit_dni ?? '—'}</td>
                  <td className="px-5 py-3 text-xs capitalize">{c.customer_type?.replace(/_/g, ' ') ?? '—'}</td>
                  <td className="px-5 py-3">
                    {c.phone && <p className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" />{c.phone}</p>}
                    {c.email && <p className="flex items-center gap-1 text-xs text-gray-400"><Mail className="w-3 h-3" />{c.email}</p>}
                  </td>
                  <td className="px-5 py-3 text-right text-xs font-medium">
                    <span className={(c.balance ?? 0) > 0 ? 'text-red-600' : 'text-gray-500'}>
                      ${Math.abs(c.balance ?? 0).toLocaleString('es-AR')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
