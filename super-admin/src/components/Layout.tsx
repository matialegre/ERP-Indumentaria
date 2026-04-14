import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  Package,
  Settings,
  Activity,
  ChevronRight,
  LogOut,
} from 'lucide-react'

const NAV = [
  { to: '/',                icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/empresas',        icon: Building2,       label: 'Empresas' },
  { to: '/empresas/nueva',  icon: PlusCircle,      label: 'Nueva Empresa' },
  { to: '/modulos',         icon: Package,         label: 'Módulos' },
  { to: '/monitoreo',       icon: Activity,        label: 'Monitoreo' },
  { to: '/config',          icon: Settings,        label: 'Configuración' },
]

export default function Layout({ children, onLogout }: { children: React.ReactNode; onLogout?: () => void }) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
              SA
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Super Admin</p>
              <p className="text-xs text-slate-400">ERP Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-indigo-500/20 text-indigo-300 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} className="text-indigo-400" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-500">v1.0.0 · Abril 2026</p>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={12} />
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
