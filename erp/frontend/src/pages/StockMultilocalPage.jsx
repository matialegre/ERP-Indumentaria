import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Globe,
  Search,
  Settings2,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

// ── Columnas base (informativas, no de stock) ──────────────────────────────
const BASE_COLS = [
  { key: "CODIGO_ARTICULO", label: "Código",      defaultWidth: 110 },
  { key: "DESCRIPCION",     label: "Descripción", defaultWidth: 260 },
  { key: "MARCA",           label: "Marca",       defaultWidth: 110 },
  { key: "CODIGO_COLOR",    label: "Color",       defaultWidth: 90  },
  { key: "CODIGO_TALLE",    label: "Talle",       defaultWidth: 80  },
];

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

export default function StockMultilocalPage() {
  // ── Filtros ──────────────────────────────────────────────────────────────
  const [search, setSearch]         = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedLocales, setSelectedLocales] = useState(
    () => loadLS("sml_locales", [])
  );
  const [marcaFilter, setMarcaFilter] = useState("");

  // ── Columnas ─────────────────────────────────────────────────────────────
  const [colWidths, setColWidths]   = useState(() => loadLS("sml_col_widths", {}));
  const [hiddenCols, setHiddenCols] = useState(
    () => new Set(loadLS("sml_hidden_cols", []))
  );
  const [colsOpen, setColsOpen]     = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: localesDisponibles = [], isLoading: localesLoading } = useQuery({
    queryKey: ["locales-disponibles"],
    queryFn: () => api.get("/informes/locales-disponibles"),
    staleTime: 10 * 60 * 1000,
  });

  const { data: stockData, isLoading: stockLoading, refetch, isFetching } = useQuery({
    queryKey: ["stock-multilocal", selectedLocales, search, marcaFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (selectedLocales.length) p.set("locales", selectedLocales.join(","));
      if (search)      p.set("search", search);
      if (marcaFilter) p.set("marca", marcaFilter);
      return api.get(`/informes/stock-locales?${p}`);
    },
    enabled: selectedLocales.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const rows = stockData?.rows ?? [];
  const visibleLocales = selectedLocales.filter(l => !hiddenCols.has(l));
  const visibleBase    = BASE_COLS.filter(c => !hiddenCols.has(c.key));

  // ── Marcas únicas para el filtro ─────────────────────────────────────────
  const marcasDisponibles = [...new Set(rows.map(r => r.MARCA).filter(Boolean))].sort();

  // ── Locale helpers ───────────────────────────────────────────────────────
  function toggleLocale(loc) {
    setSelectedLocales(prev => {
      const next = prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc];
      localStorage.setItem("sml_locales", JSON.stringify(next));
      return next;
    });
  }
  function selectAll()   {
    setSelectedLocales([...localesDisponibles]);
    localStorage.setItem("sml_locales", JSON.stringify([...localesDisponibles]));
  }
  function clearAll()    {
    setSelectedLocales([]);
    localStorage.setItem("sml_locales", "[]");
  }

  // ── Column visibility ────────────────────────────────────────────────────
  function toggleHidden(key) {
    setHiddenCols(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem("sml_hidden_cols", JSON.stringify([...next]));
      return next;
    });
  }

  // ── Column resize ────────────────────────────────────────────────────────
  function startResize(e, colKey, currentW) {
    e.preventDefault();
    const startX = e.clientX;
    function onMove(ev) {
      const w = Math.max(50, currentW + (ev.clientX - startX));
      setColWidths(prev => {
        const next = { ...prev, [colKey]: w };
        localStorage.setItem("sml_col_widths", JSON.stringify(next));
        return next;
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Export CSV ───────────────────────────────────────────────────────────
  function exportCSV() {
    if (!rows.length) return;
    const headers = [...visibleBase.map(c => c.label), ...visibleLocales];
    const csvRows = rows.map(r =>
      [...visibleBase.map(c => String(r[c.key] ?? "")), ...visibleLocales.map(l => String(r[l] ?? 0))]
        .map(v => `"${v.replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([headers.join(",") + "\n" + csvRows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `stock-multilocal-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  // ── Stock color badge ────────────────────────────────────────────────────
  function stockBadge(val) {
    const n = val ?? 0;
    const cls = n === 0
      ? "bg-gray-100 text-gray-400"
      : n < 5
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold min-w-[32px] text-center ${cls}`}>{n}</span>;
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Globe size={22} className="text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Stock Multi-local</h1>
          {(stockLoading || isFetching) && (
            <RefreshCw size={16} className="text-violet-400 animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onBlur={() => setSearch(searchInput)}
              placeholder="Buscar código / descripción…"
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 w-56"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setSearch(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </form>

          {/* Marca filter */}
          {marcasDisponibles.length > 0 && (
            <select
              value={marcaFilter}
              onChange={e => setMarcaFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Todas las marcas</option>
              {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          {/* Cols config */}
          <button
            onClick={() => setColsOpen(v => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm border transition ${
              colsOpen ? "bg-violet-50 border-violet-400 text-violet-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Settings2 size={14} /> Columnas
          </button>

          {/* Refresh */}
          <button onClick={() => refetch()} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 transition">
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Actualizar
          </button>

          {/* Export */}
          <button onClick={exportCSV} disabled={!rows.length}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 transition">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Body: sidebar + table */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Locale selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 w-48 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Locales / Depósitos</p>

          {localesLoading ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : (
            <>
              {/* Select all / clear */}
              <div className="flex gap-2 mb-1">
                <button onClick={selectAll}
                  className="flex-1 text-xs py-1 rounded bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium transition">
                  Todos
                </button>
                <button onClick={clearAll}
                  className="flex-1 text-xs py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium transition">
                  Ninguno
                </button>
              </div>

              <div className="border-t pt-2 space-y-1">
                {localesDisponibles.map(loc => {
                  const active = selectedLocales.includes(loc);
                  return (
                    <button
                      key={loc}
                      onClick={() => toggleLocale(loc)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition ${
                        active
                          ? "bg-violet-100 text-violet-800 font-semibold"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {active ? <CheckSquare size={13} className="text-violet-600 flex-shrink-0" /> : <Square size={13} className="text-gray-300 flex-shrink-0" />}
                      <span className="truncate">{loc}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {selectedLocales.length > 0 && (
            <div className="mt-auto pt-2 border-t">
              <p className="text-xs text-violet-600 font-semibold">{selectedLocales.length} seleccionado{selectedLocales.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>

        {/* Column config panel */}
        {colsOpen && (
          <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-4 w-44 flex-shrink-0 overflow-y-auto">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">Mostrar columnas</p>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 mb-1">Base</p>
              {BASE_COLS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-violet-700 py-0.5">
                  <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleHidden(col.key)} className="accent-violet-600" />
                  {col.label}
                </label>
              ))}
              {selectedLocales.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 mt-3 mb-1 pt-2 border-t">Locales</p>
                  {selectedLocales.map(loc => (
                    <label key={loc} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:text-violet-700 py-0.5">
                      <input type="checkbox" checked={!hiddenCols.has(loc)} onChange={() => toggleHidden(loc)} className="accent-violet-600" />
                      {loc}
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 min-w-0 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          {selectedLocales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-20">
              <Globe size={40} className="text-gray-200" />
              <p className="font-semibold text-gray-500">Seleccioná al menos un local</p>
              <p className="text-sm">Usá el panel de la izquierda para elegir los depósitos a comparar.</p>
              <button onClick={selectAll} className="mt-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition">
                Seleccionar todos
              </button>
            </div>
          ) : stockLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-20 text-gray-400">
              <RefreshCw size={30} className="text-violet-400 animate-spin" />
              <p>Cargando stock…</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {visibleBase.map(col => (
                      <th key={col.key}
                        className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 select-none relative whitespace-nowrap"
                        style={{ width: colWidths[col.key] ?? col.defaultWidth }}>
                        {col.label}
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-violet-300/50 transition"
                          onMouseDown={e => startResize(e, col.key, colWidths[col.key] ?? col.defaultWidth)}
                        />
                      </th>
                    ))}
                    {visibleLocales.map(loc => (
                      <th key={loc}
                        className="text-center px-2 py-2.5 text-xs font-semibold text-violet-700 bg-violet-50 select-none relative whitespace-nowrap"
                        style={{ width: colWidths[loc] ?? 85 }}>
                        <span className="truncate block">{loc}</span>
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-violet-300/50 transition"
                          onMouseDown={e => startResize(e, loc, colWidths[loc] ?? 85)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleBase.length + visibleLocales.length} className="text-center py-12 text-gray-400">
                        Sin resultados para los filtros seleccionados
                      </td>
                    </tr>
                  ) : rows.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/40"} hover:bg-violet-50/40 transition-colors`}>
                      {visibleBase.map(col => (
                        <td key={col.key}
                          className="px-3 py-2 text-gray-700 overflow-hidden"
                          style={{ width: colWidths[col.key] ?? col.defaultWidth, maxWidth: colWidths[col.key] ?? col.defaultWidth }}>
                          <span className="block truncate">{row[col.key] ?? "—"}</span>
                        </td>
                      ))}
                      {visibleLocales.map(loc => (
                        <td key={loc} className="px-2 py-2 text-center" style={{ width: colWidths[loc] ?? 85 }}>
                          {stockBadge(row[loc])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 text-xs text-gray-400 border-t bg-gray-50 flex items-center justify-between">
                <span>{rows.length} variantes</span>
                <span>{visibleLocales.length} local{visibleLocales.length !== 1 ? "es" : ""} visibles</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
