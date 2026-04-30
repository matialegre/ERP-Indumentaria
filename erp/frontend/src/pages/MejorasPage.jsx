import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Lightbulb, CheckCircle2, Circle, Bot, Loader2,
  ChevronDown, ChevronUp, RefreshCw, Trash2, X,
  MessageSquare, Send, Edit3, History, Clock, User,
  Image as ImageIcon, Trophy, Medal, Star, Ban, Pencil, Save,
  AlertTriangle, Copy, Check,
} from "lucide-react";

const PRIORITY_CONFIG = {
  LOW:     { label: "Baja",    bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-400"  },
  NORMAL:  { label: "Normal",  bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  HIGH:    { label: "Alta",    bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400" },
  CRITICA: { label: "Crítica", bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400"    },
};

// Backend base URL for images
const _port = typeof window !== "undefined" ? window.location.port : "5174";
const _apiPort = (_port === "5174" || _port === "5173") ? "8001" : _port || "8001";
const BACKEND_BASE = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:${_apiPort}`
  : "http://localhost:8001";
const resolveImageUrl = (img) => {
  if (img.startsWith("data:")) return img;
  if (img.startsWith("/")) return `${BACKEND_BASE}${img}`;
  return img;
};

const LABEL_SORT = { CRITICA: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " " + new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function AdminNoteEditor({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.admin_note || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(note.id, text);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("¿Borrar el feedback de esta nota?")) return;
    setSaving(true);
    await onSave(note.id, "");
    setSaving(false);
  };

  if (!editing) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200">
        {note.admin_note ? (
          <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={11} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700">Tu feedback</span>
                <span className="text-[10px] text-blue-400">({note.admin_note_by})</span>
              </div>
              <button onClick={() => { setEditing(true); setText(note.admin_note); }} className="p-0.5 text-blue-400 hover:text-blue-600">
                <Edit3 size={11} />
              </button>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">{note.admin_note}</p>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200 hover:border-blue-200 transition"
          >
            <MessageSquare size={12} /> Agregar feedback / crítica
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-blue-200">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MessageSquare size={11} className="text-blue-500" />
        <span className="text-xs font-semibold text-blue-700">Tu feedback al empleado</span>
      </div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Ej: Buena idea pero falta especificar el impacto en stock. Revisarlo con Deposito."
        className="w-full border border-blue-200 rounded-lg px-2.5 py-2 text-xs resize-none focus:outline-none focus:border-blue-400 bg-blue-50"
        rows={3}
      />
      <div className="flex items-center gap-1.5 mt-1.5">
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          Guardar
        </button>
        {note.admin_note && (
          <button onClick={handleDelete} disabled={saving} className="px-2.5 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            Borrar
          </button>
        )}
        <button onClick={() => { setEditing(false); setText(note.admin_note || ""); }} className="ml-auto px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })}
      className={`ml-auto p-1 rounded transition ${copied ? "text-emerald-500" : "text-gray-300 hover:text-blue-500"}`}
      title="Copiar texto para prompt"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function NoteCard({ note, canAdmin, onApprove, onApproveManual, onUnapprove, onCancel, onUpdateText, onAdminNote }) {
  const [expanded, setExpanded] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editText, setEditText] = useState(note.text);
  const [savingText, setSavingText] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const pc = PRIORITY_CONFIG[note.priority] ?? PRIORITY_CONFIG.NORMAL;

  const handleCopy = () => {
    navigator.clipboard.writeText(note.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleSaveText = async () => {
    if (!editText.trim() || editText === note.text) { setEditingText(false); return; }
    setSavingText(true);
    await onUpdateText(note.id, editText.trim());
    setSavingText(false);
    setEditingText(false);
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      await onCancel(note.id, cancelReason.trim());
      setShowCancelModal(false);
      setCancelReason("");
    } catch (err) {
      alert(`No se pudo cancelar la mejora:\n${err?.message || err || 'error desconocido'}`);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-all h-full flex flex-col ${
        note.is_done
          ? "border-emerald-200 opacity-80"
          : "border-gray-200 hover:border-purple-200 hover:shadow-sm"
      }`}
    >
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
              {pc.label}
            </span>
            {note.page_label && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                📍 {note.page_label}
              </span>
            )}
            {note.admin_note && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <MessageSquare size={10} /> Feedback
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {fmtDate(note.created_at)}
          </span>
        </div>

        {editingText ? (
          <div className="mb-2">
            <textarea
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className="w-full border border-purple-300 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:border-purple-500 bg-purple-50"
              rows={4}
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              <button
                onClick={handleSaveText}
                disabled={savingText || !editText.trim()}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {savingText ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Guardar
              </button>
              <button onClick={() => { setEditingText(false); setEditText(note.text); }} className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-1">
              <p
                className={`text-sm text-gray-800 leading-relaxed flex-1 whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-3"}`}
                style={expanded ? undefined : { minHeight: "4.2em" }}
              >
                {note.text}
              </p>
              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                <button
                  onClick={handleCopy}
                  className={`p-1 rounded transition ${copied ? "text-emerald-500" : "text-gray-300 hover:text-blue-500"}`}
                  title="Copiar texto para prompt"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                {canAdmin && (
                  <button
                    onClick={() => { setEditingText(true); setEditText(note.text); }}
                    className="p-1 text-gray-300 hover:text-purple-500 rounded transition"
                    title="Editar texto antes de enviar a IA"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-500 mt-1 flex items-center gap-0.5 hover:underline self-start"
            >
              {expanded ? <><ChevronUp size={12} /> Ver menos</> : <><ChevronDown size={12} /> Ver más</>}
            </button>
          </>
        )}

        {(note.images || []).length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {note.images.map((img, i) => (
              <a key={i} href={resolveImageUrl(img)} target="_blank" rel="noopener noreferrer">
                <img src={resolveImageUrl(img)} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2.5">
          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
            {(note.author_name || "?").charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-gray-700">{note.author_name || "Anónimo"}</span>
        </div>

        {note.ai_reply && (
          <div className="mt-2.5 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot size={12} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-600">Respuesta IA</span>
            </div>
            <p
              className={`text-xs text-purple-700 leading-relaxed whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-3"}`}
              style={expanded ? undefined : { minHeight: "3.6em" }}
            >{note.ai_reply}</p>
          </div>
        )}

        {canAdmin && (
          <AdminNoteEditor note={note} onSave={onAdminNote} />
        )}

        {canAdmin && (
          <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-gray-100">
            <button
              onClick={() => onApprove(note.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition"
              title="Aprobar y enviar a Copilot para implementar"
            >
              <CheckCircle2 size={13} /> OK — Copilot
            </button>
            <button
              onClick={() => onApproveManual(note.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition"
              title="Marcar como implementada sin enviar a Copilot"
            >
              <CheckCircle2 size={13} /> OK — Manual
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
              title="Cancelar mejora"
            >
              <Ban size={13} />
            </button>
          </div>
        )}

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCancelModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-red-50 px-5 py-4 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <Ban size={18} className="text-red-500" />
                  <h3 className="text-base font-bold text-red-700">Cancelar mejora</h3>
                </div>
                <p className="text-xs text-red-500 mt-1">Se enviará un mensaje al autor explicando la cancelación</p>
              </div>
              <div className="p-5">
                <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Nota de <span className="font-semibold">{note.author_name}</span>:</p>
                  <p className="text-sm text-gray-700 line-clamp-3">{note.text}</p>
                </div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">¿Por qué se cancela?</label>
                <textarea
                  autoFocus
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ej: Ya existe esta funcionalidad, no es viable técnicamente, se va a resolver de otra forma..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  rows={3}
                />
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleCancel}
                    disabled={cancelling || !cancelReason.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition"
                  >
                    {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                    Confirmar cancelación
                  </button>
                  <button
                    onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    Volver
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleAccordion({ page, pageLabel, notes, canAdmin, onApprove, onApproveManual, onCancel, onUpdateText, onAdminNote, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Lightbulb size={16} className="text-purple-500 shrink-0" />
          <span className="font-semibold text-gray-900 text-sm truncate text-left">{pageLabel || page}</span>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
            {notes.length} {notes.length === 1 ? "mejora" : "mejoras"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400 shrink-0">
          <span className="text-xs">{open ? "Ocultar" : "Ver"}</span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                canAdmin={canAdmin}
                onApprove={onApprove}
                onApproveManual={onApproveManual}
                onUnapprove={() => {}}
                onCancel={onCancel}
                onUpdateText={onUpdateText}
                onAdminNote={onAdminNote}
              />
            ))}
          </div>
          {notes.length === 0 && (
            <div className="text-center py-6 text-gray-300 text-sm">Sin notas</div>
          )}
        </div>
      )}
    </div>
  );
}

function HistorialView({ notes, canAdmin, onUnapprove, onDelete, search }) {
  const filtered = search.trim()
    ? notes.filter(n =>
        n.text.toLowerCase().includes(search.toLowerCase()) ||
        (n.author_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.approved_by || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.page_label || n.page || "").toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.approved_at || b.updated_at || b.created_at) - new Date(a.approved_at || a.updated_at || a.created_at)
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-300">
        <History size={48} className="mb-3 text-gray-200" />
        <p className="text-gray-400 font-medium">Sin historial de mejoras aplicadas</p>
        <p className="text-sm text-gray-300 mt-1">Acá aparecen las mejoras que fueron aprobadas</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3 pb-8">
      {sorted.map(note => {
        const pc = PRIORITY_CONFIG[note.priority] ?? PRIORITY_CONFIG.NORMAL;
        return (
          <div key={note.id} className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
            {/* Green top bar */}
            <div className="bg-emerald-500 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-white" />
                <span className="text-white text-xs font-semibold">Aplicada</span>
                <span className="text-emerald-100 text-xs">·</span>
                <span className="text-emerald-100 text-xs font-medium">{note.page_label || note.page}</span>
              </div>
              <div className="flex items-center gap-3">
                {note.approved_at && (
                  <div className="flex items-center gap-1 text-emerald-100 text-xs">
                    <Clock size={10} />
                    {fmtDate(note.approved_at)}
                  </div>
                )}
                {note.approved_by && (
                  <div className="flex items-center gap-1 text-emerald-100 text-xs">
                    <User size={10} />
                    {note.approved_by}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                  {pc.label}
                </span>
                <span className="text-xs text-gray-400">{fmtDate(note.created_at)}</span>
              </div>

              <p className="text-sm text-gray-800 leading-relaxed mb-3">{note.text}</p>

              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
                  {(note.author_name || "?").charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-500">{note.author_name || "Anónimo"}</span>
                <CopyButton text={note.text} />
              </div>

              {note.admin_note && (
                <div className="mt-3 bg-blue-50 rounded-lg p-2.5 border border-blue-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare size={11} className="text-blue-500" />
                    <span className="text-xs font-semibold text-blue-700">Feedback de {note.admin_note_by}</span>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">{note.admin_note}</p>
                </div>
              )}

              {canAdmin && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onUnapprove(note.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                  >
                    <Circle size={12} /> Revertir a pendiente
                  </button>
                  <button
                    onClick={() => { if (confirm("¿Eliminar del historial?")) onDelete(note.id); }}
                    className="ml-auto p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                    title="Eliminar del historial"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankingView({ data, isLoading }) {
  const MEDAL_COLORS = ["text-yellow-400", "text-gray-400", "text-amber-600"];
  const MEDAL_BG = ["bg-yellow-50 border-yellow-200", "bg-gray-50 border-gray-200", "bg-amber-50 border-amber-200"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-300">
        <Trophy size={48} className="mb-3 text-gray-200" />
        <p className="text-gray-400 font-medium">Sin datos todavía</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.map(r => r.total), 1);
  const maxAccepted = Math.max(...data.map(r => r.accepted), 1);

  return (
    <div className="max-w-3xl mx-auto pb-8 space-y-8">
      {/* Podio top 3 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy size={18} className="text-yellow-500" />
          <h2 className="text-base font-bold text-gray-900">Podio — Más mejoras aceptadas</h2>
        </div>
        <div className="flex items-end justify-center gap-4">
          {[1, 0, 2].map((pos) => {
            const person = data[pos];
            if (!person) return <div key={pos} className="w-28" />;
            const heights = ["h-36", "h-28", "h-20"];
            const medalIcons = [<Medal size={20} />, <Trophy size={22} />, <Medal size={18} />];
            return (
              <div key={pos} className="flex flex-col items-center gap-2 w-28">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                  pos === 0 ? "bg-yellow-100 text-yellow-700" :
                  pos === 1 ? "bg-gray-100 text-gray-600" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {person.author.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs font-semibold text-gray-700 text-center leading-tight">{person.author}</p>
                <p className="text-xs text-emerald-600 font-bold">{person.accepted} aceptadas</p>
                <div className={`w-full rounded-t-xl flex flex-col items-center justify-end pb-3 ${heights[pos]} ${
                  pos === 0 ? "bg-yellow-400" :
                  pos === 1 ? "bg-gray-300" :
                  "bg-amber-400"
                }`}>
                  <span className={`${pos === 0 ? "text-yellow-800" : pos === 1 ? "text-gray-600" : "text-amber-800"}`}>
                    {medalIcons[pos]}
                  </span>
                  <span className={`text-lg font-black ${pos === 0 ? "text-yellow-800" : pos === 1 ? "text-gray-700" : "text-amber-800"}`}>
                    #{pos + 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla ranking completa */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Star size={16} className="text-purple-500" />
          <h2 className="text-sm font-bold text-gray-900">Ranking completo</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {data.map((person, idx) => (
            <div key={person.author} className={`px-5 py-4 flex items-center gap-4 ${idx < 3 ? MEDAL_BG[idx] + " border-l-4" : ""}`}>
              <div className="w-8 text-center">
                {idx < 3
                  ? <Medal size={18} className={MEDAL_COLORS[idx]} />
                  : <span className="text-sm font-bold text-gray-400">#{person.rank}</span>
                }
              </div>
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600 shrink-0">
                {person.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{person.author}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-400">Planteadas</span>
                      <span className="text-[10px] font-semibold text-gray-600">{person.total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-400 rounded-full transition-all"
                        style={{ width: `${(person.total / maxTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-gray-400">Aceptadas</span>
                      <span className="text-[10px] font-semibold text-emerald-600">{person.accepted}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${(person.accepted / maxAccepted) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-emerald-600">{person.acceptance_rate}%</div>
                <div className="text-[10px] text-gray-400">aceptación</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MejorasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canAdmin = ["SUPERADMIN", "ADMIN"].includes(user?.role);

  const [tab, setTab] = useState("pending"); // "pending" | "historial" | "ranking"
  const [search, setSearch] = useState("");

  const { data: pendingNotes = [], isLoading: loadingPending, refetch: refetchPending } = useQuery({
    queryKey: ["improvement-notes-pending"],
    queryFn: () => api.get(`/improvement-notes/?include_done=false&limit=500`),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: historialNotes = [], isLoading: loadingHistorial, refetch: refetchHistorial } = useQuery({
    queryKey: ["improvement-notes-historial"],
    queryFn: () => api.get(`/improvement-notes/?include_done=true&limit=500`),
    staleTime: 10_000,
    enabled: tab === "historial",
  });

  const { data: rankingData = [], isLoading: loadingRanking } = useQuery({
    queryKey: ["improvement-notes-ranking"],
    queryFn: () => api.get(`/improvement-notes/stats/ranking`),
    staleTime: 30_000,
    enabled: tab === "ranking",
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["improvement-notes-pending"] });
    qc.invalidateQueries({ queryKey: ["improvement-notes-historial"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/improvement-notes/${id}/approve`),
    onSuccess: invalidateAll,
  });

  const approveManualMutation = useMutation({
    mutationFn: (id) => api.post(`/improvement-notes/${id}/approve-manual`),
    onSuccess: invalidateAll,
  });

  const unapproveMutation = useMutation({
    mutationFn: (id) => api.post(`/improvement-notes/${id}/unapprove`),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/improvement-notes/${id}`),
    onSuccess: invalidateAll,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => api.post(`/improvement-notes/${id}/cancel`, { reason }),
    onSuccess: invalidateAll,
  });

  const updateTextMutation = useMutation({
    mutationFn: ({ id, text }) => api.put(`/improvement-notes/${id}`, { text }),
    onSuccess: invalidateAll,
  });

  const adminNoteMutation = useMutation({
    mutationFn: ({ id, admin_note }) => api.patch(`/improvement-notes/${id}/admin-note`, { admin_note }),
    onSuccess: invalidateAll,
  });

  // Filter historial — exclude pending (include_done=true returns ALL notes)
  const historialOnly = useMemo(() => historialNotes.filter(n => n.is_done), [historialNotes]);

  const grouped = useMemo(() => {
    let filtered = pendingNotes;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        n => n.text.toLowerCase().includes(q) ||
             (n.author_name || "").toLowerCase().includes(q) ||
             (n.page_label || n.page || "").toLowerCase().includes(q)
      );
    }
    const map = {};
    for (const note of filtered) {
      const key = note.page || "general";
      if (!map[key]) map[key] = { page: key, pageLabel: note.page_label || key, notes: [] };
      map[key].notes.push(note);
    }
    for (const col of Object.values(map)) {
      col.notes.sort((a, b) => {
        const pA = LABEL_SORT[a.priority] ?? 2;
        const pB = LABEL_SORT[b.priority] ?? 2;
        if (pA !== pB) return pA - pB;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    return Object.values(map).sort((a, b) => b.notes.length - a.notes.length);
  }, [pendingNotes, search]);

  const isLoading = tab === "pending" ? loadingPending : tab === "historial" ? loadingHistorial : loadingRanking;
  const pendingMutation = approveMutation.isPending || approveManualMutation.isPending || unapproveMutation.isPending || deleteMutation.isPending || cancelMutation.isPending;

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
              <Lightbulb size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mejoras del ERP</h1>
              <p className="text-sm text-gray-500">Tablero de sugerencias organizado por módulo</p>
            </div>
          </div>
          <button
            onClick={() => { refetchPending(); refetchHistorial(); }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
              {pendingNotes.length} pendientes
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
              {historialOnly.length > 0 ? historialOnly.length : "—"} en historial
            </span>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setTab("pending")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition ${
                tab === "pending" ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Lightbulb size={12} /> Pendientes
              {pendingNotes.length > 0 && (
                <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingNotes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("historial")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition ${
                tab === "historial" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <History size={12} /> Historial
            </button>
            <button
              onClick={() => setTab("ranking")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition ${
                tab === "ranking" ? "bg-white text-yellow-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Trophy size={12} /> Ranking
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar nota o autor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-3 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-400 outline-none bg-white w-48"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {canAdmin && tab === "pending" && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <MessageSquare size={16} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Al aprobar una mejora se mueve al Historial.</span>{" "}
              Usá <span className="font-semibold">OK — Copilot</span> para que el agente la implemente automáticamente, o <span className="font-semibold">OK — Manual</span> para marcarla vos mismo sin enviarla al agente.
            </p>
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
        ) : tab === "pending" ? (
          grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300">
              <Lightbulb size={48} className="mb-3 text-gray-200" />
              <p className="text-gray-400 font-medium">No hay notas pendientes</p>
              <p className="text-sm text-gray-300 mt-1">Las sugerencias aparecen cuando los usuarios usan el botón 💡 en cada página</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-4 max-w-5xl mx-auto w-full">
              {grouped.map((col) => (
                <ModuleAccordion
                  key={col.page}
                  page={col.page}
                  pageLabel={col.pageLabel}
                  notes={col.notes}
                  canAdmin={canAdmin}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onApproveManual={(id) => approveManualMutation.mutate(id)}
                  onCancel={(id, reason) => cancelMutation.mutateAsync({ id, reason })}
                  onUpdateText={(id, text) => updateTextMutation.mutateAsync({ id, text })}
                  onAdminNote={(id, admin_note) => adminNoteMutation.mutateAsync({ id, admin_note })}
                />
              ))}
            </div>
          )
        ) : tab === "ranking" ? (
          <RankingView data={rankingData} isLoading={loadingRanking} />
        ) : (
          <HistorialView
            notes={historialOnly}
            canAdmin={canAdmin}
            onUnapprove={(id) => unapproveMutation.mutate(id)}
            onDelete={(id) => deleteMutation.mutate(id)}
            search={search}
          />
        )}
      </div>

      {pendingMutation && (
        <div className="fixed bottom-6 right-6 bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Loader2 size={15} className="animate-spin" />
          {approveMutation.isPending ? "Aprobando — moviendo al historial..." : cancelMutation.isPending ? "Cancelando mejora..." : "Guardando..."}
        </div>
      )}
    </div>
  );
}
