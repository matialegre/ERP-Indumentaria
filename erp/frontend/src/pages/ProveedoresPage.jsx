import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import HistoriaProveedor from "../components/HistoriaProveedor";
import { Truck, Plus, X, Search, Clock, RefreshCw, Download, Star, UserPlus, Trash2, Pencil } from "lucide-react";

// ─── Color map for provider names ─────────────────────────────────────────────
const PROVIDER_COLORS = {
  Montagne: "text-red-600 font-semibold",
  Miding: "text-blue-600 font-semibold",
  Kodiak: "text-green-600 font-semibold",
  Grupuk: "text-yellow-600 font-semibold",
  Soxpig: "text-purple-600 font-semibold",
  Nexxt: "text-teal-600 font-semibold",
  National: "text-orange-600 font-semibold",
  Doite: "text-pink-600 font-semibold",
  Thermoskin: "text-cyan-600 font-semibold",
  Ansilta: "text-indigo-600 font-semibold",
};

function getProviderColor(name) {
  if (!name) return "text-gray-900 font-medium";
  for (const [prefix, cls] of Object.entries(PROVIDER_COLORS)) {
    if (name.startsWith(prefix)) return cls;
  }
  return "text-gray-900 font-medium";
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const DATA_TABS = [
  {
    id: "basicos",
    label: "Datos Básicos",
    columns: [
      { key: "name", label: "Razón Social", editable: true },
      { key: "cuit", label: "CUIT", editable: true },
      { key: "phone", label: "Teléfono", editable: true },
      { key: "email", label: "Email", editable: true },
      { key: "contact_name", label: "Contacto", editable: true },
    ],
    showHistoria: true,
  },
  {
    id: "contacto",
    label: "Contacto",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "contact_name", label: "Contacto", editable: true },
      { key: "vendor_name", label: "Vendedor", editable: true },
      { key: "phone", label: "Teléfono", editable: true },
      { key: "fax", label: "Fax", editable: true },
      { key: "email", label: "Email", editable: true },
    ],
  },
  {
    id: "contactos_multi",
    label: "Contactos",
    columns: [],
  },
  {
    id: "fiscal",
    label: "Fiscal",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "cuit", label: "CUIT", editable: true },
      { key: "tax_condition", label: "Condición IVA", editable: true },
      { key: "gross_income", label: "Ingresos Brutos", editable: true },
      { key: "tango_code", label: "Cód. Tango", editable: true },
    ],
  },
  {
    id: "ret_iva",
    label: "Ret. IVA",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "ret_iva_pct", label: "Ret. IVA %", editable: true, type: "number" },
    ],
  },
  {
    id: "ret_iibb",
    label: "Ret. IIBB",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "ret_iibb_pct", label: "Ret. IIBB %", editable: true, type: "number" },
    ],
  },
  {
    id: "ret_ganancias",
    label: "Ret. Ganancias",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "ret_ganancias_pct", label: "Ret. Ganancias %", editable: true, type: "number" },
    ],
  },
  {
    id: "suss",
    label: "SUSS",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "ret_suss_pct", label: "SUSS %", editable: true, type: "number" },
    ],
  },
  {
    id: "direccion",
    label: "Dirección",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "domicilio", label: "Domicilio", editable: true },
      { key: "cp", label: "C.P.", editable: true },
      { key: "localidad", label: "Localidad", editable: true },
      { key: "provincia", label: "Provincia", editable: true },
      { key: "pais", label: "País", editable: true },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    columns: [
      { key: "name", label: "Razón Social" },
      { key: "order_prefix", label: "Prefijo Pedido", editable: true },
      { key: "is_active", label: "Activo", editable: true, type: "boolean" },
    ],
  },
];

