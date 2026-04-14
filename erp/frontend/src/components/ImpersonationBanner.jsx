import { useAuth } from '../context/AuthContext';
import { AlertTriangle } from 'lucide-react';

export default function ImpersonationBanner() {
  const { isImpersonating, stopImpersonating, user } = useAuth();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-400 text-amber-900 px-4 py-2 flex items-center justify-between text-sm font-medium sticky top-0 z-[100]">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span>Impersonando: <strong>{user?.full_name || user?.username}</strong> ({user?.role})</span>
      </div>
      <button
        onClick={stopImpersonating}
        className="bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-700 transition"
      >
        Volver a mi cuenta
      </button>
    </div>
  );
}
