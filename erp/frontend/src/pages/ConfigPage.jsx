import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { syncAllCatalogs, getSyncStatus } from "../lib/offlineSync";
import { clearStore } from "../lib/offlineDB";
import {
  Settings, User, MapPin, Users, Server,
  RefreshCw, Download, Check, AlertCircle,
  Shield, KeyRound, Pencil, X, Save, Power,
  ExternalLink, Database, Cpu, Globe,
  Fingerprint, Trash2, Plus,
} from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import { isPlatformAuthenticatorAvailable, createCredential } from "../lib/webauthn";

const ROLES = ["SUPERADMIN","ADMIN","COMPRAS","ADMINISTRACION","GESTION_PAGOS","LOCAL","VENDEDOR","DEPOSITO"];

const ROLE_COLORS = {
  SUPERADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-blue-100 text-blue-700",
  COMPRAS: "bg-violet-100 text-violet-700",
  ADMINISTRACION: "bg-amber-100 text-amber-700",
  GESTION_PAGOS: "bg-emerald-100 text-emerald-700",
  LOCAL: "bg-indigo-100 text-indigo-700",
  VENDEDOR: "bg-cyan-100 text-cyan-700",
  DEPOSITO: "bg-slate-100 text-slate-700",
};

const ROLE_LABELS = {
  SUPERADMIN: "Super Admin", ADMIN: "Administrador", COMPRAS: "Compras",
  ADMINISTRACION: "Administración", GESTION_PAGOS: "Gestión de Pagos",
  LOCAL: "Local", VENDEDOR: "Vendedor", DEPOSITO: "Depósito",
};

/* ─── helpers ─── */
function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || "—"}</p>
    </div>
  );
}

function Alert({ ok, text }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {ok ? <Check size={15} /> : <AlertCircle size={15} />} {text}
    </div>
  );
}

