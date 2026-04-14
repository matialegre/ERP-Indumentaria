/**
 * ComparadorOmbak — compara un pedido (Excel) contra una factura/remito (PDF) de Ombak.
 * Props: { onClose, purchaseOrderId? }
 */
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import {
  GitCompare, X, FileSpreadsheet, FileText,
  Loader2, AlertTriangle, CheckCircle,
} from "lucide-react";

/* ── Status metadata ──────────────────────────────────────────────────────── */
const STATUS_META = {
  OK:         { label: "OK",         bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
  DIFERENCIA: { label: "Diferencia", bg: "bg-red-50",    text: "text-red-700",    badge: "bg-red-100 text-red-700" },
  SOLO_EXCEL: { label: "Solo Excel", bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  SOLO_PDF:   { label: "Solo PDF",   bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
};

const STATUS_ORDER = { DIFERENCIA: 0, SOLO_EXCEL: 1, SOLO_PDF: 2, OK: 3 };

/* ── Column auto-detection ───────────────────────────────────────────────── */
function detectColumns(rows) {
  if (!rows || rows.length < 2) return { codeCol: 0, qtyCol: 1 };

  const headers = rows[0];
  let codeCol = -1;
  let qtyCol = -1;

  // 1. Try header keywords
  headers.forEach((h, i) => {
    const s = String(h).toLowerCase().trim();
    if (codeCol === -1 && (s.includes("cod") || s.includes("art") || s.includes("sku") || s.includes("ref") || s.includes("item"))) {
      codeCol = i;
    }
    if (qtyCol === -1 && (s.includes("cant") || s.includes("qty") || s.includes("unid") || s.includes("pack") || s.includes("piezas"))) {
      qtyCol = i;
    }
  });

  // 2. Fallback: infer by content type
  if (codeCol === -1 || qtyCol === -1) {
    const dataRows = rows.slice(1, Math.min(11, rows.length));
    headers.forEach((_, i) => {
      const vals = dataRows.map((r) => r[i]).filter((v) => v !== "" && v !== null && v !== undefined);
      if (!vals.length) return;
      const numericCount  = vals.filter((v) => !isNaN(parseFloat(v)) && isFinite(v)).length;
      const alphaCount    = vals.filter((v) => /[a-zA-Z]/.test(String(v))).length;
      if (codeCol === -1 && alphaCount >= numericCount && alphaCount > 0) codeCol = i;
      if (qtyCol  === -1 && numericCount === vals.length && numericCount > 0) qtyCol = i;
    });
  }

  return {
    codeCol: codeCol >= 0 ? codeCol : 0,
    qtyCol:  qtyCol  >= 0 ? qtyCol  : Math.min(1, headers.length - 1),
  };
}

/* ── Drop zone component ─────────────────────────────────────────────────── */
function DropZone({ accept, label, sublabel, icon: Icon, file, onFile, loading, error, badge }) {
  const ref = useRef();
  const hasFile = !!file;
  const isError = !!error;

  const borderCls = isError
    ? "border-red-400 bg-red-50"
    : hasFile
    ? "border-green-400 bg-green-50"
    : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50";

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${borderCls}`}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files[0])} />
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={32} className="text-indigo-500 animate-spin" />
          <p className="text-sm text-indigo-600 font-medium">Procesando…</p>
        </div>
      ) : isError ? (
        <div>
          <AlertTriangle size={32} className="mx-auto mb-2 text-red-400" />
          <p className="text-sm text-red-600 font-medium">Error al procesar</p>
          <p className="text-xs text-red-400 mt-1 truncate max-w-[200px] mx-auto">{error}</p>
          <p className="text-xs text-red-400 mt-1">Hacé clic para reintentar</p>
        </div>
      ) : hasFile ? (
        <div>
          <Icon size={32} className="mx-auto mb-2 text-green-600" />
          <p className="font-medium text-green-700 text-sm truncate max-w-[220px] mx-auto">{file.name}</p>
          {badge && <p className="text-xs text-green-600 mt-1">{badge}</p>}
          <p className="text-xs text-gray-400 mt-1">Hacé clic para cambiar</p>
        </div>
      ) : (
        <div>
          <Icon size={32} className="mx-auto mb-2 text-gray-400" />
          <p className="font-medium text-gray-700 text-sm">{label}</p>
          <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function ComparadorOmbak({ onClose }) {
  const [excelFile, setExcelFile]   = useState(null);
  const [pdfFile, setPdfFile]       = useState(null);
  const [excelData, setExcelData]   = useState(null); // { sheets, data }
  const [pdfItems, setPdfItems]     = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError]     = useState(null);

  // Column/sheet selection
  const [activeSheet, setActiveSheet] = useState(0);
  const [codeCol, setCodeCol]         = useState(null);
  const [qtyCol, setQtyCol]           = useState(null);

  /* ── Load Excel ─────────────────────────────────────────────────────────── */
  const handleExcel = async (file) => {
    if (!file) return;
    setExcelFile(file);
    setExcelData(null);
    setCodeCol(null);
    setQtyCol(null);
    setActiveSheet(0);

    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: "array" });
    const sheets = wb.SheetNames;
    const data   = {};
    sheets.forEach((name) => {
      data[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    });

    const parsed = { sheets, data };
    setExcelData(parsed);

    const detected = detectColumns(data[sheets[0]] ?? []);
    setCodeCol(detected.codeCol);
    setQtyCol(detected.qtyCol);
  };

  /* ── Load PDF ───────────────────────────────────────────────────────────── */
  const handlePdf = async (file) => {
    if (!file) return;
    setPdfFile(file);
    setPdfItems(null);
    setPdfError(null);
    setLoadingPdf(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api.postForm("/pdf-parser/parse-pdf", form);
      setPdfItems(result.items ?? []);
    } catch (e) {
      setPdfError(e.message);
      setPdfItems(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  /* ── Derived headers ────────────────────────────────────────────────────── */
  const sheetRows = useMemo(() => {
    if (!excelData) return [];
    return excelData.data[excelData.sheets[activeSheet]] ?? [];
  }, [excelData, activeSheet]);

  const headers = sheetRows[0] ?? [];

  /* ── Comparison (derived, auto-updates on any dependency change) ────────── */
  const comparison = useMemo(() => {
    if (!excelData || !pdfItems || codeCol === null || qtyCol === null) return null;

    // Build Excel map: code → qty
    const excelMap = {};
    sheetRows.slice(1).forEach((row) => {
      const code = String(row[codeCol] ?? "").trim().toUpperCase();
      const qty  = parseFloat(row[qtyCol]) || 0;
      if (code && qty > 0) excelMap[code] = (excelMap[code] || 0) + qty;
    });

    // Build PDF map: code → { qty, desc }
    const pdfMap = {};
    pdfItems.forEach((item) => {
      const code = String(item.codigo_articulo ?? "").trim().toUpperCase();
      if (code) pdfMap[code] = { qty: parseFloat(item.unidades) || 0, desc: item.descripcion ?? "" };
    });

    const allCodes = new Set([...Object.keys(excelMap), ...Object.keys(pdfMap)]);
    const rows = [];

    allCodes.forEach((code) => {
      const inExcel  = code in excelMap;
      const inPdf    = code in pdfMap;
      const excelQty = excelMap[code] ?? 0;
      const pdfQty   = pdfMap[code]?.qty ?? 0;

      let status;
      if (inExcel && inPdf)   status = excelQty === pdfQty ? "OK" : "DIFERENCIA";
      else if (inExcel)        status = "SOLO_EXCEL";
      else                     status = "SOLO_PDF";

      rows.push({
        code,
        desc:     pdfMap[code]?.desc ?? "",
        excelQty,
        pdfQty,
        diff:     pdfQty - excelQty,
        status,
      });
    });

    return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [excelData, pdfItems, codeCol, qtyCol, sheetRows]);

  /* ── Summary counts ─────────────────────────────────────────────────────── */
  const summary = useMemo(() => {
    if (!comparison) return null;
    return comparison.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
  }, [comparison]);

  const excelBadge = excelData
    ? `${excelData.sheets.length} hoja(s) — ${Math.max(0, (excelData.data[excelData.sheets[0]]?.length ?? 1) - 1)} filas`
    : null;

  const pdfBadge = pdfItems ? `${pdfItems.length} ítems extraídos` : null;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare size={22} className="text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Comparador Ombak</h2>
              <p className="text-xs text-gray-500">Comparar pedido Excel contra factura/remito PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Upload areas */}
        <div className="grid grid-cols-2 gap-4 px-6 py-4 border-b flex-shrink-0">
          <DropZone
            accept=".xlsx,.xls"
            label="Excel de Pedido"
            sublabel="Arrastrá o hacé clic — .xlsx / .xls"
            icon={FileSpreadsheet}
            file={excelFile}
            onFile={handleExcel}
            badge={excelBadge}
          />
          <DropZone
            accept=".pdf"
            label="PDF de Factura / Remito"
            sublabel="Arrastrá o hacé clic — .pdf"
            icon={FileText}
            file={pdfFile}
            onFile={handlePdf}
            loading={loadingPdf}
            error={pdfError}
            badge={pdfBadge}
          />
        </div>

        {/* Column picker (shown when Excel is loaded) */}
        {excelData && (
          <div className="flex items-center gap-4 flex-wrap px-6 py-2.5 bg-gray-50 border-b flex-shrink-0">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Columnas Excel:</span>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Códigos:</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={codeCol ?? 0}
                onChange={(e) => setCodeCol(parseInt(e.target.value))}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h !== "" ? h : `Columna ${i + 1}`}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500">Cantidades:</label>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={qtyCol ?? 1}
                onChange={(e) => setQtyCol(parseInt(e.target.value))}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>{h !== "" ? h : `Columna ${i + 1}`}</option>
                ))}
              </select>
            </div>

            {excelData.sheets.length > 1 && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500">Hoja:</label>
                <select
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={activeSheet}
                  onChange={(e) => setActiveSheet(parseInt(e.target.value))}
                >
                  {excelData.sheets.map((s, i) => (
                    <option key={i} value={i}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {comparison && (
              <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
                <CheckCircle size={12} className="text-green-500" />
                Comparación activa — cambiá columnas para actualizar
              </span>
            )}
          </div>
        )}

        {/* Summary bar */}
        {summary && (
          <div className="flex items-center gap-3 flex-wrap px-6 py-2 bg-white border-b flex-shrink-0">
            {Object.entries(summary).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[status].badge}`}
              >
                {STATUS_META[status].label}: {count}
              </span>
            ))}
            <span className="ml-auto text-xs text-gray-400">{comparison.length} artículos en total</span>
          </div>
        )}

        {/* Comparison table */}
        <div className="flex-1 overflow-auto">
          {!comparison ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-3">
              <GitCompare size={48} className="opacity-20" />
              <p className="text-sm">
                {!excelData && !pdfItems
                  ? "Cargá ambos archivos para comparar"
                  : !excelData
                  ? "Falta el Excel de pedido"
                  : !pdfItems
                  ? "Falta el PDF de factura/remito"
                  : "Ajustá las columnas arriba"}
              </p>
            </div>
          ) : comparison.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400 gap-2">
              <CheckCircle size={40} className="text-green-400 opacity-60" />
              <p className="text-sm">Sin artículos para comparar</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  {["Código", "Descripción", "Cant. Excel", "Cant. PDF", "Diferencia", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparison.map((row, i) => {
                  const meta = STATUS_META[row.status];
                  return (
                    <tr key={i} className={`${meta.bg} hover:brightness-95 transition-all`}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{row.code}</td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate" title={row.desc}>
                        {row.desc || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {row.status !== "SOLO_PDF" ? row.excelQty : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {row.status !== "SOLO_EXCEL" ? row.pdfQty : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {row.status === "OK" && <span className="text-green-600">0</span>}
                        {row.status === "DIFERENCIA" && (
                          <span className={row.diff > 0 ? "text-blue-600" : "text-red-600"}>
                            {row.diff > 0 ? "+" : ""}{row.diff}
                          </span>
                        )}
                        {(row.status === "SOLO_EXCEL" || row.status === "SOLO_PDF") && (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
