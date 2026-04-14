import { useState, useCallback } from "react";

/**
 * useBarcode — hook for managing barcode scanner state
 * Returns: { scannerOpen, openScanner, closeScanner, handleScan, lastBarcode }
 *
 * Usage:
 *   const { scannerOpen, openScanner, closeScanner, handleScan } = useBarcode((code) => {
 *     setSearchCode(code);
 *     triggerSearch(code);
 *   });
 */
export function useBarcode(onScan) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastBarcode, setLastBarcode] = useState(null);

  const handleScan = useCallback((code) => {
    setLastBarcode(code);
    if (onScan) onScan(code);
  }, [onScan]);

  return {
    scannerOpen,
    openScanner: () => setScannerOpen(true),
    closeScanner: () => setScannerOpen(false),
    handleScan,
    lastBarcode,
  };
}
