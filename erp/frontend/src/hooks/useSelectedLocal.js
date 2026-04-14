/**
 * useSelectedLocal.js — Hook para gestionar el local seleccionado del dispositivo
 *
 * Cada dispositivo (PC/tablet) en un local guarda en localStorage
 * qué local tiene asignado. Esto determina qué stock se sincroniza
 * y se pre-selecciona en ventas/ingresos.
 */
import { useState, useCallback } from "react";

const KEY_ID = "selectedLocalId";
const KEY_NAME = "selectedLocalName";

export function useSelectedLocal() {
  const [localId, setLocalId] = useState(() => localStorage.getItem(KEY_ID));
  const [localName, setLocalName] = useState(() => localStorage.getItem(KEY_NAME));

  const selectLocal = useCallback((id, name) => {
    localStorage.setItem(KEY_ID, String(id));
    localStorage.setItem(KEY_NAME, name);
    setLocalId(String(id));
    setLocalName(name);
  }, []);

  const clearLocal = useCallback(() => {
    localStorage.removeItem(KEY_ID);
    localStorage.removeItem(KEY_NAME);
    setLocalId(null);
    setLocalName(null);
  }, []);

  return { localId, localName, selectLocal, clearLocal, hasLocal: !!localId };
}

/** Lectura directa sin hook (para usar fuera de componentes React) */
export function getSelectedLocalId() {
  return localStorage.getItem(KEY_ID);
}

export function getSelectedLocalName() {
  return localStorage.getItem(KEY_NAME);
}
