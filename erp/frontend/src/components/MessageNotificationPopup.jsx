/**
 * MessageNotificationPopup — Toast flotante abajo-derecha cuando llegan mensajes nuevos.
 * Muestra hasta 3 mensajes no leídos con remitente, asunto y preview.
 * Auto-dismiss en 8s. Click navega a /mensajes.
 * Los mensajes de mejoras (subject con "mejora") tienen estilo especial llamativo.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { MessageSquare, X, Bell, Lightbulb } from "lucide-react";

function fmtTime(dt) {
  if (!dt) return "";
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  return new Date(dt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function isMejoraMsg(msg) {
  const s = (msg.subject || "").toLowerCase();
  return s.includes("mejora") || s.includes("sugerencia");
}

export default function MessageNotificationPopup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notifications, setNotifications] = useState([]);
  const seenIdsRef = useRef(null); // Set de ids ya mostrados (null en 1ra carga)
  const dismissTimers = useRef({});

  // Polling directo del inbox — no depende de sidebar-counts
  const { data: inboxData } = useQuery({
    queryKey: ["messages-inbox-popup"],
    queryFn: () => api.get("/messages/?limit=20"),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!inboxData) return;
    const msgs = Array.isArray(inboxData) ? inboxData : [];
    const unread = msgs.filter(m => !m.is_read);
    const unreadIds = new Set(unread.map(m => m.id));

    // Primera carga: marcar todos los actuales como ya vistos (no mostrar popup viejos)
    if (seenIdsRef.current === null) {
      console.log("[NotifPopup] Primera carga — unread existentes:", unread.length, "ids:", [...unreadIds]);
      seenIdsRef.current = unreadIds;
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
      return;
    }

    // Detectar mensajes nuevos (ids no vistos antes)
    const nuevos = unread.filter(m => !seenIdsRef.current.has(m.id));
    seenIdsRef.current = unreadIds;

    if (nuevos.length === 0) return;

    console.log("[NotifPopup] 🔔 NUEVOS:", nuevos.length, nuevos.map(n => ({id: n.id, subj: n.subject})));
    qc.invalidateQueries({ queryKey: ["sidebar-counts"] });

    // Crear popup con los nuevos (máx 3)
    const toShow = nuevos.slice(0, 3);
    const notifId = Date.now();
    setNotifications(prev => [
      { id: notifId, msgs: toShow },
      ...prev.slice(0, 2),
    ]);

    const hasMejora = toShow.some(isMejoraMsg);
    dismissTimers.current[notifId] = setTimeout(() => {
      dismiss(notifId);
    }, hasMejora ? 15000 : 10000);

    // Sonido de notificación (beep simple)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = hasMejora ? 880 : 660;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, [inboxData]);

  function dismiss(id) {
    clearTimeout(dismissTimers.current[id]);
    delete dismissTimers.current[id];
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function goToMessages(id) {
    dismiss(id);
    navigate("/mensajes");
  }

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map(notif => {
        const hasMejora = notif.msgs.some(isMejoraMsg);
        return (
          <div
            key={notif.id}
            className={`pointer-events-auto rounded-2xl shadow-2xl w-80 overflow-hidden animate-slide-up border-2 ${
              hasMejora
                ? "bg-amber-50 border-amber-400"
                : "bg-white border-gray-200"
            }`}
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            {/* Header */}
            <div className={`flex items-center gap-2 px-4 py-2.5 text-white ${
              hasMejora ? "bg-amber-500" : "bg-blue-600"
            }`}>
              {hasMejora
                ? <Lightbulb size={15} className="flex-shrink-0" />
                : <Bell size={14} className="flex-shrink-0" />
              }
              <span className="text-xs font-semibold flex-1">
                {hasMejora
                  ? "📢 Notificación de mejora"
                  : notif.msgs.length === 1 ? "Nuevo mensaje" : `${notif.msgs.length} mensajes nuevos`
                }
              </span>
              <button
                onClick={() => dismiss(notif.id)}
                className={`hover:opacity-75 rounded-md p-0.5 transition`}
                title="Cerrar"
              >
                <X size={13} />
              </button>
            </div>

            {/* Messages */}
            <div className="divide-y divide-gray-100">
              {notif.msgs.map(msg => {
                const isMejora = isMejoraMsg(msg);
                return (
                  <button
                    key={msg.id}
                    onClick={() => goToMessages(notif.id)}
                    className={`w-full text-left px-4 py-3 transition ${
                      isMejora ? "hover:bg-amber-100 bg-amber-50/60" : "hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase ${
                        isMejora
                          ? "bg-amber-200 text-amber-700"
                          : "bg-blue-100 text-blue-600"
                      }`}>
                        {isMejora ? "💡" : (msg.from_user_name || "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-gray-800 truncate">
                            {msg.from_user_name || "Sistema"}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>
                        <p className={`text-xs font-semibold truncate ${
                          isMejora ? "text-amber-800" : "text-gray-700"
                        }`}>
                          {msg.subject}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {msg.content?.slice(0, 80)}
                        </p>
                      </div>
                    </div>
                    {isMejora && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded-md px-2 py-1">
                        <Lightbulb size={10} /> Tocá para ver el mensaje completo en Mensajería
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className={`px-4 py-2 border-t ${
              hasMejora ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"
            }`}>
              <button
                onClick={() => goToMessages(notif.id)}
                className={`text-xs font-medium hover:underline flex items-center gap-1 ${
                  hasMejora ? "text-amber-700" : "text-blue-600"
                }`}
              >
                <MessageSquare size={11} /> Ver todos los mensajes
              </button>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
