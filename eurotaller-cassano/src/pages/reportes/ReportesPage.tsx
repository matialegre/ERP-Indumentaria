import { useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { BarChart2, Download, AlertTriangle, Users, TrendingUp, Package } from 'lucide-react'
import { formatARS } from '@/types'

// ─── Datos mock ──────────────────────────────────────────────────────────────

const FACTURACION_MENSUAL = [
  { mes: 'Ene', total: 285000 },
  { mes: 'Feb', total: 320000 },
  { mes: 'Mar', total: 415000 },
  { mes: 'Abr', total: 390000 },
  { mes: 'May', total: 480000 },
  { mes: 'Jun', total: 510000 },
  { mes: 'Jul', total: 475000 },
  { mes: 'Ago', total: 530000 },
  { mes: 'Sep', total: 495000 },
  { mes: 'Oct', total: 580000 },
  { mes: 'Nov', total: 620000 },
  { mes: 'Dic', total: 710000 },
]

const OT_ESTADOS = [
  { name: 'Recibido', value: 12, color: '#6366f1' },
  { name: 'En proceso', value: 8, color: '#f97316' },
  { name: 'Esperando repuesto', value: 5, color: '#eab308' },
  { name: 'Listo para entregar', value: 6, color: '#22c55e' },
  { name: 'Entregado', value: 34, color: '#94a3b8' },
]

const STOCK_CRITICO = [
  { articulo: 'Filtro de aceite Renault', sku: 'FO-REN-001', stock: 2, minimo: 5, proveedor: 'Filtros SA' },
  { articulo: 'Pastilla de freno delantera Ford', sku: 'PF-FOR-003', stock: 1, minimo: 4, proveedor: 'Bosch Arg' },
  { articulo: 'Bujía NGK doble platino', sku: 'BJ-NGK-012', stock: 0, minimo: 10, proveedor: 'NGK Cono Sur' },
  { articulo: 'Correa de distribución Fiat', sku: 'CD-FIA-007', stock: 1, minimo: 3, proveedor: 'Gates SA' },
  { articulo: 'Líquido de frenos DOT 4', sku: 'LF-DOT-001', stock: 3, minimo: 6, proveedor: 'Motul Arg' },
]

const CLIENTES_DEUDA = [
  { nombre: 'García, Carlos', cuit: '20-23456789-0', saldo: 185000, vencido: true },
  { nombre: 'Transportes del Sur S.R.L.', cuit: '30-71234567-8', saldo: 320000, vencido: false },
  { nombre: 'López, María Elena', cuit: '27-34567890-1', saldo: 42500, vencido: true },
  { nombre: 'Logística Norte S.A.', cuit: '30-68901234-5', saldo: 215000, vencido: false },
  { nombre: 'Rodríguez, Héctor', cuit: '20-45678901-2', saldo: 67800, vencido: true },
]

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = 'facturacion' | 'ots' | 'stock' | 'deuda'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'facturacion', label: 'Facturación', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'ots', label: 'OTs por estado', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'stock', label: 'Stock crítico', icon: <Package className="w-4 h-4" /> },
  { id: 'deuda', label: 'Clientes con deuda', icon: <Users className="w-4 h-4" /> },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState<Tab>('facturacion')
  const [toast, setToast] = useState(false)

  function exportPDF() {
    setToast(true)
    setTimeout(() => setToast(false), 3000)
    window.print()
  }

  return (
    <div className="p-6 space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium bg-blue-600 text-white">
          📄 Preparando impresión…
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-6 h-6 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
            <p className="text-xs text-gray-400">Datos de demostración — integración con datos reales próximamente</p>
          </div>
        </div>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === t.id ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'facturacion' && <TabFacturacion />}
      {activeTab === 'ots' && <TabOTs />}
      {activeTab === 'stock' && <TabStock />}
      {activeTab === 'deuda' && <TabDeuda />}
    </div>
  )
}

// ─── Tab 1: Facturación del mes ───────────────────────────────────────────────

