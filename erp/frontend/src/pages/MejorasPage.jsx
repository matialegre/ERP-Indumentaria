import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Lightbulb, CheckCircle2, Circle, Bot, Loader2,
  ChevronDown, ChevronUp, RefreshCw, Trash2, X,
  MessageSquare, Send, Edit3, Check,
} from "lucide-react";

const PRIORITY_CONFIG = {
  LOW:     { label: "Baja",    bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-400"  },
  NORMAL:  { label: "Normal",  bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  HIGH:    { label: "Alta",    bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400" },
  CRITICA: { label: "Crítica", bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-400"    },
};

const LABEL_SORT = { CRITICA: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

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

function NoteCard({ note, canAdmin, onApprove, onUnapprove, onDelete, onAdminNote }) {
  const [expanded, setExpanded] = useState(false);
  const pc = PRIORITY_CONFIG[note.priority] ?? PRIORITY_CONFIG.NORMAL;

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${
        note.is_done
          ? "border-emerald-200 opacity-80"
          : "border-gray-200 hover:border-purple-200 hover:shadow-sm"
      }`}
    >
      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
              {pc.label}
            </span>
            {note.is_done && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={10} /> Aplicado
              </span>
            )}
            {note.admin_note && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <MessageSquare size={10} /> Feedback
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {note.created_at ? new Date(note.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—"}
          </span>
        </div>

        {/* Texto */}
        <p className={`text-sm text-gray-800 leading-relaxed ${!expanded && "line-clamp-3"}`}>
          {note.text}
        </p>
        {note.text.length > 120 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-purple-500 mt-1 flex items-center gap-0.5 hover:underline"
          >
            {expanded ? <><ChevronUp size={12} /> Ver menos</> : <><ChevronDown size={12} /> Ver más</>}
          </button>
        )}

        {/* Autor */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
            {(note.author_name || "?").charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-gray-500">{note.author_name || "Anónimo"}</span>
        </div>

        {/* AI Reply */}
        {note.ai_reply && (
          <div className="mt-2.5 bg-purple-50 rounded-lg p-2.5 border border-purple-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot size={12} className="text-purple-500" />
              <span className="text-xs font-medium text-purple-600">Respuesta IA</span>
            </div>
            <p className="text-xs text-purple-700 leading-relaxed line-clamp-3">{note.ai_reply}</p>
          </div>
        )}

        {/* Admin note / feedback — solo admins */}
        {canAdmin && (
          <AdminNoteEditor note={note} onSave={onAdminNote} />
        )}

        {/* Actions */}
        {canAdmin && (
          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100">
            {!note.is_done ? (
              <button
                onClick={() => onApprove(note.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition"
              >
                <CheckCircle2 size={13} /> OK — Aplicar
              </button>
            ) : (
              <button
                onClick={() => onUnapprove(note.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
              >
                <Circle size={13} /> Desmarcar
              </button>
            )}
            <button
              onClick={() => { if (confirm("¿Eliminar esta nota?")) onDelete(note.id); }}
              className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleColumn({ page, pageLabel, notes, canAdmin, onApprove, onUnapprove, onDelete, onAdminNote }) {
  const pending = notes.filter(n => !n.is_done).length;
  const done = notes.filter(n => n.is_done).length;

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-[300px] shrink-0">
      {/* Column header */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Lightbulb size={15} className="text-purple-500 shrink-0" />
            <span className="font-semibold text-gray-900 text-sm truncate">{pageLabel || page}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {pending > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {pending}
              </span>
            )}
            {done > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                ✓{done}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5 pb-4">
        {notes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            canAdmin={canAdmin}
            onApprove={onApprove}
            onUnapprove={onUnapprove}
            onDelete={onDelete}
            onAdminNote={onAdminNote}
          />
        ))}
        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-300 text-sm">Sin notas</div>
        )}
      </div>
    </div>
  );
}

export default function MejorasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canAdmin = ["SUPERADMIN", "ADMIN"].includes(user?.role);

  const [filter, setFilter] = useState("pending"); // "all" | "pending" | "done"
  const [search, setSearch] = useState("");

  const includeDone = filter !== "pending";

  const { data: notes = [], isLoading, refetch } = useQuery({
    queryKey: ["improvement-notes-all", includeDone],
    queryFn: () => api.get(`/improvement-notes/?include_done=${includeDone}&limit=500`),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.post(`/improvement-notes/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes-all"] }),
  });

  const unapproveMutation = useMutation({
    mutationFn: (id) => api.post(`/improvement-notes/${id}/unapprove`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes-all"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/improvement-notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes-all"] }),
  });

  const adminNoteMutation = useMutation({
    mutationFn: ({ id, admin_note }) => api.patch(`/improvement-notes/${id}/admin-note`, { admin_note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["improvement-notes-all"] }),
  });

  // Filtrar y agrupar por módulo
  const grouped = useMemo(() => {
    let filtered = notes;

    if (filter === "done") filtered = notes.filter(n => n.is_done);
    if (filter === "pending") filtered = notes.filter(n => !n.is_done);

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        n => n.text.toLowerCase().includes(q) ||
             (n.author_name || "").toLowerCase().includes(q) ||
             (n.page_label || n.page || "").toLowerCase().includes(q)
      );
    }

    // Agrupar por page
    const map = {};
    for (const note of filtered) {
      const key = note.page || "general";
      if (!map[key]) map[key] = { page: key, pageLabel: note.page_label || key, notes: [] };
      map[key].notes.push(note);
    }

    // Ordenar cada columna: CRITICA primero, luego por fecha desc
    for (const col of Object.values(map)) {
      col.notes.sort((a, b) => {
        const pA = LABEL_SORT[a.priority] ?? 2;
        const pB = LABEL_SORT[b.priority] ?? 2;
        if (pA !== pB) return pA - pB;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    return Object.values(map).sort(
      (a, b) => b.notes.filter(n => !n.is_done).length - a.notes.filter(n => !n.is_done).length
    );
  }, [notes, filter, search]);

  const totalPending = notes.filter(n => !n.is_done).length;
  const totalDone    = notes.filter(n =>  n.is_done).length;

  const pendingMutation = approveMutation.isPending || unapproveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* ── Header ──────────────────────────────────────────────────────── */}
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
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {/* Stats + filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
              {totalPending} pendientes
            </span>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
              {totalDone} aplicados
            </span>
            <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg">
              {grouped.length} módulos
            </span>
          </div>

          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {[
              { id: "pending", label: "Pendientes" },
              { id: "done",    label: "Aplicados" },
              { id: "all",     label: "Todos" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filter === f.id ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
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

        {/* Info sobre feedback */}
        {canAdmin && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <MessageSquare size={16} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Feedback visible para el empleado.</span>{" "}
              Cada nota tiene un campo azul donde podés escribir tu crítica o comentario.
              El empleado lo verá en el panel 💡 de su módulo.
            </p>
          </div>
        )}
      </div>

      {/* ── Kanban horizontal ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300">
            <Lightbulb size={48} className="mb-3 text-gray-200" />
            <p className="text-gray-400 font-medium">No hay notas para mostrar</p>
            <p className="text-sm text-gray-300 mt-1">Las sugerencias aparecen cuando los usuarios usan el botón 💡 en cada página</p>
          </div>
        ) : (
          <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
            {grouped.map(col => (
              <ModuleColumn
                key={col.page}
                page={col.page}
                pageLabel={col.pageLabel}
                notes={col.notes}
                canAdmin={canAdmin}
                onApprove={(id) => approveMutation.mutate(id)}
                onUnapprove={(id) => unapproveMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onAdminNote={(id, admin_note) => adminNoteMutation.mutateAsync({ id, admin_note })}
              />
            ))}
          </div>
        )}
      </div>

      {pendingMutation && (
        <div className="fixed bottom-6 right-6 bg-purple-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <Loader2 size={15} className="animate-spin" />
          {approveMutation.isPending ? "Aprobando y lanzando Copilot..." : "Guardando..."}
        </div>
      )}
    </div>
  );
}
