import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Detecta errores de chunk lazy-load (nuevo deploy con hashes distintos)
function isChunkLoadError(error) {
  if (!error) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    error.name === 'ChunkLoadError'
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    // Si es un error de chunk (nuevo deploy), recargamos la página automáticamente
    // una sola vez para que el browser descargue el index.html actualizado.
    if (isChunkLoadError(error)) {
      const reloadKey = 'erp_chunk_reload_ts';
      const lastReload = parseInt(localStorage.getItem(reloadKey) || '0', 10);
      const now = Date.now();
      if (now - lastReload > 10_000) {
        localStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-800">Algo salió mal</h2>
          <p className="text-sm text-gray-500 text-center max-w-md">
            {this.state.error?.message || 'Error inesperado en este módulo'}
          </p>
          <button
            onClick={() => {
              if (this.state.isChunkError) {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null, isChunkError: false });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
