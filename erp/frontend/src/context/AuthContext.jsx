import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { cacheAuthCredentials, verifyOfflineAuth, getCachedSession } from "../lib/offlineDB";
import { startPeriodicSync, syncAllCatalogs } from "../lib/offlineSync";

const AuthContext = createContext(null);

// Hash password con SHA-256 (para comparar offline, NO es el hash del server)
async function hashForOffline(password) {
  try {
    // crypto.subtle solo funciona en contexto seguro (HTTPS o localhost)
    // En Electron sobre HTTP, usamos un fallback simple
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + "_mo_erp_salt_2026");
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback: hash simple para Electron sin contexto seguro
    let hash = 0;
    const str = password + "_mo_erp_salt_2026";
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  } catch (e) {
    console.warn("hashForOffline fallback:", e.message);
    return btoa(password).replace(/[^a-zA-Z0-9]/g, "");
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Sin token: intentar sesión cacheada si estamos offline
      if (!navigator.onLine) {
        const cached = await getCachedSession();
        if (cached?.profile) {
          setUser(cached.profile);
          setIsOfflineSession(true);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
      return;
    }
    try {
      const me = await api.get("/auth/me");
      setUser(me);
      setBackendError(false);
      setIsOfflineSession(false);
      // Cachear perfil para uso offline futuro
      const cached = await getCachedSession();
      if (cached) {
        await cacheAuthCredentials(cached.username, cached.passwordHash, me);
      }
      // Iniciar sync de catálogos en background
      startPeriodicSync();
    } catch (err) {
      if (err.message?.includes("timeout") || err.message?.includes("fetch") || err.name === "TypeError") {
        // Backend no disponible — intentar sesión cacheada
        const cached = await getCachedSession();
        if (cached?.profile && cached?.token === token) {
          setUser(cached.profile);
          setIsOfflineSession(true);
          setBackendError(false);
        } else {
          setBackendError(true);
        }
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Re-intentar conexión cuando vuelve internet
  useEffect(() => {
    const handler = () => {
      if (navigator.onLine && isOfflineSession) {
        fetchUser();
      }
    };
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [isOfflineSession, fetchUser]);

  const login = async (username, password) => {
    const pwHash = await hashForOffline(password);

    try {
      // Intentar login online
      const data = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      setBackendError(false);
      setIsOfflineSession(false);

      // Obtener perfil completo
      const me = await api.get("/auth/me");
      setUser(me);
      if (me.company_id) {
        localStorage.setItem('erp_company_id', String(me.company_id));
        // Notificar BrandingContext para que recargue con el branding correcto
        window.dispatchEvent(new CustomEvent('erp:login', { detail: { company_id: me.company_id } }));
      }

      // Cachear para login offline futuro
      await cacheAuthCredentials(username, pwHash, me);

      // Sincronizar catálogos en background
      startPeriodicSync();
      syncAllCatalogs().catch(() => {});
    } catch (err) {
      // Si no hay red, intentar login offline
      if (err.message?.includes("timeout") || err.message?.includes("fetch") || err.name === "TypeError" || !navigator.onLine) {
        const cached = await verifyOfflineAuth(username, pwHash);
        if (cached?.profile) {
          setUser(cached.profile);
          setIsOfflineSession(true);
          setBackendError(false);
          if (cached.token) localStorage.setItem("token", cached.token);
          return;
        }
        throw new Error("Sin conexión y sin sesión guardada. Conectate a internet al menos una vez.");
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("erp_company_id");
    localStorage.removeItem("erp_original_token");
    setUser(null);
    setBackendError(false);
    setIsOfflineSession(false);
  };

  const companyId = user?.company_id || localStorage.getItem('erp_company_id');
  const isMegaAdmin = user?.role === 'MEGAADMIN';
  const isImpersonating = !!localStorage.getItem('erp_original_token');

  function impersonate(newToken) {
    localStorage.setItem('erp_original_token', localStorage.getItem('token'));
    localStorage.setItem('token', newToken);
    window.location.reload();
  }

  function stopImpersonating() {
    const original = localStorage.getItem('erp_original_token');
    if (original) {
      localStorage.setItem('token', original);
      localStorage.removeItem('erp_original_token');
      window.location.reload();
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, backendError, isOfflineSession, login, logout, retry: fetchUser, companyId, isMegaAdmin, impersonate, stopImpersonating, isImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
