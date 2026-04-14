import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { subscribeConnStatus, getConnStatus, type ConnStatus } from '@/lib/api'
import { subscribeQueue, getAll } from '@/lib/offline-queue'

export default function OfflineBanner() {
  const [status, setStatus] = useState<ConnStatus>(getConnStatus)
  const [pendingCount, setPendingCount] = useState(() => getAll().length)

  useEffect(() => {
    const unsubConn = subscribeConnStatus(setStatus)
    const unsubQueue = subscribeQueue(ops => setPendingCount(ops.length))
    return () => { unsubConn(); unsubQueue() }
  }, [])

  // Online y sin pendientes → no mostrar nada
  if (status === 'online' && pendingCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-colors
        ${status === 'online'   ? 'bg-green-600 text-white' : ''}
        ${status === 'syncing'  ? 'bg-yellow-500 text-white' : ''}
        ${status === 'offline'  ? 'bg-red-600 text-white' : ''}
      `}
    >
      {status === 'online' && (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Online — sincronizado</span>
        </>
      )}

      {status === 'syncing' && (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Sincronizando{pendingCount > 0 ? ` (${pendingCount} operación${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''})` : '…'}</span>
        </>
      )}

      {status === 'offline' && (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            Sin conexión
            {pendingCount > 0
              ? ` — ${pendingCount} operación${pendingCount !== 1 ? 'es' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`
              : ' — los cambios se guardan localmente'
            }
          </span>
        </>
      )}
    </div>
  )
}
