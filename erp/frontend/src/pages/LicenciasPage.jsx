import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Key, ShieldCheck, ShieldOff, ShieldAlert, RefreshCw,
  Copy, CheckCircle2, XCircle, Clock, Ban, Loader2, ChevronDown,
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

export default function LicenciasPage() {
  const qc = useQueryClient();
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [copiedSerial, setCopiedSerial] = useState(null);

  const { data: licenses = [], isLoading, refetch } = useQuery({
    queryKey: ["licenses"],
    queryFn: () => api.get("/plans/licenses"),
    staleTime: 15_000,
  });

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
            <p className="text-sm text-gray-500">Control de acceso por empresa — número de serie único</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

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

      {/* Nota */}
      <p className="text-xs text-gray-400 mt-4 text-center">
        Los seriales son generados con UUID4 en formato <code className="bg-gray-100 px-1 rounded">MO-XXXX-XXXX-XXXX</code>.
        Regenerar un serial invalida el anterior de forma permanente.
      </p>
    </div>
  );
}
