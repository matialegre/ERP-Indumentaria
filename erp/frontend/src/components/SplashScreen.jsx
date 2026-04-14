import { useState, useEffect } from "react";
import { useBranding } from "../context/BrandingContext";

export default function SplashScreen({ onFinish }) {
  const { app_name, short_name } = useBranding();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), 300);
    const t2 = setTimeout(onFinish, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo */}
      <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-6 shadow-lg">
        <span className="text-white text-3xl font-extrabold tracking-tight">{short_name}</span>
      </div>

      {/* App name */}
      <h1 className="text-white text-2xl font-bold tracking-wide mb-1">
        {app_name}
      </h1>
      <p className="text-blue-200 text-sm font-medium mb-8">ERP</p>

      {/* Spinner */}
      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}
