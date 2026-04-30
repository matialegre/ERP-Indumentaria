import { useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * RFIDEtiquetas — CRUD de etiquetas RFID
 */

export default function RFIDEtiquetas() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [localId, setLocalId] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [epcsText, setEpcsText] = useState("");

  const { data: tags, isLoading } = useQuery({
    queryKey: ["rfid-tags", localId],
    queryFn: () => api.get(`/rfid/tags?limit=500${localId ? `&local_id=${localId}` : ''}`).then(r => r.data),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const epcs = epcsText.split("\n").map(e => e.trim()).filter(Boolean);
      if (!variantId || !localId || epcs.length === 0) {
        throw new Error("Faltan datos requeridos");
      }
      return api.post("/rfid/tags/activate", {
        epcs,
        variant_id: variantId,
        local_id: localId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfid-tags"] });
      setShowForm(false);
      setEpcsText("");
      setVariantId(null);
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Etiquetas RFID</h1>
          <p className="text-gray-500 mt-2">Gestión de etiquetas (EPC)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Activar Etiquetas
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="font-bold">Cargar nuevas etiquetas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="number"
              placeholder="Variant ID"
              value={variantId || ""}
              onChange={e => setVariantId(Number(e.target.value))}
              className="border rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Local ID"
              value={localId || ""}
              onChange={e => setLocalId(Number(e.target.value))}
              className="border rounded px-3 py-2"
            />
          </div>
          <textarea
            placeholder="EPCs (uno por línea)"
            value={epcsText}
            onChange={e => setEpcsText(e.target.value)}
            className="w-full border rounded px-3 py-2 h-32 font-mono text-sm"
          />
          <button
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {activateMutation.isPending ? "Procesando..." : "Cargar"}
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">EPC</th>
              <th className="px-4 py-3 text-left font-semibold">Variante</th>
              <th className="px-4 py-3 text-left font-semibold">Local</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Ubicación</th>
              <th className="px-4 py-3 text-left font-semibold">Escaneos</th>
              <th className="px-4 py-3 text-left font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!isLoading && tags?.data?.map(tag => (
              <tr key={tag.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{tag.epc}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{tag.product_variant_id || "-"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{tag.local_id || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    tag.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                    tag.status === "DAMAGED" ? "bg-red-100 text-red-800" :
                    tag.status === "LOST" ? "bg-orange-100 text-orange-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {tag.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{tag.location || "-"}</td>
                <td className="px-4 py-3 text-xs text-blue-600 font-semibold">{tag.scan_count}</td>
                <td className="px-4 py-3 text-xs">
                  <button className="text-blue-600 hover:underline">
                    <Eye className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Total: <strong>{tags?.total || 0}</strong> etiquetas
        </div>
      </div>
    </div>
  );
}
