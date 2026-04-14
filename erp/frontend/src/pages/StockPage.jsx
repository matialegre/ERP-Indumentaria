import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { exportCSV, exportExcel } from "../lib/exportUtils";
import { useOnlineStatus } from "../hooks/useOffline";
import { getAll, enqueueOp } from "../lib/offlineDB";
import Pagination from "../components/Pagination";
import {
  Warehouse,
  Search,
  Package,
  ArrowUpDown,
  Plus,
  Minus,
  History,
  X,
  Download,
  WifiOff,
  AlertTriangle,
} from "lucide-react";

const badge = (text, color) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>
);

const PAGE_SIZE = 100;

export default function StockPage() {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("inventory");
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const [movPage, setMovPage] = useState(1);
  const [checked, setChecked] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("stock_ctrl") || "[]")); } catch { return new Set(); }
  });
  const [brandMap, setBrandMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stock_ctrl_brands") || "{}"); } catch { return {}; }
  });

  const { data: stockData, isLoading } = useQuery({
    queryKey: ["stock", search, filter, stockPage, online],
    queryFn: async () => {
      if (!online) {
        let cached = await getAll("catalogStock");
        if (search) {
          const s = search.toLowerCase();
          cached = cached.filter(i =>
            (i.product_name || "").toLowerCase().includes(s) ||
            (i.sku || "").toLowerCase().includes(s) ||
            (i.color || "").toLowerCase().includes(s) ||
            (i.size || "").toLowerCase().includes(s)
          );
        }
        if (filter === "low") cached = cached.filter(i => (i.stock || 0) > 0 && (i.stock || 0) <= 5);
        if (filter === "out") cached = cached.filter(i => (i.stock || 0) === 0);
        const start = (stockPage - 1) * PAGE_SIZE;
        return { items: cached.slice(start, start + PAGE_SIZE), total: cached.length, source: "cache" };
      }
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter === "low") params.set("low_stock", "true");
      if (filter === "out") params.set("out_of_stock", "true");
      params.set("skip", (stockPage - 1) * PAGE_SIZE);
      params.set("limit", PAGE_SIZE);
      return api.get(`/stock/?${params}`);
    },
  });
  const stock = stockData?.items ?? [];
  const stockTotal = stockData?.total ?? 0;

  useEffect(() => { setStockPage(1); }, [search, filter]);

  useEffect(() => {
    if (!stock.length) return;
    setBrandMap(prev => {
      const next = { ...prev };
      stock.forEach(item => { if (item.variant_id) next[item.variant_id] = item.brand || "Sin marca"; });
      localStorage.setItem("stock_ctrl_brands", JSON.stringify(next));
      return next;
    });
  }, [stock]);

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("stock_ctrl", JSON.stringify([...next]));
      return next;
    });
  }

  function togglePageAll() {
    const ids = stock.map(i => i.variant_id);
    const allChecked = ids.every(id => checked.has(id));
    setChecked(prev => {
      const next = new Set(prev);
      ids.forEach(id => allChecked ? next.delete(id) : next.add(id));
      localStorage.setItem("stock_ctrl", JSON.stringify([...next]));
      return next;
    });
  }

  function resetControl() {
    setChecked(new Set());
    localStorage.removeItem("stock_ctrl");
  }

  const { data: movData } = useQuery({
    queryKey: ["stock-movements", movPage],
    queryFn: () => api.get(`/stock/movements?skip=${(movPage - 1) * PAGE_SIZE}&limit=${PAGE_SIZE}`),
    enabled: view === "movements",
  });
  const movements = movData?.items ?? [];
  const movTotal = movData?.total ?? 0;

  const { data: summary } = useQuery({
    queryKey: ["stock-summary"],
    queryFn: () => api.get("/stock/summary"),
  });

  // Low stock alert: fetch a larger set to detect items with stock ≤ 5
  const { data: lowStockData } = useQuery({
    queryKey: ["stock-low-alert"],
    queryFn: () => api.get("/stock/?low_stock=true&limit=500"),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
  const lowStockItems = useMemo(() => {
    const items = lowStockData?.items ?? [];
    return items.filter(i => (i.stock ?? i.quantity ?? 0) > 0 && (i.stock ?? i.quantity ?? 0) <= 5);
  }, [lowStockData]);

  const { data: brandsSummary } = useQuery({
    queryKey: ["stock-brands-summary"],
    queryFn: () => api.get("/stock/brands-summary"),
  });

  const brandCheckedCounts = useMemo(() => {
    const counts = {};
    checked.forEach(id => {
      const brand = brandMap[id] || "Sin marca";
      counts[brand] = (counts[brand] || 0) + 1;
    });
    return counts;
  }, [checked, brandMap]);

  const adjustMut = useMutation({
    mutationFn: async (data) => {
      if (online) {
        return api.post("/stock/adjust", data);
      }
      // Offline: encolar ajuste para sync posterior
      await enqueueOp("STOCK_ADJUST", "POST", "/stock/adjust", data);
      return { ok: true, offline: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-summary"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      setAdjustModal(null);
      setAdjustQty("");
      setAdjustNotes("");
    },
  });

  function handleAdjust(e) {
    e.preventDefault();
    const qty = parseInt(adjustQty);
    if (!qty || isNaN(qty)) return;
    adjustMut.mutate({ variant_id: adjustModal.variant_id, quantity: qty, notes: adjustNotes || null });
  }

  const movTypeColors = {
    INGRESO: "bg-green-100 text-green-700",
    EGRESO: "bg-red-100 text-red-700",
    AJUSTE: "bg-blue-100 text-blue-700",
    TRANSFERENCIA: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={24} /> Stock e Inventario
            {!online && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                <WifiOff size={12} /> Cache local
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Control de existencias por variante</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(stock, `inventario-${new Date().toISOString().slice(0,10)}`, [
              {key: 'product_name', label: 'Producto'},
              {key: 'sku', label: 'SKU'},
              {key: 'size', label: 'Talle'},
              {key: 'color', label: 'Color'},
              {key: 'brand', label: 'Marca'},
              {key: 'stock', label: 'Stock'},
            ])}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={() => exportExcel(stock, `inventario-${new Date().toISOString().slice(0,10)}`, [
              {key: 'product_name', label: 'Producto'},
              {key: 'sku', label: 'SKU'},
              {key: 'size', label: 'Talle'},
              {key: 'color', label: 'Color'},
              {key: 'brand', label: 'Marca'},
              {key: 'stock', label: 'Stock'},
            ])}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
          >
            <Download size={16} /> Excel
          </button>
          <button onClick={() => setView("inventory")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "inventory" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            <Package size={16} className="inline mr-1" /> Inventario
          </button>
          <button onClick={() => setView("movements")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === "movements" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
            <History size={16} className="inline mr-1" /> Movimientos
          </button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {lowStockItems.length} producto{lowStockItems.length !== 1 ? 's' : ''} con stock bajo (≤5 unidades)
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {lowStockItems.slice(0, 10).map(item => (
              <span key={item.variant_id || item.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                {item.product_name || item.name} ({item.stock ?? item.quantity} uds)
              </span>
            ))}
            {lowStockItems.length > 10 && (
              <span className="text-xs text-amber-600">+{lowStockItems.length - 10} más</span>
            )}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Productos", value: summary.total_products, color: "text-blue-600" },
            { label: "Variantes", value: summary.total_variants, color: "text-indigo-600" },
            { label: "Unidades totales", value: summary.total_units.toLocaleString(), color: "text-emerald-600" },
            { label: "Stock bajo (<5)", value: summary.low_stock_count, color: "text-amber-600" },
            { label: "Sin stock", value: summary.out_of_stock_count, color: "text-red-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {brandsSummary && brandsSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-700">Control de stock por marca</span>
              <span className="ml-2 text-sm text-gray-500">{checked.size} / {summary?.total_variants ?? 0} variantes controladas</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-emerald-600">
                {summary?.total_variants > 0 ? Math.round((checked.size / summary.total_variants) * 100) : 0}%
              </span>
              {checked.size > 0 && (
                <button onClick={resetControl} className="text-xs text-gray-400 hover:text-red-500 underline transition">Reiniciar</button>
              )}
            </div>
          </div>
          {brandsSummary.map(({ brand, total_variants }) => {
            const checkedCount = brandCheckedCounts[brand] || 0;
            const pct = total_variants > 0 ? Math.min((checkedCount / total_variants) * 100, 100) : 0;
            const barColor = pct >= 100 ? "#16a34a" : pct > 60 ? "#22c55e" : pct > 30 ? "#f59e0b" : "#94a3b8";
            return (
              <div key={brand}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-gray-700">{brand}</span>
                  <span className="text-xs text-gray-500">{checkedCount}/{total_variants} · {Math.round(pct)}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "inventory" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar por nombre, código o SKU..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
              <option value="all">Todos</option>
              <option value="low">Stock bajo (&lt;5)</option>
              <option value="out">Sin stock</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">Cargando inventario...</div>
            ) : stock.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No se encontraron variantes</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-center w-10">
                        <input type="checkbox"
                          checked={stock.length > 0 && stock.every(i => checked.has(i.variant_id))}
                          onChange={togglePageAll}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          title="Marcar/desmarcar página"
                        />
                      </th>
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-left">Talle</th>
                      <th className="px-4 py-3 text-left">Color</th>
                      <th className="px-4 py-3 text-left">Marca</th>
                      <th className="px-4 py-3 text-center">Stock</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-center">Ajustar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stock.map((item) => (
                      <tr key={item.variant_id} className={`hover:bg-gray-50 ${checked.has(item.variant_id) ? "bg-emerald-50/40" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox"
                            checked={checked.has(item.variant_id)}
                            onChange={() => toggleCheck(item.variant_id)}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div>{item.product_name}</div>
                          <div className="text-xs text-gray-400">{item.product_code}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                        <td className="px-4 py-3">{item.size}</td>
                        <td className="px-4 py-3">{item.color}</td>
                        <td className="px-4 py-3 text-gray-500">{item.brand || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${item.stock <= 0 ? "text-red-600" : item.stock < 5 ? "text-amber-600" : "text-emerald-600"}`}>{item.stock}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.stock <= 0 ? badge("Sin stock", "bg-red-100 text-red-700") : item.stock < 5 ? badge("Bajo", "bg-amber-100 text-amber-700") : badge("OK", "bg-green-100 text-green-700")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setAdjustModal({ variant_id: item.variant_id, sku: item.sku, stock: item.stock, product_name: item.product_name })}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Ajustar stock">
                            <ArrowUpDown size={16} />
                          </button>
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

      {view === "inventory" && (
        <Pagination total={stockTotal} skip={(stockPage - 1) * PAGE_SIZE} limit={PAGE_SIZE} onPageChange={setStockPage} />
      )}

      {view === "movements" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">Movimientos de stock</h3>
          </div>
          {movements.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Sin movimientos registrados</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Cantidad</th>
                    <th className="px-4 py-3 text-left">Referencia</th>
                    <th className="px-4 py-3 text-left">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3">{badge(m.type, movTypeColors[m.type] || "bg-gray-100 text-gray-700")}</td>
                      <td className="px-4 py-3 font-medium">{m.product_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{m.variant_sku || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${m.quantity > 0 ? "text-green-600" : "text-red-600"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{m.reference || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{m.created_by_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "movements" && (
        <Pagination total={movTotal} skip={(movPage - 1) * PAGE_SIZE} limit={PAGE_SIZE} onPageChange={setMovPage} />
      )}

      {adjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Ajustar Stock</h2>
              <button onClick={() => setAdjustModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdjust} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{adjustModal.product_name}</p>
                <p className="text-sm text-gray-500">SKU: {adjustModal.sku} — Stock actual: <b>{adjustModal.stock}</b></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (+ sumar, − restar)</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdjustQty(String(Math.max((parseInt(adjustQty) || 0) - 1, -9999)))} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><Minus size={16} /></button>
                  <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-emerald-500" placeholder="0" required />
                  <button type="button" onClick={() => setAdjustQty(String((parseInt(adjustQty) || 0) + 1))} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Plus size={16} /></button>
                </div>
                {adjustQty && <p className="text-xs mt-1 text-gray-500">Resultado: {adjustModal.stock} → <b>{adjustModal.stock + (parseInt(adjustQty) || 0)}</b></p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <input type="text" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Motivo del ajuste..." />
              </div>
              {adjustMut.error && <p className="text-sm text-red-600">{adjustMut.error.message}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setAdjustModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={adjustMut.isPending || !adjustQty || parseInt(adjustQty) === 0} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {adjustMut.isPending ? "Guardando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
