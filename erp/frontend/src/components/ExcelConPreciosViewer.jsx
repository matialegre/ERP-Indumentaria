/**
 * ExcelConPreciosViewer
 * Props: { purchaseOrderId, onClose }
 *
 * Muestra todos los ítems facturados de una OC, comparados contra lista de precios.
 * Agrupa por factura. Permite seleccionar una lista de precios para cruzar
 * ítems que no tienen list_price.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  List,
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

function diffCell(unitPrice, listPrice) {
  if (listPrice == null || listPrice === 0)
    return { label: "—", pctLabel: "—", cls: "text-gray-400", icon: null };
  const diff = unitPrice - listPrice;
  const p = pct(listPrice, unitPrice);
  if (diff > 0)
    return {
      label: fmt(diff),
      pctLabel: `+${p}%`,
      cls: "text-red-600 font-semibold",
      icon: <TrendingUp size={13} className="inline mr-0.5" />,
    };
  if (diff < 0)
    return {
      label: fmt(diff),
      pctLabel: `${p}%`,
      cls: "text-green-600 font-semibold",
      icon: <TrendingDown size={13} className="inline mr-0.5" />,
    };
  return { label: "$0,00", pctLabel: "0%", cls: "text-gray-500", icon: <Minus size={13} className="inline mr-0.5" /> };
}

function rowBg(unitPrice, listPrice) {
  if (listPrice == null) return "";
  if (unitPrice > listPrice) return "bg-red-50";
  if (unitPrice < listPrice) return "bg-green-50";
  return "";
}

/* ─── sub-component: InvoiceGroup ────────────────── */
function InvoiceGroup({ invoice, priceListMap }) {
  const [open, setOpen] = useState(true);

  const items = invoice.items ?? [];
  const totals = items.reduce(
    (acc, it) => {
      const lp = it.list_price ?? priceListMap.get(it.code) ?? null;
      acc.invoiced += (it.unit_price ?? 0) * (it.quantity_invoiced ?? 1);
      acc.list += lp != null ? lp * (it.quantity_invoiced ?? 1) : 0;
      acc.hasListForAll = acc.hasListForAll && lp != null;
      return acc;
    },
    { invoiced: 0, list: 0, hasListForAll: true }
  );

  const totalDiff = totals.hasListForAll ? totals.invoiced - totals.list : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      {/* Invoice header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
          <FileText size={15} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">
            Factura #{invoice.invoice_number ?? invoice.id}
          </span>
          <span className="text-xs text-gray-400 ml-1">{invoice.invoice_date ?? ""}</span>
          <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
            {items.length} ítem{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-gray-600">
            Total factura: <span className="font-semibold text-gray-900">{fmt(totals.invoiced)}</span>
          </span>
          {totals.hasListForAll && (
            <span className={totalDiff > 0 ? "text-red-600 font-semibold" : totalDiff < 0 ? "text-green-600 font-semibold" : "text-gray-500"}>
              Dif: {fmt(totalDiff)}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-left font-medium">Descripción</th>
                <th className="px-3 py-2 text-left font-medium">Talle</th>
                <th className="px-3 py-2 text-left font-medium">Color</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Precio Factura</th>
                <th className="px-3 py-2 text-right font-medium">Precio Lista</th>
                <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                <th className="px-3 py-2 text-right font-medium">Dif %</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const lp = it.list_price ?? priceListMap.get(it.code) ?? null;
                const dc = diffCell(it.unit_price, lp);
                return (
                  <tr key={idx} className={`border-t border-gray-100 hover:bg-gray-50 ${rowBg(it.unit_price, lp)}`}>
                    <td className="px-3 py-2 font-mono text-gray-700">{it.code ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={it.description}>
                      {it.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{it.size ?? it.talle ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{it.color ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{it.quantity_invoiced ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt(it.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">
                      {lp != null ? (
                        fmt(lp)
                      ) : (
                        <span className="text-gray-300 italic">sin lista</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${dc.cls}`}>
                      {dc.icon}{dc.label}
                    </td>
                    <td className={`px-3 py-2 text-right ${dc.cls}`}>{dc.pctLabel}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Subtotal row */}
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-xs">
                <td colSpan={5} className="px-3 py-2 text-gray-600">Subtotal factura</td>
                <td className="px-3 py-2 text-right font-mono text-gray-900">{fmt(totals.invoiced)}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-600">
                  {totals.list > 0 ? fmt(totals.list) : "—"}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${totalDiff == null ? "text-gray-400" : totalDiff > 0 ? "text-red-600" : "text-green-600"}`}>
                  {totalDiff != null ? fmt(totalDiff) : "—"}
                </td>
                <td className={`px-3 py-2 text-right ${totalDiff == null ? "text-gray-400" : totalDiff > 0 ? "text-red-600" : "text-green-600"}`}>
                  {totalDiff != null && totals.list > 0 ? `${pct(totals.list, totals.invoiced)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── main component ──────────────────────────────── */
export default function ExcelConPreciosViewer({ purchaseOrderId, onClose }) {
  const [selectedListId, setSelectedListId] = useState("");
  const [providerIdForList, setProviderIdForList] = useState(null);

  /* fetch invoices for the PO */
  const {
    data: invoices = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["purchase-invoices", "po", purchaseOrderId],
    queryFn: () => api.get(`/purchase-invoices/?purchase_order_id=${purchaseOrderId}`),
    enabled: !!purchaseOrderId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* derive provider from first invoice */
  const derivedProviderId = invoices[0]?.provider_id ?? null;
  const effectiveProviderId = providerIdForList ?? derivedProviderId;

  /* fetch available price lists for provider */
  const { data: priceLists = [] } = useQuery({
    queryKey: ["price-lists", effectiveProviderId],
    queryFn: () => api.get(`/price-lists/?provider_id=${effectiveProviderId}&limit=100`),
    enabled: !!effectiveProviderId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* fetch selected price list items */
  const { data: listItems = [] } = useQuery({
    queryKey: ["price-list-items", selectedListId],
    queryFn: () => api.get(`/price-lists/${selectedListId}/items?limit=2000`),
    enabled: !!selectedListId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* build code → price map from selected list */
  const priceListMap = useMemo(() => {
    const m = new Map();
    listItems.forEach((it) => {
      if (it.code) m.set(String(it.code).trim(), it.price ?? it.cost ?? null);
    });
    return m;
  }, [listItems]);

  /* grand totals across all invoices */
  const grandTotals = useMemo(() => {
    let invoiced = 0, list = 0, covered = 0, total = 0;
    invoices.forEach((inv) => {
      (inv.items ?? []).forEach((it) => {
        const qty = it.quantity_invoiced ?? 1;
        const lp = it.list_price ?? priceListMap.get(it.code) ?? null;
        invoiced += (it.unit_price ?? 0) * qty;
        total++;
        if (lp != null) { list += lp * qty; covered++; }
      });
    });
    return { invoiced, list, diff: covered > 0 ? invoiced - list : null, covered, total };
  }, [invoices, priceListMap]);

  /* sync providerIdForList when invoices load */
  if (derivedProviderId && providerIdForList === null) {
    setProviderIdForList(derivedProviderId);
  }

  /* ── render states ──────────────────────────────── */
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3 shadow-2xl">
          <Loader2 size={22} className="animate-spin text-blue-600" />
          <span className="text-gray-700">Cargando facturas…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 text-red-600 mb-3">
            <AlertCircle size={20} />
            <h3 className="font-semibold">Error al cargar</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">{error.message}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const allItemsCount = invoices.reduce((s, inv) => s + (inv.items?.length ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-900">Facturas vs Lista de Precios</h2>
              <p className="text-xs text-gray-400">
                OC #{purchaseOrderId} · {invoices.length} factura{invoices.length !== 1 ? "s" : ""} · {allItemsCount} ítems
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-6 px-5 py-2.5 bg-gray-50 border-b flex-shrink-0 text-sm flex-wrap">
          <div>
            <span className="text-gray-500 text-xs">Total facturado</span>
            <p className="font-bold text-gray-900">{fmt(grandTotals.invoiced)}</p>
          </div>
          {grandTotals.list > 0 && (
            <>
              <div>
                <span className="text-gray-500 text-xs">Total lista</span>
                <p className="font-bold text-gray-700">{fmt(grandTotals.list)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">Diferencia total</span>
                <p className={`font-bold ${grandTotals.diff > 0 ? "text-red-600" : grandTotals.diff < 0 ? "text-green-600" : "text-gray-700"}`}>
                  {fmt(grandTotals.diff)}
                  {grandTotals.list > 0 && (
                    <span className="text-xs font-normal ml-1">
                      ({pct(grandTotals.list, grandTotals.invoiced)}%)
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
          <div className="ml-auto text-xs text-gray-400">
            {grandTotals.covered}/{grandTotals.total} ítems con lista
          </div>
        </div>

        {/* Price list selector */}
        {priceLists.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 border-b bg-blue-50 flex-shrink-0">
            <List size={15} className="text-blue-500 flex-shrink-0" />
            <span className="text-xs text-blue-700 font-medium">Lista de precios para cruzar ítems sin precio:</span>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Usar list_price de cada ítem —</option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.filename} · {pl.item_count} ítems · {pl.upload_date ?? ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <FileText size={32} className="opacity-30" />
              <p>No se encontraron facturas para esta OC</p>
            </div>
          ) : (
            invoices.map((inv) => (
              <InvoiceGroup key={inv.id} invoice={inv} priceListMap={priceListMap} />
            ))
          )}
        </div>

        {/* Legend */}
        <div className="px-5 py-2 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Precio factura mayor a lista</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Precio factura menor a lista</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> Sin precio de lista</span>
        </div>
      </div>
    </div>
  );
}
