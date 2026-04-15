import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Building2, CheckCircle2, XCircle,
  Package, Save, AlertTriangle, ChevronRight,
  Users, RefreshCw, ChevronDown, ChevronUp, Layers,
  Monitor, Plus, Copy, Trash2, RotateCcw, ShieldCheck, ShieldOff,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import {
  MODULOS, MODULOS_POR_CATEGORIA, LABEL_CATEGORIA, calcularPrecio,
  type Modulo, type Categoria,
} from '../lib/modules'
import {
  getEmpresa, getUser, saveModules, saveUserModules, toggleCompanyActive,
  getPCLicenses, createPCLicense, updatePCLicense, deletePCLicense,
  type EmpresaDetailAPI, type UserBriefAPI, type PCLicenseAPI,
} from '../lib/api'

const CAT_COLORS: Record<Categoria, string> = {
  core:          'text-indigo-400  bg-indigo-500/10  border-indigo-500/20',
  operaciones:   'text-sky-400     bg-sky-500/10     border-sky-500/20',
  integraciones: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  reportes:      'text-amber-400   bg-amber-500/10   border-amber-500/20',
  crm:           'text-pink-400    bg-pink-500/10    border-pink-500/20',
}

const CORE_SLUGS = MODULOS.filter(m => m.esCore).map(m => m.slug)

function getDynamicIcon(name: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name]
  return Icon ? <Icon size={16} /> : <Package size={16} />
}

function getMissingDeps(slug: string, activeModulos: string[]): string[] {
  const mod = MODULOS.find(m => m.slug === slug)
  if (!mod) return []
  return mod.dependencias.filter(dep => !activeModulos.includes(dep))
}

function getDependants(slug: string, activeModulos: string[]): string[] {
  return MODULOS.filter(m =>
    m.dependencias.includes(slug) && activeModulos.includes(m.slug)
  ).map(m => m.nombre)
}

type SaveStep = 'idle' | 'sending' | 'verifying' | 'done' | 'error'

