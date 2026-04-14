import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X, Zap, AlertCircle, Keyboard } from "lucide-react";

/**
 * BarcodeScanner — PWA camera barcode scanner
 *
 * Props:
 *   onScan(barcode: string) — called when barcode is detected
 *   onClose() — called when user closes the scanner
 *   isOpen: boolean — controls visibility
 */
export default function BarcodeScanner({ onScan, onClose, isOpen }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animFrameRef = useRef(null);
  const [supported, setSupported] = useState(null); // null=checking, true, false
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(false);
  const manualRef = useRef(null);

  // Check BarcodeDetector support
  useEffect(() => {
    if ("BarcodeDetector" in window) {
      try {
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "data_matrix", "upc_a", "upc_e"],
        });
        detectorRef.current = detector;
        setSupported(true);
      } catch {
        setSupported(false);
      }
    } else {
      setSupported(false);
    }
  }, []);

  // Start camera when opened
  useEffect(() => {
    if (isOpen && supported === true && !showManual) {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, supported, showManual]);

  // Focus manual input when shown
  useEffect(() => {
    if (showManual && manualRef.current) {
      setTimeout(() => manualRef.current?.focus(), 100);
    }
  }, [showManual]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setActive(true);
        detectLoop();
      }
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Usá el ingreso manual."
          : `Error de cámara: ${err.message}`
      );
      setShowManual(true);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !streamRef.current) return;

    try {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (code !== lastScan) {
            setLastScan(code);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            handleScan(code);
            return; // Stop loop after detection
          }
        }
      }
    } catch {}

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, [lastScan]);

  const handleScan = (code) => {
    stopCamera();
    onScan(code);
    onClose();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-blue-400" />
            <span className="font-semibold text-sm">Escanear código de barras</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManual((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Ingreso manual"
            >
              <Keyboard size={16} />
            </button>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Camera view or manual */}
        {showManual || supported === false || error ? (
          <div className="p-6">
            {error && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            {supported === false && !error && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm">
                <AlertCircle size={16} />
                Tu navegador no soporta el escáner. Ingresá el código manualmente.
              </div>
            )}
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Código de barras
              </label>
              <input
                ref={manualRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ej: 7798333733117"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                Buscar
              </button>
              {supported === true && (
                <button
                  type="button"
                  onClick={() => { setShowManual(false); setError(null); startCamera(); }}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  ← Volver a la cámara
                </button>
              )}
            </form>
          </div>
        ) : (
          <div className="relative">
            {/* Video feed */}
            <video
              ref={videoRef}
              className="w-full aspect-video object-cover bg-black"
              playsInline
              muted
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-40">
                {/* Corner guides */}
                {[
                  "top-0 left-0 border-t-4 border-l-4",
                  "top-0 right-0 border-t-4 border-r-4",
                  "bottom-0 left-0 border-b-4 border-l-4",
                  "bottom-0 right-0 border-b-4 border-r-4",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-blue-400 rounded-sm ${cls}`} />
                ))}
                {/* Scanning line animation */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 animate-scan opacity-80" />
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
                  {active ? "Apuntá al código de barras" : "Iniciando cámara..."}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status bar */}
        {active && !showManual && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-xs">
            <Zap size={12} className="animate-pulse" />
            Escáner activo — Buscando código...
          </div>
        )}
      </div>
    </div>
  );
}
