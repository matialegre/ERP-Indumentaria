/**
 * ClientesTallerPage — Lista y detalle de clientes del taller
 * Portada de eurotaller-cassano/src/pages/ClientesPage.tsx
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Phone, Mail } from "lucide-react";
import { api } from "../../lib/api";
import { useOfflineQuery } from "../../lib/useOfflineQuery";
import { formatCuit } from "../../lib/utils-ar";

export default function ClientesTallerPage() {
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useOfflineQuery(
    ["taller-clientes"],
    () => api.get("/customers/?limit=200&ordering=full_name"),
    "catalogClientes",
    { staleTime: 5 * 60 * 1000 }
  );

  const clientes = Array.isArray(data) ? data : (data?.items ?? []);

  const filtrados = busqueda
    ? clientes.filter((c) => {
        const q = busqueda.toLowerCase();
        return (
          (c.full_name ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.cuit ?? "").includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      })
    : clientes;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Users className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <span className="text-sm text-gray-500">({clientes.length})</span>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, CUIT, teléfono…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No hay clientes</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtrados.map((c) => (
              <li
                key={c.id}
                onClick={() => setSelected(selected?.id === c.id ? null : c)}
                className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{c.full_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.cuit ? `CUIT: ${formatCuit(c.cuit)}` : "Sin CUIT"}{" "}
                      {c.doc_number && !c.cuit ? `DNI: ${c.doc_number}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {c.phone && (
                      <p className="flex items-center gap-1 justify-end">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-1 justify-end">
                        <Mail className="w-3 h-3" /> {c.email}
                      </p>
                    )}
                  </div>
                </div>
                {/* Panel expandible */}
                {selected?.id === c.id && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div><span className="font-medium text-gray-500">Dirección:</span> {c.address ?? "—"}</div>
                    <div><span className="font-medium text-gray-500">Condición AFIP:</span> {c.afip_condition ?? "—"}</div>
                    <div><span className="font-medium text-gray-500">Empresa:</span> {c.company_id ?? "—"}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{filtrados.length} clientes</p>
    </div>
  );
}
