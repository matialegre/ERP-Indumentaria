import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Ship, Plus, Search, Eye, Pencil, Trash2, X, ChevronDown,
  ChevronUp, Package, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, DollarSign, Calculator, FileDown, ArrowRight,
  Anchor, Globe, Calendar, Hash, Save,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════ */

const STATUS_CFG = {
  BORRADOR:    { label: "Borrador",     color: "bg-gray-100 text-gray-700",    dot: "bg-gray-400",   border: "border-l-gray-400"   },
  CONFIRMADO:  { label: "Confirmado",   color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500",   border: "border-l-blue-500"   },
  EMBARCADO:   { label: "Embarcado",    color: "bg-indigo-100 text-indigo-700",dot: "bg-indigo-500", border: "border-l-indigo-500" },
  EN_TRANSITO: { label: "En Tránsito",  color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500",  border: "border-l-amber-500"  },
  EN_ADUANA:   { label: "En Aduana",    color: "bg-orange-100 text-orange-700",dot: "bg-orange-500", border: "border-l-orange-500" },
  DISPONIBLE:  { label: "Disponible",   color: "bg-green-100 text-green-700",  dot: "bg-green-500",  border: "border-l-green-500"  },
  ANULADO:     { label: "Anulado",      color: "bg-red-100 text-red-700",      dot: "bg-red-400",    border: "border-l-red-400"    },
};

const TIPO_CFG = {
  MARITIMO: { label: "Marítimo", color: "bg-blue-100 text-blue-700" },
  AEREO:    { label: "Aéreo",    color: "bg-sky-100 text-sky-700" },
  TERRESTRE:{ label: "Terrestre",color: "bg-amber-100 text-amber-700" },
};

const WORKFLOW = {
  BORRADOR:    { next: "confirmar",   label: "Confirmar",     icon: CheckCircle2, color: "bg-blue-600 hover:bg-blue-700" },
  CONFIRMADO:  { next: "embarcar",    label: "Embarcar",      icon: Ship,         color: "bg-indigo-600 hover:bg-indigo-700" },
  EMBARCADO:   { next: "en-transito", label: "En Tránsito",   icon: Globe,        color: "bg-amber-600 hover:bg-amber-700" },
  EN_TRANSITO: { next: "en-aduana",   label: "En Aduana",     icon: Anchor,       color: "bg-orange-600 hover:bg-orange-700" },
  EN_ADUANA:   { next: "disponible",  label: "Disponible",    icon: Package,      color: "bg-green-600 hover:bg-green-700" },
};

const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR") : "—";
const fmtUSD  = (n) => n != null ? `USD ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "—";
const fmtARS  = (n) => n != null ? `$ ${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : "—";

/* ═══════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════════════════════ */

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.BORRADOR;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CFG[tipo] || { label: tipo, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function Spinner() {
  return <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mx-auto" />;
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className={`bg-white rounded-xl shadow-2xl mt-8 mb-8 w-full ${wide ? "max-w-4xl" : "max-w-xl"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FORM — CREAR / EDITAR ORDEN
═══════════════════════════════════════════════════════════════════════ */

const EMPTY_FORM = {
  provider_id: "", tipo: "MARITIMO", referencia: "",
  pais_origen: "", ciudad_origen: "", puerto_origen: "", puerto_destino: "Buenos Aires",
  incoterm: "FOB", fecha_orden: "", fecha_eta: "", notas: "",
  numero_bl: "", numero_factura_proveedor: "", numero_dua: "",
  fecha_embarque: "", fecha_arribo_real: "", fecha_despacho_aduana: "",
  valor_fob_usd: "", flete_usd: "", seguro_usd: "", otros_gastos_usd: "",
  tipo_cambio: "",
};

function OrderForm({ order, providers, onSubmit, onClose }) {
  const [form, setForm] = useState(() =>
    order
      ? { ...EMPTY_FORM, ...Object.fromEntries(Object.entries(order).map(([k, v]) => [k, v ?? ""])) }
      : EMPTY_FORM
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const Field = ({ label, name, type = "text", required, disabled }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[name] || ""}
        onChange={set(name)}
        disabled={disabled}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
      />
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      {/* Proveedor + Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor <span className="text-red-500">*</span></label>
          <select value={form.provider_id} onChange={set("provider_id")} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar…</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de transporte</label>
          <select value={form.tipo} onChange={set("tipo")}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="MARITIMO">Marítimo</option>
            <option value="AEREO">Aéreo</option>
            <option value="TERRESTRE">Terrestre</option>
          </select>
        </div>
      </div>

      {/* Referencia + Incoterm */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Referencia interna" name="referencia" />
        <Field label="Incoterm" name="incoterm" />
      </div>

      {/* Origen */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="País origen" name="pais_origen" />
        <Field label="Ciudad origen" name="ciudad_origen" />
        <Field label="Puerto origen" name="puerto_origen" />
      </div>
      <Field label="Puerto destino" name="puerto_destino" />

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de orden" name="fecha_orden" type="date" />
        <Field label="ETA estimado" name="fecha_eta" type="date" />
      </div>

      {/* Documentos (solo en edición) */}
      {order && (
        <>
          <hr className="my-1" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Documentos y tracking</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº BL / AWB" name="numero_bl" />
            <Field label="Nº Factura proveedor" name="numero_factura_proveedor" />
            <Field label="Nº DUA" name="numero_dua" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha embarque" name="fecha_embarque" type="date" />
            <Field label="Fecha arribo real" name="fecha_arribo_real" type="date" />
            <Field label="Fecha despacho aduana" name="fecha_despacho_aduana" type="date" />
          </div>
          <hr className="my-1" />
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Costos (USD)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="FOB (USD)" name="valor_fob_usd" type="number" />
            <Field label="Flete (USD)" name="flete_usd" type="number" />
            <Field label="Seguro (USD)" name="seguro_usd" type="number" />
            <Field label="Otros gastos (USD)" name="otros_gastos_usd" type="number" />
            <Field label="Tipo de cambio" name="tipo_cambio" type="number" />
          </div>
        </>
      )}

      <Field label="Notas" name="notas" />

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
        <button type="submit"
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {order ? "Guardar cambios" : "Crear orden"}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FORM — AGREGAR ÍTEM
═══════════════════════════════════════════════════════════════════════ */

const EMPTY_ITEM = {
  descripcion_comercial: "", codigo_comercial: "",
  posicion_arancelaria: "", cantidad: 1, precio_unitario_usd: 0,
};

function ItemForm({ onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY_ITEM);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const subtotal = Number(form.cantidad || 0) * Number(form.precio_unitario_usd || 0);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Descripción comercial <span className="text-red-500">*</span></label>
        <input value={form.descripcion_comercial} onChange={set("descripcion_comercial")} required
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Código comercial</label>
          <input value={form.codigo_comercial} onChange={set("codigo_comercial")}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Posición arancelaria</label>
          <input value={form.posicion_arancelaria} onChange={set("posicion_arancelaria")} placeholder="ej: 6109.10.00"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad (unidades) <span className="text-red-500">*</span></label>
          <input type="number" min="1" value={form.cantidad} onChange={set("cantidad")} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Precio unitario (USD) <span className="text-red-500">*</span></label>
          <input type="number" step="0.01" min="0" value={form.precio_unitario_usd} onChange={set("precio_unitario_usd")} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
        Subtotal: {fmtUSD(subtotal)}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
        <button type="submit"
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          Agregar ítem
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PANEL DE LIQUIDACIÓN
═══════════════════════════════════════════════════════════════════════ */

const EMPTY_LIQ = {
  tipo_cambio: "", derechos_aduana_ars: "0", iva_importacion_ars: "0",
  estadistica_ars: "0", percepciones_ars: "0",
  honorarios_despachante_ars: "0", otros_costos_ars: "0",
};

function LiquidacionPanel({ order, onLiquidar, onClose }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_LIQ,
    tipo_cambio: order.tipo_cambio || "",
    derechos_aduana_ars: order.derechos_aduana_ars || "0",
    iva_importacion_ars: order.iva_importacion_ars || "0",
    estadistica_ars: order.estadistica_ars || "0",
    percepciones_ars: order.percepciones_ars || "0",
    honorarios_despachante_ars: order.honorarios_despachante_ars || "0",
    otros_costos_ars: order.otros_costos_ars || "0",
  }));
  const [confirmar, setConfirmar] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const tc = Number(form.tipo_cambio || 0);
  const totalARS =
    Number(form.derechos_aduana_ars) +
    Number(form.iva_importacion_ars) +
    Number(form.estadistica_ars) +
    Number(form.percepciones_ars) +
    Number(form.honorarios_despachante_ars) +
    Number(form.otros_costos_ars);
  const totalARSenUSD = tc > 0 ? totalARS / tc : 0;
  const cif = (Number(order.valor_fob_usd) || 0) + (Number(order.flete_usd) || 0) + (Number(order.seguro_usd) || 0);
  const landingEst = cif + totalARSenUSD;
  const unidades = order.total_unidades || order.items?.reduce((a, i) => a + i.cantidad, 0) || 0;
  const costUnitEst = unidades > 0 ? landingEst / unidades : 0;

  const CostRow = ({ label, name, currency = "ARS" }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 w-52 shrink-0">{label}</label>
      <div className="flex items-center gap-1 flex-1">
        <span className="text-xs text-gray-400">{currency}</span>
        <input type="number" step="0.01" min="0" value={form[name]} onChange={set(name)}
          className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500" />
      </div>
    </div>
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onLiquidar({ ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)])), confirmar });
    }} className="space-y-4">
      {/* USD side */}
      <div className="bg-blue-50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Costos en USD</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">FOB</p><p className="font-semibold">{fmtUSD(order.valor_fob_usd)}</p></div>
          <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Flete</p><p className="font-semibold">{fmtUSD(order.flete_usd)}</p></div>
          <div className="bg-white rounded p-2"><p className="text-xs text-gray-500">Seguro</p><p className="font-semibold">{fmtUSD(order.seguro_usd)}</p></div>
        </div>
        <div className="bg-blue-100 rounded p-2 text-sm font-semibold text-blue-800">
          CIF total: {fmtUSD(cif)}
        </div>
      </div>

      {/* ARS side */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Costos en ARS (Importación)</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-52 shrink-0 font-semibold">Tipo de cambio <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-gray-400">USD 1 =</span>
              <input type="number" step="0.01" min="0" required value={form.tipo_cambio} onChange={set("tipo_cambio")}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-400">ARS</span>
            </div>
          </div>
          <CostRow label="Derechos de aduana" name="derechos_aduana_ars" />
          <CostRow label="IVA importación" name="iva_importacion_ars" />
          <CostRow label="Estadística" name="estadistica_ars" />
          <CostRow label="Percepciones" name="percepciones_ars" />
          <CostRow label="Honorarios despachante" name="honorarios_despachante_ars" />
          <CostRow label="Otros costos" name="otros_costos_ars" />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-sm">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Preview liquidación</p>
        <div className="flex justify-between"><span className="text-gray-600">Total costos ARS</span><span className="font-medium">{fmtARS(totalARS)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Equiv. USD (al TC)</span><span className="font-medium">{fmtUSD(totalARSenUSD)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Landing total est.</span><span className="font-semibold text-amber-800">{fmtUSD(landingEst)}</span></div>
        <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-600">Costo/unidad est.</span><span className="font-bold text-amber-900">{fmtUSD(costUnitEst)}</span></div>
        <div className="flex justify-between text-xs text-gray-400"><span>Unidades totales</span><span>{unidades.toLocaleString()}</span></div>
      </div>

      {/* Confirmar flag */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span className="text-sm text-gray-700 font-medium">Confirmar liquidación (no se podrá modificar)</span>
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancelar</button>
        <button type="submit"
          className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-2">
          <Calculator size={14} />
          {confirmar ? "Calcular y confirmar" : "Calcular"}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DETAIL PANEL (expanded)
═══════════════════════════════════════════════════════════════════════ */

function OrderDetail({ order, onClose, onRefresh }) {
  const qc = useQueryClient();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [liqOpen, setLiqOpen] = useState(false);

  const workflowMut = useMutation({
    mutationFn: ({ action }) => api.post(`/import-orders/${order.id}/${action}`),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); onRefresh(); },
  });

  const addItemMut = useMutation({
    mutationFn: (body) => api.post(`/import-orders/${order.id}/items`, body),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); setAddItemOpen(false); onRefresh(); },
  });

  const delItemMut = useMutation({
    mutationFn: (iid) => api.delete(`/import-orders/${order.id}/items/${iid}`),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); onRefresh(); },
  });

  const liquidarMut = useMutation({
    mutationFn: (body) => api.post(`/import-orders/${order.id}/liquidar`, body),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); setLiqOpen(false); onRefresh(); },
  });

  const wf = WORKFLOW[order.estado];

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Número", value: order.numero },
          { label: "Proveedor", value: order.provider_name || order.provider_id },
          { label: "Tipo", value: <TipoBadge tipo={order.tipo} /> },
          { label: "Incoterm", value: order.incoterm || "—" },
          { label: "País origen", value: order.pais_origen || "—" },
          { label: "Puerto origen", value: order.puerto_origen || "—" },
          { label: "Puerto destino", value: order.puerto_destino || "—" },
          { label: "Nº BL / AWB", value: order.numero_bl || "—" },
          { label: "Nº DUA", value: order.numero_dua || "—" },
          { label: "Fecha orden", value: fmtDate(order.fecha_orden) },
          { label: "ETA", value: fmtDate(order.fecha_eta) },
          { label: "Disponible", value: fmtDate(order.fecha_disponible) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Cost summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
        {[
          { label: "FOB", value: fmtUSD(order.valor_fob_usd), color: "text-blue-700" },
          { label: "Flete", value: fmtUSD(order.flete_usd), color: "text-blue-700" },
          { label: "Seguro", value: fmtUSD(order.seguro_usd), color: "text-blue-700" },
          { label: "CIF total", value: fmtUSD(order.costo_landing_total_usd), color: "text-indigo-700 font-semibold" },
          { label: "Costo/unidad", value: fmtUSD(order.costo_unit_usd), color: "text-green-700 font-bold" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-sm mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-800 text-sm">
            Ítems ({order.items?.length || 0}) · {order.total_unidades || 0} unidades
          </h3>
          {["BORRADOR","CONFIRMADO"].includes(order.estado) && (
            <button onClick={() => setAddItemOpen(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
              <Plus size={12} /> Agregar ítem
            </button>
          )}
        </div>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Pos. Arancelaria</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">P. Unit (USD)</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-right">Cost. Land.</th>
                {["BORRADOR","CONFIRMADO"].includes(order.estado) && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(order.items || []).map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{item.descripcion_comercial}</td>
                  <td className="px-3 py-2 text-gray-500">{item.codigo_comercial || "—"}</td>
                  <td className="px-3 py-2 text-gray-500 font-mono">{item.posicion_arancelaria || "—"}</td>
                  <td className="px-3 py-2 text-right">{item.cantidad.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{fmtUSD(item.precio_unitario_usd)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtUSD(item.subtotal_usd)}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">
                    {item.costo_landing_unit_usd ? fmtUSD(item.costo_landing_unit_usd) : "—"}
                  </td>
                  {["BORRADOR","CONFIRMADO"].includes(order.estado) && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => delItemMut.mutate(item.id)}
                        className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {!order.items?.length && (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">Sin ítems</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liquidación ARS (si hay datos) */}
      {(order.derechos_aduana_ars || order.honorarios_despachante_ars) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Costos de importación (ARS)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ["Derechos aduana", order.derechos_aduana_ars],
              ["IVA importación", order.iva_importacion_ars],
              ["Estadística", order.estadistica_ars],
              ["Percepciones", order.percepciones_ars],
              ["Honorarios desp.", order.honorarios_despachante_ars],
              ["Otros", order.otros_costos_ars],
            ].map(([label, val]) => val ? (
              <div key={label}><span className="text-gray-500">{label}: </span><span className="font-medium">{fmtARS(val)}</span></div>
            ) : null)}
          </div>
          {order.tipo_cambio && <p className="text-xs text-amber-600 mt-1">TC: $ {order.tipo_cambio}</p>}
          {order.liquidacion_confirmada && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
              <CheckCircle2 size={11} /> Liquidación confirmada
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t">
        {wf && (
          <button
            onClick={() => workflowMut.mutate({ action: wf.next })}
            disabled={workflowMut.isPending}
            className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg ${wf.color}`}
          >
            <wf.icon size={14} />
            {wf.label}
            {workflowMut.isPending && <RefreshCw size={12} className="animate-spin" />}
          </button>
        )}

        {/* Liquidar */}
        {["EN_ADUANA","DISPONIBLE"].includes(order.estado) || order.estado === "CONFIRMADO" || order.estado === "EMBARCADO" || order.estado === "EN_TRANSITO" ? (
          !order.liquidacion_confirmada && (
            <button onClick={() => setLiqOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg bg-amber-600 hover:bg-amber-700">
              <Calculator size={14} /> Liquidación
            </button>
          )
        ) : null}

        {/* Anular */}
        {!["DISPONIBLE","ANULADO"].includes(order.estado) && (
          <button
            onClick={() => { if (confirm("¿Anular esta orden?")) workflowMut.mutate({ action: "anular" }); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 ml-auto"
          >
            <XCircle size={14} /> Anular
          </button>
        )}
      </div>

      {/* Modals */}
      {addItemOpen && (
        <Modal title="Agregar ítem" onClose={() => setAddItemOpen(false)}>
          <ItemForm onSubmit={(body) => addItemMut.mutate(body)} onClose={() => setAddItemOpen(false)} />
        </Modal>
      )}
      {liqOpen && (
        <Modal title="Liquidación de importación" onClose={() => setLiqOpen(false)} wide>
          <LiquidacionPanel order={order} onLiquidar={(body) => liquidarMut.mutate(body)} onClose={() => setLiqOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */

export default function ImportacionPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Queries
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["import-orders", estadoFilter, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (estadoFilter) params.set("estado", estadoFilter);
      if (q) params.set("q", q);
      return api.get(`/import-orders/?${params}`);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["import-orders-stats"],
    queryFn: () => api.get("/import-orders/stats"),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api.get("/providers/"),
  });

  const { data: expandedOrder, refetch: refetchExpanded } = useQuery({
    queryKey: ["import-order", expandedId],
    queryFn: () => api.get(`/import-orders/${expandedId}`),
    enabled: !!expandedId,
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: (body) => api.post("/import-orders/", { ...body, provider_id: Number(body.provider_id) }),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); qc.invalidateQueries(["import-orders-stats"]); setCreateOpen(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/import-orders/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); setEditOrder(null); refetchExpanded(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/import-orders/${id}`),
    onSuccess: () => { qc.invalidateQueries(["import-orders"]); qc.invalidateQueries(["import-orders-stats"]); setExpandedId(null); },
  });

  const toggleExpand = (id) => setExpandedId((prev) => prev === id ? null : id);

  const filtered = useMemo(() =>
    orders.filter((o) => !q || [o.numero, o.referencia, o.provider_name, o.pais_origen, o.numero_bl]
      .some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
  [orders, q]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Ship className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Importación</h1>
            <p className="text-sm text-gray-500">Órdenes de importación internacional</p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Nueva orden
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total órdenes", value: stats.total, color: "text-gray-800" },
            { label: "En tránsito / aduana", value: (stats.por_estado?.EN_TRANSITO || 0) + (stats.por_estado?.EN_ADUANA || 0), color: "text-amber-700" },
            { label: "Disponibles", value: stats.por_estado?.DISPONIBLE || 0, color: "text-green-700" },
            { label: "FOB total activo", value: fmtUSD(stats.valor_fob_total_usd), color: "text-blue-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número, proveedor, BL, país…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Ship size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay órdenes de importación</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase tracking-wide border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Proveedor</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-left">ETA</th>
                  <th className="px-4 py-3 text-right">FOB (USD)</th>
                  <th className="px-4 py-3 text-right">Unidades</th>
                  <th className="px-4 py-3 text-right">Cost/un</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const cfg = STATUS_CFG[order.estado] || STATUS_CFG.BORRADOR;
                  return (
                    <>
                      <tr key={order.id} className={`hover:bg-gray-50 cursor-pointer border-l-4 ${cfg.border}`}
                        onClick={() => toggleExpand(order.id)}>
                        <td className="px-4 py-3 font-mono font-medium text-blue-700">{order.numero}</td>
                        <td className="px-4 py-3 text-gray-700">{order.provider_name || "—"}</td>
                        <td className="px-4 py-3"><TipoBadge tipo={order.tipo} /></td>
                        <td className="px-4 py-3"><StatusBadge status={order.estado} /></td>
                        <td className="px-4 py-3 text-gray-500">{order.pais_origen || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(order.fecha_eta)}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmtUSD(order.valor_fob_usd)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{order.total_unidades?.toLocaleString() || "—"}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtUSD(order.costo_unit_usd)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {order.estado === "BORRADOR" && (
                              <button onClick={(e) => { e.stopPropagation(); setEditOrder(order); }}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Pencil size={13} /></button>
                            )}
                            {order.estado === "BORRADOR" && (
                              <button onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`¿Eliminar ${order.numero}?`)) deleteMut.mutate(order.id);
                              }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={13} /></button>
                            )}
                            {isExpanded ? <ChevronUp size={14} className="text-gray-400 ml-1" /> : <ChevronDown size={14} className="text-gray-400 ml-1" />}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`exp-${order.id}`}>
                          <td colSpan={10} className="px-4 py-4 bg-blue-50/30">
                            {expandedOrder?.id === order.id ? (
                              <OrderDetail
                                order={expandedOrder}
                                onClose={() => setExpandedId(null)}
                                onRefresh={() => { refetchExpanded(); refetch(); qc.invalidateQueries(["import-orders-stats"]); }}
                              />
                            ) : (
                              <div className="py-4 flex justify-center"><Spinner /></div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <Modal title="Nueva orden de importación" onClose={() => setCreateOpen(false)} wide>
          <OrderForm
            providers={providers}
            onSubmit={(body) => createMut.mutate(body)}
            onClose={() => setCreateOpen(false)}
          />
          {createMut.isError && (
            <p className="mt-2 text-sm text-red-500">{createMut.error?.message}</p>
          )}
        </Modal>
      )}

      {/* Edit modal */}
      {editOrder && (
        <Modal title={`Editar ${editOrder.numero}`} onClose={() => setEditOrder(null)} wide>
          <OrderForm
            order={editOrder}
            providers={providers}
            onSubmit={(body) => updateMut.mutate({ id: editOrder.id, ...body, provider_id: Number(body.provider_id) })}
            onClose={() => setEditOrder(null)}
          />
        </Modal>
      )}
    </div>
  );
}
