/**
 * ExcelViewer — visor de archivos Excel genérico
 *
 * Props:
 *   file        — File object (subido localmente)
 *   url         — URL a fetchear (con Bearer token)
 *   data        — datos pre-parseados { sheets: string[], data: { [sheet]: any[][] } }
 *   filename    — nombre a mostrar
 *   downloadUrl — URL para descargar (opcional; si hay `url` se usa esa)
 *   onClose     — callback para cerrar
 */
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";

function parseWorkbook(wb) {
  const sheets = wb.SheetNames;
  const data = {};
  sheets.forEach((name) => {
    const ws = wb.Sheets[name];
    data[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  });
  return { sheets, data };
}

export default function ExcelViewer({ file, url, data: propData, filename = "archivo.xlsx", downloadUrl, onClose }) {
  const [parsed, setParsed] = useState(propData ?? null);
  const [loading, setLoading] = useState(!propData);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    if (propData) { setParsed(propData); setLoading(false); return; }

    const token = sessionStorage.getItem("token");

    async function loadData() {
      try {
        setLoading(true);
        let arrayBuffer;
        if (file) {
          arrayBuffer = await file.arrayBuffer();
        } else if (url) {
          const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) throw new Error(`Error ${res.status}`);
          arrayBuffer = await res.arrayBuffer();
        } else {
          throw new Error("Necesitás proporcionar file, url o data");
        }
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        setParsed(parseWorkbook(wb));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [file, url, propData]);

  const handleDownload = () => {
    const href = downloadUrl || url;
    if (href) {
      window.open(href, "_blank");
    } else if (file) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = filename;
      a.click();
    }
  };

  /* ── Loading ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3 shadow-2xl">
          <Loader2 size={22} className="animate-spin text-green-600" />
          <span className="text-gray-700">Cargando Excel…</span>
        </div>
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────── */
  if (error || !parsed) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-sm shadow-2xl">
          <div className="flex items-center gap-2 text-red-600 mb-3">
            <AlertCircle size={20} />
            <h3 className="font-semibold">Error al cargar</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">{error || "No se pudo leer el archivo."}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { sheets, data } = parsed;
  const currentData = data[sheets[activeSheet]] ?? [];
  // Compute max column count
  const maxCols = currentData.reduce((m, row) => Math.max(m, row.length), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} className="text-green-600" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">{filename}</p>
              <p className="text-xs text-gray-400">{sheets.length} hoja{sheets.length !== 1 ? "s" : ""} · {currentData.length} filas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Download size={14} /> Descargar
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sheet tabs */}
        {sheets.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b overflow-x-auto flex-shrink-0">
            <button
              onClick={() => setActiveSheet((s) => Math.max(0, s - 1))}
              disabled={activeSheet === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 flex-shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            {sheets.map((sheet, idx) => (
              <button
                key={sheet}
                onClick={() => setActiveSheet(idx)}
                className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition ${
                  idx === activeSheet
                    ? "bg-white shadow text-green-700 border border-gray-200"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {sheet}
              </button>
            ))}
            <button
              onClick={() => setActiveSheet((s) => Math.min(sheets.length - 1, s + 1))}
              disabled={activeSheet === sheets.length - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 flex-shrink-0"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {currentData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 py-16">
              Esta hoja está vacía
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1.5 text-gray-400 font-medium w-8">#</th>
                  {Array.from({ length: maxCols }).map((_, ci) => (
                    <th key={ci} className="border border-gray-200 px-2 py-1.5 text-gray-600 font-medium min-w-[90px] text-left">
                      {String.fromCharCode(65 + (ci % 26))}{ci >= 26 ? String(Math.floor(ci / 26)) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, ri) => (
                  <tr key={ri} className={ri === 0 ? "bg-blue-50 font-medium" : "hover:bg-gray-50"}>
                    <td className="border border-gray-200 px-2 py-1 text-gray-400 bg-gray-50 text-center">{ri + 1}</td>
                    {Array.from({ length: maxCols }).map((_, ci) => (
                      <td
                        key={ci}
                        className="border border-gray-200 px-2 py-1 text-gray-800 max-w-[200px] truncate"
                        title={String(row[ci] ?? "")}
                      >
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex-shrink-0">
          {currentData.length} filas × {maxCols} columnas
        </div>
      </div>
    </div>
  );
}
