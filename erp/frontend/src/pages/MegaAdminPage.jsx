import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Building2,
  Users,
  Package,
  BarChart3,
  Search,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Blocks,
  X,
  Save,
  UserCog,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  CreditCard,
  Crown,
  Star,
  Zap,
  Gem,
  Calendar,
  Rocket,
  HeartPulse,
  Layers,
  ChevronDown,
  ChevronUp,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Copy,
  Trash2,
  RotateCcw,
  MapPin,
  Eye,
  Edit3,
} from "lucide-react";

// ── Grupos de módulos organizados por sección del sidebar ────────────────────
const SIDEBAR_GROUPS = [
  {
    key: "ventas", label: "🛒 Ventas",
    color: "bg-amber-50 border-amber-200 text-amber-700",
    modules: [
      { slug: "VENTAS",     label: "Facturación / POS" },
      { slug: "CONSULTAS",  label: "Consultas ERP" },
      { slug: "COMPARADOR", label: "Comparador Precios" },
    ],
  },
  {
    key: "ecommerce", label: "🌐 E-commerce",
    color: "bg-yellow-50 border-yellow-200 text-yellow-700",
    modules: [
      { slug: "MERCADOLIBRE", label: "MercadoLibre — Depósito" },
    ],
  },
  {
    key: "catalogo", label: "📦 Catálogo & Stock",
    color: "bg-emerald-50 border-emerald-200 text-emerald-700",
    modules: [
      { slug: "PRODUCTOS",      label: "Productos" },
      { slug: "CATALOGO",       label: "Catálogo (Proveedores/Precios)" },
      { slug: "STOCK",          label: "Stock" },
      { slug: "DEPOSITO",       label: "Depósito" },
      { slug: "TRANSPORTE",     label: "Transporte" },
      { slug: "PDF_INVENTARIO", label: "Reorganizador PDF de Inventario" },
      { slug: "STOCK_MULTILOCAL", label: "Stock Multi-local" },
    ],
  },
  {
    key: "compras", label: "🛍️ Compras & Proveedores",
    color: "bg-sky-50 border-sky-200 text-sky-700",
    modules: [
      { slug: "COMPRAS",             label: "Compras (general)" },
      { slug: "NOTAS_PEDIDO",        label: "Notas de Pedido" },
      { slug: "RECEPCION",           label: "Recepción" },
      { slug: "INGRESO",             label: "Ingreso Mercadería" },
      { slug: "FACTURAS_PROVEEDOR",  label: "Facturas / Remitos" },
      { slug: "COMPLETADOS",         label: "Completados" },
      { slug: "PROVEEDORES",         label: "Proveedores" },
      { slug: "IMPORTACION",         label: "Importación" },
    ],
  },
  {
    key: "admin", label: "💰 Administración",
    color: "bg-purple-50 border-purple-200 text-purple-700",
    modules: [
      { slug: "PAGOS",    label: "Gestión de Pagos" },
      { slug: "INFORMES", label: "Informes" },
    ],
  },
  {
    key: "crm", label: "💬 CRM & Marketing",
    color: "bg-cyan-50 border-cyan-200 text-cyan-700",
    modules: [
      { slug: "CRM",      label: "CRM Completo (Clientes 360, Club, Campañas, etc.)" },
      { slug: "MENSAJES",  label: "Mensajes internos" },
    ],
  },
  {
    key: "reportes", label: "📊 Reportes & BI",
    color: "bg-orange-50 border-orange-200 text-orange-700",
    modules: [
      { slug: "REPORTES",     label: "Reportes / Analytics" },
      { slug: "RESUMEN",      label: "Resumen" },
      { slug: "ESTADISTICAS", label: "Estadísticas" },
      { slug: "KANBAN",       label: "TrellOutdoor" },
      { slug: "SUPERTREND",   label: "SuperTrend" },
    ],
  },
  {
    key: "rrhh", label: "👥 RRHH & Operaciones",
    color: "bg-rose-50 border-rose-200 text-rose-700",
    modules: [
      { slug: "RRHH",                 label: "Recursos Humanos" },
      { slug: "NAALOO",               label: "Portal Empleado (Naaloo)" },
      { slug: "FICHAJE",              label: "Fichaje Entrada/Salida" },
      { slug: "COMISIONES",           label: "Comisiones" },
      { slug: "PUNTUACION_EMPLEADOS", label: "Puntuación Empleados" },
      { slug: "SOCIOS",               label: "Socios Montagne" },
      { slug: "OT",                   label: "Órdenes de Trabajo (Taller)" },
    ],
  },
  {
    key: "sistema", label: "⚙️ Sistema",
    color: "bg-gray-50 border-gray-200 text-gray-600",
    modules: [
      { slug: "LOCALES",    label: "Locales / Bases" },
      { slug: "USUARIOS",   label: "Usuarios" },
      { slug: "MONITOREO",  label: "Monitoreo" },
      { slug: "SYNC",       label: "Sincronización Offline" },
      { slug: "MEJORAS",    label: "Mejoras del ERP" },
      { slug: "PROPUESTAS", label: "Propuestas de Menú" },
    ],
  },
  {
    key: "rfid", label: "📡 RFID — Gestión Inteligente",
    color: "bg-teal-50 border-teal-200 text-teal-700",
    modules: [
      { slug: "RFID",           label: "Dashboard RFID" },
      { slug: "RFID_ETIQUETAS", label: "Etiquetas" },
      { slug: "RFID_LECTORES",  label: "Lectores" },
      { slug: "RFID_ALERTAS",   label: "Alertas" },
      { slug: "RFID_INVENTARIO",label: "Inventario RFID" },
      { slug: "RFID_PROPUESTA", label: "Propuesta ROI" },
    ],
  },
];

// Derivado: lista plana para compatibilidad con paneles de usuario
const ALL_MODULES = SIDEBAR_GROUPS.flatMap(g => g.modules);

