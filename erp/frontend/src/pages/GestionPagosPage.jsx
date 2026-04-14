import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  CreditCard, Building2, FileText, Plus, Check, X, ChevronDown,
  AlertCircle, Loader2, RefreshCw, GitCompare,
  BarChart3, FileStack, History, RotateCcw, Printer,
} from "lucide-react";
import CrucePreciosModal from "../components/CrucePreciosModal";
import { printMinuta } from "../lib/minutaPDF";
import { useBranding } from "../context/BrandingContext";

const PAYMENT_STATUS = {
  POR_PAGAR: { label: "Por Pagar", color: "bg-yellow-100 text-yellow-800" },
  PARCIAL:   { label: "Parcial",   color: "bg-blue-100 text-blue-800" },
  PAGADO:    { label: "Pagado",    color: "bg-green-100 text-green-800" },
  VENCIDO:   { label: "Vencido",   color: "bg-red-100 text-red-800" },
  ANULADO:   { label: "Anulado",   color: "bg-gray-100 text-gray-600" },
};

const ACCOUNT_TYPES = ["CORRIENTE", "CAJA_AHORRO", "VIRTUAL"];

const TOP_TABS = [
  { id: "resumen",        label: "Resumen",             icon: BarChart3   },
  { id: "vouchers",       label: "Comprobantes",        icon: CreditCard  },
  { id: "bank-accounts",  label: "Cuentas Bancarias",   icon: Building2   },
  { id: "credit-notes",   label: "Notas de Crédito",    icon: FileText    },
  { id: "facturas-todas", label: "Facturas Todas",      icon: FileStack   },
  { id: "historial",      label: "Historial",           icon: History     },
];

