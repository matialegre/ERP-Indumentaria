import { useState, useCallback } from 'react'
import { X, Upload, FileText, Link2, AlertTriangle, CheckCircle, Loader2, Trash2, Eye } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

// Proveedores soportados
const PROVEEDORES_SOPORTADOS = [
  { id: 'MIDING', nombre: 'MIDING S.R.L.', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'MONTAGNE', nombre: 'MONTAGNE OUTDOORS S.A.', color: 'bg-violet-100 text-violet-700' },
  { id: 'WORLD_SPORT', nombre: 'WORLD SPORT', color: 'bg-green-100 text-green-700' },
]

const openPDF = (file) => {
  if (!file) return
  const url = URL.createObjectURL(file)
  window.open(url, '_blank')
}

const normNum = (n) => n?.replace(/[-\s]/g, '').replace(/^0+/, '') || ''

// Converts DD/MM/YYYY → YYYY-MM-DD for backend
const parseFecha = (str) => {
  if (!str) return null
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

export default function CargaAvanzada({ onClose, onSuccess }) {
  const [docs, setDocs] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [resultadoGuardado, setResultadoGuardado] = useState(null)
  const [diffModal, setDiffModal] = useState(null)
  const [dragging, setDragging] = useState(false)

  // Load purchase orders for matching
  const { data: pedidosData } = useQuery({
    queryKey: ['purchase-orders-carga'],
    queryFn: () => api.get('/purchase-orders/?limit=500&status=ENVIADO'),
  })
  const pedidos = pedidosData?.items ?? []

  // Auto-associate facturas with remitos
  const autoAsociar = useCallback((docsList) => {
    const remitosEnBatch = docsList.filter(d => d.tipo === 'REMITO' && d.status !== 'error' && !d.duplicado)
    const facturasEnBatch = docsList.filter(d => (d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA') && d.status !== 'error' && !d.duplicado)

    return docsList.map(doc => {
      if (doc.duplicado) return doc

      if ((doc.tipo === 'FACTURA' || doc.tipo === 'REMITO_FACTURA') && doc.remitoRef) {
        const remito = remitosEnBatch.find(r => r.numero && normNum(r.numero) === normNum(doc.remitoRef || ''))
        return { ...doc, vinculadoA: remito ? remito.id : undefined }
      }

      if (doc.tipo === 'REMITO') {
        const facsAsociadas = facturasEnBatch.filter(f =>
          f.remitoRef && doc.numero && normNum(f.remitoRef) === normNum(doc.numero)
        )
        if (facsAsociadas.length > 0) {
          return { ...doc, vinculadoA: facsAsociadas[0].id, facturaAsociada: facsAsociadas.map(f => f.numero).join(', ') }
        }
        return { ...doc, vinculadoA: undefined, facturaAsociada: undefined }
      }

      return doc
    })
  }, [])

  const handleFiles = useCallback(async (files) => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    const nuevos = pdfFiles.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      fileName: f.name,
      status: 'extracting',
    }))

    setDocs(prev => [...prev, ...nuevos])

    try {
      const formData = new FormData()
      pdfFiles.forEach(f => formData.append('files', f))
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/pdf-parser/parse-pdfs-masivo`, {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        body: formData,
      })
      if (!res.ok) throw new Error('Error al analizar PDFs')
      const results = await res.json()

      setDocs(prev => {
        const existingNums = new Set(prev.filter(d => d.status === 'saved' || d.status === 'ya_existe').map(d => d.numero))
        const updated = prev.map(doc => {
          const result = results.find(r => r.filename === doc.fileName)
          if (!result) return doc
          if (result.error) return { ...doc, status: 'error', error: result.error }

          const otroIgual = prev.find(d => d.id !== doc.id && d.numero === result.numero && d.status !== 'error' && d.status !== 'saved')
          const duplicado = !!otroIgual

          // Try to auto-match to a pedido by nota_venta
          let matchNotaId = null
          let matchPedidoNumero = null
          let matchProveedorNombre = null
          if (result.nota_venta) {
            const match = pedidos.find(p => String(p.number || '').replace(/^0+/, '') === String(result.nota_venta).replace(/^0+/, ''))
            if (match) {
              matchNotaId = match.id
              matchPedidoNumero = match.number
              matchProveedorNombre = match.provider_name
            }
          }

          return {
            ...doc,
            status: existingNums.has(result.numero) ? 'ya_existe' : 'ready',
            tipo: result.tipo_doc,
            numero: result.numero,
            fecha: result.fecha,
            totalUnidades: result.total_unidades,
            totalItems: result.total_items,
            items: result.items,
            notaVenta: result.nota_venta,
            remitoRef: result.remito_ref,
            proveedorDetectado: result.proveedor,
            matchNotaId,
            matchPedidoNumero,
            matchProveedorNombre,
            duplicado,
            duplicadoMsg: otroIgual ? `Duplicado con "${otroIgual.fileName}"` : '',
            error: null,
          }
        })
        return autoAsociar(updated)
      })
    } catch (e) {
      setDocs(prev => prev.map(d =>
        d.status === 'extracting' ? { ...d, status: 'error', error: e.message || 'Error al analizar' } : d
      ))
    }
  }, [pedidos, autoAsociar])

  const eliminarDoc = (id) => {
    setDocs(prev => autoAsociar(prev.filter(d => d.id !== id)))
  }

  const updateDocNota = (id, pedidoId) => {
    const pedido = pedidos.find(p => p.id === parseInt(pedidoId))
    setDocs(prev => prev.map(d => d.id !== id ? d : {
      ...d,
      matchNotaId: pedido?.id || null,
      matchPedidoNumero: pedido?.number || null,
      matchProveedorNombre: pedido?.provider_name || null,
    }))
  }

  const guardarTodos = async () => {
    const listos = docs.filter(d => d.status === 'ready' && !d.duplicado && d.file)
    if (listos.length === 0) return
    setGuardando(true)
    let ok = 0, errorCount = 0

    const facturasDocs = listos.filter(d => d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA')
    const remitosDocs = listos.filter(d => d.tipo === 'REMITO')
    const ordenados = [...facturasDocs, ...remitosDocs]
    const idMap = {}

    for (const doc of ordenados) {
      try {
        const payload = {
          number: doc.numero,
          type: doc.tipo,
          date: parseFecha(doc.fecha) || new Date().toISOString().split('T')[0],
          purchase_order_id: doc.matchNotaId || null,
          observations: [
            doc.notaVenta ? `NV: ${doc.notaVenta}` : null,
            doc.totalUnidades ? `Unidades: ${doc.totalUnidades}` : null,
            doc.proveedorDetectado ? `Proveedor: ${doc.proveedorDetectado}` : null,
            doc.items?.length ? `Items: ${JSON.stringify(doc.items.slice(0, 5))}` : null,
          ].filter(Boolean).join(' | ') || null,
          status: 'ROJO',
          ingreso_status: 'PENDIENTE',
          remito_venta_number: null,
        }

        // Resolve linked_to_id
        if (doc.vinculadoA) {
          const linkedRealId = idMap[doc.vinculadoA]
          if (linkedRealId) payload.linked_to_id = linkedRealId
        }

        const saved = await api.post('/purchase-invoices/', payload)
        idMap[doc.id] = saved.id

        // Upload PDF
        try {
          const fd = new FormData()
          fd.append('file', doc.file)
          const token = localStorage.getItem('token')
          await fetch(`${API_BASE}/purchase-invoices/${saved.id}/upload-pdf`, {
            method: 'POST',
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            body: fd,
          })
        } catch { /* PDF upload is best-effort */ }

        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'saved' } : d))
        ok++
      } catch (e) {
        const detail = e?.message || 'Error'
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error', error: detail } : d))
        errorCount++
      }
    }

    // Post-save pass: link remaining FAC↔REM by remitoRef
    for (const doc of ordenados) {
      const realId = idMap[doc.id]
      if (!realId) continue
      if ((doc.tipo === 'FACTURA' || doc.tipo === 'REMITO_FACTURA') && doc.remitoRef) {
        const remitoDoc = docs.find(d => d.tipo === 'REMITO' && d.numero && normNum(d.numero) === normNum(doc.remitoRef))
        const targetId = remitoDoc ? idMap[remitoDoc.id] : null
        if (targetId) {
          try { await api.put(`/purchase-invoices/${realId}`, { linked_to_id: targetId }) } catch { /* best effort */ }
        }
      }
      if (doc.tipo === 'REMITO') {
        const facDoc = docs.find(d => (d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA') && d.remitoRef && normNum(d.remitoRef) === normNum(doc.numero || ''))
        const targetId = facDoc ? idMap[facDoc.id] : null
        if (targetId) {
          try { await api.put(`/purchase-invoices/${realId}`, { linked_to_id: targetId }) } catch { /* best effort */ }
        }
      }
    }

    setGuardando(false)
    setResultadoGuardado({ ok, error: errorCount })
    if (ok > 0 && onSuccess) onSuccess()
  }

  // Counters
  const yaExisten = docs.filter(d => d.status === 'ya_existe')
  const listos = docs.filter(d => d.status === 'ready' && !d.duplicado)
  const sinMatch = docs.filter(d => d.status === 'ready' && !d.duplicado && !d.matchNotaId)
  const conError = docs.filter(d => d.status === 'error')
  const duplicados = docs.filter(d => d.duplicado)
  const guardados = docs.filter(d => d.status === 'saved')
  const procesando = docs.filter(d => d.status === 'extracting')

  // Group by nota
  const docsAgrupados = {}
  const sinNota = []
  for (const doc of docs) {
    if (doc.matchNotaId || doc.matchPedidoNumero) {
      const key = doc.matchPedidoNumero || String(doc.matchNotaId)
      if (!docsAgrupados[key]) docsAgrupados[key] = []
      docsAgrupados[key].push(doc)
    } else {
      sinNota.push(doc)
    }
  }
  for (const key of Object.keys(docsAgrupados)) {
    docsAgrupados[key].sort((a, b) => {
      const aF = a.tipo === 'FACTURA' || a.tipo === 'REMITO_FACTURA'
      const bF = b.tipo === 'FACTURA' || b.tipo === 'REMITO_FACTURA'
      return (aF && !bF) ? -1 : (!aF && bF) ? 1 : 0
    })
  }

  // Build pair maps
  const globalPairFacForRem = {}
  const globalPairRemForFac = {}
  const remitosEmparejados = new Set()
  for (const doc of docs) {
    if ((doc.tipo === 'FACTURA' || doc.tipo === 'REMITO_FACTURA') && doc.vinculadoA) {
      const rem = docs.find(d => d.id === doc.vinculadoA && d.tipo === 'REMITO')
      if (rem) {
        globalPairRemForFac[doc.id] = rem
        if (!globalPairFacForRem[rem.id]) globalPairFacForRem[rem.id] = doc
        remitosEmparejados.add(rem.id)
      }
    }
  }
  for (const doc of docs) {
    if (doc.tipo === 'REMITO' && (doc.vinculadoA || doc.facturaAsociada)) {
      const fac = doc.vinculadoA ? docs.find(d => d.id === doc.vinculadoA) :
        docs.find(d => (d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA') && d.numero === doc.facturaAsociada)
      if (fac && !globalPairFacForRem[doc.id]) {
        globalPairFacForRem[doc.id] = fac
        if (!globalPairRemForFac[fac.id]) globalPairRemForFac[fac.id] = doc
        remitosEmparejados.add(doc.id)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-purple-700 to-purple-900">
          <div className="text-white">
            <h3 className="font-bold text-lg">Carga Avanzada de Documentos</h3>
            <p className="text-purple-200 text-sm">Subí facturas y remitos PDF — se extraen automáticamente y se vinculan entre sí</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Proveedor badges + clear */}
        <div className="mx-5 mt-3 mb-1 flex items-center gap-2 flex-wrap">
          {PROVEEDORES_SOPORTADOS.map(p => {
            const count = docs.filter(d => d.proveedorDetectado === p.id).length
            return count > 0 ? (
              <span key={p.id} className={`${p.color} px-2 py-1 rounded text-xs font-bold`}>
                {p.nombre} ({count})
              </span>
            ) : null
          })}
          {docs.some(d => d.proveedorDetectado === 'DESCONOCIDO') && (
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold">Proveedor desconocido</span>
          )}
          {docs.length > 0 && (
            <button onClick={() => setDocs([])} className="text-[10px] text-gray-400 hover:text-red-500 ml-auto">limpiar todo</button>
          )}
        </div>

        {/* Drop zone */}
        <div
          className={`mx-5 mb-2 border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
            dragging ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => document.getElementById('avanzada-file-input')?.click()}
        >
          <Upload className={`h-7 w-7 mx-auto mb-1.5 ${dragging ? 'text-purple-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600"><b>Arrastrá archivos PDF aquí</b> o hacé clic para seleccionar</p>
          <p className="text-xs text-gray-400 mt-1">Facturas y remitos — MIDING, MONTAGNE, WORLD SPORT detectados automáticamente</p>
          <input id="avanzada-file-input" type="file" accept=".pdf" multiple className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
        </div>

        {/* Stats */}
        {docs.length > 0 && (
          <div className="flex gap-2 px-5 mb-2 text-xs flex-wrap">
            {procesando.length > 0 && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{procesando.length} procesando...</span>}
            {listos.length > 0 && <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">{listos.length} listos</span>}
            {sinMatch.length > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">{sinMatch.length} sin pedido</span>}
            {yaExisten.length > 0 && <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">{yaExisten.length} ya en sistema</span>}
            {duplicados.length > 0 && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">{duplicados.length} duplicados</span>}
            {conError.length > 0 && <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-medium">{conError.length} con error</span>}
            {guardados.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">{guardados.length} guardados</span>}
          </div>
        )}

        {/* Documents list */}
        <div className="flex-1 overflow-auto px-5 pb-3">
          {docs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay archivos cargados aún</p>
              <p className="text-xs mt-1">Arrastrá PDFs de facturas o remitos de Miding, Montagne o World Sport</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grouped by pedido */}
              {Object.entries(docsAgrupados).map(([pedidoNumero, groupDocs]) => {
                const first = groupDocs.find(d => d.matchProveedorNombre)
                const provNombre = first?.matchProveedorNombre || ''
                const facCount = groupDocs.filter(d => d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA').length
                const remCount = groupDocs.filter(d => d.tipo === 'REMITO').length
                return (
                  <div key={pedidoNumero} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-800 text-white px-4 py-2 flex items-center gap-3 text-sm">
                      <span className="font-bold">#{pedidoNumero}</span>
                      {provNombre && <span className="text-gray-300">{provNombre}</span>}
                      <div className="ml-auto flex gap-2">
                        {facCount > 0 && <span className="bg-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{facCount} FAC</span>}
                        {remCount > 0 && <span className="bg-orange-500 px-1.5 py-0.5 rounded text-[10px] font-bold">{remCount} REM</span>}
                      </div>
                    </div>
                    <div className="divide-y">
                      {(() => {
                        const facturasUsadasIds = new Set()
                        const remitosUsadosIds = new Set()
                        const rows = []
                        const facturasInGroup = groupDocs.filter(d => d.tipo === 'FACTURA' || d.tipo === 'REMITO_FACTURA')
                        for (const fac of facturasInGroup) {
                          const rem = globalPairRemForFac[fac.id]
                          if (rem) { facturasUsadasIds.add(fac.id); remitosUsadosIds.add(rem.id); rows.push({ fac, rem }) }
                        }
                        const remitosInGroup = groupDocs.filter(d => d.tipo === 'REMITO')
                        for (const rem of remitosInGroup) {
                          if (remitosUsadosIds.has(rem.id)) continue
                          const fac = globalPairFacForRem[rem.id]
                          if (fac && !facturasUsadasIds.has(fac.id)) {
                            facturasUsadasIds.add(fac.id); remitosUsadosIds.add(rem.id); rows.push({ fac, rem })
                          }
                        }
                        for (const doc of groupDocs) {
                          if (!remitosUsadosIds.has(doc.id) && !facturasUsadasIds.has(doc.id) && !remitosEmparejados.has(doc.id)) {
                            rows.push({ solo: doc })
                          }
                        }
                        return rows.map((row, i) => row.solo
                          ? <DocRow key={row.solo.id} doc={row.solo} docs={docs} pedidos={pedidos} onDelete={eliminarDoc} onChangePedido={updateDocNota} />
                          : <PairedRow key={`pair-${i}`} fac={row.fac} rem={row.rem}
                              onDeleteFac={() => eliminarDoc(row.fac.id)} onDeleteRem={() => eliminarDoc(row.rem.id)}
                              onShowDiff={() => setDiffModal({ fac: row.fac, rem: row.rem })} />
                        )
                      })()}
                    </div>
                  </div>
                )
              })}

              {/* Sin nota */}
              {sinNota.length > 0 && (
                <div className="border border-amber-300 rounded-lg overflow-hidden">
                  <div className="bg-amber-100 text-amber-800 px-4 py-2 text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Sin pedido asignado ({sinNota.length})
                    <span className="text-amber-600 text-xs font-normal ml-1">— Asigná manualmente o se guardarán sin pedido</span>
                  </div>
                  <div className="divide-y">
                    {sinNota.map(doc => (
                      <DocRow key={doc.id} doc={doc} docs={docs} pedidos={pedidos} onDelete={eliminarDoc} onChangePedido={updateDocNota} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {resultadoGuardado ? (
              <span className={resultadoGuardado.error > 0 ? 'text-yellow-700' : 'text-emerald-700'}>
                {resultadoGuardado.ok > 0 && `${resultadoGuardado.ok} guardados`}
                {resultadoGuardado.error > 0 && ` · ${resultadoGuardado.error} con error`}
              </span>
            ) : listos.length > 0 ? (
              <span>{listos.length} documento{listos.length > 1 ? 's' : ''} listo{listos.length > 1 ? 's' : ''} para guardar</span>
            ) : (
              <span>Subí archivos PDF para comenzar</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm">
              {guardados.length > 0 ? 'Cerrar' : 'Cancelar'}
            </button>
            {listos.length > 0 && !resultadoGuardado && (
              <button onClick={guardarTodos} disabled={guardando || procesando.length > 0}
                className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                  guardando || procesando.length > 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}>
                {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : <><CheckCircle className="h-4 w-4" /> Guardar {listos.length} documento{listos.length > 1 ? 's' : ''}</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Diff modal */}
      {diffModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => setDiffModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-yellow-600 to-yellow-800">
              <div className="text-white">
                <h3 className="font-bold text-lg">Diferencias de Artículos</h3>
                <p className="text-yellow-200 text-sm">
                  FAC {diffModal.fac.numero} ({diffModal.fac.totalUnidades}u) vs REM {diffModal.rem.numero} ({diffModal.rem.totalUnidades}u)
                  {' · Dif: '}<b>{Math.abs((diffModal.rem.totalUnidades || 0) - (diffModal.fac.totalUnidades || 0))}u</b>
                </p>
              </div>
              <button onClick={() => setDiffModal(null)} className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <DiffTable fac={diffModal.fac} rem={diffModal.rem} />
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setDiffModal(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DiffTable({ fac, rem }) {
  const facItems = fac.items || []
  const remItems = rem.items || []
  const allCods = new Set([...facItems.map(i => i.codigo_articulo), ...remItems.map(i => i.codigo_articulo)])
  const rows = Array.from(allCods).map(cod => {
    const fi = facItems.find(i => i.codigo_articulo === cod)
    const ri = remItems.find(i => i.codigo_articulo === cod)
    const facU = fi?.unidades || 0
    const remU = ri?.unidades || 0
    const diff = remU - facU
    return { cod, desc: fi?.descripcion || ri?.descripcion || '', facU, remU, diff }
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  if (rows.length === 0) return <p className="text-center text-gray-400 py-8">Sin datos de artículos</p>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 text-left">
          <th className="py-2 px-2 text-gray-600">Código</th>
          <th className="py-2 px-2 text-gray-600">Descripción</th>
          <th className="py-2 px-2 text-right text-blue-600">FAC (u)</th>
          <th className="py-2 px-2 text-right text-orange-600">REM (u)</th>
          <th className="py-2 px-2 text-right text-gray-600">Dif.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.cod} className={`border-b ${r.diff !== 0 ? 'bg-yellow-50' : ''}`}>
            <td className="py-1.5 px-2 font-mono text-xs text-gray-700">{r.cod}</td>
            <td className="py-1.5 px-2 text-xs text-gray-600 truncate max-w-[200px]">{r.desc}</td>
            <td className="py-1.5 px-2 text-right font-mono text-xs">{r.facU || <span className="text-red-400">—</span>}</td>
            <td className="py-1.5 px-2 text-right font-mono text-xs">{r.remU || <span className="text-red-400">—</span>}</td>
            <td className={`py-1.5 px-2 text-right font-mono text-xs font-bold ${r.diff > 0 ? 'text-green-600' : r.diff < 0 ? 'text-red-600' : 'text-gray-300'}`}>
              {r.diff > 0 ? `+${r.diff}` : r.diff === 0 ? '=' : r.diff}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-bold">
          <td className="py-2 px-2" colSpan={2}>TOTAL</td>
          <td className="py-2 px-2 text-right text-blue-700">{fac.totalUnidades}</td>
          <td className="py-2 px-2 text-right text-orange-700">{rem.totalUnidades}</td>
          <td className={`py-2 px-2 text-right ${(rem.totalUnidades||0)-(fac.totalUnidades||0) !== 0 ? 'text-yellow-700' : 'text-green-700'}`}>
            {((rem.totalUnidades||0)-(fac.totalUnidades||0)) > 0 ? '+' : ''}{(rem.totalUnidades||0)-(fac.totalUnidades||0)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function DocRow({ doc, docs, pedidos, onDelete, onChangePedido }) {
  const [showItems, setShowItems] = useState(false)
  const vinculadoDoc = doc.vinculadoA ? docs.find(d => d.id === doc.vinculadoA) : null

  const bgColor =
    doc.status === 'ya_existe' ? 'bg-gray-50' :
    doc.status === 'saved' ? 'bg-green-50' :
    doc.status === 'error' ? 'bg-red-50' :
    doc.duplicado ? 'bg-yellow-50' :
    doc.status === 'extracting' ? 'bg-blue-50' : 'bg-white'

  return (
    <div className={bgColor}>
      <div className="px-4 py-2 flex items-center gap-3">
        {doc.status === 'extracting' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />}
        {doc.status === 'ya_existe' && <CheckCircle className="h-4 w-4 text-gray-400 shrink-0" />}
        {doc.status === 'ready' && !doc.duplicado && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
        {doc.status === 'saved' && <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />}
        {doc.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
        {doc.duplicado && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}

        {doc.tipo && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0 ${
            doc.tipo === 'FACTURA' ? 'bg-blue-600' : doc.tipo === 'REMITO_FACTURA' ? 'bg-indigo-600' : 'bg-orange-500'
          } ${doc.status === 'ya_existe' ? 'opacity-50' : ''}`}>
            {doc.tipo === 'FACTURA' ? 'FAC' : doc.tipo === 'REMITO_FACTURA' ? 'R-FAC' : 'REM'}
          </span>
        )}

        {doc.proveedorDetectado && doc.proveedorDetectado !== 'DESCONOCIDO' && (
          <span className={`px-1 py-0.5 rounded text-[8px] font-bold shrink-0 ${
            doc.proveedorDetectado === 'MIDING' ? 'bg-cyan-100 text-cyan-700' :
            doc.proveedorDetectado === 'MONTAGNE' ? 'bg-violet-100 text-violet-700' :
            'bg-green-100 text-green-700'
          }`}>{doc.proveedorDetectado}</span>
        )}

        {doc.numero && (
          <span className={`font-mono font-bold text-sm shrink-0 ${doc.status === 'ya_existe' ? 'text-gray-400' : 'text-gray-800'}`}>{doc.numero}</span>
        )}
        {doc.totalUnidades != null && <span className="text-xs text-gray-500 shrink-0">{doc.totalUnidades}u</span>}
        {(doc.tipo === 'FACTURA' || doc.tipo === 'REMITO_FACTURA') && doc.remitoRef && (
          <span className="text-[8px] text-blue-400 shrink-0">(→Rem:{doc.remitoRef})</span>
        )}
        {doc.fecha && <span className="text-xs text-gray-400 shrink-0">{doc.fecha}</span>}

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {doc.status === 'ya_existe' && <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold">YA EN SISTEMA</span>}
          {doc.status === 'saved' && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">GUARDADO</span>}
          {doc.status === 'ready' && !doc.duplicado && !doc.matchNotaId && (
            <select className="text-[10px] border rounded px-1 py-0.5 text-gray-600 bg-amber-50 border-amber-300"
              value="" onChange={(e) => onChangePedido(doc.id, e.target.value)}>
              <option value="">Sin pedido — asignar...</option>
              {pedidos.map(p => <option key={p.id} value={p.id}>#{p.number} — {p.provider_name}</option>)}
            </select>
          )}
          {vinculadoDoc && (
            <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
              <Link2 className="h-3 w-3" /> → {vinculadoDoc.numero}
            </span>
          )}
          {doc.error && <span className="text-[10px] text-red-600 truncate">{doc.error}</span>}
          {doc.duplicado && doc.duplicadoMsg && <span className="text-[10px] text-yellow-700">{doc.duplicadoMsg}</span>}
        </div>

        <span className="text-[9px] text-gray-300 truncate max-w-[120px] shrink-0">{doc.fileName}</span>

        {doc.file && (
          <button onClick={() => openPDF(doc.file)} className="p-1 rounded shrink-0 text-gray-300 hover:text-violet-500 hover:bg-violet-50" title="Ver PDF">
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        {doc.items?.length > 0 && (
          <button onClick={() => setShowItems(v => !v)}
            className={`p-1 rounded shrink-0 ${showItems ? 'text-blue-600 bg-blue-100' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'}`}
            title="Ver ítems extraídos">
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        {doc.status !== 'saved' && doc.status !== 'extracting' && doc.status !== 'ya_existe' && (
          <button onClick={() => onDelete(doc.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showItems && doc.items?.length > 0 && (
        <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 sticky top-0">
                <th className="px-3 py-1 text-left text-gray-600">Código</th>
                <th className="px-3 py-1 text-left text-gray-600">Descripción</th>
                <th className="px-3 py-1 text-right text-gray-600">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-0.5 font-mono text-[10px] text-blue-700">{item.codigo_articulo}</td>
                  <td className="px-3 py-0.5 text-gray-700 truncate max-w-[220px]">{item.descripcion || '—'}</td>
                  <td className="px-3 py-0.5 text-right font-bold text-blue-700">{item.unidades}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                <td colSpan={2} className="px-3 py-1 text-right text-xs text-blue-700">Total</td>
                <td className="px-3 py-1 text-right text-sm text-blue-800">{doc.totalUnidades}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function PairedRow({ fac, rem, onDeleteFac, onDeleteRem, onShowDiff }) {
  const bothSaved = fac.status === 'saved' && rem.status === 'saved'
  const cantDif = fac.totalUnidades != null && rem.totalUnidades != null && fac.totalUnidades !== rem.totalUnidades
  const bgColor = bothSaved ? 'bg-green-50' : cantDif ? 'bg-yellow-50/50' : 'bg-indigo-50/50'

  return (
    <div className={`px-4 py-2 flex items-center gap-2 ${bgColor}`}>
      {bothSaved ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /> : <Link2 className="h-4 w-4 text-indigo-500 shrink-0" />}

      <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">FAC</span>
      <span className="font-mono font-bold text-[11px] text-gray-800 shrink-0">{fac.numero}</span>
      <span className="text-xs text-gray-500 shrink-0">{fac.totalUnidades}u</span>
      {fac.file && (
        <button onClick={() => openPDF(fac.file)} className="p-0.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded shrink-0" title="Ver PDF FAC">
          <Eye className="h-3 w-3" />
        </button>
      )}

      <span className="text-indigo-400 font-bold shrink-0">↔</span>

      <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">REM</span>
      <span className="font-mono font-bold text-[11px] text-gray-800 shrink-0">{rem.numero}</span>
      <span className="text-xs text-gray-500 shrink-0">{rem.totalUnidades}u</span>
      {rem.file && (
        <button onClick={() => openPDF(rem.file)} className="p-0.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded shrink-0" title="Ver PDF REM">
          <Eye className="h-3 w-3" />
        </button>
      )}

      {cantDif ? (
        <button onClick={onShowDiff} className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 hover:bg-yellow-200 flex items-center gap-1">
          <Eye className="h-3 w-3" /> ⚠ Cant. diferente
        </button>
      ) : fac.totalUnidades != null && rem.totalUnidades != null ? (
        <button onClick={onShowDiff} className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 hover:bg-green-200 flex items-center gap-1">
          <Eye className="h-3 w-3" /> ✓ Cant. OK
        </button>
      ) : null}

      <div className="flex-1" />
      {bothSaved && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">GUARDADO</span>}
      {fac.status !== 'saved' && (
        <button onClick={onDeleteFac} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0" title="Eliminar FAC">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {rem.status !== 'saved' && (
        <button onClick={onDeleteRem} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded shrink-0" title="Eliminar REM">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
