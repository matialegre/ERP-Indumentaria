import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Building2,
  Palette,
  Blocks,
  UserCog,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  Package,
  ShoppingCart,
  ShoppingBag,
  FileText,
  PackageCheck,
  ClipboardList,
  Truck,
  UserCheck,
  BarChart3,
  Settings,
  Activity,
  Wallet,
  Search,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Shirt,
  Store,
  Wrench,
  Warehouse,
  UtensilsCrossed,
  Hammer,
  Pill,
  BookOpen,
  LayoutGrid,
  Sparkles,
  Info,
} from "lucide-react";

// Map icon name strings from API to actual lucide components
const ICON_MAP = {
  Package, ShoppingCart, ShoppingBag, FileText, PackageCheck,
  ClipboardList, Truck, UserCheck, BarChart3, Settings, Activity,
  Wallet, Search, Shirt, Store, Wrench, Warehouse, UtensilsCrossed,
  Hammer, Pill, BookOpen, LayoutGrid,
};

// Resolve a lucide icon name string to a component
function resolveIcon(name) {
  return ICON_MAP[name] || Package;
}

// Fallback modules/industries while API loads
const FALLBACK_MODULES = [
  { slug: "stock", name: "Control de Stock", description: "Inventario y movimientos", icon: "Package" },
  { slug: "ventas", name: "Ventas", description: "Punto de venta y facturación rápida", icon: "ShoppingCart" },
  { slug: "compras", name: "Compras", description: "Órdenes de compra", icon: "ShoppingBag" },
  { slug: "facturacion", name: "Facturación", description: "Comprobantes y facturas", icon: "FileText" },
  { slug: "ingresos", name: "Ingresos", description: "Remitos y recepción de mercadería", icon: "PackageCheck" },
  { slug: "pedidos", name: "Pedidos", description: "Notas de pedido a proveedores", icon: "ClipboardList" },
  { slug: "proveedores", name: "Proveedores", description: "Gestión de proveedores", icon: "Truck" },
  { slug: "clientes", name: "Clientes", description: "Base de clientes", icon: "UserCheck" },
  { slug: "reportes", name: "Reportes", description: "Reportes y estadísticas", icon: "BarChart3" },
  { slug: "configuracion", name: "Configuración", description: "Ajustes del sistema", icon: "Settings" },
  { slug: "monitoreo", name: "Monitoreo", description: "Estado del sistema", icon: "Activity" },
  { slug: "gestion-pagos", name: "Gestión de Pagos", description: "Control de pagos y cuentas", icon: "Wallet" },
  { slug: "consultas", name: "Consultas ERP", description: "Búsqueda de precios y stock", icon: "Search" },
];

const DEFAULT_MODULES = ["stock", "ventas", "facturacion", "reportes", "configuracion"];

const STEPS = [
  { label: "Datos", Icon: Building2 },
  { label: "Branding", Icon: Palette },
  { label: "Módulos", Icon: Blocks },
  { label: "Admin", Icon: UserCog },
];

function getInitials(name) {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 3);
}

function slugifyUsername(name) {
  return "admin_" + name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
}

