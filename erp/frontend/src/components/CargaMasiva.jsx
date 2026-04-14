import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Upload, FileText, Loader2, Trash2, CheckCircle,
  AlertCircle, AlertTriangle, Save, ChevronDown,
} from "lucide-react";
import { api } from "../lib/api";

// ── Constants ────────────────────────────────────────────────────────────────

const PROVEEDOR_BADGE = {
  MIDING:      "bg-cyan-100 text-cyan-700 border border-cyan-200",
  MONTAGNE:    "bg-violet-100 text-violet-700 border border-violet-200",
  WORLD_SPORT: "bg-green-100 text-green-700 border border-green-200",
  DESCONOCIDO: "bg-amber-100 text-amber-700 border border-amber-200",
};

const TIPO_BADGE = {
  FACTURA:        "bg-blue-100 text-blue-700",
  REMITO:         "bg-orange-100 text-orange-700",
  REMITO_FACTURA: "bg-purple-100 text-purple-700",
};

const TIPO_LABEL = {
  FACTURA:        "FACTURA",
  REMITO:         "REMITO",
  REMITO_FACTURA: "REM+FAC",
};

// DD/MM/YYYY → YYYY-MM-DD
function parseFecha(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CargaMasiva({ onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: upload, 2: results, 3: summary
  const [selectedFiles, setSelectedFiles] = useState([]); // { id, file }
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [rows, setRows] = useState([]); // parsed results with state
  const [savingAll, setSavingAll] = useState(false);
  const [summary, setSummary] = useState(null); // { saved, errors, duplicates }
  const fileInputRef = useRef(null);

  // Load purchase orders
  const { data: pedidosData } = useQuery({
    queryKey: ["purchase-orders-masivo"],
    queryFn: () => api.get("/purchase-orders/?limit=200&status=ENVIADO"),
  });
  const pedidos = pedidosData?.items ?? [];

  // ── File selection ──────────────────────────────────────────────────────────

  const addFiles = useCallback((fileList) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) return;
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.file.name));
      const newOnes = pdfs
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({ id: uid(), file: f }));
      return [...prev, ...newOnes];
    });
  }, []);

  const removeFile = (id) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Process PDFs ────────────────────────────────────────────────────────────

  const procesarPdfs = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setProcessError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(({ file }) => formData.append("files", file));
      const results = await api.postForm("/pdf-parser/parse-pdfs-masivo", formData);

      // Build rows with extra state
      const numeros = results
        .filter((r) => !r.error && r.numero)
        .map((r) => r.numero);

      // Check duplicates: any numero appearing more than once in this batch
      const batchDups = new Set(
        numeros.filter((n, i) => numeros.indexOf(n) !== i)
      );

      const built = results.map((r) => ({
        id: uid(),
        filename: r.filename,
        proveedor: r.proveedor,
        tipo: r.tipo_doc,
        numero: r.numero,
        fecha: r.fecha,
        remito_ref: r.remito_ref,
        nota_venta: r.nota_venta,
        total_unidades: r.total_unidades,
        total_items: r.total_items,
        items: r.items ?? [],
        parseError: r.error ?? null,
        isDuplicate: !r.error && r.numero ? batchDups.has(r.numero) : false,
        purchase_order_id: "",
        rowStatus: r.error ? "error" : "ready", // ready | saving | saved | error
        rowError: null,
      }));

      setRows(built);
      setStep(2);
    } catch (e) {
      setProcessError(e.message || "Error al procesar los PDFs");
    } finally {
      setProcessing(false);
    }
  };

  // ── Save individual row ────────────────────────────────────────────────────

  const saveRow = async (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.rowStatus !== "ready" || row.isDuplicate || row.parseError) return;

    setRows((prev) =>
      prev.map((r) => r.id === rowId ? { ...r, rowStatus: "saving" } : r)
    );

    try {
      const payload = buildPayload(row);
      await api.post("/purchase-invoices/", payload);
      setRows((prev) =>
        prev.map((r) => r.id === rowId ? { ...r, rowStatus: "saved", rowError: null } : r)
      );
      if (onSuccess) onSuccess();
    } catch (e) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, rowStatus: "error", rowError: e.message || "Error al guardar" } : r
        )
      );
    }
  };

  // ── Save all ───────────────────────────────────────────────────────────────

  const guardarTodos = async () => {
    const saveable = rows.filter(
      (r) => r.rowStatus === "ready" && !r.isDuplicate && !r.parseError
    );
    if (saveable.length === 0) return;

    setSavingAll(true);
    let saved = 0, errors = 0;
    const dupCount = rows.filter((r) => r.isDuplicate).length;
    const errCount = rows.filter((r) => r.parseError).length;

    for (const row of saveable) {
      setRows((prev) =>
        prev.map((r) => r.id === row.id ? { ...r, rowStatus: "saving" } : r)
      );
      try {
        const payload = buildPayload(row);
        await api.post("/purchase-invoices/", payload);
        setRows((prev) =>
          prev.map((r) => r.id === row.id ? { ...r, rowStatus: "saved", rowError: null } : r)
        );
        saved++;
      } catch (e) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, rowStatus: "error", rowError: e.message || "Error" } : r
          )
        );
        errors++;
      }
    }

    setSavingAll(false);
    setSummary({ saved, errors: errors + errCount, duplicates: dupCount });
    setStep(3);
    if (saved > 0 && onSuccess) onSuccess();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function buildPayload(row) {
    return {
      number: row.numero || "",
      type: row.tipo || "FACTURA",
      date: parseFecha(row.fecha) || new Date().toISOString().slice(0, 10),
      amount: row.items.reduce((sum, it) => sum + (it.unidades ?? 0) * (it.precio_unit ?? 0), 0) || 0,
      purchase_order_id: row.purchase_order_id ? parseInt(row.purchase_order_id) : null,
      items: (row.items ?? []).map((it) => ({
        code: it.codigo_articulo ?? "",
        description: it.descripcion ?? "",
        size: null,
        color: null,
        quantity_invoiced: it.unidades ?? it.packs ?? 0,
        unit_price: it.precio_unit ?? 0,
      })),
    };
  }

  const updatePedido = (rowId, val) => {
    setRows((prev) =>
      prev.map((r) => r.id === rowId ? { ...r, purchase_order_id: val } : r)
    );
  };

  const readyCount = rows.filter((r) => r.rowStatus === "ready" && !r.isDuplicate && !r.parseError).length;
  const savedCount = rows.filter((r) => r.rowStatus === "saved").length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-700 to-indigo-900">
          <div className="text-white">
            <h3 className="font-bold text-lg">Carga Masiva de PDFs</h3>
            <p className="text-indigo-200 text-sm">
              {step === 1 && "Seleccioná los archivos PDF para procesar"}
              {step === 2 && `${rows.length} documento${rows.length !== 1 ? "s" : ""} procesado${rows.length !== 1 ? "s" : ""} — asigná pedido y guardá`}
              {step === 3 && "Proceso completado"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b bg-gray-50">
          {[
            { n: 1, label: "Selección" },
            { n: 2, label: "Resultados" },
            { n: 3, label: "Resumen" },
          ].map(({ n, label }) => (
            <div
              key={n}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                step === n
                  ? "text-indigo-700 border-b-2 border-indigo-600 bg-white"
                  : step > n
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                  step === n
                    ? "bg-indigo-600 text-white"
                    : step > n
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > n ? "✓" : n}
              </span>
              {label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${dragging ? "text-indigo-500" : "text-gray-400"}`} />
                <p className="text-gray-700 font-medium">
                  Arrastrá archivos PDF aquí <span className="text-gray-400 font-normal">o hacé clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-2">Solo archivos .pdf — MIDING, MONTAGNE, WORLD SPORT</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>

              {/* Selected files list */}
              {selectedFiles.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedFiles.length} archivo{selectedFiles.length !== 1 ? "s" : ""} seleccionado{selectedFiles.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      limpiar todo
                    </button>
                  </div>
                  <ul className="divide-y max-h-52 overflow-y-auto">
                    {selectedFiles.map(({ id, file }) => (
                      <li key={id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                        <FileText className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {processError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {processError}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={procesarPdfs}
                  disabled={selectedFiles.length === 0 || processing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando {selectedFiles.length} archivo{selectedFiles.length !== 1 ? "s" : ""}...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Procesar {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ""}PDF{selectedFiles.length !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Results table ── */}
          {step === 2 && (
            <div className="flex flex-col h-full">
              {/* Stats bar */}
              <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b flex-wrap text-xs">
                {readyCount > 0 && (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                    {readyCount} listo{readyCount !== 1 ? "s" : ""}
                  </span>
                )}
                {savedCount > 0 && (
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
                    {savedCount} guardado{savedCount !== 1 ? "s" : ""}
                  </span>
                )}
                {rows.filter((r) => r.isDuplicate).length > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">
                    {rows.filter((r) => r.isDuplicate).length} duplicado{rows.filter((r) => r.isDuplicate).length !== 1 ? "s" : ""}
                  </span>
                )}
                {rows.filter((r) => r.parseError).length > 0 && (
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                    {rows.filter((r) => r.parseError).length} con error
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Archivo</th>
                      <th className="text-left px-3 py-3 font-medium">Proveedor</th>
                      <th className="text-left px-3 py-3 font-medium">Tipo</th>
                      <th className="text-left px-3 py-3 font-medium">Número</th>
                      <th className="text-left px-3 py-3 font-medium">Fecha</th>
                      <th className="text-center px-3 py-3 font-medium">Ítems</th>
                      <th className="text-center px-3 py-3 font-medium">Unidades</th>
                      <th className="text-left px-3 py-3 font-medium min-w-[180px]">Pedido</th>
                      <th className="text-center px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row) => {
                      const isError = !!row.parseError || (row.rowStatus === "error" && !row.isDuplicate);
                      const isDup = row.isDuplicate;
                      const isSaved = row.rowStatus === "saved";
                      const isSaving = row.rowStatus === "saving";

                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            isError && !isDup
                              ? "bg-red-50"
                              : isDup
                              ? "bg-yellow-50"
                              : isSaved
                              ? "bg-emerald-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          {/* Filename */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 max-w-[160px]">
                              <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span
                                className="truncate text-gray-700 text-xs"
                                title={row.filename}
                              >
                                {row.filename}
                              </span>
                            </div>
                          </td>

                          {/* Proveedor */}
                          <td className="px-3 py-3">
                            {row.proveedor ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  PROVEEDOR_BADGE[row.proveedor] ?? PROVEEDOR_BADGE.DESCONOCIDO
                                }`}
                              >
                                {row.proveedor === "WORLD_SPORT" ? "W.SPORT" : row.proveedor}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Tipo */}
                          <td className="px-3 py-3">
                            {row.tipo ? (
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  TIPO_BADGE[row.tipo] ?? "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {TIPO_LABEL[row.tipo] ?? row.tipo}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Número */}
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs text-gray-700">
                              {row.numero || "—"}
                            </span>
                          </td>

                          {/* Fecha */}
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {row.fecha || "—"}
                          </td>

                          {/* Ítems */}
                          <td className="px-3 py-3 text-center text-xs text-gray-600">
                            {row.total_items ?? "—"}
                          </td>

                          {/* Unidades */}
                          <td className="px-3 py-3 text-center text-xs text-gray-600">
                            {row.total_unidades != null
                              ? row.total_unidades.toLocaleString("es-AR")
                              : "—"}
                          </td>

                          {/* Pedido selector */}
                          <td className="px-3 py-3">
                            {!row.parseError && !isDup && !isSaved ? (
                              <div className="relative">
                                <select
                                  value={row.purchase_order_id}
                                  onChange={(e) => updatePedido(row.id, e.target.value)}
                                  disabled={isSaving}
                                  className="w-full appearance-none pl-2 pr-6 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                  <option value="">Sin pedido</option>
                                  {pedidos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      #{p.number}
                                      {p.provider_name ? ` — ${p.provider_name}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="h-3 w-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-3 py-3 text-center">
                            {row.parseError ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                                title={row.parseError}
                              >
                                <AlertCircle className="h-3 w-3" />
                                ERROR
                              </span>
                            ) : isDup ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                <AlertTriangle className="h-3 w-3" />
                                DUP
                              </span>
                            ) : isSaved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                <CheckCircle className="h-3 w-3" />
                                OK
                              </span>
                            ) : isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin text-indigo-500 mx-auto" />
                            ) : row.rowStatus === "error" ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 cursor-help"
                                title={row.rowError}
                              >
                                <AlertCircle className="h-3 w-3" />
                                ERROR
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                LISTO
                              </span>
                            )}
                          </td>

                          {/* Save button */}
                          <td className="px-3 py-3">
                            {!row.parseError && !isDup && !isSaved && !isSaving && (
                              <button
                                onClick={() => saveRow(row.id)}
                                disabled={row.rowStatus !== "ready" && row.rowStatus !== "error"}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Save className="h-3 w-3" />
                                Guardar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 3: Summary ── */}
          {step === 3 && summary && (
            <div className="flex flex-col items-center justify-center p-12 gap-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-bold text-gray-800 mb-1">Proceso completado</h4>
                <p className="text-gray-500 text-sm">Resultados de la carga masiva</p>
              </div>
              <div className="flex gap-6">
                <div className="text-center px-6 py-4 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-3xl font-bold text-emerald-700">{summary.saved}</p>
                  <p className="text-sm text-emerald-600 mt-1">guardado{summary.saved !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center px-6 py-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <p className="text-3xl font-bold text-yellow-700">{summary.duplicates}</p>
                  <p className="text-sm text-yellow-600 mt-1">duplicado{summary.duplicates !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-center px-6 py-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-3xl font-bold text-red-700">{summary.errors}</p>
                  <p className="text-sm text-red-600 mt-1">error{summary.errors !== 1 ? "es" : ""}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-2.5 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              {readyCount > 0
                ? `${readyCount} documento${readyCount !== 1 ? "s" : ""} listo${readyCount !== 1 ? "s" : ""} para guardar`
                : savedCount === rows.length
                ? "Todos los documentos han sido guardados"
                : "No hay documentos listos para guardar"}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarTodos}
                disabled={readyCount === 0 || savingAll}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
              >
                {savingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar todos ({readyCount})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
