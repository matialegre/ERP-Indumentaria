/**
 * LocalSelector.jsx — Modal para seleccionar el local del dispositivo
 *
 * Se muestra después del login si el usuario tiene acceso a múltiples locales.
 * Si solo hay 1 local disponible, se auto-selecciona.
 * Funciona offline usando datos del IndexedDB (catalogLocals).
 */
import { useState, useEffect } from "react";
import { getAll } from "../lib/offlineDB";
import { Store, MapPin, X, Check } from "lucide-react";

export default function LocalSelector({ isOpen, onSelect, onClose, currentLocalId }) {
  const [locals, setLocals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(currentLocalId || null);
  const [search, setSearch] = useState("");

  // Cargar locales desde IndexedDB (funciona offline)
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAll("catalogLocals")
      .then((data) => {
        const items = (data || []).filter((l) => l.is_active !== false);
        setLocals(items);

        // Auto-seleccionar si hay exactamente 1 local
        if (items.length === 1 && !currentLocalId) {
          onSelect(items[0].id, items[0].name);
        }
      })
      .catch(() => setLocals([]))
      .finally(() => setLoading(false));
  }, [isOpen, currentLocalId, onSelect]);

  if (!isOpen) return null;

  const filtered = search
    ? locals.filter((l) =>
        l.name?.toLowerCase().includes(search.toLowerCase()) ||
        l.address?.toLowerCase().includes(search.toLowerCase())
      )
    : locals;

  function handleConfirm() {
    const loc = locals.find((l) => String(l.id) === String(selected));
    if (loc) {
      onSelect(loc.id, loc.name);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Store size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Seleccionar Local</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Buscador */}
        {locals.length > 5 && (
          <div className="px-6 pt-4">
            <input
              type="text"
              placeholder="Buscar local..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
        )}

        {/* Lista de locales */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Store size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {locals.length === 0
                  ? "No hay locales disponibles. Sincronizá primero."
                  : "Sin resultados para la búsqueda."}
              </p>
            </div>
          ) : (
            filtered.map((loc) => {
              const isSelected = String(selected) === String(loc.id);
              const isCurrent = String(currentLocalId) === String(loc.id);
              return (
                <button
                  key={loc.id}
                  onClick={() => setSelected(loc.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <MapPin size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {loc.name}
                        </p>
                        {loc.address && (
                          <p className="text-xs text-gray-500 truncate">
                            {loc.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent && (
                        <span className="text-xs text-blue-600 font-medium">Actual</span>
                      )}
                      {isSelected && (
                        <Check size={18} className="text-blue-600" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
