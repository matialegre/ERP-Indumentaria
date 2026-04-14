import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Wrench, Users, Car, Package, FileText,
  Receipt, Calendar, Truck, ShoppingCart, BarChart3, Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { RolUsuario } from '@/types'
import OfflineBanner from '@/components/OfflineBanner'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles?: RolUsuario[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',      label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/ot',             label: 'Órdenes de Trabajo', icon: Wrench },
  { to: '/turnos',         label: 'Agenda / Turnos',  icon: Calendar },
  { to: '/presupuestos',   label: 'Presupuestos',     icon: FileText },
  { to: '/clientes',       label: 'Clientes',         icon: Users },
  { to: '/vehiculos',      label: 'Vehículos',        icon: Car },
  { to: '/stock',          label: 'Stock',            icon: Package },
  { to: '/proveedores',    label: 'Proveedores',      icon: Truck,  roles: ['admin','recepcionista','contador'] },
  { to: '/ordenes-compra', label: 'Órdenes de Compra', icon: ShoppingCart, roles: ['admin','recepcionista','contador'] },
  { to: '/facturacion',    label: 'Facturación',      icon: Receipt, roles: ['admin','recepcionista','contador'] },
  { to: '/reportes',       label: 'Reportes',         icon: BarChart3, roles: ['admin','contador'] },
  { to: '/configuracion',  label: 'Configuración',    icon: Settings, roles: ['admin'] },
]

export default function AppLayout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.rol as import('@/types').RolUsuario))
  )

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Banner offline — visible sólo cuando hay problema de conexión */}
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-400" />
            <div>
              <p className="font-bold text-sm leading-tight">Eurotaller Cassano</p>
              <p className="text-xs text-gray-400">ERP Automotriz</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-700 p-4">
          {user && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{user.nombre} {user.apellido}</p>
                <p className="text-xs text-gray-400 capitalize">{user.rol}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-white transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
    </div>
  )
}
