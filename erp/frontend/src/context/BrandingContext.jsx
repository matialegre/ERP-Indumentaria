import { createContext, useContext, useState, useEffect } from 'react';

const BrandingContext = createContext(null);

const DEFAULT_BRANDING = {
  company_id: null,
  app_name: 'ERP Sistema',
  short_name: 'ERP',
  primary_color: '#1e40af',
  secondary_color: '#3b82f6',
  logo_url: null,
  favicon_url: null,
  industry_type: null,
  welcome_message: null,
  company_name: null,
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  async function fetchBranding(companyId) {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = companyId
        ? `${API_BASE}/api/v1/branding/?company_id=${companyId}`
        : `${API_BASE}/api/v1/branding/`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBranding({ ...DEFAULT_BRANDING, ...data });
      }
    } catch (e) {
      console.warn('Branding fetch failed, using defaults:', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Leer company_id de localStorage (inyectado por Electron o guardado en login)
    const storedId = localStorage.getItem('erp_company_id');
    fetchBranding(storedId ? parseInt(storedId) : undefined);

    // Escuchar cambios de company_id (evento de login)
    const onLogin = (e) => fetchBranding(e.detail?.company_id);
    window.addEventListener('erp:login', onLogin);

    // También escuchar cambios de localStorage (cuando Electron inyecta después de load)
    const onStorage = (e) => {
      if (e.key === 'erp_company_id' && e.newValue) {
        fetchBranding(parseInt(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('erp:login', onLogin);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    // Aplicar colores al CSS root
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primary_color);
    root.style.setProperty('--color-secondary', branding.secondary_color);
    
    // Actualizar title del documento
    document.title = branding.app_name;
    
    // Actualizar favicon si hay uno custom
    if (branding.favicon_url) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding]);

  function refreshBranding() {
    const storedId = localStorage.getItem('erp_company_id');
    fetchBranding(storedId ? parseInt(storedId) : undefined);
  }

  return (
    <BrandingContext.Provider value={{ ...branding, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}

export default BrandingContext;
