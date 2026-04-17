/**
 * FichajePage — Vista admin del módulo de fichajes.
 * Muestra: fichajes de hoy, empleados con estado facial, historial.
 */
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  UserCheck, UserX, Clock, MapPin, Camera, CheckCircle2,
  XCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown,
  Filter, Download, Trash2, User, X, LogIn, LogOut, Settings,
} from "lucide-react";

// ── face-api lazy loader ─────────────────────────────────────────────────────
let faceApiModule = null;
let modelsLoaded = false;
async function loadFaceApi() {
  if (!faceApiModule) faceApiModule = await import("@vladmandic/face-api");
  if (!modelsLoaded) {
    const MODEL_URL = "/models";
    await Promise.all([
      faceApiModule.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceApiModule.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceApiModule.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  }
  return faceApiModule;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat("es-AR");

const STATUS_STYLE = {
  OK:             "bg-green-100 text-green-700",
  FACE_FAIL:      "bg-red-100 text-red-600",
  LOCATION_FAIL:  "bg-orange-100 text-orange-700",
  MANUAL:         "bg-gray-100 text-gray-500",
};

function StatusPill({ status }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-400"}`}>
      {status?.replace("_", " ")}
    </span>
  );
}

function timeOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function dateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Register Face Modal ───────────────────────────────────────────────────────
function RegisterFaceModal({ employee, onClose, onSuccess }) {
  const videoRef = useRef(null);
  const [step, setStep] = useState("idle"); // idle | camera | processing | done | error
  const [errorMsg, setErrorMsg] = useState(null);
  const streamRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (body) => api.post("/fichaje/register-face", body),
    onSuccess: () => { setStep("done"); onSuccess(); },
    onError: (e) => { setErrorMsg(e.message); setStep("error"); },
  });

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStep("camera");
      // Load models in background
      loadFaceApi().catch(() => {});
    } catch (e) {
      setErrorMsg("No se pudo acceder a la cámara: " + e.message);
      setStep("error");
    }
  }

  async function captureAndRegister() {
    if (!videoRef.current) return;
    setStep("processing");
    try {
      const faceApi = await loadFaceApi();
      const detection = await faceApi.detectSingleFace(
        videoRef.current,
        new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      if (!detection) throw new Error("No se detectó ninguna cara. Intentá de nuevo con mejor iluminación.");
      
      stopCamera();
      mutation.mutate({ user_id: employee.id, descriptor: Array.from(detection.descriptor) });
    } catch (e) {
      setErrorMsg(e.message);
      setStep("error");
    }
  }

  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Registrar cara</h2>
            <p className="text-xs text-gray-500 mt-0.5">{employee.full_name}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera preview */}
          <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
            <video ref={videoRef} className={`w-full h-full object-cover ${step === "camera" ? "block" : "hidden"}`} playsInline muted />
            {step !== "camera" && (
              <div className="absolute inset-0 flex items-center justify-center">
                {step === "idle" && <Camera size={32} className="text-white/40" />}
                {step === "processing" && <Loader2 size={32} className="text-white animate-spin" />}
                {step === "done" && <CheckCircle2 size={48} className="text-green-400" />}
                {step === "error" && <XCircle size={48} className="text-red-400" />}
              </div>
            )}
            {step === "camera" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-40 border-2 border-white/60 rounded-full" />
              </div>
            )}
          </div>

          {step === "error" && <p className="text-sm text-red-600 text-center">{errorMsg}</p>}
          {step === "done" && <p className="text-sm text-green-600 text-center font-medium">✓ Cara registrada correctamente</p>}

          {/* Buttons */}
          {step === "idle" && (
            <button onClick={startCamera} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              <Camera size={15} /> Abrir cámara
            </button>
          )}
          {step === "camera" && (
            <button onClick={captureAndRegister} className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 flex items-center justify-center gap-2">
              <UserCheck size={15} /> Registrar esta cara
            </button>
          )}
          {(step === "done" || step === "error") && (
            <button onClick={handleClose} className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Set Local Coords Modal ────────────────────────────────────────────────────
function SetCoordsModal({ local, onClose, onSuccess }) {
  const [lat, setLat] = useState(local.latitude ?? "");
  const [lon, setLon] = useState(local.longitude ?? "");
  const [radius, setRadius] = useState(local.geofence_radius ?? 300);
  const [detecting, setDetecting] = useState(false);

  const mutation = useMutation({
    mutationFn: (body) => api.post(`/fichaje/set-local-coords/${local.id}`, body),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  async function detectMyLocation() {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(7)); setLon(pos.coords.longitude.toFixed(7)); setDetecting(false); },
      () => setDetecting(false),
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Coordenadas de {local.name}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <button onClick={detectMyLocation} disabled={detecting} className="w-full py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center justify-center gap-2">
          {detecting ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          {detecting ? "Detectando..." : "Usar mi ubicación actual"}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Latitud</label>
            <input value={lat} onChange={e => setLat(e.target.value)} placeholder="-34.6037" className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Longitud</label>
            <input value={lon} onChange={e => setLon(e.target.value)} placeholder="-58.3816" className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 font-medium">Radio del geofence (metros)</label>
          <input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" min={50} max={2000} />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => mutation.mutate({ latitude: Number(lat), longitude: Number(lon), geofence_radius: radius })} disabled={!lat || !lon || mutation.isPending} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function FichajePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("hoy"); // hoy | empleados | historial | locales
  const [registerModal, setRegisterModal] = useState(null); // employee obj
  const [coordsModal, setCoordsModal] = useState(null); // local obj
  const [historialFilter, setHistorialFilter] = useState({ user_id: "", date_from: "", date_to: "" });

  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["fichaje-today"],
    queryFn: () => api.get("/fichaje/today"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: employeesData, isLoading: loadingEmps, refetch: refetchEmps } = useQuery({
    queryKey: ["fichaje-employees"],
    queryFn: () => api.get("/fichaje/employees"),
    staleTime: 60_000,
  });

  const { data: historialData, isLoading: loadingHistory } = useQuery({
    queryKey: ["fichaje-history", historialFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (historialFilter.user_id) p.set("user_id", historialFilter.user_id);
      if (historialFilter.date_from) p.set("date_from", historialFilter.date_from);
      if (historialFilter.date_to) p.set("date_to", historialFilter.date_to);
      return api.get(`/fichaje/history?${p}`);
    },
    staleTime: 30_000,
  });

  const { data: localsData } = useQuery({
    queryKey: ["locals-with-coords"],
    queryFn: () => api.get("/locals/"),
    staleTime: 60_000,
  });

  const deleteFaceMutation = useMutation({
    mutationFn: (userId) => api.delete(`/fichaje/face/${userId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fichaje-employees"] }); },
  });

  const today = todayData?.fichajes ?? [];
  const employees = employeesData?.employees ?? [];
  const historial = historialData?.fichajes ?? [];
  const locals = localsData?.items ?? localsData ?? [];

  // Stats
  const entradas = today.filter(f => f.checkin_type === "ENTRADA").length;
  const salidas = today.filter(f => f.checkin_type === "SALIDA").length;
  const alertas = today.filter(f => f.status !== "OK").length;

  const TABS = [
    { id: "hoy", label: "Hoy", badge: today.length },
    { id: "empleados", label: "Empleados", badge: employees.filter(e => !e.has_face).length > 0 ? employees.filter(e => !e.has_face).length + " sin cara" : null },
    { id: "historial", label: "Historial" },
    { id: "locales", label: "Configurar locales" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fichajes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reconocimiento facial + geolocalización</p>
        </div>
        <button onClick={() => { refetchToday(); refetchEmps(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{entradas}</p>
          <p className="text-xs text-green-600 mt-0.5 flex items-center justify-center gap-1"><LogIn size={11} />Entradas</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-700">{salidas}</p>
          <p className="text-xs text-orange-600 mt-0.5 flex items-center justify-center gap-1"><LogOut size={11} />Salidas</p>
        </div>
        <div className={`${alertas > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"} border rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${alertas > 0 ? "text-red-700" : "text-gray-400"}`}>{alertas}</p>
          <p className={`text-xs mt-0.5 flex items-center justify-center gap-1 ${alertas > 0 ? "text-red-600" : "text-gray-400"}`}><AlertTriangle size={11} />Alertas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.badge && (
              <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: HOY */}
      {tab === "hoy" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {loadingToday ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
          ) : today.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Sin fichajes hoy</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Empleado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden sm:table-cell">Local</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Hora</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Estado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden md:table-cell">Cara</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {today.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{f.full_name}</p>
                      <p className="text-xs text-gray-400">{f.role}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{f.local_name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`flex items-center gap-1 text-xs font-medium ${f.checkin_type === "ENTRADA" ? "text-green-600" : "text-orange-600"}`}>
                        {f.checkin_type === "ENTRADA" ? <LogIn size={12} /> : <LogOut size={12} />}
                        {f.checkin_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{timeOnly(f.created_at)}</td>
                    <td className="px-4 py-2.5"><StatusPill status={f.status} /></td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {f.face_match_score != null
                        ? <span className={`text-xs font-medium ${f.face_verified ? "text-green-600" : "text-red-500"}`}>{Math.round(f.face_match_score * 100)}%</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: EMPLEADOS */}
      {tab === "empleados" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          {loadingEmps ? (
            <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Empleado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden sm:table-cell">Último fichaje</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Cara</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{emp.full_name}</p>
                      <p className="text-xs text-gray-400">{emp.role} {emp.local_name ? `· ${emp.local_name}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {emp.last_checkin ? (
                        <div>
                          <span className={`text-xs font-medium ${emp.last_type === "ENTRADA" ? "text-green-600" : "text-orange-600"}`}>{emp.last_type}</span>
                          <p className="text-xs text-gray-400">{dateOnly(emp.last_checkin)} {timeOnly(emp.last_checkin)}</p>
                        </div>
                      ) : <span className="text-xs text-gray-300">Sin fichajes</span>}
                    </td>
                    <td className="px-4 py-3">
                      {emp.has_face
                        ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><UserCheck size={12} />Registrada</span>
                        : <span className="flex items-center gap-1 text-xs text-red-500 font-medium"><UserX size={12} />Sin cara</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRegisterModal(emp)}
                          className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
                        >
                          <Camera size={11} />{emp.has_face ? "Actualizar" : "Registrar"}
                        </button>
                        {emp.has_face && (
                          <button
                            onClick={() => deleteFaceMutation.mutate(emp.id)}
                            className="text-xs px-2.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: HISTORIAL */}
      {tab === "historial" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white border rounded-xl p-3 flex flex-wrap gap-3">
            <select
              value={historialFilter.user_id}
              onChange={e => setHistorialFilter(f => ({ ...f, user_id: e.target.value }))}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-700"
            >
              <option value="">Todos los empleados</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
            <input type="date" value={historialFilter.date_from} onChange={e => setHistorialFilter(f => ({ ...f, date_from: e.target.value }))} className="border rounded-lg px-3 py-1.5 text-sm" />
            <input type="date" value={historialFilter.date_to} onChange={e => setHistorialFilter(f => ({ ...f, date_to: e.target.value }))} className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            {loadingHistory ? (
              <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
            ) : historial.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Sin fichajes para los filtros seleccionados</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Empleado</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Fecha/Hora</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Estado</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 hidden md:table-cell">Distancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historial.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800">{f.full_name}</p>
                        <p className="text-xs text-gray-400">{f.local_name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1 text-xs font-medium ${f.checkin_type === "ENTRADA" ? "text-green-600" : "text-orange-600"}`}>
                          {f.checkin_type === "ENTRADA" ? <LogIn size={12} /> : <LogOut size={12} />}
                          {f.checkin_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{dateOnly(f.created_at)} {timeOnly(f.created_at)}</td>
                      <td className="px-4 py-2.5"><StatusPill status={f.status} /></td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell">
                        {f.distance_to_local != null ? `${f.distance_to_local}m` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: LOCALES */}
      {tab === "locales" && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <p className="text-xs text-gray-500">Configurá las coordenadas GPS de cada local para verificar la ubicación al fichar</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Local</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">GPS</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Radio</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(Array.isArray(locals) ? locals : []).map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                  <td className="px-4 py-3">
                    {l.latitude
                      ? <span className="text-xs text-green-600 flex items-center gap-1"><MapPin size={11} />{Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}</span>
                      : <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />Sin coordenadas</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{l.geofence_radius ? `${l.geofence_radius}m` : "300m"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setCoordsModal(l)} className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 flex items-center gap-1">
                      <Settings size={11} />{l.latitude ? "Editar" : "Configurar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {registerModal && (
        <RegisterFaceModal
          employee={registerModal}
          onClose={() => setRegisterModal(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["fichaje-employees"] }); setRegisterModal(null); }}
        />
      )}
      {coordsModal && (
        <SetCoordsModal
          local={coordsModal}
          onClose={() => setCoordsModal(null)}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ["locals-with-coords"] }); }}
        />
      )}
    </div>
  );
}
