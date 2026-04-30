import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  FileText, Upload, Download, Table, RefreshCw,
  CheckCircle, XCircle, Package, Layers, Hash, BarChart2,
  ChevronDown, ChevronUp, Search, X
} from "lucide-react";
import { api, SERVER_BASE } from "../lib/api";
import { useToast } from "../components/ToastProvider";

export default function ReorganizadorPDFPage() {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("modelo");
  const [sortDir, setSortDir] = useState("asc");

  // ── Proceso principal ──────────────────────────────────────────────────
  const processMutation = useMutation({
    mutationFn: async (f) => {
      const form = new FormData();
      form.append("file", f);
      return api.uploadFile("/pdf-inventario/process", form);
    },
    onSuccess: (data) => {
      setResult(data);
      toast(`✅ ${data.stats.total_filas} variantes procesadas`, "success");
    },
    onError: (e) => {
      toast(`Error: ${e.message}`, "error");
    },
  });

  // ── Descarga binaria ───────────────────────────────────────────────────
  const handleDownload = async (format) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const endpoint = format === "excel" ? "download-excel" : "download-pdf";
    const ext = format === "excel" ? "xlsx" : "pdf";
    const name = file.name.replace(/\.pdf$/i, "");
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch(`${SERVER_BASE}/api/v1/pdf-inventario/${endpoint}`, {
        method: "POST",
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventario_${name}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ type: "error", message: `Error descargando: ${e.message}` });
    }
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".pdf")) {
      setFile(f);
      setResult(null);
    } else {
      toast({ type: "error", message: "Solo se aceptan archivos PDF" });
    }
  }, [toast]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setResult(null); }
  };

  // ── Filtrado y sort ────────────────────────────────────────────────────
  const filteredRows = result
    ? result.rows.filter((r) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.modelo.toLowerCase().includes(q) ||
          r.color.toLowerCase().includes(q) ||
          r.talle.toLowerCase().includes(q) ||
          (r.sku || "").toLowerCase().includes(q)
        );
      })
    : [];

  const sortedRows = [...filteredRows].sort((a, b) => {
    // cantidad siempre numérico
    if (sortField === "cantidad") {
      return sortDir === "asc" ? a.cantidad - b.cantidad : b.cantidad - a.cantidad;
    }
    // talle: numérico cuando ambos son números, textual en caso contrario
    if (sortField === "talle") {
      const na = parseFloat(a.talle);
      const nb = parseFloat(b.talle);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
    }
    const va = String(a[sortField] ?? "").toLowerCase();
    const vb = String(b[sortField] ?? "").toLowerCase();
    const cmp = va.localeCompare(vb, "es-AR");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-cyan-400" />
      : <ChevronDown className="w-3 h-3 text-cyan-400" />;
  };

  const isLoading = processMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Reorganizador de PDF de Inventario</h1>
            <p className="text-sm text-gray-500">
              Cargá un PDF de picking/inbound · Se organiza por Modelo → Color → Talle
            </p>
          </div>
        </div>

        {result && (
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload("excel")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => handleDownload("pdf")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
            >
              <FileText className="w-4 h-4" />
              PDF ordenado
            </button>
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${dragOver
            ? "border-cyan-400 bg-cyan-50"
            : file
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-gray-400 bg-gray-50"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {file ? (
          <div className="space-y-2">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-gray-800 font-medium">{file.name}</p>
            <p className="text-gray-500 text-sm">
              {(file.size / 1024).toFixed(1)} KB · Click para cambiar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Upload className="w-10 h-10 text-gray-400 mx-auto" />
            <div>
              <p className="text-gray-700 font-medium">
                Arrastrá el PDF aquí o hacé click para seleccionar
              </p>
              <p className="text-gray-500 text-sm mt-1">
                PDFs tipo "Inbound" o listas de inventario · Máx. 20 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botón procesar */}
      {file && !result && (
        <div className="flex justify-center">
          <button
            onClick={() => processMutation.mutate(file)}
            disabled={isLoading}
            className="flex items-center gap-3 px-8 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-lg transition disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Table className="w-5 h-5" />
                Procesar Inventario
              </>
            )}
          </button>
        </div>
      )}

      {file && result && (
        <div className="flex justify-center">
          <button
            onClick={() => { setFile(null); setResult(null); setSearch(""); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Procesar otro PDF
          </button>
        </div>
      )}

      {/* Error */}
      {processMutation.isError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{processMutation.error?.message}</span>
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Package,   label: "Modelos",     value: result.stats.total_modelos,   color: "text-blue-600",   bg: "bg-blue-50" },
              { icon: Layers,    label: "Variantes",   value: result.stats.total_filas,     color: "text-purple-600", bg: "bg-purple-50" },
              { icon: Hash,      label: "SKUs únicos", value: result.stats.total_skus,      color: "text-cyan-600",   bg: "bg-cyan-50" },
              { icon: BarChart2, label: "Unidades",    value: result.stats.total_unidades,  color: "text-green-600",  bg: "bg-green-50" },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4 border border-gray-200`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-gray-500 text-xs">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, color, talle o SKU..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { field: "modelo",   label: "MODELO" },
                      { field: "color",    label: "COLOR" },
                      { field: "talle",    label: "TALLE" },
                      { field: "sku",      label: "SKU" },
                      { field: "cantidad", label: "CANT." },
                    ].map(({ field, label }) => (
                      <th
                        key={field}
                        onClick={() => toggleSort(field)}
                        className="px-4 py-3 text-left text-gray-500 font-semibold cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1">
                          {label} <SortIcon field={field} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No hay resultados para &ldquo;{search}&rdquo;
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-gray-800 max-w-xs">
                          <span className="line-clamp-2 text-xs leading-relaxed">{row.modelo}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs whitespace-nowrap">
                            {row.color}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">
                          {row.talle}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs whitespace-nowrap">
                          {row.sku || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`font-bold text-sm ${
                            row.cantidad >= 3 ? "text-green-600" :
                            row.cantidad === 2 ? "text-amber-600" : "text-red-500"
                          }`}>
                            {row.cantidad}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredRows.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 text-gray-400 text-xs flex justify-between">
                <span>
                  {filteredRows.length} variantes
                  {search ? ` de ${result.rows.length} totales` : ""}
                </span>
                <span>
                  {filteredRows.reduce((s, r) => s + r.cantidad, 0).toLocaleString()} unidades
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
