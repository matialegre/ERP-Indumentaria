import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plus, X, Trash2, Check, Edit3, GripVertical,
  AlertCircle, Loader2, Layout, ArrowRight,
} from "lucide-react";

const PRIORITY = {
  BAJA:    { label: "Baja",    color: "bg-green-100 text-green-700",   border: "border-l-green-400"  },
  MEDIA:   { label: "Media",   color: "bg-blue-100 text-blue-700",     border: "border-l-blue-400"   },
  ALTA:    { label: "Alta",    color: "bg-orange-100 text-orange-700", border: "border-l-orange-400" },
  URGENTE: { label: "Urgente", color: "bg-red-100 text-red-700",       border: "border-l-red-500"    },
};

const BOARD_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];

function ErrorMsg({ msg }) {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
      <AlertCircle size={16} /> {msg}
    </div>
  );
}

function Modal({ title, onClose, children, size = "md" }) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Board Sidebar ────────────────────────────────────────────────────────────

function NewBoardModal({ onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => api.post("/kanban/boards/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban-boards"] }); onClose(); },
    onError: (e) => setError(e.message),
  });

  return (
    <Modal title="Nueva Pizarra" onClose={onClose} size="sm">
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!name.trim()) return setError("Ingrese un nombre"); mutation.mutate({ name: name.trim(), color }); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Sprint Mayo" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {BOARD_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : ""}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        {error && <ErrorMsg msg={error} />}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} Crear
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Card Modal (Create / Edit) ───────────────────────────────────────────────

