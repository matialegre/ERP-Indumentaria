import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2, Tag,
} from "lucide-react";

const EVENT_TYPES = [
  { value: "PROMOCION_LIQUIDACION",    label: "Promociones y Liquidaciones", color: "#F59E0B", bg: "bg-amber-100", text: "text-amber-800" },
  { value: "FERIADO_FECHA_IMPORTANTE", label: "Feriados y Fechas Importantes", color: "#3B82F6", bg: "bg-blue-100",  text: "text-blue-800"  },
];

const TYPE_MAP = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t]));

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dateKey(d) {
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0];
}

function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const days = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1);
    days.push({ date: d, current: false });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), current: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), current: false });
  }
  return days;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  event_date: todayStr(),
  end_date: "",
  event_type: "FERIADO_FECHA_IMPORTANTE",
  color: "",
  is_all_day: true,
};

export default function CalendarioEventosPage() {
  const qc = useQueryClient();
  const { addToast } = useToast();

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [filterType, setFilterType] = useState("");
  const [view, setView] = useState("month"); // "month" | "list"
  const [modal, setModal] = useState(null); // null | { mode: "create"|"edit", data }
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar-events", viewYear],
    queryFn: () => api.get(`/calendar-events/?year=${viewYear}`),
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post("/calendar-events/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      addToast("Evento creado", "success");
      setModal(null);
    },
    onError: (e) => addToast(e.message || "Error al crear", "error"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/calendar-events/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      addToast("Evento actualizado", "success");
      setModal(null);
    },
    onError: (e) => addToast(e.message || "Error al actualizar", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/calendar-events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      addToast("Evento eliminado", "success");
      setDeleting(null);
    },
    onError: (e) => addToast(e.message || "Error al eliminar", "error"),
  });

  const filtered = useMemo(() => {
    let evs = events;
    if (filterType) evs = evs.filter(e => e.event_type === filterType);
    return evs;
  }, [events, filterType]);

  const eventsByDay = useMemo(() => {
    const map = {};
    filtered.forEach(ev => {
      const k = dateKey(ev.event_date);
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    });
    return map;
  }, [filtered]);

  const listEvents = useMemo(() => {
    return filtered.filter(ev => {
      const d = new Date(ev.event_date + "T00:00:00");
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }).sort((a, b) => a.event_date.localeCompare(b.event_date));
  }, [filtered, viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function openCreate(prefillDate) {
    setForm({ ...EMPTY_FORM, event_date: prefillDate || todayStr() });
    setModal({ mode: "create" });
  }

  function openEdit(ev) {
    setForm({
      title: ev.title,
      description: ev.description || "",
      event_date: dateKey(ev.event_date),
      end_date: ev.end_date ? dateKey(ev.end_date) : "",
      event_type: ev.event_type,
      color: ev.color || "",
      is_all_day: ev.is_all_day,
    });
    setModal({ mode: "edit", id: ev.id });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const body = {
      ...form,
      end_date: form.end_date || null,
      color: form.color || null,
    };
    if (modal.mode === "create") createMut.mutate(body);
    else updateMut.mutate({ id: modal.id, body });
  }

  const calDays = buildCalendarDays(viewYear, viewMonth);
  const todayKey = todayStr();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-blue-600" size={24} />
          <h1 className="text-xl font-bold text-gray-800">Calendario de Eventos</h1>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Nuevo evento
        </button>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setFilterType("")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${!filterType ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
        >
          Todos
        </button>
        {EVENT_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setFilterType(v => v === t.value ? "" : t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${filterType === t.value ? "text-white border-transparent" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            style={filterType === t.value ? { backgroundColor: t.color, borderColor: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === "month" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Mes</button>
          <button onClick={() => setView("list")}  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === "list"  ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Lista</button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><ChevronLeft size={18} /></button>
        <span className="text-base font-semibold text-gray-700 w-40 text-center">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition"><ChevronRight size={18} /></button>
        <button
          onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
          className="ml-2 px-3 py-1 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
        >
          Hoy
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : view === "month" ? (
        /* Calendar grid */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calDays.map((cell, i) => {
              const k = dateKey(cell.date);
              const dayEvents = eventsByDay[k] || [];
              const isToday = k === todayKey;
              return (
                <div
                  key={i}
                  onClick={() => cell.current && openCreate(k)}
                  className={`min-h-[80px] border-r border-b border-gray-100 p-1 cursor-pointer hover:bg-blue-50 transition relative ${!cell.current ? "bg-gray-50 opacity-50" : ""}`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1 ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}>
                    {cell.date.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const t = TYPE_MAP[ev.event_type];
                      return (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); openEdit(ev); }}
                          className="truncate text-[10px] font-medium px-1 rounded cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: ev.color || t?.color || "#94A3B8", color: "#fff" }}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {listEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No hay eventos en {MONTH_NAMES[viewMonth]} {viewYear}</div>
          ) : listEvents.map(ev => {
            const t = TYPE_MAP[ev.event_type];
            const color = ev.color || t?.color || "#94A3B8";
            return (
              <div key={ev.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition">
                <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 text-sm">{ev.title}</span>
                    {t && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.bg} ${t.text}`}>
                        {t.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {ev.event_date}{ev.end_date && ev.end_date !== ev.event_date ? ` → ${ev.end_date}` : ""}
                  </div>
                  {ev.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ev.description}</div>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleting(ev)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 flex-wrap pt-1">
        {EVENT_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">{modal.mode === "create" ? "Nuevo Evento" : "Editar Evento"}</h2>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ej: Día del trabajador"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  required
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio *</label>
                  <input
                    required
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Detalles opcionales..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Color personalizado</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || TYPE_MAP[form.event_type]?.color || "#94A3B8"}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                  />
                  <span className="text-xs text-gray-400">Por defecto según tipo</span>
                  {form.color && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, color: "" }))} className="text-xs text-gray-400 hover:text-gray-600 underline">Resetear</button>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {modal.mode === "create" ? "Crear" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800">Eliminar evento</h2>
            <p className="text-sm text-gray-600">¿Eliminar <strong>"{deleting.title}"</strong>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">Cancelar</button>
              <button
                onClick={() => deleteMut.mutate(deleting.id)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
