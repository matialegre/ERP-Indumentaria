import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Eye, Link2, CheckCircle, ChevronDown,
  X, FileText, Package, ClipboardList, RefreshCw, Trash2,
  GitCompare, Upload, FileSpreadsheet, DollarSign, Download,
} from "lucide-react";
import { api } from "../lib/api";
import { exportCSV, exportExcel } from "../lib/exportUtils";
import ComparadorCruzado from "../components/ComparadorCruzado";
import CargaMasiva from "../components/CargaMasiva";
import ExcelConPreciosViewer from "../components/ExcelConPreciosViewer";
import ComparadorPreciosViewer from "../components/ComparadorPreciosViewer";
import ComparadorListaFacturas from "../components/ComparadorListaFacturas";
import PdfViewer from "../components/PdfViewer";

// ─── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDIENTE:     { label: "Pendiente",      color: "bg-gray-100 text-gray-700",    dot: "bg-gray-400",   border: "border-l-gray-400"   },
  VERDE:         { label: "Completo",       color: "bg-green-100 text-green-700",  dot: "bg-green-500",  border: "border-l-green-500"  },
  ROJO:          { label: "Sin RV",         color: "bg-red-100 text-red-700",      dot: "bg-red-500",    border: "border-l-red-500"    },
  ALERTA_REPO:   { label: "Alerta Repo",    color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500",  border: "border-l-amber-500"  },
  ANULADO:       { label: "Anulado",        color: "bg-slate-100 text-slate-500",  dot: "bg-slate-300",  border: "border-l-slate-300"  },
  // Alert states from purchase orders (for cross-display)
  OK:            { label: "OK",             color: "bg-green-100 text-green-700",  dot: "bg-green-500",  border: "border-l-green-500"  },
  ANP:           { label: "ANP",            color: "bg-purple-100 text-purple-700",dot: "bg-purple-500", border: "border-l-purple-500" },
  SIN_RV:        { label: "Sin RV",         color: "bg-red-100 text-red-700",      dot: "bg-red-500",    border: "border-l-red-500"    },
  INCOMPLETO:    { label: "Incompleto",     color: "bg-orange-100 text-orange-700",dot: "bg-orange-500", border: "border-l-orange-500" },
  SOLO_FALTA_REM:{ label: "Falta Remito",   color: "bg-yellow-100 text-yellow-700",dot: "bg-yellow-500", border: "border-l-yellow-500" },
  SOLO_FALTA_FAC:{ label: "Falta Factura",  color: "bg-yellow-100 text-yellow-700",dot: "bg-yellow-500", border: "border-l-yellow-500" },
  SIN_NADA:      { label: "Sin docs",       color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400",   border: "border-l-gray-300"   },
};

const INGRESO_STATUS = {
  PENDIENTE: { label: "No recibido",  color: "text-red-600" },
  PARCIAL:   { label: "Parcial",      color: "text-amber-600" },
  COMPLETO:  { label: "Recibido ✓",  color: "text-green-600" },
  NO:        { label: "No aplica",    color: "text-gray-400" },
};

const DOC_TYPE = {
  FACTURA:        { label: "FACTURA",  icon: "📄" },
  REMITO:         { label: "REMITO",   icon: "📦" },
  REMITO_FACTURA: { label: "REM+FAC", icon: "📋" },
};

const TABS = [
  { id: "todos",     label: "Todos",      emoji: null },
  { id: "ROJO",      label: "Falta RV",   emoji: "🔴" },
  { id: "ALERTA_REPO", label: "Alerta",   emoji: "🟡" },
  { id: "PENDIENTE", label: "Pendiente",  emoji: null },
  { id: "VERDE",     label: "Completo",   emoji: "🟢" },
];

const EMPTY_FORM = {
  purchase_order_id: "",
  type: "FACTURA",
  number: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  remito_venta_number: "",
  local_id: "",
  observations: "",
  local_obs: "",
  compras_obs: "",
  items: [],
};

const EMPTY_ITEM = { code: "", description: "", size: "", color: "", qty_invoiced: 1 };

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR");
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDIENTE;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Confirm Ingreso Modal ────────────────────────────────────────────────────

function ConfirmIngresoModal({ invoice, onClose }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantities, setQuantities] = useState(
    () => Object.fromEntries((invoice.items ?? []).map((it) => [it.id, it.qty_invoiced ?? 0]))
  );

  const mut = useMutation({
    mutationFn: (payload) => api.post(`/purchase-invoices/${invoice.id}/confirm-ingreso`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mut.mutate({
      date,
      items: (invoice.items ?? []).map((it) => ({
        id: it.id,
        qty_received: Number(quantities[it.id] ?? 0),
      })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-green-600 to-green-800 px-5 py-3 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Confirmar Ingreso al Depósito
            </h3>
            <p className="text-green-200 text-xs mt-0.5">
              {invoice.number || "Sin número"} — {invoice.provider_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de recepción</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm w-full" required />
          </div>

          {(invoice.items ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Cantidades recibidas</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Descripción</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Facturado</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Recibido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(invoice.items ?? []).map((it) => (
                      <tr key={it.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800">{it.description || it.code || "—"}</p>
                          {(it.size || it.color) && (
                            <p className="text-gray-400">{[it.size, it.color].filter(Boolean).join(" / ")}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{it.qty_invoiced}</td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={it.qty_invoiced}
                            value={quantities[it.id] ?? 0}
                            onChange={(e) => setQuantities((q) => ({ ...q, [it.id]: e.target.value }))}
                            className="w-16 border rounded px-2 py-0.5 text-center text-sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>

        <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={mut.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? "Guardando..." : "Confirmar Recepción"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ invoiceId, onClose }) {
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["purchase-invoice", invoiceId],
    queryFn: () => api.get(`/purchase-invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });

  if (isLoading || !invoice) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-sm text-gray-500">Cargando...</div>
      </div>
    );
  }

  const docType = DOC_TYPE[invoice.type] ?? DOC_TYPE.FACTURA;
  const ingreso = INGRESO_STATUS[invoice.ingreso_status] ?? INGRESO_STATUS.PENDIENTE;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-5 py-3 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {docType.icon} {invoice.number || <span className="italic opacity-60">Sin número</span>}
            </h3>
            <p className="text-slate-300 text-xs mt-0.5">{invoice.provider_name} · {fmtDate(invoice.date)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Tipo</p><p className="font-medium">{docType.label}</p></div>
            <div><p className="text-xs text-gray-400">Estado</p><StatusBadge status={invoice.status} /></div>
            <div><p className="text-xs text-gray-400">Recepción</p><p className={`font-medium text-xs ${ingreso.color}`}>{ingreso.label}</p></div>
            <div><p className="text-xs text-gray-400">Importe</p><p className="font-semibold text-gray-900">{fmt(invoice.amount)}</p></div>
            <div><p className="text-xs text-gray-400">Nota de Pedido</p><p className="font-medium">{invoice.purchase_order_number ?? "—"}</p></div>
            <div><p className="text-xs text-gray-400">Remito Venta</p>
              {invoice.remito_venta_number
                ? <p className="font-semibold text-blue-700">RV: {invoice.remito_venta_number}</p>
                : <p className="text-gray-400 text-xs">No vinculado</p>}
            </div>
          </div>

          {(invoice.items ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ítems</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Código</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Descripción</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Talle</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Color</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Fact.</th>
                      <th className="px-3 py-2 text-center text-gray-500 font-medium">Recib.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(invoice.items ?? []).map((it, i) => (
                      <tr key={it.id ?? i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 font-mono">{it.code || "—"}</td>
                        <td className="px-3 py-2 text-gray-800">{it.description || "—"}</td>
                        <td className="px-3 py-2 text-center">{it.size || "—"}</td>
                        <td className="px-3 py-2 text-center">{it.color || "—"}</td>
                        <td className="px-3 py-2 text-center font-medium">{it.qty_invoiced}</td>
                        <td className="px-3 py-2 text-center">
                          {it.qty_received != null
                            ? <span className={it.qty_received >= it.qty_invoiced ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>{it.qty_received}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);

  const { data: ordersData = [] } = useQuery({
    queryKey: ["purchase-orders-list"],
    queryFn: () => api.get("/pedidos/?limit=200"),
    select: (d) => d?.items ?? d ?? [],
  });

  const mut = useMutation({
    mutationFn: (payload) => api.post("/purchase-invoices/", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      onClose();
    },
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const setItem = (i, k, v) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const handleSubmit = (e) => {
    e.preventDefault();
    mut.mutate({
      ...form,
      purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
      local_id: form.local_id ? Number(form.local_id) : null,
      amount: form.amount ? Number(form.amount) : null,
      items: items.map((it) => ({ ...it, qty_invoiced: Number(it.qty_invoiced) })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-3 text-white flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Nueva Factura / Remito</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota de Pedido (opcional)</label>
              <select value={form.purchase_order_id} onChange={(e) => set("purchase_order_id", e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">Sin vincular</option>
                {ordersData.map((o) => (
                  <option key={o.id} value={o.id}>#{o.number} — {o.provider_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                {Object.entries(DOC_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
              <input value={form.number} onChange={(e) => set("number", e.target.value)}
                placeholder="Ej: 0001-00012345"
                className="w-full border rounded-lg px-3 py-1.5 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm" required />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Importe</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="w-full border rounded-lg px-3 py-1.5 text-sm" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Número Remito de Venta (RV)</label>
              <input value={form.remito_venta_number} onChange={(e) => set("remito_venta_number", e.target.value)}
                placeholder="Ej: RV-00045"
                className="w-full border rounded-lg px-3 py-1.5 text-sm" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones Locales</label>
              <textarea
                value={form.local_obs || ""}
                onChange={e => setForm(f => ({ ...f, local_obs: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                placeholder="Observaciones para locales..."
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones Compras</label>
              <textarea
                value={form.compras_obs || ""}
                onChange={e => setForm(f => ({ ...f, compras_obs: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                placeholder="Observaciones internas de compras..."
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-600">Ítems</p>
              <button type="button" onClick={addItem}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus className="h-3 w-3" /> Agregar ítem
              </button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-6 gap-1.5 mb-1.5 items-center">
                <input placeholder="Código" value={it.code} onChange={(e) => setItem(i, "code", e.target.value)}
                  className="border rounded px-2 py-1 text-xs" />
                <input placeholder="Descripción" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)}
                  className="col-span-2 border rounded px-2 py-1 text-xs" />
                <input placeholder="Talle" value={it.size} onChange={(e) => setItem(i, "size", e.target.value)}
                  className="border rounded px-2 py-1 text-xs" />
                <input type="number" min={1} value={it.qty_invoiced} onChange={(e) => setItem(i, "qty_invoiced", e.target.value)}
                  className="border rounded px-2 py-1 text-xs text-center" />
                <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 flex justify-center">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {mut.isError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              Error al guardar. Verificá los datos.
            </p>
          )}
        </form>

        <div className="px-5 py-3 bg-gray-50 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={mut.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
            {mut.isPending ? "Guardando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────

function InvoiceCard({ inv, onView, onConfirmIngreso, onAutoLink, onChangeStatus, onDelete, onViewPdf, onComparePrices, onComparadorCruzado, onExcelPrecios, onSaveRv }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [rvEditing, setRvEditing] = useState(false);
  const [rvInput, setRvInput] = useState("");
  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.PENDIENTE;
  const ingreso = INGRESO_STATUS[inv.ingreso_status] ?? INGRESO_STATUS.PENDIENTE;
  const docType = DOC_TYPE[inv.type] ?? DOC_TYPE.FACTURA;

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${cfg.border} rounded-lg shadow-sm hover:shadow-md transition-shadow`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{docType.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {docType.label}
                </span>
                {inv.number
                  ? <span className="text-sm font-semibold text-gray-900">{inv.number}</span>
                  : <span className="text-sm italic text-gray-400">Sin número</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{inv.provider_name ?? "—"}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-900">{fmt(inv.amount)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.date)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {inv.purchase_order_number && (
            <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
              NP: {inv.purchase_order_number}
            </span>
          )}
          {inv.remito_venta_number && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
              RV: {inv.remito_venta_number}
            </span>
          )}
          <StatusBadge status={inv.status} />
          <span className={`text-xs font-medium ${ingreso.color}`}>{ingreso.label}</span>
        </div>

        {(inv.local_obs || inv.compras_obs) && (
          <div className="mt-1.5 space-y-0.5">
            {inv.local_obs && (
              <p className="text-xs text-blue-600"><span className="font-medium">Local:</span> {inv.local_obs}</p>
            )}
            {inv.compras_obs && (
              <p className="text-xs text-orange-600"><span className="font-medium">Compras:</span> {inv.compras_obs}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mt-2.5 flex-wrap">
          <button onClick={() => onView(inv.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
            <Eye className="h-3 w-3" /> Ver
          </button>

          {inv.ingreso_status !== "COMPLETO" && inv.ingreso_status !== "NO" && (
            <button onClick={() => onConfirmIngreso(inv)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors">
              <CheckCircle className="h-3 w-3" /> Confirmar
            </button>
          )}

          {!inv.remito_venta_number && (
            rvEditing ? (
              <div className="flex items-center gap-1">
                <input
                  value={rvInput}
                  onChange={e => setRvInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && rvInput.trim()) { onSaveRv(inv.id, rvInput); setRvEditing(false); setRvInput(""); }
                    if (e.key === "Escape") { setRvEditing(false); setRvInput(""); }
                  }}
                  placeholder="RV-00045"
                  className="border rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:border-blue-400"
                  autoFocus
                />
                <button
                  onClick={() => { if (rvInput.trim()) { onSaveRv(inv.id, rvInput); setRvEditing(false); setRvInput(""); } }}
                  disabled={!rvInput.trim()}
                  className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  OK
                </button>
                <button onClick={() => { setRvEditing(false); setRvInput(""); }} className="text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => setRvEditing(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                <Link2 className="h-3 w-3" /> Ingresar RV
              </button>
            )
          )}

          {/* Status dropdown */}
          <div className="relative">
            <button onClick={() => setStatusOpen((o) => !o)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${cfg.color} hover:opacity-80`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {statusOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[130px]">
                {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "ANULADO").map(([k, v]) => (
                  <button key={k} onClick={() => { onChangeStatus(inv.id, k); setStatusOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${inv.status === k ? "font-bold" : ""}`}>
                    <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {inv.pdf_file && (
            <button onClick={() => onViewPdf(inv)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-50 text-slate-700 rounded hover:bg-slate-100 transition-colors"
              title="Ver PDF">
              <FileText className="h-3 w-3" />
            </button>
          )}

          <button onClick={() => onComparePrices(inv)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors"
            title="Comparar precios">
            <DollarSign className="h-3 w-3" />
          </button>

          {inv.purchase_order_id && (
            <button onClick={() => onComparadorCruzado(inv.purchase_order_id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
              title="Cruce de docs">
              <GitCompare className="h-3 w-3" />
            </button>
          )}

          {inv.purchase_order_id && (
            <button onClick={() => onExcelPrecios(inv.purchase_order_id)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
              title="Excel c/Precios">
              <FileSpreadsheet className="h-3 w-3" />
            </button>
          )}

          <button onClick={() => { if (confirm("¿Eliminar este documento?")) onDelete(inv.id); }}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacturasProveedorPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [confirmIngresoInv, setConfirmIngresoInv] = useState(null);
  const [linkRvId, setLinkRvId] = useState(null);
  const [linkRvNumber, setLinkRvNumber] = useState("");
  const [cargaMasivaOpen, setCargaMasivaOpen] = useState(false);
  const [comparadorListaOpen, setComparadorListaOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [pdfViewer, setPdfViewer] = useState(null);
  const [comparadorPreciosOpen, setComparadorPreciosOpen] = useState(null);
  const [comparadorCruzadoPoId, setComparadorCruzadoPoId] = useState(null);
  const [excelPreciosPoId, setExcelPreciosPoId] = useState(null);

  const { data: invoicesData = [], isLoading, refetch } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => api.get("/purchase-invoices/"),
    select: (d) => d?.items ?? d ?? [],
    refetchInterval: 30000,
  });

  const changeStatusMut = useMutation({
    mutationFn: ({ id, status }) => api.post(`/purchase-invoices/${id}/set-status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-invoices"] }),
  });

  const autoLinkMut = useMutation({
    mutationFn: ({ id, remito_venta_number }) =>
      api.post(`/purchase-invoices/${id}/auto-link`, { remito_venta_number }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
      setLinkRvId(null);
      setLinkRvNumber("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/purchase-invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-invoices"] }),
  });

  const filtered = useMemo(() => {
    let items = invoicesData;
    if (activeTab !== "todos") items = items.filter((inv) => inv.status === activeTab);
    if (tipoFilter !== "todos") items = items.filter((inv) => inv.type === tipoFilter);
    if (providerFilter) items = items.filter((inv) => String(inv.provider_id) === providerFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((inv) =>
        inv.number?.toLowerCase().includes(q) ||
        inv.provider_name?.toLowerCase().includes(q) ||
        inv.purchase_order_number?.toLowerCase().includes(q) ||
        inv.remito_venta_number?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [invoicesData, activeTab, tipoFilter, providerFilter, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { todos: invoicesData.length };
    for (const inv of invoicesData) {
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return counts;
  }, [invoicesData]);

  const uniqueProviders = useMemo(() => {
    const map = new Map();
    for (const inv of invoicesData) {
      if (inv.provider_id != null && inv.provider_name) map.set(inv.provider_id, inv.provider_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [invoicesData]);

  const selectedProviderName = uniqueProviders.find((p) => String(p.id) === providerFilter)?.name ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              Facturas / Remitos de Proveedor
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Control semafórico de documentos de compra</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => exportCSV(filtered, `facturas-proveedor-${new Date().toISOString().slice(0,10)}`, [
                {key: 'number', label: 'Número'},
                {key: 'type', label: 'Tipo'},
                {key: 'provider_name', label: 'Proveedor'},
                {key: 'date', label: 'Fecha'},
                {key: 'amount', label: 'Monto'},
                {key: 'status', label: 'Estado'},
                {key: 'remito_venta_number', label: 'RV'},
              ])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => exportExcel(filtered, `facturas-proveedor-${new Date().toISOString().slice(0,10)}`, [
                {key: 'number', label: 'Número'},
                {key: 'type', label: 'Tipo'},
                {key: 'provider_name', label: 'Proveedor'},
                {key: 'date', label: 'Fecha'},
                {key: 'amount', label: 'Monto'},
                {key: 'status', label: 'Estado'},
                {key: 'remito_venta_number', label: 'RV'},
              ])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={() => setCargaMasivaOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors font-medium border border-purple-200">
              <Upload className="h-3.5 w-3.5" /> Carga Masiva
            </button>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700">
              <option value="">— Proveedor —</option>
              {uniqueProviders.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => setComparadorListaOpen(true)}
              disabled={!providerFilter}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors font-medium border border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed">
              <GitCompare className="h-3.5 w-3.5" /> Comparador Lista
            </button>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <Plus className="h-3.5 w-3.5" /> Nuevo documento
            </button>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {tab.emoji && <span className="mr-1">{tab.emoji}</span>}
                {tab.label}
                {tabCounts[tab.id] > 0 && (
                  <span className={`ml-1 ${activeTab === tab.id ? "text-blue-200" : "text-gray-400"}`}>
                    ({tabCounts[tab.id] ?? 0})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar número, proveedor, RV..."
              className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs bg-white" />
          </div>
        </div>

        {/* Tipo doc filter */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Tipo:</span>
          {[
            ["todos", "Todos los tipos"],
            ["FACTURA", "📄 Factura"],
            ["REMITO", "📦 Remito"],
            ["REMITO_FACTURA", "📋 Rem+Fac"],
          ].map(([val, label]) => (
            <button key={val} onClick={() => setTipoFilter(val)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium border transition-colors ${
                tipoFilter === val ? "bg-slate-700 text-white border-slate-800" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}>
              {label}
            </button>
          ))}
          {(tipoFilter !== "todos" || providerFilter) && (
            <button onClick={() => { setTipoFilter("todos"); setProviderFilter(""); }}
              className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200">
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Cargando documentos...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No hay documentos{search ? " que coincidan" : " en esta sección"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((inv) => (
              <InvoiceCard
                key={inv.id}
                inv={inv}
                onView={(id) => setDetailId(id)}
                onConfirmIngreso={(inv) => setConfirmIngresoInv(inv)}
                onAutoLink={(id) => { setLinkRvId(id); setLinkRvNumber(""); }}
                onChangeStatus={(id, status) => changeStatusMut.mutate({ id, status })}
                onDelete={(id) => deleteMut.mutate(id)}
                onViewPdf={(inv) => setPdfViewer(inv)}
                onComparePrices={(inv) => setComparadorPreciosOpen(inv)}
                onComparadorCruzado={(poId) => setComparadorCruzadoPoId(poId)}
                onExcelPrecios={(poId) => setExcelPreciosPoId(poId)}
                onSaveRv={(id, rv) => autoLinkMut.mutate({ id, remito_venta_number: rv })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="px-6 py-3 bg-white border-t border-gray-200">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <span className="text-gray-500 font-medium">{filtered.length} documento{filtered.length !== 1 ? "s" : ""}</span>
            <span className="text-gray-700">
              Monto total: <strong>{fmt(filtered.reduce((s, inv) => s + (Number(inv.amount) || 0), 0))}</strong>
            </span>
            <span className="text-gray-700">
              Sin RV: <strong className="text-red-600">{filtered.filter(inv => !inv.remito_venta_number).length}</strong>
            </span>
            <span className="text-gray-700">
              Completos: <strong className="text-green-600">{filtered.filter(inv => inv.status === "VERDE").length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Semaphore legend */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
          <span className="font-medium">Semáforo:</span>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
              {v.label}
            </span>
          ))}
        </div>
      </div>

      {/* Link RV mini-modal */}
      {linkRvId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-600" /> Vincular Remito de Venta
            </h3>
            <input value={linkRvNumber} onChange={(e) => setLinkRvNumber(e.target.value)}
              placeholder="Número de RV (Ej: RV-00045)"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => setLinkRvId(null)}
                className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button
                onClick={() => autoLinkMut.mutate({ id: linkRvId, remito_venta_number: linkRvNumber })}
                disabled={!linkRvNumber.trim() || autoLinkMut.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {autoLinkMut.isPending ? "Vinculando..." : "Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
      {detailId && <DetailModal invoiceId={detailId} onClose={() => setDetailId(null)} />}
      {confirmIngresoInv && (
        <ConfirmIngresoModal invoice={confirmIngresoInv} onClose={() => setConfirmIngresoInv(null)} />
      )}
      {cargaMasivaOpen && (
        <CargaMasiva
          onClose={() => setCargaMasivaOpen(false)}
          onSuccess={() => { setCargaMasivaOpen(false); qc.invalidateQueries({ queryKey: ["purchase-invoices"] }); }}
        />
      )}
      {comparadorListaOpen && providerFilter && (
        <ComparadorListaFacturas
          providerId={Number(providerFilter)}
          providerName={selectedProviderName}
          onClose={() => setComparadorListaOpen(false)}
        />
      )}
      {pdfViewer && (
        <PdfViewer
          url={`${window.location.protocol}//${window.location.hostname}:8000/api/v1/purchase-invoices/${pdfViewer.id}/pdf`}
          filename={pdfViewer.number || "factura"}
          onClose={() => setPdfViewer(null)}
        />
      )}
      {comparadorPreciosOpen && (
        <ComparadorPreciosViewer
          invoiceId={comparadorPreciosOpen.id}
          purchaseOrderId={comparadorPreciosOpen.purchase_order_id}
          onClose={() => setComparadorPreciosOpen(null)}
        />
      )}
      {comparadorCruzadoPoId && (
        <ComparadorCruzado
          purchaseOrderId={comparadorCruzadoPoId}
          onClose={() => setComparadorCruzadoPoId(null)}
        />
      )}
      {excelPreciosPoId && (
        <ExcelConPreciosViewer
          purchaseOrderId={excelPreciosPoId}
          onClose={() => setExcelPreciosPoId(null)}
        />
      )}
    </div>
  );
}
