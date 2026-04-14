import {
  Building2,
  Package,
  TrendingUp,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { MODULOS } from '../lib/modules'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MRR_HISTORICO = [
  { mes: 'Nov', mrr: 1240 },
  { mes: 'Dic', mrr: 1580 },
  { mes: 'Ene', mrr: 1920 },
  { mes: 'Feb', mrr: 2310 },
  { mes: 'Mar', mrr: 2680 },
  { mes: 'Abr', mrr: 3140 },
]

const TOP_MODULOS = MODULOS
  .filter(m => !m.esCore)
  .map(m => ({ nombre: m.nombre.split(' ')[0], empresas: Math.floor(Math.random() * 18) + 3, color: m.color }))
  .sort((a, b) => b.empresas - a.empresas)
  .slice(0, 8)

const INSTALACIONES_RECIENTES = [
  { empresa: 'Mundo Outdoor',    rubro: 'Indumentaria', plan: 'Enterprise', estado: 'activo',       hace: 'Hoy' },
  { empresa: 'TallerEuro',       rubro: 'Mecánico',     plan: 'Pro',        estado: 'activo',       hace: 'Ayer' },
  { empresa: 'DepósitoSur',      rubro: 'Depósito',     plan: 'Starter',    estado: 'configurando', hace: 'hace 2 días' },
  { empresa: 'Kiosco Central',   rubro: 'Kiosco',       plan: 'Free',       estado: 'activo',       hace: 'hace 5 días' },
  { empresa: 'FerretAR',         rubro: 'Ferretería',   plan: 'Starter',    estado: 'activo',       hace: 'hace 1 sem.' },
]

const STATS = [
  { label: 'Empresas activas',  value: '23',     delta: '+3 este mes',  icon: Building2,  color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  { label: 'MRR',               value: '$3.140', delta: '+17% vs marzo', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Módulos activados', value: '187',    delta: '+24 esta sem.', icon: Package,    color: 'text-sky-400',     bg: 'bg-sky-500/10' },
  { label: 'Uptime promedio',   value: '99.8%',  delta: 'últimos 30 días', icon: Activity, color: 'text-violet-400',  bg: 'bg-violet-500/10' },
]

const PLAN_BADGE: Record<string, string> = {
  Free:       'bg-slate-700 text-slate-300',
  Starter:    'bg-sky-900/60 text-sky-300',
  Pro:        'bg-indigo-900/60 text-indigo-300',
  Enterprise: 'bg-violet-900/60 text-violet-300',
}

const ESTADO_ICON: Record<string, React.ReactNode> = {
  activo:        <CheckCircle2 size={14} className="text-emerald-400" />,
  configurando:  <Clock        size={14} className="text-amber-400"   />,
  error:         <AlertCircle  size={14} className="text-red-400"     />,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Plataforma ERP · Vista global de empresas y módulos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            <p className={`text-xs mt-2 font-medium ${s.color}`}>{s.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* MRR chart */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-white">MRR mensual</h2>
              <p className="text-xs text-slate-400">Últimos 6 meses · USD</p>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full font-medium">
              +17% MoM
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MRR_HISTORICO}>
              <defs>
                <linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number) => [`$${v}`, 'MRR']}
              />
              <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="url(#mrr)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top módulos */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Módulos más activados</h2>
          <p className="text-xs text-slate-400 mb-5">Por número de empresas</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={TOP_MODULOS} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="empresas" radius={[0, 4, 4, 0]}>
                {TOP_MODULOS.map((m, i) => (
                  <Cell key={i} fill={m.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Instalaciones recientes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Instalaciones recientes</h2>
          <a href="/empresas" className="text-xs text-indigo-400 hover:text-indigo-300">Ver todas →</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs text-slate-500 font-medium px-5 py-3">Empresa</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Rubro</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Plan</th>
              <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Estado</th>
              <th className="text-right text-xs text-slate-500 font-medium px-5 py-3">Creada</th>
            </tr>
          </thead>
          <tbody>
            {INSTALACIONES_RECIENTES.map((inst, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-5 py-3 font-medium text-white">{inst.empresa}</td>
                <td className="px-4 py-3 text-slate-400">{inst.rubro}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE[inst.plan]}`}>
                    {inst.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {ESTADO_ICON[inst.estado]}
                    <span className="text-slate-300 capitalize">{inst.estado}</span>
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-slate-400 text-xs">{inst.hace}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Distribución de módulos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">
          Catálogo de módulos —{' '}
          <span className="text-indigo-400">{MODULOS.filter(m => !m.esCore).length} activables</span>
          {' '}+{' '}
          <span className="text-slate-400">{MODULOS.filter(m => m.esCore).length} core</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['core', 'operaciones', 'integraciones', 'reportes'] as const).map(cat => {
            const mods = MODULOS.filter(m => m.categoria === cat)
            const labels: Record<string, string> = {
              core: 'Core', operaciones: 'Operaciones', integraciones: 'Integraciones', reportes: 'Reportes'
            }
            const colors: Record<string, string> = {
              core: 'text-violet-400 bg-violet-500/10', operaciones: 'text-sky-400 bg-sky-500/10',
              integraciones: 'text-emerald-400 bg-emerald-500/10', reportes: 'text-amber-400 bg-amber-500/10'
            }
            return (
              <div key={cat} className={`rounded-lg p-4 ${colors[cat].split(' ')[1]}`}>
                <p className={`text-2xl font-bold ${colors[cat].split(' ')[0]}`}>{mods.length}</p>
                <p className="text-xs text-slate-400 mt-1">{labels[cat]}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ${mods.reduce((s, m) => s + m.precioUsd, 0)}/mes
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