// ── Step Indicator ──
function StepIndicator({ current, completed }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = completed.includes(i);
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className={`w-10 sm:w-16 h-0.5 ${done || active ? "bg-blue-400" : "bg-gray-200"}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-gray-200 text-gray-500"}`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${active ? "text-blue-700" : done ? "text-green-700" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Datos de la Empresa ──
function StepDatos({ form, setForm, errors, industries }) {
  const selectedTemplate = industries.find((t) => t.industry_type === form.industry_type);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Datos de la Empresa</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la empresa <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.name ? "border-red-400" : "border-gray-300"}`}
          placeholder="Ej: Kiosco Pepito"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
        <input
          type="text"
          value={form.cuit}
          onChange={(e) => setForm({ ...form, cuit: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="30-12345678-9"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de industria <span className="text-red-500">*</span>
        </label>
        <select
          value={form.industry_type}
          onChange={(e) => setForm({ ...form, industry_type: e.target.value })}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.industry_type ? "border-red-400" : "border-gray-300"}`}
        >
          <option value="">Seleccionar...</option>
          {industries.map((t) => (
            <option key={t.industry_type} value={t.industry_type}>{t.label}</option>
          ))}
        </select>
        {errors.industry_type && <p className="text-xs text-red-500 mt-1">{errors.industry_type}</p>}
      </div>

      {/* Industry template preview card */}
      {selectedTemplate && (
        <div
          className="rounded-xl border-2 p-4 transition-all animate-in fade-in"
          style={{ borderColor: selectedTemplate.suggested_color + "60", backgroundColor: selectedTemplate.suggested_color + "08" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: selectedTemplate.suggested_color }}
            >
              {(() => { const Icon = resolveIcon(selectedTemplate.icon); return <Icon className="w-5 h-5" />; })()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{selectedTemplate.label}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                  style={{ backgroundColor: selectedTemplate.suggested_color }}
                >
                  {selectedTemplate.modules.length} módulos
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{selectedTemplate.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTemplate.features.map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" style={{ color: selectedTemplate.suggested_color }} />
                    {f}
                  </span>
                ))}
              </div>
              {selectedTemplate.sample_categories.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <Info className="w-3 h-3" />
                  Categorías sugeridas: {selectedTemplate.sample_categories.join(", ")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Branding ──
function StepBranding({ form, setForm }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Branding</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre en la app</label>
          <input
            type="text"
            value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre corto (2-3 chars)</label>
          <input
            type="text"
            maxLength={3}
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value.toUpperCase() })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color primario</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300"
            />
            <input
              type="text"
              value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color secundario</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.secondary_color}
              onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300"
            />
            <input
              type="text"
              value={form.secondary_color}
              onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</label>
        <textarea
          value={form.welcome_message}
          onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          placeholder="Ej: Bienvenido a Kiosco Pepito"
        />
      </div>

      {/* Live preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Vista previa del login</label>
        <div
          className="rounded-xl p-6 text-center shadow-inner border"
          style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}
        >
          <div className="w-14 h-14 rounded-xl mx-auto mb-3 bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg">
            {form.short_name || "??"}
          </div>
          <h3 className="text-white font-bold text-lg drop-shadow">{form.app_name || "App ERP"}</h3>
          <p className="text-white/80 text-sm mt-1 drop-shadow">{form.welcome_message || "Bienvenido"}</p>
          <div className="mt-4 max-w-xs mx-auto space-y-2">
            <div className="bg-white/20 backdrop-blur rounded-lg h-9" />
            <div className="bg-white/20 backdrop-blur rounded-lg h-9" />
            <div className="bg-white/30 backdrop-blur rounded-lg h-9 flex items-center justify-center text-white text-sm font-medium">
              Iniciar sesión
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Módulos ──
function StepModulos({ selectedModules, setSelectedModules, modules }) {
  const toggle = (slug) => {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Módulos</h2>
        <span className="text-xs text-gray-500">{selectedModules.length} seleccionados</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((m) => {
          const active = selectedModules.includes(m.slug);
          const Icon = resolveIcon(m.icon);
          return (
            <button
              key={m.slug}
              type="button"
              onClick={() => toggle(m.slug)}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all
                ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${active ? "text-blue-800" : "text-gray-700"}`}>{m.name}</span>
                  {active && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Admin ──
function StepAdmin({ form, setForm, errors }) {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passChecks = useMemo(() => {
    const p = form.admin_password;
    return {
      length: p.length >= 8,
      upper: /[A-Z]/.test(p),
      number: /\d/.test(p),
    };
  }, [form.admin_password]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Administrador de la empresa</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre completo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.admin_full_name}
          onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.admin_full_name ? "border-red-400" : "border-gray-300"}`}
          placeholder="Ej: Juan Pérez"
        />
        {errors.admin_full_name && <p className="text-xs text-red-500 mt-1">{errors.admin_full_name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Usuario <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.admin_username}
          onChange={(e) => setForm({ ...form, admin_username: e.target.value })}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.admin_username ? "border-red-400" : "border-gray-300"}`}
        />
        {errors.admin_username && <p className="text-xs text-red-500 mt-1">{errors.admin_username}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={form.admin_password}
            onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
            className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.admin_password ? "border-red-400" : "border-gray-300"}`}
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.admin_password && <p className="text-xs text-red-500 mt-1">{errors.admin_password}</p>}
        {form.admin_password && (
          <div className="flex gap-3 mt-2 text-xs">
            <span className={passChecks.length ? "text-green-600" : "text-gray-400"}>✓ 8+ caracteres</span>
            <span className={passChecks.upper ? "text-green-600" : "text-gray-400"}>✓ Mayúscula</span>
            <span className={passChecks.number ? "text-green-600" : "text-gray-400"}>✓ Número</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirmar contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${errors.confirm_password ? "border-red-400" : "border-gray-300"}`}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password}</p>}
      </div>
    </div>
  );
}

// ── Success Screen ──
function SuccessScreen({ companyName, adminUsername, onReset, onGoBack }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-bounce">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Empresa creada exitosamente!</h2>
      <p className="text-gray-500 mb-1">
        <span className="font-medium text-gray-800">{companyName}</span> ya está lista.
      </p>
      <p className="text-gray-500 mb-8">
        Usuario admin: <span className="font-mono font-medium text-gray-800">{adminUsername}</span>
      </p>
      <div className="flex gap-3">
        <button
          onClick={onGoBack}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Ir al panel
        </button>
        <button
          onClick={onReset}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Crear otra empresa
        </button>
      </div>
    </div>
  );
}

// ── Initial form state ──
function initialState() {
  return {
    name: "",
    cuit: "",
    address: "",
    phone: "",
    email: "",
    industry_type: "",
    app_name: "",
    short_name: "",
    primary_color: "#1e40af",
    secondary_color: "#3b82f6",
    welcome_message: "",
    admin_full_name: "",
    admin_username: "",
    admin_password: "",
    confirm_password: "",
  };
}

// ── Main Wizard ──
export default function CompanyWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialState());
  const [selectedModules, setSelectedModules] = useState([...DEFAULT_MODULES]);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(null);

  // Fetch templates from API
  const { data: industries = [] } = useQuery({
    queryKey: ["templates", "industries"],
    queryFn: () => api.get("/templates/industries"),
    staleTime: 5 * 60 * 1000,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  const { data: modulesFromApi = [] } = useQuery({
    queryKey: ["templates", "modules"],
    queryFn: () => api.get("/templates/modules"),
    staleTime: 5 * 60 * 1000,
    select: (data) => (Array.isArray(data) ? data : []),
  });

  // Use API modules or fallback
  const modules = modulesFromApi.length > 0 ? modulesFromApi : FALLBACK_MODULES;

  // Build industry lookup for quick access
  const industryMap = useMemo(() => {
    const map = {};
    industries.forEach((t) => { map[t.industry_type] = t; });
    return map;
  }, [industries]);

  // Auto-fill branding defaults when company name changes
  const setFormWithDefaults = (newForm) => {
    const nameChanged = newForm.name !== form.name;
    if (nameChanged && newForm.name) {
      if (!form.app_name || form.app_name === (form.name ? form.name + " ERP" : "")) {
        newForm.app_name = newForm.name + " ERP";
      }
      if (!form.short_name || form.short_name === getInitials(form.name)) {
        newForm.short_name = getInitials(newForm.name);
      }
      if (!form.admin_username || form.admin_username === slugifyUsername(form.name)) {
        newForm.admin_username = slugifyUsername(newForm.name);
      }
      if (!form.welcome_message || form.welcome_message === `Bienvenido a ${form.name}`) {
        newForm.welcome_message = `Bienvenido a ${newForm.name}`;
      }
    }
    setForm(newForm);
  };

  // Auto-select modules + color when industry changes
  const setFormWithIndustry = (newForm) => {
    if (newForm.industry_type !== form.industry_type && newForm.industry_type) {
      const template = industryMap[newForm.industry_type];
      if (template) {
        setSelectedModules([...template.modules]);
        // Apply suggested color if user hasn't customized it
        const isDefaultColor = form.primary_color === "#1e40af" || form.primary_color === (industryMap[form.industry_type]?.suggested_color || "");
        if (isDefaultColor) {
          newForm.primary_color = template.suggested_color;
        }
      } else {
        setSelectedModules([...DEFAULT_MODULES]);
      }
    }
    setFormWithDefaults(newForm);
  };

  // Wrap setForm for step 1 to handle auto-fills
  const handleStep1SetForm = (newForm) => {
    if (newForm.industry_type !== form.industry_type) {
      setFormWithIndustry(newForm);
    } else {
      setFormWithDefaults(newForm);
    }
  };

  // Validation per step
  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim()) e.name = "El nombre es obligatorio";
      if (!form.industry_type) e.industry_type = "Seleccioná un tipo de industria";
    }
    if (s === 3) {
      if (!form.admin_full_name.trim()) e.admin_full_name = "El nombre es obligatorio";
      if (!form.admin_username.trim()) e.admin_username = "El usuario es obligatorio";
      if (!form.admin_password) e.admin_password = "La contraseña es obligatoria";
      else if (form.admin_password.length < 8) e.admin_password = "Mínimo 8 caracteres";
      if (!form.confirm_password) e.confirm_password = "Confirmá la contraseña";
      else if (form.admin_password !== form.confirm_password) e.confirm_password = "Las contraseñas no coinciden";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const completedSteps = useMemo(() => {
    const c = [];
    if (form.name.trim() && form.industry_type) c.push(0);
    if (form.app_name) c.push(1);
    if (selectedModules.length > 0) c.push(2);
    if (form.admin_full_name && form.admin_username && form.admin_password && form.admin_password === form.confirm_password && form.admin_password.length >= 8)
      c.push(3);
    return c;
  }, [form, selectedModules]);

  const goNext = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, 3));
    setApiError("");
  };

  const goPrev = () => {
    setStep((s) => Math.max(s - 1, 0));
    setApiError("");
  };

  // API mutation
  const mutation = useMutation({
    mutationFn: (payload) => api.post("/mega/companies/create-full", payload),
    onSuccess: (data) => {
      setSuccess({ companyName: form.name, adminUsername: form.admin_username });
    },
    onError: (err) => {
      setApiError(err.message || "Error al crear la empresa");
    },
  });

  const handleSubmit = () => {
    if (!validate(3)) return;
    setApiError("");
    const payload = {
      name: form.name.trim(),
      cuit: form.cuit.trim() || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      app_name: form.app_name.trim() || undefined,
      short_name: form.short_name.trim() || undefined,
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      welcome_message: form.welcome_message.trim() || undefined,
      industry_type: form.industry_type,
      module_slugs: selectedModules,
      admin_username: form.admin_username.trim(),
      admin_password: form.admin_password,
      admin_full_name: form.admin_full_name.trim(),
    };
    // Remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    mutation.mutate(payload);
  };

  const resetWizard = () => {
    setForm(initialState());
    setSelectedModules([...DEFAULT_MODULES]);
    setStep(0);
    setErrors({});
    setApiError("");
    setSuccess(null);
    mutation.reset();
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto">
        <SuccessScreen
          companyName={success.companyName}
          adminUsername={success.adminUsername}
          onReset={resetWizard}
          onGoBack={() => navigate("/mega-admin")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/mega-admin")} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Empresa</h1>
          <p className="text-sm text-gray-500">Completá los datos para crear una empresa y su admin</p>
        </div>
      </div>

      <StepIndicator current={step} completed={completedSteps} />

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        {step === 0 && <StepDatos form={form} setForm={handleStep1SetForm} errors={errors} industries={industries} />}
        {step === 1 && <StepBranding form={form} setForm={setForm} />}
        {step === 2 && <StepModulos selectedModules={selectedModules} setSelectedModules={setSelectedModules} modules={modules} />}
        {step === 3 && <StepAdmin form={form} setForm={setForm} errors={errors} />}
      </div>

      {/* API error */}
      {apiError && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {apiError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/mega-admin")}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cancelar
        </button>

        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={step === 0}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {step < 3 ? (
            <button
              onClick={goNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-60 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Crear Empresa
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
