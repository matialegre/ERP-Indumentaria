import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ImprovementNotes from "../components/ImprovementNotes";
import InstallPwa from "../components/InstallPwa";
import OfflineBanner from "../components/OfflineBanner";
import SyncProgressWidget from "../components/SyncProgressWidget";
import LocalSelector from "../components/LocalSelector";
import ImpersonationBanner from "../components/ImpersonationBanner";
import { startPeriodicSync, stopPeriodicSync, flushPendingOps } from "../lib/offlineSync";
import GlobalSearch from "../components/GlobalSearch";
import Breadcrumbs from "../components/Breadcrumbs";
import { useOnlineStatus, usePendingOps } from "../hooks/useOffline";
import { useSelectedLocal } from "../hooks/useSelectedLocal";
import { useBranding } from "../context/BrandingContext";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Warehouse,
  FileText,
  Users,
  Store,
  Truck,
  Search,
  BarChart3,
  Settings,
  ShoppingBag,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Activity,
  PackageCheck,
  CheckCircle,
  LayoutTemplate,
  ShoppingCart,
  CreditCard,
  Kanban,
  Receipt,
  GitCompare,
  Moon,
  Sun,
  UserCheck,
  RefreshCw,
  MapPin,
  Shield,
  BadgeDollarSign,
  Wrench,
  Ship,
  Boxes,
  TrendingUp,
  Star,
  Lightbulb,
  Key,
  FileBarChart,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/mega-admin",     icon: Shield,          label: "Mega Admin",          roles: ["MEGAADMIN"],                                                            module: null },
  { to: "/",               icon: LayoutDashboard, label: "Dashboard",       roles: null,                                                                    module: null },
  { to: "/resumen",        icon: Activity,        label: "Resumen",             roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","ADMINISTRACION"],            module: "COMPRAS" },
  // Compras
  { to: "/pedidos-compras",     icon: ShoppingCart, label: "Notas de Pedido",     roles: ["SUPERADMIN","ADMIN","COMPRAS"],                                    module: "COMPRAS",   badgeKey: "pedidos_pendientes" },
  { to: "/importacion",         icon: Ship,         label: "Importación",         roles: ["SUPERADMIN","ADMIN","COMPRAS"],                                    module: "IMPORTACION" },
  { to: "/facturas-proveedor",  icon: Receipt,      label: "Facturas / Remitos",  roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL"],                 module: "COMPRAS",   badgeKey: "facturas_sin_rv" },
  { to: "/gestion-pagos",       icon: CreditCard,   label: "Gestión de Pagos",    roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],             module: "PAGOS",     badgeKey: "pagos_pendientes" },
  // Depósito
  { to: "/ingreso",        icon: Package,      label: "Ingreso Mercadería", roles: ["SUPERADMIN","ADMIN","DEPOSITO","COMPRAS"],                              module: "COMPRAS",   badgeKey: "ingresos_pendientes" },
  { to: "/recepcion",      icon: PackageCheck, label: "Recepción",          roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL"],                                module: "COMPRAS",   badgeKey: "recepcion_pendiente" },
  { to: "/transporte",     icon: Truck,        label: "Transporte",         roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL"],                      module: "TRANSPORTE" },
  { to: "/completados",    icon: CheckCircle,  label: "Completados",        roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL"],                                module: "COMPLETADOS" },
  // Depósito
  { to: "/deposito",     icon: Boxes,        label: "Depósito",           roles: ["SUPERADMIN","ADMIN","DEPOSITO"],                                        module: "STOCK" },
  // Gestión
  { to: "/stock",          icon: Warehouse,    label: "Stock",              roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","VENDEDOR"],                     module: "STOCK" },
  { to: "/facturacion",    icon: FileText,     label: "Facturación",        roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                                  module: "VENTAS" },
  { to: "/consultas",      icon: Search,       label: "Consultas ERP",      roles: null,                                                                    module: null },
  { to: "/comparador",     icon: GitCompare,   label: "Comparador Precios", roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                       module: "CATALOGO" },
  { to: "/kanban",         icon: Kanban,       label: "TrellOutdoor",       roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","GESTION_PAGOS"],        module: "KANBAN" },
  // Catálogos
  { to: "/productos",      icon: ShoppingBag,  label: "Productos",          roles: ["SUPERADMIN","ADMIN","COMPRAS"],                                        module: "CATALOGO" },
  { to: "/proveedores",    icon: Truck,        label: "Proveedores",        roles: ["SUPERADMIN","ADMIN","COMPRAS"],                                        module: "CATALOGO" },
  { to: "/locales",        icon: Store,        label: "Locales",            roles: ["SUPERADMIN","ADMIN"],                                                  module: "LOCALES" },
  { to: "/usuarios",       icon: Users,        label: "Usuarios",           roles: ["SUPERADMIN","ADMIN"],                                                  module: "USUARIOS" },
  // Admin
  { to: "/reportes",       icon: BarChart3,         label: "Estadísticas",       roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                                 module: "REPORTES" },
  { to: "/comisiones",     icon: BadgeDollarSign,   label: "Comisiones",         roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],                 module: "REPORTES" },
  { to: "/socios-montagne",icon: UserCheck,          label: "Socios Montagne",    roles: ["SUPERADMIN","ADMIN"],                                                  module: "SOCIOS" },
  { to: "/config",              icon: Settings,       label: "Configuración",      roles: ["SUPERADMIN"],           module: null },
  { to: "/config-modulos",      icon: LayoutTemplate, label: "Módulos",            roles: ["SUPERADMIN","ADMIN"],   module: null },
  { to: "/sync-status",         icon: RefreshCw,      label: "Estado Sync",          roles: null,                     module: null },
  { to: "/configurador-menu",   icon: LayoutTemplate, label: "Configurador Menú",  roles: ["SUPERADMIN","ADMIN"],   module: null },
  { to: "/monitoreo",           icon: Activity,       label: "Monitoreo",          roles: ["SUPERADMIN","ADMIN"],   module: "MONITOREO" },
  // Taller
  { to: "/taller",             icon: Wrench,         label: "Taller — Dashboard", roles: ["SUPERADMIN","ADMIN","MEGAADMIN"], module: "OT" },
  { to: "/taller/ot",          icon: Wrench,         label: "Órdenes de Trabajo", roles: ["SUPERADMIN","ADMIN","MEGAADMIN"], module: "OT" },
  { to: "/taller/clientes",    icon: Users,          label: "Clientes Taller",    roles: ["SUPERADMIN","ADMIN","MEGAADMIN"], module: "OT" },
  { to: "/taller/stock",       icon: Package,        label: "Repuestos",          roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"], module: "OT" },
  // SuperTrend — Análisis de competencia
  { to: "/supertrend",         icon: TrendingUp,     label: "SuperTrend",         roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"], module: "SUPERTREND" },
  // Puntuación de Empleados
  { to: "/puntuacion-empleados", icon: Star,          label: "Puntuación Empleados", roles: ["SUPERADMIN","ADMIN","SUPERVISOR"], module: "PUNTUACION_EMPLEADOS" },
  // Mejoras del ERP
  { to: "/mejoras",              icon: Lightbulb,     label: "Mejoras",              roles: ["SUPERADMIN","ADMIN"],              module: "MEJORAS" },
  // Informes
  { to: "/informes",             icon: FileBarChart,  label: "Informes",             roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"], module: "INFORMES" },
  // Licencias (solo MEGAADMIN)
  { to: "/licencias",            icon: Key,           label: "Licencias",            roles: ["MEGAADMIN"],                      module: null },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSelectorOpen, setLocalSelectorOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("erp-dark") === "true"
  );
  const { localId: selectedLocalId, localName: selectedLocalName, selectLocal, hasLocal } = useSelectedLocal();
  const { app_name, short_name, primary_color } = useBranding();
  const moduleCacheKey = `erp_cached_modules_${user?.company_id ?? "global"}`;

  // Título dinámico del documento según empresa
  useEffect(() => {
    if (app_name) document.title = app_name;
  }, [app_name]);

  const { data: counts } = useQuery({
    queryKey: ['sidebar-counts'],
    queryFn: () => api.get('/system/sidebar-counts'),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const [moduleToast, setModuleToast] = useState(null);
  const prevModulesRef = useRef(null);

  // Módulos activos — se obtienen del backend, silencioso en caso de error
  const { data: modulesData = [] } = useQuery({
    queryKey: ['modules', user?.company_id],
    queryFn: async () => {
      try {
        const data = await api.get('/modules');
        const normalized = Array.isArray(data) ? data : [];
        localStorage.setItem(moduleCacheKey, JSON.stringify(normalized));
        return normalized;
      } catch {
        try {
          const cached = localStorage.getItem(moduleCacheKey);
          return cached ? JSON.parse(cached) : [];
        } catch {
          return [];
        }
      }
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const activeModuleSlugs = useMemo(
    () => new Set(modulesData.filter(m => m.is_active).map(m => m.slug)),
    [modulesData]
  );
  const modulesLoaded = modulesData.length > 0;

  useEffect(() => {
    if (!modulesLoaded) return;
    const current = [...activeModuleSlugs].sort().join(',');
    if (prevModulesRef.current !== null && prevModulesRef.current !== current) {
      setModuleToast(`Tus módulos fueron actualizados (${activeModuleSlugs.size} activos)`);
      setTimeout(() => setModuleToast(null), 5000);
    }
    prevModulesRef.current = current;
  }, [activeModuleSlugs, modulesLoaded]);

  const isClientMode = localStorage.getItem('erp_client_mode') === 'true';
  // Rutas exclusivas del panel Admin (nunca en EXE de cliente)
  const ADMIN_ONLY_ROUTES = ['/mega-admin', '/config-modulos', '/configurador-menu'];

  useEffect(() => {
    if (user?.role === 'MEGAADMIN' || !modulesLoaded) return;

    const currentModuleRoute = NAV_ITEMS
      .filter(item => item.module)
      .sort((a, b) => b.to.length - a.to.length)
      .find(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

    if (currentModuleRoute && !activeModuleSlugs.has(currentModuleRoute.module)) {
      navigate('/', { replace: true });
    }
  }, [activeModuleSlugs, location.pathname, modulesLoaded, navigate, user?.role]);

  const visibleItems = NAV_ITEMS.filter((item) => {
    // En modo cliente (EXE de empresa) ocultar rutas de administración de plataforma
    if (isClientMode && ADMIN_ONLY_ROUTES.includes(item.to)) return false;
    // MEGAADMIN ve absolutamente todo (super-usuario de la plataforma)
    if (user?.role === 'MEGAADMIN') return true;
    // Si el item tiene módulo y ese módulo está activo para este usuario (el backend
    // ya aplicó modules_override al filtrar), omitir chequeo de rol — el admin
    // explícitamente habilitó el módulo para este usuario
    if (item.module && modulesLoaded && activeModuleSlugs.has(item.module)) return true;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    // Si el item no tiene módulo asociado (Dashboard, Config, etc.) siempre visible
    if (!item.module) return true;
    // Hasta cargar módulos preferimos ocultar para no mostrar pantallas no habilitadas
    if (!modulesLoaded) return false;
    return activeModuleSlugs.has(item.module);
  });

  // Dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("erp-dark", darkMode);
  }, [darkMode]);

  // Ctrl+K global search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Start periodic catalog sync + pending ops flush for offline support
  useEffect(() => {
    startPeriodicSync();
    flushPendingOps().catch(() => {});

    const flushInterval = setInterval(() => {
      if (navigator.onLine) flushPendingOps().catch(() => {});
    }, 5 * 60 * 1000);

    return () => {
      stopPeriodicSync();
      clearInterval(flushInterval);
    };
  }, []);

  const isOnline = useOnlineStatus();
  const { count: pendingOpsCount } = usePendingOps();

  const sidebarWidth = collapsed ? "w-[68px]" : "w-60";

  return (
    <>
    {moduleToast && (
      <div className="fixed top-4 right-4 z-[9999] flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg animate-fade-in">
        <span>🔔</span>
        <span>{moduleToast}</span>
        <button onClick={() => setModuleToast(null)} className="ml-2 text-white/70 hover:text-white">✕</button>
      </div>
    )}
    <ImpersonationBanner />
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-200 ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0" style={{ backgroundColor: primary_color }}>
                {short_name}
              </div>
              <span className="font-semibold text-sm truncate">{app_name}</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm mx-auto" style={{ backgroundColor: primary_color }}>
              {short_name}
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded hover:bg-slate-700 transition shrink-0"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full" style={{scrollbarWidth:'thin',scrollbarColor:'#475569 transparent'}}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600/90 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                } ${collapsed ? "justify-center" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badgeKey && counts?.[item.badgeKey] > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {counts[item.badgeKey] > 99 ? '99+' : counts[item.badgeKey]}
                    </span>
                  )}
                </>
              )}
              {item.badgeKey && counts?.[item.badgeKey] > 0 && collapsed && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Connection status */}
        <div className="px-3 py-2 text-xs border-t border-slate-700/50">
          {!collapsed ? (
            <div className={`flex items-center gap-2 ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
              {isOnline ? 'Conectado' : `Sin conexión${pendingOpsCount > 0 ? ` · ${pendingOpsCount} op. pend.` : ''}`}
            </div>
          ) : (
            <div className="flex justify-center" title={isOnline ? 'Conectado' : `Sin conexión — ${pendingOpsCount} ops pendientes`}>
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
            </div>
          )}
        </div>

        {/* User footer */}
        <div className="border-t border-slate-700/50 p-3 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-xs shrink-0">
                {user?.full_name?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{user?.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition shrink-0"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={logout}
              className="w-full flex justify-center p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Offline status banner */}
        <OfflineBanner />
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 shrink-0 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition mr-3"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {/* Indicador de local seleccionado */}
            {hasLocal ? (
              <button
                onClick={() => setLocalSelectorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition truncate max-w-[200px]"
                title={`Local: ${selectedLocalName} — Click para cambiar`}
              >
                <MapPin size={14} className="shrink-0" />
                <span className="truncate">{selectedLocalName}</span>
              </button>
            ) : (
              <button
                onClick={() => setLocalSelectorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition"
                title="Sin local asignado — Click para seleccionar"
              >
                ⚠️ <span className="hidden sm:inline">Sin local asignado</span>
              </button>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Buscar (Ctrl+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden sm:block text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                Ctrl+K
              </kbd>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-500 dark:text-gray-400"
              title={darkMode ? "Modo claro" : "Modo oscuro"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <InstallPwa />
            <SyncIndicator />
            <span className="text-xs text-gray-400 hidden sm:block">v0.1.0</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <LocalSelector
        isOpen={localSelectorOpen}
        currentLocalId={selectedLocalId}
        onSelect={(id, name) => {
          selectLocal(id, name);
          setLocalSelectorOpen(false);
        }}
        onClose={() => setLocalSelectorOpen(false)}
      />
      <ImprovementNotes />
      <SyncProgressWidget />
    </div>
    </>
  );
}

function SyncIndicator() {
  const online = useOnlineStatus();
  const { count: pendingCount, syncing } = usePendingOps();

  let color, pulse, title;

  if (!online) {
    color = "bg-red-500";
    pulse = false;
    title = "Sin conexión — modo offline";
  } else if (syncing || pendingCount > 0) {
    color = "bg-amber-400";
    pulse = true;
    title = syncing
      ? "Sincronizando operaciones pendientes…"
      : `${pendingCount} operación${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""}`;
  } else {
    color = "bg-emerald-500";
    pulse = false;
    title = "Conectado · Todo sincronizado";
  }

  return (
    <div className="relative flex items-center" title={title}>
      {pulse && (
        <span className={`absolute inline-flex h-3 w-3 rounded-full ${color} opacity-75 animate-ping`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </div>
  );
}
