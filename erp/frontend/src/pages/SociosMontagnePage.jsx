import { useState } from "react";
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
            src="http://localhost:3456/qr"
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

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function SociosMontagnePage() {
  const qc = useQueryClient();
  const [showQR, setShowQR]   = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: estado, isLoading } = useQuery({
    queryKey: ["socios-estado"],
    queryFn:  () => api.get("/socios/estado"),
    refetchInterval: 60000,
  });

  const { data: waStatus, refetch: refetchWA } = useQuery({
    queryKey: ["socios-wa-status"],
    queryFn:  () => api.get("/socios/wa/status"),
    refetchInterval: 15000,
  });

  const { data: log } = useQuery({
    queryKey: ["socios-log"],
    queryFn:  () => api.get("/socios/log"),
  });

  const mutActualizar = useMutation({
    mutationFn: () => api.post("/socios/actualizar"),
    onSuccess:  () => setTimeout(() => qc.invalidateQueries(["socios-estado"]), 3000),
  });

  const mutWAStart = useMutation({
    mutationFn: () => api.post("/socios/wa/start"),
    onSuccess:  () => setTimeout(() => refetchWA(), 3000),
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
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${waListo ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
            {waListo ? <Wifi size={15} /> : <WifiOff size={15} />}
            {waListo ? "WhatsApp conectado" : waRunning ? "WA iniciando..." : "WA desconectado"}
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
            disabled={mutActualizar.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 disabled:opacity-60 transition"
          >
            <RefreshCw size={15} className={mutActualizar.isPending ? "animate-spin" : ""} />
            {mutActualizar.isPending ? "Actualizando..." : "Actualizar datos"}
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
    </div>
  );
}
