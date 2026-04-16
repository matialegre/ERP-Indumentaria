import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { RefreshCw, DollarSign, Clock, TrendingUp, AlertCircle } from "lucide-react";

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(n);
}

export default function CashFlowPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["ml-cash-flow"],
    queryFn: () => api.get("/ml/cash-flow"),
    refetchInterval: 60_000,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cash Flow — MercadoLibre</h1>
          <p className="text-sm text-gray-500 mt-1">Dinero disponible y pendiente de acreditación por cuenta</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} />
          <span>Error al cargar datos: {error?.message || "desconocido"}</span>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.map((account) => (
            <div key={account.account} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">{account.label || account.account}</h2>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{account.account}</span>
                </div>
                {account.error ? (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg">Error</span>
                ) : (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">OK</span>
                )}
              </div>

              {account.error ? (
                <div className="p-5 text-sm text-red-600 bg-red-50 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{account.error}</span>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <DollarSign size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dinero disponible</p>
                      <p className="text-xl font-bold text-green-700">{fmt(account.available)}</p>
                      <p className="text-xs text-gray-400">Listo para retirar</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Dinero a acreditar</p>
                      <p className="text-xl font-bold text-amber-700">{fmt(account.pending)}</p>
                      <p className="text-xs text-gray-400">En proceso de liberación</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <TrendingUp size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total en cuenta</p>
                      <p className="text-xl font-bold text-blue-700">{fmt(account.total)}</p>
                      <p className="text-xs text-gray-400">Disponible + a acreditar</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">No hay cuentas ML configuradas.</div>
      )}
    </div>
  );
}
