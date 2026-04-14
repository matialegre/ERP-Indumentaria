/**
 * InstallPwa — banner fijo de instalación PWA (bottom of screen).
 *
 * - Chrome/Android/Edge: muestra banner + botón que dispara el prompt nativo.
 * - iOS Safari: muestra banner + modal con instrucciones paso a paso.
 * - Si ya está instalado como standalone: no renderiza nada.
 * - Dismiss con "Ahora no" oculta por 24 horas (localStorage timestamp).
 */
import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { usePwa } from "../hooks/usePwa";
import { useBranding } from "../context/BrandingContext";

const DISMISS_KEY = "erp-pwa-dismiss-ts";
const DISMISS_HOURS = 24;

function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const elapsed = Date.now() - Number(ts);
  return elapsed < DISMISS_HOURS * 60 * 60 * 1000;
}

export default function InstallPwa() {
  const { canInstall, isIos, isInstalled, triggerInstall } = usePwa();
  const { app_name } = useBranding();
  const [dismissed, setDismissed] = useState(() => isDismissed());
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in after mount
  useEffect(() => {
    if (!isInstalled && !dismissed && (canInstall || isIos)) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [isInstalled, dismissed, canInstall, isIos]);

  if (isInstalled || dismissed) return null;
  if (!canInstall && !isIos) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setTimeout(() => setDismissed(true), 300);
  };

  return (
    <>
      {/* Fixed bottom banner */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg border-t border-blue-500/30">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <span className="text-2xl">📲</span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm sm:text-base leading-tight">
                Instalar {app_name}
              </p>
              <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                Funciona sin internet · Acceso rápido desde escritorio
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDismiss}
                className="text-blue-200 hover:text-white text-xs sm:text-sm px-2 py-1.5 rounded-lg hover:bg-white/10 transition whitespace-nowrap"
              >
                Ahora no
              </button>
              <button
                onClick={isIos ? () => setIosModalOpen(true) : triggerInstall}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 font-semibold text-sm rounded-lg hover:bg-blue-50 transition shadow-sm"
              >
                <Download size={16} />
                Instalar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal instrucciones iOS */}
      {iosModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Instalar en iPhone / iPad</h3>
              <button
                onClick={() => setIosModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Seguí estos pasos para agregar el ERP a tu pantalla de inicio:
              </p>

              <div className="space-y-3">
                <Step n={1}>
                  Tocá el botón{" "}
                  <span className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium">
                    <Share size={12} className="text-blue-500" /> Compartir
                  </span>{" "}
                  en la barra inferior de Safari.
                </Step>
                <Step n={2}>
                  Desplazate hacia abajo y tocá{" "}
                  <span className="inline-flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium">
                    <Plus size={12} /> Agregar a inicio
                  </span>.
                </Step>
                <Step n={3}>
                  Confirmá tocando <strong>Agregar</strong> en la esquina superior derecha.
                </Step>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                La app se abrirá sin barras de navegación, como una app nativa.
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => setIosModalOpen(false)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
    </div>
  );
}
