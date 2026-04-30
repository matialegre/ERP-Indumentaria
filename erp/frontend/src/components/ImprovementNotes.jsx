import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  X, Send, Trash2, CheckCircle2, Lightbulb,
  Loader2, Bot, PlusCircle,
  Image as ImageIcon, Check, Pencil as Edit2, MessageSquare, Copy
} from "lucide-react";
import { api } from "../lib/api";

const ROUTE_LABELS = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/pedidos-compras": "Notas de Pedido",
  "/facturas-proveedor": "Facturas / Remitos",
  "/facturas": "Facturas Proveedor",
  "/recepcion": "Recepción",
  "/gestion-pagos": "Gestión de Pagos",
  "/completados": "Completados",
  "/proveedores": "Proveedores",
  "/productos": "Productos",
  "/stock": "Stock",
  "/locales": "Locales",
  "/usuarios": "Usuarios",
  "/consultas": "Consultas ERP",
  "/reportes": "Reportes / Estadísticas",
  "/resumen": "Resumen",
  "/monitoreo": "Monitoreo",
  "/config": "Configuración",
  "/kanban": "TrellOutdoor (Kanban)",
  "/comparador": "Comparador Precios",
  "/transporte": "Transporte",
  "/ingreso": "Ingreso Mercadería",
  "/facturacion": "Facturación",
  "/deposito": "Depósito",
  "/importacion": "Importación",
  "/supertrend": "SuperTrend",
  "/mercadolibre": "MercadoLibre — Depósito",
  "/mejoras": "Mejoras del ERP",
  "/informes": "Informes",
  "/mensajes": "Mensajes",
  "/puntuacion-empleados": "Puntuación Empleados",
  "/socios-montagne": "Socios Montagne",
  "/sync-status": "Estado Sync",
  "/rrhh": "Gestión de Horarios",
  "/comisiones": "Comisiones",
  "/taller": "Taller — Dashboard",
  "/taller/ot": "Órdenes de Trabajo",
  "/taller/clientes": "Clientes Taller",
  "/taller/stock": "Repuestos",
  "/crm": "CRM Dashboard",
  "/rfid": "RFID Dashboard",
  "/rfid/etiquetas": "RFID — Etiquetas",
  "/rfid/lectores": "RFID — Lectores",
  "/rfid/alertas": "RFID — Alertas",
  "/rfid/inventario": "RFID — Inventario",
  "/rfid/propuesta": "RFID — Propuesta ROI",
  "/crm/clientes": "Clientes 360°",
  "/crm/mensajes": "Inbox CRM",
  "/crm/club": "Mundo Club",
  "/crm/campanas": "Campañas",
  "/crm/publicidad": "Publicidad",
  "/crm/contenido": "Contenido",
  "/crm/analytics": "Analytics CRM",
  "/crm/integraciones": "Integraciones CRM",
  "/crm/ai": "Asistente IA",
};

