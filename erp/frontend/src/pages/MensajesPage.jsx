import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SERVER_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  MessageSquare, Send, Users, Radio, Trash2,
  CheckCheck, Clock, Search, RefreshCw, Plus, X,
  ChevronLeft, Megaphone, Image, Paperclip, FileText, Download,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
function isImageUrl(url) {
  if (!url) return false;
  const ext = url.slice(url.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString("es-AR", { weekday: "short" });
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function fmtFull(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const ROLE_LABEL = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  COMPRAS: "Compras",
  ADMINISTRACION: "Administración",
  GESTION_PAGOS: "Pagos",
  LOCAL: "Local",
  VENDEDOR: "Vendedor",
  DEPOSITO: "Depósito",
};

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = "md", broadcast = false }) {
  const initials = broadcast
    ? "📢"
    : (name || "?")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
  const sz = size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-orange-500", "bg-red-500", "bg-teal-500",
    "bg-pink-500", "bg-indigo-500",
  ];
  const color = broadcast
    ? "bg-amber-500"
    : colors[(name || "").charCodeAt(0) % colors.length];
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MensajesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selected, setSelected] = useState(null); // { id, name, role } | "broadcast"
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState(null);
  const [newFileName, setNewFileName] = useState(null);
  const newImageRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const messagesEndRef = useRef(null);

  // ── Queries ──
  const { data: users = [] } = useQuery({
    queryKey: ["msg-users"],
    queryFn: () => api.get("/messages/users"),
    staleTime: 60_000,
  });

  const { data: inbox = [], refetch: refetchInbox } = useQuery({
    queryKey: ["msg-inbox"],
    queryFn: () => api.get("/messages/?limit=200"),
    refetchInterval: 5_000,
  });

  const { data: sent = [], refetch: refetchSent } = useQuery({
    queryKey: ["msg-sent"],
    queryFn: () => api.get("/messages/sent?limit=200"),
    refetchInterval: 5_000,
  });

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["msg-unread"],
    queryFn: () => api.get("/messages/unread-count"),
    refetchInterval: 5_000,
  });

  // ── Mutations ──
  const sendMutation = useMutation({
    mutationFn: (body) => api.post("/messages/", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msg-inbox"] });
      qc.invalidateQueries({ queryKey: ["msg-sent"] });
      qc.invalidateQueries({ queryKey: ["msg-unread"] });
      setNewSubject("");
      setNewContent("");
      setNewImage(null);
      setNewImagePreview(null);
      setNewFileName(null);
      setComposing(false);
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => api.post(`/messages/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msg-inbox"] });
      qc.invalidateQueries({ queryKey: ["msg-unread"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post("/messages/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msg-inbox"] });
      qc.invalidateQueries({ queryKey: ["msg-unread"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/messages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msg-inbox"] });
      qc.invalidateQueries({ queryKey: ["msg-sent"] });
    },
  });

  // ── Conversation list with last message + unread per user ──
  const conversations = useMemo(() => {
    const map = {};

    // broadcast slot
    const broadcastMsgs = inbox.filter((m) => m.is_broadcast);
    const broadcastUnread = broadcastMsgs.filter((m) => !m.is_read).length;
    const lastBroadcast = broadcastMsgs[0] || null;
    map["broadcast"] = {
      id: "broadcast",
      name: "Difusión",
      role: null,
      lastMsg: lastBroadcast,
      unread: broadcastUnread,
      isBroadcast: true,
    };

    // per-user
    for (const u of users) {
      const received = inbox.filter((m) => !m.is_broadcast && m.from_user_id === u.id);
      const sentTo = sent.filter((m) => !m.is_broadcast && m.to_user_id === u.id);
      const all = [...received, ...sentTo].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      map[u.id] = {
        id: u.id,
        name: u.full_name,
        role: u.role,
        lastMsg: all[0] || null,
        unread: received.filter((m) => !m.is_read).length,
        isBroadcast: false,
      };
    }
    return Object.values(map).sort((a, b) => {
      if (!a.lastMsg && !b.lastMsg) return 0;
      if (!a.lastMsg) return 1;
      if (!b.lastMsg) return -1;
      return new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at);
    });
  }, [users, inbox, sent]);

  // ── Messages for current conversation ──
  const currentMessages = useMemo(() => {
    if (!selected) return [];
    if (selected === "broadcast") {
      return inbox
        .filter((m) => m.is_broadcast)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const received = inbox.filter(
      (m) => !m.is_broadcast && m.from_user_id === selected.id
    );
    const sentTo = sent.filter(
      (m) => !m.is_broadcast && m.to_user_id === selected.id
    );
    return [...received, ...sentTo].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
  }, [selected, inbox, sent]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Mark messages as read when opening conversation
  useEffect(() => {
    if (!selected || selected === "broadcast") return;
    const unread = inbox.filter(
      (m) => !m.is_broadcast && m.from_user_id === selected.id && !m.is_read
    );
    unread.forEach((m) => markReadMutation.mutate(m.id));
  }, [selected, inbox]);

  // ── Filtered conversation list ──
  const filteredConvos = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();
    return conversations.filter((c) => c.name.toLowerCase().includes(term));
  }, [conversations, searchTerm]);

  const totalUnread = unreadData?.unread_count ?? 0;

  // ── Send handler ──
  async function handleSend(e) {
    e.preventDefault();
    if (!newContent.trim() && !newImage) return;
    const isBroadcast = selected === "broadcast";
    const subject = newSubject.trim() || "Sin asunto";
    setSending(true);
    try {
      let image_url = null;
      if (newImage) {
        const fd = new FormData();
        fd.append("file", newImage);
        const res = await api.uploadFile("/messages/upload-image", fd);
        image_url = res.url;
      }
      await sendMutation.mutateAsync({
        to_user_id: isBroadcast ? null : selected?.id,
        is_broadcast: isBroadcast,
        subject,
        content: newContent.trim() || (newImage ? (newFileName || "📎 Archivo") : "📷"),
        image_url,
      });
      setNewImage(null);
      setNewImagePreview(null);
      setNewFileName(null);
      if (newImageRef.current) newImageRef.current.value = "";
    } finally {
      setSending(false);
    }
  }

  // ── Quick-reply input (bottom of chat) ──
  const [quickMsg, setQuickMsg] = useState("");
  const [quickImage, setQuickImage] = useState(null);
  const [quickImagePreview, setQuickImagePreview] = useState(null);
  const [quickFileName, setQuickFileName] = useState(null);
  const quickRef = useRef(null);
  const quickImageRef = useRef(null);

  async function handleQuickSend(e) {
    e.preventDefault();
    if (!quickMsg.trim() && !quickImage || !selected) return;
    const isBroadcast = selected === "broadcast";
    setSending(true);
    try {
      let image_url = null;
      if (quickImage) {
        const fd = new FormData();
        fd.append("file", quickImage);
        const res = await api.uploadFile("/messages/upload-image", fd);
        image_url = res.url;
      }
      await sendMutation.mutateAsync({
        to_user_id: isBroadcast ? null : selected.id,
        is_broadcast: isBroadcast,
        subject: "Mensaje",
        content: quickMsg.trim() || (quickImage ? (quickFileName || "📎 Archivo") : "📷"),
        image_url,
      });
      setQuickMsg("");
      setQuickImage(null);
      setQuickImagePreview(null);
      setQuickFileName(null);
      if (quickImageRef.current) quickImageRef.current.value = "";
      quickRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  // ── UI ──────────────────────────────────────────────────────────────────────

  // Only show conversations with messages unless searching (search shows all)
  const visibleConvos = useMemo(() => {
    if (searchTerm.trim()) return filteredConvos;
    return filteredConvos.filter((c) => c.lastMsg !== null);
  }, [filteredConvos, searchTerm]);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden" style={{ background: "#f0f2f5" }}>

      {/* ── Left Panel: Conversation list ── */}
      <div
        className={`
          flex flex-col bg-white dark:bg-gray-900
          w-full sm:w-[340px] flex-shrink-0
          border-r border-gray-200 dark:border-gray-700
          ${mobileView === "chat" ? "hidden sm:flex" : "flex"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-white text-base">Mensajes</span>
            {totalUnread > 0 && (
              <span className="bg-green-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {totalUnread > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition"
                title="Marcar todo como leído"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => { setSelected(null); setNewSubject(""); setNewContent(""); setComposing(true); }}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition"
              title="Nuevo mensaje"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar o iniciar nueva conversación..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg outline-none focus:bg-white dark:focus:bg-gray-700 focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>
        </div>

        {/* Conversation items */}
        <div className="flex-1 overflow-y-auto">
          {visibleConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400 px-6 text-center">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-sm">
                {searchTerm ? "No se encontraron usuarios" : "No hay conversaciones aún"}
              </p>
              {!searchTerm && (
                <p className="text-xs">Usá el buscador para encontrar usuarios y escribirles</p>
              )}
            </div>
          )}
          {visibleConvos.map((conv) => {
            const isActive = selected === "broadcast"
              ? conv.id === "broadcast"
              : selected?.id === conv.id;
            const lastText = conv.lastMsg
              ? (conv.lastMsg.from_user_id === user?.id ? "Vos: " : "") + conv.lastMsg.content
              : "";
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setSelected(conv.id === "broadcast" ? "broadcast" : { id: conv.id, name: conv.name, role: conv.role });
                  setMobileView("chat");
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  border-b border-gray-50 dark:border-gray-800
                  ${isActive
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"}
                `}
              >
                <div className="relative flex-shrink-0">
                  <Avatar name={conv.name} broadcast={conv.isBroadcast} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm font-semibold truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                      {conv.name}
                    </span>
                    {conv.lastMsg && (
                      <span className={`text-xs flex-shrink-0 ${conv.unread > 0 ? "text-green-600 font-semibold" : "text-gray-400"}`}>
                        {fmtTime(conv.lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate flex-1 ${conv.unread > 0 ? "text-gray-700 dark:text-gray-200 font-medium" : "text-gray-500 dark:text-gray-400"}`}>
                      {lastText || (conv.role ? ROLE_LABEL[conv.role] || conv.role : "")}
                    </p>
                    {conv.unread > 0 && (
                      <span className="bg-green-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel: Chat view ── */}
      <div
        className={`
          flex-1 flex flex-col min-w-0
          ${mobileView === "list" ? "hidden sm:flex" : "flex"}
        `}
      >
        {selected ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
              <button
                onClick={() => setMobileView("list")}
                className="sm:hidden p-1 text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <Avatar
                name={selected === "broadcast" ? "Difusión" : selected.name}
                broadcast={selected === "broadcast"}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">
                  {selected === "broadcast" ? "📢 Difusión (todos)" : selected.name}
                </div>
                <div className="text-xs text-gray-400">
                  {selected !== "broadcast" && selected.role
                    ? ROLE_LABEL[selected.role] || selected.role
                    : selected === "broadcast" ? "Mensaje a todos los usuarios" : ""}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
              style={{
                backgroundImage: "radial-gradient(circle, #d4dde7 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                backgroundColor: "#e5ddd5",
              }}
            >
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="bg-white/80 dark:bg-gray-800/80 rounded-2xl px-6 py-4 flex flex-col items-center gap-2 shadow-sm">
                    <MessageSquare className="w-10 h-10 text-gray-300" />
                    <p className="text-sm text-gray-500">Sin mensajes todavía</p>
                    <p className="text-xs text-gray-400">Escribí abajo para enviar el primero</p>
                  </div>
                </div>
              )}
              {currentMessages.map((msg) => {
                const isMine = msg.from_user_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`group max-w-[75%] relative`}>
                      {/* Subject tag if not "Mensaje" */}
                      {msg.subject && msg.subject !== "Mensaje" && (
                        <div className={`text-xs font-semibold mb-0.5 ${isMine ? "text-right text-blue-300" : "text-left text-gray-500"}`}>
                          {msg.subject}
                        </div>
                      )}
                      <div
                        className={`
                          px-4 py-2.5 rounded-2xl text-sm relative
                          ${isMine
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-white dark:bg-gray-700 dark:text-white text-gray-900 shadow-sm rounded-bl-sm border border-gray-200 dark:border-gray-600"}
                        `}
                      >
                        {!isMine && selected === "broadcast" && (
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                            {msg.from_user_name}
                          </div>
                        )}
                        {msg.image_url && isImageUrl(msg.image_url) && (
                          <img
                            src={`${SERVER_BASE}${msg.image_url}`}
                            alt="imagen"
                            className="rounded-xl max-w-[240px] max-h-[300px] object-cover mb-1 cursor-pointer"
                            onClick={() => window.open(`${SERVER_BASE}${msg.image_url}`, "_blank")}
                          />
                        )}
                        {msg.image_url && !isImageUrl(msg.image_url) && (
                          <a
                            href={`${SERVER_BASE}${msg.image_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-lg text-sm font-medium underline ${isMine ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-600 text-blue-600 dark:text-blue-300"}`}
                          >
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{msg.image_url.split("/").pop()}</span>
                            <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        )}
                        {msg.content !== "📷" && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <div className={`flex items-center gap-1 mt-1 justify-end ${isMine ? "text-blue-200" : "text-gray-400"}`}>
                          <span className="text-xs">{fmtFull(msg.created_at)}</span>
                          {isMine && (
                            msg.is_read
                              ? <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                              : <Clock className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick reply input */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {quickImagePreview && (
                <div className="px-4 pt-2">
                  <div className="relative inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm max-w-full">
                    {isImageUrl(quickImage?.name || "") ? (
                      <img src={quickImagePreview} alt="preview" className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="truncate max-w-[200px] text-gray-700 dark:text-gray-200">{quickFileName}</span>
                    <button
                      type="button"
                      onClick={() => { setQuickImage(null); setQuickImagePreview(null); setQuickFileName(null); if (quickImageRef.current) quickImageRef.current.value = ""; }}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              <form
                onSubmit={handleQuickSend}
                className="flex items-end gap-2 px-4 py-3"
              >
                <input
                  ref={quickImageRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv,.mp4,.mov,.avi"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setQuickImage(f);
                    setQuickFileName(f.name);
                    if (f.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setQuickImagePreview(ev.target.result);
                      reader.readAsDataURL(f);
                    } else {
                      setQuickImagePreview("file");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => quickImageRef.current?.click()}
                  className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition flex-shrink-0"
                  title="Adjuntar archivo"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  ref={quickRef}
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleQuickSend(e);
                    }
                  }}
                  placeholder={
                    selected === "broadcast"
                      ? "Mensaje para todos..."
                      : `Mensaje para ${selected.name}...`
                  }
                  rows={1}
                  className="flex-1 resize-none px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-400 max-h-32 overflow-y-auto"
                />
                <button
                  type="submit"
                  disabled={(!quickMsg.trim() && !quickImage) || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 bg-gray-50 dark:bg-gray-900">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">Mensajería interna</h3>
            <p className="text-sm text-center max-w-xs">
              Seleccioná un usuario de la lista para ver su conversación, o usá <strong>Difusión</strong> para escribirle a todos a la vez.
            </p>
            <button
              onClick={() => { setSelected(null); setNewSubject(""); setNewContent(""); setComposing(true); }}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nuevo mensaje
            </button>
          </div>
        )}
      </div>

      {/* ── Compose Modal ── */}
      {composing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-500" /> Nuevo mensaje
              </h2>
              <button onClick={() => setComposing(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSend} className="p-5 space-y-4">
              {/* To */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Para</label>
                <select
                  required
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                  value={
                    selected === "broadcast"
                      ? "__broadcast__"
                      : selected?.id ?? ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__broadcast__") setSelected("broadcast");
                    else {
                      const u = users.find((u) => String(u.id) === v);
                      if (u) setSelected({ id: u.id, name: u.full_name, role: u.role });
                    }
                  }}
                >
                  <option value="">Seleccioná destinatario...</option>
                  <option value="__broadcast__">📢 Difusión — todos los usuarios</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({ROLE_LABEL[u.role] || u.role})
                    </option>
                  ))}
                </select>
              </div>
              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asunto <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Ej: Consulta sobre pedido..."
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mensaje</label>
                <textarea
                  required={!newImage}
                  rows={5}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Escribí tu mensaje acá..."
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              {/* Attachment */}
              <div>
                <input
                  ref={newImageRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv,.mp4,.mov,.avi"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setNewImage(f);
                    setNewFileName(f.name);
                    if (f.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setNewImagePreview(ev.target.result);
                      reader.readAsDataURL(f);
                    } else {
                      setNewImagePreview("file");
                    }
                  }}
                />
                {newImagePreview ? (
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm">
                    {newImagePreview !== "file" ? (
                      <img src={newImagePreview} alt="preview" className="h-10 w-10 object-cover rounded" />
                    ) : (
                      <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-200">{newFileName}</span>
                    <button
                      type="button"
                      onClick={() => { setNewImage(null); setNewImagePreview(null); setNewFileName(null); if (newImageRef.current) newImageRef.current.value = ""; }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => newImageRef.current?.click()}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition"
                  >
                    <Paperclip className="w-4 h-4" />
                    Adjuntar foto o archivo
                  </button>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