function UsersList({ users, activeModulos }: { users: UserBriefAPI[], activeModulos: Set<string> }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<number, string[] | null>>({})
  const [saveStep, setSaveStep] = useState<Record<number, SaveStep>>({})
  const [saveLog, setSaveLog] = useState<Record<number, string[]>>({})
  const [confirmedUser, setConfirmedUser] = useState<Record<number, UserBriefAPI>>({})

  const activeList = [...activeModulos].filter(s => !MODULOS.find(m => m.slug === s)?.esCore)

  function addLog(userId: number, msg: string) {
    setSaveLog(p => ({ ...p, [userId]: [...(p[userId] ?? []), msg] }))
  }

  function initOverride(u: UserBriefAPI) {
    setOverrides(prev => {
      if (prev[u.id] !== undefined) return prev
      const normalized = u.modules_override !== null && u.modules_override !== undefined
        ? u.modules_override.map(s => s.toUpperCase())
        : null
      return { ...prev, [u.id]: normalized }
    })
  }

  function toggle(userId: number, slug: string) {
    setOverrides(prev => {
      const current = prev[userId] ?? null
      const base = current !== null ? current : activeList
      const set = new Set(base)
      if (set.has(slug)) set.delete(slug); else set.add(slug)
      return { ...prev, [userId]: [...set] }
    })
  }

  async function save(userId: number, username: string) {
    const override = overrides[userId] ?? null
    setSaveStep(p => ({ ...p, [userId]: 'sending' }))
    setSaveLog(p => ({ ...p, [userId]: [] }))
    addLog(userId, `⏳ Enviando cambios para @${username}...`)
    try {
      const updated = await saveUserModules(userId, override)
      addLog(userId, `✅ Servidor confirmó — guardado OK`)
      setSaveStep(p => ({ ...p, [userId]: 'verifying' }))
      addLog(userId, `🔍 Verificando en ERP...`)
      await new Promise(r => setTimeout(r, 600))
      const verified = await getUser(userId)
      const count = verified.modules_override?.length ?? null
      if (count !== null) {
        addLog(userId, `✅ ERP confirmado — ${count} módulo(s) activos para @${username}`)
      } else {
        addLog(userId, `✅ ERP confirmado — sin restricción (ve todos los módulos de la empresa)`)
      }
      setConfirmedUser(p => ({ ...p, [userId]: verified }))
      setSaveStep(p => ({ ...p, [userId]: 'done' }))
      setTimeout(() => setSaveStep(p => ({ ...p, [userId]: 'idle' })), 6000)
    } catch (e: unknown) {
      addLog(userId, `❌ Error: ${e instanceof Error ? e.message : 'Error desconocido'}`)
      setSaveStep(p => ({ ...p, [userId]: 'error' }))
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
        <Users size={14} className="text-slate-400" />
        Usuarios ({users.length})
      </h3>
      <div className="space-y-1">
        {users.map(u => {
          const isOpen = expandedId === u.id
          const currentOverride = overrides[u.id] !== undefined ? overrides[u.id] : u.modules_override
          const hasRestriction = currentOverride !== null && currentOverride !== undefined

          return (
            <div key={u.id} className="border border-slate-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between py-2.5 px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-white truncate">{u.full_name}</span>
                  <span className="text-xs text-slate-500">@{u.username}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasRestriction && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {currentOverride?.length ?? 0} mód.
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>{u.role}</span>
                  <button
                    onClick={() => { if (!isOpen) initOverride(u); setExpandedId(isOpen ? null : u.id) }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition"
                  >
                    <Layers size={11} />
                    Módulos
                    {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-3 pb-4 pt-2 border-t border-slate-800 bg-slate-950/40">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-400">
                      {!hasRestriction
                        ? 'Sin restricción — ve todos los módulos activos'
                        : `Restricción activa — ${currentOverride?.length ?? 0} módulo(s)`}
                    </p>
                    <button
                      onClick={() => setOverrides(p => ({ ...p, [u.id]: null }))}
                      className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Sin restricción
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                    {activeList.map(slug => {
                      const mod = MODULOS.find(m => m.slug === slug)
                      if (!mod) return null
                      const list = currentOverride !== null && currentOverride !== undefined ? currentOverride : activeList
                      const checked = list.includes(slug)
                      return (
                        <button
                          key={slug}
                          onClick={() => toggle(u.id, slug)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition text-left ${
                            checked
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                              : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          {checked
                            ? <CheckCircle2 size={11} className="shrink-0 text-indigo-400" />
                            : <XCircle size={11} className="shrink-0 text-slate-600" />}
                          <span className="truncate">{mod.nombre}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Log de pasos */}
                  {(saveLog[u.id]?.length > 0) && (
                    <div className="mb-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 space-y-0.5">
                      {saveLog[u.id].map((line, i) => (
                        <p key={i} className="text-xs font-mono text-slate-300">{line}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => save(u.id, u.username)}
                      disabled={saveStep[u.id] === 'sending' || saveStep[u.id] === 'verifying'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      <Save size={11} />
                      {saveStep[u.id] === 'sending' ? 'Enviando...' : saveStep[u.id] === 'verifying' ? 'Verificando...' : 'Guardar'}
                    </button>
                    {saveStep[u.id] === 'done' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 size={11} /> Confirmado en ERP
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PCLicenses({ companyId }: { companyId: number }) {
  const [licenses, setLicenses] = useState<PCLicenseAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setLicenses(await getPCLicenses(companyId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [companyId])

  async function handleCreate() {
    if (!newDesc.trim()) return
    setCreating(true)
    try {
      const lic = await createPCLicense(companyId, newDesc.trim())
      setLicenses(prev => [lic, ...prev])
      setNewDesc('')
      setShowForm(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(lic: PCLicenseAPI) {
    try {
      const updated = await updatePCLicense(lic.id, {
        is_active: !lic.is_active,
        deactivated_reason: lic.is_active ? 'Desactivada manualmente' : undefined,
      })
      setLicenses(prev => prev.map(l => l.id === lic.id ? updated : l))
    } catch {}
  }

  async function handleResetMachine(lic: PCLicenseAPI) {
    if (!confirm(`Resetear vinculación de equipo para "${lic.description}"?\n\nEsta licencia podrá usarse en una PC diferente.`)) return
    try {
      const updated = await updatePCLicense(lic.id, { reset_machine: true })
      setLicenses(prev => prev.map(l => l.id === lic.id ? updated : l))
    } catch {}
  }

  async function handleDelete(lic: PCLicenseAPI) {
    if (!confirm(`Eliminar licencia "${lic.description}" (${lic.key})?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await deletePCLicense(lic.id)
      setLicenses(prev => prev.filter(l => l.id !== lic.id))
    } catch {}
  }

  function copyKey(lic: PCLicenseAPI) {
    navigator.clipboard.writeText(lic.key)
    setCopiedId(lic.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function fmt(dt: string | null) {
    if (!dt) return '—'
    const d = new Date(dt)
    return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-violet-400" />
          <span className="text-sm font-semibold text-white">Licencias por PC</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{licenses.length}</span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={13} /> Nueva licencia
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 flex gap-3">
          <input
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            placeholder="Descripción (ej: Local Norte - PC Caja)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newDesc.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            {creating ? 'Creando...' : 'Crear'}
          </button>
          <button
            onClick={() => { setShowForm(false); setNewDesc('') }}
            className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 text-sm text-red-400 bg-red-900/10">{error}</div>
      )}

      {loading ? (
        <div className="px-5 py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : licenses.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-500 text-sm">
          No hay licencias creadas para esta empresa
        </div>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {licenses.map(lic => (
            <div key={lic.id} className="px-5 py-3.5 flex items-start gap-4">
              <div className="mt-0.5 shrink-0">
                {lic.is_active
                  ? <ShieldCheck size={16} className="text-emerald-400" />
                  : <ShieldOff size={16} className="text-slate-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{lic.description || '(sin descripción)'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${lic.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {lic.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                  {lic.machine_id && (
                    <span className="text-xs bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Vinculada</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono text-violet-300 bg-slate-800 px-2 py-0.5 rounded">{lic.key}</code>
                  <button onClick={() => copyKey(lic)} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                    <Copy size={11} />
                    {copiedId === lic.id ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  <span>Creada: {fmt(lic.created_at)}</span>
                  {lic.activated_at && <span>Vinculada: {fmt(lic.activated_at)}</span>}
                  {lic.last_seen_at && <span>Última vez: {fmt(lic.last_seen_at)}</span>}
                </div>
                {lic.machine_id && (
                  <div className="text-xs text-slate-600 mt-0.5 truncate max-w-sm">Equipo: {lic.machine_id}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggle(lic)}
                  title={lic.is_active ? 'Desactivar' : 'Activar'}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${lic.is_active ? 'text-emerald-400 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                >
                  {lic.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                </button>
                {lic.machine_id && (
                  <button
                    onClick={() => handleResetMachine(lic)}
                    title="Resetear equipo vinculado"
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(lic)}
                  title="Eliminar"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EmpresaDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [empresa, setEmpresa]     = useState<EmpresaDetailAPI | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [modulos, setModulos]     = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [tooltip, setTooltip]     = useState<string | null>(null)
  const [changed, setChanged]     = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await getEmpresa(Number(id))
      setEmpresa(data)
      // Backend stores slugs in UPPERCASE — keep as-is to match modules.ts catalog
      const active = data.modules.filter(m => m.is_active).map(m => m.module_slug.toUpperCase())
      setModulos(active)
      setChanged(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando empresa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const precio = useMemo(() => calcularPrecio(modulos), [modulos])
  const modulosActivos = useMemo(() => new Set([...CORE_SLUGS, ...modulos]), [modulos])

  function toggleModulo(slug: string, mod: Modulo) {
    if (mod.esCore) return
    setModulos(prev => {
      let next: string[]
      if (prev.includes(slug)) {
        const dependants = getDependants(slug, prev)
        if (dependants.length > 0) {
          setTooltip(`No podes desactivar "${mod.nombre}" porque lo requiere: ${dependants.join(', ')}`)
          setTimeout(() => setTooltip(null), 3500)
          return prev
        }
        next = prev.filter(s => s !== slug)
      } else {
        const missing = getMissingDeps(slug, prev)
        if (missing.length > 0) {
          const names = missing.map(s => MODULOS.find(m => m.slug === s)?.nombre ?? s)
          setTooltip(`Primero activa: ${names.join(', ')}`)
          setTimeout(() => setTooltip(null), 3500)
          return prev
        }
        next = [...prev, slug]
      }
      // Auto-guardar inmediatamente (slugs ya son UPPERCASE del modules.ts)
      if (empresa) {
        saveModules(empresa.id, next)
          .then(() => {
            setGuardado(true)
            setTimeout(() => setGuardado(false), 2000)
          })
          .catch((e: unknown) => {
            setTooltip(e instanceof Error ? e.message : 'Error guardando')
            setTimeout(() => setTooltip(null), 4000)
          })
      }
      setChanged(false)
      return next
    })
    setGuardado(false)
  }

  async function guardar() {
    if (!empresa) return
    setGuardando(true)
    try {
      // Backend expects UPPERCASE slugs (already UPPERCASE from modules.ts)
      await saveModules(empresa.id, modulos)
      setGuardado(true)
      setChanged(false)
      setTimeout(() => setGuardado(false), 3000)
    } catch (e: unknown) {
      setTooltip(e instanceof Error ? e.message : 'Error guardando')
      setTimeout(() => setTooltip(null), 4000)
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggleEmpresa() {
    if (!empresa) return
    try {
      const res = await toggleCompanyActive(empresa.id)
      setEmpresa(prev => prev ? { ...prev, is_active: res.is_active } : prev)
    } catch (e: unknown) {
      setTooltip(e instanceof Error ? e.message : 'Error')
      setTimeout(() => setTooltip(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !empresa) {
    return (
      <div className="p-8 text-center">
        <Building2 size={40} className="mx-auto mb-3 text-slate-600" />
        <p className="text-red-400 mb-2">{error || 'Empresa no encontrada'}</p>
        <Link to="/empresas" className="mt-4 inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm">
          <ArrowLeft size={14} /> Volver a empresas
        </Link>
      </div>
    )
  }

  const categorias: Categoria[] = ['core', 'operaciones', 'integraciones', 'reportes', 'crm']

  return (
    <div className="p-8 space-y-6 max-w-6xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/empresas" className="hover:text-slate-300 transition-colors">Empresas</Link>
        <ChevronRight size={14} />
        <span className="text-white">{empresa.app_name ?? empresa.name}</span>
      </div>

      {/* Header empresa */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg uppercase"
              style={{ backgroundColor: empresa.primary_color ?? '#6366f1' }}
            >
              {(empresa.app_name ?? empresa.name).slice(0, 2)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{empresa.app_name ?? empresa.name}</h1>
              {empresa.app_name && empresa.app_name !== empresa.name && (
                <p className="text-sm text-slate-400">{empresa.name}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                {empresa.cuit && <span className="font-mono">{empresa.cuit}</span>}
                {empresa.email && <span>{empresa.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Recargar"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleToggleEmpresa}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                empresa.is_active
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                  : 'text-slate-400 bg-slate-800 border-slate-700 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
              }`}
            >
              {empresa.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {empresa.is_active ? 'Activo — click para desactivar' : 'Inactivo — click para activar'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{empresa.users.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Usuarios</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{empresa.locals.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Locales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{modulos.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Módulos activos</p>
          </div>
        </div>
      </div>

      {/* Usuarios */}
      {empresa.users.length > 0 && (
        <UsersList users={empresa.users} activeModulos={modulosActivos} />
      )}

      {/* Licencias PC */}
      <PCLicenses companyId={empresa.id} />

      {/* Módulos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
             <h2 className="text-lg font-semibold text-white">Módulos</h2>
             <p className="text-sm text-slate-400">
              {modulos.length} activos + {CORE_SLUGS.length} core incluidos · Precio estimado:{' '}
              <span className="text-emerald-400">${precio}/mes</span>
             </p>
             <p className="text-xs text-slate-500 mt-1">
               Los cambios se guardan al instante y se reflejan en los ERP clientes en hasta 5 segundos.
             </p>
           </div>
          <div className="flex items-center gap-3">
            {guardando && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Guardando...
              </div>
            )}
            {guardado && !guardando && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={12} /> Guardado
              </span>
            )}
          </div>
        </div>

        {tooltip && (
          <div className="flex items-center gap-2 text-sm bg-amber-900/20 border border-amber-800/50 rounded-lg px-4 py-3 text-amber-400">
            <AlertTriangle size={14} />
            {tooltip}
          </div>
        )}

        {categorias.map(cat => (
          <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className={`px-5 py-3 border-b border-slate-800 flex items-center gap-2`}>
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>
                {LABEL_CATEGORIA[cat]}
              </span>
              <span className="text-xs text-slate-500">
                {MODULOS_POR_CATEGORIA[cat].filter(m => modulosActivos.has(m.slug)).length} / {MODULOS_POR_CATEGORIA[cat].length} activos
              </span>
            </div>

            <div className="divide-y divide-slate-800/50">
              {MODULOS_POR_CATEGORIA[cat].map(mod => {
                const active = modulosActivos.has(mod.slug)
                const missing = getMissingDeps(mod.slug, modulos)
                const canToggle = !mod.esCore

                return (
                  <div
                    key={mod.slug}
                    onClick={() => canToggle && toggleModulo(mod.slug, mod)}
                    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                      canToggle ? 'cursor-pointer hover:bg-slate-800/30' : 'opacity-70'
                    } ${active ? '' : 'opacity-60'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                      {getDynamicIcon(mod.icono)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-400'}`}>
                          {mod.nombre}
                        </span>
                        {mod.esCore && (
                          <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">Core</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{mod.descripcion}</p>
                      {missing.length > 0 && !active && (
                        <p className="text-xs text-amber-500 mt-0.5">
                          Requiere: {missing.map(s => MODULOS.find(m => m.slug === s)?.nombre ?? s).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-500">${mod.precioUsd}/mes</span>
                      <div className={`relative w-9 h-5 rounded-full transition-colors ${
                        active ? 'bg-indigo-600' : 'bg-slate-700'
                      } ${!canToggle ? 'opacity-50' : ''}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          active ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
