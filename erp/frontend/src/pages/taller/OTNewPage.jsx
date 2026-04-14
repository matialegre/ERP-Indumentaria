/**
 * OTNewPage — Formulario para crear una nueva Orden de Trabajo
 * Portada de eurotaller-cassano/src/pages/ot/OTNewPage.tsx
 * Stack: React 19 + TanStack Query + useOfflineMutation + api.js
 * Offline: guarda en pendingOTs si no hay conexión
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Wrench, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { isOnline } from "../../lib/offlineSync";
import { useOfflineMutation } from "../../lib/useOfflineQuery";
import { saveOTPending } from "../../lib/offlineDB";
import { validarPatente, validarCuit } from "../../lib/utils-ar";

// ─── Helpers de formulario ────────────────────────────────────────

function Field({ label, error, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";

// ─── Componente principal ─────────────────────────────────────────

const EMPTY_ITEM_MO  = { descripcion: "", horas: "", precio_hora: "" };
const EMPTY_ITEM_REP = { descripcion: "", cantidad: "", precio_unitario: "", articulo_id: "" };

export default function OTNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Datos del formulario ──────────────────────────────────────
  const [form, setForm] = useState({
    plate:          "",
    brand:          "",
    model:          "",
    year:           "",
    km_in:          "",
    color:          "",
    customer_name:  "",
    customer_phone: "",
    customer_email: "",
    customer_cuit:  "",
    assigned_mechanic_id: "",
    reception_notes: "",
  });
  const [itemsMO,  setItemsMO]  = useState([]);
  const [itemsRep, setItemsRep] = useState([]);
  const [errors, setErrors] = useState({});
  const [offlineQueued, setOfflineQueued] = useState(false);

  // ── Cargar listas de selección ────────────────────────────────
  const { data: mecanicos = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => api.get("/users/?role=MECANICO&limit=100"),
    staleTime: 5 * 60 * 1000,
    select: (data) => (Array.isArray(data) ? data : data?.items ?? []),
  });

  // ── Cálculo de totales ────────────────────────────────────────
  const subtotalMO  = itemsMO.reduce((s, i) => s + (parseFloat(i.horas) || 0) * (parseFloat(i.precio_hora) || 0), 0);
  const subtotalRep = itemsRep.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0), 0);
  const total = subtotalMO + subtotalRep;

  // ── Validación ────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.plate.trim()) {
      e.plate = "La patente es obligatoria";
    } else if (!validarPatente(form.plate)) {
      e.plate = "Patente inválida (ej: AB123CD o ABC123)";
    }
    if (!form.customer_name.trim()) e.customer_name = "El nombre del cliente es obligatorio";
    if (!form.reception_notes.trim()) e.reception_notes = "Describí el problema";
    if (form.customer_cuit && !validarCuit(form.customer_cuit)) {
      e.customer_cuit = "CUIT inválido";
    }
    itemsMO.forEach((item, i) => {
      if (!item.descripcion.trim()) e[`mo_desc_${i}`] = "Requerido";
      if (!item.horas || parseFloat(item.horas) <= 0) e[`mo_horas_${i}`] = "Requerido";
    });
    itemsRep.forEach((item, i) => {
      if (!item.descripcion.trim()) e[`rep_desc_${i}`] = "Requerido";
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) e[`rep_cant_${i}`] = "Requerido";
    });
    return e;
  }

  // ── Mutation con offline fallback ─────────────────────────────
  const createOT = useOfflineMutation(
    (payload) => api.post("/work-orders/", payload),
    {
      saveDraft: (draft) => saveOTPending(draft),
      onOfflineQueued: (_offline_id) => {
        setOfflineQueued(true);
        setTimeout(() => navigate("/taller/ot"), 1500);
      },
      invalidateKeys: ["work-orders"],
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["work-orders"] });
        navigate("/taller/ot");
      },
    }
  );

  // ── Submit ────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    const payload = {
      plate:          form.plate.toUpperCase().trim(),
      brand:          form.brand.trim() || undefined,
      model:          form.model.trim() || undefined,
      year:           form.year ? parseInt(form.year) : undefined,
      km_in:          form.km_in ? parseInt(form.km_in) : undefined,
      color:          form.color.trim() || undefined,
      customer_name:  form.customer_name.trim(),
      customer_phone: form.customer_phone.trim() || undefined,
      customer_email: form.customer_email.trim() || undefined,
      customer_cuit:  form.customer_cuit.replace(/\D/g, "") || undefined,
      assigned_mechanic_id: form.assigned_mechanic_id ? parseInt(form.assigned_mechanic_id) : undefined,
      reception_notes: form.reception_notes.trim(),
      offline_id:     `ot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      device_id:      localStorage.getItem("deviceId") || undefined,
      items: [
        ...itemsMO.map((i) => ({
          type:         "MANO_DE_OBRA",
          description:  i.descripcion,
          hours:        parseFloat(i.horas),
          hourly_rate:  parseFloat(i.precio_hora) || 0,
        })),
        ...itemsRep.map((i) => ({
          type:         "REPUESTO",
          description:  i.descripcion,
          quantity:     parseFloat(i.cantidad),
          unit_price:   parseFloat(i.precio_unitario) || 0,
          variant_id:   i.articulo_id ? parseInt(i.articulo_id) : undefined,
        })),
      ],
    };

    createOT.mutate(payload);
  }

  function setFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  // ─── Render ──────────────────────────────────────────────────
  if (offlineQueued) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800">OT guardada localmente</h2>
        <p className="text-sm text-gray-500 max-w-xs">
          Sin conexión al servidor. La OT se guardó en este dispositivo y se sincronizará cuando vuelva internet.
        </p>
        <p className="text-xs text-gray-400">Redirigiendo…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/taller/ot")}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-900">Nueva Orden de Trabajo</h1>
        </div>
        {!isOnline() && (
          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full border border-amber-200">
            Modo offline
          </span>
        )}
      </div>

      {/* ── Vehículo ── */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">1</span>
          Vehículo
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Patente" required error={errors.plate}>
            <input
              className={inputCls}
              value={form.plate}
              onChange={(e) => setFormField("plate", e.target.value.toUpperCase())}
              placeholder="AB123CD"
              maxLength={7}
            />
          </Field>
          <Field label="Marca">
            <input className={inputCls} value={form.brand} onChange={(e) => setFormField("brand", e.target.value)} placeholder="Toyota" />
          </Field>
          <Field label="Modelo">
            <input className={inputCls} value={form.model} onChange={(e) => setFormField("model", e.target.value)} placeholder="Hilux" />
          </Field>
          <Field label="Año">
            <input className={inputCls} type="number" value={form.year} onChange={(e) => setFormField("year", e.target.value)} placeholder="2020" min="1900" max="2030" />
          </Field>
          <Field label="KM de ingreso">
            <input className={inputCls} type="number" value={form.km_in} onChange={(e) => setFormField("km_in", e.target.value)} placeholder="150000" />
          </Field>
          <Field label="Color">
            <input className={inputCls} value={form.color} onChange={(e) => setFormField("color", e.target.value)} placeholder="Blanco" />
          </Field>
        </div>
      </div>

      {/* ── Cliente ── */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">2</span>
          Cliente
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre / Razón Social" required error={errors.customer_name}>
            <input className={inputCls} value={form.customer_name} onChange={(e) => setFormField("customer_name", e.target.value)} placeholder="Juan García" />
          </Field>
          <Field label="Teléfono">
            <input className={inputCls} type="tel" value={form.customer_phone} onChange={(e) => setFormField("customer_phone", e.target.value)} placeholder="3512345678" />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.customer_email} onChange={(e) => setFormField("customer_email", e.target.value)} placeholder="juan@ejemplo.com" />
          </Field>
          <Field label="CUIT" error={errors.customer_cuit}>
            <input
              className={inputCls}
              value={form.customer_cuit}
              onChange={(e) => setFormField("customer_cuit", e.target.value)}
              placeholder="20-12345678-0"
              maxLength={13}
            />
          </Field>
        </div>
      </div>

      {/* ── Diagnóstico y asignación ── */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">3</span>
          Problema y asignación
        </h2>
        <Field label="Descripción del problema" required error={errors.reception_notes}>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.reception_notes}
            onChange={(e) => setFormField("reception_notes", e.target.value)}
            placeholder="Detallá el problema que reporta el cliente…"
          />
        </Field>
        <Field label="Mecánico asignado">
          <select
            className={inputCls}
            value={form.assigned_mechanic_id}
            onChange={(e) => setFormField("assigned_mechanic_id", e.target.value)}
          >
            <option value="">Sin asignar</option>
            {mecanicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? m.username}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* ── Items: Mano de obra ── */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">4</span>
            Mano de obra (opcional)
          </h2>
          <button
            type="button"
            onClick={() => setItemsMO((prev) => [...prev, { ...EMPTY_ITEM_MO }])}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
        {itemsMO.length === 0 && (
          <p className="text-xs text-gray-400 italic">No hay items de mano de obra. Podés agregarlos después.</p>
        )}
        {itemsMO.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <Field label="Descripción" error={errors[`mo_desc_${i}`]}>
                <input
                  className={inputCls}
                  value={item.descripcion}
                  onChange={(e) => setItemsMO((prev) => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                  placeholder="Cambio de aceite…"
                />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="Horas" error={errors[`mo_horas_${i}`]}>
                <input
                  className={inputCls}
                  type="number"
                  step="0.5"
                  min="0"
                  value={item.horas}
                  onChange={(e) => setItemsMO((prev) => prev.map((x, j) => j === i ? { ...x, horas: e.target.value } : x))}
                  placeholder="2"
                />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="$/hora">
                <input
                  className={inputCls}
                  type="number"
                  step="100"
                  min="0"
                  value={item.precio_hora}
                  onChange={(e) => setItemsMO((prev) => prev.map((x, j) => j === i ? { ...x, precio_hora: e.target.value } : x))}
                  placeholder="5000"
                />
              </Field>
            </div>
            <div className="col-span-1 flex justify-end pb-1">
              <button
                type="button"
                onClick={() => setItemsMO((prev) => prev.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Items: Repuestos ── */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">5</span>
            Repuestos (opcional)
          </h2>
          <button
            type="button"
            onClick={() => setItemsRep((prev) => [...prev, { ...EMPTY_ITEM_REP }])}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
        {itemsRep.length === 0 && (
          <p className="text-xs text-gray-400 italic">No hay repuestos. Podés agregarlos después desde el detalle de la OT.</p>
        )}
        {itemsRep.map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <Field label="Descripción" error={errors[`rep_desc_${i}`]}>
                <input
                  className={inputCls}
                  value={item.descripcion}
                  onChange={(e) => setItemsRep((prev) => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                  placeholder="Filtro de aceite…"
                />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="Cantidad" error={errors[`rep_cant_${i}`]}>
                <input
                  className={inputCls}
                  type="number"
                  step="1"
                  min="0"
                  value={item.cantidad}
                  onChange={(e) => setItemsRep((prev) => prev.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
                  placeholder="1"
                />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="P. Unit.">
                <input
                  className={inputCls}
                  type="number"
                  step="100"
                  min="0"
                  value={item.precio_unitario}
                  onChange={(e) => setItemsRep((prev) => prev.map((x, j) => j === i ? { ...x, precio_unitario: e.target.value } : x))}
                  placeholder="3500"
                />
              </Field>
            </div>
            <div className="col-span-1 flex justify-end pb-1">
              <button
                type="button"
                onClick={() => setItemsRep((prev) => prev.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Resumen y botón ── */}
      {(itemsMO.length > 0 || itemsRep.length > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center">
          <div className="text-sm text-gray-600 space-y-0.5">
            <p>Mano de obra: <span className="font-medium">${subtotalMO.toLocaleString("es-AR")}</span></p>
            <p>Repuestos: <span className="font-medium">${subtotalRep.toLocaleString("es-AR")}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total estimado</p>
            <p className="text-2xl font-bold text-orange-700">${total.toLocaleString("es-AR")}</p>
          </div>
        </div>
      )}

      {createOT.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {createOT.error?.message ?? "Error al crear la OT"}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 pb-8">
        <button
          type="button"
          onClick={() => navigate("/taller/ot")}
          className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createOT.isPending}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {createOT.isPending
            ? "Guardando…"
            : isOnline()
            ? "Crear Orden de Trabajo"
            : "Guardar localmente"}
        </button>
      </div>
    </form>
  );
}
