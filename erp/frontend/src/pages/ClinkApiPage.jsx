import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plug, RefreshCw, Search, AlertTriangle, MapPin, Calendar,
  ArrowDownCircle, ArrowUpCircle, CreditCard,
} from "lucide-react";

function fmtMoney(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

function fmtDateTime(s) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("es-AR");
}

export default function ClinkApiPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [codLocal, setCodLocal] = useState("");
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [doFetch, setDoFetch] = useState(false);

  // 1) Locales
  const localesQ = useQuery({
    queryKey: ["clink-locales"],
    queryFn: () => api.get("/clink/locales"),
  });
  const locales = localesQ.data?.data || [];

  // 2) Movimientos (lazy — solo cuando el user clickea Buscar)
  const queryKey = ["clink-movs", codLocal, desde, hasta, doFetch];
  const movsQ = useQuery({
    queryKey,
    queryFn: () =>
      api.get(`/clink/movimientos?codLocal=${codLocal}&fechaDesde=${desde}&fechaHasta=${hasta}`),
    enabled: doFetch && !!codLocal && !!desde && !!hasta,
  });
  const movs = movsQ.data?.data || [];

  const stats = useMemo(() => {
    if (!movs.length) return null;
    const total = movs.reduce((acc, m) => acc + (m.total || 0), 0);
    const ingresos = movs.filter((m) => (m.tipoMov || "").toLowerCase() === "ingreso");
    const egresos = movs.filter((m) => (m.tipoMov || "").toLowerCase() !== "ingreso");
    return {
      total,
      ingresos: ingresos.reduce((a, m) => a + (m.total || 0), 0),
      egresos: egresos.reduce((a, m) => a + (m.total || 0), 0),
      countIn: ingresos.length,
      countOut: egresos.length,
    };
  }, [movs]);

  const submit = (e) => {
    e.preventDefault();
    if (!codLocal || !desde || !hasta) return;
    setDoFetch(true);
    movsQ.refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Plug className="w-5 h-5 text-purple-600" /> CLINK API
        </h1>
        <span className="text-xs text-gray-500">https://api.clinkboxip.com.ar — rate limit 50/min</span>
      </div>

      {/* Sección 1: Locales */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <div className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" /> Locales habilitados
            </div>
            <div className="text-xs text-gray-500">
              Endpoint: <code className="text-purple-700">GET /api/v1/Locales</code>
            </div>
          </div>
          <button
            onClick={() => localesQ.refetch()}
            disabled={localesQ.isFetching}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${localesQ.isFetching ? "animate-spin" : ""}`} />
            Recargar
          </button>
        </div>
        {localesQ.isError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {localesQ.error?.message || "Error al consultar locales"}
          </div>
        )}
        {localesQ.isLoading && (
          <div className="p-6 text-center text-gray-400 text-sm">Cargando…</div>
        )}
        {locales.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">codLocal</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Nombre</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody>
                {locales.map((l) => (
                  <tr key={l.LocCodigo} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-mono text-purple-700">{l.LocCodigo}</td>
                    <td className="px-3 py-2 text-gray-700">{l.locnombre}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setCodLocal(l.LocCodigo)}
                        className="text-xs px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded"
                      >
                        Usar este local
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección 2: Movimientos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" /> Movimientos de caja
          </div>
          <div className="text-xs text-gray-500">
            Endpoint: <code className="text-purple-700">GET /api/v1/Movimientos</code>
          </div>
        </div>

        <form onSubmit={submit} className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">codLocal</label>
            <select
              value={codLocal}
              onChange={(e) => setCodLocal(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              required
            >
              <option value="">— Elegir —</option>
              {locales.map((l) => (
                <option key={l.LocCodigo} value={l.LocCodigo}>
                  {l.LocCodigo} — {l.locnombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
            <input
              type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
            <input
              type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" required
            />
          </div>
          <button
            type="submit"
            disabled={movsQ.isFetching}
            className="py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            {movsQ.isFetching ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {movsQ.isError && (
          <div className="mx-4 mb-4 p-3 text-sm text-red-700 bg-red-50 rounded flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {movsQ.error?.message || "Error al consultar movimientos"}
          </div>
        )}

        {stats && (
          <div className="mx-4 mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 bg-green-50 rounded">
              <div className="text-xs text-green-700">Ingresos ({stats.countIn})</div>
              <div className="text-sm font-bold text-green-800">{fmtMoney(stats.ingresos)}</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="text-xs text-red-700">Egresos ({stats.countOut})</div>
              <div className="text-sm font-bold text-red-800">{fmtMoney(stats.egresos)}</div>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <div className="text-xs text-blue-700">Total movimientos</div>
              <div className="text-sm font-bold text-blue-800">{movs.length}</div>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-600">Suma neta</div>
              <div className={`text-sm font-bold ${stats.total < 0 ? "text-red-700" : "text-gray-900"}`}>
                {fmtMoney(stats.total)}
              </div>
            </div>
          </div>
        )}

        {movs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Descripción</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Forma de pago</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Descuentos</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m, idx) => {
                  const ingreso = (m.tipoMov || "").toLowerCase() === "ingreso";
                  const Icon = ingreso ? ArrowDownCircle : ArrowUpCircle;
                  return (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDateTime(m.fechaActualizacion)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                          ingreso ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}>
                          <Icon className="w-3 h-3" /> {m.tipoMov}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{m.descripcion}</td>
                      <td className="px-3 py-2 text-gray-700 inline-flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-gray-400" />
                        {m.fpDescrip} <span className="text-xs text-gray-400">({m.fpCodigo})</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${ingreso ? "text-green-700" : "text-red-700"}`}>
                        {fmtMoney(m.total)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {m.descuentos ? fmtMoney(m.descuentos) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {doFetch && !movsQ.isFetching && movs.length === 0 && !movsQ.isError && (
          <div className="p-6 text-center text-gray-400 text-sm">Sin movimientos para ese rango.</div>
        )}
      </div>
    </div>
  );
}
