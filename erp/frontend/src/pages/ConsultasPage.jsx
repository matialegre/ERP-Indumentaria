import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useOnlineStatus } from "../hooks/useOffline";
import { getAll } from "../lib/offlineDB";
import {
  Search, Package, Store, BarChart2, Copy, Check,
  Plus, Trash2, ArrowRight, ChevronLeft, Loader2, AlertTriangle, Camera, WifiOff,
} from "lucide-react";
import BarcodeScanner from "../components/BarcodeScanner";

// Búsqueda offline de productos en IndexedDB
async function searchProductsOffline(query) {
  const products = await getAll("catalogProducts");
  const stock = await getAll("catalogStock");
  const q = query.toLowerCase();
  const matched = products.filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.code || "").toLowerCase().includes(q) ||
    (p.brand || "").toLowerCase().includes(q) ||
    (p.variants || []).some(v =>
      (v.sku || "").toLowerCase().includes(q) ||
      (v.barcode || "").toLowerCase().includes(q)
    )
  );
  return matched.map(p => ({
    ...p,
    variants: (p.variants || []).map(v => {
      const s = stock.find(st => st.variant_id === v.id);
      return { ...v, stock: s?.stock ?? 0 };
    }),
    _offline: true,
  }));
}

// Buscar por barcode en catálogo offline
async function findByBarcodeOffline(barcode) {
  const products = await getAll("catalogProducts");
  const stock = await getAll("catalogStock");
  for (const p of products) {
    for (const v of (p.variants || [])) {
      if (v.sku === barcode || v.barcode === barcode) {
        const s = stock.find(st => st.variant_id === v.id);
        return {
          found: true,
          descripcion: p.name,
          marca: p.brand,
          codigo: v.sku,
          talle: v.size,
          color: v.color,
          precio_compra: p.base_cost,
          precio_venta: v.price || p.base_cost,
          stock: s?.stock ?? 0,
          _offline: true,
        };
      }
    }
  }
  return { found: false, _offline: true };
}

/* ── Helpers ─────────────────────────────────────────────── */
const fmt = (num) => {
  if (num == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", minimumFractionDigits: 2,
  }).format(num);
};

function stockColorClass(qty) {
  if (qty === 0) return "text-gray-400";
  if (qty <= 3) return "text-red-600 font-bold";
  if (qty <= 10) return "text-amber-600 font-semibold";
  return "text-emerald-600 font-semibold";
}

