/**
 * PdfViewer — visor de PDFs genérico con autenticación Bearer
 *
 * Props:
 *   url         — URL del PDF (autenticada con Bearer token)
 *   filename    — nombre a mostrar
 *   downloadUrl — URL de descarga (opcional; por defecto usa `url`)
 *   onClose     — callback para cerrar
 */
import { useState, useEffect, useRef } from "react";
import { FileText, Download, X, ExternalLink, Loader2, AlertCircle } from "lucide-react";

export default function PdfViewer({ url, filename = "documento.pdf", downloadUrl, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!url) { setError("No se proporcionó una URL."); setLoading(false); return; }
    const token = localStorage.getItem("token");

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        blobRef.current = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, [url]);

  const handleDownload = () => {
    const href = downloadUrl || url;
    if (!href) return;
    const token = localStorage.getItem("token");
    fetch(href, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      });
  };

  const handleOpenNewTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={22} className="text-red-600" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">{filename}</p>
              <p className="text-xs text-gray-400">Documento PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewTab}
              disabled={!blobUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-40"
            >
              <ExternalLink size={14} /> Abrir
            </button>
            <button
              onClick={handleDownload}
              disabled={!blobUrl && !downloadUrl && !url}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-40"
            >
              <Download size={14} /> Descargar
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-gray-100 min-h-[450px] flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Loader2 size={32} className="animate-spin text-red-500" />
              <p className="text-sm">Cargando PDF…</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 text-red-600 p-8 text-center">
              <AlertCircle size={32} />
              <p className="text-sm font-medium">No se pudo cargar el PDF</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full min-h-[450px]"
              title={filename}
            />
          )}
        </div>
      </div>
    </div>
  );
}
