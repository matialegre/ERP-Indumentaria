import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  DollarSign,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  Award,
  Search,
  Download,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesAnterior() {
  const hoy = new Date();
  const primerDiaEsteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDiaMesAnterior = new Date(primerDiaEsteMes - 1);
  const primerDiaMesAnterior = new Date(ultimoDiaMesAnterior.getFullYear(), ultimoDiaMesAnterior.getMonth(), 1);
  return {
    desde: primerDiaMesAnterior.toISOString().slice(0, 10),
    hasta: ultimoDiaMesAnterior.toISOString().slice(0, 10),
  };
}

function formatPeso(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
}

function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function mesesDisponibles() {
  const meses = [];
  const hoy = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    meses.push({
      label: d.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
      desde: d.toISOString().slice(0, 10),
      hasta: ultimo.toISOString().slice(0, 10),
    });
  }
  return meses;
}

// ── Componentes menores ───────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function DetalleVendedor({ vendedor, desde, hasta }) {
  const { data, isLoading } = useQuery({
    queryKey: ["comisiones-detalle", vendedor, desde, hasta],
    queryFn: () => api.get(`/comisiones/detalle/${encodeURIComponent(vendedor)}?desde=${desde}&hasta=${hasta}`),
    enabled: !!vendedor,
  });

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center">
        <div className="animate-spin h-5 w-5 rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const tickets = data?.tickets || [];
  const conComision = tickets.filter((t) => t.comision_ticket > 0);
  const sinComision = tickets.filter((t) => t.comision_ticket === 0);

  return (
    <div className="px-4 pb-4 pt-1">
      <div className="rounded-lg border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Comprobante</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-right">Artículos</th>
              <th className="px-3 py-2 text-right">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {conComision.map((t, i) => (
              <tr key={i} className="border-t border-gray-50 hover:bg-green-50/30">
                <td className="px-3 py-2 font-mono text-xs">{t.comprobante_numero}</td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{t.comprobante_tipo}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-gray-800">{t.cantidad_articulos}</td>
                <td className="px-3 py-2 text-right font-semibold text-green-600">{formatPeso(t.comision_ticket)}</td>
              </tr>
            ))}
            {sinComision.length > 0 && (
              <tr className="border-t border-gray-100">
                <td colSpan={4} className="px-3 py-1.5 text-xs text-gray-400 italic text-center">
                  + {sinComision.length} ticket{sinComision.length !== 1 ? "s" : ""} sin comisión (1 artículo)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ComisionesPage() {
  const defaultRange = mesAnterior();
  const meses = mesesDisponibles();

  const [desde, setDesde] = useState(defaultRange.desde);
  const [hasta, setHasta] = useState(defaultRange.hasta);
  const [mesLabel, setMesLabel] = useState(meses[0]?.label || "");
  const [modoPersonalizado, setModoPersonalizado] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["comisiones-resumen", desde, hasta],
    queryFn: () => api.get(`/comisiones/resumen?desde=${desde}&hasta=${hasta}`),
  });

  const vendedores = useMemo(() => {
    const list = data?.vendedores || [];
    if (!busqueda.trim()) return list;
    const q = busqueda.toLowerCase();
    return list.filter((v) => v.vendedor.toLowerCase().includes(q));
  }, [data, busqueda]);

  function seleccionarMes(mes) {
    setDesde(mes.desde);
    setHasta(mes.hasta);
    setMesLabel(mes.label);
    setModoPersonalizado(false);
    setExpandido(null);
  }

  function exportarCSV() {
    if (!vendedores.length) return;
    const header = "Vendedor,Tickets Totales,Tickets con Comisión,Total Artículos,Total Comisión\n";
    const rows = vendedores
      .map((v) => `"${v.vendedor}",${v.total_tickets},${v.tickets_con_comision},${v.total_articulos},${v.total_comision}`)
      .join("\n");
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comisiones_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const granTotal = data?.gran_total || 0;
  const totalVendedoresConComision = (data?.vendedores || []).filter((v) => v.total_comision > 0).length;
  const totalTickets = (data?.vendedores || []).reduce((s, v) => s + v.total_tickets, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award size={26} className="text-yellow-500" />
            Comisiones
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {modoPersonalizado
              ? `${formatFecha(desde)} — ${formatFecha(hasta)}`
              : mesLabel}
          </p>
        </div>
        <button
          onClick={exportarCSV}
          disabled={!vendedores.length}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition"
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {/* Selector de período */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calendar size={15} />
          Período
        </div>
        <div className="flex flex-wrap gap-2">
          {meses.map((m) => (
            <button
              key={m.desde}
              onClick={() => seleccionarMes(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition capitalize ${
                desde === m.desde && hasta === m.hasta && !modoPersonalizado
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => setModoPersonalizado(!modoPersonalizado)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              modoPersonalizado
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-600"
            }`}
          >
            Personalizado
          </button>
        </div>
        {modoPersonalizado && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => { setDesde(e.target.value); setExpandido(null); }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => { setHasta(e.target.value); setExpandido(null); }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={DollarSign} label="Total a pagar" value={formatPeso(granTotal)} color="bg-green-500" />
        <StatCard icon={Users} label="Vendedores con comisión" value={totalVendedoresConComision} color="bg-blue-500" />
        <StatCard icon={TrendingUp} label="Tickets procesados" value={totalTickets.toLocaleString("es-AR")} color="bg-purple-500" />
      </div>

      {/* Summary cards */}
      {vendedores && vendedores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Vendedores</p>
            <p className="text-2xl font-bold text-gray-900">{vendedores.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Total Comisiones</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatPeso(vendedores.reduce((s, c) => s + (c.total_comision || 0), 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Top Vendedor</p>
            <p className="text-lg font-bold text-gray-900 truncate">
              {vendedores[0]?.vendedor || '—'}
            </p>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar vendedor..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tabla de vendedores */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>Vendedor</span>
          <span className="text-right">Tickets</span>
          <span className="text-right hidden sm:block">Con comisión</span>
          <span className="text-right hidden sm:block">Artículos</span>
          <span className="text-right">Comisión</span>
          <span />
        </div>

        {isLoading && (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
            <span className="text-sm">Consultando SQL Server...</span>
          </div>
        )}

        {isError && (
          <div className="py-12 flex flex-col items-center gap-2 text-red-500">
            <FileText size={32} className="opacity-40" />
            <p className="text-sm font-medium">No se pudo conectar al servidor de datos</p>
            <p className="text-xs text-gray-400">{error?.message || "SQL Server no disponible"}</p>
          </div>
        )}

        {!isLoading && !isError && vendedores.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
            <Users size={32} className="opacity-30" />
            <p className="text-sm">No hay datos para el período seleccionado</p>
          </div>
        )}

        {!isLoading && !isError && vendedores.map((v, i) => (
          <div key={v.vendedor} className={i > 0 ? "border-t border-gray-50" : ""}>
            {/* Fila principal */}
            <button
              className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3.5 hover:bg-gray-50 transition text-left items-center"
              onClick={() => setExpandido(expandido === v.vendedor ? null : v.vendedor)}
            >
              {/* Nombre + medalla */}
              <div className="flex items-center gap-2 min-w-0">
                {i === 0 && v.total_comision > 0 && <span className="text-base">🥇</span>}
                {i === 1 && v.total_comision > 0 && <span className="text-base">🥈</span>}
                {i === 2 && v.total_comision > 0 && <span className="text-base">🥉</span>}
                {(i > 2 || v.total_comision === 0) && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                    {v.vendedor.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-gray-800 truncate text-sm">{v.vendedor}</span>
              </div>

              <span className="text-right text-sm text-gray-600">{v.total_tickets}</span>

              <span className="text-right text-sm text-gray-600 hidden sm:block">
                {v.tickets_con_comision > 0 ? (
                  <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                    {v.tickets_con_comision}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </span>

              <span className="text-right text-sm text-gray-600 hidden sm:block">{v.total_articulos}</span>

              <span className={`text-right font-bold text-sm ${v.total_comision > 0 ? "text-green-600" : "text-gray-400"}`}>
                {v.total_comision > 0 ? formatPeso(v.total_comision) : "—"}
              </span>

              <span className="text-gray-400">
                {expandido === v.vendedor ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>

            {/* Detalle expandido */}
            {expandido === v.vendedor && (
              <DetalleVendedor vendedor={v.vendedor} desde={desde} hasta={hasta} />
            )}
          </div>
        ))}

        {/* Fila total */}
        {!isLoading && !isError && vendedores.length > 0 && (
          <div className="border-t-2 border-gray-200 grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3.5 bg-green-50">
            <span className="font-bold text-gray-800 text-sm">TOTAL</span>
            <span className="text-right text-sm font-medium text-gray-600">
              {(data?.vendedores || []).reduce((s, v) => s + v.total_tickets, 0)}
            </span>
            <span className="text-right text-sm font-medium text-gray-600 hidden sm:block">
              {(data?.vendedores || []).reduce((s, v) => s + v.tickets_con_comision, 0)}
            </span>
            <span className="text-right text-sm font-medium text-gray-600 hidden sm:block">
              {(data?.vendedores || []).reduce((s, v) => s + v.total_articulos, 0)}
            </span>
            <span className="text-right font-bold text-green-700 text-base">{formatPeso(granTotal)}</span>
            <span />
          </div>
        )}
      </div>

      {/* Nota aclaratoria */}
      {!isLoading && !isError && vendedores.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Criterio: precio_unidad &gt; $10 · comisión = (artículos − 1) × $1.000 por ticket · tipos AUTOCONS/NCR restan artículos
        </p>
      )}
    </div>
  );
}
