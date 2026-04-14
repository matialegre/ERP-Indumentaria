import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Activity,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  TrendingUp,
  Thermometer,
} from "lucide-react";

/* -----------------------------------------------------------------
   SVG Arc Gauge - termometro circular
   value: 0-100    size: px    label: string    unit: string
------------------------------------------------------------------ */
function ArcGauge({ value = 0, label = "", unit = "%", size = 130, showHistory = [] }) {
  const r = (size / 2) * 0.72;
  const cx = size / 2;
  const cy = size / 2;

  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;

  const polarToXY = (angleDeg, radius) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const describeArc = (startDeg, endDeg, radius) => {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const pct = Math.min(100, Math.max(0, value));
  const fillEnd = startAngle + (pct / 100) * totalAngle;

  const strokeColor =
    pct > 90 ? "#ef4444" :
    pct > 75 ? "#f97316" :
    pct > 60 ? "#eab308" :
    "#3b82f6";

  const ticks = [0, 25, 50, 75, 100].map((t) => {
    const angle = startAngle + (t / 100) * totalAngle;
    const inner = polarToXY(angle, r - 8);
    const outer = polarToXY(angle, r + 2);
    return { inner, outer, t };
  });

  const hist = showHistory.slice(-20);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <path d={describeArc(startAngle, endAngle, r)} fill="none" stroke="#e5e7eb" strokeWidth={10} strokeLinecap="round" />
        {pct > 0 && (
          <path d={describeArc(startAngle, fillEnd, r)} fill="none" stroke={strokeColor} strokeWidth={10} strokeLinecap="round"
            style={{ transition: "stroke 0.5s" }} />
        )}
        {ticks.map(({ inner, outer, t }) => (
          <line key={t} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#9ca3af" strokeWidth={1.5} />
        ))}
        {(() => {
          const needleAngle = startAngle + (pct / 100) * totalAngle;
          const tip = polarToXY(needleAngle, r - 4);
          const base = polarToXY(needleAngle + 180, 8);
          return (
            <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke={strokeColor}
              strokeWidth={2.5} strokeLinecap="round" style={{ transition: "all 0.5s" }} />
          );
        })()}
        <circle cx={cx} cy={cy} r={5} fill={strokeColor} style={{ transition: "fill 0.5s" }} />
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={size * 0.18} fontWeight="700" fill="#111827">
          {typeof value === "number" ? (value < 10 ? value.toFixed(1) : Math.round(value)) : "?"}
        </text>
        <text x={cx} y={cy + 36} textAnchor="middle" fontSize={size * 0.09} fill="#6b7280">{unit}</text>
      </svg>

      {hist.length > 2 && (
        <svg width={size * 0.8} height={24} className="mt-1">
          <polyline
            points={hist.map((v, i) => `${(i / (hist.length - 1)) * size * 0.8},${24 - (v / 100) * 20}`).join(" ")}
            fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7}
          />
        </svg>
      )}

      <p className="text-xs font-medium text-gray-600 mt-0.5 text-center px-1">{label}</p>
    </div>
  );
}

/* Alert badge */
function AlertBadge({ level }) {
  if (level === "critical")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Critico</span>;
  if (level === "warning")
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3" /> Advertencia</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> OK</span>;
}

/* Mini stat */
function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-semibold text-sm ${highlight ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}

const SCALE_TIERS = [
  { tier: 1, label: "Arranque", users: "1-50", cost: "$30-65/mes", desc: "1 VPS todo junto" },
  { tier: 2, label: "Crecimiento", users: "50-200", cost: "$120-180/mes", desc: "VPS mas grande + PgBouncer" },
  { tier: 3, label: "Limite", users: "~200-300", cost: "Evaluar", desc: "Techo de 1 servidor" },
  { tier: 4, label: "Distribuido", users: "300-500+", cost: "$350-500/mes", desc: "Load balancer + multiples servidores" },
];

