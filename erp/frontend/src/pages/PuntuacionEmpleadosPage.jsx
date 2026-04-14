import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Star, Plus, Trash2, X, TrendingUp, Users, Award, BarChart3,
  ChevronDown, ChevronUp,
} from "lucide-react";

const PERIODOS = (() => {
  const arr = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    arr.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return arr;
})();

function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition
            ${(hover || value) >= n
              ? "bg-amber-400 text-white"
              : "bg-gray-100 text-gray-400"}
            ${readOnly ? "cursor-default" : "hover:scale-110 cursor-pointer"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function ScoreModal({ employees, categorias, periodo, onClose, onCreated }) {
  const [form, setForm] = useState({
    employee_id: "",
    categoria: categorias[0] ?? "",
    puntuacion: 5,
    comentario: "",
    periodo,
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data) => api.post("/employee-scores", data),
    onSuccess: () => { onCreated(); onClose(); },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Nueva puntuación</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              required
            >
              <option value="">Seleccionar empleado...</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {PERIODOS.map((p) => (
                <option key={p.val} value={p.val}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Puntuación: <span className="text-amber-600 font-bold">{form.puntuacion}/10</span>
            </label>
            <StarRating value={form.puntuacion} onChange={(v) => setForm({ ...form, puntuacion: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentario (opcional)</label>
            <textarea
              value={form.comentario}
              onChange={(e) => setForm({ ...form, comentario: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
              placeholder="Observaciones..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!form.employee_id || mutation.isPending}
              onClick={() => mutation.mutate({ ...form, employee_id: Number(form.employee_id) })}
              className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ value, max = 10 }) {
  const pct = (value / max) * 100;
  const color = value >= 8 ? "bg-emerald-500" : value >= 6 ? "bg-amber-400" : value >= 4 ? "bg-orange-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
}

export default function PuntuacionEmpleadosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [periodoFiltro, setPeriodoFiltro] = useState(PERIODOS[0].val);
  const [showModal, setShowModal] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState(null);

  const canEdit = ["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(user?.role);

  const { data: resumen = [], isLoading: loadingResumen } = useQuery({
    queryKey: ["employee-scores-resumen", periodoFiltro],
    queryFn: () => api.get(`/employee-scores/resumen?periodo=${periodoFiltro}`),
  });

  const { data: allScores = [], isLoading: loadingScores } = useQuery({
    queryKey: ["employee-scores", periodoFiltro],
    queryFn: () => api.get(`/employee-scores?periodo=${periodoFiltro}`),
  });

  const { data: categoriasData } = useQuery({
    queryKey: ["employee-scores-categorias"],
    queryFn: () => api.get("/employee-scores/categorias"),
  });
  const categorias = categoriasData?.categorias ?? [];

  const { data: usersData } = useQuery({
    queryKey: ["users-all"],
    queryFn: () => api.get("/users/?limit=200"),
  });
  const employees = usersData?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/employee-scores/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(["employee-scores"]);
      qc.invalidateQueries(["employee-scores-resumen"]);
    },
  });

  const scoresByEmp = useMemo(() => {
    const map = {};
    for (const s of allScores) {
      if (!map[s.employee_id]) map[s.employee_id] = [];
      map[s.employee_id].push(s);
    }
    return map;
  }, [allScores]);

  const periodoLabel = PERIODOS.find((p) => p.val === periodoFiltro)?.label ?? periodoFiltro;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
            <Star size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Puntuación de Empleados</h1>
            <p className="text-sm text-gray-500">Evaluaciones periódicas del equipo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodoFiltro}
            onChange={(e) => setPeriodoFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"
          >
            {PERIODOS.map((p) => (
              <option key={p.val} value={p.val}>{p.label}</option>
            ))}
          </select>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition"
            >
              <Plus size={16} /> Nueva puntuación
            </button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Users size={20} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Empleados evaluados</p>
            <p className="text-xl font-bold text-gray-900">{resumen.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <BarChart3 size={20} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Puntuaciones registradas</p>
            <p className="text-xl font-bold text-gray-900">{allScores.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Promedio general</p>
            <p className="text-xl font-bold text-gray-900">
              {resumen.length > 0
                ? (resumen.reduce((a, b) => a + b.promedio, 0) / resumen.length).toFixed(1)
                : "—"}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Award size={20} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Mejor empleado</p>
            <p className="text-sm font-bold text-gray-900 truncate max-w-[100px]">
              {resumen[0]?.employee_name?.split(" ")[0] ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Ranking — {periodoLabel}</h2>
        </div>
        {loadingResumen ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : resumen.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Star size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No hay puntuaciones para este período.</p>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-amber-600 text-sm font-medium hover:underline"
              >
                Agregar la primera evaluación
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {resumen.map((emp, idx) => {
              const isExpanded = expandedEmp === emp.employee_id;
              const empScores = scoresByEmp[emp.employee_id] ?? [];
              return (
                <div key={emp.employee_id}>
                  <button
                    className="w-full text-left px-4 py-4 hover:bg-gray-50/50 transition"
                    onClick={() => setExpandedEmp(isExpanded ? null : emp.employee_id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Posición */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                        ${idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-gray-300 text-gray-700" : idx === 2 ? "bg-orange-300 text-white" : "bg-gray-100 text-gray-500"}`}>
                        {idx + 1}
                      </div>
                      {/* Nombre */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{emp.employee_name}</p>
                        <p className="text-xs text-gray-400">{emp.total_scores} evaluaciones</p>
                      </div>
                      {/* Barra de promedio */}
                      <div className="w-40 hidden sm:block">
                        <ScoreBar value={emp.promedio} />
                      </div>
                      {/* Promedio */}
                      <div className="text-right shrink-0">
                        <span className={`text-lg font-bold ${emp.promedio >= 8 ? "text-emerald-600" : emp.promedio >= 6 ? "text-amber-500" : "text-red-500"}`}>
                          {emp.promedio}
                        </span>
                        <span className="text-xs text-gray-400">/10</span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                      {/* Por categoría */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                        {Object.entries(emp.por_categoria).map(([cat, avg]) => (
                          <div key={cat} className="bg-white rounded-lg p-3 border border-gray-100">
                            <p className="text-xs font-medium text-gray-600 mb-1">{cat}</p>
                            <ScoreBar value={avg} />
                          </div>
                        ))}
                      </div>
                      {/* Historial de scores */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evaluaciones individuales</p>
                        {empScores.map((s) => (
                          <div key={s.id} className="flex items-start justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-700">{s.categoria}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded
                                  ${s.puntuacion >= 8 ? "bg-emerald-100 text-emerald-700" : s.puntuacion >= 6 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                                  {s.puntuacion}/10
                                </span>
                              </div>
                              {s.comentario && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.comentario}</p>}
                              <p className="text-xs text-gray-400 mt-0.5">Evaluado por: {s.scored_by_name}</p>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => { if (confirm("¿Eliminar esta puntuación?")) deleteMutation.mutate(s.id); }}
                                className="p-1 text-gray-300 hover:text-red-500 transition shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ScoreModal
          employees={employees}
          categorias={categorias}
          periodo={periodoFiltro}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries(["employee-scores"]);
            qc.invalidateQueries(["employee-scores-resumen"]);
          }}
        />
      )}
    </div>
  );
}
