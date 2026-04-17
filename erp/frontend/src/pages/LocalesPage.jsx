import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Store, Plus, Pencil, Trash2, X, Search, Key, ChevronDown, ChevronRight,
  Monitor, CheckCircle2, Copy, RefreshCw, Power, Loader2, ShieldOff, RotateCcw,
} from "lucide-react";

// ── Modal crear/editar local ──────────────────────────────────────────────────
function LocalModal({ local, onClose, onSave }) {
  const [form, setForm] = useState({
    name: local?.name || "",
    code: local?.code || "",
    address: local?.address || "",
    phone: local?.phone || "",
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
          <h3 className="font-semibold text-gray-900">{local ? "Editar local" : "Nuevo local"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" required placeholder="Ej: LOC-01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{local ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal agregar nuevo serial a un local ─────────────────────────────────────
function AddSerialModal({ local, onClose, onSaved }) {
  const [desc, setDesc] = useState("");
  const [localServerUrl, setLocalServerUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/pc-licenses/", {
        description: desc,
        local_id: local.id,
        ...(localServerUrl ? { local_server_url: localServerUrl } : {}),
      });
      qc.invalidateQueries({ queryKey: ["locals"] });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Nuevo número de serie</h3>
            <p className="text-xs text-gray-400 mt-0.5">Para: <span className="font-medium text-gray-600">{local.name}</span></p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Ej: PC Caja, Notebook Encargado..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Servidor local LAN <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={localServerUrl}
              onChange={(e) => setLocalServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:8000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Si este local tiene servidor propio, la app lo usará primero para trabajar sin internet.</p>
          </div>
          <p className="text-xs text-gray-400">El número de serie se genera automáticamente en formato <code className="bg-gray-100 px-1 rounded">PC-XXXX-XXXX-XXXX-XXXX</code>.</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Generar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente badge para copiar el serial ────────────────────────────────────
function SerialKey({ keyStr }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(keyStr || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 font-mono text-xs bg-gray-900 text-emerald-400 px-2.5 py-1 rounded-lg hover:bg-gray-800 transition group"
      title="Copiar número de serie"
    >
      {keyStr}
      {copied
        ? <CheckCircle2 size={11} className="text-emerald-400" />
        : <Copy size={11} className="text-gray-500 group-hover:text-emerald-400 transition" />
      }
    </button>
  );
}

// ── Fila expandible de un local ───────────────────────────────────────────────
function LocalRow({ local, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [addSerial, setAddSerial] = useState(false);
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) =>
      api.patch(`/pc-licenses/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locals"] }),
  });

  const resetMutation = useMutation({
    mutationFn: (id) => api.post(`/pc-licenses/${id}/reset-machine`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locals"] }),
  });

  const deleteLicMutation = useMutation({
    mutationFn: (id) => api.delete(`/pc-licenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["locals"] }),
  });

  const licenses = local.pc_licenses ?? [];
  const activeCount = licenses.filter((l) => l.is_active).length;

  return (
    <>
      <tr
        className="hover:bg-gray-50/50 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown size={15} className="text-gray-400 shrink-0" />
              : <ChevronRight size={15} className="text-gray-400 shrink-0" />
            }
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{local.code}</span>
          </div>
        </td>
        <td className="py-3 px-4 font-medium text-gray-900">{local.name}</td>
        <td className="py-3 px-4 text-gray-600 text-sm">{local.address || "—"}</td>
        <td className="py-3 px-4">
          {licenses.length === 0 ? (
            <span className="text-xs text-gray-400 italic">Sin seriales</span>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Key size={10} />
                {activeCount} activo{activeCount !== 1 ? "s" : ""}
              </div>
              {licenses.length - activeCount > 0 && (
                <span className="text-xs text-gray-400">{licenses.length - activeCount} inactivo{licenses.length - activeCount !== 1 ? "s" : ""}</span>
              )}
            </div>
          )}
        </td>
        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => { setExpanded(true); setAddSerial(true); }}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition"
              title="Agregar serial"
            >
              <Plus size={15} />
            </button>
            <button onClick={() => onEdit(local)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition" title="Editar local">
              <Pencil size={15} />
            </button>
            <button
              onClick={() => { if (confirm(`Eliminar ${local.name}?`)) onDelete(local.id); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition"
              title="Eliminar local"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      {/* Panel expandido de seriales */}
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-slate-50 border-t border-slate-100 px-4 pb-4 pt-3">
            <div className="ml-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Key size={12} /> Números de serie ({licenses.length})
                </p>
                <button
                  onClick={() => setAddSerial(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                >
                  <Plus size={12} /> Nuevo serial
                </button>
              </div>

              {licenses.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm bg-white rounded-xl border border-dashed border-gray-200">
                  <Monitor size={24} className="mx-auto mb-2 text-gray-200" />
                  <p>No hay números de serie para este local.</p>
                  <p className="text-xs mt-1">Creá uno para habilitar el acceso desde las PCs de este local.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {licenses.map((lic) => (
                    <div
                      key={lic.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border bg-white ${
                        lic.is_active ? "border-gray-200" : "border-red-100 bg-red-50/30 opacity-70"
                      }`}
                    >
                      <Monitor size={16} className={lic.is_active ? "text-emerald-500 shrink-0" : "text-gray-300 shrink-0"} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SerialKey keyStr={lic.key} />
                          {lic.description && (
                            <span className="text-xs text-gray-500">{lic.description}</span>
                          )}
                          {!lic.is_active && (
                            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <ShieldOff size={11} /> Desactivado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          {lic.machine_id ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                              Vinculado a equipo
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                              Sin vincular
                            </span>
                          )}
                          {lic.last_seen_at && (
                            <span>Último uso: {new Date(lic.last_seen_at).toLocaleDateString("es-AR")}</span>
                          )}
                          {lic.local_server_url && (
                            <span className="flex items-center gap-1 text-blue-600 font-mono" title="Servidor local LAN">
                              🖥️ {lic.local_server_url}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {lic.machine_id && (
                          <button
                            onClick={() => { if (confirm("¿Desvincular este serial del equipo actual? Podrá activarse en otro.")) resetMutation.mutate(lic.id); }}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition"
                            title="Desvincular equipo"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => toggleMutation.mutate({ id: lic.id, is_active: !lic.is_active })}
                          className={`p-1.5 rounded-lg transition ${
                            lic.is_active
                              ? "hover:bg-red-50 text-gray-400 hover:text-red-600"
                              : "hover:bg-emerald-50 text-gray-400 hover:text-emerald-600"
                          }`}
                          title={lic.is_active ? "Desactivar" : "Activar"}
                        >
                          <Power size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Eliminar serial ${lic.key}?`)) deleteLicMutation.mutate(lic.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                          title="Eliminar serial"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {addSerial && <AddSerialModal local={local} onClose={() => setAddSerial(false)} onSaved={() => {}} />}
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LocalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["locals", search],
    queryFn: () => api.get(`/locals/?search=${search}&limit=200`),
  });
  const locals = pageData?.items ?? [];

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/locals/", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["locals"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/locals/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["locals"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/locals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["locals"] }),
  });

  const handleSave = async (form) => {
    if (modal && modal !== "new") {
      await updateMutation.mutateAsync({ id: modal.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
  };

  const totalSerials = locals.reduce((acc, l) => acc + (l.pc_licenses?.length ?? 0), 0);
  const activeSerials = locals.reduce((acc, l) => acc + (l.pc_licenses?.filter((p) => p.is_active).length ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center"><Store size={20} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Locales</h1>
            <p className="text-sm text-gray-500">Puntos de venta y sus números de serie</p>
          </div>
        </div>
        <button onClick={() => setModal("new")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus size={16} /> Nuevo local
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-900">{locals.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Locales</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-600">{activeSerials}</p>
          <p className="text-xs text-gray-500 mt-0.5">Seriales activos</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-gray-400">{totalSerials - activeSerials}</p>
          <p className="text-xs text-gray-500 mt-0.5">Seriales inactivos</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>

      {/* Tabla con locales expandibles */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Dirección</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Seriales</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">
                  <Loader2 size={24} className="animate-spin mx-auto" />
                </td></tr>
              ) : locals.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No hay locales</td></tr>
              ) : (
                locals.map((l) => (
                  <LocalRow
                    key={l.id}
                    local={l}
                    onEdit={(loc) => setModal(loc)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Hacé click en un local para ver y gestionar sus números de serie. Cada PC necesita su propio serial para acceder al ERP.
      </p>

      {modal !== null && <LocalModal local={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}
