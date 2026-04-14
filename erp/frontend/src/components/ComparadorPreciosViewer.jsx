/**
 * ComparadorPreciosViewer
 * Props: { invoiceId, purchaseOrderId, onClose }
 *
 * Modal que muestra una factura individual comparada contra su lista de precios.
 * Permite seleccionar o subir una lista de precios alternativa para el proveedor.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  X,
  Loader2,
  AlertCircle,
  Upload,
  ChevronDown,
  BarChart2,
  CheckCircle,
  XCircle,
  MinusCircle,
  HelpCircle,
} from "lucide-react";
import { api } from "../lib/api";

/* ─── helpers ─────────────────────────────────────── */
const fmt = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

const pct = (base, cmp) => {
  if (base == null || cmp == null || base === 0) return null;
  return (((cmp - base) / base) * 100).toFixed(1);
};

const STATUS = {
  IGUAL:     { label: "IGUAL",      cls: "bg-gray-100 text-gray-600",   icon: <MinusCircle size={12} className="inline mr-0.5" /> },
  MAYOR:     { label: "MAYOR",      cls: "bg-red-100 text-red-700",     icon: <XCircle      size={12} className="inline mr-0.5" /> },
  MENOR:     { label: "MENOR",      cls: "bg-green-100 text-green-700", icon: <CheckCircle  size={12} className="inline mr-0.5" /> },
  SIN_LISTA: { label: "SIN LISTA",  cls: "bg-gray-50 text-gray-400",    icon: <HelpCircle   size={12} className="inline mr-0.5" /> },
};

function getStatus(unitPrice, listPrice) {
  if (listPrice == null) return "SIN_LISTA";
  if (unitPrice > listPrice) return "MAYOR";
  if (unitPrice < listPrice) return "MENOR";
  return "IGUAL";
}

function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.SIN_LISTA;
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

