import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  ShoppingCart, CreditCard, Warehouse, FileText, Truck, Kanban,
  BarChart3, UserCheck, ShoppingBag, Store, Users, Activity,
  CheckCircle, ToggleLeft, ToggleRight, Package, Star, Lightbulb,
  FileBarChart, TrendingUp, Wrench, RefreshCw,
} from "lucide-react";

const ICON_MAP = {
  ShoppingCart, CreditCard, Warehouse, FileText, Truck, Kanban,
  BarChart3, UserCheck, ShoppingBag, Store, Users, Activity,
  CheckCircle, Package, Star, Lightbulb, FileBarChart, TrendingUp,
  Wrench, RefreshCw,
};

const CLIENTE_TYPES = [
  { id: "all",       label: "Activar todos" },
  { id: "tienda",    label: "Tienda / Indumentaria" },
  { id: "kiosco",    label: "Kiosco" },
  { id: "mecanico",  label: "Mecánico / Taller" },
  { id: "deposito",  label: "Solo Depósito" },
];

// Módulos predeterminados por tipo de cliente
const PRESETS = {
  tienda:   ["COMPRAS","PAGOS","STOCK","VENTAS","TRANSPORTE","REPORTES","CATALOGO","LOCALES","USUARIOS","COMPLETADOS"],
  kiosco:   ["STOCK","VENTAS","REPORTES","USUARIOS"],
  mecanico: ["STOCK","VENTAS","REMITOS","REPORTES","USUARIOS"],
  deposito: ["STOCK","COMPRAS","TRANSPORTE","COMPLETADOS","USUARIOS"],
};

export default function ConfigModulosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [applying, setApplying] = useState(null);

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["modules"],
    queryFn:  () => api.get("/modules"),
  });

  const mutToggle = useMutation({
    mutationFn: ({ slug, is_active }) => api.patch(`/modules/${slug}`, { is_active }),
    onSuccess:  () => qc.invalidateQueries(["modules"]),
  });

  const handlePreset = async (presetId) => {
    if (presetId === "all") {
      setApplying("all");
      for (const mod of modules) {
        await api.patch(`/modules/${mod.slug}`, { is_active: true });
      }
      qc.invalidateQueries(["modules"]);
      setApplying(null);
      return;
    }
    const preset = PRESETS[presetId];
    if (!preset) return;
    setApplying(presetId);
    for (const mod of modules) {
      await api.patch(`/modules/${mod.slug}`, { is_active: preset.includes(mod.slug) });
    }
    qc.invalidateQueries(["modules"]);
    setApplying(null);
  };

  const active   = modules.filter(m => m.is_active).length;
  const inactive = modules.filter(m => !m.is_active).length;

  if (!["SUPERADMIN","ADMIN"].includes(user?.role)) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Solo administradores pueden configurar módulos.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de Módulos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Activá solo los módulos que necesita este negocio.
          <span className="ml-2 text-green-600 font-medium">{active} activos</span>
          {inactive > 0 && <span className="ml-1 text-gray-400">· {inactive} inactivos</span>}
        </p>
      </div>

      {/* Presets por tipo de negocio */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-3">⚡ Configuración rápida por tipo de negocio</p>
        <div className="flex flex-wrap gap-2">
          {CLIENTE_TYPES.map(ct => (
            <button
              key={ct.id}
              onClick={() => handlePreset(ct.id)}
              disabled={!!applying}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
            >
              {applying === ct.id ? "Aplicando..." : ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de módulos */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modules.map(mod => {
            const Icon = ICON_MAP[mod.icono] ?? Package;
            return (
              <div
                key={mod.slug}
                className={`bg-white rounded-xl border p-4 flex items-start justify-between gap-3 transition ${
                  mod.is_active ? "border-gray-200" : "border-gray-100 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: mod.color + "20" }}
                  >
                    <Icon size={20} style={{ color: mod.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{mod.custom_name || mod.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{mod.descripcion}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mod.rutas.map(r => (
                        <span key={r} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => mutToggle.mutate({ slug: mod.slug, is_active: !mod.is_active })}
                  disabled={mutToggle.isPending}
                  className="shrink-0 mt-0.5"
                  title={mod.is_active ? "Desactivar" : "Activar"}
                >
                  {mod.is_active
                    ? <ToggleRight size={32} style={{ color: mod.color }} />
                    : <ToggleLeft  size={32} className="text-gray-300" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        Los cambios se aplican de inmediato. El menú lateral se actualiza al recargar la página.
      </p>
    </div>
  );
}