function StatusBadge({ status }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
      <AlertCircle size={16} /> {msg}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Vouchers Tab ────────────────────────────────────────────────────────────

function VoucherCreateModal({ providers, onClose, onCreated }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider_id: "",
    amount_gross: "",
    amount_iibb: "0",
    amount_ganancias: "0",
    amount_iva: "0",
    amount_suss: "0",
    notes: "",
    bank_account_id: "",
    payment_method: "TRANSFERENCIA",
  });
  const [error, setError] = useState(null);

  const bankAccountsQuery = useQuery({
    queryKey: ["bank-accounts", form.provider_id],
    queryFn: () => api.get(`/payments/bank-accounts/?provider_id=${form.provider_id}`),
    enabled: !!form.provider_id,
  });

  const { data: selectedProvider } = useQuery({
    queryKey: ["provider-detail", form.provider_id],
    queryFn: () => form.provider_id ? api.get(`/providers/${form.provider_id}`) : null,
    enabled: !!form.provider_id,
  });

  useEffect(() => {
    if (selectedProvider && form.amount_gross) {
      const gross = parseFloat(form.amount_gross) || 0;
      setForm(f => ({
        ...f,
        amount_iibb: selectedProvider.ret_iibb_pct
          ? ((gross * selectedProvider.ret_iibb_pct) / 100).toFixed(2)
          : f.amount_iibb,
        amount_ganancias: selectedProvider.ret_ganancias_pct
          ? ((gross * selectedProvider.ret_ganancias_pct) / 100).toFixed(2)
          : f.amount_ganancias,
        amount_iva: selectedProvider.ret_iva_pct
          ? ((gross * selectedProvider.ret_iva_pct) / 100).toFixed(2)
          : f.amount_iva,
        amount_suss: selectedProvider.ret_suss_pct
          ? ((gross * selectedProvider.ret_suss_pct) / 100).toFixed(2)
          : f.amount_suss,
      }));
    }
  }, [selectedProvider, form.amount_gross]);

  const gross  = parseFloat(form.amount_gross)    || 0;
  const iibb   = parseFloat(form.amount_iibb)     || 0;
  const gan    = parseFloat(form.amount_ganancias) || 0;
  const iva    = parseFloat(form.amount_iva)       || 0;
  const suss   = parseFloat(form.amount_suss)      || 0;
  const net    = gross - iibb - gan - iva - suss;

  const mutation = useMutation({
    mutationFn: (data) => api.post("/payments/vouchers/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-vouchers"] });
      onCreated?.();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!form.provider_id) return setError("Seleccione un proveedor");
    if (!form.amount_gross || gross <= 0) return setError("Ingrese un monto válido");
    mutation.mutate({
      ...form,
      provider_id: parseInt(form.provider_id),
      amount_gross: gross,
      amount_iibb: iibb,
      amount_ganancias: gan,
      amount_iva: iva,
      amount_suss: suss,
      amount_net: net,
      bank_account_id: form.bank_account_id ? parseInt(form.bank_account_id) : null,
    });
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title="Nuevo Comprobante de Pago" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Proveedor *</label>
          <select className={inputCls} value={form.provider_id} onChange={(e) => set("provider_id", e.target.value)} required>
            <option value="">Seleccionar...</option>
            {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Monto Bruto *</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount_gross} onChange={(e) => set("amount_gross", e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Ret. IIBB</label>
              {selectedProvider?.ret_iibb_pct && (
                <span className="text-xs text-green-600 font-medium">Auto: {selectedProvider.ret_iibb_pct}%</span>
              )}
            </div>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount_iibb} onChange={(e) => set("amount_iibb", e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Ret. Ganancias</label>
              {selectedProvider?.ret_ganancias_pct && (
                <span className="text-xs text-green-600 font-medium">Auto: {selectedProvider.ret_ganancias_pct}%</span>
              )}
            </div>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount_ganancias} onChange={(e) => set("amount_ganancias", e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Ret. IVA</label>
              {selectedProvider?.ret_iva_pct && (
                <span className="text-xs text-green-600 font-medium">Auto: {selectedProvider.ret_iva_pct}%</span>
              )}
            </div>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount_iva} onChange={(e) => set("amount_iva", e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Ret. SUSS</label>
              {selectedProvider?.ret_suss_pct && (
                <span className="text-xs text-green-600 font-medium">Auto: {selectedProvider.ret_suss_pct}%</span>
              )}
            </div>
            <input type="number" step="0.01" min="0" className={inputCls} value={form.amount_suss} onChange={(e) => set("amount_suss", e.target.value)} />
          </div>
          <div className="flex flex-col justify-end">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="text-xs text-blue-600 font-medium">Monto Neto</span>
              <p className="text-lg font-bold text-blue-800">${net.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {form.provider_id && (
          <div>
            <label className={labelCls}>Cuenta Bancaria</label>
            <select className={inputCls} value={form.bank_account_id} onChange={(e) => set("bank_account_id", e.target.value)}>
              <option value="">Sin asignar</option>
              {bankAccountsQuery.data?.map((ba) => (
                <option key={ba.id} value={ba.id}>{ba.bank_name} — {ba.cbu || ba.alias}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Método de Pago</label>
          <select
            value={form.payment_method || "TRANSFERENCIA"}
            onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
            <option value="CHEQUE">Cheque</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="DEPOSITO">Depósito</option>
            <option value="DEBITO_DIRECTO">Débito Directo</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Notas</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        {error && <ErrorMsg msg={error} />}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} Crear
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VouchersTab({ providers }) {
  const qc = useQueryClient();
  const { app_name } = useBranding();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [cruceModal, setCruceModal] = useState(null); // { invoice, providerId, providerName }

  const params = new URLSearchParams();
  if (filterStatus)   params.set("status", filterStatus);
  if (filterProvider) params.set("provider_id", filterProvider);

  const query = useQuery({
    queryKey: ["payment-vouchers", filterStatus, filterProvider],
    queryFn: () => api.get(`/payments/vouchers/?${params}`),
  });

  const markPaid = useMutation({
    mutationFn: (id) => api.post(`/payments/vouchers/${id}/mark-paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-vouchers"] }),
  });

  const undoPaymentMutation = useMutation({
    mutationFn: (voucherId) => api.post(`/payments/vouchers/${voucherId}/undo`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-vouchers"] });
    },
    onError: (err) => {
      alert(err.message || "Error al deshacer el pago");
    },
  });

  const handleUndoPayment = (voucherId) => {
    if (confirm("¿Deshacer el pago de este comprobante?")) {
      undoPaymentMutation.mutate(voucherId);
    }
  };

  if (query.isLoading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>;
  if (query.isError)  return <ErrorMsg msg={query.error.message} />;

  const vouchers = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-3 flex-wrap">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Nuevo Comprobante
        </button>
      </div>

      {vouchers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay comprobantes</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Número","Proveedor","Monto Bruto","Ret. IIBB","Ret. Gan.","Ret. IVA","Monto Neto","Método","Estado","Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.voucher_number || `#${v.id}`}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{v.provider_name}</td>
                  <td className="px-4 py-3 text-right">${parseFloat(v.amount_gross).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">${parseFloat(v.amount_iibb || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">${parseFloat(v.amount_ganancias || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">${parseFloat(v.amount_iva || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">${parseFloat(v.amount_net).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {v.payment_method || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {v.status === "POR_PAGAR" && (
                        <button
                          onClick={() => markPaid.mutate(v.id)}
                          disabled={markPaid.isPending}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check size={12} /> Marcar Pagado
                        </button>
                      )}
                      {v.status === "PAGADO" && (
                        <button
                          onClick={() => handleUndoPayment(v.id)}
                          className="p-1.5 text-orange-500 hover:bg-orange-50 rounded transition-colors"
                          title="Deshacer pago"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => printMinuta(v, { companyName: app_name })}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition"
                        title="Imprimir minuta de pago"
                      >
                        <Printer size={12} /> Minuta
                      </button>
                      <button
                        onClick={() => setCruceModal({ invoice: v, providerId: v.provider_id, providerName: v.provider_name })}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        title="Cruzar precios contra lista de precios del proveedor"
                      >
                        <GitCompare size={12} /> Cruce Precios
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <VoucherCreateModal providers={providers} onClose={() => setShowCreate(false)} />
      )}

      {cruceModal && (
        <CrucePreciosModal
          invoice={cruceModal.invoice}
          providerId={cruceModal.providerId}
          providerName={cruceModal.providerName}
          onClose={() => setCruceModal(null)}
        />
      )}
    </div>
  );
}

// ─── Bank Accounts Tab ────────────────────────────────────────────────────────

function BankAccountModal({ providers, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ provider_id: "", bank_name: "", account_type: "CORRIENTE", cbu: "", alias: "", cuit: "" });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => api.post("/payments/bank-accounts/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts-list"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title="Nueva Cuenta Bancaria" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!form.provider_id) return setError("Seleccione proveedor"); mutation.mutate({ ...form, provider_id: parseInt(form.provider_id) }); }} className="space-y-4">
        <div>
          <label className={labelCls}>Proveedor *</label>
          <select className={inputCls} value={form.provider_id} onChange={(e) => set("provider_id", e.target.value)} required>
            <option value="">Seleccionar...</option>
            {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Banco *</label>
            <input className={inputCls} value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} required placeholder="Ej: Banco Nación" />
          </div>
          <div>
            <label className={labelCls}>Tipo</label>
            <select className={inputCls} value={form.account_type} onChange={(e) => set("account_type", e.target.value)}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>CBU</label>
            <input className={inputCls} value={form.cbu} onChange={(e) => set("cbu", e.target.value)} placeholder="22 dígitos" maxLength={22} />
          </div>
          <div>
            <label className={labelCls}>Alias</label>
            <input className={inputCls} value={form.alias} onChange={(e) => set("alias", e.target.value)} placeholder="alias.banco" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>CUIT</label>
            <input className={inputCls} value={form.cuit} onChange={(e) => set("cuit", e.target.value)} placeholder="XX-XXXXXXXX-X" />
          </div>
        </div>
        {error && <ErrorMsg msg={error} />}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BankAccountsTab({ providers }) {
  const [showCreate, setShowCreate] = useState(false);
  const [filterProvider, setFilterProvider] = useState("");

  const params = new URLSearchParams();
  if (filterProvider) params.set("provider_id", filterProvider);

  const query = useQuery({
    queryKey: ["bank-accounts-list", filterProvider],
    queryFn: () => api.get(`/payments/bank-accounts/?${params}`),
  });

  const accounts = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Nueva Cuenta
        </button>
      </div>

      {query.isLoading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div> :
       query.isError  ? <ErrorMsg msg={query.error.message} /> :
       accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay cuentas bancarias</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Proveedor","Banco","Tipo","CBU","Alias","CUIT"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.provider_name}</td>
                  <td className="px-4 py-3">{a.bank_name}</td>
                  <td className="px-4 py-3 text-gray-500">{a.account_type?.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.cbu || "—"}</td>
                  <td className="px-4 py-3 text-blue-600">{a.alias || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.cuit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <BankAccountModal providers={providers} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ─── Credit Notes Tab ─────────────────────────────────────────────────────────

function CreditNoteModal({ providers, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ provider_id: "", amount: "", notes: "" });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: (data) => api.post("/payments/credit-notes/", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["credit-notes"] }); onClose(); },
    onError: (e) => setError(e.message),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <Modal title="Nueva Nota de Crédito" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); setError(null); if (!form.provider_id) return setError("Seleccione proveedor"); mutation.mutate({ ...form, provider_id: parseInt(form.provider_id), amount: parseFloat(form.amount) }); }} className="space-y-4">
        <div>
          <label className={labelCls}>Proveedor *</label>
          <select className={inputCls} value={form.provider_id} onChange={(e) => set("provider_id", e.target.value)} required>
            <option value="">Seleccionar...</option>
            {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Monto *</label>
          <input type="number" step="0.01" min="0" className={inputCls} value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Notas</label>
          <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        {error && <ErrorMsg msg={error} />}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />} Crear
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreditNotesTab({ providers }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const query = useQuery({
    queryKey: ["credit-notes"],
    queryFn: () => api.get("/payments/credit-notes/"),
  });

  const applyMutation = useMutation({
    mutationFn: (id) => api.post(`/payments/credit-notes/${id}/apply`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  const notes = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Nueva NC
        </button>
      </div>

      {query.isLoading ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div> :
       query.isError  ? <ErrorMsg msg={query.error.message} /> :
       notes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay notas de crédito</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Número","Proveedor","Monto","Aplicada","Fecha","Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notes.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{n.note_number || `#${n.id}`}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{n.provider_name}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">${parseFloat(n.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {n.is_applied
                      ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><Check size={12} /> Sí</span>
                      : <span className="text-xs text-gray-400">No</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{n.created_at ? new Date(n.created_at).toLocaleDateString("es-AR") : "—"}</td>
                  <td className="px-4 py-3">
                    {!n.is_applied && (
                      <button
                        onClick={() => applyMutation.mutate(n.id)}
                        disabled={applyMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Check size={12} /> Aplicar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreditNoteModal providers={providers} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ─── Resumen Tab ──────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n ?? 0);

function KpiCard({ label, value, color, icon: Icon }) {
  const colorMap = {
    green:  "bg-green-50 border-green-200 text-green-700",
    red:    "bg-red-50 border-red-200 text-red-700",
    blue:   "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {Icon && <Icon size={18} className="opacity-50" />}
      </div>
      <p className="text-2xl font-bold">{fmt(value)}</p>
    </div>
  );
}

function ResumenTab() {
  const vouchersQuery = useQuery({
    queryKey: ["payment-vouchers-resumen"],
    queryFn: () => api.get("/payments/vouchers/?limit=500"),
    staleTime: 30_000,
  });
  const creditNotesQuery = useQuery({
    queryKey: ["credit-notes-resumen"],
    queryFn: () => api.get("/payments/credit-notes/"),
    staleTime: 30_000,
  });

  const vouchers = Array.isArray(vouchersQuery.data?.items) ? vouchersQuery.data.items
    : Array.isArray(vouchersQuery.data) ? vouchersQuery.data : [];
  const rawNotes = creditNotesQuery.data;
  const notes = Array.isArray(rawNotes) ? rawNotes
    : Array.isArray(rawNotes?.items) ? rawNotes.items
    : Array.isArray(rawNotes?.data) ? rawNotes.data : [];

  const totalPagado = vouchers
    .filter((v) => v.status === "PAGADO")
    .reduce((sum, v) => sum + (parseFloat(v.amount_net) || 0), 0);
  const totalPendiente = vouchers
    .filter((v) => v.status === "POR_PAGAR" || v.status === "PARCIAL" || v.status === "VENCIDO")
    .reduce((sum, v) => sum + (parseFloat(v.amount_net) || 0), 0);
  const totalRetenciones = vouchers.reduce((sum, v) =>
    sum + (parseFloat(v.amount_iibb) || 0) + (parseFloat(v.amount_ganancias) || 0) + (parseFloat(v.amount_iva) || 0) + (parseFloat(v.amount_suss) || 0), 0);
  const totalNC = notes.reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);

  const ultimos5 = [...vouchers]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const isLoading = vouchersQuery.isLoading || creditNotesQuery.isLoading;

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Pagado" value={totalPagado} color="green" icon={Check} />
        <KpiCard label="Total Pendiente" value={totalPendiente} color="red" icon={AlertCircle} />
        <KpiCard label="Total Retenciones" value={totalRetenciones} color="blue" icon={FileText} />
        <KpiCard label="Total NC" value={totalNC} color="purple" icon={FileText} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Últimos 5 pagos</h3>
        {ultimos5.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Sin pagos registrados</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Número", "Proveedor", "Monto Neto", "Estado", "Fecha"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ultimos5.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{v.voucher_number || `#${v.id}`}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.provider_name}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(parseFloat(v.amount_net))}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{v.created_at ? new Date(v.created_at).toLocaleDateString("es-AR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Facturas Todas Tab ───────────────────────────────────────────────────────

const INVOICE_STATUS_COLORS = {
  PENDIENTE:  "bg-yellow-400",
  PARCIAL:    "bg-blue-400",
  PAGADA:     "bg-green-400",
  VENCIDA:    "bg-red-400",
  ANULADA:    "bg-gray-400",
};

function FacturasTodasTab({ providers }) {
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const params = new URLSearchParams();
  params.set("limit", "500");
  if (filterProvider) params.set("provider_id", filterProvider);
  if (filterStatus) params.set("status", filterStatus);

  const query = useQuery({
    queryKey: ["purchase-invoices-all", filterProvider, filterStatus],
    queryFn: () => api.get(`/payments/vouchers/?${params}`),
    staleTime: 30_000,
  });

  const invoices = query.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
        >
          <option value="">Todos los proveedores</option>
          {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{invoices.length} registro{invoices.length !== 1 ? "s" : ""}</span>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
      ) : query.isError ? (
        <ErrorMsg msg={query.error.message} />
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileStack size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay facturas</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["N°", "Proveedor", "Monto Bruto", "Monto Neto", "Semáforo", "Estado", "Fecha"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const statusColor = INVOICE_STATUS_COLORS[inv.status] || "bg-gray-300";
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{inv.voucher_number || `#${inv.id}`}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.provider_name}</td>
                    <td className="px-4 py-3 text-right">${parseFloat(inv.amount_gross || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">${parseFloat(inv.amount_net || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-3 h-3 rounded-full ${statusColor}`} title={inv.status} />
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{inv.created_at ? new Date(inv.created_at).toLocaleDateString("es-AR") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Historial Tab ────────────────────────────────────────────────────────────

const TIPO_BADGE = {
  PAGO:         { label: "Pago",    cls: "bg-green-100 text-green-700" },
  NOTA_CREDITO: { label: "NC",      cls: "bg-purple-100 text-purple-700" },
  FACTURA:      { label: "Factura", cls: "bg-blue-100 text-blue-700" },
};

function HistorialTab() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const vouchersQuery = useQuery({
    queryKey: ["historial-vouchers"],
    queryFn: () => api.get("/payments/vouchers/?limit=500"),
    staleTime: 30_000,
  });
  const creditNotesQuery = useQuery({
    queryKey: ["historial-credit-notes"],
    queryFn: () => api.get("/payments/credit-notes/"),
    staleTime: 30_000,
  });

  const isLoading = vouchersQuery.isLoading || creditNotesQuery.isLoading;

  const timeline = useMemo(() => {
    const vouchers = (vouchersQuery.data?.items ?? []).map((v) => ({
      id: `v-${v.id}`,
      tipo: "PAGO",
      proveedor: v.provider_name,
      documento: v.voucher_number || `#${v.id}`,
      monto: parseFloat(v.amount_net) || 0,
      fecha: v.created_at,
    }));
    const notes = (creditNotesQuery.data ?? []).map((n) => ({
      id: `nc-${n.id}`,
      tipo: "NOTA_CREDITO",
      proveedor: n.provider_name,
      documento: n.note_number || `#${n.id}`,
      monto: parseFloat(n.amount) || 0,
      fecha: n.created_at,
    }));

    let combined = [...vouchers, ...notes];

    if (desde) combined = combined.filter((e) => e.fecha && e.fecha >= desde);
    if (hasta) combined = combined.filter((e) => e.fecha && e.fecha <= hasta + "T23:59:59");

    combined.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    let acumulado = 0;
    return combined.map((e) => {
      acumulado += e.monto;
      return { ...e, acumulado };
    });
  }, [vouchersQuery.data, creditNotesQuery.data, desde, hasta]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">Desde:</label>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="text-sm text-gray-600">Hasta:</label>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-sm text-gray-500 ml-auto">{timeline.length} movimiento{timeline.length !== 1 ? "s" : ""}</span>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <History size={40} className="mx-auto mb-3 opacity-30" />
          <p>Sin movimientos en el período</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Fecha", "Tipo", "Proveedor", "N° Documento", "Monto", "Acumulado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timeline.map((e) => {
                const badge = TIPO_BADGE[e.tipo] || TIPO_BADGE.FACTURA;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.fecha ? new Date(e.fecha).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.proveedor}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.documento}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">${e.monto.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">${e.acumulado.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GestionPagosPage() {
  const [activeTab, setActiveTab] = useState("resumen");

  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get("/providers/"),
    staleTime: 60_000,
  });

  const providers = providersQuery.data?.items ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Pagos</h1>
          <p className="text-sm text-gray-500 mt-1">Comprobantes, cuentas bancarias, notas de crédito y más</p>
        </div>
        <button onClick={() => providersQuery.refetch()} className="text-gray-400 hover:text-gray-600 p-2">
          <RefreshCw size={18} className={providersQuery.isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TOP_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === "resumen"        && <ResumenTab />}
          {activeTab === "vouchers"       && <VouchersTab providers={providers} />}
          {activeTab === "bank-accounts"  && <BankAccountsTab providers={providers} />}
          {activeTab === "credit-notes"   && <CreditNotesTab providers={providers} />}
          {activeTab === "facturas-todas" && <FacturasTodasTab providers={providers} />}
          {activeTab === "historial"      && <HistorialTab />}
        </div>
      </div>
    </div>
  );
}
