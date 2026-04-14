/**
 * ot-machine.js — Máquina de estados para Órdenes de Trabajo
 *
 * B (eurotaller) usa 7 estados simplificados.
 * C (backend) usa 10 estados internos (WOStatus enum).
 * Este módulo mapea entre ambos para que la UI muestre la versión simplificada.
 */

/** Etiquetas en español para UI */
export const ESTADO_OT_LABEL = {
  recibido:             'Recibido',
  diagnostico:          'En diagnóstico',
  esperando_repuestos:  'Esperando repuestos',
  en_reparacion:        'En reparación',
  listo:                'Listo para retirar',
  entregado:            'Entregado',
  cancelado:            'Cancelado',
};

/** Clases Tailwind para badges de estado */
export const ESTADO_OT_COLOR = {
  recibido:             'bg-blue-100 text-blue-800',
  diagnostico:          'bg-yellow-100 text-yellow-800',
  esperando_repuestos:  'bg-orange-100 text-orange-800',
  en_reparacion:        'bg-purple-100 text-purple-800',
  listo:                'bg-green-100 text-green-800',
  entregado:            'bg-gray-100 text-gray-800',
  cancelado:            'bg-red-100 text-red-800',
};

/**
 * Mapeo de estados del backend C → estados UI (simplificados de B)
 * Backend: RECEPCION | DIAGNOSTICO | PRESUPUESTO | APROBACION |
 *          EN_EJECUCION | CONTROL_CALIDAD | ENTREGA | FACTURADO | CERRADO | CANCELADO
 */
export const BACKEND_TO_UI = {
  RECEPCION:      'recibido',
  DIAGNOSTICO:    'diagnostico',
  PRESUPUESTO:    'esperando_repuestos',
  APROBACION:     'esperando_repuestos',
  EN_EJECUCION:   'en_reparacion',
  CONTROL_CALIDAD:'listo',
  ENTREGA:        'listo',
  FACTURADO:      'entregado',
  CERRADO:        'entregado',
  CANCELADO:      'cancelado',
};

/** Convierte estado del backend a estado UI simplificado */
export const toUIStatus = (backendStatus) =>
  BACKEND_TO_UI[backendStatus] ?? backendStatus?.toLowerCase() ?? 'recibido';

/**
 * Transiciones disponibles desde cada estado UI.
 * La UI muestra estos botones; internamente llama a /advance o /cancel.
 */
export const TRANSICIONES = {
  recibido:             ['diagnostico', 'cancelado'],
  diagnostico:          ['esperando_repuestos', 'en_reparacion', 'cancelado'],
  esperando_repuestos:  ['en_reparacion', 'cancelado'],
  en_reparacion:        ['esperando_repuestos', 'listo'],
  listo:                ['entregado'],
  entregado:            [],
  cancelado:            [],
};

/** Estados "terminales" — no permiten más transiciones */
export const ESTADOS_FINALES = ['entregado', 'cancelado'];

/** Estados en proceso (para filtro "En proceso" por defecto) */
export const ESTADOS_ACTIVOS = ['recibido', 'diagnostico', 'esperando_repuestos', 'en_reparacion', 'listo'];

/** Lista completa de estados para el selector de filtros */
export const TODOS_LOS_ESTADOS = Object.keys(ESTADO_OT_LABEL);