// ─── Provider Modal (create/edit) ─────────────────────────────────────────────
function ProviderModal({ provider, onClose, onSave }) {
  const [form, setForm] = useState({
    name: provider?.name || "",
    cuit: provider?.cuit || "",
    legal_name: provider?.legal_name || "",
    contact_name: provider?.contact_name || "",
    vendor_name: provider?.vendor_name || "",
    phone: provider?.phone || "",
    fax: provider?.fax || "",
    email: provider?.email || "",
    address: provider?.address || "",
    domicilio: provider?.domicilio || "",
    cp: provider?.cp || "",
    localidad: provider?.localidad || "",
    provincia: provider?.provincia || "",
    pais: provider?.pais || "",
    tax_condition: provider?.tax_condition || "",
    gross_income: provider?.gross_income || "",
    tango_code: provider?.tango_code || "",
    order_prefix: provider?.order_prefix || "",
    notes: provider?.notes || "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900">{provider ? "Editar proveedor" : "Nuevo proveedor"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>CUIT</label>
              <input type="text" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} className={inputCls} placeholder="30-12345678-9" />
            </div>
            <div>
              <label className={labelCls}>Razón Social</label>
              <input type="text" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contacto</label>
              <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vendedor</label>
              <input type="text" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fax</label>
              <input type="text" value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Condición IVA</label>
              <input type="text" value={form.tax_condition} onChange={(e) => setForm({ ...form, tax_condition: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Domicilio</label>
              <input type="text" value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input type="text" value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>C.P.</label>
              <input type="text" value={form.cp} onChange={(e) => setForm({ ...form, cp: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Provincia</label>
              <input type="text" value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input type="text" value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cód. Tango</label>
              <input type="text" value={form.tango_code} onChange={(e) => setForm({ ...form, tango_code: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Prefijo Pedido</label>
              <input type="text" value={form.order_prefix} onChange={(e) => setForm({ ...form, order_prefix: e.target.value })} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">{provider ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────
function EditableCell({ value, isEditing, editValue, type, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit }) {
  const inputRef = useRef(null);

  if (isEditing) {
    if (type === "boolean") {
      return (
        <td className="text-sm px-3 py-1.5 border-b border-gray-100">
          <select
            ref={inputRef}
            autoFocus
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            onBlur={onSaveEdit}
            className="border-2 border-blue-500 rounded px-2 py-1 text-sm outline-none bg-white"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </td>
      );
    }
    return (
      <td className="text-sm px-3 py-1.5 border-b border-gray-100">
        <input
          ref={inputRef}
          autoFocus
          type={type === "number" ? "number" : "text"}
          step={type === "number" ? "0.01" : undefined}
          value={editValue}
          onChange={(e) => onChangeEdit(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          className="border-2 border-blue-500 rounded px-2 py-1 text-sm outline-none w-full min-w-[60px]"
        />
      </td>
    );
  }

  const display = type === "boolean"
    ? (value ? "✅ Sí" : "❌ No")
    : (type === "number" ? (value != null ? String(value) : "—") : (value || "—"));

  return (
    <td
      className="text-sm px-3 py-1.5 border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer whitespace-nowrap"
      onDoubleClick={onStartEdit}
      title="Doble-click para editar"
    >
      {display}
    </td>
  );
}

// ─── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(providers) {
  const fields = [
    "name", "cuit", "legal_name", "contact_name", "vendor_name", "phone", "fax", "email",
    "tax_condition", "gross_income", "tango_code", "domicilio", "cp", "localidad", "provincia", "pais",
    "ret_iva_pct", "ret_iibb_pct", "ret_ganancias_pct", "ret_suss_pct", "order_prefix", "is_active",
  ];
  const header = fields.join(";");
  const rows = providers.map((p) => fields.map((f) => {
    const v = p[f];
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(";") ? `"${s}"` : s;
  }).join(";"));
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proveedores_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProveedoresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("basicos");
  const [modal, setModal] = useState(null);
  const [historiaProvider, setHistoriaProvider] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [colWidths, setColWidths] = useState({});
  const resizingRef = useRef(null);

  // ─── Contactos multi state ────────────────────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", role: "", phone: "", email: "", notes: "", is_primary: false });
  const resetContactForm = () => setContactForm({ name: "", role: "", phone: "", email: "", notes: "", is_primary: false });

  const { data: providerContacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ["provider-contacts", selectedProvider?.id],
    queryFn: () => api.get(`/providers/${selectedProvider.id}/contacts`),
    enabled: !!selectedProvider?.id,
  });

  const addContactMutation = useMutation({
    mutationFn: (data) => api.post(`/providers/${selectedProvider.id}/contacts`, data),
    onSuccess: () => { refetchContacts(); setShowContactForm(false); resetContactForm(); },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/providers/${selectedProvider.id}/contacts/${id}`, data),
    onSuccess: () => { refetchContacts(); setEditingContact(null); resetContactForm(); },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id) => api.delete(`/providers/${selectedProvider.id}/contacts/${id}`),
    onSuccess: () => refetchContacts(),
  });

  const startEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({ name: contact.name || "", role: contact.role || "", phone: contact.phone || "", email: contact.email || "", notes: contact.notes || "", is_primary: contact.is_primary || false });
    setShowContactForm(false);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: contactForm });
    } else {
      addContactMutation.mutate(contactForm);
    }
  };

  const handleDeleteContact = (id) => {
    if (window.confirm("¿Eliminar contacto?")) {
      deleteContactMutation.mutate(id);
    }
  };

  const { data: pageData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["providers", "all"],
    queryFn: () => api.get("/providers/?limit=500"),
    staleTime: 30_000,
  });
  const allProviders = pageData?.items ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return allProviders;
    const q = search.toLowerCase();
    return allProviders.filter((p) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.cuit || "").toLowerCase().includes(q) ||
      (p.localidad || "").toLowerCase().includes(q) ||
      (p.legal_name || "").toLowerCase().includes(q) ||
      (p.contact_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  }, [allProviders, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = (typeof av === "number" && typeof bv === "number")
        ? av - bv
        : String(av).localeCompare(String(bv), "es", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return key; }
      setSortDir("asc"); return key;
    });
  }, []);

  const startResize = useCallback((e, colKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[`${activeTab}-${colKey}`] || e.currentTarget.parentElement.offsetWidth;
    const onMouseMove = (me) => {
      const newWidth = Math.max(60, startWidth + me.clientX - startX);
      setColWidths((prev) => ({ ...prev, [`${activeTab}-${colKey}`]: newWidth }));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [activeTab, colWidths]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/providers/", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/providers/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });

  const handleSave = async (form) => {
    if (modal && modal !== "new") {
      await updateMutation.mutateAsync({ id: modal.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
  };

  const startEdit = useCallback((providerId, field, currentValue, type) => {
    if (type === "boolean") {
      setEditValue(currentValue ? "true" : "false");
    } else {
      setEditValue(currentValue != null ? String(currentValue) : "");
    }
    setEditingCell({ providerId, field });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingCell) return;
    const { providerId, field } = editingCell;
    const provider = allProviders.find((p) => p.id === providerId);
    if (!provider) { setEditingCell(null); return; }

    const tab = DATA_TABS.find((t) => t.id === activeTab);
    const col = tab?.columns.find((c) => c.key === field);
    let newValue = editValue;
    if (col?.type === "number") {
      newValue = editValue === "" ? null : parseFloat(editValue);
    } else if (col?.type === "boolean") {
      newValue = editValue === "true";
    }

    const oldValue = provider[field];
    if (String(newValue ?? "") === String(oldValue ?? "")) {
      setEditingCell(null);
      return;
    }

    try {
      await api.put(`/providers/${providerId}`, { [field]: newValue });
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    } catch (err) {
      console.error("Error saving:", err);
    }
    setEditingCell(null);
  }, [editingCell, editValue, activeTab, allProviders, queryClient]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const currentTab = DATA_TABS.find((t) => t.id === activeTab) || DATA_TABS[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center">
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
            <p className="text-sm text-gray-500">Gestión completa de proveedores</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal("new")}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
          >
            <Plus size={16} /> Nuevo
          </button>
          <button
            onClick={() => exportCSV(allProviders)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
            title="Exportar CSV"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            title="Refrescar"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Search bar + counter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar proveedor, CUIT, localidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap font-medium">
          {filtered.length} proveedor{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Data Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DATA_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setEditingCell(null); setSortKey(null); setSortDir("asc"); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Spreadsheet table — hidden when on contactos_multi tab */}
      {activeTab !== "contactos_multi" && (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {currentTab.showHistoria && (
                  <th className="py-2.5 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-12">Hist.</th>
                )}
                <th className="py-2.5 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center w-10">#</th>
                {currentTab.columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: colWidths[`${activeTab}-${col.key}`] || undefined, minWidth: 60, position: "relative" }}
                    className={`py-2.5 px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-left ${
                      col.key === "name" ? "sticky left-0 bg-gray-50 z-10" : ""
                    }`}
                  >
                    <div
                      className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <span className="opacity-50">
                        {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 hover:opacity-80 opacity-0 transition-opacity"
                      onMouseDown={(e) => startResize(e, col.key)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={currentTab.columns.length + 2} className="py-16 text-center text-gray-400">Cargando proveedores...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={currentTab.columns.length + 2} className="py-16 text-center text-gray-400">No hay proveedores</td></tr>
              ) : (
                sorted.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                    {currentTab.showHistoria && (
                      <td className="text-center px-3 py-1.5 border-b border-gray-100">
                        <button
                          onClick={() => setHistoriaProvider(p)}
                          className="p-1 rounded hover:bg-indigo-100 text-gray-400 hover:text-indigo-600 transition"
                          title="Historia proveedor"
                        >
                          <Clock size={14} />
                        </button>
                      </td>
                    )}
                    <td className="text-center px-3 py-1.5 border-b border-gray-100 text-xs text-gray-400 font-mono">{idx + 1}</td>
                    {currentTab.columns.map((col) => {
                      const isNameCol = col.key === "name";
                      const isEditingThis = editingCell?.providerId === p.id && editingCell?.field === col.key;

                      if (isNameCol && !col.editable) {
                        return (
                          <td
                            key={col.key}
                            className={`text-sm px-3 py-1.5 border-b border-gray-100 whitespace-nowrap sticky left-0 bg-white z-10 ${getProviderColor(p.name)}`}
                          >
                            {p.name || "—"}
                          </td>
                        );
                      }

                      if (isNameCol && col.editable) {
                        return (
                          <EditableCell
                            key={col.key}
                            value={p[col.key]}
                            isEditing={isEditingThis}
                            editValue={editValue}
                            type={col.type}
                            onStartEdit={() => startEdit(p.id, col.key, p[col.key], col.type)}
                            onChangeEdit={setEditValue}
                            onSaveEdit={saveEdit}
                            onCancelEdit={cancelEdit}
                          />
                        );
                      }

                      if (!col.editable) {
                        return (
                          <td key={col.key} className="text-sm px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-600">
                            {col.type === "boolean" ? (p[col.key] ? "✅ Sí" : "❌ No") : (p[col.key] || "—")}
                          </td>
                        );
                      }

                      return (
                        <EditableCell
                          key={col.key}
                          value={p[col.key]}
                          isEditing={isEditingThis}
                          editValue={editValue}
                          type={col.type}
                          onStartEdit={() => startEdit(p.id, col.key, p[col.key], col.type)}
                          onChangeEdit={setEditValue}
                          onSaveEdit={saveEdit}
                          onCancelEdit={cancelEdit}
                        />
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ─── Contactos multi tab ──────────────────────────────────────────────── */}
      {activeTab === "contactos_multi" && (
        <div className="space-y-4">
          {/* Provider selector */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seleccioná un proveedor para gestionar sus contactos
              </span>
              {selectedProvider && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {selectedProvider.name}
                </span>
              )}
            </div>
            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">Cargando...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-gray-400">No hay proveedores</td></tr>
                  ) : (
                    filtered.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => { setSelectedProvider(p); setShowContactForm(false); setEditingContact(null); resetContactForm(); }}
                        className={`cursor-pointer transition-colors ${
                          selectedProvider?.id === p.id
                            ? "bg-blue-50 border-l-4 border-l-blue-500"
                            : "hover:bg-gray-50 border-l-4 border-l-transparent"
                        }`}
                      >
                        <td className={`px-3 py-1.5 border-b border-gray-100 ${getProviderColor(p.name)}`}>{p.name}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-600">{p.contact_name || "—"}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500 text-xs">{p.email || "—"}</td>
                        <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500 text-xs">{p.phone || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contacts CRUD section */}
          {selectedProvider ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${getProviderColor(selectedProvider.name)}`}>{selectedProvider.name}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-500">
                    {providerContacts.length} contacto{providerContacts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {!showContactForm && !editingContact && (
                  <button
                    onClick={() => { setShowContactForm(true); setEditingContact(null); resetContactForm(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                  >
                    <UserPlus size={14} /> Agregar Contacto
                  </button>
                )}
              </div>

              {/* Add / Edit inline form */}
              {(showContactForm || editingContact) && (
                <form onSubmit={handleContactSubmit} className="border-b border-gray-200 bg-blue-50/30 px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      {editingContact ? "Editar contacto" : "Nuevo contacto"}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowContactForm(false); setEditingContact(null); resetContactForm(); }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-500 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                      <select
                        value={contactForm.role}
                        onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">— Sin rol —</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="Administración">Administración</option>
                        <option value="Logística">Logística</option>
                        <option value="Gerencia">Gerencia</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="11 1234-5678"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="contacto@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                      <input
                        type="text"
                        value={contactForm.notes}
                        onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="Observaciones..."
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={contactForm.is_primary}
                          onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Es Principal</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={addContactMutation.isPending || updateContactMutation.isPending}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
                    >
                      {editingContact ? "Guardar cambios" : "Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowContactForm(false); setEditingContact(null); resetContactForm(); }}
                      className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Contacts table */}
              <div className="overflow-x-auto">
                {providerContacts.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 text-sm">
                    <UserPlus size={32} className="mx-auto mb-2 opacity-30" />
                    No hay contactos registrados. Agregá el primero.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</th>
                        <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                        <th className="py-2 px-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerContacts.map((c) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-gray-50 transition-colors ${editingContact?.id === c.id ? "bg-blue-50" : ""}`}
                        >
                          <td className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900">
                            {c.name}
                            {c.notes && (
                              <span className="ml-1.5 text-xs text-gray-400 font-normal" title={c.notes}>💬</span>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100 text-gray-600">
                            {c.role
                              ? <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">{c.role}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100 text-gray-600 text-xs">{c.phone || "—"}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-gray-500 text-xs">{c.email || "—"}</td>
                          <td className="px-3 py-2 border-b border-gray-100 text-center">
                            {c.is_primary
                              ? <Star size={14} className="mx-auto text-yellow-400 fill-yellow-400" title="Contacto principal" />
                              : <span className="text-gray-200">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => startEditContact(c)}
                                className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition"
                                title="Editar contacto"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteContact(c.id)}
                                disabled={deleteContactMutation.isPending}
                                className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                                title="Eliminar contacto"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
              <Truck size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Seleccioná un proveedor de la lista para gestionar sus contactos</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {modal !== null && <ProviderModal provider={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />}
      {historiaProvider && <HistoriaProveedor provider={historiaProvider} onClose={() => setHistoriaProvider(null)} />}

    </div>
  );
}
