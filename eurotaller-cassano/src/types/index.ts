// ============================================================
// Tipos TypeScript — ERP Eurotaller Cassano
// Generados desde supabase/migrations/001_initial_schema.sql
// ============================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export type RolUsuario = 'admin' | 'recepcionista' | 'mecanico' | 'contador';

export type TipoCliente = 'particular' | 'empresa' | 'flota';

export type CondicionIva =
  | 'responsable_inscripto'
  | 'monotributista'
  | 'consumidor_final'
  | 'exento';

export type EstadoOT =
  | 'recibido'
  | 'diagnostico'
  | 'esperando_repuestos'
  | 'en_reparacion'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export type TipoComprobante = 'A' | 'B' | 'C' | 'NC_A' | 'NC_B' | 'ND_A' | 'ND_B';

export type EstadoComprobante = 'pendiente' | 'cobrado_parcial' | 'cobrado' | 'vencido';

export type EstadoPresupuesto = 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'vencido' | 'convertido';

export type EstadoOrdenCompra = 'borrador' | 'enviada' | 'recibida_parcial' | 'recibida' | 'cancelada';

export type EstadoTurno = 'confirmado' | 'presente' | 'ausente' | 'cancelado' | 'completado';

export type TipoMovimientoStock = 'ingreso' | 'egreso' | 'ajuste_positivo' | 'ajuste_negativo';

export type MotivoStock = 'compra' | 'uso_ot' | 'devolucion' | 'ajuste_inventario' | 'otro';

export type MedioPago =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'cheque'
  | 'cuenta_corriente';

export type CondicionPago = 'contado' | 'cuenta_corriente' | '30_dias' | '60_dias' | '90_dias';

export type UnidadMedida = 'unidad' | 'litro' | 'kg' | 'metro' | 'par' | 'juego' | 'ml' | 'cm';

export type IvaPorcentaje = 0 | 10.5 | 21.0 | 27.0;

export type TipoComunicacion = 'whatsapp' | 'email' | 'sms';

export type TemplateComunicacion =
  | 'turno_confirmado'
  | 'vehiculo_listo'
  | 'recordatorio_service'
  | 'presupuesto_enviado'
  | 'factura_emitida';


// ─── Entities ────────────────────────────────────────────────────────────────

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string;
}

export interface Tecnico {
  id: string;
  nombre: string;
  apellido: string;
  dni?: string;
  telefono?: string;
  email?: string;
  especialidad?: string;
  precio_hora: number;
  activo: boolean;
  usuario_id?: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  tipo: TipoCliente;
  nombre: string;
  razon_social?: string;
  cuit_dni?: string;
  condicion_iva: CondicionIva;
  telefono?: string;
  email?: string;
  direccion?: string;
  limite_credito: number;
  saldo_cuenta_corriente: number;
  notas?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehiculo {
  id: string;
  cliente_id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio?: number;
  color?: string;
  vin?: string;
  km_ultimo_servicio: number;
  proximo_service_km?: number;
  proximo_service_fecha?: string;
  notas?: string;
  activo: boolean;
  created_at: string;
  // Join fields
  cliente?: Cliente;
}

export interface CategoriaArticulo {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  razon_social?: string;
  cuit?: string;
  condicion_iva?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  condicion_pago_dias: number;
  saldo_cuenta_corriente: number;
  notas?: string;
  activo: boolean;
  created_at: string;
}

export interface Articulo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string;
  proveedor_principal_id?: string;
  ubicacion_deposito?: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo?: number;
  unidad_medida: UnidadMedida;
  precio_costo_promedio: number;
  precio_venta: number;
  iva_porcentaje: IvaPorcentaje;
  activo: boolean;
  created_at: string;
  updated_at: string;
  // Join fields
  categoria?: CategoriaArticulo;
  proveedor?: Proveedor;
}