/* ═══════════════════════════════════ BIOMETRIC SECTION ══════════════════════ */
function BiometricSection() {
  const qc = useQueryClient();
  const [deviceName, setDeviceName] = useState("");
  const [msg, setMsg] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [hasPlatformAuth, setHasPlatformAuth] = useState(null);

  useState(() => {
    isPlatformAuthenticatorAvailable().then(setHasPlatformAuth).catch(() => setHasPlatformAuth(false));
  });

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["webauthn-creds"],
    queryFn: () => api.get("/auth/webauthn/credentials"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/auth/webauthn/credentials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webauthn-creds"] }); setMsg({ ok: true, text: "Credencial eliminada" }); },
    onError: (e) => setMsg({ ok: false, text: e.message }),
  });

  const handleRegister = async () => {
    setMsg(null);
    setRegistering(true);
    try {
      const begin = await api.post("/auth/webauthn/register/begin", {});
      const credData = await createCredential(begin);
      await api.post("/auth/webauthn/register/complete", {
        ...credData,
        challenge: begin.challenge,
        device_name: deviceName.trim() || null,
      });
      qc.invalidateQueries({ queryKey: ["webauthn-creds"] });
      setMsg({ ok: true, text: "¡Huella / Windows Hello registrado correctamente! Ya podés usarlo en el login." });
      setDeviceName("");
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "AbortError") {
        setMsg({ ok: false, text: "Registro cancelado por el usuario." });
      } else {
        setMsg({ ok: false, text: err.message || "Error al registrar" });
      }
    } finally {
      setRegistering(false);
    }
  };

  if (hasPlatformAuth === false) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3"><Fingerprint size={16} /> Windows Hello / Huella dactilar</h2>
        <p className="text-sm text-gray-500">Este dispositivo no tiene autenticador biométrico disponible (Windows Hello, huella, etc.).</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Fingerprint size={16} /> Windows Hello / Huella dactilar</h2>
      <p className="text-sm text-gray-500">Registrá tu huella o Windows Hello en esta PC para entrar al sistema sin contraseña.</p>

      {msg && <Alert ok={msg.ok} text={msg.text} />}

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando credenciales…</p>
      ) : creds.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Dispositivos registrados:</p>
          {creds.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.device_name || "Dispositivo sin nombre"}</p>
                <p className="text-xs text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : ""}</p>
              </div>
              <button
                onClick={() => deleteMut.mutate(c.id)}
                disabled={deleteMut.isPending}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No hay dispositivos registrados todavía.</p>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-3">
        <p className="text-xs font-medium text-gray-600">Registrar esta PC:</p>
        <input
          value={deviceName}
          onChange={e => setDeviceName(e.target.value)}
          placeholder='Nombre del dispositivo (ej: "PC Jefe")'
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleRegister}
          disabled={registering || hasPlatformAuth === null}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium transition"
        >
          <Fingerprint size={15} /> {registering ? "Registrando…" : "Registrar huella / Windows Hello"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ TAB 1: PERFIL ═══════════════════════════════════ */
function PerfilTab() {
  const { user } = useAuth();
  const { app_name } = useBranding();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [msg, setMsg] = useState(null);

  const changePw = useMutation({
    mutationFn: (data) => api.put("/auth/me/password", data),
    onSuccess: () => {
      setMsg({ ok: true, text: "Contraseña actualizada correctamente" });
      setForm({ current_password: "", new_password: "", confirm: "" });
    },
    onError: (e) => setMsg({ ok: false, text: e.message || "Error al actualizar" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.new_password !== form.confirm) { setMsg({ ok: false, text: "Las contraseñas no coinciden" }); return; }
    if (form.new_password.length < 6) { setMsg({ ok: false, text: "Mínimo 6 caracteres" }); return; }
    changePw.mutate({ current_password: form.current_password, new_password: form.new_password });
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none";

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><User size={16} /> Información de cuenta</h2>
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.full_name || user?.username}</p>
            <p className="text-sm text-gray-400">@{user?.username}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" value={user?.email} />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Rol</p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user?.role] || "bg-gray-100 text-gray-700"}`}>
              <Shield size={11} className="mr-1 mt-0.5" /> {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
          <Field label="Empresa" value={user?.company_name || "Global"} />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Estado</p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${user?.is_active ? "text-emerald-600" : "text-gray-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${user?.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
              {user?.is_active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p>Plan del sistema: <span className="font-medium text-gray-600">{app_name} v1.0.0</span></p>
          <p>ID de usuario: <span className="font-mono text-gray-600">{user?.id ?? "—"}</span></p>
        </div>
      </div>

      {/* Password change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><KeyRound size={16} /> Cambiar contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
            <input type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} className={inp} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
            <input type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} className={inp} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
            <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className={inp} required />
          </div>
          {msg && <Alert ok={msg.ok} text={msg.text} />}
          <button
            type="submit"
            disabled={changePw.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium transition"
          >
            <KeyRound size={15} /> {changePw.isPending ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
    <div className="mt-6">
      <BiometricSection />
    </div>
    </>
  );
}

/* ═══════════════════════════════════ TAB 2: LOCALES ══════════════════════════════════ */
function LocalesTab() {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState(null);

  const { data: locals = [], isLoading } = useQuery({
    queryKey: ["locals-config"],
    queryFn: () => api.get("/locals/?limit=100"),
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  const updateLocal = useMutation({
    mutationFn: ({ id, data }) => api.put(`/locals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locals-config"] });
      queryClient.invalidateQueries({ queryKey: ["locals"] });
      setEditId(null);
      setMsg({ ok: true, text: "Local actualizado" });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e) => setMsg({ ok: false, text: e.message }),
  });

  const startEdit = (l) => {
    setEditId(l.id);
    setEditForm({ name: l.name, address: l.address || "", phone: l.phone || "", is_active: l.is_active });
    setMsg(null);
  };

  const cancelEdit = () => { setEditId(null); setMsg(null); };

  const saveEdit = (id) => {
    updateLocal.mutate({ id, data: editForm });
  };

  const inp = "px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full";

  return (
    <div className="space-y-4">
      {msg && <Alert ok={msg.ok} text={msg.text} />}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Dirección</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Teléfono</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Activo</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Cargando…</td></tr>
              ) : locals.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No hay locales</td></tr>
              ) : locals.map((l) => (
                editId === l.id ? (
                  /* ── edit row ── */
                  <tr key={l.id} className="bg-blue-50/40">
                    <td className="py-2 px-4"><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inp} /></td>
                    <td className="py-2 px-4"><input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className={inp} /></td>
                    <td className="py-2 px-4"><input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={inp} /></td>
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition ${editForm.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        <Power size={11} /> {editForm.is_active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEdit(l.id)} disabled={updateLocal.isPending} className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition" title="Guardar"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition" title="Cancelar"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* ── view row ── */
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900">{l.name}</td>
                    <td className="py-3 px-4 text-gray-500">{l.address || "—"}</td>
                    <td className="py-3 px-4 text-gray-500">{l.phone || "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${l.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                        {l.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => startEdit(l)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition" title="Editar">
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ TAB 3: USUARIOS ════════════════════════════════ */
function UsuariosTab() {
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-config"],
    queryFn: () => api.get("/users/?limit=200"),
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
    enabled: ["SUPERADMIN", "ADMIN"].includes(me?.role),
  });

  const { data: locals = [] } = useQuery({
    queryKey: ["locals-config"],
    queryFn: () => api.get("/locals/?limit=100"),
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
  });

  const localMap = Object.fromEntries(locals.map(l => [l.id, l.name]));

  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Role summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ROLES.filter(r => roleCounts[r] > 0).map(r => (
          <div key={r} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{roleCounts[r]}</p>
            <span className={`inline-flex px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r] || r}</span>
          </div>
        ))}
      </div>

      {/* Quick link */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} usuarios registrados · {users.filter(u => u.is_active).length} activos</p>
        <button
          onClick={() => navigate("/usuarios")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
        >
          Gestionar usuarios <ExternalLink size={14} />
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Rol</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Local</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Cargando…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Sin usuarios</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-400">@{u.username}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{u.email || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100"}`}>{u.role}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{u.local_id ? (localMap[u.local_id] || `#${u.local_id}`) : "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />
                      {u.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ TAB 4: SISTEMA ═════════════════════════════════ */
function SistemaTab() {
  const { user: me } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState(null);

  const { data: users = [] } = useQuery({
    queryKey: ["users-config"],
    queryFn: () => api.get("/users/?limit=200"),
    select: (d) => (Array.isArray(d) ? d : d?.items ?? []),
    enabled: ["SUPERADMIN", "ADMIN"].includes(me?.role),
  });

  const { data: health } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => api.get("/system/health"),
    enabled: ["SUPERADMIN", "ADMIN"].includes(me?.role),
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAllCatalogs();
      if (result?.ok === false) {
        setSyncResult({ ok: false, msg: result.reason || "No se pudo sincronizar" });
      } else {
        const counts = Object.entries(result || {})
          .map(([k, v]) => `${k}: ${v?.count ?? "?"}`)
          .join(", ");
        setSyncResult({ ok: true, msg: `Sincronizado — ${counts}` });
      }
    } catch (e) {
      setSyncResult({ ok: false, msg: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    setClearing(true);
    setClearResult(null);
    try {
      const stores = ["catalogProducts", "catalogStock", "catalogProviders", "catalogLocals", "recentOrders"];
      await Promise.all(stores.map(s => clearStore(s)));
      setClearResult({ ok: true, msg: "Caché local limpiado correctamente" });
    } catch (e) {
      setClearResult({ ok: false, msg: e.message });
    } finally {
      setClearing(false);
    }
  };

  const handleExportUsers = () => {
    if (!users.length) return;
    const header = ["id", "username", "full_name", "email", "role", "is_active"];
    const rows = users.map(u => header.map(k => JSON.stringify(u[k] ?? "")).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_erp_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const infoCards = [
    { icon: Database, label: "Base de datos", value: "PostgreSQL 18", detail: "Puerto 2048" },
    { icon: Server, label: "Backend", value: "FastAPI 0.115", detail: "Python 3.12" },
    { icon: Globe, label: "Frontend", value: "React 19 + Vite 8", detail: "Tailwind v4" },
    { icon: Cpu, label: "API base", value: `:8000/api/v1`, detail: health?.status === "healthy" ? "🟢 Online" : "🔴 Offline" },
  ];

  return (
    <div className="space-y-6">
      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {infoCards.map(({ icon: Icon, label, value, detail }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} className="text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">{label}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{detail}</p>
          </div>
        ))}
      </div>

      {/* Version + misc info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
        <h3 className="font-semibold text-gray-800">Información del entorno</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Versión ERP" value="v1.0.0" />
          <Field label="Entorno" value="Producción" />
          <Field label="Base de datos" value="erp_mundooutdoor" />
          <Field label="Host DB" value="localhost:2048" />
        </div>
        <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
          <p>Legacy SQL Server: <span className="font-mono">192.168.0.109:9970</span> — datos copiados al schema <span className="font-mono">legacy.*</span></p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Acciones rápidas</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium transition"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando…" : "Sincronizar catálogo offline"}
          </button>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60 text-sm font-medium transition"
          >
            <X size={15} /> {clearing ? "Limpiando…" : "Limpiar caché local"}
          </button>
          <button
            onClick={handleExportUsers}
            disabled={!users.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 text-sm font-medium transition"
          >
            <Download size={15} /> Exportar usuarios (CSV)
          </button>
        </div>
        {syncResult && <Alert ok={syncResult.ok} text={syncResult.msg} />}
        {clearResult && <Alert ok={clearResult.ok} text={clearResult.msg} />}
      </div>

      {/* System health (if available) */}
      {health && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-800">Estado del sistema</h3>
          <div className="divide-y divide-gray-100 text-sm">
            {[
              ["Estado API", health.status === "healthy" ? "🟢 Saludable" : `🔴 ${health.status}`],
              ["Base de datos", health.database === "connected" ? "🟢 Conectada" : `🔴 ${health.database}`],
              ["Versión API", health.version || "1.0.0"],
              ["Uptime", health.uptime || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium text-gray-900">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════ MAIN PAGE ══════════════════════════════════════ */
export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState("perfil");

  const tabs = [
    { id: "perfil",   label: "Mi Perfil", icon: User   },
    { id: "locales",  label: "Locales",   icon: MapPin  },
    { id: "usuarios", label: "Usuarios",  icon: Users   },
    { id: "sistema",  label: "Sistema",   icon: Server  },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "perfil"   && <PerfilTab />}
      {activeTab === "locales"  && <LocalesTab />}
      {activeTab === "usuarios" && <UsuariosTab />}
      {activeTab === "sistema"  && <SistemaTab />}
    </div>
  );
}
