import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Package, AlertTriangle, Search } from 'lucide-react'

interface Variant {
  id: number
  sku: string
  size: string | null
  color: string | null
  stock: number
  stock_min: number
  price: number
  cost_price: number | null
}

interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  category: string | null
  variants: Variant[]
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [soloFaltantes, setSoloFaltantes] = useState(false)

  useEffect(() => {
    api.get<{ items: Product[] }>('/products/', { limit: '500' })
      .then(r => setProducts(r?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Flatten products → variant rows
  const rows = products.flatMap(p =>
    (p.variants ?? []).map(v => ({
      productId: p.id,
      productName: p.name,
      sku: v.sku || p.sku,
      size: v.size,
      color: v.color,
      category: p.category,
      stock: v.stock ?? 0,
      stockMin: v.stock_min ?? 0,
      price: v.price ?? 0,
      costPrice: v.cost_price ?? 0,
      critico: (v.stock ?? 0) < (v.stock_min ?? 0),
    }))
  )

  const filtrados = rows.filter(r => {
    const matchBusqueda = !busqueda ||
      r.productName.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.sku.toLowerCase().includes(busqueda.toLowerCase())
    const matchFaltante = !soloFaltantes || r.critico
    return matchBusqueda && matchFaltante
  })

  const stockCritico = rows.filter(r => r.critico).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        </div>
        {stockCritico > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4" />
            {stockCritico} artículo{stockCritico !== 1 ? 's' : ''} bajo mínimo
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            placeholder="Buscar por nombre o código…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          onClick={() => setSoloFaltantes(v => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            soloFaltantes
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Solo críticos
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Artículo</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3 text-right">Stock actual</th>
                <th className="px-5 py-3 text-right">Mínimo</th>
                <th className="px-5 py-3 text-right">P. Costo</th>
                <th className="px-5 py-3 text-right">P. Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(r => (
                  <tr key={`${r.productId}-${r.sku}`} className={`hover:bg-gray-50 ${r.critico ? 'bg-red-50' : ''}`}>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{r.sku}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{r.productName}</p>
                      {(r.size || r.color) && (
                        <p className="text-xs text-gray-400">{[r.size, r.color].filter(Boolean).join(' / ')}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{r.category ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-semibold ${r.critico ? 'text-red-600' : 'text-gray-900'}`}>
                        {r.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-gray-500">{r.stockMin}</td>
                    <td className="px-5 py-3 text-right text-xs">${r.costPrice.toLocaleString('es-AR')}</td>
                    <td className="px-5 py-3 text-right text-xs font-medium">${r.price.toLocaleString('es-AR')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
