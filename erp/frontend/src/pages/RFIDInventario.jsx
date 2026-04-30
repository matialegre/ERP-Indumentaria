import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * RFIDInventario — Inventarios RFID y snapshots
 */

export default function RFIDInventario() {
  const [selectedLocal, setSelectedLocal] = useState(null);

  const { data: tags } = useQuery({
    queryKey: ["rfid-tags", selectedLocal],
    queryFn: () => api.get(`/rfid/tags?limit=1000${selectedLocal ? `&local_id=${selectedLocal}` : ''}`),
  });

  const stats = tags?.data ? {
    total: tags.data.length,
    active: tags.data.filter(t => t.status === "ACTIVE").length,
    damaged: tags.data.filter(t => t.status === "DAMAGED").length,
    lost: tags.data.filter(t => t.status === "LOST").length,
  } : { total: 0, active: 0, damaged: 0, lost: 0 };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Inventario RFID</h1>
          <p className="text-gray-500 mt-2">Snapshots y reconciliación</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Nuevo Inventario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <p className="text-sm text-green-700">Activas</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.active}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-700">Dañadas</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.damaged}</p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <p className="text-sm text-orange-700">Perdidas</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.lost}</p>
        </div>
      </div>

      {/* Tabla de etiquetas */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="font-bold">Etiquetas en Inventario</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">EPC</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Escaneos</th>
              <th className="px-4 py-3 text-left font-semibold">Última lectura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tags?.data?.slice(0, 20).map(tag => (
              <tr key={tag.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{tag.epc}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                    {tag.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-blue-600">{tag.scan_count}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {tag.last_scan_at ? new Date(tag.last_scan_at).toLocaleDateString("es-AR") : "Nunca"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