function TabFacturacion() {
  const total = FACTURACION_MENSUAL.reduce((s, m) => s + m.total, 0)
  const currentMes = FACTURACION_MENSUAL[FACTURACION_MENSUAL.length - 1]
  const prevMes = FACTURACION_MENSUAL[FACTURACION_MENSUAL.length - 2]
  const variacion = ((currentMes.total - prevMes.total) / prevMes.total * 100).toFixed(1)

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Facturación anual acumulada" value={formatARS(total)} sub="Año 2025" />
        <Kpi label={`Diciembre (${currentMes.mes})`} value={formatARS(currentMes.total)}
          sub={`${Number(variacion) >= 0 ? '+' : ''}${variacion}% vs mes anterior`}
          positive={Number(variacion) >= 0} />
        <Kpi label="Promedio mensual" value={formatARS(Math.round(total / 12))} sub="Enero – Diciembre" />
      </div>

      {/* Gráfico */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Facturación mensual (2025)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={FACTURACION_MENSUAL} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatARS(value), 'Facturación']}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Bar dataKey="total" fill="#ea580c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Tab 2: OTs por estado ────────────────────────────────────────────────────

function TabOTs() {
  const total = OT_ESTADOS.reduce((s, e) => s + e.value, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Total OTs activas" value={String(OT_ESTADOS.slice(0, 4).reduce((s, e) => s + e.value, 0))} sub="Excluyendo entregadas" />
        <Kpi label="OTs totales (historial)" value={String(total)} sub="Todos los estados" />
        <Kpi label="Esperando repuesto" value={String(OT_ESTADOS.find(e => e.name === 'Esperando repuesto')?.value ?? 0)}
          sub="Requieren atención" positive={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gráfico torta */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Distribución por estado</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={OT_ESTADOS}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({ percent }: { percent: number; name: string }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {OT_ESTADOS.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} OTs`, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla detalle */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Detalle por estado</h2>
          <div className="space-y-3">
            {OT_ESTADOS.map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span className="text-sm text-gray-700">{e.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-28 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(e.value / total * 100).toFixed(0)}%`, background: e.color }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-6 text-right">{e.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: Stock crítico ─────────────────────────────────────────────────────

function TabStock() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        {STOCK_CRITICO.length} artículos con stock por debajo del mínimo
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-gray-600">Artículo</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-600">SKU</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-600">Stock actual</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-600">Mínimo</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Proveedor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {STOCK_CRITICO.map((item, i) => (
              <tr key={i} className={item.stock === 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                <td className="px-5 py-3.5 font-medium text-gray-900">{item.articulo}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{item.sku}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {item.stock}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center text-gray-500">{item.minimo}</td>
                <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">{item.proveedor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab 4: Clientes con deuda ────────────────────────────────────────────────

function TabDeuda() {
  const totalDeuda = CLIENTES_DEUDA.reduce((s, c) => s + c.saldo, 0)
  const vencidos = CLIENTES_DEUDA.filter(c => c.vencido)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Deuda total pendiente" value={formatARS(totalDeuda)} sub={`${CLIENTES_DEUDA.length} clientes`} />
        <Kpi label="Saldos vencidos" value={formatARS(vencidos.reduce((s, c) => s + c.saldo, 0))}
          sub={`${vencidos.length} clientes vencidos`} positive={false} />
        <Kpi label="Saldo promedio" value={formatARS(Math.round(totalDeuda / CLIENTES_DEUDA.length))}
          sub="Por cliente con deuda" />
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">CUIT</th>
              <th className="px-5 py-3 text-right font-semibold text-gray-600">Saldo</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {CLIENTES_DEUDA.sort((a, b) => b.saldo - a.saldo).map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{c.nombre}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500 hidden md:table-cell">{c.cuit}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{formatARS(c.saldo)}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                    ${c.vencido ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {c.vencido ? 'Vencido' : 'Vigente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Componente KPI ───────────────────────────────────────────────────────────

function Kpi({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 ${positive === false ? 'text-red-500' : positive === true ? 'text-green-600' : 'text-gray-400'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

