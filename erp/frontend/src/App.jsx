import { lazy, Suspense, useState, useCallback, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./layouts/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ToastProvider";
import LoadingSpinner from "./components/LoadingSpinner";
import OfflineBanner from "./components/OfflineBanner";
import SplashScreen from "./components/SplashScreen";

// Lazy loading — cada módulo se carga solo cuando se navega a él
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const IngresoPage = lazy(() => import("./pages/IngresoPage"));
const PedidosPage = lazy(() => import("./pages/PedidosPage"));
const PedidosComprasPage = lazy(() => import("./pages/PedidosComprasPage"));
const FacturasProveedorPage = lazy(() => import("./pages/FacturasProveedorPage"));
const GestionPagosPage = lazy(() => import("./pages/GestionPagosPage"));
const KanbanPage = lazy(() => import("./pages/KanbanPage"));
const StockPage = lazy(() => import("./pages/StockPage"));
const FacturacionPage = lazy(() => import("./pages/FacturacionPage"));
const ConsultasPage = lazy(() => import("./pages/ConsultasPage"));
const ProveedoresPage = lazy(() => import("./pages/ProveedoresPage"));
const LocalesPage = lazy(() => import("./pages/LocalesPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const ReportesPage = lazy(() => import("./pages/ReportesPage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const ProductosPage = lazy(() => import("./pages/ProductosPage"));
const MonitoreoPage = lazy(() => import("./pages/MonitoreoPage"));
const RecepcionPage = lazy(() => import("./pages/RecepcionPage"));
const ConfiguradorMenuPage = lazy(() => import("./pages/ConfiguradorMenuPage"));
const ComparadorPage = lazy(() => import("./pages/ComparadorPage"));
const CompletadosPage = lazy(() => import("./pages/CompletadosPage"));
const ResumenPage = lazy(() => import("./pages/ResumenPage"));
const TransportePage = lazy(() => import("./pages/TransportePage"));
const SociosMontagnePage = lazy(() => import("./pages/SociosMontagnePage"));
const ConfigModulosPage  = lazy(() => import("./pages/ConfigModulosPage"));
const SyncStatusPage = lazy(() => import("./pages/SyncStatusPage"));
const MegaAdminPage = lazy(() => import("./pages/MegaAdminPage"));
const CompanyWizardPage = lazy(() => import("./pages/CompanyWizardPage"));
const ComisionesPage = lazy(() => import("./pages/ComisionesPage"));
const ImportacionPage = lazy(() => import("./pages/ImportacionPage"));
const DepositoPage = lazy(() => import("./pages/DepositoPage"));
const TallerDashboard    = lazy(() => import("./pages/taller/TallerDashboard"));
const OTListPage         = lazy(() => import("./pages/taller/OTListPage"));
const OTDetailPage       = lazy(() => import("./pages/taller/OTDetailPage"));
const OTNewPage          = lazy(() => import("./pages/taller/OTNewPage"));
const ClientesTallerPage = lazy(() => import("./pages/taller/ClientesTallerPage"));
const StockTallerPage    = lazy(() => import("./pages/taller/StockTallerPage"));
const SupertrendPage     = lazy(() => import("./pages/SupertrendPage"));
const PuntuacionEmpleadosPage = lazy(() => import("./pages/PuntuacionEmpleadosPage"));
const MejorasPage = lazy(() => import("./pages/MejorasPage"));
const LicenciasPage = lazy(() => import("./pages/LicenciasPage"));
const InformesPage = lazy(() => import("./pages/InformesPage"));

function PageLoader() {
  return <LoadingSpinner />;
}

// Wraps each lazy-loaded page with its own error boundary + suspense
function LazyPage({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, backendError, isOfflineSession, retry } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-400">Conectando con el servidor...</p>
      </div>
    );
  }
  if (backendError && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Servidor no disponible</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          El servidor backend no respondió. Si ya te logueaste antes, intentá ingresar con tu usuario y contraseña para usar el modo offline.
        </p>
        <button
          onClick={retry}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading, backendError, isOfflineSession, retry } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Auto-reload cuando el backend publica un nuevo build
  const buildHashRef = useRef(null);
  useEffect(() => {
    const CHECK_INTERVAL = 30_000; // cada 30 segundos
    let timer;
    async function checkBuildHash() {
      try {
        const res = await fetch("/api/v1/system/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const hash = data.build_hash;
        if (!hash) return;
        if (buildHashRef.current === null) {
          buildHashRef.current = hash; // primer valor — baseline
        } else if (buildHashRef.current !== hash) {
          // Nuevo build detectado — recargamos para obtener los chunks nuevos
          window.location.reload();
        }
      } catch {}
    }
    checkBuildHash();
    timer = setInterval(checkBuildHash, CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Show splash while auth is checking (first load)
  if (loading && !splashDone) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Auth still loading after splash finishes
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-400">Conectando con el servidor...</p>
      </div>
    );
  }

  if (backendError && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Servidor no disponible</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          El servidor backend no respondió. Podés usar el modo offline si ya te logueaste antes.
        </p>
        <div className="flex gap-3">
          <button
            onClick={retry}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.href = "/login"}
            className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
          >
            Login Offline
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <OfflineBanner />
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <LoginPage />}
          />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LazyPage><DashboardPage /></LazyPage>} />
            <Route path="ingreso" element={<LazyPage><IngresoPage /></LazyPage>} />
            <Route path="pedidos" element={<LazyPage><PedidosPage /></LazyPage>} />
            <Route path="pedidos-compras" element={<LazyPage><PedidosComprasPage /></LazyPage>} />
            <Route path="facturas-proveedor" element={<LazyPage><FacturasProveedorPage /></LazyPage>} />
            <Route path="gestion-pagos" element={<LazyPage><GestionPagosPage /></LazyPage>} />
            <Route path="kanban" element={<LazyPage><KanbanPage /></LazyPage>} />
            <Route path="stock" element={<LazyPage><StockPage /></LazyPage>} />
            <Route path="facturacion" element={<LazyPage><FacturacionPage /></LazyPage>} />
            <Route path="consultas" element={<LazyPage><ConsultasPage /></LazyPage>} />
            <Route path="productos" element={<LazyPage><ProductosPage /></LazyPage>} />
            <Route path="proveedores" element={<LazyPage><ProveedoresPage /></LazyPage>} />
            <Route path="locales" element={<LazyPage><LocalesPage /></LazyPage>} />
            <Route path="usuarios" element={<LazyPage><UsuariosPage /></LazyPage>} />
            <Route path="reportes" element={<LazyPage><ReportesPage /></LazyPage>} />
            <Route path="config" element={<LazyPage><ConfigPage /></LazyPage>} />
            <Route path="monitoreo" element={<LazyPage><MonitoreoPage /></LazyPage>} />
            <Route path="recepcion" element={<LazyPage><RecepcionPage /></LazyPage>} />
            <Route path="configurador-menu" element={<LazyPage><ConfiguradorMenuPage /></LazyPage>} />
            <Route path="comparador" element={<LazyPage><ComparadorPage /></LazyPage>} />
            <Route path="completados" element={<LazyPage><CompletadosPage /></LazyPage>} />
            <Route path="resumen" element={<LazyPage><ResumenPage /></LazyPage>} />
            <Route path="transporte" element={<LazyPage><TransportePage /></LazyPage>} />
            <Route path="socios-montagne" element={<LazyPage><SociosMontagnePage /></LazyPage>} />
            <Route path="config-modulos"  element={<LazyPage><ConfigModulosPage /></LazyPage>} />
            <Route path="sync-status" element={<LazyPage><SyncStatusPage /></LazyPage>} />
            <Route path="mega-admin" element={<LazyPage><MegaAdminPage /></LazyPage>} />
            <Route path="mega-admin/nueva-empresa" element={<LazyPage><CompanyWizardPage /></LazyPage>} />
            <Route path="comisiones" element={<LazyPage><ComisionesPage /></LazyPage>} />
            <Route path="importacion" element={<LazyPage><ImportacionPage /></LazyPage>} />
            <Route path="deposito" element={<LazyPage><DepositoPage /></LazyPage>} />
            {/* Taller module */}
            <Route path="taller" element={<LazyPage><TallerDashboard /></LazyPage>} />
            <Route path="taller/ot" element={<LazyPage><OTListPage /></LazyPage>} />
            <Route path="taller/ot/nueva" element={<LazyPage><OTNewPage /></LazyPage>} />
            <Route path="taller/ot/:id" element={<LazyPage><OTDetailPage /></LazyPage>} />
            <Route path="taller/clientes" element={<LazyPage><ClientesTallerPage /></LazyPage>} />
            <Route path="taller/stock" element={<LazyPage><StockTallerPage /></LazyPage>} />
            {/* SuperTrend module */}
            <Route path="supertrend" element={<LazyPage><SupertrendPage /></LazyPage>} />
            {/* Puntuación de Empleados */}
            <Route path="puntuacion-empleados" element={<LazyPage><PuntuacionEmpleadosPage /></LazyPage>} />
            <Route path="mejoras"              element={<LazyPage><MejorasPage /></LazyPage>} />
            <Route path="licencias"            element={<LazyPage><LicenciasPage /></LazyPage>} />
            <Route path="informes"             element={<LazyPage><InformesPage /></LazyPage>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}