/* ===================================================
   PAGE
=================================================== */
export default function MonitoreoPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const historyRef = useRef({ cpu: [], ram: [], disk: [], gpu: [] });
  const [, forceUpdate] = useState(0);

  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: ["system-metrics"],
    queryFn: () => api.get("/system/metrics"),
    refetchInterval: autoRefresh ? 8000 : false,
    retry: 1,
  });

  useEffect(() => {
    if (!metrics) return;
    const h = historyRef.current;
    const push = (arr, val) => { arr.push(val); if (arr.length > 40) arr.shift(); };
    push(h.cpu, metrics.system.cpu_percent);
    push(h.ram, metrics.system.ram_percent);
    push(h.disk, metrics.system.disk_percent);
    const g = metrics.gpu?.available && metrics.gpu.gpus?.[0];
    if (g) push(h.gpu, g.utilization_pct);
    forceUpdate((n) => n + 1);
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Monitoreo del Sistema</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 font-medium">No se pudieron obtener las metricas</p>
          <p className="text-red-500 text-sm mt-1">Verifica que el backend este corriendo</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { system: sys, gpu, database: db, api: apiMetrics, alerts, scale_recommendation: scale } = metrics;
  const hist = historyRef.current;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termometro del Sistema</h1>
          <p className="text-sm text-gray-500">Diagnostico en tiempo real · auto-refresh cada 8s</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} className="rounded border-gray-300" />
            Auto-refresh
          </label>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
              a.level === "critical" ? "bg-red-50 border-red-200" :
              a.level === "warning" ? "bg-yellow-50 border-yellow-200" :
              "bg-green-50 border-green-200"
            }`}>
              <AlertBadge level={a.level} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900">{a.signal}</p>
                <p className="text-xs text-gray-600 mt-0.5">{a.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gauges */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-sm text-gray-700 mb-6 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-blue-600" /> Recursos del Servidor
        </h3>
        <div className={`grid gap-6 justify-items-center ${gpu?.available ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
          <ArcGauge value={sys.cpu_percent} label={`CPU \u00b7 ${sys.cpu_count} cores`} unit="%" showHistory={hist.cpu} />
          <ArcGauge value={sys.ram_percent} label={`RAM \u00b7 ${sys.ram_used_gb}/${sys.ram_total_gb} GB`} unit="%" showHistory={hist.ram} />
          <ArcGauge value={sys.disk_percent} label={`Disco \u00b7 ${sys.disk_used_gb}/${sys.disk_total_gb} GB`} unit="%" showHistory={hist.disk} />
          {gpu?.available && gpu.gpus?.[0] && (
            <ArcGauge value={gpu.gpus[0].utilization_pct} label={`GPU \u00b7 ${gpu.gpus[0].name?.split(" ").slice(-2).join(" ")}`} unit="%" showHistory={hist.gpu} />
          )}
        </div>

        {gpu?.available && gpu.gpus?.map((g, i) => (
          <div key={i} className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="GPU" value={g.name} />
            <Stat label="VRAM usada" value={`${g.memory_used_mb} / ${g.memory_total_mb} MB`} />
            <Stat label="VRAM %" value={`${g.memory_pct}%`}
              highlight={g.memory_pct > 90 ? "text-red-600" : g.memory_pct > 75 ? "text-yellow-600" : "text-green-600"} />
            <Stat label="Temperatura" value={`${g.temperature_c}\u00b0C`}
              highlight={g.temperature_c > 85 ? "text-red-600" : g.temperature_c > 70 ? "text-yellow-600" : "text-gray-900"} />
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
          <span>{sys.os} \u00b7 {sys.hostname}</span>
          <span>Uptime: {sys.uptime_hours}h</span>
        </div>
      </div>

      {/* DB + API */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-sm text-gray-700">Base de Datos (PostgreSQL)</h3>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${db.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {db.status === "ok" ? "Conectada" : "Error"}
            </span>
          </div>
          {db.status === "ok" ? (
            <div className="flex items-center gap-4">
              <ArcGauge value={Math.min(100, (db.ping_ms / 200) * 100)} label="Latencia DB" unit="ms" size={110} />
              <div className="flex-1 grid grid-cols-2 gap-3">
                <Stat label="Ping" value={`${db.ping_ms}ms`} highlight={db.ping_ms > 50 ? "text-yellow-600" : "text-green-600"} />
                <Stat label="Conexiones activas" value={db.active_connections} />
                <Stat label="Conexiones totales" value={db.total_connections} />
                <Stat label="Tama\u00f1o DB" value={db.db_size} />
                <Stat label="Cache Hit" value={`${db.cache_hit_ratio}%`}
                  highlight={db.cache_hit_ratio < 90 ? "text-yellow-600" : "text-green-600"} />
                {db.slow_query_ms > 0 && (
                  <Stat label="Query lenta" value={`${db.slow_query_ms}ms`}
                    highlight={db.slow_query_ms > 500 ? "text-red-600" : "text-yellow-600"} />
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-600 text-sm">{db.error}</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-sm text-gray-700">API (ultimos 5 min)</h3>
          </div>
          <div className="flex items-center gap-4">
            <ArcGauge value={Math.min(100, (apiMetrics.avg_response_ms / 1000) * 100)} label="Resp. promedio" unit="ms" size={110} />
            <div className="flex-1 grid grid-cols-2 gap-3">
              <Stat label="Requests" value={apiMetrics.total_requests} />
              <Stat label="Req/seg" value={apiMetrics.requests_per_second} />
              <Stat label="Promedio" value={`${apiMetrics.avg_response_ms}ms`}
                highlight={apiMetrics.avg_response_ms > 500 ? "text-red-600" : apiMetrics.avg_response_ms > 200 ? "text-yellow-600" : "text-green-600"} />
              <Stat label="P95" value={`${apiMetrics.p95_ms}ms`}
                highlight={apiMetrics.p95_ms > 500 ? "text-red-600" : "text-gray-900"} />
              <Stat label="Lentos >500ms" value={apiMetrics.slow_requests}
                highlight={apiMetrics.slow_requests > 0 ? "text-yellow-600" : "text-green-600"} />
              <Stat label="Errores 5xx" value={apiMetrics.error_count}
                highlight={apiMetrics.error_count > 0 ? "text-red-600" : "text-green-600"} />
            </div>
          </div>
        </div>
      </div>

      {/* Top endpoints */}
      {apiMetrics.by_endpoint?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-sm text-gray-700">Top Endpoints por Tiempo de Respuesta</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/30">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Endpoint</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Requests</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Promedio</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Maximo</th>
                </tr>
              </thead>
              <tbody>
                {[...apiMetrics.by_endpoint]
                  .sort((a, b) => b.avg_ms - a.avg_ms)
                  .map((ep, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{ep.endpoint}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{ep.count}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${ep.avg_ms > 500 ? "text-red-600" : ep.avg_ms > 200 ? "text-yellow-600" : "text-gray-700"}`}>
                        {ep.avg_ms}ms
                      </td>
                      <td className={`px-4 py-2 text-right ${ep.max_ms > 1000 ? "text-red-600" : "text-gray-500"}`}>
                        {ep.max_ms}ms
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scale Recommendation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-700">Plan de Escalabilidad</h3>
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          scale.urgency === "alta" ? "border-red-300 bg-red-50" :
          scale.urgency === "media" ? "border-yellow-300 bg-yellow-50" :
          "border-green-300 bg-green-50"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Estado actual: {scale.label}</p>
              <p className="text-sm text-gray-600 mt-1">{scale.description}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{scale.cost}</p>
              <p className={`text-xs font-medium ${
                scale.urgency === "alta" ? "text-red-600" :
                scale.urgency === "media" ? "text-yellow-600" :
                scale.urgency === "ninguna" ? "text-green-600" : "text-blue-600"
              }`}>Urgencia: {scale.urgency}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SCALE_TIERS.map((t) => (
            <div key={t.tier} className={`p-3 rounded-lg border ${
              scale.current_tier === t.tier ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200" : "border-gray-200 bg-gray-50"
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  scale.current_tier === t.tier ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-600"
                }`}>{t.tier}</span>
                <span className="font-semibold text-sm">{t.label}</span>
              </div>
              <p className="text-xs text-gray-600">{t.desc}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">{t.users} usuarios</span>
                <span className="text-xs font-semibold text-gray-700">{t.cost}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
