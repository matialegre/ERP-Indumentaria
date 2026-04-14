/**
 * usePwa — detecta si la app es instalable y provee el método para instalarla.
 *
 * Soporta:
 *  - Chrome / Edge / Android: evento beforeinstallprompt
 *  - iOS Safari: detecta el UA y expone isIos para mostrar instrucciones manuales
 *  - Standalone: detecta si ya está instalada (no mostrar el botón)
 */
import { useState, useEffect } from "react";

export function usePwa() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Ya está corriendo como app instalada (standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    // Detección iOS (Safari en iPhone/iPad)
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIos(ios && !standalone);

    // Chrome / Edge / Android — capturamos el evento antes de que Chrome lo consuma
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Si el usuario ya instaló desde el prompt del browser
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  }

  return {
    canInstall: !!installPrompt,   // Chrome/Android: mostrar botón
    isIos,                          // iOS: mostrar instrucciones manuales
    isInstalled,                    // Ya instalada: ocultar todo
    triggerInstall,
  };
}
