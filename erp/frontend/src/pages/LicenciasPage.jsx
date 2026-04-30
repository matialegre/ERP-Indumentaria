import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Key, ShieldCheck, ShieldOff, ShieldAlert, RefreshCw,
  Copy, CheckCircle2, XCircle, Clock, Ban, Loader2, ChevronDown,
  Monitor, CheckCircle, AlertCircle, Inbox,
} from "lucide-react";

const STATUS_CONFIG = {
  ACTIVE:    { label: "Activo",     icon: ShieldCheck,  bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  TRIAL:     { label: "Trial",      icon: Clock,        bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200"    },
  EXPIRED:   { label: "Vencido",    icon: ShieldAlert,  bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200"   },
  SUSPENDED: { label: "Suspendido", icon: ShieldOff,    bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200"     },
  CANCELLED: { label: "Cancelado",  icon: Ban,          bg: "bg-gray-100",    text: "text-gray-500",    border: "border-gray-200"    },
};

function SerialBadge({ serial }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(serial || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!serial) return <span className="text-gray-300 text-xs italic">Sin serial</span>;

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 font-mono text-sm bg-gray-900 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition group"
      title="Copiar número de serie"
    >
      {serial}
      {copied
        ? <CheckCircle2 size={13} className="text-emerald-400" />
        : <Copy size={13} className="text-gray-500 group-hover:text-emerald-400 transition" />
      }
    </button>
  );
}

function StatusDropdown({ subId, current, onChangeStatus }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[current] ?? STATUS_CONFIG.ACTIVE;
  const Icon = cfg.icon;

  const options = Object.entries(STATUS_CONFIG).filter(([s]) => s !== current);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80 transition`}
      >
        <Icon size={12} />
        {cfg.label}
        <ChevronDown size={11} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[160px]">
            {options.map(([s, c]) => {
              const IcoOpt = c.icon;
              return (
                <button
                  key={s}
                  onClick={() => {
                    onChangeStatus(subId, s);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-50 transition text-left"
                >
                  <IcoOpt size={13} className={c.text} />
                  <span className={`font-medium ${c.text}`}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Tab: Solicitudes de PC
// ══════════════════════════════════════════════════════════════
function PCRequestsTab() {
  const qc = useQueryClient();
  const [approveModal, setApproveModal] = useState(null); // { id, machine_id, hostname }
  const [localId, setLocalId] = useState("1");
  const [noteText, setNoteText] = useState("");

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ["pc-license-requests"],
    queryFn: () => api.get("/pc-licenses/requests"),
    refetchInterval: 15_000,
  });

  const { data: locals = [] } = useQuery({
    queryKey: ["locals-simple"],
    queryFn: () => api.get("/locals"),
    staleTime: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ reqId, localId, note }) =>
      api.post(`/pc-licenses/requests/${reqId}/approve`, { local_id: parseInt(localId), description: "", note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pc-license-requests"] });
      setApproveModal(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ reqId, note }) =>
      api.post(`/pc-licenses/requests/${reqId}/reject?note=${encodeURIComponent(note)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pc-license-requests"] }),
  });

  const pending = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-violet-600" />
          <h2 className="text-lg font-semibold text-gray-900">Solicitudes de licencias de PC</h2>
          {pending.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-700">
        <p className="font-semibold mb-1">¿Qué es esto?</p>
        <p>Cuando una PC sin licencia abre el ERP, puede solicitar una al admin. Aparece acá como pendiente. 
           Al aprobarla, se genera automáticamente una clave PC-XXXX-XXXX-XXXX-XXXX vinculada a esa PC específica — no puede copiarse a otra máquina.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Inbox size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No hay solicitudes</p>
          <p className="text-sm mt-1">Cuando una PC solicite licencia, aparecerá acá.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">⏳ Pendientes ({pending.length})</h3>
              <div className="space-y-2">
                {pending.map(r => (
                  <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Monitor size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{r.hostname || "PC sin nombre"}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{r.machine_id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.os_info} · {r.created_at ? new Date(r.created_at).toLocaleString("es-AR") : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setApproveModal(r); setLocalId(locals[0]?.id?.toString() || "1"); setNoteText(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                      >
                        <CheckCircle size={13} /> Aprobar
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ reqId: r.id, note: "" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition"
                      >
                        <XCircle size={13} /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approved.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">✅ Aprobadas ({approved.length})</h3>
              <div className="space-y-2">
                {approved.map(r => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                    <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{r.hostname || r.machine_id.substring(0, 20)}</p>
                      <p className="text-xs font-mono text-violet-600">{r.approved_key}</p>
                    </div>
                    <p className="text-xs text-gray-400">{r.updated_at ? new Date(r.updated_at).toLocaleString("es-AR") : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rejected.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">🚫 Rechazadas ({rejected.length})</h3>
              <div className="space-y-2">
                {rejected.map(r => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 opacity-60">
                    <AlertCircle size={18} className="text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700">{r.hostname || r.machine_id.substring(0, 20)}</p>
                      {r.note && <p className="text-xs text-gray-400">{r.note}</p>}
                    </div>
                    <p className="text-xs text-gray-400">{r.updated_at ? new Date(r.updated_at).toLocaleString("es-AR") : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Aprobar solicitud</h3>
            <p className="text-sm text-gray-500 mb-4">PC: <span className="font-mono text-xs">{approveModal.hostname || approveModal.machine_id.substring(0, 20)}</span></p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Local asignado</label>
            <select
              value={localId}
              onChange={e => setLocalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-violet-500 outline-none"
            >
              {locals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Ej: PC del depósito"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-violet-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => approveMutation.mutate({ reqId: approveModal.id, localId, note: noteText })}
                disabled={approveMutation.isPending}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {approveMutation.isPending ? "Aprobando..." : "✓ Aprobar y generar clave"}
              </button>
              <button
                onClick={() => setApproveModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LicenciasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("empresas");
  const [regeneratingId, setRegeneratingId] = useState(null);

  const { data: licenses = [], isLoading, refetch } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => api.get("/plans/licenses"),
    staleTime: 15_000,
  });

  // Count pending PC requests for badge
  const { data: pcRequests = [] } = useQuery({
    queryKey: ["pc-license-requests"],
    queryFn: () => api.get("/pc-licenses/requests"),
    refetchInterval: 15_000,
  });
  const pendingCount = pcRequests.filter(r => r.status === "pending").length;

  const statusMutation = useMutation({
    mutationFn: ({ subId, status }) =>
      api.patch(`/plans/licenses/${subId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["licenses"] }),
  });

  const regenMutation = useMutation({
    mutationFn: (subId) => api.post(`/plans/licenses/${subId}/regenerate-serial`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licenses"] });
      setRegeneratingId(null);
    },
  });

  const handleRegenerate = (subId, companyName) => {
    if (confirm(`¿Regenerar el número de serie de "${companyName}"?\nEl anterior quedará inválido.`)) {
      setRegeneratingId(subId);
      regenMutation.mutate(subId);
    }
  };

  const active = licenses.filter(l => l.status === "ACTIVE").length;
  const trial  = licenses.filter(l => l.status === "TRIAL").length;
  const suspended = licenses.filter(l => l.status === "SUSPENDED").length;
  const expired   = licenses.filter(l => l.status === "EXPIRED").length;

  const TABS = [
    { id: "empresas", label: "Licencias de empresa", icon: Key },
    { id: "pc", label: "Solicitudes de PC", icon: Monitor, badge: pendingCount },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <Key size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Licencias del ERP</h1>
            <p className="text-sm text-gray-500">Control de acceso por empresa y por PC</p>
          </div>
        </div>
        {tab === "empresas" && (
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition relative ${
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "pc" ? (
        <PCRequestsTab />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Activas",     value: active,    color: "bg-emerald-500" },
              { label: "Trial",       value: trial,     color: "bg-blue-500"    },
              { label: "Suspendidas", value: suspended, color: "bg-red-500"     },
              { label: "Vencidas",    value: expired,   color: "bg-amber-500"   },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bloqueo explicado */}
          <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
            <ShieldOff size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">¿Cómo funciona el bloqueo?</p>
              <p>Al poner una licencia en <span className="font-semibold text-red-600">Suspendido</span> o <span className="font-semibold text-gray-600">Cancelado</span>, todos los usuarios de esa empresa reciben un error al intentar hacer login. El acceso se restablece automáticamente al volver el estado a <span className="font-semibold text-emerald-600">Activo</span> o <span className="font-semibold text-blue-600">Trial</span>.</p>
            </div>
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : licenses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Key size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium">No hay licencias registradas</p>
              <p className="text-sm mt-1">Asigná un plan a una empresa desde Mega Admin para generar el primer serial.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Empresa</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Número de serie</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Plan</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Vence</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {licenses.map(lic => {
                    const isRegen = regeneratingId === lic.sub_id;
                    return (
                      <tr key={lic.sub_id} className={`hover:bg-gray-50 transition ${
                        lic.status === "SUSPENDED" ? "bg-red-50/40" :
                        lic.status === "CANCELLED" ? "opacity-60" : ""
                      }`}>
                        {/* Empresa */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                              {lic.company_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{lic.company_name}</p>
                              <p className="text-xs text-gray-400">ID #{lic.company_id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Serial */}
                        <td className="px-5 py-4">
                          <SerialBadge serial={lic.serial_number} />
                        </td>

                        {/* Estado */}
                        <td className="px-5 py-4">
                          <StatusDropdown
                            subId={lic.sub_id}
                            current={lic.status}
                            onChangeStatus={(id, s) => statusMutation.mutate({ subId: id, status: s })}
                          />
                        </td>

                        {/* Plan */}
                        <td className="px-5 py-4">
                          <span className="text-gray-600">{lic.plan_name ?? "—"}</span>
                        </td>

                        {/* Vence */}
                        <td className="px-5 py-4">
                          {lic.expires_at ? (
                            <span className={`text-xs font-medium ${
                              new Date(lic.expires_at) < new Date() ? "text-red-600" : "text-gray-600"
                            }`}>
                              {new Date(lic.expires_at).toLocaleDateString("es-AR")}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Sin vencimiento</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleRegenerate(lic.sub_id, lic.company_name)}
                            disabled={isRegen || regenMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition disabled:opacity-50"
                            title="Regenerar número de serie"
                          >
                            {isRegen ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Nuevo serial
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Los seriales son generados con UUID4 en formato <code className="bg-gray-100 px-1 rounded">MO-XXXX-XXXX-XXXX</code>.
            Regenerar un serial invalida el anterior de forma permanente.
          </p>
        </>
      )}
    </div>
  );
}
