import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle, iconColor: 'text-emerald-600', text: 'text-emerald-800' },
  error:   { bg: 'bg-red-50 border-red-200',         icon: XCircle,     iconColor: 'text-red-600',     text: 'text-red-800' },
  warning: { bg: 'bg-amber-50 border-amber-200',      icon: AlertTriangle, iconColor: 'text-amber-600', text: 'text-amber-800' },
  info:    { bg: 'bg-blue-50 border-blue-200',        icon: Info,        iconColor: 'text-blue-600',    text: 'text-blue-800' },
};

const MAX_TOASTS = 5;
const DEFAULT_MS = 4000;
const ERROR_MS = 6000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = ++idRef.current;
    const ms = duration ?? (type === 'error' ? ERROR_MS : DEFAULT_MS);
    setToasts(prev => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
    if (ms > 0) setTimeout(() => removeToast(id), ms);
    return id;
  }, [removeToast]);

  // Provide both the generic toast(msg, type) and convenience methods
  const value = useMemo(() => ({
    toast: addToast,
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
  }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = style.icon;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300
        ${style.bg} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button onClick={onDismiss} className="shrink-0 opacity-50 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
