import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen, Upload, Trash2, Download, Search, X, Image, Film,
  FileText, File, Eye, ChevronLeft, ChevronRight, Loader2, Edit3, Check,
} from "lucide-react";
import { api, SERVER_BASE } from "../lib/api";
import { useToast } from "../components/ToastProvider";

const TABS = [
  { key: "all",   label: "Todos",    icon: FolderOpen },
  { key: "image", label: "Imágenes", icon: Image },
  { key: "video", label: "Videos",   icon: Film },
  { key: "pdf",   label: "PDFs",     icon: FileText },
  { key: "other", label: "Otros",    icon: File },
];

function fileUrl(path_archivo) {
  const normalizedPath = String(path_archivo || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${SERVER_BASE}/rfid-contenido-files/${normalizedPath}`;
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TipoIcon({ tipo, className = "w-5 h-5" }) {
  const icons = { image: Image, video: Film, pdf: FileText, other: File };
  const Icon = icons[tipo] || File;
  const colors = { image: "text-sky-400", video: "text-purple-400", pdf: "text-red-400", other: "text-slate-400" };
  return <Icon className={`${className} ${colors[tipo] || "text-slate-400"}`} />;
}

function ImagenArchivo({ src, alt, className, fallbackClassName = "" }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center gap-2 text-center px-3 ${fallbackClassName}`}>
        <Image className="w-10 h-10 text-slate-500" />
        <span className="text-[11px] text-slate-400 leading-tight">Imagen danada o incompatible</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}