export interface OrdenTrabajo {
  id: string;
  numero_ot: number;
  vehiculo_id: string;
  cliente_id: string;
  tecnico_id?: string;
  turno_id?: string;
  fecha_ingreso: string;
  fecha_prometida?: string;
  fecha_entrega?: string;
  km_ingreso?: number;
  km_egreso?: number;
  descripcion_problema: string;
  diagnostico?: string;
  trabajos_realizados?: string;
  estado: EstadoOT;
  subtotal_mano_obra: number;
  subtotal_repuestos: number;
  descuento: number;
  total: number;
  observaciones?: string;
  nombre_archivo_pdf?: string;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  vehiculo?: Vehiculo;
  cliente?: Cliente;
  tecnico?: Tecnico;
  items_mano_obra?: OtItemManoObra[];
  items_repuestos?: OtItemRepuesto[];
}

export interface OtItemManoObra {
  id: string;
  ot_id: string;
  descripcion: string;
  horas: number;
  precio_hora: number;
  subtotal: number;
}

export interface OtItemRepuesto {
  id: string;
  ot_id: string;
  articulo_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  // Join fields
  articulo?: Articulo;
}

export interface MovimientoStock {
  id: string;
  articulo_id: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  stock_anterior: number;
  stock_resultante: number;
  precio_unitario?: number;
  motivo?: MotivoStock;
  ot_id?: string;
  orden_compra_id?: string;
  usuario_id?: string;
  fecha: string;
  notas?: string;
  created_at: string;
  // Join fields
  articulo?: Articulo;
}

export interface VehiculoChecklist {
  id: string;
  ot_id: string;
  nivel_combustible?: '1/4' | '1/2' | '3/4' | 'lleno';
  carroceria_estado?: string;
  accesorios?: string;
  vidrios_ok: boolean;
  tapizado_ok: boolean;
  firma_cliente?: string;
  created_at: string;
}

export interface Turno {
  id: string;
  cliente_id: string;
  vehiculo_id: string;
  tecnico_id?: string;
  fecha_hora_inicio: string;
  duracion_estimada_min: number;
  tipo_servicio?: string;
  descripcion?: string;
  estado: EstadoTurno;
  ot_id?: string;
  notas?: string;
  created_at: string;
  // Join fields
  cliente?: Cliente;
  vehiculo?: Vehiculo;
  tecnico?: Tecnico;
}

export interface Presupuesto {
  id: string;
  numero_presupuesto: number;
  ot_id?: string;
  cliente_id: string;
  vehiculo_id: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoPresupuesto;
  subtotal_mano_obra: number;
  subtotal_repuestos: number;
  descuento: number;
  subtotal_sin_iva: number;
  iva_monto: number;
  total: number;
  observaciones?: string;
  nombre_archivo?: string;
  created_by_id?: string;
  created_at: string;
  // Join fields
  cliente?: Cliente;
  vehiculo?: Vehiculo;
  items?: PresupuestoItem[];
}

export interface PresupuestoItem {
  id: string;
  presupuesto_id: string;
  tipo: 'mano_obra' | 'repuesto' | 'otro';
  articulo_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva_porcentaje: IvaPorcentaje;
  subtotal: number;
  // Join fields
  articulo?: Articulo;
}

export interface Comprobante {
  id: string;
  numero: number;
  punto_venta: number;
  tipo_comprobante: TipoComprobante;
  cliente_id: string;
  presupuesto_id?: string;
  ot_id?: string;
  fecha_emision: string;
  fecha_vencimiento_pago?: string;
  condicion_pago: CondicionPago;
  subtotal_gravado: number;
  subtotal_no_gravado: number;
  iva_21: number;
  iva_105: number;
  total: number;
  estado_cobro: EstadoComprobante;
  monto_cobrado: number;
  cae?: string;
  cae_vencimiento?: string;
  nombre_archivo?: string;
  created_by_id?: string;
  created_at: string;
  // Join fields
  cliente?: Cliente;
  items?: ComprobanteItem[];
}

export interface ComprobanteItem {
  id: string;
  comprobante_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva_porcentaje: IvaPorcentaje;
  subtotal: number;
}

export interface OrdenCompra {
  id: string;
  numero_oc: number;
  proveedor_id: string;
  fecha: string;
  fecha_entrega_estimada?: string;
  estado: EstadoOrdenCompra;
  total: number;
  notas?: string;
  created_by_id?: string;
  created_at: string;
  // Join fields
  proveedor?: Proveedor;
  items?: OcItem[];
}

