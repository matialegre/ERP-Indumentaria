/**
 * CrucePreciosModal — cruza los ítems de una factura contra una lista de precios.
 *
 * Props:
 *   invoice      — objeto con items[] (puede tener items vacíos o ser null)
 *   providerId   — ID del proveedor para filtrar listas de precios
 *   providerName — nombre del proveedor (display)
 *   onClose      — callback para cerrar
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { GitCompare, X, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

/* ── Status metadata ──────────────────────────────────────────────────────── */
const STATUS_META = {
  OK:        { label: "OK",         color: "bg-green-100 text-green-700",   row: "" },
  MAYOR:     { label: "Mayor",      color: "bg-red-100 text-red-700",       row: "bg-red-50" },
  MENOR:     { label: "Menor",      color: "bg-emerald-100 text-emerald-700", row: "bg-emerald-50" },
  SIN_LISTA: { label: "Sin lista",  color: "bg-gray-100 text-gray-500",     row: "" },
};

function DiffIcon({ status }) {
  if (status === "MAYOR") return <TrendingUp size={12} className="text-red-500" />;
  if (status === "MENOR") return <TrendingDown size={12} className="text-emerald-500" />;
  if (status === "OK")    return <Minus size={12} className="text-green-500" />;
  return null;
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function CrucePreciosModal({ invoice, providerId, providerName, onClose }) {
  const [selectedList, setSelectedList] = useState("");

  /* ── Fetch price lists for this provider ────────────────────────────────── */
  const listsQuery = useQuery({
    queryKey: ["price-lists", providerId],
    queryFn: () => api.get(`/price-lists/?provider_id=${providerId}&limit=100`),
    enabled: !!providerId,
    staleTime: 60_000,
  });

  /* ── Fetch items in selected list ───────────────────────────────────────── */
  const itemsQuery = useQuery({
    queryKey: ["price-list-items", selectedList],
    queryFn: () => api.get(`/price-lists/${selectedList}/items?limit=500`),
    enabled: !!selectedList,
    staleTime: 60_000,
  });

  const lists         = listsQuery.data?.items ?? listsQuery.data ?? [];
  const priceListData = itemsQuery.data?.items ?? itemsQuery.data ?? [];
  const invoiceItems  = invoice?.items ?? [];

  /* ── Build price map: CODE → { price, description } ────────────────────── */
  const priceMap = {};
  priceListData.forEach((item) => {
    const code = String(item.code ?? "").trim().toUpperCase();
    if (code) priceMap[code] = { price: parseFloat(item.price) || 0, desc: item.description ?? "" };
  });

  /* ── Build comparison rows (only when invoice has items) ────────────────── */
  const comparisonRows = invoiceItems.map((invItem) => {
    const code         = String(invItem.codigo_articulo ?? invItem.code ?? "").trim().toUpperCase();
    const desc         = invItem.descripcion ?? invItem.description ?? "";
    const qty          = parseFloat(invItem.unidades ?? invItem.quantity ?? 1) || 1;
    const invoicePrice = parseFloat(invItem.precio_unit ?? invItem.price ?? 0);
    const listEntry    = priceMap[code];
    const listPrice    = listEntry ? listEntry.price : null;

    const diff    = listPrice !== null ? invoicePrice - listPrice : null;
    const diffPct = listPrice !== null && listPrice > 0
      ? ((invoicePrice - listPrice) / listPrice) * 100
      : null;

    let status = "SIN_LISTA";
    if (listPrice !== null) {
      if (Math.abs(diff) < 0.01)  status = "OK";
      else if (invoicePrice > listPrice) status = "MAYOR";
      else                               status = "MENOR";
    }

    return { code, desc, qty, invoicePrice, listPrice, diff, diffPct, status };
  });

  /* ── Totals ─────────────────────────────────────────────────────────────── */
  const totalInvoice = comparisonRows.reduce((s, r) => s + r.invoicePrice * r.qty, 0);
  const totalList    = comparisonRows.reduce((s, r) => s + (r.listPrice ?? r.invoicePrice) * r.qty, 0);
  const totalDiff    = totalInvoice - totalList;

  /* ── Status summary counts ──────────────────────────────────────────────── */
  const statusCounts = comparisonRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const hasInvoiceItems = invoiceItems.length > 0;
  const isLoadingList   = itemsQuery.isFetching;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare size={20} className="text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Cruce de Precios</h2>
              <p className="text-xs text-gray-500">
                {providerName}
                {hasInvoiceItems ? ` — ${invoiceItems.length} ítem${invoiceItems.length !== 1 ? "s" : ""} en factura` : " — sin ítems detallados"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Price list selector */}
        <div className="px-6 py-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Lista de precios:</label>

            {listsQuery.isLoading ? (
              <Loader2 size={16} className="animate-spin text-blue-500" />
            ) : listsQuery.isError ? (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> Error al cargar listas
              </span>
            ) : lists.length === 0 ? (
              <span className="text-xs text-gray-400">Sin listas de precios para este proveedor</span>
            ) : (
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[280px]"
                value={selectedList}
                onChange={(e) => setSelectedList(e.target.value)}
              >
                <option value="">Seleccionar lista…</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.filename}
                    {l.upload_date ? ` — ${new Date(l.upload_date).toLocaleDateString("es-AR")}` : ""}
                    {l.item_count != null ? ` (${l.item_count} ítems)` : ""}
                  </option>
                ))}
              </select>
            )}

            {isLoadingList && <Loader2 size={14} className="animate-spin text-blue-400" />}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-auto">

          {/* No list selected */}
          {!selectedList ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-3">
              <GitCompare size={48} className="opacity-20" />
              <p className="text-sm">Seleccioná una lista de precios para comenzar</p>
            </div>

          ) : isLoadingList ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>

          ) : itemsQuery.isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-red-400 gap-2">
              <AlertCircle size={32} />
              <p className="text-sm">{itemsQuery.error.message}</p>
            </div>

          ) : !hasInvoiceItems ? (
            /* ── Browse mode: show price list items without invoice comparison ── */
            <div>
              <div className="px-6 py-2.5 bg-yellow-50 border-b text-xs text-yellow-700 flex items-center gap-2">
                <AlertCircle size={13} />
                Este comprobante no tiene ítems detallados. Mostrando lista de precios de {providerName}.
              </div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    {["Código", "Descripción", "Precio"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {priceListData.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-700">{item.code}</td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-sm truncate" title={item.description}>{item.description || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                        ${parseFloat(item.price || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          ) : (
            /* ── Compare mode: invoice items vs price list ─────────────────── */
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  {["Código", "Descripción", "Cant.", "Precio Factura", "Precio Lista", "Diferencia", "Dif%", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map((row, i) => {
                  const meta = STATUS_META[row.status];
                  return (
                    <tr key={i} className={`${meta.row} hover:brightness-95 transition-all`}>
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-gray-800">{row.code}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate" title={row.desc}>
                        {row.desc || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{row.qty}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        ${row.invoicePrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                        {row.listPrice !== null
                          ? `$${row.listPrice.toFixed(2)}`
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {row.diff !== null ? (
                          <span className={row.diff > 0.01 ? "text-red-600" : row.diff < -0.01 ? "text-emerald-600" : "text-gray-400"}>
                            {row.diff > 0 ? "+" : ""}${row.diff.toFixed(2)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.diffPct !== null ? (
                          <span className={row.diffPct > 0.1 ? "text-red-600 font-semibold" : row.diffPct < -0.1 ? "text-emerald-600 font-semibold" : "text-gray-400"}>
                            {row.diffPct > 0 ? "+" : ""}{row.diffPct.toFixed(1)}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                          <DiffIcon status={row.status} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary footer — only in compare mode with list selected */}
        {selectedList && hasInvoiceItems && !isLoadingList && (
          <div className="px-6 py-3 border-t bg-gray-50 flex-shrink-0 flex items-center gap-6 flex-wrap">
            {/* Totals */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Total facturado:</span>
              <span className="font-bold text-gray-900 tabular-nums">${totalInvoice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Según lista:</span>
              <span className="font-semibold text-gray-700 tabular-nums">${totalList.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Diferencia total:</span>
              <span className={`font-bold tabular-nums ${totalDiff > 0.01 ? "text-red-600" : totalDiff < -0.01 ? "text-emerald-600" : "text-gray-500"}`}>
                {totalDiff > 0 ? "+" : ""}${totalDiff.toFixed(2)}
              </span>
            </div>

            {/* Status badges */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {Object.entries(statusCounts).map(([status, count]) => {
                const meta = STATUS_META[status];
                if (!meta || count === 0) return null;
                return (
                  <span key={status} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                    {meta.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
