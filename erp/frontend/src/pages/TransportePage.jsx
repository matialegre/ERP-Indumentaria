import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { exportCSV, exportExcel } from "../lib/exportUtils";
import {
  Truck, Plus, Search, Eye, Pencil, CheckCircle,
  X, Package, Clock, MapPin, FileText, Download,
  ArrowRight, Send, ArrowLeftRight, Building2, Filter,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────

const STATUS_CONFIG = {
  ENVIADO:    { label: "Pendiente",    color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" },
  EN_TRANSITO:{ label: "En Tránsito", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500" },
  ENTREGADO:  { label: "Entregado",   color: "bg-green-100 text-green-700",  dot: "bg-green-500" },
};

const TABS = [
  { id: "ENVIADO",      label: "Pendientes" },
  { id: "EN_TRANSITO",  label: "En Tránsito" },
  { id: "ENTREGADO",    label: "Entregados" },
  { id: "ALL",          label: "Todos" },
  { id: "REPOSICION",   label: "Reposición Rápida", icon: ArrowLeftRight },
];

const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ENVIADO;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

const EXPORT_COLUMNS = [
  { key: "date_sent",              label: "Fecha Envío" },
  { key: "transport_name",         label: "Transportista" },
  { key: "tracking_number",        label: "Carta Porte" },
  { key: "sender",                 label: "Origen" },
  { key: "destination_local_name", label: "Destino" },
  { key: "status",                 label: "Estado" },
  { key: "notes",                  label: "Observaciones" },
];

const EMPTY_FORM = {
  transport_id: "",
  tracking_number: "",
  date_sent: new Date().toISOString().slice(0, 10),
  sender: "",
  destination_local_id: "",
  notes: "",
  purchase_invoice_id: "",
  status: "ENVIADO",
};

// ── Main Component ────────────────────────────────────

export default function TransportePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  // Queries
  const { data: shipmentsData, isLoading } = useQuery({
    queryKey: ["shipments", activeTab],
    enabled: activeTab !== "REPOSICION",
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") params.set("status", activeTab);
      params.set("limit", "200");
      return api.get(`/transports/shipments/?${params}`);
    },
  });
  const shipments = shipmentsData?.items ?? [];

  const { data: transports = [] } = useQuery({
    queryKey: ["transports"],
    queryFn: () => api.get("/transports/"),
  });

  const { data: locals = [] } = useQuery({
    queryKey: ["locals"],
    queryFn: () => api.get("/locals/"),
  });

  // Filter
  const filtered = useMemo(() => {
    if (!search) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(s =>
      s.transport_name?.toLowerCase().includes(q) ||
      s.tracking_number?.toLowerCase().includes(q) ||
      s.sender?.toLowerCase().includes(q) ||
      s.destination_local_name?.toLowerCase().includes(q)
    );
  }, [shipments, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const c = { ALL: shipments.length };
    for (const s of shipments) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [shipments]);

  // Mutations
  const deliverMut = useMutation({
    mutationFn: (id) => api.post(`/transports/shipments/${id}/delivered`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipments"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/transports/shipments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shipments"] }),
  });

  const exportData = filtered.map(s => ({
    ...s,
    date_sent: fmtDate(s.date_sent),
    status: STATUS_CONFIG[s.status]?.label || s.status,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck size={24} className="text-blue-600" /> Transporte
          </h1>
          <p className="text-sm text-gray-500 mt-1">Registro de envíos y cartas de porte</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(exportData, `envios-${new Date().toISOString().slice(0,10)}`, EXPORT_COLUMNS)}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={() => exportExcel(exportData, `envios-${new Date().toISOString().slice(0,10)}`, EXPORT_COLUMNS, 'Envíos')}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
          >
            <Download size={16} /> Excel
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 font-medium"
          >
            <Plus size={16} /> Nuevo Envío
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-0">
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const cfg = STATUS_CONFIG[tab.id];
          const cnt = activeTab === "ALL" ? (tabCounts[tab.id] || 0) : (tab.id === activeTab ? filtered.length : "");
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors
                ${active ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
              {tab.icon && <tab.icon size={13} />}
              {tab.label}
              {tab.id !== "REPOSICION" && tabCounts[tab.id] != null && (
                <span className={`text-[10px] px-1 rounded-full ${active ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                  {tabCounts[tab.id] || 0}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido: Reposición Rápida o Envíos */}
      {activeTab === "REPOSICION" ? (
        <ReposicionRapida locals={locals} />
      ) : (
        <>
      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar: transportista, carta porte, destino…"
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando envíos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 flex flex-col items-center text-gray-400">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No hay envíos{search ? " que coincidan" : " en esta sección"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Transportista</th>
                  <th className="px-4 py-3 text-left">Carta Porte</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-left">Destino</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(s.date_sent)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.transport_name || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.tracking_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{s.sender || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{s.destination_local_name || "—"}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetailId(s.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        {s.status === "ENVIADO" && (
                          <button
                            onClick={() => updateMut.mutate({ id: s.id, data: { status: "EN_TRANSITO" } })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Marcar En Tránsito"
                          >
                            <Send size={16} />
                          </button>
                        )}
                        {(s.status === "ENVIADO" || s.status === "EN_TRANSITO") && (
                          <button
                            onClick={() => deliverMut.mutate(s.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                            title="Marcar Entregado"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Create Modal */}
      {createOpen && (
        <CreateShipmentModal
          transports={transports}
          locals={locals}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {/* Detail Modal */}
      {detailId && (
        <ShipmentDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

// ── Create Shipment Modal ─────────────────────────────

function CreateShipmentModal({ transports, locals, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [newTransport, setNewTransport] = useState(false);
  const [newTransportName, setNewTransportName] = useState("");

  const createTransportMut = useMutation({
    mutationFn: (data) => api.post("/transports/", data),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["transports"] });
      setForm(prev => ({ ...prev, transport_id: t.id }));
      setNewTransport(false);
      setNewTransportName("");
    },
  });

  const createShipmentMut = useMutation({
    mutationFn: (data) => api.post("/transports/shipments/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipments"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      transport_id: parseInt(form.transport_id),
      tracking_number: form.tracking_number || null,
      sender: form.sender || null,
      destination_local_id: form.destination_local_id ? parseInt(form.destination_local_id) : null,
      date_sent: form.date_sent || null,
      notes: form.notes || null,
      purchase_invoice_id: form.purchase_invoice_id ? parseInt(form.purchase_invoice_id) : null,
      status: form.status,
    };
    createShipmentMut.mutate(payload);
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck size={20} className="text-blue-600" /> Nuevo Envío
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Transportista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transportista *</label>
            {newTransport ? (
              <div className="flex gap-2">
                <input
                  value={newTransportName}
                  onChange={e => setNewTransportName(e.target.value)}
                  placeholder="Nombre del transportista"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => createTransportMut.mutate({ name: newTransportName })}
                  disabled={!newTransportName.trim() || createTransportMut.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Crear
                </button>
                <button type="button" onClick={() => setNewTransport(false)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={form.transport_id}
                  onChange={e => set("transport_id", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar…</option>
                  {transports.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setNewTransport(true)} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Carta porte + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° Carta Porte</label>
              <input
                value={form.tracking_number}
                onChange={e => set("tracking_number", e.target.value)}
                placeholder="CP-001234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Envío</label>
              <input
                type="date"
                value={form.date_sent}
                onChange={e => set("date_sent", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Origen + Destino */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origen</label>
              <input
                value={form.sender}
                onChange={e => set("sender", e.target.value)}
                placeholder="Ej: Bahía Blanca"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destino (Local)</label>
              <select
                value={form.destination_local_id}
                onChange={e => set("destination_local_id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar…</option>
                {locals.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={form.status}
              onChange={e => set("status", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="ENVIADO">Pendiente</option>
              <option value="EN_TRANSITO">En Tránsito</option>
              <option value="ENTREGADO">Entregado</option>
            </select>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={3}
              placeholder="Notas adicionales del envío..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {createShipmentMut.error && (
            <p className="text-sm text-red-600">{createShipmentMut.error.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createShipmentMut.isPending || !form.transport_id}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {createShipmentMut.isPending ? "Guardando..." : "Crear Envío"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shipment Detail Modal ─────────────────────────────

function ShipmentDetailModal({ id, onClose }) {
  const { data: shipment, isLoading } = useQuery({
    queryKey: ["shipment", id],
    queryFn: () => api.get(`/transports/shipments/${id}`),
  });

  if (isLoading || !shipment) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  const timeline = [];
  if (shipment.date_sent) {
    timeline.push({ label: "Enviado", date: fmtDate(shipment.date_sent), icon: Send, color: "text-amber-500" });
  }
  if (shipment.status === "EN_TRANSITO" || shipment.status === "ENTREGADO") {
    timeline.push({ label: "En Tránsito", date: "", icon: Truck, color: "text-blue-500" });
  }
  if (shipment.status === "ENTREGADO") {
    timeline.push({ label: "Entregado", date: fmtDate(shipment.date_arrived), icon: CheckCircle, color: "text-green-500" });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Detalle del Envío
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Transportista" value={shipment.transport_name} />
            <InfoField label="Carta Porte" value={shipment.tracking_number} mono />
            <InfoField label="Origen" value={shipment.sender} />
            <InfoField label="Destino" value={shipment.destination_local_name} />
            <InfoField label="Fecha Envío" value={fmtDate(shipment.date_sent)} />
            <InfoField label="Fecha Entrega" value={fmtDate(shipment.date_arrived)} />
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Estado</p>
              <StatusBadge status={shipment.status} />
            </div>
          </div>

          {shipment.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Observaciones</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{shipment.notes}</p>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
              <div className="space-y-3">
                {timeline.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 ${step.color}`}>
                      <step.icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{step.label}</p>
                      {step.date && <p className="text-xs text-gray-400">{step.date}</p>}
                    </div>
                    {i < timeline.length - 1 && (
                      <ArrowRight size={14} className="text-gray-300 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reposición Rápida ─────────────────────────────

function ReposicionRapida({ locals }) {
  const [localA, setLocalA] = useState("");
  const [localB, setLocalB] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [soloDiferencias, setSoloDiferencias] = useState(true);

  const enabled = !!localA && !!localB && localA !== localB;

  const { data: stockData, isLoading, isFetching } = useQuery({
    queryKey: ["stock-reposicion", brandFilter, searchFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "500" });
      if (brandFilter) params.set("brand", brandFilter);
      if (searchFilter) params.set("search", searchFilter);
      return api.get(`/stock/by-locals?${params}`);
    },
    enabled,
    staleTime: 60000,
  });

  const localAName = locals.find(l => String(l.id) === localA)?.name ?? "Local A";
  const localBName = locals.find(l => String(l.id) === localB)?.name ?? "Local B";

  const rows = useMemo(() => {
    if (!stockData?.items || !enabled) return [];
    return stockData.items
      .map(item => {
        const stockA = item.stock_by_local?.[localA] ?? 0;
        const stockB = item.stock_by_local?.[localB] ?? 0;
        const diff = stockA - stockB;
        return { ...item, stockA, stockB, diff };
      })
      .filter(item => {
        if (soloDiferencias) return item.diff !== 0 && (item.stockA > 0 || item.stockB > 0);
        return item.stockA > 0 || item.stockB > 0;
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [stockData, localA, localB, soloDiferencias, enabled]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-700">Comparar stock entre locales</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Local A */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Building2 size={12} /> Local A (origen)
            </label>
            <select
              value={localA}
              onChange={e => setLocalA(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar…</option>
              {locals.map(l => (
                <option key={l.id} value={String(l.id)} disabled={String(l.id) === localB}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Local B */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Building2 size={12} /> Local B (destino)
            </label>
            <select
              value={localB}
              onChange={e => setLocalB(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar…</option>
              {locals.map(l => (
                <option key={l.id} value={String(l.id)} disabled={String(l.id) === localA}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Marca / Proveedor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marca / Proveedor</label>
            <input
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              placeholder="Ej: Columbia, Nike…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buscar */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar producto / SKU</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Nombre, SKU…"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Toggle solo diferencias */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setSoloDiferencias(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${soloDiferencias ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${soloDiferencias ? "translate-x-4.5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-xs text-gray-600">Solo mostrar productos con diferencias de stock</span>
        </div>
      </div>

      {/* Resultado */}
      {!enabled ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <ArrowLeftRight size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Seleccioná dos locales distintos para comparar el stock</p>
        </div>
      ) : isLoading || isFetching ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm">Cargando stock...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Package size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay productos con stock en los locales seleccionados</p>
          {soloDiferencias && (
            <button
              onClick={() => setSoloDiferencias(false)}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Mostrar todos los productos
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {rows.length} producto{rows.length !== 1 ? "s" : ""}
              {soloDiferencias ? " con diferencias" : " con stock"}
            </span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                A tiene más
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                B tiene más
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Marca</th>
                  <th className="px-4 py-3 text-left">Talle/Color</th>
                  <th className="px-4 py-3 text-center">{localAName}</th>
                  <th className="px-4 py-3 text-center">{localBName}</th>
                  <th className="px-4 py-3 text-center">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(item => {
                  const diffAbs = Math.abs(item.diff);
                  const diffColor = item.diff > 0
                    ? "text-green-700 bg-green-50"
                    : item.diff < 0
                    ? "text-amber-700 bg-amber-50"
                    : "text-gray-400";
                  return (
                    <tr key={item.variant_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={item.product_name}>
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{item.brand || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {[item.size, item.color].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.stockA}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.stockB}</td>
                      <td className="px-4 py-3 text-center">
                        {item.diff !== 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${diffColor}`}>
                            {item.diff > 0 ? "+" : ""}{item.diff}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">igual</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}