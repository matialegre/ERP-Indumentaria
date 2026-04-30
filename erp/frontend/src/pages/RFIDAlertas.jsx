import { useState } from "react";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * RFIDAlertas — Gestión de alertas del sistema RFID
 */

export default function RFIDAlertas() {
  const queryClient = useQueryClient();
  const [filterResolved, setFilterResolved] = useState(false);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["rfid-alerts", filterResolved],
    queryFn: () => api.get(`/rfid/alerts?is_resolved=${filterResolved}`),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId) => api.put(`/rfid/alerts/${alertId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfid-alerts"] });
    },
  });

  const severityIcon = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "WARNING":
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  const severityColor = (severity) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-50 border-red-200";
      case "WARNING":
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Alertas RFID</h1>
          <p className="text-gray-500 mt-2">Discrepancias, intentos de robo, etiquetas dañadas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterResolved(false)}
            className={`px-4 py-2 rounded-lg ${!filterResolved ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            Sin Resolver
          </button>
          <button
            onClick={() => setFilterResolved(true)}
            className={`px-4 py-2 rounded-lg ${filterResolved ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
          >
            Resueltas
          </button>
        </div>
      </div>

      {/* Lista de alertas */}
      <div className="space-y-4">
        {!isLoading && alerts?.length > 0 ? (
          alerts.map(alert => (
            <div
              key={alert.id}
              className={`rounded-lg border p-6 ${severityColor(alert.severity)}`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {severityIcon(alert.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{alert.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      alert.severity === "CRITICAL" ? "bg-red-200 text-red-900" :
                      alert.severity === "WARNING" ? "bg-orange-200 text-orange-900" :
                      "bg-blue-200 text-blue-900"
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  {alert.description && (
                    <p className="text-sm text-gray-700 mb-3">{alert.description}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {new Date(alert.created_at).toLocaleString("es-AR")}
                  </p>
                </div>
                {!alert.is_resolved && (
                  <button
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={resolveMutation.isPending}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Resolver
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay alertas {filterResolved ? "resueltas" : "sin resolver"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
