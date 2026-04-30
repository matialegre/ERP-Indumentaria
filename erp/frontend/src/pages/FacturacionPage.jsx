import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import Pagination from "../components/Pagination";
import { useOnlineStatus, usePendingOps } from "../hooks/useOffline";
import { useSelectedLocal } from "../hooks/useSelectedLocal";
import {
  getAll, saveOfflineSale, getOfflineSales,
  enqueueOp, decrementLocalStock, saveReceipt, getById,
} from "../lib/offlineDB";
import { printReceipt } from "../lib/offlineReceipt";
import { useBranding } from "../context/BrandingContext";
import {
  FileText, Plus, Search, Eye, Trash2, CheckCircle,
  CreditCard, Ban, X, ArrowLeft, WifiOff, RefreshCw, Printer, MapPin,
  ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";

const badge = (text, color) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>
);
const statusColors = {
  BORRADOR: "bg-gray-100 text-gray-700",
  EMITIDA: "bg-blue-100 text-blue-700",
  PAGADA: "bg-green-100 text-green-700",
  ANULADA: "bg-red-100 text-red-700",
  PENDING_SYNC: "bg-amber-100 text-amber-700",
  EMITIDA_LOCAL: "bg-amber-100 text-amber-800",
  SYNCED: "bg-green-100 text-green-700",
};
const statusLabels = {
  PENDING_SYNC: "Pendiente sync",
  EMITIDA_LOCAL: "Emitida (local)",
  SYNCED: "Sincronizada",
};
const typeLabels = { FACTURA_A: "Factura A", FACTURA_B: "Factura B", TICKET: "Ticket", NOTA_CREDITO: "Nota de Crédito" };
const PAGE_SIZE = 50;
const fmtMoney = (v) => `$${Number(v || 0).toLocaleString("es-AR")}`;

function getNextOfflineNumber() {
  const existing = JSON.parse(localStorage.getItem("ofl-sale-counter") || "0");
  const next = existing + 1;
  localStorage.setItem("ofl-sale-counter", JSON.stringify(next));
  return `OFL-${String(next).padStart(4, "0")}`;
}

