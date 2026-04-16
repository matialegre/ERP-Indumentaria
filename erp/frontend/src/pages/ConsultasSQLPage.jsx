import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Search, Database, Edit3, RefreshCw } from "lucide-react";

/**
 * Página "SQL PC Tomy" — portada desde CONTROL REMITOS/frontend/src/pages/Admin.tsx
 * Dos sub-tabs:
 *   1) Consultar Remito — query directa a SQL Server REMITOS por número
 *   2) Reasignar RV     — busca factura en ERP y cambia su remito_venta_number
 */
export default function ConsultasSQLPage() {
  const [tab, setTab] = useState("consulta");

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center gap-3">
        <Database className="h-6 w-6 text-indigo-600" />
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">SQL PC Tomy</h1>
        <span className="text-xs text-gray-500">Consultas y reasignaciones directas</span>
      </div>

      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setTab("consulta")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "consulta"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Search className="inline h-4 w-4 mr-1" /> Consultar Remito
        </button>
        <button
          onClick={() => setTab("reasignar")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "reasignar"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Edit3 className="inline h-4 w-4 mr-1" /> Reasignar RV
        </button>
      </div>

      {tab === "consulta" ? <ConsultaRemito /> : <ReasignarRV />}
    </div>
  );
}

function ConsultaRemito() {
  const [nro, setNro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const consultar = useMutation({
    mutationFn: (n) => api.get(`/sql-server/consultar-remito?nro=${encodeURIComponent(n)}`),
    onSuccess: (data) => {
      setResultado(data);
      setError(null);
    },
    onError: (err) => {
      setResultado(null);
      setError(err?.message || "Error al consultar");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (nro.trim()) consultar.mutate(nro.trim());
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          value={nro}
          onChange={(e) => setNro(e.target.value)}
          placeholder="Número de remito (ej: 1234)"
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
        />
        <button
          type="submit"
          disabled={consultar.isPending || !nro.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {consultar.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Consultar"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-3">{error}</div>
      )}

      {resultado && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Info label="Número" value={resultado.numero} />
            <Info label="Fecha" value={resultado.fecha} />
            <Info label="Cliente" value={resultado.cliente} />
            <Info label="Estado" value={resultado.estado} />
          </div>
          {resultado.detalle?.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left">Código</th>
                    <th className="px-2 py-2 text-left">Descripción</th>
                    <th className="px-2 py-2 text-center">Cant.</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.detalle.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 font-mono">{d.codigo}</td>
                      <td className="px-2 py-1">{d.descripcion}</td>
                      <td className="px-2 py-1 text-center">{d.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {resultado.raw && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Ver respuesta raw</summary>
              <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto">{JSON.stringify(resultado.raw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ReasignarRV() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [nuevoRV, setNuevoRV] = useState("");
  const [msg, setMsg] = useState(null);

  const buscar = useMutation({
    mutationFn: (q) => api.get(`/sql-server/buscar-doc?q=${encodeURIComponent(q)}`),
    onSuccess: (data) => {
      setResultados(Array.isArray(data) ? data : data?.items ?? []);
      setMsg(null);
    },
    onError: (err) => setMsg({ type: "error", text: err?.message || "Error al buscar" }),
  });

  const reasignar = useMutation({
    mutationFn: ({ factura_id, nuevo_rv }) =>
      api.post("/sql-server/reasignar-rv", { factura_id, nuevo_rv }),
    onSuccess: () => {
      setMsg({ type: "ok", text: "✓ RV reasignado correctamente" });
      setSeleccion(null);
      setNuevoRV("");
      if (query) buscar.mutate(query);
    },
    onError: (err) => setMsg({ type: "error", text: err?.message || "Error al reasignar" }),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) buscar.mutate(query.trim());
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar factura/remito por número"
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
        />
        <button
          type="submit"
          disabled={buscar.isPending || !query.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {buscar.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Buscar"}
        </button>
      </form>

      {msg && (
        <div
          className={`p-2 rounded-lg text-sm mb-3 ${
            msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {resultados.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">ID</th>
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-left">Número</th>
                <th className="px-2 py-2 text-left">Proveedor</th>
                <th className="px-2 py-2 text-left">RV actual</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-1 text-gray-500">{r.id}</td>
                  <td className="px-2 py-1">{r.type ?? r.tipo}</td>
                  <td className="px-2 py-1 font-mono">{r.number ?? r.numero}</td>
                  <td className="px-2 py-1">{r.provider_name ?? r.proveedor ?? "—"}</td>
                  <td className="px-2 py-1 font-mono text-indigo-700">{r.remito_venta_number ?? "—"}</td>
                  <td className="px-2 py-1 text-right">
                    {seleccion?.id === r.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          value={nuevoRV}
                          onChange={(e) => setNuevoRV(e.target.value)}
                          placeholder="Nuevo RV"
                          className="w-28 px-2 py-1 border rounded text-xs font-mono"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nuevoRV.trim())
                              reasignar.mutate({ factura_id: r.id, nuevo_rv: nuevoRV.trim() });
                            if (e.key === "Escape") setSeleccion(null);
                          }}
                        />
                        <button
                          onClick={() => reasignar.mutate({ factura_id: r.id, nuevo_rv: nuevoRV.trim() })}
                          disabled={!nuevoRV.trim() || reasignar.isPending}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setSeleccion(null)}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSeleccion(r);
                          setNuevoRV(r.remito_venta_number ?? "");
                        }}
                        className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-xs"
                      >
                        Reasignar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultados.length === 0 && buscar.isSuccess && (
        <p className="text-sm text-gray-500 text-center py-4">No se encontraron documentos.</p>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="bg-gray-50 p-2 rounded border">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-medium text-gray-800 truncate">{value ?? "—"}</p>
    </div>
  );
}