// ── Visor de archivos ────────────────────────────────────────────────────────
function Visor({ item, onClose, items, currentIndex, onNavigate }) {
  const url = fileUrl(item.path_archivo);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={onClose}>
        <X className="w-8 h-8" />
      </button>
      {currentIndex > 0 && (
        <button
          className="absolute left-4 text-white/70 hover:text-white p-2"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {currentIndex < items.length - 1 && (
        <button
          className="absolute right-14 text-white/70 hover:text-white p-2"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      <div className="max-w-5xl max-h-[90vh] w-full flex flex-col items-center px-4" onClick={(e) => e.stopPropagation()}>
        {item.tipo === "image" && (
          <ImagenArchivo
            src={url}
            alt={item.nombre}
            className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
            fallbackClassName="min-h-[40vh] text-white"
          />
        )}
        {item.tipo === "video" && (
          <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded-lg shadow-2xl" />
        )}
        {item.tipo === "pdf" && (
          <iframe src={url} className="w-full h-[80vh] rounded-lg shadow-2xl bg-white" title={item.nombre} />
        )}
        {item.tipo === "other" && (
          <div className="text-white text-center space-y-4">
            <File className="w-20 h-20 mx-auto text-slate-400" />
            <p className="text-lg font-medium">{item.nombre_original}</p>
            <a href={url} download={item.nombre_original} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-lg">
              <Download className="w-4 h-4" /> Descargar
            </a>
          </div>
        )}
        <div className="mt-3 text-center">
          <p className="text-white font-medium">{item.nombre}</p>
          {item.descripcion && <p className="text-white/60 text-sm">{item.descripcion}</p>}
          <p className="text-white/40 text-xs">{formatBytes(item.size_bytes)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de archivo ────────────────────────────────────────────────────────
function TarjetaArchivo({ item, onClick, onDelete, onRename }) {
  const [editando, setEditando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(item.nombre);
  const url = fileUrl(item.path_archivo);

  const guardarNombre = () => {
    if (nuevoNombre.trim() && nuevoNombre !== item.nombre) {
      onRename(item.id, nuevoNombre.trim());
    }
    setEditando(false);
  };

  return (
    <div className="group bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden hover:border-teal-500/50 transition-all">
      {/* Preview */}
      <div
        className="relative aspect-video bg-slate-900 flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={onClick}
      >
        {item.tipo === "image" ? (
          <ImagenArchivo
            src={url}
            alt={item.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            fallbackClassName="bg-slate-900"
          />
        ) : item.tipo === "video" ? (
          <div className="relative w-full h-full">
            <video src={url} className="w-full h-full object-cover" muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Film className="w-10 h-10 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <TipoIcon tipo={item.tipo} className="w-12 h-12" />
            <span className="text-xs text-slate-400 uppercase font-mono">
              {item.nombre_original.split(".").pop()}
            </span>
          </div>
        )}
        {/* overlay hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Eye className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        {editando ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setEditando(false); }}
              className="flex-1 bg-slate-700 border border-teal-500 rounded px-2 py-1 text-sm text-white"
            />
            <button onClick={guardarNombre} className="text-teal-400 hover:text-teal-300">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium text-white leading-tight truncate flex-1" title={item.nombre}>
              {item.nombre}
            </p>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100">
              <button onClick={() => setEditando(true)} className="text-slate-400 hover:text-white p-0.5">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <a href={url} download={item.nombre_original} className="text-slate-400 hover:text-white p-0.5" onClick={(e) => e.stopPropagation()}>
                <Download className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => onDelete(item.id)} className="text-slate-400 hover:text-red-400 p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <TipoIcon tipo={item.tipo} className="w-3.5 h-3.5" />
          <span className="text-xs text-slate-500">{formatBytes(item.size_bytes)}</span>
          {item.uploaded_by && <span className="text-xs text-slate-500 ml-auto truncate">{item.uploaded_by}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Zona de upload ────────────────────────────────────────────────────────────
function UploadZona({ onUpload, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach(file => onUpload(file));
  }, [onUpload]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        dragging ? "border-teal-400 bg-teal-500/10" : "border-slate-600 hover:border-teal-500/50 hover:bg-slate-800/40"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/*,.pdf,.pptx,.ppt,.key,.odp,.xlsx,.xls,.docx,.doc,.zip"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          <p className="text-slate-300 text-sm">Subiendo...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-teal-400" />
          <p className="text-slate-300 font-medium">Arrastrá archivos acá o hacé clic para subir</p>
          <p className="text-slate-500 text-xs">Imágenes, videos, PDFs, presentaciones (hasta 500 MB c/u)</p>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RFIDContenido() {
  const [tab, setTab] = useState("all");
  const [busqueda, setBusqueda] = useState("");
  const [visorItem, setVisorItem] = useState(null);
  const [visorIndex, setVisorIndex] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["rfid-contenido", tab],
    queryFn: () => api.get(`/rfid/contenido${tab !== "all" ? `?tipo=${tab}` : ""}`),
  });

  const filtered = busqueda
    ? items.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                        i.nombre_original.toLowerCase().includes(busqueda.toLowerCase()))
    : items;

  // Upload
  const [uploading, setUploading] = useState(false);
  const handleUpload = useCallback(async (file) => {
    setUploading(true);
    try {
      // La validación del tipo de archivo se delega al backend (extensiones permitidas).
      // No hacemos pre-validación con Image() porque falla en formatos válidos como BMP,
      // WebP en algunos navegadores, o archivos HEIC de dispositivos móviles.
      const fd = new FormData();
      fd.append("file", file);
      fd.append("nombre", file.name.replace(/\.[^/.]+$/, ""));
      fd.append("descripcion", "");
      await api.uploadFile("/rfid/contenido/upload", fd);
      queryClient.invalidateQueries({ queryKey: ["rfid-contenido"] });
      toast("Archivo subido", "success");
    } catch (e) {
      toast(e.message || "Error al subir", "error");
    } finally {
      setUploading(false);
    }
  }, [queryClient, toast]);

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/rfid/contenido/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfid-contenido"] });
      toast("Archivo eliminado", "success");
    },
    onError: (e) => toast(e.message || "Error al eliminar", "error"),
  });

  const confirmDelete = (id) => {
    if (confirm("¿Eliminar este archivo?")) deleteMutation.mutate(id);
  };

  // Rename
  const renameMutation = useMutation({
    mutationFn: ({ id, nombre }) => api.patch(`/rfid/contenido/${id}`, { nombre }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rfid-contenido"] }),
    onError: (e) => toast(e.message || "Error al renombrar", "error"),
  });

  const openVisor = (item) => {
    const idx = filtered.findIndex(i => i.id === item.id);
    setVisorIndex(idx);
    setVisorItem(item);
  };

  const navigateVisor = (idx) => {
    setVisorIndex(idx);
    setVisorItem(filtered[idx]);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-7 h-7 text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Contenido RFID</h1>
            <p className="text-slate-400 text-sm">Imágenes, videos, PDFs y presentaciones del sistema RFID</p>
          </div>
        </div>
        <div className="text-sm text-slate-500">{filtered.length} archivo{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Upload */}
      <UploadZona onUpload={handleUpload} uploading={uploading} />

      {/* Buscador + Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
          {TABS.map(t => {
            const Icon = t.icon;
            const count = t.key === "all" ? items.length : items.filter(i => i.tipo === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key ? "bg-teal-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {count > 0 && <span className="opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <FolderOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400">
            {busqueda ? "Sin resultados para esa búsqueda" : "Todavía no hay archivos — subí el primero 👆"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(item => (
            <TarjetaArchivo
              key={item.id}
              item={item}
              onClick={() => openVisor(item)}
              onDelete={confirmDelete}
              onRename={(id, nombre) => renameMutation.mutate({ id, nombre })}
            />
          ))}
        </div>
      )}

      {/* Visor */}
      {visorItem && (
        <Visor
          item={visorItem}
          items={filtered}
          currentIndex={visorIndex}
          onClose={() => setVisorItem(null)}
          onNavigate={navigateVisor}
        />
      )}
    </div>
  );
}
