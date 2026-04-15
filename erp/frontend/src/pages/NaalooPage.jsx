/**
 * NaalooPage.jsx — Portal del Empleado (estilo Naaloo)
 * Secciones: Bienvenida · Legajo · Buzón · Fichaje · Ausencias · Eventos · Docs públicos · Feed Social
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Clock, Calendar, FileText, Bell, Heart, MessageCircle,
  Send, Gift, Star, Users, Briefcase, ChevronDown, ChevronUp,
  Check, X, Plus, Trash2, Upload, Download, AlertCircle,
  LogIn, LogOut, Coffee, Sun, Sunset, Moon,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return { text: "¡Buenos días", icon: Sun };
  if (h < 18) return { text: "¡Buenas tardes", icon: Coffee };
  return { text: "¡Buenas noches", icon: Moon };
}

function formatRelative(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr.includes("T") ? fechaStr : fechaStr + "T00:00:00");
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "hace 1 día";
  if (diff < 30) return `hace ${diff} días`;
  const m = Math.floor(diff / 30);
  return `hace ${m} mes${m > 1 ? "es" : ""}`;
}

function formatDateES(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr.includes("T") ? fechaStr : fechaStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function mesAbrev(fechaStr) {
  if (!fechaStr) return "";
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const d = new Date(fechaStr + "T00:00:00");
  return meses[d.getMonth()];
}

function diaNum(fechaStr) {
  if (!fechaStr) return "";
  return new Date(fechaStr + "T00:00:00").getDate();
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ nombre = "", apellido = "", size = "md", bgColor = "bg-violet-600" }) {
  const sz = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg", xl: "w-20 h-20 text-2xl" }[size];
  const initials = `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();
  return (
    <div className={`${sz} ${bgColor} rounded-full text-white font-bold flex items-center justify-center shrink-0`}>
      {initials || "?"}
    </div>
  );
}

// ── Running Clock ─────────────────────────────────────────────────────────────

function RunningClock({ horaEntrada }) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!horaEntrada) return;
    const tick = () => {
      const now = new Date();
      const [h, m, s] = horaEntrada.split(":").map(Number);
      const start = new Date();
      start.setHours(h, m, s, 0);
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      const hh = String(Math.floor(diff / 3600)).padStart(2, "0");
      const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const ss = String(diff % 60).padStart(2, "0");
      setElapsed(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [horaEntrada]);

  return <span className="font-mono text-4xl font-bold text-gray-800 tabular-nums">{elapsed}</span>;
}

// ── Sección colapsable ────────────────────────────────────────────────────────

function Section({ title, icon: Icon, badge, children, defaultOpen = true, accent = "violet" }) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = {
    violet: "border-violet-200 bg-violet-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    rose: "border-rose-200 bg-rose-50",
  };
  const iconColors = {
    violet: "text-violet-600", emerald: "text-emerald-600",
    amber: "text-amber-600", blue: "text-blue-600", rose: "text-rose-600",
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition ${open ? colors[accent] : ""}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={18} className={iconColors[accent]} />
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {badge > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function NaalooPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tabAusencias, setTabAusencias] = useState("hoy");
  const [feedComment, setFeedComment] = useState({});
  const [newDocModal, setNewDocModal] = useState(false);
  const [newPostModal, setNewPostModal] = useState(false);

  const isAdmin = ["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(user?.role);
  const { text: greetText, icon: GreetIcon } = greetingByHour();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: home, isLoading: loadingHome } = useQuery({
    queryKey: ["naaloo-home"],
    queryFn: () => api.get("/rrhh/naaloo/home"),
    refetchInterval: 60_000,
  });

  const { data: inbox = [], isLoading: loadingInbox } = useQuery({
    queryKey: ["naaloo-inbox"],
    queryFn: () => api.get("/rrhh/naaloo/inbox"),
    refetchInterval: 60_000,
  });

  const { data: fichajeHoy, refetch: refetchFichaje } = useQuery({
    queryKey: ["naaloo-fichaje-hoy"],
    queryFn: () => api.get("/rrhh/naaloo/fichaje-hoy"),
    refetchInterval: 30_000,
  });

  const { data: docsPublicos = [] } = useQuery({
    queryKey: ["naaloo-docs-publicos"],
    queryFn: () => api.get("/rrhh/documentos-publicos"),
  });

  const { data: feed = [], isLoading: loadingFeed } = useQuery({
    queryKey: ["naaloo-feed"],
    queryFn: () => api.get("/rrhh/feed"),
    refetchInterval: 120_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const ficharMut = useMutation({
    mutationFn: () => api.post("/rrhh/naaloo/fichar"),
    onSuccess: () => {
      refetchFichaje();
      qc.invalidateQueries(["naaloo-home"]);
    },
  });

  const reaccionarMut = useMutation({
    mutationFn: ({ postId, emoji }) => api.post(`/rrhh/feed/${postId}/reaccionar?emoji=${encodeURIComponent(emoji)}`),
    onSuccess: () => qc.invalidateQueries(["naaloo-feed"]),
  });

  const comentarMut = useMutation({
    mutationFn: ({ postId, texto }) => api.post(`/rrhh/feed/${postId}/comentar`, { texto }),
    onSuccess: (_, { postId }) => {
      setFeedComment(p => ({ ...p, [postId]: "" }));
      qc.invalidateQueries(["naaloo-feed"]);
    },
  });

  const deleteDocMut = useMutation({
    mutationFn: (id) => api.delete(`/rrhh/documentos-publicos/${id}`),
    onSuccess: () => qc.invalidateQueries(["naaloo-docs-publicos"]),
  });

  const generarFeedMut = useMutation({
    mutationFn: () => api.post("/rrhh/naaloo/generar-feed"),
    onSuccess: () => qc.invalidateQueries(["naaloo-feed"]),
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const emp = home?.empleado;
  const legajoPct = home?.legajo_pct ?? 0;
  const ausencias = {
    hoy: home?.ausencias_hoy ?? [],
    manana: home?.ausencias_manana ?? [],
    proximas: home?.ausencias_proximas ?? [],
  };
  const eventos = home?.eventos ?? [];
  const fichaje = fichajeHoy?.fichaje;
  const vinculado = fichajeHoy?.empleado_vinculado;
  const entrando = fichaje && !fichaje.hora_salida;

  if (loadingHome) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* ── HEADER bienvenida ────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-violet-700 via-violet-600 to-purple-700 rounded-3xl overflow-hidden text-white shadow-xl">
        {/* Pattern decorativo */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
          {/* Avatar grande */}
          <div className="shrink-0">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-3xl font-bold shadow-lg">
              {emp ? `${emp.nombre[0]}${emp.apellido[0]}`.toUpperCase() : user?.full_name?.[0] ?? "?"}
            </div>
          </div>

          {/* Texto bienvenida */}
          <div className="flex-1 text-center md:text-left">
            <p className="text-white/70 text-sm flex items-center justify-center md:justify-start gap-1 mb-1">
              <GreetIcon size={14} /> {greetText}!
            </p>
            <h1 className="text-3xl font-bold mb-1">
              {emp ? `${emp.nombre}` : user?.full_name ?? "Empleado"}
            </h1>
            <p className="text-white/80 text-base">
              Te damos la bienvenida a <span className="font-semibold">Mundo Outdoor</span>
            </p>
            {emp?.cargo && (
              <p className="text-white/60 text-sm mt-1">
                {emp.cargo}{emp.departamento ? ` · ${emp.departamento}` : ""}
              </p>
            )}
          </div>

          {/* Cards derecha */}
          <div className="flex flex-col gap-3 shrink-0 w-full md:w-auto">
            {/* Legajo */}
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4 min-w-[180px]">
              <p className="text-white/70 text-xs mb-1 font-medium">Tu legajo</p>
              <p className="text-2xl font-bold mb-2">{legajoPct.toFixed(2)}%</p>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${legajoPct}%` }}
                />
              </div>
              {legajoPct < 100 && (
                <p className="text-white/60 text-xs mt-1">Completá tu perfil</p>
              )}
            </div>

            {/* Referí y ganá */}
            <div className="bg-white/15 backdrop-blur rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-white/20 transition">
              <div className="w-10 h-10 bg-yellow-400/30 rounded-xl flex items-center justify-center">
                <Gift size={20} className="text-yellow-300" />
              </div>
              <div>
                <p className="font-semibold text-sm">Referí y ganá</p>
                <p className="text-white/60 text-xs">Sumá a alguien al equipo</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRID principal ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── COLUMNA IZQUIERDA (2/3) ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* BUZÓN DE ENTRADA */}
          <Section title="Buzón de entrada" icon={Bell} badge={inbox.length} accent="violet" defaultOpen>
            {loadingInbox ? (
              <div className="py-4 text-center text-gray-400 text-sm">Cargando...</div>
            ) : inbox.length === 0 ? (
              <div className="py-6 text-center text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay notificaciones nuevas</p>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-gray-100">
                {inbox.map((item, i) => (
                  <InboxItem key={i} item={item} />
                ))}
              </div>
            )}
          </Section>

          {/* FEED SOCIAL */}
          <Section title="Actividad del equipo" icon={Users} accent="blue" defaultOpen>
            {/* Admin actions */}
            {isAdmin && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setNewPostModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                >
                  <Plus size={14} /> Nueva publicación
                </button>
                <button
                  onClick={() => generarFeedMut.mutate()}
                  disabled={generarFeedMut.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition disabled:opacity-50"
                >
                  <Gift size={14} /> Generar posts del día
                </button>
              </div>
            )}

            {loadingFeed ? (
              <div className="py-4 text-center text-gray-400 text-sm">Cargando feed...</div>
            ) : feed.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aún no hay publicaciones</p>
                {isAdmin && (
                  <p className="text-xs mt-1">Hacé clic en "Generar posts del día" para empezar</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {feed.map(post => (
                  <FeedCard
                    key={post.id}
                    post={post}
                    comment={feedComment[post.id] ?? ""}
                    onCommentChange={(v) => setFeedComment(p => ({ ...p, [post.id]: v }))}
                    onReaccionar={(emoji) => reaccionarMut.mutate({ postId: post.id, emoji })}
                    onComentar={() => {
                      const txt = feedComment[post.id];
                      if (txt?.trim()) comentarMut.mutate({ postId: post.id, texto: txt.trim() });
                    }}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── COLUMNA DERECHA (1/3) ────────────────────────────────────── */}
        <div className="space-y-5">

          {/* GESTIÓN DEL TIEMPO */}
          <Section title="Gestión del tiempo" icon={Clock} accent="emerald" defaultOpen>
            <FichajeWidget
              fichaje={fichaje}
              vinculado={vinculado}
              entrando={entrando}
              onFichar={() => ficharMut.mutate()}
              loading={ficharMut.isPending}
            />
          </Section>

          {/* AUSENCIAS */}
          <Section title="Ausencias" icon={Calendar} badge={ausencias.hoy.length} accent="amber" defaultOpen>
            <div className="flex gap-1 mb-3">
              {[["hoy", "Hoy"], ["manana", "Mañana"], ["proximas", "Próximas"]].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTabAusencias(k)}
                  className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                    tabAusencias === k
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {l}
                  {k === "hoy" && ausencias.hoy.length > 0 && (
                    <span className="ml-1 bg-white/30 text-white text-xs px-1 rounded-full">{ausencias.hoy.length}</span>
                  )}
                </button>
              ))}
            </div>
            {ausencias[tabAusencias].length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-3">Sin ausencias registradas</p>
            ) : (
              <div className="space-y-2">
                {ausencias[tabAusencias].map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5">
                    <Avatar nombre={a.empleado_nombre.split(" ")[0]} apellido={a.empleado_nombre.split(" ")[1] ?? ""} size="sm" bgColor="bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.empleado_nombre}</p>
                      <p className="text-xs text-gray-500">
                        {formatDateES(a.fecha_desde)}
                        {a.fecha_desde !== a.fecha_hasta ? ` — ${formatDateES(a.fecha_hasta)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* EVENTOS */}
          <Section title="Eventos" icon={Gift} accent="rose" defaultOpen>
            {eventos.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-3">Sin eventos próximos</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {eventos.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 text-center shrink-0">
                      <p className="text-xs text-gray-500 uppercase font-medium">{mesAbrev(ev.fecha)}</p>
                      <p className="text-lg font-bold text-gray-800 leading-none">{diaNum(ev.fecha)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{ev.icono} {ev.titulo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* DOCUMENTOS PÚBLICOS */}
          <Section title="Documentos públicos" icon={FileText} accent="blue">
            {isAdmin && (
              <button
                onClick={() => setNewDocModal(true)}
                className="w-full mb-3 flex items-center justify-center gap-1 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
              >
                <Plus size={14} /> Subir documento
              </button>
            )}
            {docsPublicos.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-3">No hay documentos</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {docsPublicos.map(doc => (
                  <DocPublicoItem key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={() => deleteDocMut.mutate(doc.id)} />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}
      {newDocModal && (
        <NuevoDocModal
          onClose={() => setNewDocModal(false)}
          onSaved={() => { setNewDocModal(false); qc.invalidateQueries(["naaloo-docs-publicos"]); }}
        />
      )}
      {newPostModal && (
        <NuevoPostModal
          onClose={() => setNewPostModal(false)}
          onSaved={() => { setNewPostModal(false); qc.invalidateQueries(["naaloo-feed"]); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function InboxItem({ item }) {
  const ICON_MAP = {
    DOCUMENTO_FIRMAR: "✍️",
    COMUNICACION: "📢",
    CUMPLEANOS: "🎈",
    ANIVERSARIO: "🎉",
    PRIMER_DIA: "🐣",
  };
  const BG_MAP = {
    DOCUMENTO_FIRMAR: "bg-orange-100",
    COMUNICACION: "bg-blue-100",
    CUMPLEANOS: "bg-pink-100",
    ANIVERSARIO: "bg-green-100",
    PRIMER_DIA: "bg-yellow-100",
  };
  return (
    <div className="flex items-start gap-3 py-3 hover:bg-gray-50 rounded-lg px-1 transition cursor-pointer">
      <div className={`w-9 h-9 rounded-full ${BG_MAP[item.tipo] ?? "bg-gray-100"} flex items-center justify-center text-lg shrink-0`}>
        {ICON_MAP[item.tipo] ?? "🔔"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{item.titulo}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {item.subtitulo}
          {item.fecha && <span className="ml-2 text-gray-400">{item.fecha}</span>}
        </p>
      </div>
    </div>
  );
}

// ── Fichaje Widget ────────────────────────────────────────────────────────────

function FichajeWidget({ fichaje, vinculado, entrando, onFichar, loading }) {
  const now = new Date();
  const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fecha = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

  return (
    <div className="text-center space-y-3">
      {fichaje?.hora_entrada && !fichaje.hora_salida ? (
        <RunningClock horaEntrada={fichaje.hora_entrada} />
      ) : (
        <div className="font-mono text-4xl font-bold text-gray-800 tabular-nums">{hora}</div>
      )}
      <p className="text-sm text-gray-500">{fecha} {hora}</p>

      {fichaje && (
        <div className="flex justify-center gap-4 text-xs text-gray-600">
          {fichaje.hora_entrada && (
            <span className="flex items-center gap-1">
              <LogIn size={12} className="text-emerald-600" />
              Entrada: <b>{fichaje.hora_entrada.slice(0, 5)}</b>
            </span>
          )}
          {fichaje.hora_salida && (
            <span className="flex items-center gap-1">
              <LogOut size={12} className="text-rose-600" />
              Salida: <b>{fichaje.hora_salida.slice(0, 5)}</b>
            </span>
          )}
        </div>
      )}

      {fichaje?.horas_trabajadas && (
        <p className="text-xs text-emerald-700 font-medium">
          ✅ {fichaje.horas_trabajadas.toFixed(2)}h trabajadas hoy
        </p>
      )}

      {!vinculado ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <AlertCircle size={14} className="inline mr-1" />
          Tu usuario no tiene empleado vinculado. Pedile al admin que te asigne.
        </div>
      ) : (
        <button
          onClick={onFichar}
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50 shadow-sm ${
            entrando
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {loading ? "..." : entrando
            ? "⏹ Registrar Salida"
            : fichaje?.hora_salida
              ? "▶ Nuevo Turno"
              : "▶ Registrar Entrada"
          }
        </button>
      )}
    </div>
  );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────

const TIPO_COLORS = {
  CUMPLEANOS:  { bg: "from-pink-500 to-rose-600",    emoji: "🎂" },
  ANIVERSARIO: { bg: "from-emerald-500 to-teal-600", emoji: "📣" },
  PRIMER_DIA:  { bg: "from-blue-500 to-indigo-600",  emoji: "🐣" },
  MANUAL:      { bg: "from-violet-500 to-purple-600", emoji: "📢" },
};

function FeedCard({ post, comment, onCommentChange, onReaccionar, onComentar }) {
  const [showComments, setShowComments] = useState(false);
  const colors = TIPO_COLORS[post.tipo] ?? TIPO_COLORS.MANUAL;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Header con gradiente */}
      <div className={`bg-gradient-to-r ${colors.bg} px-4 py-3 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-lg">
          {colors.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug">{post.titulo}</p>
          <p className="text-white/70 text-xs mt-0.5">
            {post.creado_por_nombre ?? "Mundo Outdoor"} · {formatRelative(post.created_at)}
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      {post.cuerpo && (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700">{post.cuerpo}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="px-4 py-2 border-t border-gray-50 flex items-center gap-3">
        <button
          onClick={() => onReaccionar("❤️")}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition font-medium ${
            post.yo_reaccione
              ? "bg-red-100 text-red-600 hover:bg-red-50"
              : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500"
          }`}
        >
          <Heart size={13} fill={post.yo_reaccione ? "currentColor" : "none"} />
          {post.total_reacciones > 0 && post.total_reacciones}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-500 transition font-medium"
        >
          <MessageCircle size={13} />
          {post.comentarios?.length > 0 ? post.comentarios.length : "Comentar"}
        </button>

        {/* Mostrar emojis propios */}
        {post.mis_emojis?.length > 0 && (
          <span className="text-xs text-gray-400 ml-auto">{post.mis_emojis.join("")}</span>
        )}
      </div>

      {/* Comentarios */}
      {showComments && (
        <div className="px-4 pb-3 border-t border-gray-50 bg-gray-50/50 space-y-2 pt-2">
          {post.comentarios?.map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {c.empleado_nombre[0]}
              </div>
              <div className="flex-1 bg-white rounded-xl px-2.5 py-1.5 shadow-sm">
                <p className="text-xs font-semibold text-gray-700">{c.empleado_nombre}</p>
                <p className="text-xs text-gray-600">{c.texto}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onComentar()}
              placeholder="Escribí un comentario..."
              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
            <button
              onClick={onComentar}
              disabled={!comment?.trim()}
              className="w-8 h-8 bg-violet-600 text-white rounded-xl flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Doc Público Item ──────────────────────────────────────────────────────────

function DocPublicoItem({ doc, isAdmin, onDelete }) {
  const handleDownload = () => {
    if (!doc.archivo_base64) return;
    const link = document.createElement("a");
    link.href = `data:${doc.archivo_mime ?? "application/octet-stream"};base64,${doc.archivo_base64}`;
    link.download = doc.archivo_nombre ?? doc.nombre;
    link.click();
  };

  return (
    <div className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded-lg px-1 group">
      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
        <FileText size={15} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{doc.nombre}</p>
        {doc.descripcion && <p className="text-xs text-gray-400 truncate">{doc.descripcion}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        {doc.archivo_base64 && (
          <button onClick={handleDownload} className="p-1 hover:bg-blue-50 rounded-lg" title="Descargar">
            <Download size={13} className="text-blue-600" />
          </button>
        )}
        {isAdmin && (
          <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded-lg" title="Eliminar">
            <Trash2 size={13} className="text-red-500" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal Nuevo Doc Público ───────────────────────────────────────────────────

function NuevoDocModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", descripcion: "", archivo_base64: "", archivo_nombre: "", archivo_mime: "" });
  const [error, setError] = useState("");
  const fileRef = useRef();

  const mut = useMutation({
    mutationFn: (data) => api.post("/rrhh/documentos-publicos", data),
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setForm(p => ({ ...p, archivo_base64: base64, archivo_nombre: file.name, archivo_mime: file.type }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-800">Subir documento público</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: Reglamento interno"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Breve descripción..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo (opcional)</label>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-violet-400 hover:text-violet-600 transition"
            >
              <Upload size={16} className="inline mr-2" />
              {form.archivo_nombre ? form.archivo_nombre : "Seleccionar archivo"}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancelar</button>
          <button
            onClick={() => { if (!form.nombre) { setError("Nombre requerido"); return; } mut.mutate(form); }}
            disabled={mut.isPending}
            className="flex-1 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
          >
            {mut.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Nuevo Post ──────────────────────────────────────────────────────────

function NuevoPostModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ titulo: "", cuerpo: "" });
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: (data) => api.post("/rrhh/feed", data),
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-800">Nueva publicación</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Ej: 📢 Comunicado importante"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo</label>
            <textarea
              value={form.cuerpo}
              onChange={e => setForm(p => ({ ...p, cuerpo: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              placeholder="Escribí el contenido del post..."
            />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Cancelar</button>
          <button
            onClick={() => { if (!form.titulo) { setError("Título requerido"); return; } mut.mutate(form); }}
            disabled={mut.isPending}
            className="flex-1 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
          >
            {mut.isPending ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
