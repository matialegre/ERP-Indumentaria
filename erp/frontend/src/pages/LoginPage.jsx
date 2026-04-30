import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WifiOff, Wifi, Building2, Eye, EyeOff, Fingerprint } from "lucide-react";
import { useBranding } from "../context/BrandingContext";
import { Spotlight } from "../components/ui/spotlight";
import { SplineScene } from "../components/ui/spline-scene";
import { isPlatformAuthenticatorAvailable, getAssertion } from "../lib/webauthn";
import { api } from "../lib/api";

const SPLINE_SCENE = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

export default function LoginPage() {
  const { login, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    app_name, short_name, welcome_message,
    primary_color, secondary_color, logo_url,
    refreshBranding, loading: brandingLoading,
  } = useBranding();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [companyBranding, setCompanyBranding] = useState(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const companyId = searchParams.get("company") || localStorage.getItem("login_company_id") || null;
  const blockedReason = searchParams.get("blocked");

  useEffect(() => {
    if (blockedReason === "licencia_suspendida") {
      setError("🔒 Licencia suspendida. El acceso a este sistema fue bloqueado. Contactá al administrador del sistema.");
    } else if (blockedReason === "licencia_cancelada") {
      setError("❌ Licencia cancelada. Este sistema ya no tiene acceso habilitado. Contactá al administrador.");
    }
  }, [blockedReason]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem("login_company_id", companyId);
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
    fetch(`${API_BASE}/api/v1/branding/?company_id=${companyId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCompanyBranding(data); })
      .catch(() => {});
  }, [companyId]);

  const b = useMemo(() => ({
    app_name: companyBranding?.app_name || app_name,
    short_name: companyBranding?.short_name || short_name,
    welcome_message: companyBranding?.welcome_message || welcome_message,
    primary_color: companyBranding?.primary_color || primary_color,
    secondary_color: companyBranding?.secondary_color || secondary_color,
    logo_url: companyBranding?.logo_url || logo_url,
  }), [companyBranding, app_name, short_name, welcome_message, primary_color, secondary_color, logo_url]);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setBiometricAvailable).catch(() => {});
  }, []);

  const handleBiometric = async () => {
    if (!username.trim()) {
      setError("Ingresá tu usuario primero");
      return;
    }
    setError("");
    setBiometricLoading(true);
    try {
      const begin = await api.post("/auth/webauthn/authenticate/begin", { username: username.trim() });
      const assertion = await getAssertion(begin);
      const result = await api.post("/auth/webauthn/authenticate/complete", {
        username: username.trim(),
        challenge: begin.challenge,
        ...assertion,
      });
      await loginWithToken(result.access_token);
      refreshBranding();
      await hardReloadAfterLogin();
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("No hay credencial")) {
        setError("No tenés huella registrada en esta PC. Registrala desde Configuración → Mi Perfil.");
      } else if (err.name === "NotAllowedError" || err.name === "AbortError") {
        setError("Verificación cancelada.");
      } else if (msg.includes("LICENCIA_SUSPENDIDA")) {
        setError("🔒 Licencia suspendida.");
      } else if (msg.includes("LICENCIA_CANCELADA")) {
        setError("❌ Licencia cancelada.");
      } else {
        setError("No se pudo verificar la huella. Intentá con contraseña.");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  // Hard reload tras login: limpia service workers y caches para evitar tener que hacer Ctrl+Shift+R
  const hardReloadAfterLogin = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister().catch(() => {})));
      }
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k).catch(() => {})));
      }
    } catch {}
    // Reload duro — preserva sessionStorage (token), descarta toda cache de assets
    window.location.replace("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      refreshBranding();
      await hardReloadAfterLogin();
    } catch (err) {
      const msg = err.message || "Credenciales incorrectas";
      if (msg.includes("LICENCIA_SUSPENDIDA")) {
        setError("🔒 Licencia suspendida. El acceso a este sistema fue bloqueado. Contactá al administrador del sistema.");
      } else if (msg.includes("LICENCIA_CANCELADA")) {
        setError("❌ Licencia cancelada. Este sistema ya no tiene acceso habilitado. Contactá al administrador.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-neutral-950 overflow-hidden flex flex-col lg:flex-row">

      {/* LEFT: Login form */}
      <div className="relative flex flex-col justify-center px-10 py-12 overflow-hidden bg-black/80 backdrop-blur-xl w-full lg:w-[420px] xl:w-[480px] shrink-0">
          <Spotlight className="-top-40 left-0 md:left-20 md:-top-20" fill="white" />

          {/* Logo */}
          <div className="relative z-10 mb-8 transition-opacity duration-500" style={{ opacity: brandingLoading ? 0.4 : 1 }}>
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.app_name} className="h-14 w-14 object-contain rounded-xl mb-4" />
            ) : (
              <div
                className="h-14 w-14 rounded-xl flex items-center justify-center text-white text-xl font-bold mb-4 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})` }}
              >
                {b.short_name?.substring(0, 2) || "ERP"}
              </div>
            )}
            <h1 className="text-3xl font-bold text-white leading-tight">{b.app_name || "ERP"}</h1>
            <p className="mt-1 text-neutral-400 text-sm">{b.welcome_message || "Iniciá sesión para continuar"}</p>
          </div>

          {/* Connectivity badge */}
          <div className={`relative z-10 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium w-fit ${
            online
              ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/50"
              : "bg-amber-950/60 text-amber-400 border border-amber-800/50"
          }`}>
            {online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {online ? "Conectado" : "Modo offline disponible"}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
            {error && (
              <div className="bg-red-950/60 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-600 text-sm outline-none focus:border-white/30 transition"
                placeholder="tu usuario"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-600 text-sm outline-none focus:border-white/30 transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 mt-2"
              style={{
                background: online
                  ? `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`
                  : "linear-gradient(135deg, #d97706, #b45309)",
              }}
            >
              {loading ? "Ingresando..." : online ? "Ingresar" : "Ingresar (Offline)"}
            </button>

            {biometricAvailable && online && (
              <button
                type="button"
                onClick={handleBiometric}
                disabled={biometricLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold border border-white/20 text-white/80 hover:bg-white/10 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Fingerprint size={18} />
                {biometricLoading ? "Verificando huella..." : "Entrar con Windows Hello / Huella"}
              </button>
            )}
          </form>

          {!online && (
            <div className="relative z-10 mt-4 p-3 bg-amber-950/40 border border-amber-800/30 rounded-xl text-xs text-amber-400 text-center">
              <p className="font-semibold mb-1">📱 Modo Offline</p>
              <p className="opacity-80">Podés ingresar si ya te logueaste antes con conexión.</p>
            </div>
          )}

          {companyId && (
            <div className="relative z-10 mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-600">
              <Building2 size={11} />
              <span>Empresa #{companyId}</span>
            </div>
          )}
        </div>

        {/* RIGHT: Spline 3D scene */}
        <div className="flex flex-1 bg-black relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/50 to-transparent z-10 pointer-events-none" />
          <SplineScene scene={SPLINE_SCENE} className="w-full h-full" />
          <div className="absolute bottom-5 left-0 right-0 text-center z-10 pointer-events-none">
            <span className="text-xs text-white/20 font-medium tracking-widest uppercase">
              ERP Mundo Outdoor
            </span>
          </div>
        </div>
    </div>
  );
}
