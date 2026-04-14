import { Activity, BarChart3 } from 'lucide-react'

export default function Monitoreo() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Monitoreo</h1>
        <p className="text-slate-400 text-sm mt-1">Vista global de salud de plataforma</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-white font-semibold">Próxima etapa</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Esta pantalla queda reservada para monitoreo agregado de tenants, despliegues y alertas.
              Mientras tanto, el monitoreo real de cada ERP ya está disponible dentro de cada empresa y en el backend principal.
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <BarChart3 size={18} className="text-indigo-300" />
          <p className="text-white font-medium mt-3">Uptime multi-tenant</p>
          <p className="text-xs text-slate-400 mt-1">Pendiente de consolidar en Super Admin.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <BarChart3 size={18} className="text-emerald-300" />
          <p className="text-white font-medium mt-3">Incidentes por empresa</p>
          <p className="text-xs text-slate-400 mt-1">Pendiente de consolidar en Super Admin.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <BarChart3 size={18} className="text-amber-300" />
          <p className="text-white font-medium mt-3">Consumo de recursos</p>
          <p className="text-xs text-slate-400 mt-1">Pendiente de consolidar en Super Admin.</p>
        </div>
      </div>
    </div>
  )
}
