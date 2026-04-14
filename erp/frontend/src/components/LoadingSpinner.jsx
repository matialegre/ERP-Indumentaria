import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Cargando...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
