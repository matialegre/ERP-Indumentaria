import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Trash2, Edit2, X, Upload, AlertCircle, DollarSign
} from "lucide-react";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function fmtARS(n) {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function VencimientosPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const qc = useQueryClient();
  const { success, error: toastError } = useToast();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["service-expirations", viewYear, viewMonth],
    queryFn: () => api.get(`/service-expirations/?year=${viewYear}&month=${viewMonth + 1}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/service-expirations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-expirations"] });
      success("Vencimiento eliminado");
    },
    onError: () => toastError("Error al eliminar"),
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  const numDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  const byDay = {};
  items.forEach(item => {
    const d = parseInt(item.due_date.split("-")[2], 10);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(item);
  });

  const selectedItems = selectedDay ? (byDay[selectedDay] || []) : [];

  const totalMonth = items.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Calendario de Vencimientos</h1>
            <p className="text-xs text-gray-400">Servicios y pagos periódicos</p>
          </div>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* Navegación del mes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <span className="text-base font-semibold text-gray-900">{MONTHS[viewMonth]} {viewYear}</span>
            {totalMonth > 0 && (
              <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-gray-500">
                <DollarSign size={11} />
                <span>Total mes: <span className="font-medium text-gray-700">{fmtARS(totalMonth)}</span></span>
              </div>
            )}
          </div>
          <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Grid del calendario */}
        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: numDays }).map((_, i) => {
              const day = i + 1;
              const dayItems = byDay[day] || [];
              const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
              const isSelected = selectedDay === day;
              const hasPast = dayItems.some(it => {
                const d = new Date(it.due_date);
                return d < today && !isToday;
              });
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`
                    relative rounded-xl py-2 text-sm font-medium transition
                    ${isSelected ? "bg-blue-600 text-white shadow" : isToday ? "bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "hover:bg-gray-50 text-gray-700"}
                  `}
                >
                  {day}
                  {dayItems.length > 0 && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : hasPast ? "bg-red-400" : "bg-blue-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel del día seleccionado */}
      {selectedDay && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">
              {selectedDay} de {MONTHS[viewMonth]}
            </h2>
            <button
              onClick={() => { setEditItem(null); setShowForm(true); }}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus size={13} /> Agregar vencimiento
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-gray-400">No hay vencimientos este día.</p>
          ) : (
            <div className="space-y-3">
              {selectedItems.map(item => (
                <ExpirationCard
                  key={item.id}
                  item={item}
                  onEdit={() => { setEditItem(item); setShowForm(true); }}
                  onDelete={() => deleteMut.mutate(item.id)}
                  onImageClick={setLightboxImg}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista completa del mes */}
      {items.length > 0 && !selectedDay && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Todos los vencimientos de {MONTHS[viewMonth]}</h2>
          <div className="space-y-3">
            {items.map(item => (
              <ExpirationCard
                key={item.id}
                item={item}
                onEdit={() => { setEditItem(item); setShowForm(true); }}
                onDelete={() => deleteMut.mutate(item.id)}
                onImageClick={setLightboxImg}
              />
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {showForm && (
        <ExpirationForm
          initial={editItem}
          defaultDate={selectedDay ? `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` : ""}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["service-expirations"] });
            setShowForm(false);
            setEditItem(null);
          }}
        />
      )}

      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

function ExpirationCard({ item, onEdit, onDelete, onImageClick }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(item.due_date);
  const diffDays = Math.ceil((due - today) / 86400000);
  const isPast = diffDays < 0;
  const isSoon = diffDays >= 0 && diffDays <= 7;

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${isPast ? "border-red-200 bg-red-50" : isSoon ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{item.name}</span>
          {isPast && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Vencido</span>}
          {isSoon && !isPast && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Próximo</span>}
        </div>
        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>{item.due_date}</span>
          {item.amount && (
            <span className="font-medium text-gray-700 flex items-center gap-0.5">
              <DollarSign size={11} />
              {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(item.amount)}
            </span>
          )}
        </div>
        {item.images && item.images.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {item.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="w-14 h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition"
                onClick={() => onImageClick(src)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} className="p-1.5 hover:bg-white rounded-lg transition text-gray-400 hover:text-gray-700">
          <Edit2 size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-white rounded-lg transition text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ExpirationForm({ initial, defaultDate, onClose, onSaved }) {
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    due_date: initial?.due_date || defaultDate,
    amount: initial?.amount != null ? String(initial.amount) : "",
    images: initial?.images || [],
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  function handleImageFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, images: [...f.images, ev.target.result] }));
    };
    reader.readAsDataURL(file);
  }

  function removeImage(i) {
    setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.due_date) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date,
        amount: form.amount ? parseFloat(form.amount) : null,
        images: form.images,
      };
      if (initial?.id) {
        await api.put(`/service-expirations/${initial.id}`, payload);
      } else {
        await api.post("/service-expirations/", payload);
      }
      success(initial?.id ? "Vencimiento actualizado" : "Vencimiento agregado");
      onSaved();
    } catch {
      toastError("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial?.id ? "Editar vencimiento" : "Nuevo vencimiento"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del servicio *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ej: Hosting, Seguro, Alquiler..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              rows={2}
              placeholder="Detalles adicionales..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento *</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Importe (ARS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Imágenes / comprobantes</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition w-full justify-center"
            >
              <Upload size={15} /> Adjuntar imagen
            </button>
            {form.images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {form.images.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? "Guardando..." : initial?.id ? "Guardar cambios" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