/* ─── main component ──────────────────────────────── */
export default function ComparadorPreciosViewer({ invoiceId, purchaseOrderId, onClose }) {
  const [selectedListId, setSelectedListId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadSeason, setUploadSeason] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadError, setUploadError] = useState(null);

  /* fetch invoice */
  const {
    data: invoice,
    isLoading: loadingInvoice,
    error: invoiceError,
  } = useQuery({
    queryKey: ["purchase-invoice", invoiceId],
    queryFn: () => api.get(`/purchase-invoices/${invoiceId}`),
    enabled: !!invoiceId,
  });

  const providerId = invoice?.provider_id ?? null;

  /* fetch price lists for provider */
  const { data: priceLists = [] } = useQuery({
    queryKey: ["price-lists", providerId],
    queryFn: () => api.get(`/price-lists/?provider_id=${providerId}&limit=100`),
    enabled: !!providerId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* fetch selected price list items */
  const { data: listItems = [], isFetching: fetchingList } = useQuery({
    queryKey: ["price-list-items", selectedListId],
    queryFn: () => api.get(`/price-lists/${selectedListId}/items?limit=2000`),
    enabled: !!selectedListId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* upload mutation */
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("provider_id", providerId);
      fd.append("file", uploadFile);
      if (uploadSeason) fd.append("season", uploadSeason);
      if (uploadNotes) fd.append("notes", uploadNotes);
      return api.postForm("/price-lists/upload-excel", fd);
    },
    onSuccess: (data) => {
      setSelectedListId(String(data.id));
      setShowUpload(false);
      setUploadFile(null);
      setUploadError(null);
    },
    onError: (e) => setUploadError(e.message),
  });

  /* build code → price map */
  const priceListMap = useMemo(() => {
    const m = new Map();
    // From selected price list items
    listItems.forEach((it) => {
      if (it.code) m.set(String(it.code).trim(), { price: it.price ?? it.cost ?? null, desc: it.description });
    });
    return m;
  }, [listItems]);

  /* enriched items */
  const items = useMemo(() => {
    if (!invoice?.items) return [];
    return invoice.items.map((it) => {
      const fromList = priceListMap.get(String(it.code ?? "").trim());
      const lp = it.list_price ?? fromList?.price ?? null;
      const status = getStatus(it.unit_price, lp);
      const variation = pct(lp, it.unit_price);
      return { ...it, resolvedListPrice: lp, status, variation };
    });
  }, [invoice, priceListMap]);

  /* summary totals */
  const totals = useMemo(() => {
    let invoiced = 0, list = 0, count = 0, countWithList = 0;
    items.forEach((it) => {
      const qty = it.quantity_invoiced ?? 1;
      invoiced += (it.unit_price ?? 0) * qty;
      count++;
      if (it.resolvedListPrice != null) {
        list += it.resolvedListPrice * qty;
        countWithList++;
      }
    });
    const diff = countWithList > 0 ? invoiced - list : null;
    const overallPct = list > 0 ? pct(list, invoiced) : null;
    return { invoiced, list, diff, overallPct, count, countWithList };
  }, [items]);

  /* ── loading / error states ─────────────────────── */
  if (loadingInvoice) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3 shadow-2xl">
          <Loader2 size={22} className="animate-spin text-blue-600" />
          <span className="text-gray-700">Cargando factura…</span>
        </div>
      </div>
    );
  }

  if (invoiceError || !invoice) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 text-red-600 mb-3">
            <AlertCircle size={20} />
            <h3 className="font-semibold">Error al cargar</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">{invoiceError?.message ?? "No se pudo cargar la factura."}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Cerrar</button>
        </div>
      </div>
    );
  }

  const statusCounts = items.reduce((acc, it) => { acc[it.status] = (acc[it.status] ?? 0) + 1; return acc; }, {});

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-900">Comparador de Precios</h2>
              <p className="text-xs text-gray-400">
                Factura #{invoice.invoice_number ?? invoice.id}
                {invoice.provider_name ? ` · ${invoice.provider_name}` : ""}
                {invoice.invoice_date ? ` · ${invoice.invoice_date}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b flex-shrink-0 divide-x">
          <div className="px-5 py-3">
            <p className="text-xs text-gray-500">Total facturado</p>
            <p className="font-bold text-gray-900 text-base">{fmt(totals.invoiced)}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-gray-500">Total lista</p>
            <p className="font-bold text-gray-700 text-base">{totals.countWithList > 0 ? fmt(totals.list) : "—"}</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-gray-500">Diferencia</p>
            <p className={`font-bold text-base ${totals.diff == null ? "text-gray-400" : totals.diff > 0 ? "text-red-600" : totals.diff < 0 ? "text-green-600" : "text-gray-700"}`}>
              {totals.diff != null ? fmt(totals.diff) : "—"}
              {totals.overallPct != null && (
                <span className="text-xs font-normal ml-1">({totals.overallPct}%)</span>
              )}
            </p>
          </div>
          <div className="px-5 py-3 flex flex-col gap-1">
            <p className="text-xs text-gray-500">Estado</p>
            <div className="flex gap-1 flex-wrap">
              {Object.entries(statusCounts).map(([s, n]) => (
                <span key={s} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS[s]?.cls ?? ""}`}>
                  {n} {s.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Price list selector */}
        <div className="px-5 py-2.5 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-600">Lista de precios:</span>
            {!showUpload ? (
              <>
                <div className="relative">
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg pl-2 pr-7 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none"
                  >
                    <option value="">— Usar list_price del ítem —</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.filename} · {pl.item_count} ítems
                        {pl.upload_date ? ` · ${pl.upload_date}` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                {fetchingList && <Loader2 size={13} className="animate-spin text-blue-500" />}
                {providerId && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition"
                  >
                    <Upload size={13} /> Subir lista
                  </button>
                )}
              </>
            ) : (
              /* Upload panel */
              <div className="flex items-start gap-3 flex-wrap">
                <div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Temporada (ej: 2024-2)"
                  value={uploadSeason}
                  onChange={(e) => setUploadSeason(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="text"
                  placeholder="Notas"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={() => { setUploadError(null); uploadMutation.mutate(); }}
                  disabled={!uploadFile || uploadMutation.isPending}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Subir
                </button>
                <button
                  onClick={() => { setShowUpload(false); setUploadError(null); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                >
                  Cancelar
                </button>
                {uploadError && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {uploadError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-3 py-2.5 text-left font-medium">Código</th>
                <th className="px-3 py-2.5 text-left font-medium">Descripción</th>
                <th className="px-3 py-2.5 text-right font-medium">Cant.</th>
                <th className="px-3 py-2.5 text-right font-medium">Precio Factura</th>
                <th className="px-3 py-2.5 text-right font-medium">Precio Lista</th>
                <th className="px-3 py-2.5 text-right font-medium">Variación</th>
                <th className="px-3 py-2.5 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-gray-400">
                    No hay ítems en esta factura
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const isOvercharge = it.status === "MAYOR";
                  const isUnder = it.status === "MENOR";
                  return (
                    <tr
                      key={idx}
                      className={`border-t border-gray-100 transition ${
                        isOvercharge ? "bg-red-50 hover:bg-red-100" :
                        isUnder ? "bg-green-50 hover:bg-green-100" :
                        "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-gray-700">{it.code ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-800 max-w-[220px] truncate" title={it.description}>
                        {it.description ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{it.quantity_invoiced ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmt(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">
                        {it.resolvedListPrice != null ? fmt(it.resolvedListPrice) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${
                        it.status === "MAYOR" ? "text-red-600 font-semibold" :
                        it.status === "MENOR" ? "text-green-600 font-semibold" :
                        "text-gray-400"
                      }`}>
                        {it.variation != null ? (
                          `${it.variation > 0 ? "+" : ""}${it.variation}%`
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={it.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
          <div className="flex items-center gap-4">
            {Object.entries(STATUS).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-bold text-[10px] ${val.cls}`}>{val.label}</span>
                = {statusCounts[key] ?? 0}
              </span>
            ))}
          </div>
          <span>{totals.countWithList}/{totals.count} ítems con lista</span>
        </div>
      </div>
    </div>
  );
}
