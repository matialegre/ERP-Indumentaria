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
    const token = sessionStorage.getItem("token");
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
      // Auto-set local from user's assigned local (if not already set)
      if (me.local_id && me.local_name && !localStorage.getItem('selectedLocalId')) {
        localStorage.setItem('selectedLocalId', String(me.local_id));
        localStorage.setItem('selectedLocalName', me.local_name);
      }
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
        sessionStorage.removeItem("token");
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
      sessionStorage.setItem("token", data.access_token);
      setBackendError(false);
      setIsOfflineSession(false);

      // Obtener perfil completo
      const me = await api.get("/auth/me");
      setUser(me);
      if (me.company_id) {
        localStorage.setItem('erp_company_id', String(me.company_id));
        window.dispatchEvent(new CustomEvent('erp:login', { detail: { company_id: me.company_id } }));
      }
      // Auto-set local from user's assigned local
      if (me.local_id && me.local_name) {
        localStorage.setItem('selectedLocalId', String(me.local_id));
        localStorage.setItem('selectedLocalName', me.local_name);
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
          if (cached.token) sessionStorage.setItem("token", cached.token);
          return;
        }
        throw new Error("Sin conexión y sin sesión guardada. Conectate a internet al menos una vez.");
      }
      throw err;
    }
  };

  const loginWithToken = async (token) => {
    sessionStorage.setItem("token", token);
    setBackendError(false);
    setIsOfflineSession(false);
    const me = await api.get("/auth/me");
    setUser(me);
    if (me.company_id) {
      localStorage.setItem("erp_company_id", String(me.company_id));
      window.dispatchEvent(new CustomEvent("erp:login", { detail: { company_id: me.company_id } }));
    }
    if (me.local_id && me.local_name) {
      localStorage.setItem("selectedLocalId", String(me.local_id));
      localStorage.setItem("selectedLocalName", me.local_name);
    }
    startPeriodicSync();
    syncAllCatalogs().catch(() => {});
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    localStorage.removeItem("erp_company_id");
    sessionStorage.removeItem("erp_original_token");
    setUser(null);
    setBackendError(false);
    setIsOfflineSession(false);
  };

  const companyId = user?.company_id || localStorage.getItem('erp_company_id');
  const isMegaAdmin = user?.role === 'MEGAADMIN';
  const isImpersonating = !!sessionStorage.getItem('erp_original_token');

  function impersonate(newToken) {
    sessionStorage.setItem('erp_original_token', sessionStorage.getItem('token'));
    sessionStorage.setItem('token', newToken);
    window.location.reload();
  }

  function stopImpersonating() {
    const original = sessionStorage.getItem('erp_original_token');
    if (original) {
      sessionStorage.setItem('token', original);
      sessionStorage.removeItem('erp_original_token');
      window.location.reload();
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, backendError, isOfflineSession, login, loginWithToken, logout, retry: fetchUser, companyId, isMegaAdmin, impersonate, stopImpersonating, isImpersonating, modulesReadonly: user?.modules_readonly ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

/** Returns { canView: true, canEdit: bool } for a given module slug.
 *  canEdit is false when the module slug is in user.modules_readonly.
 *  MEGAADMIN / SUPERADMIN always get canEdit=true. */
export function useModulePermission(slug) {
  const { user } = useAuth();
  if (!user) return { canView: false, canEdit: false };
  if (['MEGAADMIN', 'SUPERADMIN'].includes(user.role)) return { canView: true, canEdit: true };
  const ro = (user.modules_readonly ?? []).map(s => s.toUpperCase());
  return { canView: true, canEdit: !ro.includes(slug.toUpperCase()) };
}
