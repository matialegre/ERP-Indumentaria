import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Building2, CheckCircle2, XCircle,
  Package, Save, AlertTriangle, ChevronRight,
  Users, RefreshCw, ChevronDown, ChevronUp, Layers,
  Monitor, Plus, Copy, Trash2, RotateCcw, ShieldCheck, ShieldOff,
  MapPin, Eye, Edit3, Lock, Unlock,
  UserCog, Mail, KeyRound, UserCheck,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import {
  MODULOS, MODULOS_POR_CATEGORIA, LABEL_CATEGORIA, calcularPrecio,
  type Modulo, type Categoria,
} from '../lib/modules'
import {
  getEmpresa, getUser, saveModules, saveUserModules, saveUserModulePermissions, toggleCompanyActive,
  getPCLicenses, getLocals, createPCLicense, updatePCLicense, deletePCLicense, updateUser,
  type EmpresaDetailAPI, type UserBriefAPI, type PCLicenseAPI, type LocalAPI, type UpdateUserPayload,
} from '../lib/api'

const AVAILABLE_ROLES = [
  'ADMIN', 'COMPRAS', 'ADMINISTRACION', 'GESTION_PAGOS',
  'VENDEDOR', 'DEPOSITO', 'SUPERVISOR', 'MONITOREO', 'TRANSPORTE',
]