export interface OcItem {
  id: string;
  orden_compra_id: string;
  articulo_id: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  precio_unitario: number;
  subtotal: number;
  // Join fields
  articulo?: Articulo;
}

export interface FacturaRecibida {
  id: string;
  proveedor_id: string;
  numero_comprobante?: string;
  tipo_comprobante?: 'A' | 'B' | 'C';
  fecha_emision: string;
  fecha_vencimiento?: string;
  subtotal: number;
  iva: number;
  total: number;
  estado_pago: 'pendiente' | 'pagado_parcial' | 'pagado' | 'vencido';
  monto_pagado: number;
  orden_compra_id?: string;
  nombre_archivo?: string;
  descripcion?: string;
  created_by_id?: string;
  created_at: string;
  // Join fields
  proveedor?: Proveedor;
}

export interface Cobro {
  id: string;
  comprobante_id: string;
  fecha: string;
  monto: number;
  medio_pago: MedioPago;
  referencia?: string;
  notas?: string;
  created_by_id?: string;
  created_at: string;
}

export interface Pago {
  id: string;
  factura_recibida_id: string;
  fecha: string;
  monto: number;
  medio_pago: MedioPago;
  referencia?: string;
  notas?: string;
  created_by_id?: string;
  created_at: string;
}

export interface CajaMovimiento {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
  cobro_id?: string;
  pago_id?: string;
  usuario_id?: string;
  created_at: string;
}

export interface Comunicacion {
  id: string;
  cliente_id: string;
  tipo: TipoComunicacion;
  template?: TemplateComunicacion;
  mensaje: string;
  estado: 'enviado' | 'fallido' | 'pendiente';
  referencia_id?: string;
  referencia_tipo?: 'ot' | 'presupuesto' | 'factura' | 'turno';
  fecha: string;
  created_at: string;
  // Join fields
  cliente?: Cliente;
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formatea monto ARS: 1234.56 → "$1.234,56" */
export const formatARS = (n: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

/** Formatea fecha ISO para mostrar: "2026-04-07" → "07/04/2026" */
export const formatFecha = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** Formatea CUIT: "20123456780" → "20-12345678-0" */
export const formatCuit = (cuit: string): string => {
  const c = cuit.replace(/\D/g, '');
  if (c.length !== 11) return cuit;
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
};

/** Valida dígito verificador de CUIT argentino */
export const validarCuit = (cuit: string): boolean => {
  const c = cuit.replace(/\D/g, '');
  if (c.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = mult.reduce((acc, m, i) => acc + m * parseInt(c[i]), 0);
  const resto = sum % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return dv === parseInt(c[10]);
};

/** Valida patente argentina (ABC123 o AB123CD Mercosur) */
export const validarPatente = (p: string): boolean =>
  /^[A-Z]{3}[0-9]{3}$/.test(p.toUpperCase()) ||
  /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(p.toUpperCase());

/** Genera nombre de archivo PDF según convención del taller */
export const generarNombrePDF = (
  tipoDoc: 'OT' | 'PRES' | 'FAC-EMIT' | 'FAC-REC' | 'NC',
  marca: string,
  patenteOProveedor: string,
  descripcion: string,
  fecha: Date = new Date(),
): string => {
  const desc = descripcion
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);
  const fechaStr = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  return `${tipoDoc}_${marca.toUpperCase()}_${patenteOProveedor.toUpperCase()}_${desc}_${fechaStr}.pdf`;
};

/** Etiquetas de estado OT para UI */
export const ESTADO_OT_LABEL: Record<EstadoOT, string> = {
  recibido: 'Recibido',
  diagnostico: 'En diagnóstico',
  esperando_repuestos: 'Esperando repuestos',
  en_reparacion: 'En reparación',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Colores Tailwind para badge de estado OT */
export const ESTADO_OT_COLOR: Record<EstadoOT, string> = {
  recibido: 'bg-blue-100 text-blue-800',
  diagnostico: 'bg-yellow-100 text-yellow-800',
  esperando_repuestos: 'bg-orange-100 text-orange-800',
  en_reparacion: 'bg-purple-100 text-purple-800',
  listo: 'bg-green-100 text-green-800',
  entregado: 'bg-gray-100 text-gray-800',
  cancelado: 'bg-red-100 text-red-800',
};
