import { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ImprovementNotes from "../components/ImprovementNotes";
import UpdateReadyModal from "../components/UpdateReadyModal";
import ProfileSetupModal from "../components/ProfileSetupModal";
import EmailSetupModal from "../components/EmailSetupModal";
import InstallPwa from "../components/InstallPwa";
import OfflineBanner from "../components/OfflineBanner";
import SyncProgressWidget from "../components/SyncProgressWidget";
import LocalSelector from "../components/LocalSelector";
import ImpersonationBanner from "../components/ImpersonationBanner";
import MessageNotificationPopup from "../components/MessageNotificationPopup";
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
  Radio,
  AlertTriangle,
  Crosshair,
  ExternalLink,
  FolderOpen,
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
      { to: "/stock",            icon: Warehouse,   label: "Stock",            roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","VENDEDOR"],               module: "STOCK", openInWindow: true },
      { to: "/stock-multilocal", icon: Globe,       label: "Stock Multi-local", roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"],                      module: "STOCK_MULTILOCAL" },
      { to: "/pdf-inventario",   icon: FileText,    label: "Reorganizador PDF", roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"],                      module: "PDF_INVENTARIO" },
      { to: "/deposito",         icon: Boxes,       label: "Depósito",          roles: ["SUPERADMIN","ADMIN","DEPOSITO"],                                  module: "DEPOSITO",  moduleAlt: "STOCK" },
      { to: "/transporte", icon: Truck,       label: "Transporte", roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL"],                module: "TRANSPORTE" },
    ],
  },

  // 5) Compras & Proveedores — flujo completo de remitos, plano sin sub-grupos
  {
    icon: Briefcase, label: "Compras",
    roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","DEPOSITO","LOCAL"],
    module: null,
    children: [
      { to: "/pedidos-compras",    icon: ShoppingCart, label: "Notas de Pedido",    roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                    module: "NOTAS_PEDIDO",       moduleAlt: "COMPRAS", badgeKey: "pedidos_pendientes" },
      { to: "/recepcion",          icon: PackageCheck, label: "Recepción",          roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","ADMINISTRACION"],           module: "RECEPCION",          moduleAlt: "COMPRAS", badgeKey: "recepcion_pendiente" },
      { to: "/ingreso",            icon: Package,      label: "Ingreso Mercadería", roles: ["SUPERADMIN","ADMIN","DEPOSITO","COMPRAS","ADMINISTRACION"],         module: "INGRESO",            moduleAlt: "COMPRAS", badgeKey: "ingresos_pendientes" },
      { to: "/facturas-proveedor", icon: Receipt,      label: "Facturas / Remitos", roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL","ADMINISTRACION"], module: "FACTURAS_PROVEEDOR", moduleAlt: "COMPRAS", badgeKey: "facturas_sin_rv" },
      { to: "/completados",        icon: CheckCircle,  label: "Completados",        roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","ADMINISTRACION"],           module: "COMPLETADOS" },
      { to: "/proveedores",        icon: Truck,        label: "Proveedores",        roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                    module: "PROVEEDORES",        moduleAlt: "CATALOGO" },
      { to: "/importacion",        icon: Ship,         label: "Importación",        roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                    module: "IMPORTACION" },
    ],
  },

  // 6) Administración — tesorería, AP/AR, impuestos, informes + accesos rápidos operativos
  {
    icon: Banknote, label: "Administración",
    roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS","COMPRAS","DEPOSITO","LOCAL"],
    module: null,
    children: [
      { to: "/gestion-pagos",      icon: CreditCard,   label: "Gestión de Pagos",   roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],                    module: "PAGOS",              badgeKey: "pagos_pendientes" },
      { to: "/cajas",              icon: CreditCard,   label: "Control de Cajas",   roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS","LOCAL"],            module: null },
      { to: "/gastos-locales",     icon: Receipt,      label: "Gastos Locales",     roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS","LOCAL"],            module: null },
      { to: "/clink-api",          icon: Banknote,     label: "CLINK API",          roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],                    module: null },
      { to: "/cash-flow",          icon: Banknote,     label: "Cash Flow",          roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],                    module: null },
      { to: "/vencimientos",       icon: CalendarDays, label: "Vencimientos",       roles: ["SUPERADMIN","ADMIN","ADMINISTRACION","GESTION_PAGOS"],                    module: null },
      { to: "/ingreso",            icon: Package,      label: "Ingreso Mercadería", roles: ["SUPERADMIN","ADMIN","DEPOSITO","COMPRAS","ADMINISTRACION"],               module: "INGRESO",            moduleAlt: "COMPRAS", badgeKey: "ingresos_pendientes" },
      { to: "/recepcion",          icon: PackageCheck, label: "Recepción",          roles: ["SUPERADMIN","ADMIN","DEPOSITO","LOCAL","ADMINISTRACION"],                 module: "RECEPCION",          moduleAlt: "COMPRAS", badgeKey: "recepcion_pendiente" },
      { to: "/facturas-proveedor", icon: Receipt,      label: "Facturas / Remitos", roles: ["SUPERADMIN","ADMIN","COMPRAS","DEPOSITO","LOCAL","ADMINISTRACION"],       module: "FACTURAS_PROVEEDOR", moduleAlt: "COMPRAS", badgeKey: "facturas_sin_rv" },
      { to: "/importacion",        icon: Ship,         label: "Importación",        roles: ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION"],                          module: "IMPORTACION" },
      { to: "/informes",           icon: FileBarChart, label: "Informes",           roles: ["SUPERADMIN","ADMIN","ADMINISTRACION"],                                    module: "INFORMES" },
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
      { to: "/calendario-eventos", icon: CalendarDays, label: "Calendario Eventos", roles: null, module: null },
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

  // RFID — Gestión Inteligente de Inventarios
  {
    icon: Radio, label: "RFID",
    roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"],
    module: "RFID",
    children: [
      { to: "/rfid",            icon: Radio,          label: "Dashboard RFID",  roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "RFID" },
      { to: "/rfid/etiquetas",  icon: Package,        label: "Etiquetas",       roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"], module: "RFID_ETIQUETAS" },
      { to: "/rfid/lectores",   icon: Activity,       label: "Lectores",        roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "RFID_LECTORES" },
      { to: "/rfid/alertas",    icon: AlertTriangle,  label: "Alertas",         roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "RFID_ALERTAS" },
      { to: "/rfid/inventario", icon: Warehouse,      label: "Inventario",      roles: ["SUPERADMIN","ADMIN","DEPOSITO","MEGAADMIN"], module: "RFID_INVENTARIO" },
      { to: "/rfid/propuesta",  icon: Lightbulb,      label: "Propuesta ROI",   roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "RFID_PROPUESTA" },
      { to: "/rfid/presupuesto", icon: BadgeDollarSign, label: "Presupuesto",     roles: ["SUPERADMIN","ADMIN","MEGAADMIN"],            module: "RFID_PROPUESTA" },
      { to: "/rfid/contenido",  icon: FolderOpen,     label: "Contenido",       roles: ["SUPERADMIN","ADMIN","MEGAADMIN","VENDEDOR","DEPOSITO"], module: "RFID_CONTENIDO" },
    ],
  },

  // 11) Sistema & Configuración
  {
    icon: Cog, label: "Sistema",
    roles: null,
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
      { to: "/mejoras",            icon: Lightbulb,      label: "Mejoras",             roles: null,                   module: "MEJORAS" },
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [arenaCode, setArenaCode] = useState("");
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
        if (isInGroup) setExpandedGroups(prev => prev[item.label] !== undefined ? prev : { ...prev, [item.label]: true });
        item.children.forEach(child => {
          if (child.children) {
            const isInSub = child.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + "/"));
            if (isInSub) setExpandedGroups(prev => prev[child.label] !== undefined ? prev : { ...prev, [child.label]: true });
          }
        });
      }
    });
  }, [location.pathname]);

  const userMenuRef = useRef(null);
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
    refetchInterval: 30000,
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
  const isElectron = typeof window !== 'undefined' && !!window.__electron;
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
      // Restricción por username (whitelist absoluta — bypasea incluso a MEGAADMIN si no está en la lista)
      if (item.usernames) {
        return item.usernames.includes((user?.username || "").toLowerCase());
      }
      if (user?.role === 'MEGAADMIN') return true;
      if (item.usernames) {
        return item.usernames.includes((user?.username || "").toLowerCase());
      }
      if (item.module && modulesLoaded && isModActive(item)) return true;
      // Parent groups: show if ANY child has an active module (e.g. DEPOSITO with MEJORAS enabled)
      if (item.children && modulesLoaded) {
        const hasActiveChild = item.children.some((child) => {
          const cm = child.module || item.module;
          const cma = child.moduleAlt || item.module;
          return cm && (activeModuleSlugs.has(cm) || (cma && activeModuleSlugs.has(cma)));
        });
        if (hasActiveChild) return true;
      }
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
          if (child.children) return true; // sub-group: keep for now
          // Module check FIRST — active module bypasses role restriction
          const childMod = child.module || item.module;
          const childModAlt = child.moduleAlt || item.module;
          if (childMod && modulesLoaded && (activeModuleSlugs.has(childMod) || activeModuleSlugs.has(childModAlt))) return true;
          // Then role check for non-module items
          if (child.roles && !child.roles.includes(user?.role)) return false;
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

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
              // Si el usuario colapsó explícitamente (false), respetar esa decisión aunque la ruta sea hija
              const manualState = expandedGroups[item.label];
              const isExpanded = !!navSearch || (manualState === undefined ? isActiveGroup : manualState);
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
                        // En Electron: items con openInWindow se abren en ventana separada
                        if (child.openInWindow && isElectron) {
                          return (
                            <button
                              key={child.to}
                              onClick={() => { window.__electron.openWindow(child.to, child.label); setMobileOpen(false); }}
                              className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors text-slate-400 hover:bg-slate-800 hover:text-white w-full"
                              title={`Abrir ${child.label} en ventana separada`}
                            >
                              <child.icon size={15} className="shrink-0" />
                              <span className="truncate">{child.label}</span>
                              <ExternalLink size={10} className="ml-auto text-slate-500 shrink-0" />
                            </button>
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
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 shrink-0 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition mr-3"
          >
            <Menu size={20} />
          </button>
          {/* Mensajería central */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => navigate("/mensajes")}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition ${
                (counts?.mensajes_unread ?? 0) > 0
                  ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                  : "text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title="Mensajería interna — chats y notificaciones"
            >
              <MessageSquare size={16} className={(counts?.mensajes_unread ?? 0) > 0 ? "text-blue-600 dark:text-blue-400" : ""} />
              <span>Mensajería</span>
              {(counts?.mensajes_unread ?? 0) > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                  {counts.mensajes_unread > 99 ? "99+" : counts.mensajes_unread}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
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
            {/* User chip */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition text-sm font-medium text-gray-700 max-w-[180px]"
                title="Usuario activo"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <span className="truncate hidden sm:block">{user?.full_name || "Usuario"}</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.role}</p>
                    {user?.email && <p className="text-xs text-gray-400 truncate">{user?.email}</p>}
                  </div>
                  {["malegre", "admindepo"].includes((user?.username || "").toLowerCase()) && (
                    <div className="px-4 py-2 border-b border-gray-100">
                      <input
                        type="text"
                        value={arenaCode}
                        onChange={(e) => {
                          const v = e.target.value;
                          setArenaCode(v);
                          if (v.toLowerCase() === "arena") {
                            setArenaCode("");
                            setUserMenuOpen(false);
                            navigate("/arena");
                          }
                        }}
                        placeholder="Código secreto…"
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 text-gray-600 placeholder-gray-300"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <LogOut size={15} />
                    Cerrar sesión / Cambiar usuario
                  </button>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">v0.1.0</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-32">
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
      <ProfileSetupModal />
      <EmailSetupModal />
      <MessageNotificationPopup />

      {/* Botón flotante de mensajería — bottom-left, presente en todas las páginas */}
      <div className="fixed bottom-6 left-6 z-[9000]">
        <button
          onClick={() => navigate("/mensajes")}
          className="relative flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl transition-all hover:scale-105 active:scale-95"
          title="Mensajería interna"
        >
          <MessageSquare size={20} />
          {(counts?.mensajes_unread ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none pointer-events-none">
              {counts.mensajes_unread > 99 ? "99+" : counts.mensajes_unread}
            </span>
          )}
        </button>
      </div>
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
