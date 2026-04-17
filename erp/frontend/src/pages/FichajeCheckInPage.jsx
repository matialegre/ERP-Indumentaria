/**
 * FichajeCheckIn — Página de fichaje para empleados.
 * Captura selfie con face-api.js + GPS, envía al backend.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Camera, MapPin, CheckCircle2, XCircle, Loader2,
  Clock, LogIn, LogOut, AlertTriangle, RefreshCw,
} from "lucide-react";

// ── face-api lazy loader ─────────────────────────────────────────────────────
let faceApiModule = null;
let modelsLoaded = false;

async function loadFaceApi() {
  if (!faceApiModule) {
    faceApiModule = await import("@vladmandic/face-api");
  }
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

// ── GPS helper ───────────────────────────────────────────────────────────────
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("GPS no disponible"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </div>
  );
}

// ── Timeline entry ────────────────────────────────────────────────────────────
function TimelineEntry({ type, time, status }) {
  const isEntrada = type === "ENTRADA";
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isEntrada ? "bg-green-100" : "bg-orange-100"}`}>
        {isEntrada ? <LogIn size={14} className="text-green-600" /> : <LogOut size={14} className="text-orange-600" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{isEntrada ? "Entrada" : "Salida"}</p>
        <p className="text-xs text-gray-400">{new Date(time).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        status === "OK" ? "bg-green-100 text-green-700" :
        status === "FACE_FAIL" ? "bg-red-100 text-red-600" :
        status === "LOCATION_FAIL" ? "bg-orange-100 text-orange-700" :
        "bg-gray-100 text-gray-500"
      }`}>{status}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function FichajeCheckInPage() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [step, setStep] = useState("idle"); // idle | loading-models | camera | capturing | processing | done | error
  const [checkInType, setCheckInType] = useState("ENTRADA");
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [gpsData, setGpsData] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const streamRef = useRef(null);

  // Historial del día
  const { data: historialData, refetch: refetchHistory } = useQuery({
    queryKey: ["fichaje-my-today"],
    queryFn: () => api.get("/fichaje/my-today"),
    staleTime: 10_000,
  });
  const historial = historialData?.fichajes ?? [];

  // Último fichaje para determinar si es entrada o salida
  useEffect(() => {
    if (historial.length > 0) {
      const last = historial[0];
      setCheckInType(last.checkin_type === "ENTRADA" ? "SALIDA" : "ENTRADA");
    }
  }, [historial]);

  // Carga de modelos
  const initModels = useCallback(async () => {
    if (modelsReady) return;
    setLoadingModels(true);
    try {
      await loadFaceApi();
      setModelsReady(true);
    } catch (e) {
      setErrorMsg("Error cargando modelos de IA: " + e.message);
    } finally {
      setLoadingModels(false);
    }
  }, [modelsReady]);

  // Precarga GPS y modelos en background al montar
  useEffect(() => {
    initModels();
    getGPS().then(setGpsData).catch((e) => setGpsError(e.message));
    return () => stopCamera();
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setStep("camera");
    } catch (e) {
      setErrorMsg("No se pudo acceder a la cámara: " + e.message);
      setStep("error");
    }
  }

  const checkinMutation = useMutation({
    mutationFn: (body) => api.post("/fichaje/checkin", body),
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      stopCamera();
      refetchHistory();
    },
    onError: (e) => {
      setErrorMsg(e.message || "Error al registrar fichaje");
      setStep("error");
    },
  });

  async function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return;
    setStep("capturing");

    try {
      // Re-read GPS
      let gps = gpsData;
      try { gps = await getGPS(); setGpsData(gps); } catch {}

      const faceApi = await loadFaceApi();
      const detection = await faceApi.detectSingleFace(
        videoRef.current,
        new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
      ).withFaceLandmarks(true).withFaceDescriptor();

      setStep("processing");

      let faceDescriptor = null;
      if (detection) {
        faceDescriptor = Array.from(detection.descriptor);
      }

      // Draw snapshot on canvas
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      checkinMutation.mutate({
        checkin_type: checkInType,
        latitude: gps?.latitude ?? null,
        longitude: gps?.longitude ?? null,
        face_descriptor: faceDescriptor,
        local_id: user?.local_id ?? null,
      });
    } catch (e) {
      setErrorMsg("Error procesando cara: " + e.message);
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setResult(null);
    setErrorMsg(null);
    stopCamera();
  }

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="max-w-md mx-auto space-y-5">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {greet()}, {user?.full_name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          {" · "}
          {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Status indicators */}
      <div className="flex gap-2 justify-center flex-wrap">
        <StatusBadge ok={modelsReady} label={modelsReady ? "IA lista" : loadingModels ? "Cargando IA..." : "IA no cargada"} />
        <StatusBadge ok={!!gpsData} label={gpsData ? `GPS ±${Math.round(gpsData.accuracy ?? 999)}m` : gpsError ? "GPS no disponible" : "Esperando GPS..."} />
      </div>

      {/* Type toggle */}
      {step === "idle" && (
        <div className="flex bg-gray-100 rounded-xl p-1">
          {["ENTRADA", "SALIDA"].map((t) => (
            <button
              key={t}
              onClick={() => setCheckInType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                checkInType === t
                  ? t === "ENTRADA" ? "bg-green-500 text-white shadow" : "bg-orange-500 text-white shadow"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "ENTRADA" ? <LogIn size={15} /> : <LogOut size={15} />}
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Camera area */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
        {(step === "idle" || step === "camera" || step === "capturing") && (
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
            playsInline
            muted
          />
        )}
        {step === "done" && canvasRef.current && (
          <canvas ref={canvasRef} className="w-full h-full object-cover" />
        )}

        {/* Overlay when idle */}
        {step === "idle" && !cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Camera size={36} className="text-white" />
            </div>
            <p className="text-sm text-white/70">Cámara inactiva</p>
          </div>
        )}

        {/* Face guide overlay */}
        {step === "camera" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-2 border-white/60 rounded-full" />
          </div>
        )}

        {/* Processing overlay */}
        {(step === "capturing" || step === "processing") && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <Loader2 size={40} className="text-white animate-spin" />
            <p className="text-white text-sm">{step === "capturing" ? "Detectando cara..." : "Procesando..."}</p>
          </div>
        )}

        {/* Done overlay */}
        {step === "done" && result && (
          <div className={`absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              result.status === "OK" ? "bg-green-500" : "bg-orange-500"
            }`}>
              {result.status === "OK"
                ? <CheckCircle2 size={32} className="text-white" />
                : <AlertTriangle size={32} className="text-white" />
              }
            </div>
            <p className="text-white font-bold text-lg">
              {result.status === "OK" ? "¡Fichaje registrado!" : "Fichaje con alertas"}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {step === "error" && (
          <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-3 p-4">
            <XCircle size={40} className="text-white" />
            <p className="text-white text-sm text-center">{errorMsg}</p>
          </div>
        )}

        {/* Hidden canvas for snapshot */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {step === "idle" && (
          <button
            onClick={startCamera}
            disabled={!modelsReady}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loadingModels ? <><Loader2 size={18} className="animate-spin" /> Cargando IA...</> : <><Camera size={18} /> Abrir cámara</>}
          </button>
        )}

        {step === "camera" && (
          <button
            onClick={handleCapture}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
              checkInType === "ENTRADA" ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {checkInType === "ENTRADA" ? <LogIn size={22} /> : <LogOut size={22} />}
            Fichar {checkInType}
          </button>
        )}

        {(step === "done" || step === "error") && (
          <button
            onClick={reset}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium flex items-center justify-center gap-2 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Nuevo fichaje
          </button>
        )}
      </div>

      {/* Result details */}
      {step === "done" && result && (
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalle del fichaje</h3>
          <div className="flex flex-wrap gap-2">
            {result.face_match_score !== null && result.face_match_score !== undefined && (
              <StatusBadge
                ok={result.face_verified}
                label={`Cara: ${result.face_verified ? `${Math.round(result.face_match_score * 100)}% coincidencia` : "No reconocida"}`}
              />
            )}
            {result.location_verified !== null && result.location_verified !== undefined && (
              <StatusBadge
                ok={result.location_verified}
                label={result.distance_to_local != null
                  ? `Ubicación: ${result.distance_to_local < 1000 ? `${result.distance_to_local}m` : `${(result.distance_to_local/1000).toFixed(1)}km`}`
                  : "Ubicación"
                }
              />
            )}
            {result.face_match_score === null && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                <AlertTriangle size={12} />
                Sin cara registrada
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline del día */}
      {historial.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Fichajes de hoy</h3>
          </div>
          <div className="space-y-3">
            {historial.map((f) => (
              <TimelineEntry key={f.id} type={f.checkin_type} time={f.created_at} status={f.status} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
