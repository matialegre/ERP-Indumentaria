/**
 * utils-ar.js — Utilidades argentinas: formatters, validadores, constantes
 * Portado desde eurotaller-cassano/src/types/index.ts (puro JS, sin dependencias)
 */

/** Formatea monto ARS: 1234.56 → "$1.234,56" */
export const formatARS = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n ?? 0);

/** Formatea fecha ISO para mostrar: "2026-04-07" → "07/04/2026" */
export const formatFecha = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

/** Formatea fecha+hora ISO: "2026-04-07T14:30:00" → "07/04/2026 14:30" */
export const formatFechaHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/** Formatea CUIT: "20123456780" → "20-12345678-0" */
export const formatCuit = (cuit) => {
  const c = String(cuit ?? '').replace(/\D/g, '');
  if (c.length !== 11) return cuit ?? '';
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
};

/** Valida dígito verificador de CUIT argentino */
export const validarCuit = (cuit) => {
  const c = String(cuit ?? '').replace(/\D/g, '');
  if (c.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = mult.reduce((acc, m, i) => acc + m * parseInt(c[i]), 0);
  const resto = sum % 11;
  const dv = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return dv === parseInt(c[10]);
};

/** Valida patente argentina (ABC123 o AB123CD Mercosur) */
export const validarPatente = (p) =>
  /^[A-Z]{3}[0-9]{3}$/.test((p ?? '').toUpperCase()) ||
  /^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test((p ?? '').toUpperCase());

/** Genera nombre de archivo PDF para documentos del taller */
export const generarNombrePDF = (tipoDoc, marca, patenteOProveedor, descripcion, fecha = new Date()) => {
  const desc = String(descripcion ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15);
  const fechaStr = fecha.toISOString().slice(0, 10).replace(/-/g, '');
  return `${tipoDoc}_${String(marca ?? '').toUpperCase()}_${String(patenteOProveedor ?? '').toUpperCase()}_${desc}_${fechaStr}.pdf`;
};

/** Calcula días transcurridos desde una fecha ISO */
export const diasDesde = (fechaIso) =>
  Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
