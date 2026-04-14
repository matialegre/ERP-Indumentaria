import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

// Layouts
import AppLayout from './layouts/AppLayout'

// Pages — lazy loaded
import { lazy, Suspense } from 'react'

const LoginPage       = lazy(() => import('./pages/LoginPage'))
const DashboardPage   = lazy(() => import('./pages/DashboardPage'))
const OTListPage      = lazy(() => import('./pages/ot/OTListPage'))
const OTDetailPage    = lazy(() => import('./pages/ot/OTDetailPage'))
const OTNewPage       = lazy(() => import('./pages/ot/OTNewPage'))
const ClientesPage    = lazy(() => import('./pages/clientes/ClientesPage'))
const VehiculosPage   = lazy(() => import('./pages/vehiculos/VehiculosPage'))
const StockPage       = lazy(() => import('./pages/stock/StockPage'))
const PresupuestosPage = lazy(() => import('./pages/presupuestos/PresupuestosPage'))
const FacturacionPage = lazy(() => import('./pages/facturacion/FacturacionPage'))
const TurnosPage      = lazy(() => import('./pages/turnos/TurnosPage'))
const ProveedoresPage = lazy(() => import('./pages/proveedores/ProveedoresPage'))
const OcPage          = lazy(() => import('./pages/oc/OcPage'))
const ReportesPage    = lazy(() => import('./pages/reportes/ReportesPage'))
const ConfigPage      = lazy(() => import('./pages/ConfigPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"        element={<DashboardPage />} />
          <Route path="ot"               element={<OTListPage />} />
          <Route path="ot/nueva"         element={<OTNewPage />} />
          <Route path="ot/:id"           element={<OTDetailPage />} />
          <Route path="clientes"         element={<ClientesPage />} />
          <Route path="vehiculos"        element={<VehiculosPage />} />
          <Route path="stock"            element={<StockPage />} />
          <Route path="presupuestos"     element={<PresupuestosPage />} />
          <Route path="facturacion"      element={<FacturacionPage />} />
          <Route path="turnos"           element={<TurnosPage />} />
          <Route path="proveedores"      element={<ProveedoresPage />} />
          <Route path="ordenes-compra"   element={<OcPage />} />
          <Route path="reportes"         element={<ReportesPage />} />
          <Route path="configuracion"    element={<ConfigPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
