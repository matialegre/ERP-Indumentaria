/**
 * deviceFingerprint.js — ID estable de dispositivo para sync offline
 *
 * Genera un ID único por dispositivo combinando:
 *   userAgent + screen resolution + timezone + canvas fingerprint
 *
 * El ID se persiste en localStorage. Si ya existe, se devuelve directamente
 * sin regenerar — esto garantiza estabilidad entre sesiones y recargas.
 *
 * Export principal: getDeviceId() → string (UUID-like, 40 chars hex)
 */

const STORAGE_KEY = "mo_device_id";

/**
 * Obtener canvas fingerprint (hash visual del renderizado del navegador).
 * Diferente por GPU, fuentes y antialiasing del dispositivo.
 * @returns {string} hex parcial del fingerprint
 */
function _canvasFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "nocanvas";

    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("MO-ERP 🖐 Δ", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("MO-ERP 🖐 Δ", 4, 17);

    const data = canvas.toDataURL();
    // Hash rápido (djb2) sobre los datos del canvas
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) ^ data.charCodeAt(i);
      hash = hash >>> 0; // mantener unsigned 32-bit
    }
    return hash.toString(16).padStart(8, "0");
  } catch {
    return "00000000";
  }
}

/**
 * Genera un fingerprint combinado como string hex de ~40 chars.
 */
function _generateFingerprint() {
  const ua = navigator.userAgent || "";
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const lang = navigator.language || "";
  const canvas = _canvasFingerprint();

  // Hash djb2 sobre el string combinado
  const raw = `${ua}|${screen}|${tz}|${lang}|${canvas}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    hash = hash >>> 0;
  }
  const envHash = hash.toString(16).padStart(8, "0");

  // Sufijo temporal para unicidad absoluta (no regenerado, fijo en el primer uso)
  const timePart = Date.now().toString(16);

  // Formato legible tipo UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const combined = `${envHash}${canvas}${timePart}`.padEnd(32, "0").slice(0, 32);
  return [
    combined.slice(0, 8),
    combined.slice(8, 12),
    combined.slice(12, 16),
    combined.slice(16, 20),
    combined.slice(20, 32),
  ].join("-");
}

/**
 * Devuelve el ID único y estable del dispositivo.
 * Si ya existe en localStorage, lo retorna directamente.
 * Si no, lo genera, guarda y retorna.
 *
 * @returns {string} Device ID en formato UUID-like
 */
export function getDeviceId() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = _generateFingerprint();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/**
 * Forzar regeneración del device ID (usar con cuidado — rompe continuidad).
 * @returns {string} Nuevo device ID
 */
export function resetDeviceId() {
  localStorage.removeItem(STORAGE_KEY);
  return getDeviceId();
}

/**
 * Verificar si el dispositivo ya tiene un ID asignado.
 * @returns {boolean}
 */
export function hasDeviceId() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
