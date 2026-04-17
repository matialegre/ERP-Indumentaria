import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ImprovementNotes from "../components/ImprovementNotes";
import UpdateReadyModal from "../components/UpdateReadyModal";
import InstallPwa from "../components/InstallPwa";
import OfflineBanner from "../components/OfflineBanner";
import SyncProgressWidget from "../components/SyncProgressWidget";
import LocalSelector from "../components/LocalSelector";
import ImpersonationBanner from "../components/ImpersonationBanner";
import { startPeriodicSync, stopPeriodicSync, flushPendingOps } from "../lib/offlineSync";
import { enableAutoSync } from "../lib/syncEngine";
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
  MessageSquare,
  Crown,
  Megaphone,
  CalendarDays,
  MessageCircle,
  Rocket,
  Bot,
  Link2,
  ChevronDown,
  Building2,
  Banknote,
  Database,
  Smartphone,
  Globe,
  Briefcase,
  Cog,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// NAV_ITEMS — Menú principal reorganizado en 11 grupos temáticos
// (ERP para minorista + mayorista + administración + importación + e-commerce)
// El orden de los grupos es el del flujo de negocio, NO alfabético.
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  // 1) Dashboard
  { to: "/",          icon: LayoutDashboard, label: "Dashboard", roles: null, module: null },

  // 2) Ventas — POS minorista, B2B mayorista, consultas y precios
  {
    icon: ShoppingCart, label: "Ventas",
    roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","VENDEDOR","LOCAL","COMPRAS"],
    module: null,
    children: [
      { to: "/facturacion",    icon: Receipt,    label: "Facturación / POS",   roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","VENDEDOR","LOCAL"], module: "VENTAS" },
      { to: "/consultas",      icon: Search,     label: "Consultas ERP",       roles: null,                                                       module: "CONSULTAS" },
      { to: "/consultas-sql",  icon: Database,   label: "SQL PC Tomy",         roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],          module: "CONSULTAS" },
      { to: "/comparador",     icon: GitCompare, label: "Comparador Precios",  roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],          module: "COMPARADOR", moduleAlt: "CATALOGO" },
    ],
  },

  // 3) E-commerce — canales unificados
  {
    icon: Globe, label: "E-commerce",
    roles: ["SUPERADMIN","ADMIN","DEPOSITO","VENDEDOR","ADMINISTRACION","COMPRAS"],
    module: null,
    children: [
      { to: "/mercadolibre",          icon: ShoppingCart, label: "MercadoLibre",      roles: ["SUPERADMIN","ADMIN","DEPOSITO"],                  module: "MERCADOLIBRE" },
      { to: "/crm/meli-indumentaria", icon: Store,       label: "ML Indumentaria",    roles: null,                                                module: "ML_INDUMENTARIA", moduleAlt: "CRM" },
      { to: "/crm/meli-neuquen",      icon: Store,       label: "ML Neuquén",         roles: null,                                                module: "ML_NEUQUEN",      moduleAlt: "CRM" },
      { to: "/crm/vtex",              icon: Store,       label: "VTEX Canal",         roles: null,                                                module: "VTEX_CANAL",      moduleAlt: "CRM" },
      { to: "/crm/vtex-inactivos",    icon: Users,       label: "VTEX Inactivos",     roles: null,                                                module: "VTEX_INACTIVOS",  moduleAlt: "CRM" },
      { to: "/crm/dragonfish",        icon: Package,     label: "Dragonfish",         roles: null,                                                module: "DRAGONFISH",      moduleAlt: "CRM" },
    ],
  },

  // 4) Catálogo & Stock
  {
    icon: Boxes, label: "Catálogo & Stock",
    roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL","VENDEDOR"],
    module: null,
    children: [
      { to: "/productos",  icon: ShoppingBag, label: "Productos",  roles: ["SUPERADMIN","ADMIN","COMPRAS"],                                   module: "PRODUCTOS", moduleAlt: "CATALOGO" },
      { to: "/stock",      icon: Warehouse,   label: "Stock",      roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","VENDEDOR"],               module: "STOCK" },
      { to: "/deposito",   icon: Boxes,       label: "Depósito",   roles: ["SUPERADMIN","ADMIN","DEPOSITO"],                                  module: "DEPOSITO",  moduleAlt: "STOCK" },
      { to: "/transporte", icon: Truck,       label: "Transporte", roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL"],                module: "TRANSPORTE" },
    ],
  },

  // 5) Compras & Proveedores (incluye flujo de remitos)
  {
    icon: Briefcase, label: "Compras",
    roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","DEPOSITO","LOCAL"],
    module: null,
    children: [
      {
        icon: ClipboardList, label: "Gestión de Remitos",
        roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","DEPOSITO","LOCAL"],
        module: null,
        children: [
          { to: "/pedidos-compras",    icon: ShoppingCart, label: "Notas de Pedido",    roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                    module: "NOTAS_PEDIDO",       moduleAlt: "COMPRAS", badgeKey: "pedidos_pendientes" },
          { to: "/recepcion",          icon: PackageCheck, label: "Recepción",          roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","ADMINISTRACION"],           module: "RECEPCION",          moduleAlt: "COMPRAS", badgeKey: "recepcion_pendiente" },
          { to: "/ingreso",            icon: Package,      label: "Ingreso Mercadería", roles: ["SUPERADMIN","ADMIN","DEPOSITO","COMPRAS","ADMINISTRACION"],         module: "INGRESO",            moduleAlt: "COMPRAS", badgeKey: "ingresos_pendientes" },
          { to: "/facturas-proveedor", icon: Receipt,      label: "Facturas / Remitos", roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL","ADMINISTRACION"], module: "FACTURAS_PROVEEDOR", moduleAlt: "COMPRAS", badgeKey: "facturas_sin_rv" },
          { to: "/completados",        icon: CheckCircle,  label: "Completados",        roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","ADMINISTRACION"],           module: "COMPLETADOS" },
        ],
      },
      { to: "/proveedores", icon: Truck, label: "Proveedores", roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"], module: "PROVEEDORES", moduleAlt: "CATALOGO" },
    ],
  },

  // 6) Importación (módulo dedicado)
  { to: "/importacion", icon: Ship, label: "Importación", roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"], module: "IMPORTACION" },

  // 7) Administración — tesorería, AP/AR, impuestos, informes
  {
    icon: Banknote, label: "Administración",
    roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],
    module: null,
    children: [
      { to: "/gestion-pagos", icon: CreditCard,   label: "Gestión de Pagos", roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"], module: "PAGOS", badgeKey: "pagos_pendientes" },
      { to: "/cash-flow",     icon: Banknote,     label: "Cash Flow",        roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"], module: null },
      { to: "/vencimientos",  icon: CalendarDays, label: "Vencimientos",     roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"], module: null },
      { to: "/informes",      icon: FileBarChart, label: "Informes",         roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                 module: "INFORMES" },
    ],
  },

  // 8) CRM & Marketing
  {
    icon: Users, label: "CRM & Marketing",
    roles: ["SUPERADMIN","ADMIN","VENDEDOR","ADMINISTRACION","GESTION_PAGOS","LOCAL","DEPOSITO","COMPRAS"],
    module: "CRM",
    children: [
      { to: "/crm",               icon: LayoutDashboard, label: "Dashboard CRM",    roles: null, module: "CRM_DASHBOARD",     moduleAlt: "CRM" },
      { to: "/crm/clientes",      icon: Users,           label: "Clientes 360°",    roles: null, module: "CLIENTES_360",      moduleAlt: "CRM" },
      { to: "/crm/mensajes",      icon: MessageCircle,   label: "Inbox",            roles: null, module: "INBOX",             moduleAlt: "CRM" },
      { to: "/mensajes",          icon: MessageSquare,   label: "Mensajes internos", roles: null, module: "MENSAJES",          badgeKey: "mensajes_unread" },
      { to: "/crm/club",          icon: Crown,           label: "Mundo Club",       roles: null, module: "MUNDO_CLUB",        moduleAlt: "CRM" },
      { to: "/crm/campanas",      icon: Rocket,          label: "Campañas",         roles: null, module: "CAMPANAS",          moduleAlt: "CRM" },
      { to: "/crm/publicidad",    icon: Megaphone,       label: "Publicidad",       roles: null, module: "PUBLICIDAD",        moduleAlt: "CRM" },
      { to: "/crm/contenido",     icon: CalendarDays,    label: "Contenido",        roles: null, module: "CONTENIDO",         moduleAlt: "CRM" },
      { to: "/crm/analytics",     icon: BarChart3,       label: "Analytics CRM",    roles: null, module: "ANALYTICS_CRM",     moduleAlt: "CRM" },
      { to: "/crm/integraciones", icon: Link2,           label: "Integraciones",    roles: null, module: "INTEGRACIONES_CRM", moduleAlt: "CRM" },
      { to: "/crm/reportes",      icon: FileText,        label: "Reportes CRM",     roles: null, module: "REPORTES_CRM",      moduleAlt: "CRM" },
      { to: "/crm/ai",            icon: Bot,             label: "Asistente IA CRM", roles: null, module: "ASISTENTE_IA",      moduleAlt: "CRM" },
      { to: "/asistente",         icon: Bot,             label: "Nexus IA",         roles: null, module: "ASISTENTE_IA" },
    ],
  },

  // 9) Reportes & BI
  {
    icon: BarChart3, label: "Reportes & BI",
    roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","DEPOSITO","GESTION_PAGOS"],
    module: null,
    children: [
      { to: "/resumen",    icon: Activity,   label: "Resumen",      roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","ADMINISTRACION"],  module: "RESUMEN",      moduleAlt: "COMPRAS" },
      { to: "/reportes",   icon: BarChart3,  label: "Estadísticas", roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                      module: "ESTADISTICAS", moduleAlt: "REPORTES" },
      { to: "/kanban",     icon: Kanban,     label: "TrellOutdoor", roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","GESTION_PAGOS"], module: "KANBAN" },
      { to: "/supertrend", icon: TrendingUp, label: "SuperTrend",   roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],            module: "SUPERTREND" },
    ],
  },

  // 10) RRHH & Operaciones
  {
    icon: UserCheck, label: "RRHH & Operaciones",
    roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS","SUPERVISOR","VENDEDOR","DEPOSITO","LOCAL","MEGAADMIN"],
    module: null,
    children: [
      { to: "/naaloo",               icon: CalendarDays,    label: "Portal Empleado",       roles: null,                                                   module: "NAALOO",              moduleAlt: "RRHH" },
      { to: "/rrhh",                 icon: UserCheck,       label: "Gestión de Horarios",   roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                module: "RRHH" },
      { to: "/fichaje/checkin",      icon: MapPin,          label: "Fichar Entrada/Salida", roles: null,                                                   module: "FICHAJE" },
      { to: "/fichaje",              icon: UserCheck,       label: "Gestión Fichajes",      roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","SUPERVISOR"],   module: "FICHAJE" },
      { to: "/comisiones",           icon: BadgeDollarSign, label: "Comisiones",            roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],module: "COMISIONES",          moduleAlt: "RRHH" },
      { to: "/puntuacion-empleados", icon: Star,            label: "Puntuación Empleados",  roles: ["SUPERADMIN","ADMIN","SUPERVISOR"],                    module: "PUNTUACION_EMPLEADOS" },
      { to: "/socios-montagne",      icon: UserCheck,       label: "Socios Montagne",       roles: ["SUPERADMIN","ADMIN"],                                 module: "SOCIOS" },
      {
        icon: Wrench, label: "Taller",
        roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"],
        module: "OT",
        children: [
          { to: "/taller",          icon: Wrench, label: "Dashboard Taller",    roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "OT" },
          { to: "/taller/ot",       icon: Wrench, label: "Órdenes de Trabajo",  roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "OT" },
          { to: "/taller/clientes", icon: Users,  label: "Clientes Taller",     roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "OT" },
          { to: "/taller/stock",    icon: Package,label: "Repuestos",           roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"], module: "OT" },
        ],
      },
    ],
  },

  // 11) Sistema & Configuración
  {
    icon: Cog, label: "Sistema",
    roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],
    module: null,
    children: [
      { to: "/mega-admin",         icon: Shield,         label: "Mega Admin",          roles: ["MEGAADMIN"],          module: null },
      { to: "/licencias",          icon: Key,            label: "Licencias",           roles: ["MEGAADMIN"],          module: null },
      { to: "/locales",            icon: Store,          label: "Locales / Bases",     roles: ["SUPERADMIN","ADMIN"], module: "LOCALES" },
      { to: "/usuarios",           icon: Users,          label: "Usuarios",            roles: ["SUPERADMIN","ADMIN"], module: "USUARIOS" },
      { to: "/config-modulos",     icon: LayoutTemplate, label: "Módulos",             roles: ["SUPERADMIN","ADMIN"], module: null },
      { to: "/configurador-menu",  icon: LayoutTemplate, label: "Configurador Menú",   roles: ["SUPERADMIN","ADMIN"], module: null },
      { to: "/config",             icon: Settings,       label: "Configuración",       roles: ["SUPERADMIN"],         module: null },
      { to: "/monitoreo",          icon: Activity,       label: "Monitoreo",           roles: ["SUPERADMIN","ADMIN"], module: "MONITOREO" },
      { to: "/sync-status",        icon: RefreshCw,      label: "Estado Sync",         roles: null,                   module: "SYNC" },
      { to: "/mejoras",            icon: Lightbulb,      label: "Mejoras",             roles: ["SUPERADMIN","ADMIN"], module: "MEJORAS" },
      { to: "/propuestas",         icon: Lightbulb,      label: "Propuestas de Menú",  roles: ["SUPERADMIN","ADMIN","MEGAADMIN"], module: "PROPUESTAS" },
      { to: "/mobile-app",         icon: Smartphone,     label: "App Celular",         roles: null,                   module: null },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [localSelectorOpen, setLocalSelectorOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Auto-expand group if current path is inside it
    const groups = {};
    NAV_ITEMS.forEach(item => {
      if (item.children) {
        const allLeaves = item.children.flatMap(c => c.children ? c.children : [c]);
        const isInGroup = allLeaves.some(c => window.location.pathname === c.to || window.location.pathname.startsWith(c.to + "/"));
        if (isInGroup) groups[item.label] = true;
        item.children.forEach(child => {
          if (child.children) {
            const isInSub = child.children.some(c => window.location.pathname === c.to || window.location.pathname.startsWith(c.to + "/"));
            if (isInSub) groups[child.label] = true;
          }
        });
      }
    });
    return groups;
  });
  const toggleGroup = (label) => setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));

  // Auto-expand group when navigating into it
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.children) {
        const allLeaves = item.children.flatMap(c => c.children ? c.children : [c]);
        const isInGroup = allLeaves.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + "/"));
        if (isInGroup) setExpandedGroups(prev => prev[item.label] ? prev : { ...prev, [item.label]: true });
        item.children.forEach(child => {
          if (child.children) {
            const isInSub = child.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + "/"));
            if (isInSub) setExpandedGroups(prev => prev[child.label] ? prev : { ...prev, [child.label]: true });
          }
        });
      }
    });
  }, [location.pathname]);

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

    // Flatten NAV_ITEMS including children AND sub-groups for module guard
    const allRoutes = NAV_ITEMS.flatMap(item =>
      item.children
        ? item.children.flatMap(c =>
            c.children
              ? c.children.map(s => ({ ...s, module: s.module || c.module || item.module, moduleAlt: s.moduleAlt || c.module || item.module }))
              : [{ ...c, module: c.module || item.module, moduleAlt: c.moduleAlt || item.module }]
          )
        : [item]
    ).filter(item => item.module && item.to);

    const currentModuleRoute = allRoutes
      .sort((a, b) => b.to.length - a.to.length)
      .find(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

    if (currentModuleRoute && !activeModuleSlugs.has(currentModuleRoute.module) && !(currentModuleRoute.moduleAlt && activeModuleSlugs.has(currentModuleRoute.moduleAlt))) {
      navigate('/', { replace: true });
    }
  }, [activeModuleSlugs, location.pathname, modulesLoaded, navigate, user?.role]);

  const visibleItems = useMemo(() => {
    const isModActive = (item) => {
      if (!item.module) return true;
      if (activeModuleSlugs.has(item.module)) return true;
      if (item.moduleAlt && activeModuleSlugs.has(item.moduleAlt)) return true;
      return false;
    };
    const canSee = (item) => {
      if (isClientMode && ADMIN_ONLY_ROUTES.includes(item.to)) return false;
      if (user?.role === 'MEGAADMIN') return true;
      if (item.module && modulesLoaded && isModActive(item)) return true;
      if (item.roles && !item.roles.includes(user?.role)) return false;
      if (!item.module) return true;
      if (!modulesLoaded) return false;
      return isModActive(item);
    };
    const filtered = NAV_ITEMS.filter((item) => {
      if (item.children) {
        return canSee(item);
      }
      return canSee(item);
    }).map((item) => {
      if (item.children) {
        const visibleChildren = item.children.filter((child) => {
          if (user?.role === 'MEGAADMIN') return true;
          if (child.roles && !child.roles.includes(user?.role)) return false;
          if (child.children) return true; // sub-group: keep if passes role check
          const childMod = child.module || item.module;
          const childModAlt = child.moduleAlt || item.module;
          if (childMod && modulesLoaded) {
            return activeModuleSlugs.has(childMod) || activeModuleSlugs.has(childModAlt);
          }
          return true;
        }).map((child) => {
          if (child.children) {
            const visibleSubChildren = child.children.filter((sub) => {
              if (user?.role === 'MEGAADMIN') return true;
              if (sub.roles && !sub.roles.includes(user?.role)) return false;
              const subMod = sub.module || child.module || item.module;
              const subModAlt = sub.moduleAlt || child.module || item.module;
              if (subMod && modulesLoaded) {
                return activeModuleSlugs.has(subMod) || activeModuleSlugs.has(subModAlt);
              }
              return true;
            });
            return { ...child, children: visibleSubChildren };
          }
          return child;
        }).filter((child) => !child.children || child.children.length > 0);
        return { ...item, children: visibleChildren };
      }
      return item;
    }).filter((item) => !item.children || item.children.length > 0);
    return filtered;
  }, [isClientMode, user?.role, modulesLoaded, activeModuleSlugs]);

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
    enableAutoSync(); // auto-sync al reconectar
    flushPendingOps().catch(() => {});

    const flushInterval = setInterval(() => {
      if (navigator.onLine) flushPendingOps().catch(() => {});
    }, 60 * 1000); // cada 1 minuto

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

      {/* Sidebar — mobile only; desktop navigation is in TopNav bar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-white transition-all duration-200 ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
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

        {/* Nav search */}
        {!collapsed && (
          <div className="px-2 pt-2 pb-1 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar módulo..."
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 text-[12px] rounded-lg pl-7 pr-2 py-1.5 outline-none border border-slate-700 focus:border-slate-500 transition"
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full" style={{scrollbarWidth:'thin',scrollbarColor:'#475569 transparent'}}>
          {visibleItems.filter(item => {
            if (!navSearch) return true;
            const q = navSearch.toLowerCase();
            if (item.children) {
              const allLeafLabels = item.children.flatMap(c => c.children ? c.children.map(s => s.label) : [c.label]);
              return item.label.toLowerCase().includes(q) || allLeafLabels.some(l => l.toLowerCase().includes(q)) || item.children.some(c => c.label.toLowerCase().includes(q));
            }
            return item.label.toLowerCase().includes(q);
          }).map((item) => {
            // Grupo colapsable (tiene children)
            if (item.children) {
              const isActiveGroup = item.children.some(c => c.children
                ? c.children.some(s => location.pathname === s.to || location.pathname.startsWith(s.to + "/"))
                : location.pathname === c.to || location.pathname.startsWith(c.to + "/"));
              const isExpanded = expandedGroups[item.label] || !!navSearch || isActiveGroup;
              const filteredChildren = navSearch
                ? item.children.filter(c => {
                    const q = navSearch.toLowerCase();
                    if (c.label.toLowerCase().includes(q) || item.label.toLowerCase().includes(q)) return true;
                    if (c.children) return c.children.some(s => s.label.toLowerCase().includes(q));
                    return false;
                  })
                : item.children;
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    onMouseEnter={() => {
                      // Pre-carga el Dashboard CRM al hacer hover en el grupo
                      if (item.label === "CRM") import("../pages/crm/CRMDashboard");
                    }}
                    className={`w-full relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                      isActiveGroup
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        <ChevronDown size={14} className={`ml-auto shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>
                  {isExpanded && !collapsed && (
                    <div className="ml-3 pl-3 border-l border-slate-700/50 mt-0.5 space-y-0.5">
                      {filteredChildren.map((child) => {
                        if (child.children) {
                          const isSubExpanded = expandedGroups[child.label] || !!navSearch;
                          const isActiveSubGroup = child.children.some(s => location.pathname === s.to || location.pathname.startsWith(s.to + "/"));
                          const filteredSubChildren = navSearch
                            ? child.children.filter(s => s.label.toLowerCase().includes(navSearch.toLowerCase()) || child.label.toLowerCase().includes(navSearch.toLowerCase()))
                            : child.children;
                          return (
                            <div key={child.label}>
                              <button
                                onClick={() => toggleGroup(child.label)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                                  isActiveSubGroup
                                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <child.icon size={15} className="shrink-0" />
                                <span className="truncate">{child.label}</span>
                                <ChevronDown size={12} className={`ml-auto shrink-0 transition-transform duration-200 ${isSubExpanded ? "rotate-180" : ""}`} />
                              </button>
                              {isSubExpanded && (
                                <div className="ml-3 pl-3 border-l border-slate-700/50 mt-0.5 space-y-0.5">
                                  {filteredSubChildren.map((sub) => (
                                    <NavLink
                                      key={sub.to}
                                      to={sub.to}
                                      onClick={() => setMobileOpen(false)}
                                      className={({ isActive }) =>
                                        `relative flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                                          isActive
                                            ? "bg-blue-600/90 text-white shadow-sm"
                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                        }`
                                      }
                                    >
                                      <sub.icon size={13} className="shrink-0" />
                                      <span className="truncate">{sub.label}</span>
                                      {sub.badgeKey && counts?.[sub.badgeKey] > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                          {counts[sub.badgeKey] > 99 ? '99+' : counts[sub.badgeKey]}
                                        </span>
                                      )}
                                    </NavLink>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            end={child.to === "/crm"}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                                isActive
                                  ? "bg-blue-600/90 text-white shadow-sm"
                                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
                              }`
                            }
                          >
                            <child.icon size={15} className="shrink-0" />
                            <span className="truncate">{child.label}</span>
                            {child.badgeKey && counts?.[child.badgeKey] > 0 && (
                              <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-4 flex items-center justify-center px-1">
                                {counts[child.badgeKey] > 99 ? '99+' : counts[child.badgeKey]}
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            // Item normal (sin children)
            return (
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
            );
          })}
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

        {/* Unified dark TopBar: brand + mega-nav + right-side chips */}
        <UnifiedTopBar
          items={visibleItems}
          counts={counts}
          brand={{ app_name, short_name, primary_color }}
          user={user}
          onLogout={logout}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenLocalSelector={() => setLocalSelectorOpen(true)}
          selectedLocalName={selectedLocalName}
          hasLocal={hasLocal}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((v) => !v)}
        />

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
      <SyncProgressWidget />
      <ImprovementNotes />
      <UpdateReadyModal />
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

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedTopBar — barra superior unificada (brand + nav + right chips)
// ─────────────────────────────────────────────────────────────────────────────

function MegaDropdown({ group, counts, onNavigate }) {
  const hasSubGroups = group.children.some((c) => c.children);
  // Split flat children into up to 3 columns for better visual balance
  const columns = (() => {
    if (hasSubGroups) return null;
    const n = group.children.length;
    if (n <= 5) return [group.children];
    const perCol = Math.ceil(n / (n > 10 ? 3 : 2));
    const cols = [];
    for (let i = 0; i < group.children.length; i += perCol) {
      cols.push(group.children.slice(i, i + perCol));
    }
    return cols;
  })();

  return (
    <div
      className="absolute top-full left-0 mt-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.25)] z-[60] overflow-hidden animate-fadeInDown"
      style={{ minWidth: hasSubGroups ? 640 : 280 }}
    >
      {/* Header band */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <group.icon size={14} className="text-blue-600 dark:text-blue-400" />
        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{group.label}</span>
      </div>

      {hasSubGroups ? (
        <div className="grid grid-cols-3 gap-0 p-3">
          {group.children.map((child) => {
            if (child.children) {
              return (
                <div key={child.label} className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-700">
                    <child.icon size={11} />
                    {child.label}
                  </div>
                  <div className="space-y-0.5">
                    {child.children.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                            isActive
                              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`
                        }
                      >
                        <sub.icon size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
                        <span className="flex-1 truncate">{sub.label}</span>
                        {sub.badgeKey && counts?.[sub.badgeKey] > 0 && (
                          <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shrink-0">
                            {counts[sub.badgeKey] > 99 ? "99+" : counts[sub.badgeKey]}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors m-1 self-start ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`
                }
              >
                <child.icon size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
                <span className="flex-1 truncate">{child.label}</span>
                {child.badgeKey && counts?.[child.badgeKey] > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shrink-0">
                    {counts[child.badgeKey] > 99 ? "99+" : counts[child.badgeKey]}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      ) : (
        <div className={`grid gap-1 p-3 ${columns.length === 1 ? "grid-cols-1" : columns.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {columns.map((col, ci) => (
            <div key={ci} className="space-y-0.5">
              {col.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`
                  }
                >
                  <child.icon size={15} className="shrink-0 text-slate-400 dark:text-slate-500" />
                  <span className="flex-1 truncate">{child.label}</span>
                  {child.badgeKey && counts?.[child.badgeKey] > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shrink-0">
                      {counts[child.badgeKey] > 99 ? "99+" : counts[child.badgeKey]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavGroupButton({ item, counts, openGroup, setOpenGroup }) {
  const location = useLocation();
  const ref = useRef(null);
  const isActive = item.to
    ? item.to === "/"
      ? location.pathname === "/"
      : location.pathname === item.to || location.pathname.startsWith(item.to + "/")
    : item.children?.some((c) => {
        const leaves = c.children ? c.children : [c];
        return leaves.some(
          (l) => l.to && (location.pathname === l.to || location.pathname.startsWith(l.to + "/"))
        );
      });
  const isOpen = openGroup === item.label;

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        end={item.to === "/"}
        className={({ isActive: navActive }) =>
          `flex items-center gap-2 px-3.5 h-full text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${
            navActive
              ? "bg-slate-800/70 text-white border-blue-400"
              : "text-slate-300 hover:bg-slate-800/60 hover:text-white border-transparent"
          }`
        }
      >
        <item.icon size={15} />
        {item.label}
      </NavLink>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0 h-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenGroup(isOpen ? null : item.label);
        }}
        className={`flex items-center gap-2 px-3.5 h-full text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
          isOpen || isActive
            ? "bg-slate-800/70 text-white border-blue-400"
            : "text-slate-300 hover:bg-slate-800/60 hover:text-white border-transparent"
        }`}
      >
        <item.icon size={15} />
        {item.label}
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <MegaDropdown
          group={item}
          counts={counts}
          onNavigate={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}

function UnifiedTopBar({
  items,
  counts,
  brand,
  user,
  onLogout,
  onOpenMobileSidebar,
  onOpenSearch,
  onOpenLocalSelector,
  selectedLocalName,
  hasLocal,
  darkMode,
  onToggleDarkMode,
}) {
  const [openGroup, setOpenGroup] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const barRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close group dropdown on route change
  useEffect(() => {
    setOpenGroup(null);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setOpenGroup(null);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <header
      ref={barRef}
      className="h-12 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 flex items-stretch shrink-0 relative z-40 shadow-lg"
    >
      {/* Mobile hamburger */}
      <button
        onClick={onOpenMobileSidebar}
        className="lg:hidden flex items-center justify-center w-12 text-slate-300 hover:bg-slate-800 hover:text-white transition"
        title="Menú"
      >
        <Menu size={20} />
      </button>

      {/* Brand */}
      <div className="hidden lg:flex items-center gap-2.5 px-4 border-r border-slate-700/60">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-white shadow-inner shrink-0"
          style={{ backgroundColor: brand.primary_color }}
        >
          {brand.short_name}
        </div>
        <span className="font-semibold text-sm text-white whitespace-nowrap max-w-[140px] truncate">
          {brand.app_name}
        </span>
      </div>

      {/* Nav items — desktop */}
      <nav className="hidden lg:flex items-stretch h-full flex-1 overflow-x-auto scrollbar-hide">
        {items.map((item) => (
          <NavGroupButton
            key={item.label || item.to}
            item={item}
            counts={counts}
            openGroup={openGroup}
            setOpenGroup={setOpenGroup}
          />
        ))}
      </nav>

      {/* Mobile title (shown only on small screens) */}
      <div className="lg:hidden flex-1 flex items-center px-2">
        <span className="font-semibold text-sm text-white truncate">{brand.app_name}</span>
      </div>

      {/* Right side: chips & actions */}
      <div className="flex items-center gap-1 pr-2 pl-1 border-l border-slate-700/60">
        {/* Local chip */}
        {hasLocal ? (
          <button
            onClick={onOpenLocalSelector}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 transition truncate max-w-[160px]"
            title={`Local: ${selectedLocalName} — Click para cambiar`}
          >
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{selectedLocalName}</span>
          </button>
        ) : (
          <button
            onClick={onOpenLocalSelector}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition"
            title="Sin local asignado"
          >
            ⚠️ <span className="hidden xl:inline">Sin local</span>
          </button>
        )}

        {/* Search */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-slate-300 hover:bg-slate-700 hover:text-white transition"
          title="Buscar (Ctrl+K)"
        >
          <Search size={14} />
          <kbd className="hidden xl:block text-[10px] bg-slate-700/70 px-1 rounded border border-slate-600/50">
            Ctrl+K
          </kbd>
        </button>

        {/* Dark mode */}
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 rounded-lg hover:bg-slate-700 transition text-slate-300 hover:text-white"
          title={darkMode ? "Modo claro" : "Modo oscuro"}
        >
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <InstallPwa />

        {/* Sync indicator */}
        <div className="px-1.5">
          <SyncIndicator />
        </div>

        {/* User chip */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-700 transition"
            title="Usuario activo"
          >
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <span className="text-[12px] font-medium text-slate-200 hidden sm:block max-w-[110px] truncate">
              {user?.full_name || "Usuario"}
            </span>
            <ChevronDown size={11} className="text-slate-400 hidden sm:block" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeInDown">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.role}</p>
                {user?.email && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>}
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