const CAT_COLORS: Record<Categoria, string> = {
  core:          'text-indigo-400  bg-indigo-500/10  border-indigo-500/20',
  operaciones:   'text-sky-400     bg-sky-500/10     border-sky-500/20',
  integraciones: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  reportes:      'text-amber-400   bg-amber-500/10   border-amber-500/20',
  crm:           'text-pink-400    bg-pink-500/10    border-pink-500/20',
  rfid:          'text-teal-400    bg-teal-500/10    border-teal-500/20',
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
type ModuleState = 'hidden' | 'editable' | 'readonly'

interface UserDataEdits {
  full_name: string
  email: string
  role: string
  new_password: string
}

function UsersList({ users, activeModulos }: { users: UserBriefAPI[], activeModulos: Set<string> }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [permTab, setPermTab] = useState<Record<number, 'datos' | 'permisos'>>({})
  const [overrides, setOverrides] = useState<Record<number, string[] | null>>({})
  const [readonlyOverrides, setReadonlyOverrides] = useState<Record<number, string[] | null>>({})
  const [userEdits, setUserEdits] = useState<Record<number, UserDataEdits>>({})
  const [dataSaveStep, setDataSaveStep] = useState<Record<number, SaveStep>>({})
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
    setReadonlyOverrides(prev => {
      if (prev[u.id] !== undefined) return prev
      const normalized = u.modules_readonly !== null && u.modules_readonly !== undefined
        ? u.modules_readonly.map(s => s.toUpperCase())
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

  function toggleReadonly(userId: number, slug: string) {
    setReadonlyOverrides(prev => {
      const current = prev[userId] ?? []
      const set = new Set(current)
      if (set.has(slug)) set.delete(slug); else set.add(slug)
      return { ...prev, [userId]: [...set] }
    })
  }

  function initUserEdits(u: UserBriefAPI) {
    setUserEdits(prev => {
      if (prev[u.id] !== undefined) return prev
      return { ...prev, [u.id]: {
        full_name: u.full_name ?? '',
        email: u.email ?? '',
        role: u.role,
        new_password: '',
      } }
    })
  }

  function getModuleState(userId: number, slug: string): ModuleState {
    const override = overrides[userId] !== undefined ? overrides[userId] : null
    const readonly = readonlyOverrides[userId] !== undefined ? readonlyOverrides[userId] : null
    const visibleList = override !== null && override !== undefined ? override : activeList
    const visible = visibleList.includes(slug)
    if (!visible) return 'hidden'
    return (readonly ?? []).includes(slug) ? 'readonly' : 'editable'
  }

  function setModuleState(userId: number, slug: string, target: ModuleState) {
    setOverrides(prev => {
      const cur = prev[userId] !== undefined ? prev[userId] : null
      const base = cur !== null ? cur : activeList
      const set = new Set(base)
      if (target === 'hidden') set.delete(slug); else set.add(slug)
      return { ...prev, [userId]: [...set] }
    })
    setReadonlyOverrides(prev => {
      const cur = prev[userId] ?? []
      const set = new Set(cur)
      if (target === 'readonly') set.add(slug); else set.delete(slug)
      return { ...prev, [userId]: [...set] }
    })
  }

  function cycleModuleState(userId: number, slug: string) {
    const s = getModuleState(userId, slug)
    const next: ModuleState = s === 'editable' ? 'readonly' : s === 'readonly' ? 'hidden' : 'editable'
    setModuleState(userId, slug, next)
  }

  function setGroupState(userId: number, slugs: string[], target: ModuleState) {
    slugs.forEach(s => setModuleState(userId, s, target))
  }

  async function saveUserData(userId: number, username: string) {
    const edits = userEdits[userId]
    if (!edits) return
    setDataSaveStep(p => ({ ...p, [userId]: 'sending' }))
    try {
      const payload: UpdateUserPayload = {
        full_name: edits.full_name.trim(),
        email: edits.email.trim() || null,
        role: edits.role,
      }
      if (edits.new_password.trim()) payload.new_password = edits.new_password.trim()
      const updated = await updateUser(userId, payload)
      setConfirmedUser(p => ({ ...p, [userId]: updated }))
      addLog(userId, `✅ Datos de @${username} actualizados`)
      setUserEdits(p => ({ ...p, [userId]: { ...edits, new_password: '' } }))
      setDataSaveStep(p => ({ ...p, [userId]: 'done' }))
      setTimeout(() => setDataSaveStep(p => ({ ...p, [userId]: 'idle' })), 4000)
    } catch (e: unknown) {
      addLog(userId, `❌ Error datos: ${e instanceof Error ? e.message : 'Error'}`)
      setDataSaveStep(p => ({ ...p, [userId]: 'error' }))
    }
  }

  async function save(userId: number, username: string) {
    const override = overrides[userId] ?? null
    const readonly = readonlyOverrides[userId] ?? null
    setSaveStep(p => ({ ...p, [userId]: 'sending' }))
    setSaveLog(p => ({ ...p, [userId]: [] }))
    addLog(userId, `⏳ Enviando cambios para @${username}...`)
    try {
      await saveUserModules(userId, override)
      await saveUserModulePermissions(userId, readonly)
      addLog(userId, `✅ Servidor confirmó — guardado OK`)
      setSaveStep(p => ({ ...p, [userId]: 'verifying' }))
      addLog(userId, `🔍 Verificando en ERP...`)
      await new Promise(r => setTimeout(r, 600))
      const verified = await getUser(userId)
      const count = verified.modules_override?.length ?? null
      const roCount = verified.modules_readonly?.length ?? 0
      if (count !== null) {
        addLog(userId, `✅ ERP confirmado — ${count} módulo(s) activos, ${roCount} solo lectura`)
      } else {
        addLog(userId, `✅ ERP confirmado — sin restricción${roCount > 0 ? `, ${roCount} módulos en lectura` : ''}`)
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
          const tab = permTab[u.id] ?? 'datos'
          const edits = userEdits[u.id]
          const currentOverride = overrides[u.id] !== undefined ? overrides[u.id] : u.modules_override
          const currentReadonly = readonlyOverrides[u.id] !== undefined ? readonlyOverrides[u.id] : (u.modules_readonly ?? [])
          const hasRestriction = currentOverride !== null && currentOverride !== undefined
          const hasReadonly = (currentReadonly?.length ?? 0) > 0

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
                  {hasReadonly && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <Eye size={9} /> {currentReadonly?.length}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>{u.role}</span>
                  <button
                    onClick={() => { if (!isOpen) { initOverride(u); initUserEdits(u) } setExpandedId(isOpen ? null : u.id) }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition"
                  >
                    <Layers size={11} />
                    Permisos
                    {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-3 pb-4 pt-2 border-t border-slate-800 bg-slate-950/40">
                  {/* Tab selector */}
                  <div className="flex gap-1 mb-3 bg-slate-900 rounded-lg p-1">
                    <button
                      onClick={() => setPermTab(p => ({ ...p, [u.id]: 'datos' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition ${
                        tab === 'datos' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <UserCog size={11} /> Datos del usuario
                    </button>
                    <button
                      onClick={() => setPermTab(p => ({ ...p, [u.id]: 'permisos' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition ${
                        tab === 'permisos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Layers size={11} /> Módulos y permisos
                    </button>
                  </div>

                  {tab === 'datos' && edits && (
                    <div className="space-y-3 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><UserCheck size={11} /> Nombre completo</label>
                          <input
                            type="text"
                            value={edits.full_name}
                            onChange={(e) => setUserEdits(p => ({ ...p, [u.id]: { ...edits, full_name: e.target.value } }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Mail size={11} /> Email</label>
                          <input
                            type="email"
                            value={edits.email}
                            onChange={(e) => setUserEdits(p => ({ ...p, [u.id]: { ...edits, email: e.target.value } }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Users size={11} /> Usuario</label>
                          <input type="text" value={u.username} disabled className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><ShieldCheck size={11} /> Rol</label>
                          <select
                            value={edits.role}
                            onChange={(e) => setUserEdits(p => ({ ...p, [u.id]: { ...edits, role: e.target.value } }))}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          >
                            {AVAILABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                            <KeyRound size={11} /> Nueva contraseña <span className="text-slate-600">(dejar vacío para no cambiar)</span>
                          </label>
                          <input
                            type="password"
                            value={edits.new_password}
                            onChange={(e) => setUserEdits(p => ({ ...p, [u.id]: { ...edits, new_password: e.target.value } }))}
                            placeholder="••••••••"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => saveUserData(u.id, u.username)}
                          disabled={dataSaveStep[u.id] === 'sending'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                        >
                          <Save size={11} />
                          {dataSaveStep[u.id] === 'sending' ? 'Guardando...' : 'Guardar datos'}
                        </button>
                        {dataSaveStep[u.id] === 'done' && (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 size={11} /> Guardado
                          </span>
                        )}
                        {dataSaveStep[u.id] === 'error' && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <XCircle size={11} /> Error al guardar
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {tab === 'permisos' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><XCircle size={11} className="text-slate-600" /> Oculto</span>
                          <span className="flex items-center gap-1"><Edit3 size={11} className="text-emerald-400" /> Editable</span>
                          <span className="flex items-center gap-1"><Eye size={11} className="text-yellow-400" /> Solo lectura</span>
                          <span className="text-slate-600">— clic para ciclar</span>
                        </div>
                        <button
                          onClick={() => { setOverrides(p => ({ ...p, [u.id]: null })); setReadonlyOverrides(p => ({ ...p, [u.id]: null })) }}
                          className="text-xs text-slate-500 hover:text-slate-300 underline"
                        >
                          Sin restricción (todo editable)
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(Object.keys(MODULOS_POR_CATEGORIA) as Categoria[])
                          .filter(cat => cat !== 'core')
                          .map(cat => {
                            const catMods = MODULOS_POR_CATEGORIA[cat].filter(m => activeModulos.has(m.slug))
                            if (catMods.length === 0) return null
                            const catSlugs = catMods.map(m => m.slug)
                            const allHidden = catSlugs.every(s => getModuleState(u.id, s) === 'hidden')
                            return (
                              <div key={cat} className={`rounded-lg border p-3 ${CAT_COLORS[cat]} bg-slate-900/40`}>
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wide">{LABEL_CATEGORIA[cat]}</span>
                                    <span className="text-[10px] text-slate-500">{catSlugs.length} módulos</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => setGroupState(u.id, catSlugs, 'editable')}
                                      className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition font-medium flex items-center gap-1"
                                      title="Todos editables"
                                    >
                                      <Edit3 size={9} /> Todo edit
                                    </button>
                                    <button
                                      onClick={() => setGroupState(u.id, catSlugs, 'readonly')}
                                      className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition font-medium flex items-center gap-1"
                                      title="Todos en solo lectura"
                                    >
                                      <Eye size={9} /> Todo ver
                                    </button>
                                    <button
                                      onClick={() => setGroupState(u.id, catSlugs, 'hidden')}
                                      disabled={allHidden}
                                      className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition font-medium flex items-center gap-1"
                                      title="Ocultar todos"
                                    >
                                      <XCircle size={9} /> Ocultar
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                  {catMods.map(mod => {
                                    const state = getModuleState(u.id, mod.slug)
                                    return (
                                      <button
                                        key={mod.slug}
                                        onClick={() => cycleModuleState(u.id, mod.slug)}
                                        title="Clic para ciclar: Editable → Solo lectura → Oculto"
                                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition text-left ${
                                          state === 'editable'
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                            : state === 'readonly'
                                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-500'
                                        }`}
                                      >
                                        {state === 'editable' && <Edit3 size={11} className="shrink-0 text-emerald-400" />}
                                        {state === 'readonly' && <Eye size={11} className="shrink-0 text-yellow-400" />}
                                        {state === 'hidden' && <XCircle size={11} className="shrink-0 text-slate-600" />}
                                        <span className="truncate">{mod.nombre}</span>
                                        {state === 'readonly' && <Lock size={9} className="shrink-0 text-yellow-600 ml-auto" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

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
                      {saveStep[u.id] === 'sending' ? 'Enviando...' : saveStep[u.id] === 'verifying' ? 'Verificando...' : 'Guardar cambios'}
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

function PCLicenses({ companyId, locals }: { companyId: number, locals: LocalAPI[] }) {
  const [licenses, setLicenses] = useState<PCLicenseAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLocalId, setNewLocalId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedLocal, setExpandedLocal] = useState<number | 'sin_local' | null>(null)

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
      const lic = await createPCLicense(companyId, newDesc.trim(), newLocalId)
      setLicenses(prev => [lic, ...prev])
      setNewDesc('')
      setNewLocalId(null)
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

  // Group licenses by local
  const licensesByLocal = useMemo(() => {
    const grouped: Record<string, { label: string; localId: number | null; lics: PCLicenseAPI[] }> = {}
    for (const lic of licenses) {
      const key = lic.local_id != null ? String(lic.local_id) : 'sin_local'
      if (!grouped[key]) {
        grouped[key] = {
          label: lic.local_name ?? (lic.local_id ? `Local #${lic.local_id}` : 'Sin local asignado'),
          localId: lic.local_id ?? null,
          lics: [],
        }
      }
      grouped[key].lics.push(lic)
    }
    // Add locals with no licenses too
    for (const loc of locals) {
      const key = String(loc.id)
      if (!grouped[key]) {
        grouped[key] = { label: loc.name, localId: loc.id, lics: [] }
      }
    }
    return Object.values(grouped).sort((a, b) => {
      if (a.localId === null) return 1
      if (b.localId === null) return -1
      return a.label.localeCompare(b.label)
    })
  }, [licenses, locals])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-violet-400" />
          <span className="text-sm font-semibold text-white">Licencias por PC</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{licenses.length}</span>
          <span className="text-xs text-slate-600">· {locals.length} locales</span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={13} /> Nueva licencia
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30 space-y-3">
          <div className="flex gap-3">
            <input
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              placeholder="Descripción (ej: PC Caja)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <select
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              value={newLocalId ?? ''}
              onChange={e => setNewLocalId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Sin local —</option>
              {locals.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newDesc.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {creating ? 'Creando...' : 'Crear licencia'}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewDesc(''); setNewLocalId(null) }}
              className="px-3 py-2 text-slate-400 hover:text-white text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 text-sm text-red-400 bg-red-900/10">{error}</div>
      )}

      {loading ? (
        <div className="px-5 py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : licensesByLocal.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-500 text-sm">
          No hay licencias creadas para esta empresa
        </div>
      ) : (
        <div className="divide-y divide-slate-800/30">
          {licensesByLocal.map(group => {
            const key = group.localId != null ? group.localId : 'sin_local'
            const isExpanded = expandedLocal === key || expandedLocal === null
            return (
              <div key={String(key)}>
                {/* Local header */}
                <button
                  onClick={() => setExpandedLocal(isExpanded && expandedLocal !== null ? null : key)}
                  className="w-full px-5 py-2.5 flex items-center gap-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <MapPin size={13} className="text-violet-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full ml-1">{group.lics.length}</span>
                  <div className="ml-auto">
                    {isExpanded ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-800/30">
                    {group.lics.length === 0 && (
                      <div className="px-5 py-3 text-xs text-slate-600 italic">Sin licencias en este local</div>
                    )}
                    {group.lics.map(lic => (
                      <div key={lic.id} className="px-5 py-3 flex items-start gap-4">
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
          })}
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
  const [locals, setLocals]       = useState<LocalAPI[]>([])
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [tooltip, setTooltip]     = useState<string | null>(null)
  const [changed, setChanged]     = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [data, locData] = await Promise.all([
        getEmpresa(Number(id)),
        getLocals(Number(id)),
      ])
      setEmpresa(data)
      setLocals(locData)
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

  const categorias: Categoria[] = ['core', 'operaciones', 'integraciones', 'reportes', 'crm', 'rfid']

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
      <PCLicenses companyId={empresa.id} locals={locals} />

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

        {categorias.map(cat => {
          const catMods = MODULOS_POR_CATEGORIA[cat].filter(m => !m.esCore)
          const allOn = catMods.length > 0 && catMods.every(m => modulos.includes(m.slug))
          const allOff = catMods.length === 0 || catMods.every(m => !modulos.includes(m.slug))

          function activateAll() {
            const toAdd = catMods.filter(m => !modulos.includes(m.slug))
            let next = [...modulos]
            for (const mod of toAdd) {
              const missing = getMissingDeps(mod.slug, next)
              if (missing.length === 0) next = [...next, mod.slug]
            }
            setModulos(next)
            if (empresa) {
              saveModules(empresa.id, next)
                .then(() => { setGuardado(true); setTimeout(() => setGuardado(false), 2000) })
                .catch((e: unknown) => { setTooltip(e instanceof Error ? e.message : 'Error'); setTimeout(() => setTooltip(null), 4000) })
            }
          }

          function deactivateAll() {
            const next = modulos.filter(s => !catMods.find(m => m.slug === s))
            setModulos(next)
            if (empresa) {
              saveModules(empresa.id, next)
                .then(() => { setGuardado(true); setTimeout(() => setGuardado(false), 2000) })
                .catch((e: unknown) => { setTooltip(e instanceof Error ? e.message : 'Error'); setTimeout(() => setTooltip(null), 4000) })
            }
          }

          return (
          <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className={`px-5 py-3 border-b border-slate-800 flex items-center gap-2`}>
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>
                {LABEL_CATEGORIA[cat]}
              </span>
              <span className="text-xs text-slate-500">
                {MODULOS_POR_CATEGORIA[cat].filter(m => modulosActivos.has(m.slug)).length} / {MODULOS_POR_CATEGORIA[cat].length} activos
              </span>
              {catMods.length > 0 && (
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={activateAll}
                    disabled={allOn}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-30 transition"
                  >
                    <CheckCircle2 size={10} /> Activar todos
                  </button>
                  <button
                    onClick={deactivateAll}
                    disabled={allOff}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-30 transition"
                  >
                    <XCircle size={10} /> Desactivar todos
                  </button>
                </div>
              )}
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
          )
        })}
      </div>
    </div>
  )
}
