import { useState } from "react";
import { Wifi, WifiOff, AlertTriangle, CheckCircle, TrendingUp, Zap, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * RFIDDashboard — Panel principal de RFID
 * KPIs: etiquetas, lectores, alertas, precisión
 */

export default function RFIDDashboard() {
  const { data: dashboard, isLoading, isError } = useQuery({
    queryKey: ["rfid-dashboard"],
    queryFn: () => api.get("/rfid/dashboard"),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="p-8 text-center">Cargando...</div>;
  if (isError || !dashboard) return <div className="p-8 text-center text-gray-500">No hay datos RFID todavía — el sistema aún no tiene lectores ni etiquetas registradas.</div>;

  const { tags, readers, alerts, activity, latest_metric } = dashboard;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">RFID Dashboard</h1>
        <p className="text-gray-500 mt-2">Gestión de inventarios con tecnología RFID</p>
      </div>

      {/* KPIs — Etiquetas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Etiquetas</p>
              <p className="text-3xl font-bold mt-2">{tags?.total || 0}</p>
              <p className="text-xs text-green-600 mt-1">✓ {tags?.active || 0} activas</p>
            </div>
            <Package className="w-10 h-10 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Lectores Online</p>
              <p className="text-3xl font-bold mt-2">{readers?.online || 0}/{readers?.total || 0}</p>
              <p className="text-xs text-green-600 mt-1">Online ahora</p>
            </div>
            <Wifi className="w-10 h-10 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Alertas Pendientes</p>
              <p className="text-3xl font-bold mt-2 text-orange-600">{alerts?.unresolved || 0}</p>
              <p className="text-xs text-orange-600 mt-1">sin resolver</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Escaneos (24h)</p>
              <p className="text-3xl font-bold mt-2">{activity?.scans_24h || 0}</p>
              <p className="text-xs text-blue-600 mt-1">lecturas procesadas</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Metric actual */}
      {latest_metric && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-4">Métrica Última (24h)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Precisión Inventario</p>
              <p className="text-2xl font-bold text-green-600">{latest_metric.inventory_accuracy_percentage?.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tiempo Inventario</p>
              <p className="text-2xl font-bold">{latest_metric.avg_inventory_time_minutes?.toFixed(0)} min</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Merma Detectada</p>
              <p className="text-2xl font-bold text-orange-600">{latest_metric.estimated_shrinkage_percentage?.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Beneficio Acumulado</p>
              <p className="text-2xl font-bold text-blue-600">USD {latest_metric.estimated_savings_usd?.toFixed(0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Defectos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-900">⚠️ Etiquetas Dañadas</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{tags?.damaged || 0}</p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <p className="text-sm font-semibold text-orange-900">📍 Etiquetas Perdidas</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">{tags?.lost || 0}</p>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <p className="text-sm font-semibold text-blue-900">💾 Errores Lectores</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{latest_metric?.reader_errors_count || 0}</p>
        </div>
      </div>
    </div>
  );
}
