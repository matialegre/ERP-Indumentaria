import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Store, Plus, Pencil, Trash2, X, Search } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center"><Store size={20} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Locales</h1>
            <p className="text-sm text-gray-500">Puntos de venta y sucursales</p>
          </div>
        </div>
        <button onClick={() => setModal("new")} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
          <Plus size={16} /> Nuevo local
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre o código..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Dirección</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Teléfono</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Cargando...</td></tr>
              ) : locals.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No hay locales</td></tr>
              ) : (
                locals.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4"><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{l.code}</span></td>
                    <td className="py-3 px-4 font-medium text-gray-900">{l.name}</td>
                    <td className="py-3 px-4 text-gray-600">{l.address || "—"}</td>
                    <td className="py-3 px-4 text-gray-600">{l.phone || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(l)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition" title="Editar"><Pencil size={15} /></button>
                        <button onClick={() => { if (confirm(`Eliminar ${l.name}?`)) deleteMutation.mutate(l.id); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-600 transition" title="Eliminar"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && <LocalModal local={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  );
}
