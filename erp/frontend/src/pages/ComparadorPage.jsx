import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  GitCompare, Search, Upload, X, Loader2, ChevronRight,
  TrendingDown, Check, BarChart2, Calendar, Package,
  AlertCircle, RefreshCw, SlidersHorizontal,
} from "lucide-react";
import { CssLineChart } from "../components/CssCharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(num) {
  if (num == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(num);
}

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calcDiscount(listPrice, netPrice) {
  if (!listPrice || !netPrice || listPrice === 0) return null;
  return ((1 - netPrice / listPrice) * 100).toFixed(1);
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
        type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
      }`}
    >
      {type === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ providers, onClose, onSuccess }) {
  const [providerId, setProviderId] = useState("");
  const [file, setFile] = useState(null);
  const [vigencia, setVigencia] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!providerId) return setError("Seleccioná un proveedor");
    if (!file) return setError("Seleccioná un archivo");
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("provider_id", providerId);
      fd.append("file", file);
      fd.append("vigencia", vigencia);
      const result = await api.postForm("/price-lists/", fd);
      onSuccess(result?.updated ?? result?.count ?? "?");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Cargar Lista de Precios</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white"
            >
              <option value="">Seleccioná un proveedor...</option>
              {(providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo (CSV / Excel)
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">
                <Calendar size={13} /> Vigencia
              </span>
            </label>
            <input
              type="date"
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {loading ? "Cargando..." : "Cargar lista"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Drawer ───────────────────────────────────────────────────────────

function HistoryDrawer({ item, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["price-history", item.provider_id, item.product_code],
    queryFn: () =>
      api.get(
        `/price-lists/?provider_id=${item.provider_id}&product_code=${encodeURIComponent(
          item.product_code ?? ""
        )}&history=true`
      ),
    enabled: !!item,
    retry: false,
  });

  const history = data?.history ?? data?.items ?? [];
  const chartData = history.map((h) => ({
    fecha: fmtDate(h.created_at ?? h.date),
    precio: h.net_price ?? h.price,
    lista: h.list_price,
  }));

  const disc = calcDiscount(item.list_price, item.net_price);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Historial de Precios</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {item.provider_name} — {item.product_code || item.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Precio Neto Actual</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{fmt(item.net_price)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Descuento</p>
              <p className="text-lg font-bold text-green-600 mt-0.5">
                {disc != null ? `${disc}%` : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Precio Lista</p>
              <p className="text-base font-semibold text-gray-400 mt-0.5 line-through">
                {fmt(item.list_price)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Última Actualización</p>
              <p className="text-sm font-medium text-gray-700 mt-0.5">{fmtDate(item.updated_at)}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          ) : chartData.length > 1 ? (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Evolución de Precios</h4>
              <CssLineChart data={chartData} height={220} color="#3b82f6" valueKey="precio" labelKey="fecha" />
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400 text-sm">
              No hay historial de precios disponible para este proveedor
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Últimos registros</h4>
              <div className="space-y-1">
                {history.slice(0, 10).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-gray-100 text-sm"
                  >
                    <span className="text-gray-500">{fmtDate(h.created_at ?? h.date)}</span>
                    <span className="font-medium text-gray-900">
                      {fmt(h.net_price ?? h.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Compare View ─────────────────────────────────────────────────────────────

function CompareView({ items, onClose }) {
  const minPrice = Math.min(...items.map((i) => i.net_price ?? Infinity));
  const colClass =
    items.length <= 2
      ? "grid-cols-2"
      : items.length === 3
      ? "grid-cols-3"
      : "grid-cols-4";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <GitCompare size={18} className="text-violet-600" />
            <h3 className="font-semibold text-gray-900">Comparación de Precios</h3>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {items.length} proveedores
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`grid gap-4 p-5 ${colClass}`}>
          {items.map((item) => {
            const isBest = item.net_price === minPrice;
            const disc = calcDiscount(item.list_price, item.net_price);
            return (
              <div
                key={`${item.provider_id}-${item.product_code}`}
                className={`rounded-xl border-2 p-4 space-y-3 ${
                  isBest ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
                }`}
              >
                {isBest && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full w-fit">
                    <TrendingDown size={12} /> Mejor precio
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Proveedor</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{item.provider_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Código</p>
                  <p className="font-mono text-sm text-gray-700 mt-0.5">{item.product_code || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Descripción</p>
                  <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">
                    {item.description || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Precio Lista</p>
                  <p className="text-sm text-gray-400 line-through mt-0.5">{fmt(item.list_price)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Descuento</p>
                  <p
                    className={`text-sm font-medium mt-0.5 ${
                      disc > 0 ? "text-green-600" : "text-gray-500"
                    }`}
                  >
                    {disc != null ? `${disc}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Precio Neto</p>
                  <p
                    className={`text-2xl font-bold mt-0.5 ${
                      isBest ? "text-green-700" : "text-gray-900"
                    }`}
                  >
                    {fmt(item.net_price)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stock</p>
                  <p
                    className={`text-sm font-medium mt-0.5 ${
                      (item.stock ?? 0) > 0 ? "text-blue-600" : "text-red-500"
                    }`}
                  >
                    {item.stock != null ? `${item.stock} u.` : "Sin datos"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Actualizado</p>
                  <p className="text-xs text-gray-600 mt-0.5">{fmtDate(item.updated_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Price Row ────────────────────────────────────────────────────────────────

function PriceRow({ row, isBest, isSelected, onSelect, onHistoryClick, canSelectMore }) {
  const disc = calcDiscount(row.list_price, row.net_price);

  return (
    <tr
      className={`border-b transition-colors ${
        isBest
          ? "bg-green-50 border-green-200 hover:bg-green-100"
          : "border-gray-100 hover:bg-gray-50"
      }`}
    >
      <td className="py-3 px-4">
        <input
          type="checkbox"
          checked={isSelected}
          disabled={!isSelected && !canSelectMore}
          onChange={() => onSelect(row)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {isBest && <TrendingDown size={14} className="text-green-600 shrink-0" />}
          <span className="font-medium text-gray-900 text-sm">{row.provider_name || "—"}</span>
        </div>
      </td>
      <td className="py-3 px-4 font-mono text-xs text-gray-600">{row.product_code || "—"}</td>
      <td
        className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate"
        title={row.description}
      >
        {row.description || "—"}
      </td>
      <td className="py-3 px-4 text-sm text-right text-gray-500">{fmt(row.list_price)}</td>
      <td className="py-3 px-4 text-right">
        {disc != null ? (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              parseFloat(disc) > 0
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {disc}%
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`font-bold text-sm ${isBest ? "text-green-700" : "text-gray-900"}`}>
          {fmt(row.net_price)}
        </span>
      </td>
      <td className="py-3 px-4 text-right text-sm">
        {row.stock != null ? (
          <span className={row.stock > 0 ? "text-blue-600 font-medium" : "text-red-500"}>
            {row.stock} u.
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-right text-xs text-gray-500">{fmtDate(row.updated_at)}</td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={() => onHistoryClick(row)}
          className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-blue-600 transition"
          title="Ver historial de precios"
        >
          <ChevronRight size={15} />
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ComparadorPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [toast, setToast] = useState(null);

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset selection when product changes
  useEffect(() => {
    setSelectedRows([]);
    setShowCompare(false);
  }, [selectedProduct]);

  // Providers for upload modal
  const { data: providersData } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get("/providers/?limit=200"),
    staleTime: 5 * 60 * 1000,
  });
  const providers =
    providersData?.items ?? (Array.isArray(providersData) ? providersData : []);

  // Product search
  const { data: productsData, isLoading: isSearching } = useQuery({
    queryKey: ["products-search", debouncedSearch],
    queryFn: () =>
      api.get(`/products/?search=${encodeURIComponent(debouncedSearch)}&limit=20`),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });
  const products =
    productsData?.items ?? (Array.isArray(productsData) ? productsData : []);

  // Prices for selected product
  const {
    data: priceData,
    isLoading: isPriceLoading,
    error: priceError,
    refetch: refetchPrices,
  } = useQuery({
    queryKey: ["price-lists", selectedProduct?.id],
    queryFn: () => api.get(`/price-lists/?product_id=${selectedProduct.id}&limit=100`),
    enabled: !!selectedProduct,
    staleTime: 60_000,
    retry: false,
  });
  const priceRows =
    priceData?.items ?? (Array.isArray(priceData) ? priceData : []);

  const bestPrice = priceRows.length
    ? Math.min(...priceRows.map((r) => r.net_price ?? Infinity))
    : null;

  const handleSelectRow = useCallback((row) => {
    const key = `${row.provider_id}-${row.product_code}`;
    setSelectedRows((prev) => {
      const exists = prev.find((r) => `${r.provider_id}-${r.product_code}` === key);
      if (exists) return prev.filter((r) => `${r.provider_id}-${r.product_code}` !== key);
      if (prev.length >= 4) return prev;
      return [...prev, row];
    });
  }, []);

  const isRowSelected = (row) =>
    !!selectedRows.find(
      (r) =>
        `${r.provider_id}-${r.product_code}` === `${row.provider_id}-${row.product_code}`
    );

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const handleUploadSuccess = useCallback(
    (count) => {
      setShowUpload(false);
      showToast(`${count} productos actualizados correctamente`, "success");
      if (selectedProduct) refetchPrices();
    },
    [selectedProduct, refetchPrices, showToast]
  );

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setSearchInput(p.name);
    setDebouncedSearch("");
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchInput("");
    setDebouncedSearch("");
  };

  const showDropdown =
    debouncedSearch.length >= 2 && !selectedProduct && !isSearching && products.length > 0;
  const showEmpty =
    debouncedSearch.length >= 2 && !selectedProduct && !isSearching && products.length === 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center">
            <GitCompare size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comparador de Precios</h1>
            <p className="text-sm text-gray-500">
              Compará el mismo producto entre distintos proveedores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          <Upload size={16} /> Cargar Lista de Precios
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          {isSearching && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin"
            />
          )}
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código de barras..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (selectedProduct) setSelectedProduct(null);
            }}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
          />
        </div>

        {/* Dropdown results */}
        {showDropdown && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto shadow-sm">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProduct(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition"
              >
                <Package size={16} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    SKU: {p.sku || "—"} · Código: {p.code || "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {showEmpty && (
          <p className="text-sm text-center text-gray-400 py-2">
            No se encontraron productos para &ldquo;{debouncedSearch}&rdquo;
          </p>
        )}

        {selectedProduct && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
            <Package size={15} className="text-blue-600 shrink-0" />
            <span className="text-blue-800 font-medium flex-1 truncate">
              {selectedProduct.name}
            </span>
            {selectedProduct.sku && (
              <span className="text-xs text-blue-500 font-mono">{selectedProduct.sku}</span>
            )}
            <button
              onClick={handleClearProduct}
              className="p-0.5 hover:bg-blue-200 rounded text-blue-600"
              title="Limpiar selección"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Price Table ─────────────────────────────────────────────────────── */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Precios por proveedor</span>
              {priceRows.length > 0 && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {priceRows.length} {priceRows.length === 1 ? "registro" : "registros"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedRows.length >= 2 && (
                <button
                  onClick={() => setShowCompare(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 transition"
                >
                  <GitCompare size={13} />
                  Comparar seleccionados ({selectedRows.length})
                </button>
              )}
              <button
                onClick={() => refetchPrices()}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition"
                title="Actualizar precios"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {isPriceLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 size={22} className="animate-spin text-blue-600" />
              <span className="text-sm">Cargando precios...</span>
            </div>
          ) : priceError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-sm text-red-500 text-center max-w-xs">
                {priceError.message.includes("404")
                  ? "El módulo de listas de precios aún no está disponible en el servidor."
                  : priceError.message}
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition mt-1"
              >
                <Upload size={13} /> Cargar primera lista
              </button>
            </div>
          ) : priceRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <SlidersHorizontal size={32} className="text-gray-300" />
              <p className="text-sm">No hay listas de precios para este producto</p>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
              >
                <Upload size={13} /> Cargar primera lista
              </button>
            </div>
          ) : (
            <>
              {selectedRows.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100 text-xs text-violet-700">
                  <Check size={13} />
                  {selectedRows.length} de 4 seleccionados para comparar.
                  {selectedRows.length < 4
                    ? ` Podés seleccionar ${4 - selectedRows.length} más.`
                    : " Límite alcanzado."}
                  {selectedRows.length >= 2 && (
                    <button
                      onClick={() => setShowCompare(true)}
                      className="ml-auto underline underline-offset-2 hover:text-violet-900"
                    >
                      Ver comparación →
                    </button>
                  )}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="py-3 px-4 w-8"></th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Proveedor</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Descripción</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Precio Lista</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">% Desc.</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Precio Neto</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Stock</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Última Act.</th>
                      <th className="py-3 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceRows.map((row) => (
                      <PriceRow
                        key={`${row.provider_id}-${row.product_code}-${row.id ?? row.provider_id}`}
                        row={row}
                        isBest={row.net_price != null && row.net_price === bestPrice}
                        isSelected={isRowSelected(row)}
                        onSelect={handleSelectRow}
                        onHistoryClick={setHistoryItem}
                        canSelectMore={selectedRows.length < 4}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────────── */}
      {!selectedProduct && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <GitCompare size={32} className="text-gray-300" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-medium text-gray-500">
              Buscá un producto para comparar precios
            </p>
            <p className="text-sm">
              Ingresá el nombre, SKU o código de barras (mínimo 2 caracteres)
            </p>
          </div>
        </div>
      )}

      {/* ── Modals & Overlays ───────────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          providers={providers}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {historyItem && (
        <HistoryDrawer item={historyItem} onClose={() => setHistoryItem(null)} />
      )}

      {showCompare && selectedRows.length >= 2 && (
        <CompareView items={selectedRows} onClose={() => setShowCompare(false)} />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
