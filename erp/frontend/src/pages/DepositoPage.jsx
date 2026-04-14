import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  PackageCheck,
  Warehouse,
  Search,
  X,
  PackageOpen,
  Truck,
  FileText,
  Trash2,
  Check,
  Ban,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────

function Badge({ estado }) {
  const map = {
    BORRADOR:    "bg-gray-100 text-gray-700",
    CONFIRMADA:  "bg-blue-100 text-blue-700",
    RECIBIDA:    "bg-green-100 text-green-700",
    ANULADA:     "bg-red-100 text-red-700",
    EN_PROCESO:  "bg-yellow-100 text-yellow-700",
    COMPLETADO:  "bg-green-100 text-green-700",
    APLICADO:    "bg-purple-100 text-purple-700",
    CANCELADO:   "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {estado}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color = "blue" }) {
  const colors = {
    blue:   "bg-blue-50 text-blue-700",
    green:  "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red:    "bg-red-50 text-red-700",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value ?? "—"}</p>
      </div>
    </div>
  );
}

// ─── Tab: Dashboard ─────────────────────────────────────────────────────────

function TabDashboard() {
  const { data: resumen, isLoading } = useQuery({
    queryKey: ["deposito-resumen"],
    queryFn: () => api.get("/deposito/resumen"),
  });

  const { data: stockData } = useQuery({
    queryKey: ["deposito-stock"],
    queryFn: () => api.get("/deposito/stock-por-local"),
  });

  if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-gray-400" /></div>;

  const r = resumen ?? {};
  const stock = stockData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Warehouse}      label="Locales activos"           value={r.total_locales}       color="blue" />
        <StatCard icon={Boxes}          label="Unidades en depósito"      value={r.unidades_deposito}   color="blue" />
        <StatCard icon={ArrowRightLeft} label="Transferencias pendientes" value={r.transferencias_pendientes} color="yellow" />
        <StatCard icon={AlertTriangle}  label="Alertas stock bajo"        value={r.alertas_stock_bajo}  color="red" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800">Stock por ubicación</h3>
          <span className="text-xs text-gray-400">{stock.length} artículos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-2 text-left">Producto</th>
                <th className="px-5 py-2 text-left">SKU</th>
                <th className="px-5 py-2 text-left">Ubicación</th>
                <th className="px-5 py-2 text-right">Cantidad</th>
                <th className="px-5 py-2 text-right">Mín.</th>
              </tr>
            </thead>
            <tbody>
              {stock.slice(0, 20).map((item, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-2 font-medium text-gray-800">{item.producto}</td>
                  <td className="px-5 py-2 text-gray-500 font-mono text-xs">{item.sku}</td>
                  <td className="px-5 py-2 text-gray-600">{item.local_nombre ?? "Depósito Central"}</td>
                  <td className="px-5 py-2 text-right font-semibold">
                    <span className={item.cantidad <= (item.stock_minimo ?? 0) ? "text-red-600" : "text-gray-800"}>
                      {item.cantidad}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right text-gray-400">{item.stock_minimo ?? "—"}</td>
                </tr>
              ))}
              {stock.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Sin datos de stock</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Nueva Transferencia ──────────────────────────────────────────────

function ModalNuevaTransferencia({ onClose, onCreated }) {
  const [form, setForm] = useState({ origen_local_id: "", destino_local_id: "", notas: "" });
  const [items, setItems] = useState([{ variante_id: "", cantidad: 1 }]);

  const mutation = useMutation({
    mutationFn: (payload) => api.post("/deposito/transferencias", payload),
    onSuccess: () => { onCreated(); onClose(); },
  });

  const { data: locales } = useQuery({
    queryKey: ["locales-list"],
    queryFn: () => api.get("/locals"),
  });

  const addItem = () => setItems([...items, { variante_id: "", cantidad: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...form, items });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Nueva Transferencia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Origen</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.origen_local_id}
                onChange={(e) => setForm({ ...form, origen_local_id: e.target.value })}
              >
                <option value="">Depósito Central</option>
                {(locales ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.destino_local_id}
                onChange={(e) => setForm({ ...form, destino_local_id: e.target.value })}
                required
              >
                <option value="">— Seleccionar destino —</option>
                {(locales ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-gray-600">Artículos</label>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus size={12} /> Agregar
              </button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="ID de variante"
                  value={item.variante_id}
                  onChange={(e) => updateItem(i, "variante_id", e.target.value)}
                  required
                />
                <input
                  type="number" min="1"
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={item.cantidad}
                  onChange={(e) => updateItem(i, "cantidad", parseInt(e.target.value))}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {mutation.error?.message ?? "Error al crear transferencia"}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? "Guardando..." : "Crear Transferencia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Transferencias ─────────────────────────────────────────────────────

function TabTransferencias() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["deposito-transferencias", filtroEstado],
    queryFn: () => api.get(`/deposito/transferencias${filtroEstado !== "TODOS" ? `?estado=${filtroEstado}` : ""}`),
  });

  const { data: detalle } = useQuery({
    queryKey: ["deposito-trf-detalle", expanded],
    queryFn: () => api.get(`/deposito/transferencias/${expanded}`),
    enabled: !!expanded,
  });

  const confirmar = useMutation({
    mutationFn: (id) => api.patch(`/deposito/transferencias/${id}/confirmar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deposito-transferencias"] }),
  });
  const recibir = useMutation({
    mutationFn: (id) => api.patch(`/deposito/transferencias/${id}/recibir`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deposito-transferencias"] }),
  });
  const anular = useMutation({
    mutationFn: (id) => api.patch(`/deposito/transferencias/${id}/anular`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deposito-transferencias"] }),
  });

  const transferencias = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["TODOS", "BORRADOR", "CONFIRMADA", "RECIBIDA", "ANULADA"].map(e => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${filtroEstado === e ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} /> Nueva Transferencia
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {transferencias.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <ArrowRightLeft size={40} className="mx-auto mb-3 opacity-30" />
              <p>Sin transferencias</p>
            </div>
          ) : (
            transferencias.map((trf) => (
              <div key={trf.id} className="border-b border-gray-100 last:border-0">
                <div
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === trf.id ? null : trf.id)}
                >
                  <div className="flex items-center gap-3">
                    {expanded === trf.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {trf.origen_nombre ?? "Depósito Central"} → {trf.destino_nombre}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(trf.created_at).toLocaleDateString("es-AR")} · {trf.total_items} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge estado={trf.estado} />
                    {trf.estado === "BORRADOR" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmar.mutate(trf.id); }}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      >
                        Confirmar
                      </button>
                    )}
                    {trf.estado === "CONFIRMADA" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); recibir.mutate(trf.id); }}
                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 flex items-center gap-1"
                      >
                        <PackageCheck size={12} /> Recibir
                      </button>
                    )}
                    {(trf.estado === "BORRADOR" || trf.estado === "CONFIRMADA") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("¿Anular transferencia?")) anular.mutate(trf.id); }}
                        className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </div>
                {expanded === trf.id && detalle && (
                  <div className="bg-gray-50 px-8 py-3 border-t border-gray-100">
                    {detalle.notas && <p className="text-xs text-gray-500 mb-2">📝 {detalle.notas}</p>}
                    <table className="w-full text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left py-1">Producto</th>
                          <th className="text-left">SKU</th>
                          <th className="text-right">Cant.</th>
                          <th className="text-right">Recibido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.items ?? []).map((item, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-1">{item.producto}</td>
                            <td className="font-mono text-gray-400">{item.sku}</td>
                            <td className="text-right">{item.cantidad}</td>
                            <td className="text-right">{item.cantidad_recibida ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <ModalNuevaTransferencia
          onClose={() => setShowModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["deposito-transferencias"] })}
        />
      )}
    </div>
  );
}

// ─── Tab: Inventario Físico ──────────────────────────────────────────────────

function TabInventario() {
  const qc = useQueryClient();
  const [selectedConteo, setSelectedConteo] = useState(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevoObs, setNuevoObs] = useState("");

  const { data: conteos, isLoading } = useQuery({
    queryKey: ["deposito-conteos"],
    queryFn: () => api.get("/deposito/conteos"),
  });

  const { data: detalle, refetch: refetchDetalle } = useQuery({
    queryKey: ["deposito-conteo-detalle", selectedConteo],
    queryFn: () => api.get(`/deposito/conteos/${selectedConteo}`),
    enabled: !!selectedConteo,
  });

  const crearConteo = useMutation({
    mutationFn: (obs) => api.post("/deposito/conteos", { observaciones: obs }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["deposito-conteos"] });
      setSelectedConteo(data.id);
      setShowNuevo(false);
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ conteoId, itemId, cantidad_fisica }) =>
      api.patch(`/deposito/conteos/${conteoId}/item/${itemId}`, { cantidad_fisica }),
    onSuccess: () => refetchDetalle(),
  });

  const aplicar = useMutation({
    mutationFn: (id) => api.post(`/deposito/conteos/${id}/aplicar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deposito-conteos"] }),
  });

  const lista = conteos ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Conteos de Inventario</h3>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} /> Nuevo Conteo
        </button>
      </div>

      {showNuevo && (
        <div className="bg-blue-50 rounded-xl p-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Ej: Inventario mensual junio"
              value={nuevoObs}
              onChange={(e) => setNuevoObs(e.target.value)}
            />
          </div>
          <button
            onClick={() => crearConteo.mutate(nuevoObs)}
            disabled={crearConteo.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Crear
          </button>
          <button onClick={() => setShowNuevo(false)} className="px-4 py-2 text-gray-500 text-sm">Cancelar</button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex justify-center py-12"><RefreshCw className="animate-spin text-gray-400" /></div>
        ) : lista.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-gray-400">
            <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
            <p>Sin conteos registrados</p>
          </div>
        ) : (
          lista.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedConteo(selectedConteo === c.id ? null : c.id)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition ${selectedConteo === c.id ? "border-blue-400 shadow-md" : "border-gray-200"}`}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge estado={c.estado} />
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString("es-AR")}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{c.local_nombre ?? "Depósito Central"}</p>
              <p className="text-xs text-gray-500 mt-1">{c.observaciones || "Sin observaciones"}</p>
              <p className="text-xs text-gray-400 mt-2">{c.total_items} items · {c.items_contados} contados</p>
            </div>
          ))
        )}
      </div>

      {selectedConteo && detalle && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b flex justify-between items-center">
            <h4 className="font-semibold text-gray-800">Detalle del conteo</h4>
            {detalle.estado === "EN_PROCESO" && (
              <button
                onClick={() => { if (confirm("¿Aplicar diferencias al stock?")) aplicar.mutate(selectedConteo); }}
                disabled={aplicar.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle size={14} /> Aplicar al Stock
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-5 py-2 text-left">Producto</th>
                  <th className="px-5 py-2 text-left">SKU</th>
                  <th className="px-5 py-2 text-right">Sistema</th>
                  <th className="px-5 py-2 text-right">Físico</th>
                  <th className="px-5 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {(detalle.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-2 font-medium text-gray-800">{item.producto}</td>
                    <td className="px-5 py-2 font-mono text-xs text-gray-500">{item.sku}</td>
                    <td className="px-5 py-2 text-right text-gray-600">{item.cantidad_sistema}</td>
                    <td className="px-5 py-2 text-right">
                      {detalle.estado === "EN_PROCESO" ? (
                        <input
                          type="number"
                          min="0"
                          defaultValue={item.cantidad_fisica ?? ""}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val !== item.cantidad_fisica) {
                              updateItem.mutate({ conteoId: selectedConteo, itemId: item.id, cantidad_fisica: val });
                            }
                          }}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-right text-sm"
                        />
                      ) : (
                        <span>{item.cantidad_fisica ?? "—"}</span>
                      )}
                    </td>
                    <td className={`px-5 py-2 text-right font-semibold ${item.diferencia > 0 ? "text-green-600" : item.diferencia < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {item.diferencia != null ? (item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Alertas ────────────────────────────────────────────────────────────

function TabAlertas() {
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["deposito-alertas"],
    queryFn: () => api.get("/deposito/alertas"),
  });

  const alertas = (data ?? []).filter(a =>
    !search || a.producto?.toLowerCase().includes(search.toLowerCase()) ||
    a.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <RefreshCw size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-gray-400" /></div>
      ) : alertas.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
          <p className="font-medium text-green-600">Sin alertas de stock bajo</p>
          <p className="text-sm mt-1">Todo el inventario está en niveles adecuados</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-2 text-left">Producto</th>
                <th className="px-5 py-2 text-left">SKU</th>
                <th className="px-5 py-2 text-left">Ubicación</th>
                <th className="px-5 py-2 text-right">Stock actual</th>
                <th className="px-5 py-2 text-right">Stock mínimo</th>
                <th className="px-5 py-2 text-right">Faltante</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-red-50/30">
                  <td className="px-5 py-2 font-medium text-gray-800">{a.producto}</td>
                  <td className="px-5 py-2 font-mono text-xs text-gray-500">{a.sku}</td>
                  <td className="px-5 py-2 text-gray-600">{a.local_nombre ?? "Depósito Central"}</td>
                  <td className="px-5 py-2 text-right font-semibold text-red-600">{a.cantidad}</td>
                  <td className="px-5 py-2 text-right text-gray-400">{a.stock_minimo}</td>
                  <td className="px-5 py-2 text-right font-bold text-red-700">
                    {a.stock_minimo - a.cantidad > 0 ? `-${a.stock_minimo - a.cantidad}` : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Modal: Nuevo Ingreso de Stock ───────────────────────────────────────────

function ModalNuevoIngreso({ onClose, onCreated }) {
  const [form, setForm] = useState({
    type: "REMITO",
    number: "",
    date: new Date().toISOString().split("T")[0],
    provider_id: "",
    notes: "",
  });
  const [items, setItems] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState("");

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-deposito"],
    queryFn: () => api.get("/providers/?limit=500"),
    select: (d) => Array.isArray(d) ? d : d?.items ?? [],
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-deposito-search", productSearch],
    queryFn: () => api.get(`/products/?${productSearch ? `search=${encodeURIComponent(productSearch)}&` : ""}limit=50`),
    select: (d) => Array.isArray(d) ? d : d?.items ?? [],
    enabled: productSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: (payload) => api.post("/ingresos/", payload),
    onSuccess: () => { onCreated(); onClose(); },
  });

  const addItem = () => {
    if (!selectedVariant) return;
    setItems([...items, {
      variant_id: selectedVariant.id,
      product_name: selectedVariant._productName,
      sku: selectedVariant.sku,
      size: selectedVariant.size,
      color: selectedVariant.color,
      quantity: Number(qty),
      unit_cost: cost ? Number(cost) : null,
    }]);
    setSelectedVariant(null);
    setProductSearch("");
    setQty(1);
    setCost("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    createMut.mutate({
      ...form,
      provider_id: Number(form.provider_id),
      items: items.map(({ variant_id, quantity, unit_cost }) => ({ variant_id, quantity, unit_cost })),
    });
  };

  const variants = products.flatMap((p) =>
    (p.variants || []).map((v) => ({ ...v, _productName: p.name }))
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PackageOpen size={20} className="text-indigo-600" /> Nuevo Ingreso de Stock
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
              <div className="flex gap-2">
                {["REMITO", "FACTURA"].map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      form.type === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número *</label>
              <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="0001-00001234"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
              <select required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">— Seleccionar —</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b text-xs font-semibold text-gray-600">Agregar artículo</div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedVariant(null); }}
                  placeholder="Buscar producto (mín. 2 letras)..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              {variants.length > 0 && (
                <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {variants.map((v) => (
                    <button key={v.id} type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition flex justify-between items-center ${
                        selectedVariant?.id === v.id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                      }`}>
                      <span>
                        <span className="font-medium">{v._productName}</span>
                        <span className="text-gray-500 ml-2 text-xs">{v.size} / {v.color}</span>
                      </span>
                      <span className="font-mono text-xs text-gray-400">{v.sku}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedVariant && (
                <div className="flex gap-3 items-end">
                  <div className="flex-1 bg-indigo-50 rounded-lg px-3 py-2 text-sm border border-indigo-100">
                    <span className="font-medium">{selectedVariant._productName}</span>
                    <span className="text-gray-500 ml-2 text-xs">{selectedVariant.size} / {selectedVariant.color} · {selectedVariant.sku}</span>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cant.</label>
                    <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                      className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Costo</label>
                    <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
                      placeholder="Opc."
                      className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm" />
                  </div>
                  <button type="button" onClick={addItem}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b text-xs font-semibold text-gray-600">Ítems ({items.length})</div>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Producto</th>
                    <th className="px-4 py-2 text-left">Talle/Color</th>
                    <th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">Costo</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-gray-50">
                      <td className="px-4 py-2 font-medium">{it.product_name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{it.size} / {it.color}</td>
                      <td className="px-4 py-2 text-right font-semibold">{it.quantity}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{it.unit_cost ? `$${it.unit_cost}` : "—"}</td>
                      <td className="px-2">
                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {createMut.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {createMut.error?.message ?? "Error al crear ingreso"}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button type="submit" disabled={createMut.isPending || items.length === 0 || !form.provider_id}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
              {createMut.isPending ? "Guardando..." : "Crear Ingreso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tab: Ingresos de Stock ──────────────────────────────────────────────────

function TabIngresos() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["deposito-ingresos", filtroStatus],
    queryFn: () => api.get(`/ingresos/?limit=100${filtroStatus !== "TODOS" ? `&status=${filtroStatus}` : ""}`),
    select: (d) => d?.items ?? [],
  });

  const { data: detalle } = useQuery({
    queryKey: ["deposito-ingreso-detalle", expanded],
    queryFn: () => api.get(`/ingresos/${expanded}`),
    enabled: !!expanded,
  });

  const confirmarMut = useMutation({
    mutationFn: (id) => api.post(`/ingresos/${id}/confirmar-recepcion`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposito-ingresos"] });
      qc.invalidateQueries({ queryKey: ["deposito-ingreso-detalle", expanded] });
      qc.invalidateQueries({ queryKey: ["deposito-resumen"] });
      qc.invalidateQueries({ queryKey: ["deposito-stock"] });
    },
  });

  const ingresos = data ?? [];
  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";

  const statusColors = {
    BORRADOR:   "bg-yellow-100 text-yellow-700",
    CONFIRMADO: "bg-green-100 text-green-700",
    ANULADO:    "bg-red-100 text-red-700",
  };
  const typeColors = {
    REMITO:   "bg-orange-100 text-orange-700",
    FACTURA:  "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["TODOS", "BORRADOR", "CONFIRMADO", "ANULADO"].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                filtroStatus === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
            <Plus size={16} /> Nuevo Ingreso
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-gray-400" /></div>
      ) : ingresos.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <PackageOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>Sin ingresos registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {ingresos.map((ing) => (
            <div key={ing.id} className="border-b border-gray-100 last:border-0">
              <div
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpanded(expanded === ing.id ? null : ing.id)}
              >
                <div className="flex items-center gap-3">
                  {expanded === ing.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[ing.type] ?? "bg-gray-100 text-gray-600"}`}>{ing.type}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">#{ing.number}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Truck size={11} /> {ing.provider_name} · {fmtDate(ing.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ing.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {ing.status}
                  </span>
                  {ing.status === "BORRADOR" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("¿Confirmar recepción de mercadería? Se actualizará el stock."))
                          confirmarMut.mutate(ing.id);
                      }}
                      disabled={confirmarMut.isPending}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <PackageCheck size={13} /> Confirmar Recepción
                    </button>
                  )}
                </div>
              </div>
              {expanded === ing.id && detalle && (
                <div className="bg-gray-50 px-8 py-3 border-t border-gray-100">
                  {detalle.notes && <p className="text-xs text-gray-500 mb-2">📝 {detalle.notes}</p>}
                  {detalle.items?.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="text-left py-1">Producto</th>
                          <th className="text-left">Talle/Color</th>
                          <th className="text-left">SKU</th>
                          <th className="text-right">Cantidad</th>
                          <th className="text-right">Costo unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.items.map((item) => (
                          <tr key={item.id} className="border-t border-gray-100">
                            <td className="py-1.5 font-medium">{item.product_name || "—"}</td>
                            <td className="text-gray-500">{item.variant_size} / {item.variant_color}</td>
                            <td className="font-mono text-gray-400">{item.variant_sku}</td>
                            <td className="text-right font-semibold">{item.quantity}</td>
                            <td className="text-right text-gray-500">{item.unit_cost ? `$${item.unit_cost}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">Sin ítems</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalNuevoIngreso
          onClose={() => setShowModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["deposito-ingresos"] })}
        />
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const TABS = [
  { id: "dashboard",      label: "Dashboard",           icon: Warehouse },
  { id: "ingresos",       label: "Ingresos de Stock",   icon: PackageOpen },
  { id: "transferencias", label: "Transferencias",       icon: ArrowRightLeft },
  { id: "inventario",     label: "Inventario Físico",    icon: ClipboardCheck },
  { id: "alertas",        label: "Alertas",              icon: AlertTriangle },
];

export default function DepositoPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Boxes size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Depósito</h1>
            <p className="text-sm text-gray-500">Gestión de stock, transferencias e inventario</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "dashboard"      && <TabDashboard />}
      {tab === "ingresos"       && <TabIngresos />}
      {tab === "transferencias" && <TabTransferencias />}
      {tab === "inventario"     && <TabInventario />}
      {tab === "alertas"        && <TabAlertas />}
    </div>
  );
}
