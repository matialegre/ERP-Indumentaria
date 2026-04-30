import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  MessageSquare,
  RefreshCw,
  Wifi,
  WifiOff,
  Play,
  Square,
  Send,
  SendHorizonal,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  BarChart2,
  AlertTriangle,
  Settings2,
  Save,
  Bot,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────
function pctColor(pct) {
  if (pct >= 100) return "text-green-600 bg-green-50";
  if (pct >= 80)  return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

function barColor(pct) {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 80)  return "bg-yellow-400";
  return "bg-red-500";
}

function PctBadge({ pct }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pctColor(pct)}`}>
      {pct}%
    </span>
  );
}

// ─── card de local ────────────────────────────────────────────────────────────
function LocalCard({ local, onEnviar, sending }) {
  const [expanded, setExpanded] = useState(false);
  const pct = local.avance_pct ?? 0;

  const estadoIcon = pct >= 100
    ? <CheckCircle size={16} className="text-green-500" />
    : pct >= 80
    ? <Minus size={16} className="text-yellow-500" />
    : <TrendingDown size={16} className="text-red-500" />;

  const diasDatos = Object.entries(local.por_dia || {});

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {estadoIcon}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{local.nombre}</p>
            <p className="text-xs text-gray-400">+{local.whatsapp}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {local.scraping_ok === false && (
            <span title="Dato anterior — el scraping falló en la última actualización">
              <AlertTriangle size={14} className="text-yellow-500" />
            </span>
          )}
          <PctBadge pct={pct} />
          <button
            onClick={() => onEnviar(local.nombre)}
            disabled={sending}
            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 disabled:opacity-40 transition"
            title="Enviar mensaje WhatsApp"
          >
            <SendHorizonal size={15} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 transition"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{local.socios_actuales}</p>
          <p className="text-xs text-gray-400">socios</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{local.objetivo_mes}</p>
          <p className="text-xs text-gray-400">objetivo</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{local.faltan}</p>
          <p className="text-xs text-gray-400">faltan</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${local.ritmo_necesario > local.ritmo_ideal ? "text-red-600" : "text-green-600"}`}>
            {local.ritmo_necesario}
          </p>
          <p className="text-xs text-gray-400">xdía</p>
        </div>
      </div>

      {/* Expandido: tickets + por_dia */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Tickets del mes</p>
              <p className="font-bold text-gray-800">{local.tickets_mes}</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Tickets ayer</p>
              <p className="font-bold text-gray-800">{local.tickets_ayer}</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Ritmo ideal</p>
              <p className="font-bold text-gray-800">{local.ritmo_ideal}/día</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Días restantes</p>
              <p className="font-bold text-gray-800">{local.dias_restantes}</p>
            </div>
          </div>

          {diasDatos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                <BarChart2 size={13} /> Socios por día
              </p>
              <div className="flex flex-wrap gap-1.5">
                {diasDatos.map(([dia, cant]) => (
                  <span key={dia} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {dia}: {cant}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QR Modal ────────────────────────────────────────────────────────────────
function QRModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Escanear QR de WhatsApp</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="p-4">
          <iframe
            src="/api/v1/socios/wa/qr"
            className="w-full h-96 rounded-lg border-0"
            title="WhatsApp QR"
          />
          <p className="text-xs text-gray-400 text-center mt-3">
            Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Log Modal ────────────────────────────────────────────────────────────────
function LogModal({ log, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Log de mensajes enviados</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {log.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No hay mensajes enviados aún</p>
          ) : (
            [...log].reverse().map((item, i) => (
              <div key={i} className={`p-3 rounded-xl border text-sm ${item.enviado ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-800">{item.local}</span>
                  <div className="flex items-center gap-2">
                    {item.enviado
                      ? <CheckCircle size={14} className="text-green-500" />
                      : <XCircle size={14} className="text-red-500" />
                    }
                    <span className="text-xs text-gray-400">{item.fecha}</span>
                  </div>
                </div>
                <p className="text-gray-600 whitespace-pre-wrap text-xs leading-relaxed">{item.mensaje}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mensajes Config Modal ────────────────────────────────────────────────────
function MensajesConfigModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: configData, isLoading } = useQuery({
    queryKey: ["socios-mensajes-config"],
    queryFn: () => api.get("/socios/mensajes-config"),
  });

  useEffect(() => {
    if (configData && !form) setForm(configData);
  }, [configData]);

  const saveMut = useMutation({
    mutationFn: (data) => api.put("/socios/mensajes-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socios-mensajes-config"] });
      onClose();
    },
  });

  const FIELDS = [
    {
      key: "msg_positivo",
      label: "Mensaje — Objetivo cumplido (pct >= 100%)",
      color: "border-green-300 bg-green-50",
      badge: "text-green-700 bg-green-100",
      emoji: "🟢",
    },
    {
      key: "msg_neutral",
      label: "Mensaje — Cerca del objetivo (80–99%)",
      color: "border-yellow-300 bg-yellow-50",
      badge: "text-yellow-700 bg-yellow-100",
      emoji: "🟡",
    },
    {
      key: "msg_atrasado",
      label: "Mensaje — Atrasado (< 80%)",
      color: "border-red-300 bg-red-50",
      badge: "text-red-700 bg-red-100",
      emoji: "🔴",
    },
    {
      key: "bot_auto_reply",
      label: "Respuesta automática del bot",
      color: "border-blue-300 bg-blue-50",
      badge: "text-blue-700 bg-blue-100",
      emoji: "🤖",
    },
  ];

  const PLACEHOLDER_VARS = "{nombre}, {socios_actuales}, {objetivo_mes}, {faltan}, {dias_restantes}";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <MessageSquare size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Configurar Mensajes WhatsApp</h3>
              <p className="text-xs text-gray-400">Editá las plantillas que se envían a los locales</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {isLoading || !form ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Variables disponibles: </span>
                <code className="font-mono text-blue-700">{PLACEHOLDER_VARS}</code>
                <span className="ml-1">— Se reemplazan automáticamente en cada mensaje.</span>
              </div>

              {FIELDS.map(f => (
                <div key={f.key}>
                  <label className={`flex items-center gap-2 text-xs font-semibold mb-1.5 px-2 py-1 rounded-lg w-fit ${f.badge}`}>
                    <span>{f.emoji}</span>
                    {f.label}
                  </label>
                  <textarea
                    rows={f.key === "bot_auto_reply" ? 3 : 5}
                    value={form[f.key] ?? ""}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className={`w-full px-3 py-2.5 border-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono leading-relaxed ${f.color}`}
                    placeholder={`Plantilla de mensaje para este caso...`}
                  />
                </div>
              ))}

              {/* Bot auto-reply note */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <Bot size={14} className="mt-0.5 shrink-0" />
                <p>
                  La respuesta automática del bot se mostrará aquí como referencia. Para activarla en WhatsApp,
                  configurá esta respuesta directamente en el bot de WhatsApp Business.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => form && saveMut.mutate(form)}
            disabled={saveMut.isPending || !form}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
          >
            <Save size={15} />
            {saveMut.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function SociosMontagnePage() {
  const qc = useQueryClient();
  const [showQR, setShowQR]     = useState(false);
  const [showLog, setShowLog]   = useState(false);
  const [showMensajesConfig, setShowMensajesConfig] = useState(false);
  const [sending, setSending]   = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const prevTimestampRef = useRef(null);

  const { data: estado, isLoading } = useQuery({
    queryKey: ["socios-estado"],
    queryFn:  () => api.get("/socios/estado"),
    refetchInterval: actualizando ? 10000 : 60000,
  });

  // Dejar de polling cuando cambia la timestamp de actualización
  useEffect(() => {
    if (actualizando && estado?.ultima_actualizacion && estado.ultima_actualizacion !== prevTimestampRef.current) {
      setActualizando(false);
    }
  }, [estado?.ultima_actualizacion, actualizando]);

  const { data: waStatus, refetch: refetchWA } = useQuery({
    queryKey: ["socios-wa-status"],
    queryFn:  () => api.get("/socios/wa/status"),
    refetchInterval: showQR ? 3000 : 15000,
  });

  const { data: log } = useQuery({
    queryKey: ["socios-log"],
    queryFn:  () => api.get("/socios/log"),
  });

  const mutActualizar = useMutation({
    mutationFn: () => api.post("/socios/actualizar"),
    onSuccess: () => {
      prevTimestampRef.current = estado?.ultima_actualizacion ?? null;
      setActualizando(true);
      // Primer refresco rápido a los 15s, luego el polling de 10s toma el control
      setTimeout(() => qc.invalidateQueries(["socios-estado"]), 15000);
    },
  });

  const mutWAStart = useMutation({
    mutationFn: () => api.post("/socios/wa/start"),
    onSuccess:  () => {
      setShowQR(true);
      setTimeout(() => refetchWA(), 1500);
    },
  });

  const mutWAStop = useMutation({
    mutationFn: () => api.post("/socios/wa/stop"),
    onSuccess:  () => refetchWA(),
  });

  const mutEnviarTodos = useMutation({
    mutationFn: () => api.post("/socios/enviar-todos"),
    onSuccess:  () => {
      setSending(false);
      qc.invalidateQueries(["socios-log"]);
    },
  });

  const handleEnviarLocal = async (nombre) => {
    setSending(true);
    try {
      await api.post(`/socios/enviar/${encodeURIComponent(nombre)}`);
      qc.invalidateQueries(["socios-log"]);
    } finally {
      setSending(false);
    }
  };

  const locales   = estado?.locales ?? [];
  const waListo   = waStatus?.wa_listo ?? false;
  const waRunning = waStatus?.proceso_corriendo ?? false;
  const waConnecting = waStatus?.conectandose ?? false;
  const waTieneQR = waStatus?.tiene_qr ?? false;

  // Stats globales
  const totalSocios   = locales.reduce((s, l) => s + (l.socios_actuales ?? 0), 0);
  const totalObjetivo = locales.reduce((s, l) => s + (l.objetivo_mes ?? 0), 0);
  const totalFaltan   = locales.reduce((s, l) => s + (l.faltan ?? 0), 0);
  const pctGlobal     = totalObjetivo > 0 ? Math.round(totalSocios / totalObjetivo * 100) : 0;

  const enVerde    = locales.filter(l => (l.avance_pct ?? 0) >= 100).length;
  const enRiesgo   = locales.filter(l => (l.avance_pct ?? 0) >= 80 && (l.avance_pct ?? 0) < 100).length;
  const atrasados  = locales.filter(l => (l.avance_pct ?? 0) < 80).length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Altas Montagne</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Seguimiento de carga de socios por franquicia
            {estado?.ultima_actualizacion && (
              <span className="ml-2 text-gray-400">· actualizado {estado.ultima_actualizacion}</span>
            )}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {/* WhatsApp status */}
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${waListo ? "bg-green-50 border-green-200 text-green-700" : waTieneQR ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
            {waListo ? <Wifi size={15} /> : waTieneQR ? <Wifi size={15} /> : <WifiOff size={15} />}
            {waListo ? "WhatsApp conectado" : waTieneQR ? "QR listo para escanear" : waConnecting || waRunning ? "WA iniciando..." : "WA desconectado"}
          </div>

          {!waRunning ? (
            <button
              onClick={() => mutWAStart.mutate()}
              disabled={mutWAStart.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 transition"
            >
              <Play size={15} />
              Iniciar WhatsApp
            </button>
          ) : (
            <>
              {!waListo && (
                <button
                  onClick={() => setShowQR(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition"
                >
                  Ver QR
                </button>
              )}
              <button
                onClick={() => mutWAStop.mutate()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition"
              >
                <Square size={13} />
                Detener
              </button>
            </>
          )}

          <button
            onClick={() => mutActualizar.mutate()}
            disabled={mutActualizar.isPending || actualizando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-60 transition"
            title={actualizando ? "El scraping tarda ~2 minutos en completarse" : ""}
          >
            <RefreshCw size={15} className={(mutActualizar.isPending || actualizando) ? "animate-spin" : ""} />
            {actualizando ? "Scrapeando (~2 min)..." : "Actualizar datos"}
          </button>

          <button
            onClick={() => { setSending(true); mutEnviarTodos.mutate(); }}
            disabled={!waListo || mutEnviarTodos.isPending || sending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition"
          >
            <Send size={15} />
            Enviar a todos
          </button>

          <button
            onClick={() => { setShowLog(true); qc.invalidateQueries(["socios-log"]); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition"
          >
            <Clock size={15} />
            Ver log
          </button>

          <button
            onClick={() => setShowMensajesConfig(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition"
            title="Editar plantillas de mensajes WhatsApp"
          >
            <Settings2 size={15} />
            Mensajes
          </button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalSocios}</p>
          <p className="text-xs text-gray-400 mt-0.5">socios totales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalObjetivo}</p>
          <p className="text-xs text-gray-400 mt-0.5">objetivo total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${pctGlobal >= 75 ? "text-green-600" : pctGlobal >= 40 ? "text-yellow-600" : "text-red-600"}`}>
            {pctGlobal}%
          </p>
          <p className="text-xs text-gray-400 mt-0.5">avance global</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{totalFaltan}</p>
          <p className="text-xs text-gray-400 mt-0.5">faltan total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center col-span-2 md:col-span-1">
          <div className="flex justify-center gap-3 text-sm font-semibold">
            <span className="text-green-600">✓{enVerde}</span>
            <span className="text-yellow-600">~{enRiesgo}</span>
            <span className="text-red-600">✗{atrasados}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">verde / riesgo / atrasado</p>
        </div>
      </div>

      {/* Locales */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : locales.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Sin datos todavía</p>
          <p className="text-sm mt-1">Hacé clic en "Actualizar datos" para cargar la información de los locales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...locales].sort((a, b) => (a.avance_pct ?? 0) - (b.avance_pct ?? 0)).map((local) => (
            <LocalCard
              key={local.nombre}
              local={local}
              onEnviar={handleEnviarLocal}
              sending={sending}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showQR  && <QRModal  onClose={() => setShowQR(false)} />}
      {showLog && <LogModal log={log ?? []} onClose={() => setShowLog(false)} />}
      {showMensajesConfig && <MensajesConfigModal onClose={() => setShowMensajesConfig(false)} />}
    </div>
  );
}
