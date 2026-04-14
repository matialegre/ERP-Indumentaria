import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { api } from "../lib/api";

const STATUS_CONFIG = {
  OK: {
    label: "OK",
    icon: <CheckCircle size={14} className="inline mr-1" />,
    rowClass: "bg-green-50",
    badgeClass: "bg-green-100 text-green-800 border border-green-300",
  },
  CON_DIFERENCIA: {
    label: "Con Diferencia",
    icon: <AlertTriangle size={14} className="inline mr-1" />,
    rowClass: "bg-red-50",
    badgeClass: "bg-red-100 text-red-800 border border-red-300",
  },
  SIN_RECEPCION: {
    label: "Sin Recepción",
    icon: <XCircle size={14} className="inline mr-1" />,
    rowClass: "bg-yellow-50",
    badgeClass: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  },
};

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "OK", label: "OK ✓" },
  { key: "CON_DIFERENCIA", label: "Con Diferencia ⚠" },
  { key: "SIN_RECEPCION", label: "Sin Recepción" },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {};
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cfg.badgeClass || "bg-gray-100 text-gray-700"}`}>
      {cfg.icon}
      {cfg.label || status}
    </span>
  );
}

function ItemRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] || {};

  return (
    <>
      <tr className={`border-b border-gray-200 hover:brightness-95 transition-all ${cfg.rowClass || ""}`}>
        <td className="px-3 py-2 text-center">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-gray-700"
            title="Ver facturas"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">
          {item.code || <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2 text-sm text-gray-700 max-w-[200px] truncate" title={item.description}>
          {item.description || <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2 text-center text-sm text-gray-700">
          {item.size || <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2 text-center text-sm text-gray-700">
          {item.color || <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2 text-center font-semibold text-sm text-gray-900">
          {item.total_invoiced}
        </td>
        <td className="px-3 py-2 text-center font-semibold text-sm text-gray-900">
          {item.total_received}
        </td>
        <td className="px-3 py-2 text-right text-sm text-gray-700 whitespace-nowrap">
          {item.unit_price != null
            ? `$${item.unit_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
            : <span className="text-gray-400 italic">—</span>}
        </td>
        <td className="px-3 py-2 text-center">
          <StatusBadge status={item.status} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white border-b border-gray-100">
          <td colSpan={9} className="px-8 py-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <FileText size={12} className="text-gray-400 shrink-0" />
              <span className="font-medium text-gray-500">Facturas/Remitos:</span>
              <div className="flex flex-wrap gap-1">
                {item.invoice_numbers.length > 0
                  ? item.invoice_numbers.map((n) => (
                      <span key={n} className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono text-blue-800">
                        {n}
                      </span>
                    ))
                  : <span className="text-gray-400 italic">Sin comprobantes</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ComparadorCruzado({ purchaseOrderId, onClose }) {
  const [activeTab, setActiveTab] = useState("TODOS");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cruce-documentos", purchaseOrderId],
    queryFn: () => api.get(`/purchase-invoices/cruce?purchase_order_id=${purchaseOrderId}`),
    enabled: !!purchaseOrderId,
    staleTime: 30_000,
  });

  const filteredItems =
    !data?.items
      ? []
      : activeTab === "TODOS"
      ? data.items
      : data.items.filter((i) => i.status === activeTab);

  const summary = data?.summary || {};

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="text-blue-600" size={20} />
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              Cruce de Documentos
              {data?.purchase_order_number && (
                <span className="ml-2 text-blue-700">— {data.purchase_order_number}</span>
              )}
            </h2>
            {data?.provider_name && (
              <p className="text-sm text-gray-500 mt-0.5">Proveedor: <span className="font-medium text-gray-700">{data.provider_name}</span></p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
          title="Cerrar"
        >
          <X size={20} />
        </button>
      </div>

      {/* ── Loading / Error ── */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Analizando documentos…</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600">
            <XCircle size={40} className="mx-auto mb-3 opacity-60" />
            <p className="font-semibold">Error al cargar el cruce</p>
            <p className="text-sm text-gray-500 mt-1">{error?.message || "Error desconocido"}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── Summary bar ── */}
          <div className="px-6 py-3 border-b border-gray-200 bg-white shrink-0">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Total artículos:</span>
                <span className="font-bold text-gray-900">{summary.total_items ?? 0}</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-gray-500">OK:</span>
                <span className="font-bold text-green-700">{summary.items_ok ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-gray-500">Con diferencia:</span>
                <span className="font-bold text-red-700">{summary.items_con_diferencia ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <XCircle size={14} className="text-yellow-500" />
                <span className="text-gray-500">Sin recepción:</span>
                <span className="font-bold text-yellow-700">{summary.items_sin_recepcion ?? 0}</span>
              </div>
              <div className="w-px h-4 bg-gray-300" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Uds. facturadas:</span>
                <span className="font-bold text-gray-900">{summary.total_invoiced ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Uds. recibidas:</span>
                <span className="font-bold text-gray-900">{summary.total_received ?? 0}</span>
              </div>
            </div>
          </div>

          {/* ── Invoices pills ── */}
          {data.invoices?.length > 0 && (
            <div className="px-6 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-medium mr-1">Comprobantes:</span>
              {data.invoices.map((inv) => (
                <span
                  key={inv.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 rounded-full text-xs text-gray-700 shadow-sm"
                >
                  <span className="text-gray-400">{inv.type}</span>
                  <span className="font-mono font-semibold">{inv.number || `#${inv.id}`}</span>
                  {inv.amount != null && (
                    <span className="text-green-700 font-medium">
                      ${inv.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="px-6 pt-3 border-b border-gray-200 bg-white shrink-0 flex gap-1">
            {TABS.map((tab) => {
              const count =
                tab.key === "TODOS"
                  ? data.items?.length ?? 0
                  : data.items?.filter((i) => i.status === tab.key).length ?? 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-700 bg-blue-50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                    activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Table ── */}
          <div className="flex-1 overflow-auto">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No hay artículos en esta categoría
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Código</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Descripción</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Talle</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Color</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Facturado</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Recibido</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Precio Unit.</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <ItemRow key={`${item.code}-${item.size}-${item.color}-${idx}`} item={item} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
