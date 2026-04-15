import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { X, Clock, AlertCircle, Download } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n ?? 0);

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;

async function downloadExport(providerId, providerName, format, dateFrom, dateTo) {
  const token = sessionStorage.getItem("token");
  const params = new URLSearchParams({ format });
  if (dateFrom) params.append("date_from", dateFrom);
  if (dateTo) params.append("date_to", dateTo);
  try {
    const res = await fetch(`${API_BASE}/providers/${providerId}/historia/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historia_${providerName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // silently fail — user sees no download
  }
}

export default function HistoriaProveedor({ provider, onClose }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtro, setFiltro] = useState({ desde: "", hasta: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["historia-proveedor", provider.id, filtro.desde, filtro.hasta],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filtro.desde) params.set("date_from", filtro.desde);
      if (filtro.hasta) params.set("date_to", filtro.hasta);
      params.set("limit", "500");
      return api.get(`/providers/${provider.id}/historia?${params}`);
    },
  });

  const aplicar = () => setFiltro({ desde, hasta });
  const limpiar = () => {
    setDesde(""); setHasta("");
    setFiltro({ desde: "", hasta: "" });
  };

  const items = data?.items ?? [];
  const saldoTotal = data?.saldo_total ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Clock size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Historia de {provider.name}</h2>
              <p className="text-xs text-gray-500">Notas de pedido — detalle completo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Filters + Export */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-600">Desde</label>
          <input
            type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <label className="text-sm font-medium text-gray-600">Hasta</label>
          <input
            type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={aplicar}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Aplicar
          </button>
          {(filtro.desde || filtro.hasta) && (
            <button
              onClick={limpiar}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-white transition"
            >
              Limpiar
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => downloadExport(provider.id, provider.name, "xlsx", filtro.desde, filtro.hasta)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
            >
              <Download size={12} /> Excel
            </button>
            <button
              onClick={() => downloadExport(provider.id, provider.name, "csv", filtro.desde, filtro.hasta)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {data && (
          <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-5 text-xs flex-wrap">
            <span className="font-semibold text-gray-700">{data.total} notas de pedido</span>
            <span className="text-gray-500">Saldo acumulado:
              <span className={`ml-1 font-bold ${saldoTotal > 0 ? "text-orange-600" : "text-green-600"}`}>
                {fmt(saldoTotal)}
              </span>
            </span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">Cargando historial...</div>
          ) : error ? (
            <div className="py-16 text-center text-red-500 flex flex-col items-center gap-2">
              <AlertCircle size={24} />
              <span>Error al cargar el historial</span>
            </div>
          ) : (
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide border-b border-gray-200">
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Local</th>
                  <th className="px-3 py-2 text-right">C. Ped.</th>
                  <th className="px-3 py-2 text-right">C. Rec.</th>
                  <th className="px-3 py-2 text-left">Facturas</th>
                  <th className="px-3 py-2 text-left">RV</th>
                  <th className="px-3 py-2 text-left">Vto.</th>
                  <th className="px-3 py-2 text-right">Bruto</th>
                  <th className="px-3 py-2 text-right">Pagado</th>
                  <th className="px-3 py-2 text-right">Saldo Ac.</th>
                  <th className="px-3 py-2 text-right">Ret. IVA</th>
                  <th className="px-3 py-2 text-right">Ret. IIBB</th>
                  <th className="px-3 py-2 text-right">Ret. Gcias</th>
                  <th className="px-3 py-2 text-left">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="text-center py-12 text-gray-400">
                      Sin registros en el período
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3 py-1.5 text-gray-600 font-mono">{row.fecha || "—"}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.tipo === "PRECOMPRA" ? "bg-purple-100 text-purple-700" :
                          row.tipo === "REPOSICION" ? "bg-blue-100 text-blue-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>{row.tipo}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono font-semibold text-blue-700">
                        {row.prefix ? `${row.prefix}-` : ""}{row.numero}
                        {row.accepted_difference && (
                          <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 px-1 rounded">ANP</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          row.estado === "COMPLETADO" ? "bg-green-100 text-green-700" :
                          row.estado === "ENVIADO"    ? "bg-blue-100 text-blue-700" :
                          row.estado === "RECIBIDO"   ? "bg-amber-100 text-amber-700" :
                          row.estado === "ANULADO"    ? "bg-red-100 text-red-500" :
                          "bg-gray-100 text-gray-500"
                        }`}>{row.estado}</span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[100px] truncate">{row.local_name || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{row.cant_pedida}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={row.cant_recibida >= row.cant_pedida && row.cant_pedida > 0 ? "text-green-600 font-medium" : "text-orange-600"}>
                          {row.cant_recibida}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[130px] truncate" title={row.nums_facturas}>
                        {row.nums_facturas || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600">{row.rvs || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.vto_pago || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {row.importe_bruto ? fmt(row.importe_bruto) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-700">
                        {row.pagado ? fmt(row.pagado) : "—"}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-bold ${row.saldo_acum > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {fmt(row.saldo_acum)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-orange-600">
                        {row.ret_iva ? fmt(row.ret_iva) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-orange-600">
                        {row.ret_iibb ? fmt(row.ret_iibb) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-orange-600">
                        {row.ret_ganancias ? fmt(row.ret_ganancias) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 max-w-[160px] truncate" title={row.obs_compras || row.notes}>
                        {row.obs_compras || row.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