// Groups matching ERP sidebar structure — used in user permissions panel
const MODULE_GROUPS = {
  // Ventas
  VENTAS: "🛒 Ventas", CONSULTAS: "🛒 Ventas", COMPARADOR: "🛒 Ventas",
  // E-commerce
  MERCADOLIBRE: "🌐 E-commerce", ML_INDUMENTARIA: "🌐 E-commerce", ML_NEUQUEN: "🌐 E-commerce",
  VTEX_CANAL: "🌐 E-commerce", VTEX_INACTIVOS: "🌐 E-commerce", DRAGONFISH: "🌐 E-commerce",
  // Catálogo & Stock
  PRODUCTOS: "📦 Catálogo & Stock", CATALOGO: "📦 Catálogo & Stock", STOCK: "📦 Catálogo & Stock",
  DEPOSITO: "📦 Catálogo & Stock", TRANSPORTE: "📦 Catálogo & Stock",
  PDF_INVENTARIO: "📦 Catálogo & Stock", STOCK_MULTILOCAL: "📦 Catálogo & Stock",
  // Compras
  NOTAS_PEDIDO: "🛍️ Compras", RECEPCION: "🛍️ Compras", INGRESO: "🛍️ Compras",
  FACTURAS_PROVEEDOR: "🛍️ Compras", COMPLETADOS: "🛍️ Compras", PROVEEDORES: "🛍️ Compras",
  IMPORTACION: "🛍️ Compras", COMPRAS: "🛍️ Compras",
  // Administración
  PAGOS: "💰 Administración", INFORMES: "💰 Administración",
  RESUMEN: "💰 Administración", ESTADISTICAS: "💰 Administración",
  // CRM & Marketing
  CRM: "💬 CRM & Marketing", CRM_DASHBOARD: "💬 CRM & Marketing", CLIENTES_360: "💬 CRM & Marketing",
  INBOX: "💬 CRM & Marketing", MENSAJES: "💬 CRM & Marketing", MUNDO_CLUB: "💬 CRM & Marketing",
  CAMPANAS: "💬 CRM & Marketing", PUBLICIDAD: "💬 CRM & Marketing", CONTENIDO: "💬 CRM & Marketing",
  ANALYTICS_CRM: "💬 CRM & Marketing", INTEGRACIONES_CRM: "💬 CRM & Marketing",
  REPORTES_CRM: "💬 CRM & Marketing", ASISTENTE_IA: "💬 CRM & Marketing",
  // RRHH
  RRHH: "👥 RRHH & Operaciones", FICHAJE: "👥 RRHH & Operaciones", COMISIONES: "👥 RRHH & Operaciones",
  PUNTUACION_EMPLEADOS: "👥 RRHH & Operaciones", SOCIOS: "👥 RRHH & Operaciones", OT: "👥 RRHH & Operaciones",
  NAALOO: "👥 RRHH & Operaciones",
  // Reportes & BI
  REPORTES: "📊 Reportes & BI", RESUMEN: "📊 Reportes & BI", ESTADISTICAS: "📊 Reportes & BI",
  KANBAN: "📊 Reportes & BI", SUPERTREND: "📊 Reportes & BI",
  // Sistema
  LOCALES: "⚙️ Sistema", USUARIOS: "⚙️ Sistema", MONITOREO: "⚙️ Sistema",
  SYNC: "⚙️ Sistema", MEJORAS: "⚙️ Sistema", PROPUESTAS: "⚙️ Sistema",
  // RFID
  RFID: "📡 RFID", RFID_ETIQUETAS: "📡 RFID", RFID_LECTORES: "📡 RFID",
  RFID_ALERTAS: "📡 RFID", RFID_INVENTARIO: "📡 RFID", RFID_PROPUESTA: "📡 RFID",
};

const ROLE_COLORS = {
  SUPERADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  COMPRAS: "bg-amber-100 text-amber-800",
  ADMINISTRACION: "bg-teal-100 text-teal-800",
  GESTION_PAGOS: "bg-pink-100 text-pink-800",
  LOCAL: "bg-green-100 text-green-800",
  VENDEDOR: "bg-cyan-100 text-cyan-800",
  DEPOSITO: "bg-orange-100 text-orange-800",
  MEGAADMIN: "bg-red-100 text-red-800",
};

