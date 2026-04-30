import { useState } from "react";
import { WifiOff, Wifi, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * RFIDLectores — Gestión de dispositivos lectores RFID
 */

export default function RFIDLectores() {
  const { data: readers, isLoading } = useQuery({
    queryKey: ["rfid-readers"],
    queryFn: () => api.get("/rfid/readers"),
    refetchInterval: 10000,
  });

  const onlineCount = readers?.filter(r => r.is_online).length || 0;
  const totalCount = readers?.length || 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Lectores RFID</h1>
          <p className="text-gray-500 mt-2">Handheld, portales, túneles de CD</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Registrar Lector
        </button>
      </div>

      {/* Status general */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Estado de Red</p>
            <p className="text-3xl font-bold mt-2">
              <span className="text-green-600">{onlineCount}</span> / {totalCount}
            </p>
            <p className="text-xs text-gray-600 mt-1">lectores online</p>
          </div>
          <Wifi className={`w-16 h-16 ${onlineCount === totalCount ? "text-green-500" : "text-orange-500"} opacity-50`} />
        </div>
      </div>

      {/* Tabla de lectores */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Modelo</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Escaneos</th>
              <th className="px-4 py-3 text-left font-semibold">Errores</th>
              <th className="px-4 py-3 text-left font-semibold">Última conexión</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!isLoading && readers?.map(reader => (
              <tr key={reader.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold">{reader.name}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-800">{reader.reader_type}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{reader.model || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 text-xs font-semibold ${
                    reader.is_online ? "text-green-600" : "text-red-600"
                  }`}>
                    {reader.is_online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {reader.is_online ? "Online" : "Offline"}
                  </span>
                </td>
                <td className="px-4 py-3 text-blue-600 font-semibold">{reader.total_scans}</td>
                <td className="px-4 py-3 text-red-600 font-semibold">{reader.error_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {reader.last_online_at ? new Date(reader.last_online_at).toLocaleDateString("es-AR") : "Nunca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