function CardModal({ columns, columnId, card, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!card;
  const [form, setForm] = useState({
    title:       card?.title        ?? "",
    description: card?.description  ?? "",
    priority:    card?.priority     ?? "MEDIA",
    due_date:    card?.due_date     ?? "",
    color:       card?.color        ?? "",
    labels:      card?.labels?.join(", ") ?? "",
    assigned_to: card?.assigned_to  ?? "",
    column_id:   card?.column_id    ?? columnId ?? "",
  });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? api.put(`/kanban/cards/${card.id}`, data) : api.post("/kanban/cards/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban-board"] }); onClose(); },
    onError: (e) => setError(e.message),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Ingrese un título");
    const labels = form.labels ? form.labels.split(",").map((l) => l.trim()).filter(Boolean) : [];
    mutation.mutate({
      ...form,
      title: form.title.trim(),
      labels,
      column_id: parseInt(form.column_id),
      due_date: form.due_date || null,
      color: form.color || null,
      assigned_to: form.assigned_to || null,
    });
  };

  return (
    <Modal title={isEdit ? "Editar Tarjeta" : "Nueva Tarjeta"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Título *</label>
          <input autoFocus className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Prioridad</label>
            <select className={inputCls} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Vencimiento</label>
            <input type="date" className={inputCls} value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Asignado a</label>
            <input className={inputCls} value={form.assigned_to} onChange={(e) => set("assigned_to", e.target.value)} placeholder="Nombre" />
          </div>
          <div>
            <label className={labelCls}>Columna</label>
            <select className={inputCls} value={form.column_id} onChange={(e) => set("column_id", e.target.value)}>
              {columns?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Etiquetas <span className="text-gray-400 font-normal">(separadas por coma)</span></label>
          <input className={inputCls} value={form.labels} onChange={(e) => set("labels", e.target.value)} placeholder="diseño, backend, urgente" />
        </div>
        {error && <ErrorMsg msg={error} />}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} {isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Move Card Modal ──────────────────────────────────────────────────────────

function MoveCardModal({ card, columns, onClose }) {
  const qc = useQueryClient();
  const [targetColumn, setTargetColumn] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: ({ id, column_id }) => api.post(`/kanban/cards/${id}/move`, { column_id, position: 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban-board"] }); onClose(); },
    onError: (e) => setError(e.message),
  });

  const otherCols = columns?.filter((c) => c.id !== card.column_id) ?? [];

  return (
    <Modal title="Mover Tarjeta" onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Mover <strong>{card.title}</strong> a:</p>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)}
        >
          <option value="">Seleccionar columna...</option>
          {otherCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {error && <ErrorMsg msg={error} />}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => { if (!targetColumn) return setError("Seleccione columna"); mutation.mutate({ id: card.id, column_id: parseInt(targetColumn) }); }}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} <ArrowRight size={14} /> Mover
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ card, columns }) {
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const completeMutation = useMutation({
    mutationFn: (id) => api.post(`/kanban/cards/${id}/complete`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban-board"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/kanban/cards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban-board"] }),
  });

  const prio = PRIORITY[card.priority] ?? PRIORITY.MEDIA;
  const isOverdue = card.due_date && !card.is_completed && new Date(card.due_date) < new Date();

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${prio.border} p-3 space-y-2 hover:shadow-md transition-shadow group ${card.is_completed ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-2">
          <GripVertical size={14} className="text-gray-300 mt-0.5 shrink-0 cursor-grab group-hover:text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium text-gray-900 leading-snug ${card.is_completed ? "line-through text-gray-400" : ""}`}>
              {card.title}
            </p>
            {card.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{card.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${prio.color}`}>
            {prio.label}
          </span>
          {card.labels?.map((l) => (
            <span key={l} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{l}</span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            {card.due_date && (
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                📅 {new Date(card.due_date).toLocaleDateString("es-AR")}
              </span>
            )}
            {card.assigned_to && (
              <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                {card.assigned_to_name ?? card.assigned_to}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title={card.is_completed ? "Marcar pendiente" : "Completar"}
              onClick={() => completeMutation.mutate(card.id)}
              className={`p-1 rounded hover:bg-green-50 transition-colors ${card.is_completed ? "text-green-600" : "text-gray-400 hover:text-green-600"}`}
            >
              <Check size={13} />
            </button>
            <button title="Editar" onClick={() => setShowEdit(true)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Edit3 size={13} />
            </button>
            <button title="Mover" onClick={() => setShowMove(true)} className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <ArrowRight size={13} />
            </button>
            <button
              title="Eliminar"
              onClick={() => { if (confirm("¿Eliminar tarjeta?")) deleteMutation.mutate(card.id); }}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {showEdit && <CardModal columns={columns} card={card} onClose={() => setShowEdit(false)} />}
      {showMove && <MoveCardModal card={card} columns={columns} onClose={() => setShowMove(false)} />}
    </>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function QuickAddCard({ columnId, onDone }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const mutation = useMutation({
    mutationFn: (data) => api.post("/kanban/cards/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban-board"] }); onDone(); },
  });

  const submit = () => {
    if (!title.trim()) return onDone();
    mutation.mutate({ title: title.trim(), column_id: columnId, priority: "MEDIA" });
  };

  return (
    <div className="bg-white rounded-lg border border-blue-300 shadow-sm p-2">
      <input
        autoFocus
        className="w-full text-sm border-none outline-none placeholder-gray-400"
        placeholder="Título de la tarjeta..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onDone(); }}
      />
      <div className="flex gap-1 mt-2">
        <button onClick={submit} disabled={mutation.isPending} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
          {mutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Agregar
        </button>
        <button onClick={onDone} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100">
          <X size={10} />
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({ column, columns, allCards }) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const cards = allCards?.filter((c) => c.column_id === column.id) ?? [];

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-gray-50 rounded-xl border border-gray-200 max-h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">{column.name}</span>
          <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5 font-medium">{cards.length}</span>
        </div>
        <button
          onClick={() => setShowQuickAdd(true)}
          title="Agregar tarjeta"
          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-16">
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} columns={columns} />
        ))}
        {showQuickAdd && (
          <QuickAddCard columnId={column.id} onDone={() => setShowQuickAdd(false)} />
        )}
        {cards.length === 0 && !showQuickAdd && (
          <div className="text-center py-6 text-gray-300 text-xs">Sin tarjetas</div>
        )}
      </div>

      <div className="p-2 border-t border-gray-200">
        <button
          onClick={() => setShowCardModal(true)}
          className="w-full flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 py-1.5 px-2 rounded-lg transition-colors"
        >
          <Plus size={13} /> Tarjeta detallada
        </button>
      </div>

      {showCardModal && (
        <CardModal columns={columns} columnId={column.id} onClose={() => setShowCardModal(false)} />
      )}
    </div>
  );
}

// ─── Add Column ───────────────────────────────────────────────────────────────

function AddColumnButton({ boardId }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: (n) => api.post(`/kanban/boards/${boardId}/columns/`, { name: n }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban-board"] }); setEditing(false); setName(""); },
  });

  if (!editing) {
    return (
      <div className="flex-shrink-0 w-72">
        <button
          onClick={() => setEditing(true)}
          className="w-full h-12 flex items-center gap-2 px-4 text-sm text-gray-500 hover:text-gray-700 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-xl transition-colors"
        >
          <Plus size={16} /> Agregar columna
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-72 bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
      <input
        autoFocus
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Nombre de columna..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) mutation.mutate(name.trim()); if (e.key === "Escape") { setEditing(false); setName(""); } }}
      />
      <div className="flex gap-2">
        <button onClick={() => name.trim() && mutation.mutate(name.trim())} disabled={mutation.isPending} className="flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
          {mutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Agregar
        </button>
        <button onClick={() => { setEditing(false); setName(""); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Board View ───────────────────────────────────────────────────────────────

function BoardView({ boardId }) {
  const query = useQuery({
    queryKey: ["kanban-board", boardId],
    queryFn: () => api.get(`/kanban/boards/${boardId}`),
    enabled: !!boardId,
  });

  if (!boardId) return (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <Layout size={48} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">Selecciona una pizarra</p>
        <p className="text-sm mt-1">O crea una nueva en el panel izquierdo</p>
      </div>
    </div>
  );

  if (query.isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 size={32} className="animate-spin text-blue-500" /></div>;
  if (query.isError)  return <div className="flex-1 p-6"><ErrorMsg msg={query.error.message} /></div>;

  const board = query.data;
  const columns = board?.columns ?? [];
  const allCards = columns.flatMap((c) => (c.cards ?? []).map((card) => ({ ...card, column_id: c.id })));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-bold text-gray-900">{board?.name}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{columns.length} columnas · {allCards.length} tarjetas</p>
      </div>
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 items-start h-full">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              columns={columns}
              allCards={allCards}
              boardId={boardId}
            />
          ))}
          <AddColumnButton boardId={boardId} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const qc = useQueryClient();
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [showNewBoard, setShowNewBoard] = useState(false);

  const boardsQuery = useQuery({
    queryKey: ["kanban-boards"],
    queryFn: () => api.get("/kanban/boards/"),
  });

  const deleteBoard = useMutation({
    mutationFn: (id) => api.delete(`/kanban/boards/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["kanban-boards"] });
      if (selectedBoard === id) setSelectedBoard(null);
    },
  });

  const boards = boardsQuery.data ?? [];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Layout size={18} className="text-blue-600" />
            <h1 className="font-bold text-gray-900 text-sm">TrellOutdoor</h1>
          </div>
          <button
            onClick={() => setShowNewBoard(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> Nueva Pizarra
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {boardsQuery.isLoading && (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
          )}
          {boards.map((board) => (
            <div
              key={board.id}
              onClick={() => setSelectedBoard(board.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${selectedBoard === board.id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: board.color ?? "#3B82F6" }} />
              <span className="flex-1 text-xs font-medium truncate">{board.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${board.name}"?`)) deleteBoard.mutate(board.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!boardsQuery.isLoading && boards.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 px-4">Sin pizarras. Crea la primera.</p>
          )}
        </div>
      </aside>

      {/* Board area */}
      <BoardView boardId={selectedBoard} />

      {showNewBoard && <NewBoardModal onClose={() => setShowNewBoard(false)} />}
    </div>
  );
}