export default function MegaAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [editForm, setEditForm] = useState({});
  const [brandingForm, setBrandingForm] = useState({});
  const [selectedModules, setSelectedModules] = useState([]);
  const [impersonating, setImpersonating] = useState(null);
  const [showPlansSection, setShowPlansSection] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({});
  const [subscribeForm, setSubscribeForm] = useState({ plan_id: "", status: "ACTIVE", expires_at: "", notes: "" });
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickSetupForm, setQuickSetupForm] = useState({
    company_name: "", cuit: "", industry_type: "OTRO",
    admin_username: "", admin_password: "", admin_full_name: "", admin_email: "",
    plan_tier: "STARTER", trial_days: 30,
  });
  const [quickSetupResult, setQuickSetupResult] = useState(null);
  const [healthModal, setHealthModal] = useState(null);

  // ── Queries ──
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["mega-stats"],
    queryFn: () => api.get("/mega/stats"),
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["mega-companies"],
    queryFn: () => api.get("/mega/companies"),
  });

  const { data: companyDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["mega-company", selectedCompanyId],
    queryFn: () => api.get(`/mega/companies/${selectedCompanyId}`),
    enabled: !!selectedCompanyId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get("/plans/"),
  });

  const { data: companySubscription, refetch: refetchSub } = useQuery({
    queryKey: ["company-subscription", selectedCompanyId],
    queryFn: () => api.get(`/plans/subscription/${selectedCompanyId}`),
    enabled: !!selectedCompanyId,
  });

  // ── Mutations ──
  const updateCompany = useMutation({
    mutationFn: (data) => api.patch(`/mega/companies/${selectedCompanyId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mega-companies"] });
      queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["mega-stats"] });
    },
  });

  const toggleCompany = useMutation({
    mutationFn: (id) => api.patch(`/mega/companies/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mega-companies"] });
      queryClient.invalidateQueries({ queryKey: ["mega-stats"] });
    },
  });

  const updateModules = useMutation({
    mutationFn: (moduleSlugs) =>
      api.patch(`/mega/companies/${selectedCompanyId}/modules`, { module_slugs: moduleSlugs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mega-companies"] });
      queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["mega-stats"] });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId) => api.post(`/mega/impersonate/${userId}`),
    onSuccess: (data, userId) => {
      const originalToken = sessionStorage.getItem("token");
      const targetUser = companyDetail?.users?.find((u) => u.id === userId);
      sessionStorage.setItem("mega_original_token", originalToken);
      sessionStorage.setItem("token", data.access_token);
      setImpersonating(targetUser?.full_name || targetUser?.username || `User #${userId}`);
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: (data) =>
      editingPlan?.id
        ? api.patch(`/plans/${editingPlan.id}`, data)
        : api.post("/plans/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setEditingPlan(null);
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: (data) => api.post("/plans/subscribe", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-subscription", selectedCompanyId] });
    },
  });

  const quickSetupMutation = useMutation({
    mutationFn: (data) => api.post("/onboarding/quick-setup", data),
    onSuccess: (result) => {
      setQuickSetupResult(result);
      queryClient.invalidateQueries({ queryKey: ["mega-companies"] });
      queryClient.invalidateQueries({ queryKey: ["mega-stats"] });
    },
  });

  const healthMutation = useMutation({
    mutationFn: (companyId) => api.get(`/onboarding/health/${companyId}`),
    onSuccess: (data) => setHealthModal(data),
  });

  // ── Filtered list ──
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return companies;
    const q = searchTerm.toLowerCase();
    return companies.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.cuit?.toLowerCase().includes(q) ||
        c.industry_type?.toLowerCase().includes(q)
    );
  }, [companies, searchTerm]);

  // Auto-select first company and show users tab by default
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId && !companiesLoading) {
      const first = companies[0];
      setSelectedCompanyId(first.id);
      setActiveTab("usuarios");
      setEditForm({ name: first.name || "", cuit: first.cuit || "", address: first.address || "", phone: first.phone || "", email: first.email || "" });
      setBrandingForm({ app_name: first.app_name || "", short_name: first.short_name || "", primary_color: first.primary_color || "#3B82F6", secondary_color: first.secondary_color || "#1E40AF", welcome_message: first.welcome_message || "" });
    }
  }, [companies, companiesLoading]); // eslint-disable-line

  // ── Open modal ──
  const openDetail = (company) => {
    setSelectedCompanyId(company.id);
    setActiveTab("info");
    setEditForm({
      name: company.name || "",
      cuit: company.cuit || "",
      address: company.address || "",
      phone: company.phone || "",
      email: company.email || "",
    });
    setBrandingForm({
      app_name: company.app_name || "",
      short_name: company.short_name || "",
      primary_color: company.primary_color || "#3B82F6",
      secondary_color: company.secondary_color || "#1E40AF",
      welcome_message: company.welcome_message || "",
    });
  };

  // When detail loads, sync modules
  const detailModules = companyDetail?.modules?.filter((m) => m.is_active).map((m) => m.slug) || [];
  if (
    companyDetail &&
    selectedCompanyId &&
    activeTab === "modulos" &&
    selectedModules.length === 0 &&
    detailModules.length > 0 &&
    selectedModules.join(",") !== detailModules.join(",")
  ) {
    setSelectedModules(detailModules);
  }

  const closeModal = () => {
    setSelectedCompanyId(null);
    setSelectedModules([]);
  };

  const handleSaveInfo = () => updateCompany.mutate(editForm);
  const handleSaveBranding = () => updateCompany.mutate(brandingForm);
  const handleSaveModules = () => updateModules.mutate(selectedModules);

  const handleStopImpersonating = () => {
    const original = sessionStorage.getItem("mega_original_token");
    if (original) {
      sessionStorage.setItem("token", original);
      sessionStorage.removeItem("mega_original_token");
    }
    setImpersonating(null);
    window.location.reload();
  };

  const toggleModule = (slug) => {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // ── Total active modules across all companies ──
  const totalActiveModules = companies.reduce((sum, c) => sum + (c.module_count || 0), 0);

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Impersonate banner */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg">
          <AlertTriangle size={16} />
          <span>Impersonando: {impersonating}</span>
          <button
            onClick={handleStopImpersonating}
            className="ml-2 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
          >
            ← Volver
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🛡️ Mega Admin Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Control total de la plataforma multi-tenant</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPlansSection((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              showPlansSection
                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Crown className="w-4 h-4" /> Planes
          </button>
          <button
            onClick={() => { setShowQuickSetup(true); setQuickSetupResult(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            <Rocket className="w-4 h-4" /> Setup Rápido
          </button>
          <button
            onClick={() => navigate("/mega-admin/nueva-empresa")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Nueva Empresa
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Empresas"
          value={stats?.total_companies ?? "—"}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          icon={CheckCircle}
          label="Empresas Activas"
          value={stats?.total_active_companies ?? "—"}
          color="green"
          loading={statsLoading}
        />
        <StatCard
          icon={Users}
          label="Total Usuarios"
          value={stats?.total_users ?? "—"}
          color="purple"
          loading={statsLoading}
        />
        <StatCard
          icon={Package}
          label="Total Módulos Activos"
          value={totalActiveModules || "—"}
          color="amber"
          loading={statsLoading}
        />
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar empresa por nombre, CUIT o industria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} empresas</span>
      </div>

      {/* Plans Section */}
      {showPlansSection && (
        <PlansSection
          plans={plans}
          onEdit={(plan) => {
            setEditingPlan(plan);
            setPlanForm({
              name: plan.name,
              tier: plan.tier,
              description: plan.description || "",
              max_users: plan.max_users,
              max_locals: plan.max_locals,
              max_products: plan.max_products,
              max_modules: plan.max_modules,
              price_monthly: plan.price_monthly,
              price_currency: plan.price_currency || "ARS",
              is_default: plan.is_default,
            });
          }}
          onCreate={() => {
            setEditingPlan({ _new: true });
            setPlanForm({
              name: "",
              tier: "STARTER",
              description: "",
              max_users: 5,
              max_locals: 1,
              max_products: 500,
              max_modules: 5,
              price_monthly: 0,
              price_currency: "ARS",
              is_default: false,
            });
          }}
        />
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <EditPlanModal
          form={planForm}
          setForm={setPlanForm}
          isNew={!!editingPlan._new}
          onClose={() => setEditingPlan(null)}
          onSave={() => savePlanMutation.mutate(planForm)}
          saving={savePlanMutation.isPending}
        />
      )}

      {/* Companies table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Industria</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">CUIT</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Usuarios</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Módulos</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companiesLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No se encontraron empresas
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetail(c)}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.industry_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.cuit || "—"}</td>
                    <td className="px-4 py-3 text-center">{c.user_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">{c.module_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDetail(c)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => toggleCompany.mutate(c.id)}
                          className={`p-1.5 rounded-lg transition ${
                            c.is_active
                              ? "hover:bg-red-50 text-red-500"
                              : "hover:bg-green-50 text-green-600"
                          }`}
                          title={c.is_active ? "Desactivar" : "Activar"}
                        >
                          {c.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        </button>
                        <button
                          onClick={() => {
                            openDetail(c);
                            setTimeout(() => setActiveTab("modulos"), 50);
                          }}
                          className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition"
                          title="Gestionar módulos"
                        >
                          <Blocks size={15} />
                        </button>
                        <button
                          onClick={() => healthMutation.mutate(c.id)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition"
                          title="Diagnóstico"
                        >
                          <HeartPulse size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company detail modal */}
      {selectedCompanyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {companyDetail?.name || "Empresa"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              {[
                { key: "info", label: "Info", icon: Building2 },
                { key: "branding", label: "Branding", icon: BarChart3 },
                { key: "modulos", label: "Módulos", icon: Blocks },
                { key: "plan", label: "Plan", icon: CreditCard },
                { key: "usuarios", label: "Usuarios", icon: Users },
                { key: "licencias", label: "Licencias PC", icon: Monitor },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key === "modulos" && companyDetail) {
                      const active = companyDetail.modules?.filter((m) => m.is_active).map((m) => m.slug) || [];
                      setSelectedModules(active);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : activeTab === "info" ? (
                <TabInfo form={editForm} setForm={setEditForm} onSave={handleSaveInfo} saving={updateCompany.isPending} success={updateCompany.isSuccess} />
              ) : activeTab === "branding" ? (
                <TabBranding form={brandingForm} setForm={setBrandingForm} onSave={handleSaveBranding} saving={updateCompany.isPending} success={updateCompany.isSuccess} companyId={selectedCompanyId} companyDetail={companyDetail} queryClient={queryClient} />
              ) : activeTab === "modulos" ? (
                <TabModules
                  selected={selectedModules}
                  onToggle={toggleModule}
                  onSave={handleSaveModules}
                  saving={updateModules.isPending}
                  success={updateModules.isSuccess}
                />
              ) : activeTab === "plan" ? (
                <TabPlan
                  plans={plans}
                  subscription={companySubscription}
                  companyId={selectedCompanyId}
                  subscribeForm={subscribeForm}
                  setSubscribeForm={setSubscribeForm}
                  onSubscribe={(data) => subscribeMutation.mutate(data)}
                  saving={subscribeMutation.isPending}
                  success={subscribeMutation.isSuccess}
                />
              ) : activeTab === "licencias" ? (
                <TabLicencias
                  companyId={selectedCompanyId}
                  locals={companyDetail?.locals || []}
                />
              ) : (
                <TabUsers
                  users={companyDetail?.users || []}
                  companyModules={companyDetail?.modules || []}
                  onImpersonate={(uid) => impersonateMutation.mutate(uid)}
                  impersonating={impersonateMutation.isPending}
                  queryClient={queryClient}
                  selectedCompanyId={selectedCompanyId}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Setup Modal */}
      {showQuickSetup && (
        <QuickSetupModal
          form={quickSetupForm}
          setForm={setQuickSetupForm}
          result={quickSetupResult}
          onClose={() => { setShowQuickSetup(false); setQuickSetupResult(null); }}
          onSubmit={() => quickSetupMutation.mutate(quickSetupForm)}
          saving={quickSetupMutation.isPending}
          error={quickSetupMutation.error?.message}
        />
      )}

      {/* Health Modal */}
      {healthModal && (
        <HealthModal data={healthModal} onClose={() => setHealthModal(null)} />
      )}
    </div>
  );
}

// ── Stat Card ──
function StatCard({ icon: Icon, label, value, color, loading }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">
          {loading ? <span className="animate-pulse text-gray-300">—</span> : value}
        </p>
      </div>
    </div>
  );
}

// ── Tab: Info ──
function TabInfo({ form, setForm, onSave, saving, success }) {
  const fields = [
    { key: "name", label: "Nombre", placeholder: "Nombre de la empresa" },
    { key: "cuit", label: "CUIT", placeholder: "XX-XXXXXXXX-X" },
    { key: "address", label: "Dirección", placeholder: "Dirección" },
    { key: "phone", label: "Teléfono", placeholder: "+54..." },
    { key: "email", label: "Email", placeholder: "admin@empresa.com" },
  ];
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          <input
            type="text"
            value={form[f.key] || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      <SaveButton onClick={onSave} saving={saving} success={success} />
    </div>
  );
}

// ── Tab: Branding ──
function TabBranding({ form, setForm, onSave, saving, success, companyId, companyDetail, queryClient }) {
  const [iconData, setIconData] = useState(companyDetail?.icon_data || null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  return (
    <div className="space-y-4">
      {/* Icon Upload Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Icono / Logo</label>
        <div className="flex items-center gap-4">
          {iconData ? (
            <img src={iconData} alt="icon" className="w-16 h-16 rounded-lg object-cover border" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-500">
              {form.short_name || "?"}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              disabled={uploadingIcon}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append("file", file);
                setUploadingIcon(true);
                try {
                  await api.uploadFile(`/mega/companies/${companyId}/icon`, formData);
                  queryClient.invalidateQueries({ queryKey: ["mega-company", companyId] });
                  const reader = new FileReader();
                  reader.onload = () => setIconData(reader.result);
                  reader.readAsDataURL(file);
                } catch (err) {
                  alert("Error al subir icono: " + (err.message || "Error"));
                } finally {
                  setUploadingIcon(false);
                }
              }}
              className="text-sm"
            />
            {iconData && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.delete(`/mega/companies/${companyId}/icon`);
                    setIconData(null);
                    queryClient.invalidateQueries({ queryKey: ["mega-company", companyId] });
                  } catch (err) {
                    alert("Error al eliminar icono: " + (err.message || "Error"));
                  }
                }}
                className="text-red-500 text-xs hover:underline text-left"
              >
                Eliminar icono
              </button>
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la App</label>
        <input
          type="text"
          value={form.app_name || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, app_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre corto</label>
        <input
          type="text"
          value={form.short_name || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, short_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color primario</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_color || "#3B82F6"}
              onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <span className="text-xs text-gray-500 font-mono">{form.primary_color}</span>
            <div className="w-8 h-8 rounded-lg shadow-inner border" style={{ backgroundColor: form.primary_color }} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color secundario</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.secondary_color || "#1E40AF"}
              onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <span className="text-xs text-gray-500 font-mono">{form.secondary_color}</span>
            <div className="w-8 h-8 rounded-lg shadow-inner border" style={{ backgroundColor: form.secondary_color }} />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</label>
        <textarea
          value={form.welcome_message || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, welcome_message: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      {/* Preview */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <p className="text-xs text-gray-500 mb-2 font-medium">Vista previa</p>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: form.primary_color }}
          >
            {form.short_name || "MO"}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: form.primary_color }}>
              {form.app_name || "App Name"}
            </p>
            <p className="text-xs text-gray-400">{form.welcome_message || "Bienvenido"}</p>
          </div>
        </div>
      </div>
      <SaveButton onClick={onSave} saving={saving} success={success} />
    </div>
  );
}

// ── Tab: Modules ──
function TabModules({ selected, onToggle, onSave, saving, success }) {
  const toggleGroup = (slugs, enable) => {
    for (const slug of slugs) {
      const active = selected.includes(slug);
      if (enable && !active) onToggle(slug);
      if (!enable && active) onToggle(slug);
    }
  };

  const allSlugs = ALL_MODULES.map((m) => m.slug);
  const globalAllOn = allSlugs.every((s) => selected.includes(s));
  const globalAllOff = allSlugs.every((s) => !selected.includes(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Módulos activos — <strong>{selected.length}</strong> de {ALL_MODULES.length} habilitados
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => toggleGroup(allSlugs, true)}
            disabled={globalAllOn}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-40"
          >
            <ShieldCheck size={13} /> Activar TODOS
          </button>
          <button
            onClick={() => toggleGroup(allSlugs, false)}
            disabled={globalAllOff}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-40"
          >
            <ShieldOff size={13} /> Desactivar TODOS
          </button>
        </div>
      </div>

      {SIDEBAR_GROUPS.map((group) => {
        const slugs = group.modules.map((m) => m.slug);
        const activeCount = slugs.filter((s) => selected.includes(s)).length;
        const allOn = activeCount === slugs.length;
        const allOff = activeCount === 0;
        const colorClasses = group.color.split(" ");
        return (
          <div key={group.key} className={`rounded-xl border p-4 ${colorClasses.slice(0, 2).join(" ")} ${colorClasses[2]}`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{group.label}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 border border-current/10">
                  {activeCount}/{slugs.length}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleGroup(slugs, true)}
                  disabled={allOn}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition disabled:opacity-40"
                >
                  <ShieldCheck size={12} /> Grupo completo
                </button>
                <button
                  onClick={() => toggleGroup(slugs, false)}
                  disabled={allOff}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition disabled:opacity-40"
                >
                  <ShieldOff size={12} /> Quitar grupo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {group.modules.map((m) => {
                const active = selected.includes(m.slug);
                return (
                  <button
                    key={m.slug}
                    onClick={() => onToggle(m.slug)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition ${
                      active
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {active ? <CheckCircle size={15} /> : <XCircle size={15} className="text-gray-300" />}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <SaveButton onClick={onSave} saving={saving} success={success} />
    </div>
  );
}

// ── Tab: Users ──
function TabUsers({ users, companyModules, onImpersonate, impersonating, queryClient, selectedCompanyId }) {
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userSubTab, setUserSubTab] = useState({}); // userId -> "datos" | "permisos"
  const [userModules, setUserModules] = useState({});
  const [userReadonly, setUserReadonly] = useState({});
  const [userEdits, setUserEdits] = useState({});
  const [search, setSearch] = useState("");

  const activeCompanySlugs = new Set(
    companyModules.filter((m) => m.is_active).map((m) => m.module_slug)
  );

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const setModulesMutation = useMutation({
    mutationFn: ({ userId, modules_override }) =>
      api.patch(`/mega/users/${userId}/modules`, { modules_override }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] }),
  });

  const setPermsMutation = useMutation({
    mutationFn: ({ userId, modules_readonly }) =>
      api.patch(`/mega/users/${userId}/module-permissions`, { modules_readonly }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => api.patch(`/mega/users/${userId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] }),
  });

  const toggleUserModule = (userId, slug) => {
    setUserModules((prev) => {
      const base = prev[userId] ?? [...activeCompanySlugs];
      const set = new Set(base);
      if (set.has(slug)) set.delete(slug); else set.add(slug);
      return { ...prev, [userId]: [...set] };
    });
  };

  const toggleReadonly = (userId, slug) => {
    setUserReadonly((prev) => {
      const base = prev[userId] ?? [];
      const set = new Set(base);
      if (set.has(slug)) set.delete(slug); else set.add(slug);
      return { ...prev, [userId]: [...set] };
    });
  };

  // Set a specific state for one module
  const setModuleState = (userId, slug, targetState) => {
    const activeList = [...activeCompanySlugs];
    const getOverride = (prev) => (prev[userId] !== undefined ? prev[userId] : null);
    if (targetState === "hidden") {
      setUserModules((prev) => {
        const cur = getOverride(prev);
        const base = cur !== null ? cur : activeList;
        return { ...prev, [userId]: base.filter((s) => s !== slug) };
      });
      setUserReadonly((prev) => ({ ...prev, [userId]: (prev[userId] ?? []).filter((s) => s !== slug) }));
    } else if (targetState === "readonly") {
      setUserModules((prev) => {
        const cur = getOverride(prev);
        const base = cur !== null ? cur : activeList;
        if (!base.includes(slug)) return { ...prev, [userId]: [...base, slug] };
        return prev;
      });
      setUserReadonly((prev) => {
        const base = prev[userId] ?? [];
        if (!base.includes(slug)) return { ...prev, [userId]: [...base, slug] };
        return prev;
      });
    } else {
      // editable
      setUserModules((prev) => {
        const cur = getOverride(prev);
        const base = cur !== null ? cur : activeList;
        if (!base.includes(slug)) return { ...prev, [userId]: [...base, slug] };
        return prev;
      });
      setUserReadonly((prev) => ({ ...prev, [userId]: (prev[userId] ?? []).filter((s) => s !== slug) }));
    }
  };

  // Cycles: hidden → editable → readonly → hidden
  const cycleModuleState = (userId, slug, currentState) => {
    const next = currentState === "editable" ? "readonly" : currentState === "readonly" ? "hidden" : "editable";
    setModuleState(userId, slug, next);
  };

  // Apply a state to every module in a group
  const setGroupState = (userId, slugs, targetState) => {
    slugs.forEach((slug) => setModuleState(userId, slug, targetState));
  };

  const saveAllPerms = (userId) => {
    const modules_override = userModules[userId] !== undefined ? userModules[userId] : null;
    const modules_readonly = userReadonly[userId] ?? [];
    setModulesMutation.mutate({ userId, modules_override });
    setPermsMutation.mutate({ userId, modules_readonly });
  };

  const initUser = (user) => {
    setUserModules((prev) => {
      if (prev[user.id] !== undefined) return prev;
      return { ...prev, [user.id]: user.modules_override ?? null };
    });
    setUserReadonly((prev) => {
      if (prev[user.id] !== undefined) return prev;
      return { ...prev, [user.id]: user.modules_readonly ?? [] };
    });
    setUserEdits((prev) => {
      if (prev[user.id] !== undefined) return prev;
      return { ...prev, [user.id]: { full_name: user.full_name || "", email: user.email || "", role: user.role, newPassword: "" } };
    });
  };

  if (users.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Esta empresa no tiene usuarios</p>;
  }

  return (
    <div className="space-y-3">
      {/* Search + summary */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, @usuario, email o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {filteredUsers.length} de {users.length} usuarios
        </span>
      </div>

      <div className="space-y-2">
      {filteredUsers.map((u) => {
        const isExpanded = expandedUserId === u.id;
        const currentOverride = userModules[u.id] !== undefined ? userModules[u.id] : u.modules_override;
        const hasRestriction = currentOverride !== null && currentOverride !== undefined;
        const currentReadonly = userReadonly[u.id] !== undefined ? userReadonly[u.id] : (u.modules_readonly ?? []);
        const hasReadonly = currentReadonly?.length > 0;
        const subTab = userSubTab[u.id] ?? "datos";

        return (
          <div key={u.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* User row */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                    {u.full_name?.charAt(0)?.toUpperCase() || u.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.is_active !== false ? "bg-green-400" : "bg-gray-300"}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {u.full_name || <span className="italic text-gray-400">Sin nombre</span>}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">#{u.id}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-blue-600 font-mono truncate">@{u.username}</p>
                    {u.email && u.email !== u.username && (
                      <p className="text-xs text-gray-400 truncate">· {u.email}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                  {u.role}
                </span>
                {hasRestriction && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <Eye size={10} /> {currentOverride?.length ?? 0} vis.
                  </span>
                )}
                {hasReadonly && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                    <Edit3 size={10} /> {currentReadonly.length} RO
                  </span>
                )}
                <button
                  onClick={() => {
                    if (!isExpanded) initUser(u);
                    setExpandedUserId(isExpanded ? null : u.id);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                >
                  <Layers size={12} />
                  Permisos
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <button
                  onClick={() => onImpersonate(u.id)}
                  disabled={impersonating}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                  title="Impersonar usuario"
                >
                  <ArrowLeftRight size={12} />
                  Impersonar
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 py-4 bg-white border-t border-gray-100">
                {/* Sub-tabs */}
                <div className="flex gap-2 mb-4 border-b border-gray-100 pb-3">
                  <button
                    onClick={() => setUserSubTab((p) => ({ ...p, [u.id]: "datos" }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      subTab === "datos" ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Edit3 size={12} /> Datos del usuario
                  </button>
                  <button
                    onClick={() => setUserSubTab((p) => ({ ...p, [u.id]: "permisos" }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      subTab === "permisos" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Layers size={12} /> Módulos y permisos
                  </button>
                </div>

                {/* ── Datos del usuario ── */}
                {subTab === "datos" && (() => {
                  const edits = userEdits[u.id] ?? { full_name: u.full_name || "", email: u.email || "", role: u.role, newPassword: "" };
                  const setEdit = (field, val) => setUserEdits((p) => ({ ...p, [u.id]: { ...(p[u.id] ?? edits), [field]: val } }));
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Nombre completo</label>
                          <input
                            value={edits.full_name}
                            onChange={(e) => setEdit("full_name", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Email</label>
                          <input
                            type="email"
                            value={edits.email}
                            onChange={(e) => setEdit("email", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Usuario</label>
                          <input value={u.username} disabled className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-400 font-mono" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Rol</label>
                          <select
                            value={edits.role}
                            onChange={(e) => setEdit("role", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300 bg-white"
                          >
                            {["ADMIN","COMPRAS","ADMINISTRACION","GESTION_PAGOS","LOCAL","VENDEDOR","DEPOSITO","SUPERVISOR","MONITOREO","TRANSPORTE"].map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Nueva contraseña <span className="text-gray-300">(opcional)</span></label>
                          <input
                            type="password"
                            value={edits.newPassword}
                            onChange={(e) => setEdit("newPassword", e.target.value)}
                            placeholder="Dejar vacío para no cambiar"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateUserMutation.mutate({ userId: u.id, data: { full_name: edits.full_name, email: edits.email, role: edits.role, new_password: edits.newPassword || undefined } })}
                          disabled={updateUserMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 transition disabled:opacity-50"
                        >
                          <Save size={13} />
                          {updateUserMutation.isPending ? "Guardando..." : "Guardar datos"}
                        </button>
                        {updateUserMutation.isSuccess && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle size={13} /> Guardado
                          </span>
                        )}
                        {updateUserMutation.isError && (
                          <span className="text-xs text-red-500">{updateUserMutation.error?.message || "Error al guardar"}</span>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* ── Módulos y permisos (vista unificada 3 estados) ── */}
                {subTab === "permisos" && (() => {
                  const overrideList = (userModules[u.id] !== undefined ? userModules[u.id] : u.modules_override) ?? null;
                  const roList = userReadonly[u.id] !== undefined ? userReadonly[u.id] : (u.modules_readonly ?? []);
                  const getState = (slug) => {
                    const visible = overrideList === null || overrideList.includes(slug);
                    if (!visible) return "hidden";
                    return roList.includes(slug) ? "readonly" : "editable";
                  };
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><XCircle size={11} className="text-gray-300" /> Oculto</span>
                          <span className="flex items-center gap-1"><Edit3 size={11} className="text-blue-500" /> Editable</span>
                          <span className="flex items-center gap-1"><Eye size={11} className="text-yellow-500" /> Solo lectura</span>
                          <span className="text-gray-300">— clic para ciclar</span>
                        </div>
                        <button
                          onClick={() => setUserModules((p) => ({ ...p, [u.id]: null }))}
                          className="text-xs text-gray-400 hover:text-gray-600 underline"
                        >
                          Sin restricción (todo activo)
                        </button>
                      </div>
                      <div className="space-y-3 mb-4">
                        {SIDEBAR_GROUPS.map((group) => {
                          // Mostrar TODOS los módulos del catálogo (no solo activos para la empresa)
                          // para que el MEGAADMIN pueda asignar permisos de cualquier módulo.
                          const groupMods = group.modules;
                          if (groupMods.length === 0) return null;
                          const allOn = groupMods.every((m) => getState(m.slug) !== "hidden");
                          const allOff = groupMods.every((m) => getState(m.slug) === "hidden");
                          return (
                            <div key={group.key} className={`rounded-lg border p-3 ${group.color}`}>
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                <span className="text-xs font-bold">{group.label}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setGroupState(u.id, groupMods.map((m) => m.slug), "editable")}
                                    className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition font-medium flex items-center gap-1"
                                    title="Activar todos con edición"
                                  >
                                    <Edit3 size={10} /> Todo edit
                                  </button>
                                  <button
                                    onClick={() => setGroupState(u.id, groupMods.map((m) => m.slug), "readonly")}
                                    className="text-[10px] px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition font-medium flex items-center gap-1"
                                    title="Activar todos en solo lectura"
                                  >
                                    <Eye size={10} /> Todo ver
                                  </button>
                                  <button
                                    onClick={() => setGroupState(u.id, groupMods.map((m) => m.slug), "hidden")}
                                    disabled={allOff}
                                    className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-30 transition font-medium flex items-center gap-1"
                                    title="Ocultar todos"
                                  >
                                    <XCircle size={10} /> Ocultar
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {groupMods.map((m) => {
                                  const state = getState(m.slug);
                                  return (
                                    <button
                                      key={m.slug}
                                      onClick={() => cycleModuleState(u.id, m.slug, state)}
                                      title="Clic para ciclar: Oculto → Editable → Solo lectura"
                                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition text-left ${
                                        state === "editable"
                                          ? "bg-blue-50 border-blue-300 text-blue-700"
                                          : state === "readonly"
                                          ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                                          : "bg-white/50 border-white/80 text-gray-400"
                                      }`}
                                    >
                                      {state === "editable" && <Edit3 size={12} className="shrink-0 text-blue-500" />}
                                      {state === "readonly" && <Eye size={12} className="shrink-0 text-yellow-500" />}
                                      {state === "hidden" && <XCircle size={12} className="shrink-0 text-gray-300" />}
                                      <span className="truncate">{m.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => saveAllPerms(u.id)}
                          disabled={setModulesMutation.isPending || setPermsMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          <Save size={13} />
                          {setModulesMutation.isPending || setPermsMutation.isPending ? "Guardando..." : "Guardar permisos"}
                        </button>
                        {(setModulesMutation.isSuccess || setPermsMutation.isSuccess) && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle size={13} /> Guardado
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          </div>
        );
      })}
      </div>
    </div>
  );
}

// ── Tab: Licencias PC ──
function TabLicencias({ companyId, locals }) {
  const queryClient = useQueryClient();
  const [newForm, setNewForm] = useState({ device_name: "", mac_address: "", local_id: "" });
  const [showForm, setShowForm] = useState(false);

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["mega-licenses", companyId],
    queryFn: () => api.get(`/mega/companies/${companyId}/pc-licenses`),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post(`/mega/companies/${companyId}/pc-licenses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mega-licenses", companyId] });
      setNewForm({ device_name: "", mac_address: "", local_id: "" });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/mega/pc-licenses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mega-licenses", companyId] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/mega/pc-licenses/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mega-licenses", companyId] }),
  });

  // Group by local
  const grouped = useMemo(() => {
    const map = {};
    for (const lic of licenses) {
      const key = lic.local_id ?? "sin-local";
      const label = lic.local_name || "Sin local asignado";
      if (!map[key]) map[key] = { label, items: [] };
      map[key].items.push(lic);
    }
    return Object.entries(map);
  }, [licenses]);

  if (isLoading) return <p className="text-sm text-gray-400 py-8 text-center">Cargando licencias...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{licenses.length} licencias registradas</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={13} /> Nueva licencia
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-gray-700">Registrar nueva PC</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Nombre del equipo"
              value={newForm.device_name}
              onChange={(e) => setNewForm((p) => ({ ...p, device_name: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="MAC address (opcional)"
              value={newForm.mac_address}
              onChange={(e) => setNewForm((p) => ({ ...p, mac_address: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newForm.local_id}
              onChange={(e) => setNewForm((p) => ({ ...p, local_id: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sin local</option>
              {locals.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate({ ...newForm, local_id: newForm.local_id || null })}
              disabled={createMutation.isPending || !newForm.device_name}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {createMutation.isPending ? "Guardando..." : "Registrar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {grouped.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No hay licencias registradas aún</p>
      )}

      {grouped.map(([key, group]) => (
        <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <MapPin size={14} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">{group.label}</span>
            <span className="ml-auto text-xs text-gray-400">{group.items.length} PC{group.items.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {group.items.map((lic) => {
              const isExpired = lic.expires_at && new Date(lic.expires_at) < new Date();
              const expDate = lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("es-AR") : "—";
              return (
                <div key={lic.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Monitor size={16} className={`shrink-0 ${lic.is_active ? "text-green-500" : "text-gray-300"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{lic.device_name}</p>
                      {lic.mac_address && (
                        <p className="text-xs text-gray-400 font-mono truncate">{lic.mac_address}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      !lic.is_active ? "bg-red-100 text-red-600" :
                      isExpired ? "bg-orange-100 text-orange-600" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {!lic.is_active ? "Inactiva" : isExpired ? `Vence ${expDate}` : `OK · ${expDate}`}
                    </span>
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: lic.id, is_active: !lic.is_active })}
                      disabled={toggleActiveMutation.isPending}
                      title={lic.is_active ? "Desactivar" : "Activar"}
                      className={`p-1.5 rounded-lg transition ${lic.is_active ? "hover:bg-red-50 text-red-400" : "hover:bg-green-50 text-green-500"}`}
                    >
                      {lic.is_active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar licencia de ${lic.device_name}?`)) deleteMutation.mutate(lic.id);
                      }}
                      disabled={deleteMutation.isPending}
                      title="Eliminar licencia"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Save button ──
function SaveButton({ onClick, saving, success }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onClick}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
      >
        <Save size={15} />
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
      {success && (
        <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
          <CheckCircle size={14} /> Guardado
        </span>
      )}
    </div>
  );
}

// ── Plans Section ──
const TIER_CONFIG = {
  FREE: { icon: Star, color: "gray", gradient: "from-gray-50 to-gray-100", border: "border-gray-200" },
  STARTER: { icon: Zap, color: "blue", gradient: "from-blue-50 to-blue-100", border: "border-blue-200" },
  PRO: { icon: Crown, color: "purple", gradient: "from-purple-50 to-purple-100", border: "border-purple-200" },
  ENTERPRISE: { icon: Gem, color: "amber", gradient: "from-amber-50 to-amber-100", border: "border-amber-200" },
};

function PlansSection({ plans, onEdit, onCreate }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Crown size={20} className="text-amber-500" /> Planes de la Plataforma
          </h2>
          <p className="text-xs text-gray-500 mt-1">Gestionar planes y límites para las empresas</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
        >
          <Plus size={14} /> Nuevo Plan
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const cfg = TIER_CONFIG[plan.tier] || TIER_CONFIG.STARTER;
          const TierIcon = cfg.icon;
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border-2 ${cfg.border} bg-gradient-to-br ${cfg.gradient} p-5 transition hover:shadow-md`}
            >
              {plan.is_default && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                  DEFAULT
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <TierIcon size={20} className={`text-${cfg.color}-500`} />
                <h3 className="font-bold text-gray-900">{plan.name}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {plan.price_monthly === 0 ? "Gratis" : `$${plan.price_monthly.toLocaleString("es-AR")}`}
                {plan.price_monthly > 0 && <span className="text-xs font-normal text-gray-400">/mes</span>}
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Usuarios</span>
                  <span className="font-semibold">{plan.max_users >= 999 ? "∞" : plan.max_users}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Locales</span>
                  <span className="font-semibold">{plan.max_locals >= 99 ? "∞" : plan.max_locals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Productos</span>
                  <span className="font-semibold">{plan.max_products >= 999999 ? "∞" : plan.max_products.toLocaleString("es-AR")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Módulos</span>
                  <span className="font-semibold">{plan.max_modules >= 13 ? "Todos" : plan.max_modules}</span>
                </div>
              </div>
              <button
                onClick={() => onEdit(plan)}
                className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white/80 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-white transition"
              >
                <Edit2 size={12} /> Editar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Edit Plan Modal ──
function EditPlanModal({ form, setForm, isNew, onClose, onSave, saving }) {
  const fields = [
    { key: "name", label: "Nombre", type: "text" },
    { key: "description", label: "Descripción", type: "text" },
    { key: "max_users", label: "Máx. Usuarios", type: "number" },
    { key: "max_locals", label: "Máx. Locales", type: "number" },
    { key: "max_products", label: "Máx. Productos", type: "number" },
    { key: "max_modules", label: "Máx. Módulos", type: "number" },
    { key: "price_monthly", label: "Precio Mensual", type: "number" },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{isNew ? "Nuevo Plan" : "Editar Plan"}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
            <select
              value={form.tier}
              onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={form[f.key] ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default || false}
              onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Plan por defecto
          </label>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Plan (company subscription) ──
const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  EXPIRED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

function TabPlan({ plans, subscription, companyId, subscribeForm, setSubscribeForm, onSubscribe, saving, success }) {
  return (
    <div className="space-y-5">
      {/* Current subscription */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Suscripción Actual</h3>
        {subscription ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown size={20} className="text-amber-500" />
                <div>
                  <p className="font-semibold text-gray-900">{subscription.plan?.name || `Plan #${subscription.plan_id}`}</p>
                  <p className="text-xs text-gray-500">{subscription.plan?.tier}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[subscription.status] || "bg-gray-100 text-gray-600"}`}>
                {subscription.status}
              </span>
            </div>
            {subscription.plan && (
              <div className="grid grid-cols-4 gap-3 mt-3 text-xs text-gray-600">
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <div className="font-bold text-gray-900">{subscription.plan.max_users >= 999 ? "∞" : subscription.plan.max_users}</div>
                  <div>Usuarios</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <div className="font-bold text-gray-900">{subscription.plan.max_locals >= 99 ? "∞" : subscription.plan.max_locals}</div>
                  <div>Locales</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <div className="font-bold text-gray-900">{subscription.plan.max_products >= 999999 ? "∞" : subscription.plan.max_products.toLocaleString("es-AR")}</div>
                  <div>Productos</div>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <div className="font-bold text-gray-900">{subscription.plan.max_modules >= 13 ? "Todos" : subscription.plan.max_modules}</div>
                  <div>Módulos</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              {subscription.started_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Desde: {new Date(subscription.started_at).toLocaleDateString("es-AR")}
                </span>
              )}
              {subscription.expires_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Vence: {new Date(subscription.expires_at).toLocaleDateString("es-AR")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-400">
            Sin suscripción activa
          </div>
        )}
      </div>

      {/* Assign / Change plan */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Asignar / Cambiar Plan</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
            <select
              value={subscribeForm.plan_id}
              onChange={(e) => setSubscribeForm((p) => ({ ...p, plan_id: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tier}) — ${p.price_monthly.toLocaleString("es-AR")}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select
                value={subscribeForm.status}
                onChange={(e) => setSubscribeForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Activo</option>
                <option value="TRIAL">Trial</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vencimiento (opcional)</label>
              <input
                type="date"
                value={subscribeForm.expires_at}
                onChange={(e) => setSubscribeForm((p) => ({ ...p, expires_at: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <input
              type="text"
              value={subscribeForm.notes}
              onChange={(e) => setSubscribeForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas opcionales..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!subscribeForm.plan_id) return;
                const payload = {
                  company_id: companyId,
                  plan_id: subscribeForm.plan_id,
                  status: subscribeForm.status,
                  notes: subscribeForm.notes || null,
                  expires_at: subscribeForm.expires_at ? new Date(subscribeForm.expires_at).toISOString() : null,
                };
                onSubscribe(payload);
              }}
              disabled={saving || !subscribeForm.plan_id}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              <CreditCard size={15} /> {saving ? "Asignando..." : "Asignar Plan"}
            </button>
            {success && (
              <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <CheckCircle size={14} /> Asignado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick Setup Modal ──
const INDUSTRY_OPTIONS = [
  { value: "INDUMENTARIA", label: "Indumentaria" },
  { value: "KIOSCO", label: "Kiosco" },
  { value: "MECANICO", label: "Mecánico" },
  { value: "DEPOSITO", label: "Depósito" },
  { value: "RESTAURANTE", label: "Restaurante" },
  { value: "FERRETERIA", label: "Ferretería" },
  { value: "FARMACIA", label: "Farmacia" },
  { value: "LIBRERIA", label: "Librería" },
  { value: "OTRO", label: "Otro" },
];

function QuickSetupModal({ form, setForm, result, onClose, onSubmit, saving, error }) {
  const f = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Rocket size={20} className="text-emerald-500" /> Setup Rápido
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-800 text-lg">¡Empresa creada!</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ID:</span><span className="font-semibold">{result.company_id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Empresa:</span><span className="font-semibold">{result.company_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Admin:</span><span className="font-mono text-blue-600">{result.admin_username}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Plan:</span><span className="font-semibold">{result.plan_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Estado:</span><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{result.subscription_status}</span></div>
              {result.expires_at && <div className="flex justify-between"><span className="text-gray-500">Vence:</span><span>{new Date(result.expires_at).toLocaleDateString("es-AR")}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Login:</span><span className="font-mono text-xs">{result.login_url}</span></div>
              <div><span className="text-gray-500">Módulos:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.modules_enabled.map((m) => (
                    <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{m}</span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-2">Crea una empresa con admin, módulos y plan en un solo paso.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de empresa *</label>
                <input type="text" value={form.company_name} onChange={(e) => f("company_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mi Empresa S.A." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CUIT</label>
                <input type="text" value={form.cuit} onChange={(e) => f("cuit", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="20-12345678-9" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Industria</label>
                <select value={form.industry_type} onChange={(e) => f("industry_type", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {INDUSTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <hr className="border-gray-100" />
            <p className="text-xs font-semibold text-gray-700">Usuario Administrador</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                <input type="text" value={form.admin_full_name} onChange={(e) => f("admin_full_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                <input type="text" value={form.admin_username} onChange={(e) => f("admin_username", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jperez" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label>
                <input type="password" value={form.admin_password} onChange={(e) => f("admin_password", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.admin_email} onChange={(e) => f("admin_email", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@empresa.com" />
              </div>
            </div>

            <hr className="border-gray-100" />
            <p className="text-xs font-semibold text-gray-700">Plan y Trial</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                <select value={form.plan_tier} onChange={(e) => f("plan_tier", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="FREE">Free</option>
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Días de trial</label>
                <input type="number" value={form.trial_days} onChange={(e) => f("trial_days", Number(e.target.value))}
                  min={0} max={365}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onSubmit}
                disabled={saving || !form.company_name || !form.admin_username || !form.admin_password || !form.admin_full_name}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                <Rocket size={15} /> {saving ? "Creando..." : "Crear Empresa"}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Health Modal ──
function HealthModal({ data, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <HeartPulse size={20} className={data.healthy ? "text-green-500" : "text-amber-500"} />
            Diagnóstico: {data.company_name}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className={`rounded-xl p-4 mb-4 text-center ${data.healthy ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
          {data.healthy ? (
            <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
              <CheckCircle size={20} /> Todo en orden
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-amber-700 font-semibold">
              <AlertTriangle size={20} /> Se encontraron problemas
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Estado</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${data.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {data.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Usuarios activos</span>
            <span className="font-semibold">{data.users_count}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Módulos activos</span>
            <span className="font-semibold">{data.modules_count}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Tiene admin</span>
            <span>{data.has_admin ? <CheckCircle size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Plan</span>
            <span className="font-semibold">{data.plan_name || "—"}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Suscripción</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[data.subscription_status] || "bg-gray-100 text-gray-600"}`}>
              {data.subscription_status || "Sin plan"}
            </span>
          </div>
        </div>

        {data.issues?.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">Problemas detectados:</p>
            {data.issues.map((issue, i) => (
              <div key={i} className="text-sm bg-amber-50 text-amber-800 px-3 py-2 rounded-lg border border-amber-200">
                {issue}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
          Cerrar
        </button>
      </div>
    </div>
  );
}
