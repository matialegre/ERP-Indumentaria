/**
 * SupertrendPage — Análisis de competencia y tendencias de mercado.
 * Permite registrar precios de competidores e indicadores de tendencia
 * según el tipo de negocio (outdoor, indumentaria, etc.).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ChevronUp,
  ChevronDown,
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
  const [tab, setTab] = useState("dashboard"); // dashboard | competitors | trends
  const [compModal, setCompModal] = useState(null); // null | {mode: 'new'|'edit', data?}
  const [trendModal, setTrendModal] = useState(null);

  // Queries
  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["supertrend-dashboard"],
    queryFn: () => api.get("/supertrend/dashboard"),
  });

  const { data: competitors = [], isLoading: compLoading } = useQuery({
    queryKey: ["supertrend-competitors"],
    queryFn: () => api.get("/supertrend/competitors"),
    enabled: tab === "competitors",
  });

  const { data: trends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["supertrend-trends"],
    queryFn: () => api.get("/supertrend/trends"),
    enabled: tab === "trends",
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

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SuperTrend</h1>
            <p className="text-sm text-gray-500">Análisis de competencia y tendencias de mercado</p>
          </div>
        </div>
        <button onClick={() => refetchDash()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border rounded-lg">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: "dashboard",   label: "Dashboard" },
          { key: "competitors", label: "Competidores" },
          { key: "trends",      label: "Tendencias" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.key ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        dashLoading ? (
          <div className="text-center py-20 text-gray-400">Cargando...</div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Competidores", value: dashboard?.total_competitors ?? 0, color: "purple" },
                { label: "Productos relevados", value: dashboard?.total_products ?? 0, color: "blue" },
                { label: "Tendencias activas", value: dashboard?.total_trends ?? 0, color: "emerald" },
                { label: "Diferencia promedio", value: dashboard?.avg_price_diff_pct != null ? `${dashboard.avg_price_diff_pct > 0 ? "+" : ""}${dashboard.avg_price_diff_pct.toFixed(1)}%` : "—", color: dashboard?.avg_price_diff_pct > 0 ? "red" : "green" },
              ].map(c => (
                <div key={c.label} className={`bg-${c.color}-50 rounded-xl p-4`}>
                  <p className={`text-xs font-medium text-${c.color}-600 mb-1`}>{c.label}</p>
                  <p className={`text-2xl font-bold text-${c.color}-700`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Trend distribution */}
            {dashboard?.trends_by_direction && (
              <div className="bg-white border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución de tendencias</h3>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-600">En alza:</span>
                    <span className="font-bold text-green-600">{dashboard.trends_by_direction.UP ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                    <span className="text-sm text-gray-600">En baja:</span>
                    <span className="font-bold text-red-600">{dashboard.trends_by_direction.DOWN ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-600">Estable:</span>
                    <span className="font-bold text-gray-600">{dashboard.trends_by_direction.STABLE ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent competitors */}
            {dashboard?.recent_competitors?.length > 0 && (
              <div className="bg-white border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimos relevamientos</h3>
                <div className="space-y-2">
                  {dashboard.recent_competitors.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <span className="font-medium text-sm text-gray-800">{c.competitor_name}</span>
                        <span className="text-xs text-gray-400 ml-2">{c.product_name}</span>
                      </div>
                      {c.price_diff_pct != null && (
                        <span className={`text-sm font-semibold ${pctColor(c.price_diff_pct)}`}>
                          {c.price_diff_pct > 0 ? "+" : ""}{c.price_diff_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(dashboard?.total_competitors === 0 && dashboard?.total_trends === 0) && (
              <div className="text-center py-16 text-gray-400">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Sin datos todavía</p>
                <p className="text-sm mt-1">Usá las pestañas para cargar competidores y tendencias.</p>
              </div>
            )}
          </div>
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
    </div>
  );
}
