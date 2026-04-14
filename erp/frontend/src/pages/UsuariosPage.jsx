import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Users, Plus, Pencil, Trash2, Power, X, Search, Layers } from "lucide-react";

const ROLES = [
  "SUPERADMIN", "ADMIN", "COMPRAS", "ADMINISTRACION",
  "GESTION_PAGOS", "LOCAL", "VENDEDOR", "DEPOSITO",
];

const ROLE_COLORS = {
  SUPERADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-blue-100 text-blue-700",
  COMPRAS: "bg-violet-100 text-violet-700",
  ADMINISTRACION: "bg-amber-100 text-amber-700",
  GESTION_PAGOS: "bg-emerald-100 text-emerald-700",
  LOCAL: "bg-indigo-100 text-indigo-700",
  VENDEDOR: "bg-cyan-100 text-cyan-700",
  DEPOSITO: "bg-slate-100 text-slate-700",
};

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    username: user?.username || "",
    password: "",
    full_name: user?.full_name || "",
    email: user?.email || "",
    role: user?.role || "VENDEDOR",
    company_id: user?.company_id || null,
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            {user ? "Editar usuario" : "Nuevo usuario"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña {user && <span className="text-gray-400">(dejar vacío para no cambiar)</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              {...(!user && { required: true })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              {user ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal para configurar módulos visibles por usuario ──────────────────

function ModulesModal({ user, onClose, onSaved }) {
  const qc = useQueryClient();

  const { data: allModules = [], isLoading } = useQuery({
    queryKey: ["modules"],
    queryFn: () => api.get("/modules"),
  });

  // Si modules_override es null → el usuario ve todos los módulos activos de la empresa
  const [restricted, setRestricted] = useState(user.modules_override !== null);
  const [selected, setSelected] = useState(
    new Set(user.modules_override ?? allModules.filter((m) => m.is_active).map((m) => m.slug))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync selected when modules load (first time)
  const [synced, setSynced] = useState(false);
  if (!synced && allModules.length > 0) {
    if (!restricted) {
      setSelected(new Set(allModules.filter((m) => m.is_active).map((m) => m.slug)));
    }
    setSynced(true);
  }

  const toggle = (slug) => {
    const s = new Set(selected);
    if (s.has(slug)) s.delete(slug); else s.add(slug);
    setSelected(s);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const override = restricted ? [...selected] : null;
      await api.patch(`/users/${user.id}/modules`, { modules_override: override });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Módulos de {user.full_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Controlá qué módulos puede ver este usuario</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          {/* Modo */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={restricted}
                onChange={(e) => {
                  setRestricted(e.target.checked);
                  if (!e.target.checked) {
                    // Sin restricción → mostrar todos los activos
                    setSelected(new Set(allModules.filter((m) => m.is_active).map((m) => m.slug)));
                  }
                }}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-blue-800">Restringir módulos para este usuario</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {restricted
                    ? "Solo verá los módulos que selecciones abajo."
                    : "Sin restricción — verá todos los módulos activos de la empresa."}
                </p>
              </div>
            </label>
          </div>

          {/* Lista de módulos */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {restricted && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(new Set(allModules.map((m) => m.slug)))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Seleccionar todos
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Deseleccionar todos
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {selected.size} / {allModules.length} seleccionados
                  </span>
                </div>
              )}
              {[...allModules].sort((a, b) => (a.nombre || a.slug).localeCompare(b.nombre || b.slug)).map((mod) => (
                <label
                  key={mod.slug}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition
                    ${!restricted ? "opacity-50 cursor-not-allowed" : ""}
                    ${selected.has(mod.slug) && restricted ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!restricted}
                    checked={selected.has(mod.slug)}
                    onChange={() => restricted && toggle(mod.slug)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: mod.color + "20", color: mod.color }}
                  >
                    {mod.slug.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{mod.custom_name || mod.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{mod.rutas.join(", ")}</p>
                  </div>
                  {!mod.is_active && (
                    <span className="text-xs text-gray-400 shrink-0">(inactivo en empresa)</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "new" | user object
  const [modulesModal, setModulesModal] = useState(null); // null | user object

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => api.get(`/users/?search=${search}&limit=200`),
  });
  const users = pageData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/users/", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/users/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const handleSave = async (form) => {
    if (modal && modal !== "new") {
      await updateMutation.mutateAsync({ id: modal.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-500 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-sm text-gray-500">Gestión de usuarios y roles del ERP</p>
          </div>
        </div>
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Usuario</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Rol</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Módulos</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    Cargando...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No hay usuarios
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{u.username}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{u.full_name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.modules_override === null || u.modules_override === undefined ? (
                        <span className="text-xs text-gray-400">Todos</span>
                      ) : (
                        <span className="text-xs text-violet-600 font-medium">
                          {u.modules_override.length} seleccionados
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal(u)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setModulesModal(u)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-violet-600 transition"
                          title="Configurar módulos"
                        >
                          <Layers size={15} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(u.id)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-amber-600 transition"
                          title={u.is_active ? "Desactivar" : "Activar"}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Eliminar a ${u.username}?`)) deleteMutation.mutate(u.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
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

      {/* Modal */}
      {modal !== null && (
        <UserModal
          user={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Módulos Modal */}
      {modulesModal && (
        <ModulesModal
          user={modulesModal}
          onClose={() => setModulesModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
        />
      )}
    </div>
  );
}
