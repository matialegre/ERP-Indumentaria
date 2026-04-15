import { useState, useMemo } from "react";
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
} from "lucide-react";

const ALL_MODULES = [
  { slug: "COMPRAS",              label: "Compras" },
  { slug: "PAGOS",                label: "Gestión de Pagos" },
  { slug: "STOCK",                label: "Control de Stock" },
  { slug: "VENTAS",               label: "Facturación & Ventas" },
  { slug: "TRANSPORTE",           label: "Logística & Transporte" },
  { slug: "KANBAN",               label: "TrellOutdoor" },
  { slug: "REPORTES",             label: "Reportes & Analytics" },
  { slug: "SOCIOS",               label: "Socios Montagne" },
  { slug: "CATALOGO",             label: "Catálogo & Proveedores" },
  { slug: "LOCALES",              label: "Locales & Sucursales" },
  { slug: "USUARIOS",             label: "Usuarios" },
  { slug: "MONITOREO",            label: "Monitoreo del Sistema" },
  { slug: "SUPERTREND",           label: "SuperTrend" },
  { slug: "OT",                   label: "Órdenes de Trabajo" },
  { slug: "SYNC",                 label: "Sincronización Offline" },
  { slug: "CRM",                  label: "CRM / Clientes" },
  { slug: "COMPLETADOS",          label: "Completados" },
  { slug: "PUNTUACION_EMPLEADOS", label: "Puntuación de Empleados" },
  { slug: "MEJORAS",              label: "Mejoras del ERP" },
  { slug: "INFORMES",             label: "Informes y Estadísticas" },
];

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
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Seleccioná los módulos activos para esta empresa ({selected.length} de {ALL_MODULES.length})
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ALL_MODULES.map((m) => {
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
              {active ? <CheckCircle size={16} /> : <XCircle size={16} className="text-gray-300" />}
              {m.label}
            </button>
          );
        })}
      </div>
      <SaveButton onClick={onSave} saving={saving} success={success} />
    </div>
  );
}

// ── Tab: Users ──
function TabUsers({ users, companyModules, onImpersonate, impersonating, queryClient, selectedCompanyId }) {
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userModules, setUserModules] = useState({});

  // Build set of active company modules for display
  const activeCompanySlugs = new Set(
    companyModules.filter((m) => m.is_active).map((m) => m.module_slug)
  );

  const setModulesMutation = useMutation({
    mutationFn: ({ userId, modules_override }) =>
      api.patch(`/mega/users/${userId}/modules`, { modules_override }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mega-company", selectedCompanyId] });
    },
  });

  const toggleUserModule = (userId, slug) => {
    setUserModules((prev) => {
      const current = prev[userId] ?? null;
      // If null = sin restricción, expandir a todos los activos de la empresa
      const base = current ?? [...activeCompanySlugs];
      const set = new Set(base);
      if (set.has(slug)) set.delete(slug);
      else set.add(slug);
      return { ...prev, [userId]: [...set] };
    });
  };

  const initUserModules = (user) => {
    setUserModules((prev) => {
      if (prev[user.id] !== undefined) return prev;
      // Use existing override, or null (unrestricted)
      return { ...prev, [user.id]: user.modules_override ?? null };
    });
  };

  const saveUserModules = (userId) => {
    const override = userModules[userId] ?? null;
    setModulesMutation.mutate({ userId, modules_override: override });
  };

  const resetUserModules = (userId) => {
    setUserModules((prev) => ({ ...prev, [userId]: null }));
  };

  if (users.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Esta empresa no tiene usuarios</p>;
  }

  return (
    <div className="space-y-2">
      {users.map((u) => {
        const isExpanded = expandedUserId === u.id;
        const currentOverride = userModules[u.id] !== undefined ? userModules[u.id] : u.modules_override;
        const hasRestriction = currentOverride !== null && currentOverride !== undefined;

        return (
          <div key={u.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* User row */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs shrink-0">
                  {u.full_name?.charAt(0)?.toUpperCase() || u.username?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.full_name || u.username}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email || u.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>
                  {u.role}
                </span>
                {hasRestriction && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    {currentOverride?.length ?? 0} módulos
                  </span>
                )}
                <button
                  onClick={() => {
                    if (!isExpanded) initUserModules(u);
                    setExpandedUserId(isExpanded ? null : u.id);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                  title="Configurar módulos"
                >
                  <Layers size={12} />
                  Módulos
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

            {/* Expanded: module config */}
            {isExpanded && (
              <div className="px-4 py-4 bg-white border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Módulos visibles para {u.full_name || u.username}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {!hasRestriction
                        ? "Sin restricción — ve todos los módulos activos de la empresa"
                        : `Restricción activa — solo ve ${currentOverride?.length ?? 0} módulo(s)`}
                    </p>
                  </div>
                  <button
                    onClick={() => resetUserModules(u.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Sin restricción
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {ALL_MODULES.filter((m) => activeCompanySlugs.has(m.slug)).map((m) => {
                    const overrideList = currentOverride ?? [...activeCompanySlugs];
                    const checked = overrideList.includes(m.slug);
                    return (
                      <button
                        key={m.slug}
                        onClick={() => {
                          // Init to full list if currently unrestricted
                          if (userModules[u.id] === null || userModules[u.id] === undefined) {
                            setUserModules((prev) => ({ ...prev, [u.id]: [...activeCompanySlugs] }));
                          }
                          toggleUserModule(u.id, m.slug);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition text-left ${
                          checked
                            ? "bg-blue-50 border-blue-300 text-blue-700"
                            : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        {checked
                          ? <CheckCircle size={13} className="shrink-0" />
                          : <XCircle size={13} className="shrink-0 text-gray-300" />}
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => saveUserModules(u.id)}
                    disabled={setModulesMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save size={13} />
                    {setModulesMutation.isPending ? "Guardando..." : "Guardar módulos"}
                  </button>
                  {setModulesMutation.isSuccess && (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle size={13} /> Guardado
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
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
