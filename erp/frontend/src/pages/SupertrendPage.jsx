/**
 * SupertrendPage — Análisis de competencia, tendencias de mercado e integración ML.
 */
import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CssBarChart, CssPieChart } from "../components/CssCharts";
import { api } from "../lib/api";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  ShoppingCart,
  MessageCircle,
  Star,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  ExternalLink,
  Eye,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function directionIcon(dir) {
  if (dir === "UP")   return <TrendingUp  className="w-4 h-4 text-green-500" />;
  if (dir === "DOWN") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function directionBadge(dir) {
  const map = {
    UP:     "bg-green-100 text-green-700",
    DOWN:   "bg-red-100 text-red-700",
    STABLE: "bg-gray-100 text-gray-600",
  };
  return map[dir] ?? map.STABLE;
}

function pctColor(pct) {
  if (pct == null) return "text-gray-400";
  if (pct > 0)  return "text-red-600";   // competitor cheaper — our price higher
  if (pct < 0)  return "text-green-600"; // we're cheaper
  return "text-gray-500";
}

// ─── ID-112: Account display-name overrides ──────────────────────────────────

const ACCOUNT_LABELS = { valen: "MUNDO.OUTDOOR", neuquen: "aspen" };
function accountLabel(key, backendLabel) {
  return ACCOUNT_LABELS[key] || backendLabel || key;
}

// ─── ID-118: Shipping type label ─────────────────────────────────────────────

function shippingTypeLabel(tags, fulfillmentType) {
  if (fulfillmentType === "Full" || fulfillmentType === "Flex" || fulfillmentType === "Colecta") return fulfillmentType;
  if (Array.isArray(tags)) {
    if (tags.includes("fulfillment")) return "Full";
    if (tags.includes("flex")) return "Flex";
  }
  return "Colecta";
}

// ─── Reputation thermometer (Real Trends style) ──────────────────────────────

const RT_SEGMENTS = [
  { key: "red",        color: "#ED6B61", bg: "#FFF0F0", label: "Rojo" },
  { key: "orange",     color: "#F5B868", bg: "#FFF5E8", label: "Naranja" },
  { key: "yellow",     color: "#FDF066", bg: "#FFFCDA", label: "Amarillo" },
  { key: "light_green",color: "#BBFF1F", bg: "#F1FDD7", label: "Verde claro" },
  { key: "green",      color: "#39B54A", bg: "#EDF8EE", label: "Verde" },
];
const RT_MEDALS = {
  platinum: "MercadoLíder Platinum",
  silver:   "MercadoLíder Silver",
  gold:     "MercadoLíder Gold",
};

function ReputationThermometer({ levelId, powerSellerStatus }) {
  let colorKey = "";
  if (levelId) {
    const m = levelId.match(/^\d+_(.+)$/);
    colorKey = m ? m[1] : levelId;
  }
  const activeIdx = RT_SEGMENTS.findIndex(s => s.key === colorKey);

  return (
    <div>
      <div className="flex gap-1 items-end mb-3">
        {RT_SEGMENTS.map((s, i) => (
          <div
            key={s.key}
            style={{
              flex: 1,
              height: i === activeIdx ? 14 : 8,
              borderRadius: 4,
              backgroundColor: i <= activeIdx ? s.color : s.bg,
              transition: "all 0.3s",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {activeIdx >= 0 && (
          <span style={{ color: RT_SEGMENTS[activeIdx].color }} className="text-sm font-bold">
            {RT_SEGMENTS[activeIdx].label}
          </span>
        )}
        {powerSellerStatus && RT_MEDALS[powerSellerStatus] && (
          <span className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
            ⭐ {RT_MEDALS[powerSellerStatus]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── modal base ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Competitor modal ────────────────────────────────────────────────────────

function CompetitorModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    competitor_name: initial?.competitor_name ?? "",
    product_name: initial?.product_name ?? "",
    our_price: initial?.our_price ?? "",
    competitor_price: initial?.competitor_price ?? "",
    currency: initial?.currency ?? "ARS",
    category: initial?.category ?? "",
    notes: initial?.notes ?? "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Modal title={initial ? "Editar Competidor" : "Agregar Competidor"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Competidor *</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.competitor_name}
              onChange={e => set("competitor_name", e.target.value)} placeholder="Ej: Patagonia Store" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category}
              onChange={e => set("category", e.target.value)} placeholder="Ej: Camperas" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Producto / Artículo *</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.product_name}
            onChange={e => set("product_name", e.target.value)} placeholder="Ej: Campera Patagonia M10" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nuestro precio</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.our_price} onChange={e => set("our_price", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Precio competidor</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.competitor_price} onChange={e => set("competitor_price", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Moneda</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.currency}
              onChange={e => set("currency", e.target.value)}>
              <option>ARS</option><option>USD</option><option>EUR</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Notas</label>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => {
              if (!form.competitor_name || !form.product_name) return;
              onSave({
                ...form,
                our_price: form.our_price ? parseFloat(form.our_price) : null,
                competitor_price: form.competitor_price ? parseFloat(form.competitor_price) : null,
              });
            }}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Trend modal ─────────────────────────────────────────────────────────────

function TrendModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    indicator_name: initial?.indicator_name ?? "",
    category: initial?.category ?? "",
    direction: initial?.direction ?? "STABLE",
    strength: initial?.strength ?? 5,
    description: initial?.description ?? "",
    source: initial?.source ?? "",
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Modal title={initial ? "Editar Tendencia" : "Nueva Tendencia"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Indicador *</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.indicator_name}
            onChange={e => set("indicator_name", e.target.value)} placeholder="Ej: Demanda camperas técnicas" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category}
              onChange={e => set("category", e.target.value)} placeholder="Ej: Trekking" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dirección</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.direction}
              onChange={e => set("direction", e.target.value)}>
              <option value="UP">↑ En alza</option>
              <option value="DOWN">↓ En baja</option>
              <option value="STABLE">→ Estable</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fuerza (1–10): {form.strength}</label>
          <input type="range" min="1" max="10" className="w-full" value={form.strength}
            onChange={e => set("strength", parseInt(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            value={form.description} onChange={e => set("description", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Fuente / Referencia</label>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.source}
            onChange={e => set("source", e.target.value)} placeholder="Ej: MercadoLibre, feria, cliente" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => { if (!form.indicator_name) return; onSave(form); }}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupertrendPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard"); // dashboard | competitors | trends | ml_indicators | ml_orders | ml_questions | ml_competitors
  const [mlAccount, setMlAccount] = useState("valen"); // valen | neuquen
  const [compModal, setCompModal] = useState(null);
  const [trendModal, setTrendModal] = useState(null);
  const [answerModal, setAnswerModal] = useState(null); // { question, account }
  const [answerText, setAnswerText] = useState("");

  // ML Competitors state
  const [mlcSellerModal, setMlcSellerModal] = useState(null); // null | "add" | { id, seller_id, nickname, notes, check_interval_hours }
  const [mlcSellerForm, setMlcSellerForm] = useState({ seller_id: "", nickname: "", notes: "", check_interval_hours: 24 });
  const [mlcSelected, setMlcSelected] = useState(null); // selected tracked_seller id
  const [mlcSubTab, setMlcSubTab] = useState("items"); // items | price_changes | top_sales | stock_changes
  const [mlcExpandedItem, setMlcExpandedItem] = useState(null); // item_id for expanded variants
  const [chartGroupBy, setChartGroupBy] = useState("day"); // "day" | "week" — ID-119/120

  // Cargar cuentas configuradas
  const { data: mlAccountsList = [] } = useQuery({
    queryKey: ["ml-accounts"],
    queryFn: () => api.get("/ml/accounts"),
    staleTime: 60 * 60 * 1000,
  });

  // Queries — supertrend interno
  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["supertrend-dashboard"],
    queryFn: () => api.get("/supertrend/dashboard"),
  });

  const { data: competitors = [], isLoading: compLoading } = useQuery({
    queryKey: ["supertrend-competitors"],
    queryFn: () => api.get("/supertrend/competitors").then(r => r?.items ?? r),
    enabled: tab === "competitors",
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["supertrend-trends"],
    queryFn: () => api.get("/supertrend/trends").then(r => r?.items ?? r),
    enabled: tab === "trends",
  });

  // Queries — MercadoLibre
  const { data: mlIndicators, isLoading: mlIndLoading, refetch: refetchMlInd, error: mlIndError } = useQuery({
    queryKey: ["ml-indicators", mlAccount],
    queryFn: () => api.get(`/ml/indicators?account=${mlAccount}`),
    enabled: tab === "ml_indicators" || tab === "dashboard",
    staleTime: 5 * 60 * 1000,
  });

  const [mlOrderDays, setMlOrderDays] = useState(30);
  const { data: mlOrders, isLoading: mlOrdLoading, refetch: refetchMlOrd, error: mlOrdError } = useQuery({
    queryKey: ["ml-orders", mlOrderDays, mlAccount],
    queryFn: () => api.get(`/ml/orders?days=${mlOrderDays}&limit=50&account=${mlAccount}`),
    enabled: tab === "ml_orders" || tab === "dashboard",
    staleTime: 2 * 60 * 1000,
  });

  // Recent orders for dashboard chart (7 days)
  const { data: mlRecentOrders } = useQuery({
    queryKey: ["ml-orders-recent", mlAccount],
    queryFn: () => api.get(`/ml/orders?days=7&limit=50&account=${mlAccount}`),
    enabled: tab === "dashboard",
    staleTime: 5 * 60 * 1000,
  });

  const [mlQStatus, setMlQStatus] = useState("UNANSWERED");
  const { data: mlQuestions, isLoading: mlQLoading, refetch: refetchMlQ, error: mlQError } = useQuery({
    queryKey: ["ml-questions", mlQStatus, mlAccount],
    queryFn: () => api.get(`/ml/questions?status=${mlQStatus}&limit=50&account=${mlAccount}`),
    enabled: tab === "ml_questions",
    staleTime: 60 * 1000,
  });

  const ML_SELLER_IDS = { valen: "209611492", neuquen: "756086955" };
  const { data: webhookQuestions = [], refetch: refetchWhQ } = useQuery({
    queryKey: ["ml-webhook-questions-st", mlAccount],
    queryFn: () => api.get(`/ml/webhook/questions?seller_id=${ML_SELLER_IDS[mlAccount] || ""}&limit=10&hours=72`),
    enabled: tab === "ml_questions",
    refetchInterval: 15_000,
  });

  // Mutations — competitors
  const createComp = useMutation({
    mutationFn: d => api.post("/supertrend/competitors", d),
    onSuccess: () => { qc.invalidateQueries(["supertrend-competitors"]); qc.invalidateQueries(["supertrend-dashboard"]); setCompModal(null); },
  });
  const updateComp = useMutation({
    mutationFn: ({ id, ...d }) => api.put(`/supertrend/competitors/${id}`, d),
    onSuccess: () => { qc.invalidateQueries(["supertrend-competitors"]); qc.invalidateQueries(["supertrend-dashboard"]); setCompModal(null); },
  });
  const deleteComp = useMutation({
    mutationFn: id => api.delete(`/supertrend/competitors/${id}`),
    onSuccess: () => { qc.invalidateQueries(["supertrend-competitors"]); qc.invalidateQueries(["supertrend-dashboard"]); },
  });

  // Mutations — trends
  const createTrend = useMutation({
    mutationFn: d => api.post("/supertrend/trends", d),
    onSuccess: () => { qc.invalidateQueries(["supertrend-trends"]); qc.invalidateQueries(["supertrend-dashboard"]); setTrendModal(null); },
  });
  const updateTrend = useMutation({
    mutationFn: ({ id, ...d }) => api.put(`/supertrend/trends/${id}`, d),
    onSuccess: () => { qc.invalidateQueries(["supertrend-trends"]); qc.invalidateQueries(["supertrend-dashboard"]); setTrendModal(null); },
  });
  const deleteTrend = useMutation({
    mutationFn: id => api.delete(`/supertrend/trends/${id}`),
    onSuccess: () => { qc.invalidateQueries(["supertrend-trends"]); qc.invalidateQueries(["supertrend-dashboard"]); },
  });

  // Mutation — ML answer
  const sendAnswer = useMutation({
    mutationFn: ({ id, text, account }) => api.post(`/ml/questions/${id}/answer`, { text, account }),
    onSuccess: () => { qc.invalidateQueries(["ml-questions"]); setAnswerModal(null); setAnswerText(""); },
  });

  // ── ML Competitor Tracker queries ──
  const { data: mlcSellers = [], isLoading: mlcSellersLoading, refetch: mlcRefetchSellers } = useQuery({
    queryKey: ["mlc-sellers"],
    queryFn: () => api.get("/supertrend/ml-sellers").then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors",
  });
  const { data: mlcStats } = useQuery({
    queryKey: ["mlc-stats"],
    queryFn: () => api.get("/supertrend/ml-sellers/stats"),
    enabled: tab === "ml_competitors",
    staleTime: 2 * 60 * 1000,
  });
  const { data: mlcItems = [], isLoading: mlcItemsLoading } = useQuery({
    queryKey: ["mlc-items", mlcSelected],
    queryFn: () => api.get(`/supertrend/ml-sellers/${mlcSelected}/items`).then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors" && !!mlcSelected && mlcSubTab === "items",
    staleTime: 60 * 1000,
  });
  const { data: mlcPriceChanges = [], isLoading: mlcPriceLoading } = useQuery({
    queryKey: ["mlc-price-changes", mlcSelected],
    queryFn: () => api.get(`/supertrend/ml-sellers/${mlcSelected}/price-changes`).then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors" && !!mlcSelected && mlcSubTab === "price_changes",
    staleTime: 60 * 1000,
  });
  const { data: mlcTopSales = [], isLoading: mlcTopLoading } = useQuery({
    queryKey: ["mlc-top-sales", mlcSelected],
    queryFn: () => api.get(`/supertrend/ml-sellers/${mlcSelected}/top-sales`).then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors" && !!mlcSelected && mlcSubTab === "top_sales",
    staleTime: 60 * 1000,
  });
  const { data: mlcVariants = [], isLoading: mlcVariantsLoading } = useQuery({
    queryKey: ["mlc-variants", mlcSelected, mlcExpandedItem],
    queryFn: () => api.get(`/supertrend/ml-sellers/${mlcSelected}/variants${mlcExpandedItem ? `?item_id=${mlcExpandedItem}` : ""}`).then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors" && !!mlcSelected && !!mlcExpandedItem,
    staleTime: 60 * 1000,
  });
  const { data: mlcStockChanges = [], isLoading: mlcStockLoading } = useQuery({
    queryKey: ["mlc-stock-changes", mlcSelected],
    queryFn: () => api.get(`/supertrend/ml-sellers/${mlcSelected}/stock-changes`).then(r => r?.items ?? r ?? []),
    enabled: tab === "ml_competitors" && !!mlcSelected && mlcSubTab === "stock_changes",
    staleTime: 60 * 1000,
  });
  const mlcAddSeller = useMutation({
    mutationFn: d => api.post("/supertrend/ml-sellers", d),
    onSuccess: () => { qc.invalidateQueries(["mlc-sellers"]); qc.invalidateQueries(["mlc-stats"]); setMlcSellerModal(null); },
  });
  const mlcUpdateSeller = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/supertrend/ml-sellers/${id}`, d),
    onSuccess: () => { qc.invalidateQueries(["mlc-sellers"]); setMlcSellerModal(null); },
  });
  const mlcDeleteSeller = useMutation({
    mutationFn: id => api.delete(`/supertrend/ml-sellers/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries(["mlc-sellers"]);
      qc.invalidateQueries(["mlc-stats"]);
      if (mlcSelected === id) setMlcSelected(null);
    },
  });
  const [mlcScanningId, setMlcScanningId] = useState(null);
  const [mlcScanError, setMlcScanError] = useState(null);

  async function mlcScanClientSide(sellerId, mlSellerId) {
    setMlcScanningId(sellerId);
    setMlcScanError(null);
    try {
      // 1. Fetch all pages from ML API directly in the browser (avoids server IP blocks)
      const ML_SEARCH = "https://api.mercadolibre.com/sites/MLA/search";
      let allItems = [];
      let offset = 0;
      const LIMIT = 50;
      while (true) {
        const url = `${ML_SEARCH}?seller_id=${mlSellerId}&status=active&limit=${LIMIT}&offset=${offset}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(`ML API ${resp.status}: ${errData.message || errData.error || resp.statusText}`);
        }
        const data = await resp.json();
        const results = data.results || [];
        allItems = [...allItems, ...results];
        const total = data.paging?.total || 0;
        offset += results.length;
        if (!results.length || offset >= total || offset >= 1000) break;
        await new Promise(r => setTimeout(r, 300));
      }

      // 2. Send to backend ingest endpoint
      const result = await api.post(`/supertrend/ml-sellers/${sellerId}/ingest`, { items: allItems, variants: [] });

      qc.invalidateQueries(["mlc-sellers"]);
      qc.invalidateQueries(["mlc-items", sellerId]);
      qc.invalidateQueries(["mlc-price-changes", sellerId]);
      qc.invalidateQueries(["mlc-top-sales", sellerId]);
      qc.invalidateQueries(["mlc-stock-changes", sellerId]);
      qc.invalidateQueries(["mlc-variants"]);
      qc.invalidateQueries(["mlc-stats"]);
      return result;
    } catch (err) {
      setMlcScanError(`Error al escanear: ${err.message}`);
      throw err;
    } finally {
      setMlcScanningId(null);
    }
  }

  const mlcScan = {
    mutate: (sellerId) => {
      const seller = (mlcSellers || []).find(s => s.id === sellerId);
      mlcScanClientSide(sellerId, seller?.seller_id).catch(() => {});
    },
    isPending: mlcScanningId !== null,
  };

  // dailyData for bar chart
  const dailyData = useMemo(() => {
    if (!mlOrders?.orders) return [];
    const map = {};
    mlOrders.orders.forEach(o => {
      const d = (o.date_closed || o.date_created)?.slice(0, 10);
      if (!d) return;
      if (!map[d]) map[d] = { date: d, count: 0, amount: 0 };
      map[d].count++;
      map[d].amount += o.total_amount || 0;
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        dateLabel: new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      }));
  }, [mlOrders]);

  // Recent 7-day chart data for dashboard
  const recentDailyData = useMemo(() => {
    if (!mlRecentOrders?.orders) return [];
    const map = {};
    // Fill all 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, count: 0, amount: 0 };
    }
    mlRecentOrders.orders.forEach(o => {
      const d = (o.date_closed || o.date_created)?.slice(0, 10);
      if (!d || !map[d]) return;
      map[d].count++;
      map[d].amount += o.total_amount || 0;
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: new Date(d.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" }),
      }));
  }, [mlRecentOrders]);

  // ID-119/120: Weekly grouped data for the period chart
  const weeklyData = useMemo(() => {
    if (!dailyData.length) return [];
    const weeks = {};
    dailyData.forEach(d => {
      const date = new Date(d.date + "T12:00:00");
      const dow = date.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon = new Date(date);
      mon.setDate(date.getDate() + diff);
      const key = mon.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = { date: key, count: 0, amount: 0 };
      weeks[key].count += d.count;
      weeks[key].amount += d.amount;
    });
    return Object.values(weeks)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(w => ({
        ...w,
        dateLabel: new Date(w.date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      }));
  }, [dailyData]);

  // ID-121: Today vs yesterday comparison from recent 7-day data
  const todayVsYesterday = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const ydKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tDay = recentDailyData.find(d => d.date === todayKey) || { count: 0, amount: 0 };
    const yDay = recentDailyData.find(d => d.date === ydKey) || { count: 0, amount: 0 };
    return { today: tDay, yesterday: yDay };
  }, [recentDailyData]);

  // ID-123: Shipping type distribution for donut chart
  const shippingTypeData = useMemo(() => {
    if (!mlOrders?.orders?.length) return [];
    const counts = {};
    mlOrders.orders.forEach(o => {
      const type = shippingTypeLabel(o.tags || [], o.fulfillment_type);
      counts[type] = (counts[type] || 0) + 1;
    });
    const COLORS = { Full: "#71D8BF", Flex: "#F5B868", Colecta: "#A78BFA" };
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, fill: COLORS[name] || "#9CA3AF", color: COLORS[name] || "#9CA3AF" }))
      .sort((a, b) => b.value - a.value);
  }, [mlOrders]);

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#F0FBF8" }}>
            <TrendingUp className="w-5 h-5" style={{ color: "#71D8BF" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SuperTrend</h1>
            <p className="text-sm text-gray-400">Análisis de competencia y mercado · MercadoLibre</p>
          </div>
        </div>
        <button onClick={() => { refetchDash(); refetchMlInd(); if (tab === "ml_competitors") { mlcRefetchSellers(); qc.invalidateQueries(["mlc-stats"]); } }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border rounded-lg bg-white">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { key: "dashboard",      label: "Dashboard" },
          { key: "competitors",    label: "Competidores" },
          { key: "trends",         label: "Tendencias" },
          { key: "ml_indicators",  label: "Indicadores ML" },
          { key: "ml_orders",      label: "Ventas ML" },
          { key: "ml_questions",   label: "Preguntas ML" },
          { key: "ml_competitors", label: "🔍 Rastrear Competidores" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap relative ${
              tab === t.key ? "text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
            style={tab === t.key ? { borderColor: "#71D8BF" } : {}}
          >
            {t.label}
            {t.key === "ml_questions" && webhookQuestions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {webhookQuestions.length > 9 ? "9+" : webhookQuestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Selector de cuenta ML — aparece en tabs de ML */}
      {["dashboard","ml_indicators","ml_orders","ml_questions"].includes(tab) && mlAccountsList.length > 1 && (
        <div className="flex items-center gap-2 py-2">
          <span className="text-xs text-gray-400 font-medium">Cuenta ML:</span>
          {mlAccountsList.map(acc => (
            <button
              key={acc.key}
              onClick={() => setMlAccount(acc.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                mlAccount === acc.key
                  ? "border-transparent"
                  : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
              }`}
              style={mlAccount === acc.key ? { backgroundColor: "#71D8BF", color: "#0d4d3a" } : {}}
            >
              {accountLabel(acc.key, acc.label)}
            </button>
          ))}
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        mlIndLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Conectando con MercadoLibre...</span>
          </div>
        ) : mlIndError ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-5 mt-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{mlIndError?.message || "Error conectando a MercadoLibre"}</span>
          </div>
        ) : mlIndicators ? (
          <div className="space-y-5">
            {/* ── Top profile bar ── */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0d4d3a 0%, #145c47 60%, #1a7a5c 100%)" }}>
              <div className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white/90 border-2 border-white/20"
                    style={{ backgroundColor: "rgba(113,216,191,0.35)" }}>
                    {mlIndicators.nickname?.[0] ?? "M"}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{mlIndicators.nickname}</p>
                    <p className="text-sm text-white/50">{mlIndicators.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {mlIndicators.reputation_power_seller_status && RT_MEDALS[mlIndicators.reputation_power_seller_status] && (
                    <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                      ⭐ {RT_MEDALS[mlIndicators.reputation_power_seller_status]}
                    </span>
                  )}
                  {mlIndicators.permalink && (
                    <a href={mlIndicators.permalink} target="_blank" rel="noreferrer"
                      className="text-white/40 hover:text-white transition">
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              {/* Thermometer inside the banner */}
              <div className="px-6 pb-4">
                <div className="flex gap-1 items-end">
                  {RT_SEGMENTS.map((s, i) => {
                    const colorKey = mlIndicators.reputation_level?.match(/^\d+_(.+)$/)?.[1] || mlIndicators.reputation_level || "";
                    const activeIdx = RT_SEGMENTS.findIndex(seg => seg.key === colorKey);
                    return (
                      <div key={s.key} style={{
                        flex: 1, height: i === activeIdx ? 12 : 6, borderRadius: 4,
                        backgroundColor: i <= activeIdx ? s.color : "rgba(255,255,255,0.15)",
                        transition: "all 0.3s",
                      }} />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── KPI cards row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: "rgba(113,216,191,0.1)" }} />
                <ShoppingCart className="w-5 h-5 mb-2" style={{ color: "#39B54A" }} />
                <p className="text-xs text-gray-400 mb-0.5">Ventas hoy</p>
                <p className="text-3xl font-bold text-gray-900">{mlIndicators.today_orders ?? 0}</p>
              </div>
              <div className="bg-white border rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: "rgba(245,184,104,0.1)" }} />
                <MessageCircle className="w-5 h-5 mb-2" style={{ color: "#F5B868" }} />
                <p className="text-xs text-gray-400 mb-0.5">Preguntas sin responder</p>
                <p className="text-3xl font-bold text-gray-900">{mlIndicators.unanswered_questions ?? 0}</p>
                {(mlIndicators.unanswered_questions ?? 0) > 0 && (
                  <button onClick={() => setTab("ml_questions")}
                    className="text-xs font-semibold mt-1 underline" style={{ color: "#71D8BF" }}>
                    Responder →
                  </button>
                )}
              </div>
              <div className="bg-white border rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: "rgba(57,181,74,0.08)" }} />
                <Package className="w-5 h-5 mb-2" style={{ color: "#71D8BF" }} />
                <p className="text-xs text-gray-400 mb-0.5">Publicaciones activas</p>
                <p className="text-3xl font-bold text-gray-900">{mlIndicators.active_items ?? 0}</p>
                {(mlIndicators.paused_items ?? 0) > 0 && (
                  <p className="text-xs text-orange-500 mt-0.5">{mlIndicators.paused_items} pausadas</p>
                )}
              </div>
              <div className="bg-white border rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: "rgba(113,216,191,0.1)" }} />
                <TrendingUp className="w-5 h-5 mb-2" style={{ color: "#39B54A" }} />
                <p className="text-xs text-gray-400 mb-0.5">Ventas últimos 30 días</p>
                <p className="text-3xl font-bold text-gray-900">{mlIndicators.orders_last_30d ?? 0}</p>
              </div>
            </div>

            {/* ── Chart + quality side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Chart — 3 cols */}
              <div className="lg:col-span-3 bg-white border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ventas últimos 7 días</p>
                  <button onClick={() => setTab("ml_orders")}
                    className="text-xs font-semibold underline" style={{ color: "#71D8BF" }}>
                    Ver todas →
                  </button>
                </div>
                {recentDailyData.length > 0 ? (
                  <CssBarChart data={recentDailyData} height={180} color="#71D8BF" labelKey="label" valueKey="count" />
                ) : (
                  <div className="flex items-center justify-center h-[180px] text-gray-300 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Cargando ventas...
                  </div>
                )}
              </div>

              {/* Quality metrics — 2 cols */}
              <div className="lg:col-span-2 bg-white border rounded-xl p-5 flex flex-col">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Métricas de calidad</p>
                <div className="space-y-3 flex-1">
                  {[
                    {
                      label: "Calificaciones positivas",
                      value: mlIndicators.ratings_positive_pct != null ? `${(mlIndicators.ratings_positive_pct * 100).toFixed(1)}%` : "—",
                      good: mlIndicators.ratings_positive_pct != null ? mlIndicators.ratings_positive_pct >= 0.95 : null,
                      icon: <Star className="w-4 h-4" />,
                    },
                    {
                      label: "Reclamos",
                      value: mlIndicators.claims_rate != null ? `${(mlIndicators.claims_rate * 100).toFixed(2)}%` : "—",
                      good: mlIndicators.claims_rate != null ? mlIndicators.claims_rate <= 0.02 : null,
                      icon: <AlertCircle className="w-4 h-4" />,
                    },
                    {
                      label: "Envíos con demora",
                      value: mlIndicators.delayed_handling_rate != null ? `${(mlIndicators.delayed_handling_rate * 100).toFixed(2)}%` : "—",
                      good: mlIndicators.delayed_handling_rate != null ? mlIndicators.delayed_handling_rate <= 0.02 : null,
                      icon: <Clock className="w-4 h-4" />,
                    },
                    {
                      label: "Cancelaciones",
                      value: mlIndicators.cancellations_rate != null ? `${(mlIndicators.cancellations_rate * 100).toFixed(2)}%` : "—",
                      good: mlIndicators.cancellations_rate != null ? mlIndicators.cancellations_rate <= 0.02 : null,
                      icon: <X className="w-4 h-4" />,
                    },
                  ].map(m => (
                    <div key={m.label} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ backgroundColor: m.good === true ? "#EDF8EE" : m.good === false ? "#FFF0F0" : "#F8F9FA" }}>
                      <span style={{ color: m.good === true ? "#39B54A" : m.good === false ? "#ED6B61" : "#999" }}>{m.icon}</span>
                      <span className="text-sm text-gray-600 flex-1">{m.label}</span>
                      <span className="font-bold text-sm"
                        style={{ color: m.good === true ? "#39B54A" : m.good === false ? "#ED6B61" : "#666" }}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{mlIndicators.transactions_completed?.toLocaleString() ?? "—"}</p>
                    <p className="text-xs text-gray-400">Ventas totales</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-800">{mlIndicators.transactions_canceled?.toLocaleString() ?? "—"}</p>
                    <p className="text-xs text-gray-400">Canceladas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Recent sales list ── */}
            {mlRecentOrders?.orders?.length > 0 && (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Últimas ventas</p>
                  <button onClick={() => setTab("ml_orders")}
                    className="text-xs font-semibold" style={{ color: "#71D8BF" }}>
                    Ver todas →
                  </button>
                </div>
                <div className="divide-y">
                  {mlRecentOrders.orders.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#F0FBF8" }}>
                        <ShoppingCart className="w-4 h-4" style={{ color: "#71D8BF" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{o.item_title || "—"}</p>
                        <p className="text-xs text-gray-400">
                          {o.buyer_nickname} · {(o.date_closed || o.date_created) ? new Date(o.date_closed || o.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 shrink-0">
                        {o.total_amount != null
                          ? o.total_amount.toLocaleString("es-AR", { style: "currency", currency: o.currency_id || "ARS", maximumFractionDigits: 0 })
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Today vs Yesterday comparison (ID-121) ── */}
            <div className="bg-white border rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Hoy vs Ayer</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: "Hoy", d: todayVsYesterday.today, color: "#71D8BF" },
                  { label: "Ayer", d: todayVsYesterday.yesterday, color: "#CBD5E1" },
                ].map(({ label, d, color }) => (
                  <div key={label} className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-3xl font-bold" style={{ color }}>{d.count}</p>
                    {d.amount > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {d.amount.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <CssBarChart
                data={[
                  { dateLabel: "Ayer", count: todayVsYesterday.yesterday.count, color: "#CBD5E1" },
                  { dateLabel: "Hoy", count: todayVsYesterday.today.count, color: "#71D8BF" },
                ]}
                height={72}
                color="#71D8BF"
                labelKey="dateLabel"
                valueKey="count"
              />
            </div>

            {/* ── Quick nav ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Indicadores", desc: "Reputación y métricas", tab: "ml_indicators", icon: <Star className="w-5 h-5" /> },
                { label: "Ventas", desc: "Historial y gráficos", tab: "ml_orders", icon: <ShoppingCart className="w-5 h-5" /> },
                { label: "Preguntas", desc: "Responder compradores", tab: "ml_questions", icon: <MessageCircle className="w-5 h-5" /> },
              ].map(n => (
                <button
                  key={n.tab}
                  onClick={() => setTab(n.tab)}
                  className="bg-white border rounded-xl p-4 text-left hover:shadow-md hover:border-gray-300 transition group"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition"
                    style={{ backgroundColor: "#F0FBF8", color: "#71D8BF" }}>
                    {n.icon}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{n.label}</p>
                  <p className="text-xs text-gray-400">{n.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">Sin datos disponibles</div>
        )
      )}

      {/* ── COMPETITORS ── */}
      {tab === "competitors" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{competitors.length} registros</p>
            <button
              onClick={() => setCompModal({ mode: "new" })}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" /> Agregar competidor
            </button>
          </div>

          {compLoading ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : competitors.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">Sin competidores cargados</p>
              <p className="text-sm mt-1">Registrá los precios de tu competencia para comparar.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Competidor</th>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-right">Nuestro</th>
                    <th className="px-4 py-3 text-right">Competidor</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {competitors.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.competitor_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.product_name}</td>
                      <td className="px-4 py-3 text-gray-400">{c.category || "—"}</td>
                      <td className="px-4 py-3 text-right">{c.our_price != null ? `${c.currency} ${c.our_price.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-right">{c.competitor_price != null ? `${c.currency} ${c.competitor_price.toLocaleString()}` : "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${pctColor(c.price_diff_pct)}`}>
                        {c.price_diff_pct != null ? `${c.price_diff_pct > 0 ? "+" : ""}${c.price_diff_pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setCompModal({ mode: "edit", data: c })}
                            className="text-gray-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("¿Eliminar?")) deleteComp.mutate(c.id); }}
                            className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TRENDS ── */}
      {tab === "trends" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{trends.length} tendencias</p>
            <button
              onClick={() => setTrendModal({ mode: "new" })}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" /> Nueva tendencia
            </button>
          </div>

          {trendsLoading ? (
            <div className="text-center py-16 text-gray-400">Cargando...</div>
          ) : trends.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">Sin tendencias registradas</p>
              <p className="text-sm mt-1">Registrá indicadores de mercado y tendencias del sector.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map(t => (
                <div key={t.id} className="bg-white border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {directionIcon(t.direction)}
                      <span className="font-semibold text-sm text-gray-800">{t.indicator_name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setTrendModal({ mode: "edit", data: t })}
                        className="text-gray-300 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { if (confirm("¿Eliminar?")) deleteTrend.mutate(t.id); }}
                        className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {t.category && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{t.category}</span>}
                  <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${directionBadge(t.direction)}`}>
                    {t.direction === "UP" ? "En alza" : t.direction === "DOWN" ? "En baja" : "Estable"} — Fuerza {t.strength}/10
                  </div>
                  {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  {t.source && <p className="text-xs text-gray-400 italic">Fuente: {t.source}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ML INDICADORES ── */}
      {tab === "ml_indicators" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: "#71D8BF" }} />
              <h2 className="text-base font-bold text-gray-800">Indicadores</h2>
            </div>
            <button onClick={() => refetchMlInd()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border rounded-lg">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
          </div>

          {mlIndLoading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Consultando MercadoLibre...</span>
            </div>
          )}
          {mlIndError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{mlIndError?.message || "Error conectando a MercadoLibre"}</span>
            </div>
          )}

          {mlIndicators && !mlIndLoading && (
            <>
              {/* User profile bar */}
              <div className="flex items-center justify-between bg-white border rounded-xl px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #71D8BF, #39B54A)" }}>
                    {mlIndicators.nickname?.[0] ?? "M"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{mlIndicators.nickname}</p>
                    <p className="text-xs text-gray-400">{mlIndicators.email}</p>
                  </div>
                </div>
                {mlIndicators.permalink && (
                  <a href={mlIndicators.permalink} target="_blank" rel="noreferrer"
                    className="text-gray-400 hover:text-teal-500 transition">
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>

              {/* 2x2 Widget grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Widget 1: Preguntas y mensajes */}
                <div className="bg-white border rounded-xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                    Preguntas y mensajes
                  </p>
                  <div className="flex gap-8">
                    <div className="text-center">
                      <p className="text-5xl font-bold text-gray-800">{mlIndicators.unanswered_questions ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-1">Preguntas sin responder</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-gray-800">0</p>
                      <p className="text-xs text-gray-400 mt-1">Mensajes sin leer</p>
                    </div>
                  </div>
                  {(mlIndicators.unanswered_questions ?? 0) > 0 && (
                    <button
                      onClick={() => setTab("ml_questions")}
                      className="mt-4 w-full text-center text-xs font-semibold py-2 rounded-lg transition"
                      style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
                    >
                      Ver preguntas sin responder →
                    </button>
                  )}
                </div>

                {/* Widget 2: Performance */}
                <div className="bg-white border rounded-xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Performance</p>
                  <ReputationThermometer
                    levelId={mlIndicators.reputation_level}
                    powerSellerStatus={mlIndicators.reputation_power_seller_status}
                  />
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#F0FBF8" }}>
                      <p className="text-gray-400">Ventas totales</p>
                      <p className="font-bold text-gray-800 text-base">{mlIndicators.transactions_completed?.toLocaleString() ?? "—"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-gray-400">Canceladas</p>
                      <p className="font-bold text-gray-800 text-base">{mlIndicators.transactions_canceled?.toLocaleString() ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Widget 3: Actividad de hoy */}
                <div className="bg-white border rounded-xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Actividad de hoy</p>
                  <div className="flex gap-8">
                    <div className="text-center">
                      <p className="text-5xl font-bold" style={{ color: "#39B54A" }}>{mlIndicators.today_orders ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-1">Ventas hoy</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-gray-800">{mlIndicators.orders_last_30d ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-1">Últimos 30 días</p>
                    </div>
                  </div>
                </div>

                {/* Widget 4: Publicaciones */}
                <div className="bg-white border rounded-xl p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Publicaciones</p>
                  <div className="flex gap-8">
                    <div className="text-center">
                      <p className="text-5xl font-bold" style={{ color: "#39B54A" }}>{mlIndicators.active_items ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-1">Activas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-5xl font-bold text-orange-500">{mlIndicators.paused_items ?? 0}</p>
                      <p className="text-xs text-gray-400 mt-1">Pausadas</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Métricas de calidad */}
              <div className="bg-white border rounded-xl p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Métricas de calidad</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Calificaciones positivas",
                      value: mlIndicators.ratings_positive_pct != null ? `${(mlIndicators.ratings_positive_pct * 100).toFixed(1)}%` : "—",
                      good: mlIndicators.ratings_positive_pct != null ? mlIndicators.ratings_positive_pct >= 0.95 : null,
                    },
                    {
                      label: "Tasa de reclamos",
                      value: mlIndicators.claims_rate != null ? `${(mlIndicators.claims_rate * 100).toFixed(2)}%` : "—",
                      good: mlIndicators.claims_rate != null ? mlIndicators.claims_rate <= 0.02 : null,
                    },
                    {
                      label: "Envíos con demora",
                      value: mlIndicators.delayed_handling_rate != null ? `${(mlIndicators.delayed_handling_rate * 100).toFixed(2)}%` : "—",
                      good: mlIndicators.delayed_handling_rate != null ? mlIndicators.delayed_handling_rate <= 0.02 : null,
                    },
                  ].map(m => (
                    <div
                      key={m.label}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ backgroundColor: m.good === true ? "#EDF8EE" : m.good === false ? "#FFF0F0" : "#F8F9FA" }}
                    >
                      <span className="text-sm text-gray-600">{m.label}</span>
                      <span className="font-bold text-sm"
                        style={{ color: m.good === true ? "#39B54A" : m.good === false ? "#ED6B61" : "#666" }}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ML VENTAS ── */}
      {tab === "ml_orders" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: "#71D8BF" }} />
              <h2 className="text-base font-bold text-gray-800">Ventas</h2>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Elegí un rango:</label>
              <select value={mlOrderDays} onChange={e => setMlOrderDays(Number(e.target.value))}
                className="border rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value={7}>Últimos 7 días</option>
                <option value={15}>Últimos 15 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={60}>Últimos 60 días</option>
                <option value={90}>Últimos 90 días</option>
              </select>
              <button onClick={() => refetchMlOrd()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border rounded-lg bg-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {mlOrdLoading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Consultando MercadoLibre...</span>
            </div>
          )}
          {mlOrdError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{mlOrdError?.message || "Error conectando a MercadoLibre"}</span>
            </div>
          )}

          {mlOrders && !mlOrdLoading && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Dinero transaccionado</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mlOrders.orders.reduce((s, o) => s + (o.total_amount || 0), 0)
                      .toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Ticket promedio</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {mlOrders.orders.length > 0
                      ? (mlOrders.orders.reduce((s, o) => s + (o.total_amount || 0), 0) / mlOrders.orders.length)
                          .toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
                      : "—"}
                  </p>
                </div>
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Ventas</p>
                  <p className="text-2xl font-bold text-gray-900">{mlOrders.total}</p>
                  <p className="text-xs text-gray-400">en {mlOrderDays} días</p>
                </div>
              </div>

              {/* Daily/weekly bar chart with groupBy toggle — ID-119/120 */}
              {dailyData.length > 1 && (
                <div className="bg-white border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ventas por período</p>
                    <div className="flex items-center gap-1 border rounded-lg overflow-hidden text-xs">
                      <button
                        onClick={() => setChartGroupBy("day")}
                        className="px-3 py-1.5 transition"
                        style={chartGroupBy === "day"
                          ? { backgroundColor: "#71D8BF", color: "#0d4d3a" }
                          : { color: "#6b7280", backgroundColor: "#fff" }}
                      >
                        Por día
                      </button>
                      <button
                        onClick={() => setChartGroupBy("week")}
                        className="px-3 py-1.5 transition"
                        style={chartGroupBy === "week"
                          ? { backgroundColor: "#71D8BF", color: "#0d4d3a" }
                          : { color: "#6b7280", backgroundColor: "#fff" }}
                      >
                        Por semana
                      </button>
                    </div>
                  </div>
                  <div className={chartGroupBy === "day" && dailyData.length > 30 ? "overflow-x-auto" : ""}>
                    <div style={chartGroupBy === "day" && dailyData.length > 30 ? { minWidth: `${dailyData.length * 26}px` } : {}}>
                      <CssBarChart
                        data={chartGroupBy === "week" ? weeklyData : dailyData}
                        height={160}
                        color="#71D8BF"
                        labelKey="dateLabel"
                        valueKey="count"
                      />
                    </div>
                  </div>
                  {chartGroupBy === "day" && dailyData.length > 30 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">← Deslizá para ver todos los días →</p>
                  )}
                </div>
              )}

              {/* Sales list */}
              {mlOrders.orders.length === 0 ? (
                <div className="text-center py-16 bg-white border rounded-xl text-gray-400">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Sin ventas en el período seleccionado</p>
                  <p className="text-xs mt-1">Probá con otro rango de fechas</p>
                </div>
              ) : (
                <>
                  {/* Sales table — ID-115, ID-116, ID-117, ID-118 */}
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Detalle de ventas
                      </p>
                      <span className="text-xs text-gray-400">
                        {mlOrders.orders.length} mostradas{mlOrders.total > mlOrders.orders.length ? ` de ${mlOrders.total}` : ""}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr className="text-xs text-gray-500">
                            <th className="px-3 py-2 text-left whitespace-nowrap font-medium">Fecha</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap font-medium">Orden ID</th>
                            <th className="px-3 py-2 text-left font-medium">Artículo</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap font-medium">Cant.</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap font-medium">Precio Unit.</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap font-medium">Descuento ML</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap font-medium">Total</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap font-medium">Tipo Envío</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {mlOrders.orders.map(o => {
                            const unitQty = (o.item_quantity || 1);
                            const discount = o.full_unit_price && o.full_unit_price > (o.unit_price || 0)
                              ? (o.full_unit_price - (o.unit_price || 0)) * unitQty
                              : 0;
                            const shipType = shippingTypeLabel(o.tags || [], o.fulfillment_type);
                            return (
                              <tr key={o.id} className="hover:bg-gray-50 transition">
                                <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                                  {(o.date_closed || o.date_created)
                                    ? new Date(o.date_closed || o.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
                                    : "—"}
                                </td>
                                {/* ID-115 + ID-116: Orden ID with ML link */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-mono text-gray-600">{o.id}</span>
                                    <a
                                      href={`https://www.mercadolibre.com.ar/ventas/${o.id}/detalle`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-gray-300 hover:text-blue-500 transition"
                                      title="Ver en MercadoLibre"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 max-w-xs">
                                  <p className="text-sm font-medium text-gray-800 truncate">{o.item_title || "—"}</p>
                                  <p className="text-xs text-gray-400 truncate">{o.buyer_nickname || ""}{o.sku ? ` · SKU: ${o.sku}` : ""}</p>
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">
                                  {o.item_quantity ?? "—"}
                                </td>
                                {/* ID-117: unit price + discount */}
                                <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700">
                                  {o.unit_price != null
                                    ? o.unit_price.toLocaleString("es-AR", { style: "currency", currency: o.currency_id || "ARS", maximumFractionDigits: 0 })
                                    : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                  {discount > 0
                                    ? <span className="text-green-600 font-medium text-xs">-{discount.toLocaleString("es-AR", { style: "currency", currency: o.currency_id || "ARS", maximumFractionDigits: 0 })}</span>
                                    : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                                  {o.total_amount != null
                                    ? o.total_amount.toLocaleString("es-AR", { style: "currency", currency: o.currency_id || "ARS", maximumFractionDigits: 0 })
                                    : "—"}
                                </td>
                                {/* ID-118: Shipping type */}
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    shipType === "Full"    ? "bg-teal-100 text-teal-700" :
                                    shipType === "Flex"    ? "bg-orange-100 text-orange-700" :
                                                            "bg-purple-100 text-purple-700"
                                  }`}>
                                    {shipType}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    o.status === "paid"      ? "text-green-700 bg-green-100" :
                                    o.status === "confirmed" ? "text-blue-700 bg-blue-100" :
                                    o.status === "cancelled" ? "text-red-700 bg-red-100" :
                                    "text-gray-600 bg-gray-100"
                                  }`}>
                                    {o.status === "paid" ? "Cobrado" : o.status === "confirmed" ? "Confirmado" : o.status === "cancelled" ? "Cancelado" : o.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ID-123: Donut chart — shipping type distribution */}
                  {shippingTypeData.length > 0 && (
                    <div className="bg-white border rounded-xl p-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                        Distribución por tipo de envío
                      </p>
                      <CssPieChart data={shippingTypeData} size={120} />
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Basado en las {mlOrders.orders.length} ventas mostradas
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ML PREGUNTAS ── */}
      {tab === "ml_questions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: "#71D8BF" }} />
              <h2 className="text-base font-bold text-gray-800">Preguntas</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border rounded-lg overflow-hidden">
                {[
                  { k: "UNANSWERED", label: "Sin responder" },
                  { k: "ANSWERED",   label: "Respondidas" },
                  { k: "CLOSED",     label: "Cerradas" },
                ].map(s => (
                  <button key={s.k} onClick={() => setMlQStatus(s.k)}
                    className="px-3 py-1.5 text-xs font-medium transition"
                    style={mlQStatus === s.k
                      ? { backgroundColor: "#71D8BF", color: "#0d4d3a" }
                      : { backgroundColor: "#fff", color: "#6b7280" }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <button onClick={() => refetchMlQ()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {mlQLoading && (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Consultando MercadoLibre...</span>
            </div>
          )}
          {mlQError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{mlQError?.message || "Error conectando a MercadoLibre"}</span>
            </div>
          )}

          {/* ── Consultas tiempo real (webhook) ── */}
          {webhookQuestions.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-amber-200">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-800">TIEMPO REAL — últimas 72h</span>
                <span className="ml-auto text-xs text-amber-600">{webhookQuestions.length} recibida{webhookQuestions.length !== 1 ? "s" : ""} via webhook</span>
                <button onClick={() => refetchWhQ()} className="ml-1 text-amber-600 hover:text-amber-800">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-amber-50 bg-white">
                {webhookQuestions.map(q => {
                  const diff = (Date.now() - new Date(q.received_at).getTime()) / 1000;
                  const relTime = diff < 60 ? "hace <1 min" : diff < 3600 ? `hace ${Math.round(diff/60)} min` : `hace ${Math.round(diff/3600)} h`;
                  return (
                    <div key={q.event_id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {q.item_title && <p className="text-xs font-semibold text-blue-600 mb-0.5 truncate">📦 {q.item_title}</p>}
                        <p className="text-sm text-gray-800">
                          {q.enriched ? q.question_text : <span className="italic text-gray-400">Procesando…</span>}
                        </p>
                        <span className="text-[11px] text-amber-600">{relTime}</span>
                      </div>
                      {q.enriched && q.question_id && (
                        <button
                          onClick={() => { setAnswerModal({ id: q.question_id, text: q.question_text, item_title: q.item_title, account: mlAccount }); setAnswerText(""); }}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                          style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
                        >
                          <Send className="w-3 h-3" /> Responder
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mlQuestions && !mlQLoading && (
            <>
              <p className="text-xs text-gray-400">
                {mlQuestions.total} pregunta{mlQuestions.total !== 1 ? "s" : ""}
              </p>
              {mlQuestions.questions.length === 0 ? (
                <div className="text-center py-20 bg-white border rounded-xl text-gray-400">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-gray-500">
                    {mlQStatus === "UNANSWERED" ? "¡Bien! Todas las preguntas están respondidas" : "Sin preguntas en esta categoría"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mlQuestions.questions.map(q => (
                    <div key={q.id} className="bg-white border rounded-xl overflow-hidden hover:shadow-sm transition">
                      {/* Item title bar */}
                      <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-600 truncate">{q.item_title || q.item_id}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                          {q.date_created ? new Date(q.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : ""}
                        </span>
                      </div>
                      {/* Question + reply button */}
                      <div className="px-4 py-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                          style={{ backgroundColor: "#F0FBF8", color: "#71D8BF" }}>
                          ?
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{q.text}</p>
                          {q.answer && (
                            <div className="mt-2 pl-3 border-l-2" style={{ borderColor: "#71D8BF" }}>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: "#39B54A" }}>Tu respuesta</p>
                              <p className="text-sm text-gray-600">{q.answer.text}</p>
                            </div>
                          )}
                        </div>
                        {q.status === "UNANSWERED" && (
                          <button
                            onClick={() => { setAnswerModal({ ...q, account: mlAccount }); setAnswerText(""); }}
                            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition whitespace-nowrap shrink-0"
                            style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
                          >
                            <Send className="w-3.5 h-3.5" /> Responder
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ML COMPETITORS TAB ── */}
      {tab === "ml_competitors" && (
        <div className="space-y-4">
          {/* Stats bar */}
          {mlcStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Vendedores rastreados", value: mlcStats.total_sellers ?? 0 },
                { label: "Activos", value: mlcStats.active_sellers ?? 0 },
                { label: "Publicaciones", value: (mlcStats.total_items ?? 0).toLocaleString("es-AR") },
                { label: "Cambios precio hoy", value: mlcStats.price_changes_today ?? 0 },
                { label: "Ventas hoy", value: mlcStats.sales_today ?? 0 },
                { label: "Cambios stock hoy", value: mlcStats.stock_changes_today ?? 0 },
                { label: "Últ. escaneo", value: mlcStats.last_scan ? new Date(mlcStats.last_scan).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">Vendedores rastreados</h2>
            <button
              onClick={() => { setMlcSellerForm({ seller_id: "", nickname: "", notes: "", check_interval_hours: 24 }); setMlcSellerModal("add"); }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
            >
              <Plus className="w-4 h-4" /> Agregar vendedor
            </button>
          </div>

          {/* Sellers list */}
          {mlcSellersLoading ? (
            <div className="flex items-center gap-3 py-10 text-gray-400 justify-center">
              <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
            </div>
          ) : mlcSellers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay vendedores rastreados aún.</p>
              <p className="text-xs mt-1">Agregá un seller_id de MercadoLibre para empezar.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {mlcScanError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex items-center justify-between">
                  <span>{mlcScanError}</span>
                  <button onClick={() => setMlcScanError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
                </div>
              )}
              {mlcSellers.map(s => (
                <div key={s.id}
                  className={`bg-white border rounded-xl p-4 flex items-center gap-4 cursor-pointer transition ${mlcSelected === s.id ? "border-teal-400 ring-1 ring-teal-300" : "hover:border-gray-300"}`}
                  onClick={() => { setMlcSelected(s.id); setMlcSubTab("items"); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{s.nickname || s.seller_id}</p>
                    <p className="text-xs text-gray-400">ID: {s.seller_id} · Cada {s.check_interval_hours}h</p>
                    {s.last_checked_at && (
                      <p className="text-xs text-gray-400">Último escaneo: {new Date(s.last_checked_at).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.is_active ? "Activo" : "Pausado"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); mlcScan.mutate(s.id); }}
                      disabled={mlcScanningId === s.id}
                      title="Escanear ahora"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 disabled:opacity-40 transition"
                    >
                      <RefreshCw className={`w-4 h-4 ${mlcScanningId === s.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setMlcSellerForm({ seller_id: s.seller_id, nickname: s.nickname || "", notes: s.notes || "", check_interval_hours: s.check_interval_hours }); setMlcSellerModal(s); }}
                      title="Editar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`¿Eliminar a ${s.nickname || s.seller_id}?`)) mlcDeleteSeller.mutate(s.id); }}
                      title="Eliminar"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail panel — when seller selected */}
          {mlcSelected && (
            <div className="bg-white border rounded-2xl p-5 space-y-4 mt-2">
              {/* Sub-tabs */}
              <div className="flex gap-2 border-b pb-2">
                {[
                  { key: "items",         label: "📦 Publicaciones" },
                  { key: "price_changes", label: "💲 Cambios de precio" },
                  { key: "top_sales",     label: "🏆 Top ventas del día" },
                  { key: "stock_changes", label: "📊 Cambios de stock" },
                ].map(st => (
                  <button key={st.key}
                    onClick={() => setMlcSubTab(st.key)}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${mlcSubTab === st.key ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    style={mlcSubTab === st.key ? { backgroundColor: "#71D8BF", color: "#0d4d3a" } : {}}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Items subtab */}
              {mlcSubTab === "items" && (
                mlcItemsLoading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 justify-center"><RefreshCw className="w-4 h-4 animate-spin" /> Cargando publicaciones...</div>
                ) : mlcItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin datos — hacé clic en 🔄 para escanear este vendedor.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b">
                          <th className="pb-2 w-10"></th>
                          <th className="pb-2">Publicación</th>
                          <th className="pb-2 text-right">Precio</th>
                          <th className="pb-2 text-right">Δ Precio</th>
                          <th className="pb-2 text-right">Vendidos</th>
                          <th className="pb-2 text-right">Ventas hoy</th>
                          <th className="pb-2 text-right">Stock</th>
                          <th className="pb-2 w-14 text-center">Vars</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlcItems.map(item => (
                          <Fragment key={item.item_id}>
                          <tr className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 pr-2">
                              {item.thumbnail
                                ? <img src={item.thumbnail} alt="" className="w-9 h-9 rounded object-cover" />
                                : <div className="w-9 h-9 rounded bg-gray-100" />}
                            </td>
                            <td className="py-2 pr-3 max-w-xs">
                              <p className="text-xs font-medium text-gray-700 line-clamp-2 leading-snug">{item.title}</p>
                              <p className="text-xs text-gray-400">{item.item_id}{item.status && item.status !== "active" ? ` · ${item.status}` : ""}{item.original_price ? ` · antes $${Number(item.original_price).toLocaleString("es-AR")}` : ""}</p>
                            </td>
                            <td className="py-2 text-right font-semibold text-gray-800 whitespace-nowrap">
                              ${Number(item.price).toLocaleString("es-AR")}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {item.price_changed ? (
                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${Number(item.price) > Number(item.price_prev) ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                                  {Number(item.price) > Number(item.price_prev) ? "▲" : "▼"} ${Math.abs(Number(item.price) - Number(item.price_prev)).toLocaleString("es-AR")}
                                </span>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </td>
                            <td className="py-2 text-right text-gray-600">{item.sold_quantity?.toLocaleString("es-AR")}</td>
                            <td className="py-2 text-right">
                              {item.sales_since_last > 0
                                ? <span className="text-xs font-bold text-teal-600">+{item.sales_since_last}</span>
                                : <span className="text-xs text-gray-300">0</span>}
                            </td>
                            <td className="py-2 text-right text-gray-500">{item.available_quantity}</td>
                            <td className="py-2 text-center">
                              <button
                                onClick={() => setMlcExpandedItem(mlcExpandedItem === item.item_id ? null : item.item_id)}
                                className={`text-xs px-2 py-1 rounded-lg transition ${mlcExpandedItem === item.item_id ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                title="Ver variantes (talles/colores)"
                              >
                                {mlcExpandedItem === item.item_id ? "▲" : "▼"}
                              </button>
                            </td>
                            <td className="py-2">
                              {item.permalink && (
                                <a href={item.permalink} target="_blank" rel="noreferrer"
                                  className="text-gray-300 hover:text-teal-500 transition" title="Ver en ML">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </td>
                          </tr>
                          {mlcExpandedItem === item.item_id && (
                            <tr>
                              <td colSpan={10} className="p-0">
                                <div className="bg-gray-50 border-t border-b px-4 py-3">
                                  {mlcVariantsLoading ? (
                                    <div className="flex items-center gap-2 py-2 text-gray-400 text-xs"><RefreshCw className="w-3 h-3 animate-spin" /> Cargando variantes...</div>
                                  ) : mlcVariants.length === 0 ? (
                                    <p className="text-xs text-gray-400">Sin variantes. Escaneá de nuevo para obtenerlas.</p>
                                  ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                                      {mlcVariants.map(v => {
                                        const attrs = v.attributes || {};
                                        const label = Object.values(attrs).join(" / ") || v.variation_id;
                                        const isOut = v.available_quantity === 0;
                                        const wasOut = (v.stock_prev ?? 0) === 0 && v.available_quantity > 0;
                                        const justSoldOut = isOut && (v.stock_prev ?? 0) > 0;
                                        return (
                                          <div key={v.variation_id}
                                            className={`rounded-lg border px-3 py-2 text-xs ${isOut ? "bg-red-50 border-red-200" : v.stock_changed ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}
                                          >
                                            <p className="font-semibold text-gray-700 truncate" title={label}>{label}</p>
                                            <div className="flex items-center justify-between mt-1">
                                              <span className={`font-bold ${isOut ? "text-red-600" : "text-gray-800"}`}>
                                                {isOut ? "AGOTADO" : `Stock: ${v.available_quantity}`}
                                              </span>
                                              {v.stock_changed && (
                                                <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${justSoldOut ? "bg-red-100 text-red-600" : wasOut ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                                  {justSoldOut ? "AGOTÓ" : wasOut ? "REPUESTO" : `${v.stock_prev}→${v.available_quantity}`}
                                                </span>
                                              )}
                                            </div>
                                            {v.price && <p className="text-gray-400 mt-0.5">${Number(v.price).toLocaleString("es-AR")}</p>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Price changes subtab */}
              {mlcSubTab === "price_changes" && (
                mlcPriceLoading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 justify-center"><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : mlcPriceChanges.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin cambios de precio detectados aún.</p>
                ) : (
                  <div className="space-y-2">
                    {mlcPriceChanges.map(item => (
                      <div key={item.item_id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50">
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 line-clamp-1">{item.title}</p>
                          <p className="text-xs text-gray-400">{new Date(item.scanned_at).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400 line-through">${Number(item.price_prev).toLocaleString("es-AR")}</p>
                          <p className={`text-sm font-bold ${Number(item.price) > Number(item.price_prev) ? "text-red-600" : "text-green-600"}`}>
                            {Number(item.price) > Number(item.price_prev) ? "▲" : "▼"} ${Number(item.price).toLocaleString("es-AR")}
                          </p>
                        </div>
                        {item.permalink && (
                          <a href={item.permalink} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-teal-500">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Top sales subtab */}
              {mlcSubTab === "top_sales" && (
                mlcTopLoading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 justify-center"><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : mlcTopSales.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin datos de ventas del día aún.</p>
                ) : (
                  <div className="space-y-2">
                    {mlcTopSales.slice(0, 20).map((item, idx) => (
                      <div key={item.item_id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50">
                        <span className="text-base font-bold text-gray-300 w-6 shrink-0 text-center">#{idx + 1}</span>
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 line-clamp-1">{item.title}</p>
                          <p className="text-xs text-gray-400">${Number(item.price).toLocaleString("es-AR")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold text-teal-600">+{item.sales_since_last}</p>
                          <p className="text-xs text-gray-400">ventas hoy</p>
                        </div>
                        {item.permalink && (
                          <a href={item.permalink} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-teal-500">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Stock changes subtab */}
              {mlcSubTab === "stock_changes" && (
                mlcStockLoading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 justify-center"><RefreshCw className="w-4 h-4 animate-spin" /> Cargando...</div>
                ) : mlcStockChanges.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin cambios de stock detectados en los últimos 7 días.</p>
                ) : (
                  <div className="space-y-2">
                    {mlcStockChanges.map((item, idx) => {
                      const attrs = item.attributes || {};
                      const varLabel = Object.values(attrs).join(" / ") || item.variation_id;
                      const isAgotado = item.change_type === "agotado";
                      const isRepuesto = item.change_type === "repuesto";
                      return (
                        <div key={`${item.item_id}-${item.variation_id}-${idx}`} className={`flex items-center gap-3 p-3 border rounded-xl ${isAgotado ? "bg-red-50 border-red-200" : isRepuesto ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAgotado ? "bg-red-100 text-red-600" : isRepuesto ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {isAgotado ? "✕" : isRepuesto ? "✓" : "~"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 line-clamp-1">{item.item_title || item.item_id}</p>
                            <p className="text-xs text-gray-500">Variante: <span className="font-semibold">{varLabel}</span></p>
                            <p className="text-xs text-gray-400">{new Date(item.scanned_at).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAgotado ? "bg-red-100 text-red-700" : isRepuesto ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {isAgotado ? "AGOTADO" : isRepuesto ? "REPUESTO" : `${item.stock_prev}→${item.available_quantity}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {compModal && (
        <CompetitorModal
          initial={compModal.data}
          onClose={() => setCompModal(null)}
          onSave={d => compModal.mode === "new" ? createComp.mutate(d) : updateComp.mutate({ id: compModal.data.id, ...d })}
        />
      )}
      {trendModal && (
        <TrendModal
          initial={trendModal.data}
          onClose={() => setTrendModal(null)}
          onSave={d => trendModal.mode === "new" ? createTrend.mutate(d) : updateTrend.mutate({ id: trendModal.data.id, ...d })}
        />
      )}
      {answerModal && (
        <Modal title="Responder pregunta" onClose={() => { setAnswerModal(null); setAnswerText(""); }}>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{answerModal.item_title || answerModal.item_id}</p>
              <p className="text-sm font-medium text-gray-800">{answerModal.text}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tu respuesta *</label>
              <textarea rows={4} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                value={answerText} onChange={e => setAnswerText(e.target.value)}
                placeholder="Escribí tu respuesta para el comprador..." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setAnswerModal(null); setAnswerText(""); }}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                disabled={sendAnswer.isPending || answerText.trim().length < 5}
                onClick={() => sendAnswer.mutate({ id: answerModal.id, text: answerText, account: answerModal.account || mlAccount })}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2 transition"
                style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
              >
                {sendAnswer.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar respuesta
              </button>
            </div>
            {sendAnswer.isError && (
              <p className="text-xs text-red-600">Error: {sendAnswer.error?.message}</p>
            )}
          </div>
        </Modal>
      )}
      {mlcSellerModal && (
        <Modal
          title={mlcSellerModal === "add" ? "Agregar vendedor a rastrear" : "Editar vendedor"}
          onClose={() => setMlcSellerModal(null)}
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Seller ID de MercadoLibre *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={mlcSellerForm.seller_id}
                onChange={e => setMlcSellerForm(f => ({ ...f, seller_id: e.target.value }))}
                placeholder="Ej: 209611492"
                disabled={mlcSellerModal !== "add"}
              />
              <p className="text-xs text-gray-400 mt-1">Podés encontrar el seller_id en la URL de su perfil de ML.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre / apodo</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={mlcSellerForm.nickname}
                onChange={e => setMlcSellerForm(f => ({ ...f, nickname: e.target.value }))}
                placeholder="Ej: Competidor Principal"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notas</label>
              <textarea
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                value={mlcSellerForm.notes}
                onChange={e => setMlcSellerForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Intervalo de escaneo: {mlcSellerForm.check_interval_hours}h</label>
              <input
                type="range" min="1" max="168" className="w-full"
                value={mlcSellerForm.check_interval_hours}
                onChange={e => setMlcSellerForm(f => ({ ...f, check_interval_hours: parseInt(e.target.value) }))}
              />
              <div className="flex justify-between text-xs text-gray-400"><span>1h</span><span>7 días</span></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMlcSellerModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                disabled={!mlcSellerForm.seller_id.trim() || mlcAddSeller.isPending || mlcUpdateSeller.isPending}
                onClick={() => {
                  if (mlcSellerModal === "add") {
                    mlcAddSeller.mutate(mlcSellerForm);
                  } else {
                    mlcUpdateSeller.mutate({ id: mlcSellerModal.id, nickname: mlcSellerForm.nickname, notes: mlcSellerForm.notes, check_interval_hours: mlcSellerForm.check_interval_hours });
                  }
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: "#71D8BF", color: "#0d4d3a" }}
              >
                {(mlcAddSeller.isPending || mlcUpdateSeller.isPending) && <RefreshCw className="w-4 h-4 animate-spin" />}
                {mlcSellerModal === "add" ? "Agregar" : "Guardar"}
              </button>
            </div>
            {(mlcAddSeller.isError || mlcUpdateSeller.isError) && (
              <p className="text-xs text-red-600">{mlcAddSeller.error?.message || mlcUpdateSeller.error?.message}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