function generateLocalId() {
  return `OFL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function recalcTotals(items) {
  const subtotal = items.reduce((sum, it) => {
    const disc = it.discount_pct ? (1 - it.discount_pct / 100) : 1;
    return sum + it.quantity * it.unit_price * disc;
  }, 0);
  const tax = Math.round(subtotal * 0.21);
  return { subtotal: Math.round(subtotal), tax, total: Math.round(subtotal) + tax };
}

export default function FacturacionPage() {
  const qc = useQueryClient();
  const isOnline = useOnlineStatus();
  const { app_name } = useBranding();
  const { pending: pendingOps, flush, syncing: flushing, count: pendingCount } = usePendingOps();
  const { localId: selectedLocalId, localName: selectedLocalName, hasLocal: hasSelectedLocal } = useSelectedLocal();

  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [isOfflineSale, setIsOfflineSale] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Offline sale being edited in detail view
  const [offlineDetail, setOfflineDetail] = useState(null);
  // Cached offline sales for list view
  const [offlineSalesList, setOfflineSalesList] = useState([]);
  // Cached catalog data for offline product search
  const [cachedProducts, setCachedProducts] = useState([]);
  const [cachedStock, setCachedStock] = useState([]);
  const [cachedLocals, setCachedLocals] = useState([]);
  const [catalogSource, setCatalogSource] = useState("network");
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [mainTab, setMainTab] = useState("facturar"); // "facturar" | "consultar"
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, dateFrom, dateTo]);

  // Load offline sales from IndexedDB
  const refreshOfflineSales = useCallback(async () => {
    try {
      const sales = await getOfflineSales();
      setOfflineSalesList(sales.filter(s => s.status !== "SYNCED"));
    } catch {}
  }, []);

  useEffect(() => { refreshOfflineSales(); }, [refreshOfflineSales]);

  // Load catalog from IndexedDB when offline (or as supplement when online)
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [prods, stock, locals] = await Promise.all([
          getAll("catalogProducts"),
          getAll("catalogStock"),
          getAll("catalogLocals"),
        ]);
        setCachedProducts(prods || []);
        setCachedStock(stock || []);
        setCachedLocals(locals || []);
        if (!isOnline) setCatalogSource("cache");
      } catch {}
    }
    loadCatalog();
  }, [isOnline]);

  // ── ONLINE queries (only when online) ──
  const { data: pageData, isLoading } = useQuery({
    queryKey: ["sales", search, statusFilter, typeFilter, dateFrom, dateTo, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      if (typeFilter) p.set("type", typeFilter);
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      p.set("skip", (page - 1) * PAGE_SIZE);
      p.set("limit", PAGE_SIZE);
      return api.get(`/sales/?${p}`);
    },
    enabled: isOnline,
    retry: 1,
  });
  const serverSales = pageData?.items ?? [];
  const serverTotal = pageData?.total ?? 0;

  const { data: serverDetail } = useQuery({
    queryKey: ["sale", selectedId],
    queryFn: () => api.get(`/sales/${selectedId}`),
    enabled: !!selectedId && view === "detail" && isOnline && !isOfflineSale,
  });

  // When viewing an offline sale, load from IndexedDB
  useEffect(() => {
    if (view === "detail" && isOfflineSale && selectedId) {
      (async () => {
        const sale = await getById("offlineSales", selectedId);
        setOfflineDetail(sale || null);
      })();
    } else if (!isOfflineSale) {
      setOfflineDetail(null);
    }
  }, [view, selectedId, isOfflineSale]);

  const detail = isOfflineSale ? offlineDetail : serverDetail;

  const { data: apiLocals = [] } = useQuery({
    queryKey: ["locals"],
    queryFn: () => api.get("/locals/?limit=500"),
    select: (d) => d?.items ?? [],
    enabled: isOnline && (view === "create"),
  });
  const { data: apiProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products/?limit=500"),
    select: (d) => d?.items ?? [],
    enabled: isOnline && (view === "create" || view === "detail"),
  });

  // Use API data when online, cached data when offline
  const locals = isOnline && apiLocals.length > 0 ? apiLocals : cachedLocals;
  const products = isOnline && apiProducts.length > 0 ? apiProducts : cachedProducts;
  const usingCache = !isOnline || (apiProducts.length === 0 && cachedProducts.length > 0);

  // Build stock map from cached stock for offline display
  const stockMap = {};
  cachedStock.forEach(s => { stockMap[s.variant_id] = s.stock; });

  // ── ONLINE mutations ──
  const createMut = useMutation({
    mutationFn: (data) => api.post("/sales/", data),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["sales"] }); setSelectedId(d.id); setIsOfflineSale(false); setView("detail"); },
  });
  const emitMut = useMutation({
    mutationFn: (id) => api.patch(`/sales/${id}/emit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["sale", selectedId] }); },
  });
  const payMut = useMutation({
    mutationFn: (id) => api.patch(`/sales/${id}/pay`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["sale", selectedId] }); },
  });
  const cancelMut = useMutation({
    mutationFn: (id) => api.patch(`/sales/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); qc.invalidateQueries({ queryKey: ["sale", selectedId] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/sales/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales"] }); setView("list"); },
  });
  const addItemMut = useMutation({
    mutationFn: ({ saleId, ...data }) => api.post(`/sales/${saleId}/items`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sale", selectedId] }),
  });
  const removeItemMut = useMutation({
    mutationFn: ({ saleId, itemId }) => api.delete(`/sales/${saleId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sale", selectedId] }),
  });

  // ── Form state ──
  // ── Form state (pre-populate local_id si hay local seleccionado) ──
  const defaultForm = { type: "TICKET", number: "", date: new Date().toISOString().slice(0, 10), customer_name: "", customer_cuit: "", notes: "", local_id: selectedLocalId || "" };
  const [form, setForm] = useState(defaultForm);
  const [itemModal, setItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({ variant_id: "", quantity: 1, unit_price: "", discount_pct: 0 });
  const [itemSearch, setItemSearch] = useState("");

  // ── Create sale (online or offline) ──
  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    if (isOnline) {
      createMut.mutate({ ...form, local_id: form.local_id ? parseInt(form.local_id) : null });
      return;
    }

    // OFFLINE creation
    setCreating(true);
    try {
      const localId = generateLocalId();
      const number = getNextOfflineNumber();
      const localObj = form.local_id ? locals.find(l => l.id === parseInt(form.local_id)) : null;
      const sale = {
        localId,
        type: form.type,
        number,
        date: form.date,
        customer_name: form.customer_name || "Consumidor Final",
        customer_cuit: form.customer_cuit || "",
        local_id: form.local_id ? parseInt(form.local_id) : null,
        local_name: localObj?.name || "",
        notes: form.notes || "",
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: "PENDING_SYNC",
        createdAt: Date.now(),
        isOffline: true,
      };
      await saveOfflineSale(sale);
      await refreshOfflineSales();
      setSelectedId(localId);
      setIsOfflineSale(true);
      setView("detail");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // ── Add item (online or offline) ──
  async function handleAddItem(e) {
    e.preventDefault();
    setError(null);

    const variantId = parseInt(itemForm.variant_id);
    const quantity = parseInt(itemForm.quantity);
    const unitPrice = parseFloat(itemForm.unit_price);
    const discountPct = parseFloat(itemForm.discount_pct) || 0;

    if (isOnline && !isOfflineSale) {
      addItemMut.mutate({ saleId: selectedId, variant_id: variantId, quantity, unit_price: unitPrice, discount_pct: discountPct });
      setItemModal(false);
      setItemForm({ variant_id: "", quantity: 1, unit_price: "", discount_pct: 0 });
      return;
    }

    // OFFLINE add item
    try {
      const sale = await getById("offlineSales", selectedId);
      if (!sale) throw new Error("Venta no encontrada");

      // Find variant info from cached products
      let productName = "", sku = "", size = "", color = "";
      for (const p of cachedProducts) {
        const v = (p.variants || []).find(v => v.id === variantId);
        if (v) {
          productName = p.name;
          sku = v.sku || "";
          size = v.size || "";
          color = v.color || "";
          break;
        }
      }

      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        variant_id: variantId,
        product_name: productName,
        variant_sku: sku,
        sku,
        size,
        color,
        quantity,
        unit_price: unitPrice,
        discount_pct: discountPct,
        subtotal: Math.round(quantity * unitPrice * (1 - discountPct / 100)),
      };

      sale.items.push(newItem);
      const totals = recalcTotals(sale.items);
      Object.assign(sale, totals);
      await saveOfflineSale(sale);
      setOfflineDetail({ ...sale });
      setItemModal(false);
      setItemForm({ variant_id: "", quantity: 1, unit_price: "", discount_pct: 0 });
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Remove item (offline only) ──
  async function handleRemoveOfflineItem(itemId) {
    try {
      const sale = await getById("offlineSales", selectedId);
      if (!sale) return;
      sale.items = sale.items.filter(it => it.id !== itemId);
      const totals = recalcTotals(sale.items);
      Object.assign(sale, totals);
      await saveOfflineSale(sale);
      setOfflineDetail({ ...sale });
    } catch {}
  }

  // ── Emit offline sale ──
  async function handleOfflineEmit() {
    setError(null);
    try {
      const sale = await getById("offlineSales", selectedId);
      if (!sale) throw new Error("Venta no encontrada");
      if (sale.items.length === 0) throw new Error("Agregue al menos un item antes de emitir");

      sale.status = "EMITIDA_LOCAL";

      // Decrement local stock for each item
      for (const item of sale.items) {
        await decrementLocalStock(item.variant_id, item.quantity);
      }

      // Build payload for sync queue
      const salePayload = {
        type: sale.type,
        number: sale.number,
        date: sale.date,
        customer_name: sale.customer_name,
        customer_cuit: sale.customer_cuit,
        local_id: sale.local_id,
        notes: sale.notes || "",
        items: sale.items.map(it => ({
          variant_id: it.variant_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct || 0,
        })),
        _offline_local_id: sale.localId,
        _offline_emitted: true,
      };

      await enqueueOp("SALE", "POST", "/sales/", salePayload);
      await saveOfflineSale(sale);

      // Save receipt for reprint
      await saveReceipt(sale.localId, {
        number: sale.number,
        date: sale.date,
        type: sale.type,
        customer_name: sale.customer_name,
        local_name: sale.local_name,
        items: sale.items,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        isOffline: true,
      });

      setOfflineDetail({ ...sale });
      await refreshOfflineSales();
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Print receipt ──
  function handlePrint(saleData) {
    printReceipt({
      localId: saleData.localId || saleData.id,
      number: saleData.number,
      date: saleData.date,
      clientName: saleData.customer_name,
      clientDoc: saleData.customer_cuit,
      localName: saleData.local_name,
      items: (saleData.items || []).map(it => ({
        name: it.product_name || it.name || "Producto",
        sku: it.variant_sku || it.sku,
        size: it.size,
        color: it.color,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
      subtotal: saleData.subtotal,
      tax: saleData.tax,
      total: saleData.total,
      isOffline: saleData.isOffline || false,
    }, { companyName: app_name });
  }

  // ── Merge server + offline sales for list ──
  const mergedSales = isOnline ? [
    ...offlineSalesList.map(s => ({ ...s, id: s.localId, _isOffline: true })),
    ...serverSales,
  ] : offlineSalesList.map(s => ({ ...s, id: s.localId, _isOffline: true }));

  // Apply local search filter on offline sales when offline
  const filteredMerged = mergedSales.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      const matchNum = (s.number || "").toLowerCase().includes(q);
      const matchName = (s.customer_name || "").toLowerCase().includes(q);
      if (!matchNum && !matchName) return false;
    }
    if (statusFilter && s.status !== statusFilter) return false;
    if (typeFilter && s.type !== typeFilter) return false;
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    return true;
  });

  const totalCount = isOnline ? serverTotal + offlineSalesList.length : filteredMerged.length;
  const displaySales = isOnline ? filteredMerged : filteredMerged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const listLoading = isOnline && isLoading;

  const filteredProducts = products.filter(p => {
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return (p.name || "").toLowerCase().includes(q)
      || (p.code || "").toLowerCase().includes(q)
      || (p.brand || "").toLowerCase().includes(q);
  });

  // ── Offline badge + pending sync banner ──
  const OfflineBanner = () => (
    <>
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium">
          <WifiOff size={16} /> 📱 MODO OFFLINE
        </div>
      )}
      {offlineSalesList.filter(s => s.status !== "SYNCED").length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm text-amber-800">
            ⏳ {offlineSalesList.filter(s => s.status !== "SYNCED").length} venta(s) pendiente(s) de sincronizar
          </span>
          {isOnline && (
            <button onClick={flush} disabled={flushing}
              className="flex items-center gap-1 px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50">
              <RefreshCw size={12} className={flushing ? "animate-spin" : ""} /> {flushing ? "Sincronizando..." : "Sincronizar"}
            </button>
          )}
        </div>
      )}
    </>
  );

  // ── CONSULTAR FACTURAS VIEW ──
  if (view === "list" && mainTab === "consultar") return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList size={24} /> Consultar Facturas</h1>
          <p className="text-sm text-gray-500 mt-1">Vista detallada de comprobantes realizados</p>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm font-semibold">
              <WifiOff size={14} /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setMainTab("facturar")}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:text-gray-900 transition"
        >
          <span className="flex items-center gap-2"><Plus size={14} /> Facturar</span>
        </button>
        <button
          onClick={() => setMainTab("consultar")}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm transition"
        >
          <span className="flex items-center gap-2"><ClipboardList size={14} /> Consultar Facturas</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Desde"
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Hasta"
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">Todos los tipos</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">Todos los estados</option>
          {Object.keys(statusColors).map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {listLoading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : displaySales.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Sin comprobantes para los filtros seleccionados</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {displaySales.map(s => {
              const key = s._isOffline ? s.localId : s.id;
              const isExpanded = expandedRow === key;
              const sStatus = statusLabels[s.status] || s.status;
              return (
                <div key={key} className={`${s._isOffline ? "bg-amber-50/40" : "bg-white"}`}>
                  {/* Row header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                    onClick={() => setExpandedRow(isExpanded ? null : key)}
                  >
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                      <div className="flex items-center gap-2">
                        {badge(typeLabels[s.type] || s.type, "bg-gray-100 text-gray-700")}
                        {s._isOffline && <span className="text-xs text-amber-600">📱</span>}
                      </div>
                      <div className="font-semibold text-gray-900 text-sm">{s.number || "—"}</div>
                      <div className="text-gray-500 text-sm">{s.date}</div>
                      <div className="text-gray-700 text-sm truncate">{s.customer_name || "Consumidor Final"}</div>
                      <div className="flex items-center justify-between gap-2">
                        {badge(sStatus, statusColors[s.status] || "bg-gray-100 text-gray-700")}
                        <span className="font-bold text-gray-900 text-sm">{s.total ? fmtMoney(s.total) : "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedId(s._isOffline ? s.localId : s.id); setIsOfflineSale(!!s._isOffline); setView("detail"); }}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Ver detalle completo"
                      >
                        <Eye size={15} />
                      </button>
                      {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-3">
                      {s.local_name && (
                        <p className="text-xs text-gray-500 py-2 flex items-center gap-1">
                          <MapPin size={11} /> {s.local_name}
                          {s.notes && <span className="ml-3 italic">· {s.notes}</span>}
                        </p>
                      )}
                      {!s.items || s.items.length === 0 ? (
                        <div className="py-2 text-xs text-gray-400 italic">
                          {s._isOffline && s.status === "PENDING_SYNC"
                            ? "Items disponibles en el detalle"
                            : "Sin items registrados"}
                        </div>
                      ) : (
                        <table className="w-full text-xs mt-1">
                          <thead>
                            <tr className="text-gray-500 uppercase">
                              <th className="py-1.5 text-left font-semibold">Producto</th>
                              <th className="py-1.5 text-left font-semibold">SKU</th>
                              <th className="py-1.5 text-center font-semibold">Cant.</th>
                              <th className="py-1.5 text-right font-semibold">P. Unit.</th>
                              <th className="py-1.5 text-center font-semibold">Dto.</th>
                              <th className="py-1.5 text-right font-semibold">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {s.items.map((it, i) => {
                              const sub = it.subtotal || Math.round(it.quantity * it.unit_price * (1 - (it.discount_pct || 0) / 100));
                              return (
                                <tr key={i} className="text-gray-700">
                                  <td className="py-1.5 font-medium">{it.product_name || it.name || "—"}</td>
                                  <td className="py-1.5 font-mono text-gray-500">{it.variant_sku || it.sku || "—"}</td>
                                  <td className="py-1.5 text-center">{it.quantity}</td>
                                  <td className="py-1.5 text-right">{fmtMoney(it.unit_price)}</td>
                                  <td className="py-1.5 text-center">{it.discount_pct ? `${it.discount_pct}%` : "—"}</td>
                                  <td className="py-1.5 text-right font-semibold">{fmtMoney(sub)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t border-gray-200">
                            {s.tax > 0 && (
                              <tr className="text-gray-500">
                                <td colSpan={5} className="py-1.5 text-right">IVA 21%:</td>
                                <td className="py-1.5 text-right">{fmtMoney(s.tax)}</td>
                              </tr>
                            )}
                            <tr className="font-bold text-gray-900">
                              <td colSpan={5} className="py-1.5 text-right">Total:</td>
                              <td className="py-1.5 text-right">{fmtMoney(s.total || 0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Pagination total={totalCount} skip={(page - 1) * PAGE_SIZE} limit={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );

  // ── LIST VIEW ──
  if (view === "list") return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText size={24} /> Facturación</h1>
          <p className="text-sm text-gray-500 mt-1">Comprobantes de venta</p>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm font-semibold">
              <WifiOff size={14} /> 📱 MODO OFFLINE
            </span>
          )}
          <button onClick={() => { setForm({ type: "TICKET", number: "", date: new Date().toISOString().slice(0, 10), customer_name: "", customer_cuit: "", notes: "", local_id: selectedLocalId || "" }); setView("create"); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
            <Plus size={16} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setMainTab("facturar")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mainTab === "facturar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:bg-white hover:text-gray-900"}`}
        >
          <span className="flex items-center gap-2"><Plus size={14} /> Facturar</span>
        </button>
        <button
          onClick={() => setMainTab("consultar")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mainTab === "consultar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:bg-white hover:text-gray-900"}`}
        >
          <span className="flex items-center gap-2"><ClipboardList size={14} /> Consultar Facturas</span>
        </button>
      </div>

      <OfflineBanner />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Desde"
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Hasta"
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">Todos los tipos</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg">
          <option value="">Todos los estados</option>
          {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {listLoading ? <div className="p-8 text-center text-gray-400">Cargando...</div> : displaySales.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{!isOnline ? "Sin ventas offline registradas" : "Sin comprobantes"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Local</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displaySales.map(s => {
                  const key = s._isOffline ? s.localId : s.id;
                  const sStatus = statusLabels[s.status] || s.status;
                  return (
                    <tr key={key} className={`hover:bg-gray-50 cursor-pointer ${s._isOffline ? "bg-amber-50/40" : ""}`}
                      onClick={() => { setSelectedId(s._isOffline ? s.localId : s.id); setIsOfflineSale(!!s._isOffline); setView("detail"); }}>
                      <td className="px-4 py-3">
                        {badge(typeLabels[s.type] || s.type, "bg-gray-100 text-gray-700")}
                        {s._isOffline && <span className="ml-1 text-xs text-amber-600">📱</span>}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.number}</td>
                      <td className="px-4 py-3 text-gray-500">{s.date}</td>
                      <td className="px-4 py-3">{s.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.local_name || "—"}</td>
                      <td className="px-4 py-3 text-center">{badge(sStatus, statusColors[s.status] || "bg-gray-100 text-gray-700")}</td>
                      <td className="px-4 py-3 text-right font-bold">{s.total ? fmtMoney(s.total) : "—"}</td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setSelectedId(s._isOffline ? s.localId : s.id); setIsOfflineSale(!!s._isOffline); setView("detail"); }}
                          className="p-1 text-gray-400 hover:text-amber-600"><Eye size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination total={totalCount} skip={(page - 1) * PAGE_SIZE} limit={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );

  // ── CREATE VIEW ──
  if (view === "create") return (
    <div className="space-y-6">
      <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> Volver</button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Venta</h1>
        {!isOnline && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm font-semibold">
            <WifiOff size={14} /> OFFLINE
          </span>
        )}
      </div>

      {!isOnline && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          📱 Esta venta se creará localmente y se sincronizará cuando vuelva la conexión.
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {isOnline && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número *</label>
              <input type="text" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          )}
          {!isOnline && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input type="text" value="Se asignará automáticamente" disabled className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Local {usingCache && <span className="text-xs text-amber-600">(dato del cache)</span>}
              {hasSelectedLocal && form.local_id === selectedLocalId && (
                <span className="ml-1 text-xs text-blue-600">📍 auto-asignado</span>
              )}
            </label>
            <select value={form.local_id} onChange={e => setForm({ ...form, local_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
              <option value="">Sin local</option>
              {locals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <input type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Nombre..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
            <input type="text" value={form.customer_cuit} onChange={e => setForm({ ...form, customer_cuit: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="XX-XXXXXXXX-X" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
        </div>
        {(createMut.error || error) && <p className="text-sm text-red-600">{createMut.error?.message || error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setView("list")} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
          <button type="submit" disabled={createMut.isPending || creating} className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {(createMut.isPending || creating) ? "Creando..." : isOnline ? "Crear Venta" : "Crear Venta Offline"}
          </button>
        </div>
      </form>
    </div>
  );

  // ── DETAIL VIEW ──
  const isEditable = detail && (detail.status === "BORRADOR" || detail.status === "PENDING_SYNC");
  const canEmit = detail && (detail.status === "BORRADOR" || detail.status === "PENDING_SYNC");
  const canPay = detail && detail.status === "EMITIDA";
  const canCancel = detail && !["ANULADA", "PENDING_SYNC", "EMITIDA_LOCAL", "SYNCED"].includes(detail.status);
  const canPrint = detail && ["EMITIDA", "EMITIDA_LOCAL", "PAGADA"].includes(detail.status);

  return (
    <div className="space-y-6">
      <button onClick={() => { setView("list"); setIsOfflineSale(false); setOfflineDetail(null); setError(null); }}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> Volver</button>

      {!detail ? <div className="p-8 text-center text-gray-400">Cargando...</div> : (
        <>
          {isOfflineSale && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
              <WifiOff size={16} />
              {detail.status === "PENDING_SYNC" && "📱 Venta offline — Esta venta se sincronizará cuando vuelva la conexión"}
              {detail.status === "EMITIDA_LOCAL" && "✅ Emitida localmente — Se enviará al servidor cuando vuelva la conexión"}
              {detail.status === "SYNCED" && "🟢 Sincronizada con el servidor"}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {typeLabels[detail.type] || detail.type} #{detail.number}
                {isOfflineSale && <span className="text-sm text-amber-600">📱</span>}
              </h1>
              <p className="text-sm text-gray-500">{detail.date} — {detail.customer_name || "Sin cliente"} {detail.local_name ? `(${detail.local_name})` : ""}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {badge(statusLabels[detail.status] || detail.status, statusColors[detail.status] || "bg-gray-100 text-gray-700")}

              {/* Emit button — works both online and offline */}
              {canEmit && (
                <button onClick={() => {
                  if (isOfflineSale) handleOfflineEmit();
                  else emitMut.mutate(detail.id);
                }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <CheckCircle size={14} /> {isOfflineSale ? "Emitir (offline)" : "Emitir"}
                </button>
              )}

              {/* Print button */}
              {canPrint && (
                <button onClick={() => handlePrint(detail)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                  <Printer size={14} /> Imprimir
                </button>
              )}

              {/* Delete — only drafts, only online server sales */}
              {detail.status === "BORRADOR" && !isOfflineSale && (
                <button onClick={() => { if (confirm("¿Eliminar?")) deleteMut.mutate(detail.id); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                  <Trash2 size={14} /> Eliminar
                </button>
              )}

              {/* Pay — only online emitted */}
              {canPay && !isOfflineSale && (
                <button onClick={() => payMut.mutate(detail.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                  <CreditCard size={14} /> Marcar Pagada
                </button>
              )}

              {/* Cancel — only online sales */}
              {canCancel && !isOfflineSale && (
                <button onClick={() => { if (confirm("¿Anular? Si estaba emitida se revierte el stock.")) cancelMut.mutate(detail.id); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                  <Ban size={14} /> Anular
                </button>
              )}
            </div>
          </div>

          {detail.notes && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">{detail.notes}</div>}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 className="font-medium text-gray-700">
                Items ({detail.items?.length || 0})
                {usingCache && <span className="ml-2 text-xs text-amber-600">(dato del cache)</span>}
              </h3>
              {isEditable && (
                <button onClick={() => { setItemSearch(""); setItemModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                  <Plus size={14} /> Agregar Item
                </button>
              )}
            </div>
            {(!detail.items || detail.items.length === 0) ? (
              <div className="p-6 text-center text-gray-400">Sin items — agregue productos para continuar</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-center">Dto.%</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    {isEditable && <th className="px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.items.map(it => {
                    const itSubtotal = it.subtotal || Math.round(it.quantity * it.unit_price * (1 - (it.discount_pct || 0) / 100));
                    return (
                      <tr key={it.id}>
                        <td className="px-4 py-3 font-medium">{it.product_name || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{it.variant_sku || it.sku || "—"}</td>
                        <td className="px-4 py-3 text-center">{it.quantity}</td>
                        <td className="px-4 py-3 text-right">{fmtMoney(it.unit_price)}</td>
                        <td className="px-4 py-3 text-center">{it.discount_pct ? `${it.discount_pct}%` : "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmtMoney(itSubtotal)}</td>
                        {isEditable && (
                          <td className="px-4 py-3 text-center">
                            {isOfflineSale ? (
                              <button onClick={() => handleRemoveOfflineItem(it.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                            ) : (
                              <button onClick={() => removeItemMut.mutate({ saleId: detail.id, itemId: it.id })} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 text-sm">
                  <tr><td colSpan={5} className="px-4 py-2 text-right">Subtotal:</td><td className="px-4 py-2 text-right font-medium">{fmtMoney(detail.subtotal || 0)}</td>{isEditable && <td></td>}</tr>
                  {(detail.tax > 0) && <tr><td colSpan={5} className="px-4 py-2 text-right">IVA 21%:</td><td className="px-4 py-2 text-right">{fmtMoney(detail.tax)}</td>{isEditable && <td></td>}</tr>}
                  <tr className="font-bold text-base"><td colSpan={5} className="px-4 py-3 text-right">Total:</td><td className="px-4 py-3 text-right">{fmtMoney(detail.total || 0)}</td>{isEditable && <td></td>}</tr>
                </tfoot>
              </table>
            )}
          </div>

          {(emitMut.error || cancelMut.error || error) && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{emitMut.error?.message || cancelMut.error?.message || error}</p>
          )}
        </>
      )}

      {/* ── ADD ITEM MODAL ── */}
      {itemModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Agregar Item
                {usingCache && <span className="text-xs text-amber-600 font-normal">(productos del cache)</span>}
              </h2>
              <button onClick={() => setItemModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar producto</label>
                <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Nombre, código o marca..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variante *</label>
                <select value={itemForm.variant_id} onChange={e => {
                  const vid = e.target.value;
                  setItemForm({ ...itemForm, variant_id: vid });
                  // Auto-fill price from variant base_price or product base_cost
                  if (vid) {
                    for (const p of products) {
                      const v = (p.variants || []).find(v => String(v.id) === vid);
                      if (v) {
                        const price = v.price || v.base_price || p.base_cost || "";
                        if (price && !itemForm.unit_price) setItemForm(prev => ({ ...prev, variant_id: vid, unit_price: price }));
                        break;
                      }
                    }
                  }
                }} required className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="">Seleccionar...</option>
                  {filteredProducts.flatMap(p => (p.variants || []).map(v => {
                    const stk = stockMap[v.id] !== undefined ? stockMap[v.id] : v.stock;
                    const stkLabel = stk !== undefined ? `Stock: ${stk}` : "";
                    return (
                      <option key={v.id} value={v.id}>
                        {p.name} — {v.size}/{v.color} ({v.sku}) {stkLabel && `[${stkLabel}${usingCache ? " ≈" : ""}]`}
                      </option>
                    );
                  }))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                  <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio unit. *</label>
                  <input type="number" step="0.01" min="0" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value })} required className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dto. %</label>
                  <input type="number" step="0.01" min="0" max="100" value={itemForm.discount_pct} onChange={e => setItemForm({ ...itemForm, discount_pct: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              {(addItemMut.error || error) && <p className="text-sm text-red-600">{addItemMut.error?.message || error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setItemModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={addItemMut.isPending} className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