const PRIORITY_CONFIG = {
  LOW:     { label: "Baja",    color: "bg-green-100 text-green-700",   dot: "bg-green-500"  },
  NORMAL:  { label: "Normal",  color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
  HIGH:    { label: "Alta",    color: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  CRITICA: { label: "Crítica", color: "bg-red-100 text-red-700",       dot: "bg-red-500"    },
};

// SSE usa misma origin (pasa por el proxy de Vite en dev, o por nginx en prod)
const SSE_BASE = typeof window !== "undefined" ? window.location.origin : "http://localhost:8001";

// Resolver URL de imagen: si es path relativo (/mejoras-img/...) usar el backend
const resolveImageUrl = (img) => {
  if (img.startsWith("data:")) return img; // base64 legacy
  if (img.startsWith("/")) return `${SSE_BASE}${img}`;
  return img;
};

export default function ImprovementNotes() {
  const location = useLocation();
  const page = location.pathname;
  const pageLabel = ROUTE_LABELS[page] || page.replace("/", "");

  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("improvementNotesHidden") === "1");
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [images, setImages] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [includeDone, setIncludeDone] = useState(false);
  // waitingReplyNoteId: nota que espera que el backend genere la respuesta IA
  const [waitingReplyNoteId, setWaitingReplyNoteId] = useState(null);
  const pollRef = useRef(null);
  const bottomRef = useRef(null);

  const qc = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["improvement-notes", page, includeDone],
    queryFn: () => api.get(`/improvement-notes/?page=${encodeURIComponent(page)}&include_done=${includeDone}`),
    enabled: open,
    staleTime: 30_000,
  });

  // Scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes, open]);

  // Polling: espera hasta que la nota tenga ai_reply (el backend la genera en background)
  const startWaitingForReply = (noteId) => {
    setWaitingReplyNoteId(noteId);
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 × 3s = 60s máximo
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const updated = await api.get(`/improvement-notes/${noteId}/reply`);
        if (updated?.ai_reply) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setWaitingReplyNoteId(null);
          qc.invalidateQueries({ queryKey: ["improvement-notes"] });
          return;
        }
      } catch (_) {}
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setWaitingReplyNoteId(null);
        qc.invalidateQueries({ queryKey: ["improvement-notes"] });
      }
    }, 3000);
  };

  // Limpiar polling al desmontar
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/improvement-notes/", data),
    onSuccess: (newNote) => {
      qc.invalidateQueries({ queryKey: ["improvement-notes"] });
      setText(""); setImages([]); setPriority("NORMAL"); setShowForm(false);
      if (newNote?.id) startWaitingForReply(newNote.id);
    },
    onError: (err) => {
      console.error("[mejoras] Error creando nota:", err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/improvement-notes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["improvement-notes"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/improvement-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes"] }),
  });

  const markDoneMutation = useMutation({
    mutationFn: (id) => api.put(`/improvement-notes/${id}`, { is_done: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes"] }),
  });

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) { alert("Imagen muy grande (máx 2MB)"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setImages(prev => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
  };

  // Ctrl+V pega imágenes del portapapeles directamente en el chat
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        if (file.size > 2 * 1024 * 1024) { alert("Imagen muy grande (máx 2MB)"); continue; }
        const reader = new FileReader();
        reader.onload = (ev) => setImages(prev => [...prev, ev.target.result]);
        reader.readAsDataURL(file);
        hasImage = true;
      }
    }
    if (hasImage) {
      e.preventDefault();
      // Abrir el formulario si no está abierto
      if (!showForm) setShowForm(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    createMutation.mutate({ page, page_label: pageLabel, text: text.trim(), priority, images });
  };

  const pendingCount = Array.isArray(notes) ? notes.filter(n => !n.is_done).length : 0;

  if (hidden) {
    return (
      <button
        onClick={() => { setHidden(false); sessionStorage.removeItem("improvementNotesHidden"); }}
        className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40 w-6 h-6 bg-amber-500/60 hover:bg-amber-500 text-white rounded-full text-xs flex items-center justify-center shadow"
        title="Mostrar Notas para mejorar"
      >
        💡
      </button>
    );
  }

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        {pendingCount > 0 && !open && (
          <div className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center absolute -top-1 -left-1 shadow">
            {pendingCount}
          </div>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg font-semibold text-sm transition-all ${
            open ? "bg-gray-800 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"
          }`}
          title="Notas para mejorar esta sección"
        >
          <Lightbulb size={16} />
          {pendingCount > 0 ? `Mejoras (${pendingCount})` : "Notas para mejorar"}
          <span
            onClick={(e) => { e.stopPropagation(); setHidden(true); setOpen(false); sessionStorage.setItem("improvementNotesHidden", "1"); }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-[10px] flex items-center justify-center shadow"
            title="Ocultar (volverá al recargar)"
          >
            ✕
          </span>
        </button>
      </div>

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-96 max-h-[72vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden" onPaste={handlePaste}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-600" />
              <span className="font-bold text-gray-800 text-sm">Mejoras — {pageLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIncludeDone(v => !v)}
                className={`text-xs px-2 py-1 rounded-lg transition ${includeDone ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:text-gray-600"}`}
              >
                {includeDone ? "Ocultar resueltas" : "Ver resueltas"}
              </button>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista de notas como chat */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-amber-500" /></div>
            ) : notes.length === 0 && !waitingReplyNoteId ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Lightbulb size={32} className="mx-auto mb-2 opacity-30" />
                <p>No hay notas para esta sección.</p>
                <p className="text-xs mt-1">¡Sé el primero en sugerir una mejora!</p>
              </div>
            ) : (
              <>
                {notes.map(note => (
                  <NotePair
                    key={note.id}
                    note={note}
                    editingId={editingId}
                    editText={editText}
                    setEditText={setEditText}
                    onEdit={(n) => { setEditingId(n.id); setEditText(n.text); }}
                    onSaveEdit={(id) => updateMutation.mutate({ id, text: editText })}
                    onCancelEdit={() => setEditingId(null)}
                    onDelete={(id) => { if (window.confirm("¿Eliminar nota?")) deleteMutation.mutate(id); }}
                    onMarkDone={(id) => markDoneMutation.mutate(id)}
                    saving={updateMutation.isPending}
                    isWaiting={waitingReplyNoteId === note.id}
                  />
                ))}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Formulario de nueva nota */}
          <div className="border-t border-gray-100 p-3 shrink-0">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition font-medium"
              >
                <PlusCircle size={15} /> Agregar nota de mejora
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Describí qué mejorarías... (Ctrl+V para pegar imagen)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-amber-400"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5">
                    <ImageIcon size={13} />
                    {images.length > 0 ? `${images.length} img` : "Imagen"}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setText(""); setImages([]); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!text.trim() || createMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50 font-semibold"
                  >
                    {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Guardar
                  </button>
                </div>
                {images.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Componente: par de mensajes (usuario + IA) ─────────────────────────────

function NotePair({ note, editingId, editText, setEditText, onEdit, onSaveEdit, onCancelEdit, onDelete, onMarkDone, saving, isWaiting }) {
  const [showImages, setShowImages] = useState(false);
  const [copied, setCopied] = useState(false);
  const pConfig = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.NORMAL;
  const isEditing = editingId === note.id;

  const handleCopy = () => {
    navigator.clipboard.writeText(note.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="space-y-2">
      {/* Burbuja del usuario (derecha, ámbar) */}
      <div className="flex justify-end">
        <div className={`max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm ${note.is_done ? "bg-amber-100 opacity-60" : "bg-amber-500"}`}>
          {/* Módulo y autor */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {note.page_label && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${note.is_done ? "bg-amber-200 text-amber-800" : "bg-amber-400/60 text-white"}`}>
                📍 {note.page_label}
              </span>
            )}
            <span className={`text-[10px] font-semibold ${note.is_done ? "text-amber-700" : "text-amber-100"}`}>
              👤 {note.author_name || "Anónimo"}
            </span>
            <span className={`text-[9px] ${note.is_done ? "text-amber-500" : "text-amber-200"}`}>
              {note.created_at ? new Date(note.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${note.is_done ? "bg-amber-200 text-amber-700" : "bg-amber-400 text-white"}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} />
              {pConfig.label}
            </div>
            {note.is_done && <span className="ml-auto flex items-center gap-1 text-green-700 text-[9px] font-bold"><CheckCircle2 size={10} /> Resuelta</span>}
          </div>

          {isEditing ? (
            <div className="space-y-1.5">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs resize-none focus:outline-none bg-white text-gray-800"
                rows={3}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => onSaveEdit(note.id)}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg text-[10px] font-semibold hover:bg-green-700"
                >
                  <Check size={10} /> Guardar
                </button>
                <button onClick={onCancelEdit} className="px-2 py-1 text-[10px] text-amber-200 hover:text-white">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className={`text-xs leading-relaxed whitespace-pre-wrap ${note.is_done ? "text-amber-800" : "text-white"}`}>{note.text}</p>
          )}

          {(note.images || []).length > 0 && (
            <div className="mt-1">
              <button onClick={() => setShowImages(v => !v)} className="flex items-center gap-1 text-[9px] text-amber-100 hover:underline">
                <ImageIcon size={10} /> {note.images.length} imagen(es) {showImages ? "▲" : "▼"}
              </button>
              {showImages && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {note.images.map((img, i) => (
                    <a key={i} href={resolveImageUrl(img)} target="_blank" rel="noopener noreferrer">
                      <img src={resolveImageUrl(img)} alt="" className="w-16 h-16 object-cover rounded-lg border border-amber-300 hover:opacity-80 transition" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {!note.is_done && !isEditing && (
            <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-amber-400">
              <button onClick={() => onEdit(note)} className="flex items-center gap-1 text-[9px] text-amber-200 hover:text-white transition">
                <Edit2 size={9} /> Editar
              </button>
              <button onClick={() => onMarkDone(note.id)} className="flex items-center gap-1 text-[9px] text-amber-200 hover:text-white transition">
                <CheckCircle2 size={9} /> Resolver
              </button>
              <button onClick={handleCopy} title="Copiar texto" className="flex items-center gap-1 text-[9px] text-amber-200 hover:text-white transition">
                {copied ? <Check size={9} /> : <Copy size={9} />}
              </button>
              <div className="flex-1" />
              <button onClick={() => onDelete(note.id)} className="flex items-center gap-1 text-[9px] text-red-200 hover:text-white transition">
                <Trash2 size={9} /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Burbuja de la IA (izquierda, gris/blanca) */}
      {(note.ai_reply || isWaiting) && (
        <div className="flex justify-start">
          <div className="flex gap-2 max-w-[85%]">
            <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-1">
              <Bot size={13} className="text-gray-500" />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
              {isWaiting ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 size={11} className="animate-spin" />
                  La IA está analizando tu sugerencia...
                </div>
              ) : (
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{note.ai_reply}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin feedback — visible to the employee */}
      {note.admin_note && (
        <div className="flex justify-start">
          <div className="flex gap-2 max-w-[90%]">
            <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 mt-1">
              <MessageSquare size={12} className="text-blue-600" />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-blue-600">Feedback del Admin</span>
                {note.admin_note_by && (
                  <span className="text-[10px] text-blue-400">— {note.admin_note_by}</span>
                )}
                {note.admin_note_at && (
                  <span className="text-[10px] text-blue-300">
                    {new Date(note.admin_note_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">{note.admin_note}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
