/**
 * StockTallerPage — Repuestos y stock del taller con alertas de stock crítico
 * Portada de eurotaller-cassano/src/pages/StockPage.tsx
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "../../lib/api";
import { useOfflineQuery } from "../../lib/useOfflineQuery";

export default function StockTallerPage() {
  const [busqueda, setBusqueda] = useState("");
  const [soloCritico, setSoloCritico] = useState(false);

  const { data, isLoading } = useOfflineQuery(
    ["taller-articulos"],
    () => api.get("/products/?limit=200"),
    "catalogArticulos",
    { staleTime: 5 * 60 * 1000 }
  );

  const articulos = Array.isArray(data) ? data : (data?.items ?? []);

  // Obtener variantes "planas" — cada variante es una fila de stock
  const variantes = articulos.flatMap((p) =>
    (p.variants ?? [{ ...p, product_name: p.name }]).map((v) => ({
      id: v.id ?? p.id,
      sku: v.sku ?? p.sku ?? "—",
      product_name: p.name ?? v.product_name ?? "—",
      variant_label: [v.talle, v.color].filter(Boolean).join(" / ") || null,
      stock: v.stock ?? p.stock ?? 0,
      min_stock: v.min_stock ?? p.min_stock ?? 0,
    }))
  );

  const filtrados = variantes.filter((v) => {
    if (soloCritico && v.stock > v.min_stock) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      (v.sku ?? "").toLowerCase().includes(q) ||
      (v.product_name ?? "").toLowerCase().includes(q)
    );
  });

  const cantidadCritico = variantes.filter((v) => v.stock <= v.min_stock).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Stock de Repuestos</h1>
        </div>
        {cantidadCritico > 0 && (
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-xs font-medium border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {cantidadCritico} con stock crítico
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={() => setSoloCritico(!soloCritico)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            soloCritico
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Solo crítico
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Sin resultados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Variante</th>
                  <th className="px-5 py-3 text-right">Stock</th>
                  <th className="px-5 py-3 text-right">Mínimo</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((v) => {
                  const critico = v.stock <= v.min_stock;
                  return (
                    <tr key={v.id} className={critico ? "bg-red-50/50" : "hover:bg-gray-50"}>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{v.sku}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{v.product_name}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{v.variant_label ?? "—"}</td>
                      <td className={`px-5 py-3 text-right font-bold ${critico ? "text-red-600" : "text-gray-900"}`}>
                        {v.stock}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500">{v.min_stock}</td>
                      <td className="px-5 py-3 text-center">
                        {critico ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Reponer
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-right">{filtrados.length} ítems</p>
    </div>
  );
}
