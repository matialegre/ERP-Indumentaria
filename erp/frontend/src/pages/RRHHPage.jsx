/**
 * RRHHPage.jsx — Módulo de Recursos Humanos
 * Tabs: Empleados | Fichajes | Ausencias | Documentos | Comunicaciones
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Users, Clock, Calendar, FileText, Megaphone,
  Plus, Search, X, Edit2, Trash2, Check, ChevronDown,
  AlertCircle, CheckCircle, XCircle, Eye, Send,
  UserCheck, UserX, Briefcase, Phone, Mail, MapPin,
  Download, Upload, Archive, Bell, Star,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

const ESTADOS_EMP = { ACTIVO: "activo", LICENCIA: "amarillo", VACACIONES: "azul", BAJA: "rojo" };
const COLOR_ESTADO = {
  ACTIVO:     "bg-emerald-100 text-emerald-700",
  LICENCIA:   "bg-amber-100 text-amber-700",
  VACACIONES: "bg-blue-100 text-blue-700",
  BAJA:       "bg-red-100 text-red-700",
};
const COLOR_AUSENCIA = {
  PENDIENTE:  "bg-amber-100 text-amber-700",
  APROBADA:   "bg-emerald-100 text-emerald-700",
  RECHAZADA:  "bg-red-100 text-red-700",
  CANCELADA:  "bg-gray-100 text-gray-600",
};
const COLOR_FIRMA = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  FIRMADO:   "bg-emerald-100 text-emerald-700",
  RECHAZADO: "bg-red-100 text-red-700",
};
const COLOR_COM = {
  GENERAL:     "bg-blue-100 text-blue-700",
  URGENTE:     "bg-red-100 text-red-700",
  INFORMATIVO: "bg-teal-100 text-teal-700",
  FELICITACION:"bg-pink-100 text-pink-700",
};
const TIPOS_AUSENCIA = [
  "VACACIONES","ENFERMEDAD","LICENCIA_MATERNIDAD","LICENCIA_PATERNIDAD",
  "ESTUDIO","DUELO","PERSONAL","OTRO",
];
const TIPOS_DOC = ["RECIBO_SUELDO","CONTRATO","CERTIFICADO","CONSTANCIA","ACUERDO","OTRO"];
const TIPOS_COM = ["GENERAL","URGENTE","INFORMATIVO","FELICITACION"];

function Badge({ label, className }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function Avatar({ nombre, apellido, size = "md" }) {
  const initials = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={`${sz} rounded-full bg-violet-600 text-white font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ active, icon: Icon, label, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap
        ${active ? "bg-violet-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
    >
      <Icon size={16} />
      {label}
      {badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
          ${active ? "bg-white/30 text-white" : "bg-red-500 text-white"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: EMPLEADOS
// ═══════════════════════════════════════════════════════════════════════════

function EmpleadoModal({ emp, onClose, onSaved }) {
  const isEdit = !!emp;
  const [form, setForm] = useState(emp ?? {
    nombre: "", apellido: "", dni: "", cuil: "",
    email: "", telefono: "", direccion: "",
    fecha_nacimiento: "", fecha_ingreso: "",
    cargo: "", departamento: "", categoria: "",
    modalidad: "PRESENCIAL", sueldo_basico: "",
    emergencia_nombre: "", emergencia_tel: "",
    horario: "", notas: "", numero_legajo: "",
  });
  const [error, setError] = useState("");
  const [tab, setTab] = useState("personal");

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/rrhh/empleados/${emp.id}`, data)
      : api.post("/rrhh/empleados", data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const F = (field) => ({
    value: form[field] ?? "",
    onChange: (e) => setForm({ ...form, [field]: e.target.value }),
  });

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none";

  const handleSubmit = () => {
    if (!form.nombre || !form.apellido) { setError("Nombre y apellido son requeridos"); return; }
    const data = { ...form };
    if (!data.fecha_nacimiento) delete data.fecha_nacimiento;
    if (!data.fecha_ingreso) delete data.fecha_ingreso;
    if (!data.sueldo_basico) delete data.sueldo_basico;
    else data.sueldo_basico = parseFloat(data.sueldo_basico);
    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h3 className="font-semibold text-gray-900 text-lg">
            {isEdit ? "Editar Empleado" : "Nuevo Empleado"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* Tabs del modal */}
        <div className="flex gap-1 px-5 pt-3 border-b shrink-0">
          {[["personal","Datos personales"],["laboral","Datos laborales"],["extra","Contacto y notas"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition
                ${tab===t ? "border-b-2 border-violet-600 text-violet-600" : "text-gray-500 hover:text-gray-700"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          {tab === "personal" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input {...F("nombre")} className={inputCls} placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input {...F("apellido")} className={inputCls} placeholder="García" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNI</label>
                  <input {...F("dni")} className={inputCls} placeholder="30.123.456" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CUIL</label>
                  <input {...F("cuil")} className={inputCls} placeholder="20-30123456-7" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                  <input type="date" {...F("fecha_nacimiento")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">N° Legajo</label>
                  <input {...F("numero_legajo")} className={inputCls} placeholder="001" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" {...F("email")} className={inputCls} placeholder="juan@empresa.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input {...F("telefono")} className={inputCls} placeholder="+54 9 11 1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input {...F("direccion")} className={inputCls} placeholder="Av. Siempre Viva 123" />
                </div>
              </div>
            </>
          )}

          {tab === "laboral" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
                  <input type="date" {...F("fecha_ingreso")} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Puesto</label>
                  <input {...F("cargo")} className={inputCls} placeholder="Vendedor" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <input {...F("departamento")} className={inputCls} placeholder="Ventas" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input {...F("categoria")} className={inputCls} placeholder="Dependiente A" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                  <select {...F("modalidad")} className={inputCls}>
                    <option value="PRESENCIAL">Presencial</option>
                    <option value="REMOTO">Remoto</option>
                    <option value="HIBRIDO">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo básico</label>
                  <input type="number" {...F("sueldo_basico")} className={inputCls} placeholder="200000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horario habitual</label>
                <input {...F("horario")} className={inputCls} placeholder="Lun–Vie 9:00 a 18:00" />
              </div>
              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado ?? "ACTIVO"}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    className={inputCls}
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="LICENCIA">En licencia</option>
                    <option value="VACACIONES">En vacaciones</option>
                    <option value="BAJA">Dado de baja</option>
                  </select>
                </div>
              )}
            </>
          )}

          {tab === "extra" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contacto emergencia</label>
                  <input {...F("emergencia_nombre")} className={inputCls} placeholder="María García" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tel. emergencia</label>
                  <input {...F("emergencia_tel")} className={inputCls} placeholder="+54 9 11 0000-0000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
                <textarea {...F("notas")} rows={4} className={inputCls + " resize-none"}
                  placeholder="Información adicional del empleado..." />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
          >
            {mutation.isPending ? "Guardando..." : isEdit ? "Actualizar" : "Crear empleado"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabEmpleados({ canEdit }) {
  const qc = useQueryClient();
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState(null);

  const params = new URLSearchParams();
  if (buscar) params.set("buscar", buscar);
  if (estadoFiltro) params.set("estado", estadoFiltro);

  const { data: empleados = [], isLoading } = useQuery({
    queryKey: ["rrhh-empleados", buscar, estadoFiltro],
    queryFn: () => api.get(`/rrhh/empleados?${params}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/empleados/${id}`),
    onSuccess: () => qc.invalidateQueries(["rrhh-empleados"]),
  });

  const refresh = () => {
    qc.invalidateQueries(["rrhh-empleados"]);
    qc.invalidateQueries(["rrhh-stats"]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={buscar} onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por nombre, DNI..."
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 w-60"
            />
          </div>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="LICENCIA">En licencia</option>
            <option value="VACACIONES">En vacaciones</option>
            <option value="BAJA">Dados de baja</option>
          </select>
        </div>
        {canEdit && (
          <button onClick={() => { setEditEmp(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
            <Plus size={16} /> Nuevo empleado
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
      ) : empleados.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No hay empleados registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empleados.map((emp) => (
            <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nombre={emp.nombre} apellido={emp.apellido} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{emp.nombre} {emp.apellido}</p>
                    <p className="text-xs text-gray-500 truncate">{emp.cargo ?? "Sin cargo"}</p>
                  </div>
                </div>
                <Badge label={emp.estado} className={COLOR_ESTADO[emp.estado] ?? "bg-gray-100 text-gray-600"} />
              </div>

              <div className="mt-3 space-y-1 text-xs text-gray-500">
                {emp.departamento && (
                  <div className="flex items-center gap-1.5"><Briefcase size={12} />{emp.departamento}</div>
                )}
                {emp.email && (
                  <div className="flex items-center gap-1.5"><Mail size={12} /><span className="truncate">{emp.email}</span></div>
                )}
                {emp.telefono && (
                  <div className="flex items-center gap-1.5"><Phone size={12} />{emp.telefono}</div>
                )}
                {emp.modalidad && (
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-xs font-medium">
                      {emp.modalidad}
                    </span>
                    {emp.numero_legajo && <span className="text-gray-400">Leg. {emp.numero_legajo}</span>}
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => { setEditEmp(emp); setShowModal(true); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <Edit2 size={12} /> Editar
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar a ${emp.nombre} ${emp.apellido}?`)) deleteMut.mutate(emp.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <EmpleadoModal
          emp={editEmp}
          onClose={() => setShowModal(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: FICHAJES
// ═══════════════════════════════════════════════════════════════════════════

function FichajeModal({ empleados, onClose, onSaved }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    empleado_id: "", fecha: today,
    hora_entrada: "09:00", hora_salida: "",
    tipo: "PRESENCIAL", estado: "OK", observacion: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data) => api.post("/rrhh/fichajes", data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Registrar fichaje</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
            <select value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}
              className={inputCls}>
              <option value="">Seleccionar...</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrada</label>
              <input type="time" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salida (opcional)</label>
              <input type="time" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })}
                className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
                <option value="PRESENCIAL">Presencial</option>
                <option value="REMOTO">Remoto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={inputCls}>
                <option value="OK">OK</option>
                <option value="TARDANZA">Tardanza</option>
                <option value="AUSENTE">Ausente</option>
                <option value="MEDIO_DIA">Medio día</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observación</label>
            <input value={form.observacion} onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              className={inputCls} placeholder="Opcional..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              Cancelar
            </button>
            <button
              disabled={!form.empleado_id || mutation.isPending}
              onClick={() => mutation.mutate({
                ...form,
                empleado_id: parseInt(form.empleado_id),
                hora_entrada: form.hora_entrada || null,
                hora_salida: form.hora_salida || null,
              })}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? "Guardando..." : "Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabFichajes({ empleados, canEdit }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [empFiltro, setEmpFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);

  const params = new URLSearchParams();
  if (fechaDesde) params.set("fecha_desde", fechaDesde);
  if (fechaHasta) params.set("fecha_hasta", fechaHasta);
  if (empFiltro) params.set("empleado_id", empFiltro);

  const { data: fichajes = [], isLoading } = useQuery({
    queryKey: ["rrhh-fichajes", fechaDesde, fechaHasta, empFiltro],
    queryFn: () => api.get(`/rrhh/fichajes?${params}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/fichajes/${id}`),
    onSuccess: () => qc.invalidateQueries(["rrhh-fichajes"]),
  });

  const totalHoras = fichajes.reduce((a, f) => a + (f.horas_trabajadas ?? 0), 0);

  const estadoColor = { OK: "text-emerald-600", TARDANZA: "text-amber-600", AUSENTE: "text-red-500", MEDIO_DIA: "text-blue-500" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Desde</span>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Hasta</span>
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <select value={empFiltro} onChange={(e) => setEmpFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">Todos los empleados</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
          </select>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
            <Plus size={16} /> Registrar fichaje
          </button>
        )}
      </div>

      {/* Summary */}
      {fichajes.length > 0 && (
        <div className="flex gap-4 text-sm bg-violet-50 border border-violet-100 rounded-xl p-3">
          <span className="text-violet-700 font-medium">{fichajes.length} registros</span>
          <span className="text-gray-400">·</span>
          <span className="text-violet-700 font-medium">{totalHoras.toFixed(1)}h totales trabajadas</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
      ) : fichajes.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Clock size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No hay fichajes para este período.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Empleado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Entrada</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Salida</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Horas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fichajes.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.empleado_nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.fecha}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{f.hora_entrada ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{f.hora_salida ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{f.horas_trabajadas != null ? `${f.horas_trabajadas}h` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold text-xs ${estadoColor[f.estado] ?? "text-gray-600"}`}>{f.estado}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{f.tipo}</span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button onClick={() => { if (confirm("¿Eliminar este fichaje?")) deleteMut.mutate(f.id); }}
                        className="p-1 text-gray-300 hover:text-red-500 transition"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <FichajeModal empleados={empleados} onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries(["rrhh-fichajes"])} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: AUSENCIAS
// ═══════════════════════════════════════════════════════════════════════════

function AusenciaModal({ empleados, onClose, onSaved }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    empleado_id: "", tipo: "VACACIONES",
    fecha_desde: today, fecha_hasta: today, motivo: "",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (data) => api.post("/rrhh/ausencias", data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });
  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Nueva ausencia / vacación</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
            <select value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })} className={inputCls}>
              <option value="">Seleccionar...</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
              {TIPOS_AUSENCIA.map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input type="date" value={form.fecha_desde} onChange={(e) => setForm({ ...form, fecha_desde: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input type="date" value={form.fecha_hasta} onChange={(e) => setForm({ ...form, fecha_hasta: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              rows={2} className={inputCls + " resize-none"} placeholder="Describir brevemente..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
              Cancelar
            </button>
            <button
              disabled={!form.empleado_id || mutation.isPending}
              onClick={() => mutation.mutate({ ...form, empleado_id: parseInt(form.empleado_id) })}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? "Guardando..." : "Solicitar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabAusencias({ empleados, canEdit }) {
  const qc = useQueryClient();
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [aprobandoId, setAprobandoId] = useState(null);
  const [comentarioAprob, setComentarioAprob] = useState("");

  const params = new URLSearchParams();
  if (estadoFiltro) params.set("estado", estadoFiltro);

  const { data: ausencias = [], isLoading } = useQuery({
    queryKey: ["rrhh-ausencias", estadoFiltro],
    queryFn: () => api.get(`/rrhh/ausencias?${params}`),
  });

  const aprobarMut = useMutation({
    mutationFn: ({ id, estado }) => api.patch(`/rrhh/ausencias/${id}/aprobar`, {
      estado, comentario_aprobacion: comentarioAprob || null,
    }),
    onSuccess: () => {
      setAprobandoId(null);
      setComentarioAprob("");
      qc.invalidateQueries(["rrhh-ausencias"]);
      qc.invalidateQueries(["rrhh-stats"]);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/ausencias/${id}`),
    onSuccess: () => qc.invalidateQueries(["rrhh-ausencias"]),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {["","PENDIENTE","APROBADA","RECHAZADA"].map((e) => (
            <button key={e} onClick={() => setEstadoFiltro(e)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${estadoFiltro === e ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {e || "Todas"}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
            <Plus size={16} /> Nueva solicitud
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
      ) : ausencias.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No hay solicitudes de ausencia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ausencias.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{a.empleado_nombre}</p>
                    <p className="text-xs text-gray-500">
                      {a.tipo.replace(/_/g," ")} · {a.fecha_desde} → {a.fecha_hasta} · <span className="font-medium">{a.dias} días</span>
                    </p>
                    {a.motivo && <p className="text-xs text-gray-400 mt-0.5">"{a.motivo}"</p>}
                  </div>
                </div>
                <Badge label={a.estado} className={COLOR_AUSENCIA[a.estado] ?? "bg-gray-100 text-gray-600"} />
              </div>

              {a.aprobado_por_nombre && (
                <p className="text-xs text-gray-400 mt-2 pl-13">
                  {a.estado === "APROBADA" ? "✓" : "✗"} por {a.aprobado_por_nombre}
                  {a.comentario_aprobacion && ` — "${a.comentario_aprobacion}"`}
                </p>
              )}

              {canEdit && a.estado === "PENDIENTE" && (
                aprobandoId === a.id ? (
                  <div className="mt-3 pt-3 border-t flex gap-2 items-center">
                    <input value={comentarioAprob} onChange={(e) => setComentarioAprob(e.target.value)}
                      placeholder="Comentario (opcional)"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none" />
                    <button onClick={() => aprobarMut.mutate({ id: a.id, estado: "APROBADA" })}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 flex items-center gap-1">
                      <Check size={12} /> Aprobar
                    </button>
                    <button onClick={() => aprobarMut.mutate({ id: a.id, estado: "RECHAZADA" })}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 flex items-center gap-1">
                      <X size={12} /> Rechazar
                    </button>
                    <button onClick={() => setAprobandoId(null)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <button onClick={() => { setAprobandoId(a.id); setComentarioAprob(""); }}
                      className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
                      Resolver
                    </button>
                    <button onClick={() => { if (confirm("¿Eliminar solicitud?")) deleteMut.mutate(a.id); }}
                      className="px-3 py-1 text-xs text-red-400 hover:bg-red-50 rounded-lg transition">
                      Eliminar
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AusenciaModal empleados={empleados} onClose={() => setShowModal(false)}
          onSaved={() => { qc.invalidateQueries(["rrhh-ausencias"]); qc.invalidateQueries(["rrhh-stats"]); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: DOCUMENTOS
// ═══════════════════════════════════════════════════════════════════════════

function DocumentoModal({ empleados, onClose, onSaved }) {
  const [form, setForm] = useState({
    empleado_id: "", tipo: "RECIBO_SUELDO",
    nombre: "", periodo: "", notas: "",
    archivo_base64: null, archivo_nombre: null, archivo_mime: null,
  });
  const [error, setError] = useState("");
  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none";

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, archivo_base64: ev.target.result, archivo_nombre: file.name, archivo_mime: file.type }));
    };
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: (data) => api.post("/rrhh/documentos", data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Subir documento</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empleado (dejar vacío = general)</label>
            <select value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })} className={inputCls}>
              <option value="">— General —</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
                {TIPOS_DOC.map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período (YYYY-MM)</label>
              <input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                className={inputCls} placeholder="2025-01" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del documento</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputCls} placeholder="Recibo Enero 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo (PDF, imagen)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:text-sm file:font-medium hover:file:bg-violet-100" />
            {form.archivo_nombre && <p className="text-xs text-gray-400 mt-1">📎 {form.archivo_nombre}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className={inputCls} placeholder="Opcional..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button
              disabled={!form.nombre || mutation.isPending}
              onClick={() => mutation.mutate({
                ...form,
                empleado_id: form.empleado_id ? parseInt(form.empleado_id) : null,
              })}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? "Subiendo..." : "Subir documento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabDocumentos({ empleados, canEdit }) {
  const qc = useQueryClient();
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [empFiltro, setEmpFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);

  const params = new URLSearchParams();
  if (tipoFiltro) params.set("tipo", tipoFiltro);
  if (empFiltro) params.set("empleado_id", empFiltro);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["rrhh-documentos", tipoFiltro, empFiltro],
    queryFn: () => api.get(`/rrhh/documentos?${params}`),
  });

  const firmarMut = useMutation({
    mutationFn: (id) => api.patch(`/rrhh/documentos/${id}/firmar`),
    onSuccess: () => { qc.invalidateQueries(["rrhh-documentos"]); qc.invalidateQueries(["rrhh-stats"]); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/documentos/${id}`),
    onSuccess: () => qc.invalidateQueries(["rrhh-documentos"]),
  });

  const handleDownload = (doc) => {
    if (!doc.archivo_base64) return;
    const a = document.createElement("a");
    a.href = doc.archivo_base64;
    a.download = doc.archivo_nombre ?? doc.nombre;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">Todos los tipos</option>
            {TIPOS_DOC.map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
          </select>
          <select value={empFiltro} onChange={(e) => setEmpFiltro(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
            <option value="">Todos los empleados</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
          </select>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
            <Upload size={16} /> Subir documento
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
      ) : docs.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No hay documentos cargados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{doc.nombre}</p>
                    <p className="text-xs text-gray-500">
                      {doc.tipo.replace(/_/g," ")}
                      {doc.periodo && ` · ${doc.periodo}`}
                      {doc.empleado_nombre && ` · ${doc.empleado_nombre}`}
                    </p>
                  </div>
                </div>
                <Badge label={doc.estado_firma} className={COLOR_FIRMA[doc.estado_firma] ?? "bg-gray-100 text-gray-600"} />
              </div>

              {doc.firmado_at && (
                <p className="text-xs text-gray-400 mt-2">✓ Firmado {new Date(doc.firmado_at).toLocaleDateString("es-AR")}</p>
              )}

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {doc.archivo_base64 && (
                  <button onClick={() => handleDownload(doc)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <Download size={12} /> Descargar
                  </button>
                )}
                {doc.estado_firma === "PENDIENTE" && (
                  <button onClick={() => { if (confirm("¿Firmar digitalmente este documento?")) firmarMut.mutate(doc.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                    <Check size={12} /> Firmar
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { if (confirm("¿Eliminar este documento?")) deleteMut.mutate(doc.id); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded-lg transition ml-auto">
                    <Trash2 size={12} /> Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <DocumentoModal empleados={empleados} onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries(["rrhh-documentos"])} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: COMUNICACIONES
// ═══════════════════════════════════════════════════════════════════════════

function ComunicacionModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ asunto: "", cuerpo: "", tipo: "GENERAL" });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (data) => api.post("/rrhh/comunicaciones", data),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => setError(e.message),
  });
  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Nueva comunicación</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
                {TIPOS_COM.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destinatarios</label>
              <input value="Todo el equipo" disabled className={inputCls + " bg-gray-50 text-gray-400"} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto *</label>
            <input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })}
              className={inputCls} placeholder="Título de la comunicación" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje *</label>
            <textarea value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
              rows={5} className={inputCls + " resize-none"} placeholder="Escribir el mensaje aquí..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button
              disabled={!form.asunto || !form.cuerpo || mutation.isPending}
              onClick={() => mutation.mutate({ ...form, destinatarios: { target: "ALL" } })}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={15} />
              {mutation.isPending ? "Enviando..." : "Enviar comunicación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabComunicaciones({ canEdit }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const { data: comunicaciones = [], isLoading } = useQuery({
    queryKey: ["rrhh-comunicaciones"],
    queryFn: () => api.get("/rrhh/comunicaciones?archivada=false"),
  });

  const archivarMut = useMutation({
    mutationFn: (id) => api.patch(`/rrhh/comunicaciones/${id}/archivar`),
    onSuccess: () => qc.invalidateQueries(["rrhh-comunicaciones"]),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/comunicaciones/${id}`),
    onSuccess: () => qc.invalidateQueries(["rrhh-comunicaciones"]),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{comunicaciones.length} comunicaciones activas</p>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition">
            <Send size={16} /> Nueva comunicación
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
      ) : comunicaciones.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 text-gray-200" />
          <p>No hay comunicaciones activas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicaciones.map((com) => (
            <div key={com.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button className="w-full text-left p-4 hover:bg-gray-50/50 transition"
                onClick={() => setExpanded(expanded === com.id ? null : com.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${com.tipo === "URGENTE" ? "bg-red-50" : com.tipo === "FELICITACION" ? "bg-pink-50" : "bg-violet-50"}`}>
                      <Megaphone size={18} className={
                        com.tipo === "URGENTE" ? "text-red-600" : com.tipo === "FELICITACION" ? "text-pink-600" : "text-violet-600"
                      } />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{com.asunto}</p>
                      <p className="text-xs text-gray-400">
                        por {com.enviado_por_nombre} · {new Date(com.created_at).toLocaleDateString("es-AR")}
                        · {com.total_lecturas} {com.total_lecturas === 1 ? "lectura" : "lecturas"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge label={com.tipo} className={COLOR_COM[com.tipo] ?? "bg-gray-100 text-gray-600"} />
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded === com.id ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </button>

              {expanded === com.id && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap leading-relaxed">{com.cuerpo}</p>
                  {canEdit && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => archivarMut.mutate(com.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-white border border-gray-200 rounded-lg transition">
                        <Archive size={12} /> Archivar
                      </button>
                      <button onClick={() => { if (confirm("¿Eliminar esta comunicación?")) deleteMut.mutate(com.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ComunicacionModal onClose={() => setShowModal(false)}
          onSaved={() => qc.invalidateQueries(["rrhh-comunicaciones"])} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function RRHHPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("empleados");

  const canEdit = ["SUPERADMIN", "ADMIN", "MEGAADMIN"].includes(user?.role);

  const { data: stats } = useQuery({
    queryKey: ["rrhh-stats"],
    queryFn: () => api.get("/rrhh/stats"),
    refetchInterval: 60_000,
  });

  const { data: empleados = [] } = useQuery({
    queryKey: ["rrhh-empleados-all"],
    queryFn: () => api.get("/rrhh/empleados"),
  });

  const TABS = [
    { id: "empleados",       icon: Users,      label: "Empleados",     badge: 0 },
    { id: "fichajes",        icon: Clock,      label: "Fichajes",      badge: 0 },
    { id: "ausencias",       icon: Calendar,   label: "Ausencias",     badge: stats?.ausencias_pendientes ?? 0 },
    { id: "documentos",      icon: FileText,   label: "Documentos",    badge: stats?.docs_pendientes_firma ?? 0 },
    { id: "comunicaciones",  icon: Megaphone,  label: "Comunicaciones",badge: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recursos Humanos</h1>
            <p className="text-sm text-gray-500">Gestión integral del equipo de trabajo</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total empleados",   value: stats.total_empleados,       icon: Users,       color: "violet" },
            { label: "Activos",           value: stats.empleados_activos,     icon: UserCheck,   color: "emerald" },
            { label: "Aus. pendientes",   value: stats.ausencias_pendientes,  icon: Calendar,    color: "amber" },
            { label: "Docs. sin firma",   value: stats.docs_pendientes_firma, icon: FileText,    color: "orange" },
            { label: "Comunicaciones",    value: stats.comunicaciones_activas,icon: Megaphone,   color: "blue" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-${color}-50 flex items-center justify-center shrink-0`}>
                <Icon size={16} className={`text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <TabBtn key={t.id} active={tab === t.id} icon={t.icon} label={t.label}
            badge={t.badge} onClick={() => setTab(t.id)} />
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "empleados"      && <TabEmpleados canEdit={canEdit} />}
        {tab === "fichajes"       && <TabFichajes  empleados={empleados} canEdit={canEdit} />}
        {tab === "ausencias"      && <TabAusencias empleados={empleados} canEdit={canEdit} />}
        {tab === "documentos"     && <TabDocumentos empleados={empleados} canEdit={canEdit} />}
        {tab === "comunicaciones" && <TabComunicaciones canEdit={canEdit} />}
      </div>
    </div>
  );
}
