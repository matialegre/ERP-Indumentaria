import { lazy, Suspense, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { getToken, clearToken } from './lib/api'

const Dashboard       = lazy(() => import('./pages/Dashboard'))
const Empresas        = lazy(() => import('./pages/Empresas'))
const NuevaEmpresa    = lazy(() => import('./pages/NuevaEmpresa'))
const EmpresaDetalle  = lazy(() => import('./pages/EmpresaDetalle'))
const Modulos         = lazy(() => import('./pages/Modulos'))
const Monitoreo       = lazy(() => import('./pages/Monitoreo'))
const Configuracion   = lazy(() => import('./pages/Configuracion'))

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken())

  const handleLogin = useCallback(() => setAuthed(true), [])
  const handleLogout = useCallback(() => { clearToken(); setAuthed(false) }, [])

  if (!authed) return <LoginPage onLogin={handleLogin} />

  return (
    <Layout onLogout={handleLogout}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/"                       index element={<Dashboard />} />
          <Route path="/empresas"                     element={<Empresas />} />
          <Route path="/empresas/nueva"               element={<NuevaEmpresa />} />
          <Route path="/empresas/:id"                 element={<EmpresaDetalle />} />
          <Route path="/modulos"                      element={<Modulos />} />
          <Route path="/monitoreo"                    element={<Monitoreo />} />
          <Route path="/config"                       element={<Configuracion />} />
          <Route path="*"                             element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
