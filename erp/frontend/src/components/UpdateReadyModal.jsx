import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, RefreshCw, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "erp_seen_done_note_ids";

function getSeenIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function addSeenIds(ids) {
  const seen = getSeenIds();
  ids.forEach((id) => seen.add(id));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

export default function UpdateReadyModal() {
  const { user } = useAuth();
  const [pendingNotes, setPendingNotes] = useState([]);
  const initializedRef = useRef(false);

  const { data: doneNotes = [], isFetched } = useQuery({
    queryKey: ["my-done-notes"],
    queryFn: () => api.get("/improvement-notes/my-updates"),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!isFetched) return; // Esperar el primer fetch real del servidor

    if (!initializedRef.current) {
      // Baseline: marcar todas las notas ya hechas como vistas
      addSeenIds(doneNotes.map((n) => n.id));
      initializedRef.current = true;
      return;
    }

    const seen = getSeenIds();
    const newDone = doneNotes.filter((n) => !seen.has(n.id));
    if (newDone.length > 0) {
      setPendingNotes(newDone);
    }
  }, [doneNotes, isFetched]);

  if (!pendingNotes.length) return null;

  const handleReload = () => {
    addSeenIds(pendingNotes.map((n) => n.id));
    setPendingNotes([]);
    // Hard refresh equivalente a Ctrl+Shift+R
    window.location.reload(true);
  };

  const handleDismiss = () => {
    addSeenIds(pendingNotes.map((n) => n.id));
    setPendingNotes([]);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header verde */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                ¡Tu mejora está lista!
              </h2>
              <p className="text-green-100 text-sm">
                {pendingNotes.length === 1
                  ? "Se implementó tu actualización"
                  : `Se implementaron ${pendingNotes.length} actualizaciones`}
              </p>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="px-6 py-4 space-y-3 max-h-60 overflow-y-auto">
          {pendingNotes.map((n) => (
            <div
              key={n.id}
              className="bg-green-50 border border-green-200 rounded-xl px-4 py-3"
            >
              {n.page_label && (
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1">
                  📍 {n.page_label}
                </p>
              )}
              <p className="text-sm text-gray-700 line-clamp-3">{n.text}</p>
              {n.approved_by && (
                <p className="text-[10px] text-green-600 mt-1.5">
                  ✓ Implementado por {n.approved_by}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Botones */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleReload}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold rounded-xl transition-all"
          >
            <RefreshCw size={16} />
            Ver cambio ahora
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-gray-400 hover:text-gray-600 rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
            title="Cerrar sin recargar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