function stockBadgeClass(qty) {
  if (qty === 0) return "bg-gray-100 text-gray-500";
  if (qty <= 3) return "bg-red-100 text-red-700";
  if (qty <= 10) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — Precio / Stock
══════════════════════════════════════════════════════════ */
function ProductCard({ precio, stock, stockReal }) {
  return (
    <div className="space-y-4">
      {precio?.found && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{precio.descripcion || "—"}</h3>
            {precio.marca && <p className="text-sm font-medium text-gray-500 mt-0.5">{precio.marca}</p>}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Precios</p>
            <div className="flex flex-wrap gap-3">
              {precio.precio_compra != null && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center min-w-[140px]">
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Precio Compra</p>
                  <p className="text-2xl font-bold text-blue-700">{fmt(precio.precio_compra)}</p>
                </div>
              )}
              {precio.precio_venta != null && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center min-w-[140px]">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide mb-1">Venta Público</p>
                  <p className="text-2xl font-bold text-emerald-700">{fmt(precio.precio_venta)}</p>
                </div>
              )}
              {precio.precio_ml != null && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center min-w-[140px]">
                  <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Precio ML</p>
                  <p className="text-2xl font-bold text-orange-700">{fmt(precio.precio_ml)}</p>
                </div>
              )}
            </div>
            {precio.precios && Object.keys(precio.precios).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Otros precios</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(precio.precios).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500">{k}</p>
                      <p className="text-sm font-bold text-gray-800">{fmt(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {stockReal?.found && (
        <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-700">Stock por local</p>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Stock actualizado</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${stockBadgeClass(stockReal.stock_total ?? 0)}`}>
              Total: {stockReal.stock_total ?? 0}
            </span>
          </div>
          {!stockReal.por_local?.length ? (
            <p className="px-5 py-6 text-center text-gray-400 text-sm">Sin stock registrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Local</th>
                    <th className="px-4 py-2.5 text-left">Talle</th>
                    <th className="px-4 py-2.5 text-left">Color</th>
                    <th className="px-4 py-2.5 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stockReal.por_local.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.local}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.talle || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.color || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-base ${stockColorClass(row.stock)}`}>{row.stock}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {stock?.found && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-700">Stock por local</p>
              {stockReal?.found && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Stock catálogo</span>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${stockBadgeClass(stock.stock_total ?? 0)}`}>
              Total: {stock.stock_total ?? 0}
            </span>
          </div>
          {!stock.por_local?.length ? (
            <p className="px-5 py-6 text-center text-gray-400 text-sm">Sin stock registrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Local</th>
                    <th className="px-4 py-2.5 text-left">Talle</th>
                    <th className="px-4 py-2.5 text-left">Color</th>
                    <th className="px-4 py-2.5 text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stock.por_local.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.local}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.talle || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.color || "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-base ${stockColorClass(row.cantidad)}`}>{row.cantidad}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabPrecioStock() {
  const online = useOnlineStatus();
  const [mode, setMode] = useState("barcode");
  const [inputValue, setInputValue] = useState("");
  const [activeBarcode, setActiveBarcode] = useState("");
  const [activeText, setActiveText] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeDetailBarcode, setActiveDetailBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Online: usa API legacy. Offline: busca en IndexedDB
  const { data: precioData, isFetching: loadingPrecio, error: errorPrecio } = useQuery({
    queryKey: ["legacy-precio", activeBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/precio/${activeBarcode}`)
      : findByBarcodeOffline(activeBarcode),
    enabled: !!activeBarcode,
    retry: online ? 1 : 0,
  });

  const { data: stockData, isFetching: loadingStock } = useQuery({
    queryKey: ["legacy-stock", activeBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/stock/${activeBarcode}`)
      : findByBarcodeOffline(activeBarcode).then(r => r.found ? { encontrado: true, stock_total: r.stock } : { encontrado: false }),
    enabled: !!activeBarcode,
    retry: online ? 1 : 0,
  });

  const { data: stockRealData, isFetching: loadingStockReal } = useQuery({
    queryKey: ["legacy-stocks-real", activeBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/stocks/${activeBarcode}`)
      : Promise.resolve({ items: [] }),
    enabled: !!activeBarcode && online,
    retry: 1,
  });

  const { data: searchData, isFetching: loadingDesc } = useQuery({
    queryKey: ["legacy-buscar", activeText, online],
    queryFn: () => online
      ? api.get(`/legacy/buscar-producto?q=${encodeURIComponent(activeText)}&con_stock=true`)
      : searchProductsOffline(activeText).then(items => ({ items })),
    enabled: !!activeText,
    retry: online ? 1 : 0,
  });

  const { data: detailPrecio, isFetching: loadingDetailPrecio } = useQuery({
    queryKey: ["legacy-precio-detail", activeDetailBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/precio/${activeDetailBarcode}`)
      : findByBarcodeOffline(activeDetailBarcode),
    enabled: !!activeDetailBarcode,
    retry: online ? 1 : 0,
  });

  const { data: detailStock, isFetching: loadingDetailStock } = useQuery({
    queryKey: ["legacy-stock-detail", activeDetailBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/stock/${activeDetailBarcode}`)
      : findByBarcodeOffline(activeDetailBarcode).then(r => r.found ? { encontrado: true, stock_total: r.stock } : { encontrado: false }),
    enabled: !!activeDetailBarcode,
    retry: online ? 1 : 0,
  });

  const { data: detailStockReal, isFetching: loadingDetailStockReal } = useQuery({
    queryKey: ["legacy-stocks-real-detail", activeDetailBarcode, online],
    queryFn: () => online
      ? api.get(`/legacy/stocks/${activeDetailBarcode}`)
      : Promise.resolve({ items: [] }),
    enabled: !!activeDetailBarcode && online,
    retry: 1,
  });

  const isLoading = loadingPrecio || loadingStock || loadingStockReal || loadingDesc || loadingDetailPrecio || loadingDetailStock || loadingDetailStockReal;

  function handleModeChange(m) {
    setMode(m);
    setInputValue("");
    setActiveBarcode("");
    setActiveText("");
    setSelectedProduct(null);
    setActiveDetailBarcode("");
  }

  function handleScan(barcode) {
    setInputValue(barcode);
    if (mode === "barcode") {
      setActiveBarcode(barcode);
    } else {
      setActiveText(barcode);
      setSelectedProduct(null);
      setActiveDetailBarcode("");
    }
  }

  function handleSearch() {
    const v = inputValue.trim();
    if (!v) return;
    if (mode === "barcode") {
      setActiveBarcode(v);
    } else {
      setActiveText(v);
      setSelectedProduct(null);
      setActiveDetailBarcode("");
    }
  }

  function handleSelectProduct(p) {
    setSelectedProduct(p);
    setActiveDetailBarcode(p.cod_barras);
  }

  const showPrecio = mode === "barcode" ? precioData : detailPrecio;
  const showStock  = mode === "barcode" ? stockData  : detailStock;
  const showStockReal = mode === "barcode" ? stockRealData : detailStockReal;
  const showLoading = mode === "barcode"
    ? (loadingPrecio || loadingStock || loadingStockReal)
    : selectedProduct
      ? (loadingDetailPrecio || loadingDetailStock || loadingDetailStockReal)
      : loadingDesc;

  const notFound = mode === "barcode" && activeBarcode && !loadingPrecio && !loadingStock && !loadingStockReal
    && precioData && !precioData.found && stockData && !stockData.found && stockRealData && !stockRealData.found;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleModeChange("barcode")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === "barcode" ? "bg-cyan-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Por código de barras
        </button>
        <button
          onClick={() => handleModeChange("desc")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === "desc" ? "bg-cyan-600 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Por descripción
        </button>
      </div>

      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={mode === "barcode" ? "Ingresá el código de barras..." : "Ingresá la descripción del producto..."}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            autoFocus
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !inputValue.trim()}
          className="px-5 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 transition"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
        {mode === "barcode" && (
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
            title="Escanear con cámara"
          >
            <Camera size={16} /> Scan
          </button>
        )}
      </div>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {/* Error */}
      {errorPrecio && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={16} /> {errorPrecio.message}
        </div>
      )}

      {/* Loading */}
      {showLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Loader2 size={32} className="animate-spin text-cyan-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Buscando...</p>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Package size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Producto no encontrado</p>
          <p className="text-gray-400 text-sm mt-1">No se encontró ningún artículo con el código "{activeBarcode}"</p>
        </div>
      )}

      {/* Description results list */}
      {mode === "desc" && activeText && searchData && !selectedProduct && !loadingDesc && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">
              {searchData.total ?? searchData.results?.length ?? 0} resultados para &ldquo;{activeText}&rdquo;
            </span>
          </div>
          {!searchData.results?.length ? (
            <p className="p-8 text-center text-gray-400">No se encontraron productos</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {searchData.results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectProduct(r)}
                  className="w-full px-4 py-3 text-left hover:bg-cyan-50 flex items-center justify-between gap-4 transition"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{r.descripcion}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                      <span className="font-mono">{r.cod_barras}</span>
                      {r.marca && <span>{r.marca}</span>}
                      {r.talle && <span>T:{r.talle}</span>}
                      {r.color && <span>{r.color}</span>}
                      {r.local && <span>{r.local}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stockBadgeClass(r.stock ?? 0)}`}>
                      Stock: {r.stock ?? 0}
                    </span>
                    <ArrowRight size={16} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Back button for description detail */}
      {mode === "desc" && selectedProduct && (
        <button
          onClick={() => { setSelectedProduct(null); setActiveDetailBarcode(""); }}
          className="flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-700 font-medium transition"
        >
          <ChevronLeft size={16} /> Volver a resultados
        </button>
      )}

      {/* Product detail card */}
      {!showLoading && (showPrecio?.found || showStock?.found || showStockReal?.found) && (
        <ProductCard precio={showPrecio} stock={showStock} stockReal={showStockReal} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — Buscar RV
══════════════════════════════════════════════════════════ */
function TabBuscarRV() {
  const [inputValue, setInputValue] = useState("");
  const [activeRv, setActiveRv] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const { data: rvData, isFetching: loadingRV, error: rvError } = useQuery({
    queryKey: ["legacy-rv", activeRv],
    queryFn: () => api.get(`/legacy/buscar-rv?numero=${encodeURIComponent(activeRv)}`),
    enabled: !!activeRv,
    retry: 1,
  });

  function handleBuscar() {
    const v = inputValue.trim();
    if (!v) return;
    setActiveRv(v);
  }

  function handleCopy(rv) {
    navigator.clipboard.writeText(rv)
      .then(() => {
        setCopiedId(rv);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <span className="mt-0.5">ℹ️</span>
        <span><strong>Nota:</strong> Este número se usará como Remito de Venta (RV) en las facturas.</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="Ej: R00002-00122864"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            autoFocus
          />
        </div>
        <button
          onClick={handleBuscar}
          disabled={loadingRV || !inputValue.trim()}
          className="px-5 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 transition"
        >
          {loadingRV ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar RV
        </button>
      </div>

      {rvError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={16} /> {rvError.message}
        </div>
      )}

      {loadingRV && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Loader2 size={32} className="animate-spin text-cyan-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Buscando...</p>
        </div>
      )}

      {rvData && !loadingRV && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">
              {rvData.found
                ? `${rvData.matches?.length ?? 0} resultado(s) encontrado(s)`
                : "Sin resultados"}
            </span>
          </div>
          {!rvData.found || !rvData.matches?.length ? (
            <p className="px-5 py-8 text-center text-gray-400">
              No se encontró ningún RV con el número &ldquo;{activeRv}&rdquo;
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Nro Interno (RV)</th>
                    <th className="px-5 py-3 text-left">Fecha</th>
                    <th className="px-5 py-3 text-center">Cantidad Total</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rvData.matches.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono font-semibold text-gray-900">{m.nro_interno}</td>
                      <td className="px-5 py-3 text-gray-600">{m.fecha || "—"}</td>
                      <td className="px-5 py-3 text-center font-semibold text-gray-800">{m.cantidad_total}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleCopy(m.nro_interno)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-cyan-100 text-gray-700 hover:text-cyan-700 rounded-lg text-xs font-medium transition"
                        >
                          {copiedId === m.nro_interno
                            ? <><Check size={13} className="text-emerald-600" /> Copiado</>
                            : <><Copy size={13} /> Copiar RV</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 3 — Comparar Precios
══════════════════════════════════════════════════════════ */
const MAX_ITEMS = 20;

function TabCompararPrecios() {
  const today = new Date().toISOString().split("T")[0];
  const [items, setItems] = useState([{ cod_barras: "", fecha_np: "", fecha_fac: today }]);

  const compareMut = useMutation({
    mutationFn: (data) => api.post("/legacy/comparar-precios", data),
  });

  function addItem() {
    if (items.length >= MAX_ITEMS) return;
    const last = items[items.length - 1];
    setItems((p) => [...p, {
      cod_barras: "",
      fecha_np: last?.fecha_np || "",
      fecha_fac: last?.fecha_fac || today,
    }]);
  }

  function removeItem(idx) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItems((p) => p.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function handleComparar() {
    const valid = items.filter((i) => i.cod_barras.trim());
    if (!valid.length) return;
    compareMut.mutate(valid);
  }

  function pctColor(pct) {
    if (pct == null) return "text-gray-500";
    if (pct > 5)  return "text-red-600 font-bold";
    if (pct > 1)  return "text-amber-600 font-semibold";
    if (pct <= 0) return "text-emerald-600 font-semibold";
    return "text-gray-600";
  }

  function rowBg(pct) {
    if (pct == null) return "";
    if (pct > 5) return "bg-red-50/60";
    if (pct > 1) return "bg-amber-50/60";
    return "";
  }

  const results = compareMut.data;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Artículos a comparar ({items.length}/{MAX_ITEMS})
          </p>
          <button
            onClick={addItem}
            disabled={items.length >= MAX_ITEMS}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-medium transition disabled:opacity-40"
          >
            <Plus size={14} /> Agregar fila
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left">Código de Barras</th>
                <th className="px-4 py-2.5 text-left">Fecha NP</th>
                <th className="px-4 py-2.5 text-left">Fecha Factura</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.cod_barras}
                      onChange={(e) => updateItem(i, "cod_barras", e.target.value)}
                      placeholder="Código de barras"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={item.fecha_np}
                      onChange={(e) => updateItem(i, "fecha_np", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={item.fecha_fac}
                      onChange={(e) => updateItem(i, "fecha_fac", e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleComparar}
            disabled={compareMut.isPending || !items.some((i) => i.cod_barras.trim())}
            className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 transition"
          >
            {compareMut.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <BarChart2 size={16} />}
            Comparar
          </button>
        </div>
      </div>

      {compareMut.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={16} /> {compareMut.error.message}
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">{results.length} artículo(s) comparados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">SKU / Código</th>
                  <th className="px-4 py-2.5 text-right">Precio NP</th>
                  <th className="px-4 py-2.5 text-right">Precio Factura</th>
                  <th className="px-4 py-2.5 text-right">Diferencia</th>
                  <th className="px-4 py-2.5 text-right">% Cambio</th>
                  <th className="px-4 py-2.5 text-center">Alerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${rowBg(r.pct_cambio)}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{r.cod_barras}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(r.precio_np)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(r.precio_fac)}</td>
                    <td className={`px-4 py-3 text-right ${r.diferencia > 0 ? "text-red-600" : r.diferencia < 0 ? "text-emerald-600" : "text-gray-500"}`}>
                      {r.diferencia != null
                        ? (r.diferencia > 0 ? "+" : "") + fmt(r.diferencia)
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right ${pctColor(r.pct_cambio)}`}>
                      {r.pct_cambio != null
                        ? `${r.pct_cambio > 0 ? "+" : ""}${r.pct_cambio.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.alerta ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          <AlertTriangle size={11} /> Alerta
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                          <Check size={11} /> OK
                        </span>
                      )}
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

/* ══════════════════════════════════════════════════════════
   TAB 4 — Locales
══════════════════════════════════════════════════════════ */
function TabLocales() {
  const { data: locales = [], isLoading, error } = useQuery({
    queryKey: ["legacy-locales"],
    queryFn: () => api.get("/legacy/locales"),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <Loader2 size={32} className="animate-spin text-cyan-500 mx-auto mb-2" />
      <p className="text-gray-400 text-sm">Cargando locales...</p>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      <AlertTriangle size={16} /> {error.message}
    </div>
  );

  if (!locales.length) return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <Store size={40} className="text-gray-300 mx-auto mb-3" />
      <p className="text-gray-400">No se encontraron locales</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">{locales.length} locales registrados</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-3 text-left">Local</th>
              <th className="px-5 py-3 text-left">Empresa</th>
              <th className="px-5 py-3 text-left">Tipo</th>
              <th className="px-5 py-3 text-left">Localidad</th>
              <th className="px-5 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {locales.map((l, i) => {
              const isActive = !l.cierre;
              return (
                <tr key={i} className={`hover:bg-gray-50 ${!isActive ? "opacity-60" : ""}`}>
                  <td className="px-5 py-3 font-semibold text-gray-900">{l.local}</td>
                  <td className="px-5 py-3 text-gray-600">{l.empresa || "—"}</td>
                  <td className="px-5 py-3 text-gray-600">{l.tipo || "—"}</td>
                  <td className="px-5 py-3 text-gray-600">{l.localidad || "—"}</td>
                  <td className="px-5 py-3 text-center">
                    {isActive ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        Cerrado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
const TABS = [
  { id: "precio",   label: "Precio / Stock",   emoji: "🔍" },
  { id: "rv",       label: "Buscar RV",         emoji: "📋" },
  { id: "comparar", label: "Comparar Precios",  emoji: "💰" },
  { id: "locales",  label: "Locales",           emoji: "🏪" },
];

export default function ConsultasPage() {
  const [activeTab, setActiveTab] = useState("precio");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search size={24} /> Consultas ERP
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Consulta de precios, stock, remitos de venta y locales
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition ${
              activeTab === tab.id
                ? "border-cyan-500 text-cyan-700 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "precio"   && <TabPrecioStock />}
        {activeTab === "rv"       && <TabBuscarRV />}
        {activeTab === "comparar" && <TabCompararPrecios />}
        {activeTab === "locales"  && <TabLocales />}
      </div>
    </div>
  );
}
