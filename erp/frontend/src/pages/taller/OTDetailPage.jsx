/**
 * OTDetailPage — Detalle de Orden de Trabajo con máquina de estados
 * Portada de eurotaller-cassano/src/pages/ot/OTDetailPage.tsx
 * Stack: React 19 + TanStack Query + api.js
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  Wrench, User, Car, ClipboardList, History,
} from "lucide-react";
import { api } from "../../lib/api";
import { isOnline } from "../../lib/offlineSync";
import {
  ESTADO_OT_LABEL,
  ESTADO_OT_COLOR,
  TRANSICIONES,
  ESTADOS_FINALES,
  toUIStatus,
} from "../../lib/ot-machine";
import { formatARS, formatFecha, formatFechaHora, diasDesde } from "../../lib/utils-ar";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {title && (
        <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          <p className="text-sm font-semibold text-gray-700">{title}</p>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function OTDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [advanceNotes, setAdvanceNotes] = useState("");

  const { data: ot, isLoading, isError } = useQuery({
    queryKey: ["work-order", id],
    queryFn: () => api.get(`/work-orders/${id}`),
    refetchInterval: isOnline() ? 15000 : false,
    staleTime: 30 * 1000,
  });

  const advanceMutation = useMutation({
    mutationFn: (notes) =>
      api.post(`/work-orders/${id}/advance`, { notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-order", id] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setAdvanceNotes("");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason) =>
      api.post(`/work-orders/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      navigate("/taller/ot");
    },
  });

  if (isLoading) return <div className="p-8 text-gray-400">Cargando…</div>;
  if (isError || !ot) return (
    <div className="p-8 text-center">
      <p className="text-red-500 font-medium">OT no encontrada</p>
      <button onClick={() => navigate("/taller/ot")} className="mt-3 text-sm text-orange-600 hover:underline">
        Volver a la lista
      </button>
    </div>
  );

  const uiStatus = toUIStatus(ot.status);
  const transicionesDisponibles = TRANSICIONES[uiStatus] ?? [];
  const esFinal = ESTADOS_FINALES.includes(uiStatus);
  const dias = diasDesde(ot.received_at ?? ot.created_at);
  const totalFinal = ot.final_total ?? ot.estimated_total ?? 0;
  const subtotalMO = (ot.items ?? [])
    .filter((i) => i.type === "MANO_DE_OBRA")
    .reduce((s, i) => s + (i.subtotal ?? 0), 0);
  const subtotalRep = (ot.items ?? [])
    .filter((i) => i.type === "REPUESTO")
    .reduce((s, i) => s + (i.subtotal ?? 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/taller/ot")}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{ot.number}</h1>
            <p className="text-sm text-gray-500">
              {[ot.plate, ot.brand, ot.model].filter(Boolean).join(" — ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ot.synced_at === null && ot.offline_id && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" /> Pendiente sync
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${ESTADO_OT_COLOR[uiStatus]}`}>
            {ESTADO_OT_LABEL[uiStatus]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-4">
          {/* Vehículo y cliente */}
          <SectionCard>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Car className="w-4 h-4 text-orange-500" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehículo</p>
                </div>
                <InfoRow label="Patente" value={ot.plate} />
                <InfoRow label="Marca/Modelo" value={[ot.brand, ot.model, ot.year].filter(Boolean).join(" ")} />
                <InfoRow label="Color" value={ot.color} />
                <InfoRow label="KM ingreso" value={ot.km_in ? `${ot.km_in.toLocaleString('es-AR')} km` : null} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
                </div>
                <InfoRow label="Nombre" value={ot.customer_name} />
                <InfoRow label="Teléfono" value={ot.customer_phone} />
                <InfoRow label="Email" value={ot.customer_email} />
                <InfoRow label="CUIT" value={ot.customer_cuit} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Wrench className="w-4 h-4 text-purple-500" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mecánico</p>
                </div>
                <p className="text-sm font-medium text-gray-800">
                  {ot.assigned_mechanic_name ?? <span className="text-gray-400 italic">Sin asignar</span>}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fechas</p>
                </div>
                <InfoRow label="Ingreso" value={formatFecha(ot.received_at ?? ot.created_at)} />
                {ot.delivered_at && <InfoRow label="Entrega" value={formatFecha(ot.delivered_at)} />}
                <p className="text-xs text-gray-400 mt-1">{dias} días en taller</p>
              </div>
            </div>
          </SectionCard>

          {/* Notas */}
          {(ot.reception_notes || ot.diagnosis_notes || ot.delivery_notes) && (
            <SectionCard title="Notas" icon={ClipboardList}>
              <div className="space-y-3">
                {ot.reception_notes && <InfoRow label="Problema reportado" value={ot.reception_notes} />}
                {ot.diagnosis_notes && <InfoRow label="Diagnóstico" value={ot.diagnosis_notes} />}
                {ot.delivery_notes && <InfoRow label="Trabajos realizados" value={ot.delivery_notes} />}
              </div>
            </SectionCard>
          )}

          {/* Items mano de obra */}
          {ot.items?.filter((i) => i.type === "MANO_DE_OBRA").length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <p className="text-sm font-semibold text-gray-700">Mano de obra</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Horas</th>
                    <th className="px-4 py-2 text-right">$/h</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ot.items
                    .filter((i) => i.type === "MANO_DE_OBRA")
                    .map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">{item.description ?? item.mechanic_name ?? "—"}</td>
                        <td className="px-4 py-2 text-right">{item.hours ?? "—"}h</td>
                        <td className="px-4 py-2 text-right">{item.hourly_rate ? formatARS(item.hourly_rate) : "—"}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatARS(item.subtotal ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Items repuestos */}
          {ot.items?.filter((i) => i.type === "REPUESTO").length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b">
                <p className="text-sm font-semibold text-gray-700">Repuestos</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="px-4 py-2 text-left">SKU</th>
                    <th className="px-4 py-2 text-left">Descripción</th>
                    <th className="px-4 py-2 text-right">Cant.</th>
                    <th className="px-4 py-2 text-right">P. Unit.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ot.items
                    .filter((i) => i.type === "REPUESTO")
                    .map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{item.variant_sku ?? "—"}</td>
                        <td className="px-4 py-2">{item.product_name ?? item.description ?? "—"}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{item.unit_price ? formatARS(item.unit_price) : "—"}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatARS(item.subtotal ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Historial de estado */}
          {ot.history?.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-700">Historial</p>
              </div>
              <ul className="divide-y divide-gray-100">
                {[...ot.history].reverse().map((h) => (
                  <li key={h.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">{h.from_status ?? "—"}</span>
                      <span className="text-gray-300">→</span>
                      <span className="font-medium text-gray-700">{toUIStatus(h.to_status)}</span>
                      {h.notes && <span className="text-xs text-gray-500 italic">({h.notes})</span>}
                    </div>
                    <div className="text-xs text-gray-400 text-right shrink-0">
                      <p>{h.user_name}</p>
                      <p>{formatFechaHora(h.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          {/* Totales */}
          <div className="bg-white border rounded-xl p-5 space-y-2">
            <p className="text-sm font-semibold text-gray-700 border-b pb-2 mb-3">Resumen</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Mano de obra</span>
              <span>{formatARS(subtotalMO)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Repuestos</span>
              <span>{formatARS(subtotalRep)}</span>
            </div>
            {(ot.discount_pct ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento ({ot.discount_pct}%)</span>
                <span>- {formatARS(totalFinal - (subtotalMO + subtotalRep))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
              <span>Total</span>
              <span>{formatARS(totalFinal)}</span>
            </div>
          </div>

          {/* Cambiar estado */}
          {!esFinal && transicionesDisponibles.length > 0 && (
            <div className="bg-white border rounded-xl p-5 space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">Cambiar estado</p>

              {/* Notas opcionales para el avance */}
              {transicionesDisponibles.filter((e) => e !== "cancelado").length > 0 && (
                <textarea
                  placeholder="Notas del cambio de estado (opcional)…"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 mb-2"
                />
              )}

              {transicionesDisponibles
                .filter((e) => e !== "cancelado")
                .map((e) => (
                  <button
                    key={e}
                    onClick={() => advanceMutation.mutate(advanceNotes)}
                    disabled={advanceMutation.isPending}
                    className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                      e === "entregado"
                        ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
                        : "border-orange-200 text-orange-700 hover:bg-orange-50"
                    }`}
                  >
                    {advanceMutation.isPending ? "Guardando…" : ESTADO_OT_LABEL[e]}
                  </button>
                ))}

              {/* Cancelar */}
              {transicionesDisponibles.includes("cancelado") && (
                <>
                  {!showCancelForm ? (
                    <button
                      onClick={() => setShowCancelForm(true)}
                      className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Cancelar OT
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Motivo de cancelación…"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={2}
                        className="w-full text-xs border border-red-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelMutation.mutate(cancelReason)}
                          disabled={!cancelReason.trim() || cancelMutation.isPending}
                          className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => { setShowCancelForm(false); setCancelReason(""); }}
                          className="flex-1 py-1.5 border text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {advanceMutation.isError && (
                <p className="text-xs text-red-500 mt-1">{advanceMutation.error?.message}</p>
              )}
            </div>
          )}

          {/* Estado final — mensaje */}
          {uiStatus === "listo" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Listo para retirar</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Los repuestos fueron descontados del inventario.
                </p>
              </div>
            </div>
          )}
          {uiStatus === "cancelado" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">OT Cancelada</p>
                {ot.cancel_reason && (
                  <p className="text-xs text-red-600 mt-0.5">{ot.cancel_reason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
