/**
 * ComparadorListaFacturas
 * Props: { providerId, providerName, onClose }
 *
 * Modal de 2 pasos:
 *   Paso 1 — Seleccionar o subir una lista de precios para el proveedor
 *   Paso 2 — Comparar todos los artículos facturados contra la lista
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Loader2,
  AlertCircle,
  Upload,
  ChevronDown,
  CheckCircle2,
  XCircle,
  TrendingDown,
  HelpCircle,
  PackageX,
  ArrowLeft,
  BarChart2,
  FileSpreadsheet,
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

const STATES = {
  OK:             { label: "OK",            cls: "bg-gray-100 text-gray-600",    icon: <CheckCircle2 size={12} className="inline mr-0.5" /> },
  FACTURA_MAYOR:  { label: "FACTURA MAYOR", cls: "bg-red-100 text-red-700",      icon: <XCircle      size={12} className="inline mr-0.5" /> },
  FACTURA_MENOR:  { label: "FACTURA MENOR", cls: "bg-green-100 text-green-700",  icon: <TrendingDown size={12} className="inline mr-0.5" /> },
  SIN_LISTA:      { label: "SIN LISTA",     cls: "bg-gray-50 text-gray-400",     icon: <HelpCircle   size={12} className="inline mr-0.5" /> },
  SIN_FACTURA:    { label: "SIN FACTURA",   cls: "bg-orange-100 text-orange-700",icon: <PackageX     size={12} className="inline mr-0.5" /> },
};

const FILTERS = ["Todos", "Solo Diferencias", "OK", "Sin Lista", "Sin Factura"];
const FILTER_MAP = {
  "Todos": null,
  "Solo Diferencias": (r) => r.state === "FACTURA_MAYOR" || r.state === "FACTURA_MENOR",
  "OK": (r) => r.state === "OK",
  "Sin Lista": (r) => r.state === "SIN_LISTA",
  "Sin Factura": (r) => r.state === "SIN_FACTURA",
};

function StateBadge({ state }) {
  const s = STATES[state] ?? STATES.SIN_LISTA;
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

/* ─── Step 1: list selector / uploader ───────────── */
function StepSelectList({ providerId, providerName, priceLists, onSelect, onBack }) {
  const [mode, setMode] = useState("select"); // "select" | "upload"
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState(null);
  const [season, setSeason] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("provider_id", providerId);
      fd.append("file", file);
      if (season) fd.append("season", season);
      if (notes) fd.append("notes", notes);
      return api.postForm("/price-lists/upload-excel", fd);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["price-lists", providerId] });
      onSelect(data.id, data.filename, data.item_count);
    },
    onError: (e) => setUploadError(e.message),
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6">
      <div className="text-center">
        <FileSpreadsheet size={40} className="text-blue-400 mx-auto mb-2" />
        <h3 className="text-lg font-bold text-gray-900">Seleccioná o subí una lista de precios</h3>
        <p className="text-sm text-gray-500 mt-1">Proveedor: <span className="font-medium text-gray-700">{providerName}</span></p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
        {["select", "upload"].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setUploadError(null); }}
            className={`px-4 py-2 text-sm font-medium transition ${
              mode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m === "select" ? "Usar lista existente" : "Subir nueva lista"}
          </button>
        ))}
      </div>

      {mode === "select" ? (
        /* Existing list selector */
        <div className="w-full max-w-md flex flex-col gap-3">
          {priceLists.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay listas cargadas para este proveedor</p>
          ) : (
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl pl-3 pr-8 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
              >
                <option value="">— Elegí una lista —</option>
                {priceLists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.filename}  ·  {pl.item_count} ítems
                    {pl.upload_date ? `  ·  ${pl.upload_date}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          )}
          <button
            disabled={!selectedId}
            onClick={() => {
              const pl = priceLists.find((p) => String(p.id) === String(selectedId));
              onSelect(selectedId, pl?.filename, pl?.item_count);
            }}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 transition"
          >
            Comparar con esta lista
          </button>
        </div>
      ) : (
        /* Upload form */
        <div className="w-full max-w-md flex flex-col gap-3">
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition"
            onClick={() => document.getElementById("cl-file-input").click()}
          >
            <Upload size={24} className={`mx-auto mb-2 ${file ? "text-blue-500" : "text-gray-300"}`} />
            <p className="text-sm text-gray-600">
              {file ? (
                <span className="text-blue-700 font-medium">{file.name}</span>
              ) : (
                <>
                  <span className="text-blue-600 font-medium">Elegí un archivo</span>{" "}
                  <span className="text-gray-400">o arrastrá aquí (.xlsx)</span>
                </>
              )}
            </p>
            <input
              id="cl-file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setUploadError(null); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Temporada (ej: 2024-2)"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="text"
              placeholder="Notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          {uploadError && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {uploadError}
            </div>
          )}
          <button
            disabled={!file || uploadMutation.isPending}
            onClick={() => { setUploadError(null); uploadMutation.mutate(); }}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 transition"
          >
            {uploadMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Procesando…</>
            ) : (
              <><Upload size={16} /> Subir y comparar</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Step 2: comparison table ───────────────────── */
function StepResults({ rows, listName, listItemCount, onBack }) {
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let r = rows;
    const fn = FILTER_MAP[filter];
    if (fn) r = r.filter(fn);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (row) =>
          (row.code ?? "").toLowerCase().includes(q) ||
          (row.description ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    return rows.reduce((acc, r) => { acc[r.state] = (acc[r.state] ?? 0) + 1; return acc; }, {});
  }, [rows]);

  const totals = useMemo(() => {
    let listTotal = 0, invoiceTotal = 0, countBoth = 0;
    rows.forEach((r) => {
      if (r.invoicePrice != null && r.listPrice != null) {
        listTotal += r.listPrice;
        invoiceTotal += r.invoicePrice;
        countBoth++;
      }
    });
    return { listTotal, invoiceTotal, diff: countBoth > 0 ? invoiceTotal - listTotal : null, countBoth };
  }, [rows]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-header */}
      <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center gap-3 flex-shrink-0 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 px-2 py-1 rounded-lg transition"
        >
          <ArrowLeft size={13} /> Cambiar lista
        </button>
        <div className="h-4 border-r border-gray-200" />
        <span className="text-xs text-gray-600 font-medium truncate max-w-[180px]" title={listName}>
          {listName}
        </span>
        <span className="text-xs text-gray-400">{listItemCount} ítems en lista</span>
        <input
          type="text"
          placeholder="Buscar código o descripción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-52"
        />
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(STATES).map(([key, val]) => (
            <span key={key} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${val.cls}`}>
              {key === "SIN_FACTURA" ? <PackageX size={11} /> : val.icon}
              {counts[key] ?? 0} {key.replace("_", " ")}
            </span>
          ))}
        </div>
        {totals.diff != null && (
          <div className="ml-auto text-xs text-gray-600">
            Δ factura vs lista:{" "}
            <span className={`font-bold ${totals.diff > 0 ? "text-red-600" : totals.diff < 0 ? "text-green-600" : "text-gray-700"}`}>
              {fmt(totals.diff)}
              {totals.listTotal > 0 && ` (${pct(totals.listTotal, totals.invoiceTotal)}%)`}
            </span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b bg-white flex-shrink-0 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${
              filter === f
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {f}
            <span className={`ml-1.5 text-[10px] font-normal ${filter === f ? "text-blue-200" : "text-gray-400"}`}>
              {FILTER_MAP[f] ? rows.filter(FILTER_MAP[f]).length : rows.length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 text-gray-600">
              <th className="px-3 py-2.5 text-left font-medium">Código</th>
              <th className="px-3 py-2.5 text-left font-medium">Descripción</th>
              <th className="px-3 py-2.5 text-right font-medium">Precio Lista</th>
              <th className="px-3 py-2.5 text-right font-medium">Precio Factura</th>
              <th className="px-3 py-2.5 text-right font-medium">Diferencia</th>
              <th className="px-3 py-2.5 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-gray-400">
                  No hay ítems que coincidan con el filtro
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const diff = row.listPrice != null && row.invoicePrice != null
                  ? row.invoicePrice - row.listPrice
                  : null;
                const p = diff != null && row.listPrice > 0 ? pct(row.listPrice, row.invoicePrice) : null;
                return (
                  <tr
                    key={idx}
                    className={`border-t border-gray-100 transition ${
                      row.state === "FACTURA_MAYOR" ? "bg-red-50 hover:bg-red-100" :
                      row.state === "FACTURA_MENOR" ? "bg-green-50 hover:bg-green-100" :
                      row.state === "SIN_FACTURA"   ? "bg-orange-50 hover:bg-orange-100" :
                      "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-gray-700">{row.code ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[240px] truncate" title={row.description}>
                      {row.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600">
                      {row.listPrice != null ? fmt(row.listPrice) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                      {row.invoicePrice != null ? fmt(row.invoicePrice) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      diff == null ? "text-gray-300" :
                      diff > 0 ? "text-red-600 font-semibold" :
                      diff < 0 ? "text-green-600 font-semibold" :
                      "text-gray-500"
                    }`}>
                      {diff != null ? (
                        <>
                          {fmt(diff)}
                          {p != null && (
                            <span className="ml-1 text-[10px] font-normal">
                              ({p > 0 ? "+" : ""}{p}%)
                            </span>
                          )}
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StateBadge state={row.state} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="px-5 py-2 border-t bg-gray-50 text-xs text-gray-400 flex-shrink-0">
        Mostrando {filtered.length} de {rows.length} artículos
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────────────── */
export default function ComparadorListaFacturas({ providerId, providerName, onClose }) {
  const [step, setStep] = useState(1);
  const [listId, setListId] = useState(null);
  const [listName, setListName] = useState("");
  const [listItemCount, setListItemCount] = useState(0);

  /* fetch existing price lists */
  const { data: priceLists = [] } = useQuery({
    queryKey: ["price-lists", providerId],
    queryFn: () => api.get(`/price-lists/?provider_id=${providerId}&limit=100`),
    enabled: !!providerId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* once a list is chosen → fetch its items + all invoices */
  const { data: listItems = [], isLoading: loadingList } = useQuery({
    queryKey: ["price-list-items", listId],
    queryFn: () => api.get(`/price-lists/${listId}/items?limit=2000`),
    enabled: !!listId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  const { data: invoicesRaw = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["purchase-invoices", "provider", providerId],
    queryFn: () => api.get(`/purchase-invoices/?provider_id=${providerId}&limit=500`),
    enabled: !!listId && !!providerId,
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  /* cross-reference: build unified rows */
  const rows = useMemo(() => {
    if (!listId || listItems.length === 0) return [];

    // Code → list price
    const listMap = new Map();
    listItems.forEach((it) => {
      if (it.code) listMap.set(String(it.code).trim(), { price: it.price ?? it.cost ?? null, desc: it.description });
    });

    // Code → latest invoice price (aggregate all invoices, use highest confidence)
    const invoiceMap = new Map();
    invoicesRaw.forEach((inv) => {
      (inv.items ?? []).forEach((it) => {
        const code = String(it.code ?? "").trim();
        if (!code) return;
        if (!invoiceMap.has(code)) {
          invoiceMap.set(code, { price: it.unit_price, desc: it.description });
        }
        // keep the entry (first occurrence per code; could be extended to latest invoice date)
      });
    });

    const allCodes = new Set([...listMap.keys(), ...invoiceMap.keys()]);
    const result = [];

    allCodes.forEach((code) => {
      const listEntry = listMap.get(code);
      const invEntry = invoiceMap.get(code);
      const listPrice = listEntry?.price ?? null;
      const invoicePrice = invEntry?.price ?? null;
      const description = invEntry?.desc ?? listEntry?.desc ?? null;

      let state;
      if (listPrice == null) state = "SIN_LISTA";
      else if (invoicePrice == null) state = "SIN_FACTURA";
      else if (invoicePrice > listPrice) state = "FACTURA_MAYOR";
      else if (invoicePrice < listPrice) state = "FACTURA_MENOR";
      else state = "OK";

      result.push({ code, description, listPrice, invoicePrice, state });
    });

    // Sort: FACTURA_MAYOR first, then FACTURA_MENOR, then OK, then SIN_LISTA, SIN_FACTURA
    const ORDER = { FACTURA_MAYOR: 0, FACTURA_MENOR: 1, OK: 2, SIN_LISTA: 3, SIN_FACTURA: 4 };
    result.sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9) || (a.code ?? "").localeCompare(b.code ?? ""));

    return result;
  }, [listId, listItems, invoicesRaw]);

  const isLoadingStep2 = loadingList || loadingInvoices;

  const handleSelectList = (id, name, count) => {
    setListId(id);
    setListName(name ?? "Lista de precios");
    setListItemCount(count ?? 0);
    setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-900">Comparador: Lista vs Facturas</h2>
              <p className="text-xs text-gray-400">
                {providerName ?? `Proveedor #${providerId}`}
                {step === 2 && ` · ${rows.length} artículos cruzados`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition ${
                    step >= s ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
                  }`}>{s}</div>
                  {s < 2 && <div className={`w-4 h-0.5 ${step > s ? "bg-blue-400" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {step === 1 ? (
          <StepSelectList
            providerId={providerId}
            providerName={providerName ?? `Proveedor #${providerId}`}
            priceLists={priceLists}
            onSelect={handleSelectList}
          />
        ) : isLoadingStep2 ? (
          <div className="flex-1 flex items-center justify-center gap-3">
            <Loader2 size={22} className="animate-spin text-blue-600" />
            <span className="text-gray-600 text-sm">Cruzando datos…</span>
          </div>
        ) : (
          <StepResults
            rows={rows}
            listName={listName}
            listItemCount={listItemCount}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}
