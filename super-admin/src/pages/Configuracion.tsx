import { Settings, ShieldCheck } from 'lucide-react'

export default function Configuracion() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-slate-400 text-sm mt-1">Ajustes globales de plataforma</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="text-white font-semibold">Reservado para configuración global</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Esta sección queda lista para futuras opciones de branding global, políticas de plataforma y defaults del alta de empresas.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} className="text-emerald-300" />
          <div>
            <p className="text-white font-medium">Estado actual</p>
            <p className="text-xs text-slate-400 mt-1">
              El control operativo real hoy está en Empresas y Módulos, que ya impactan directamente sobre cada ERP cliente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
