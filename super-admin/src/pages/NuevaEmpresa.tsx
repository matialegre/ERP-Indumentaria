import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Package, CreditCard, UserPlus,
  ChevronRight, ChevronLeft, Check,
  Info, DollarSign,
} from 'lucide-react'
import {
  MODULOS, MODULOS_VISIBLES, LABEL_CATEGORIA, LABEL_RUBRO,
  calcularPrecio, modulosParaRubro, type Categoria,
} from '../lib/modules'

// ── Tipos ──────────────────────────────────────────────────────────────────────

const RUBROS = [
  { value: 'indumentaria', label: 'Indumentaria / Outdoor' },
  { value: 'mecanico',     label: 'Taller / Mecánico' },
  { value: 'kiosco',       label: 'Kiosco / Almacén' },
  { value: 'deposito',     label: 'Depósito / Distribución' },
  { value: 'restaurante',  label: 'Restaurante / Bar' },
  { value: 'ferreteria',   label: 'Ferretería' },
  { value: 'farmacia',     label: 'Farmacia' },
  { value: 'libreria',     label: 'Librería' },
  { value: 'otro',         label: 'Otro' },
]

const PLANES = [
  {
    slug: 'free', nombre: 'Free', precioBase: 0,
    desc: 'Para probar el sistema. Sin soporte.',
    limites: '2 usuarios · 1 local · 500 productos',
    color: 'border-slate-600',
  },
  {
    slug: 'starter', nombre: 'Starter', precioBase: 29,
    desc: 'Para negocios pequeños con 1 local.',
    limites: '5 usuarios · 2 locales · 2.000 productos',
    color: 'border-sky-500',
  },
  {
    slug: 'pro', nombre: 'Pro', precioBase: 79,
    desc: 'Para negocios medianos con varias sucursales.',
    limites: '15 usuarios · 5 locales · 10.000 productos',
    color: 'border-indigo-500',
    badge: 'Más popular',
  },
  {
    slug: 'enterprise', nombre: 'Enterprise', precioBase: 149,
    desc: 'Sin límites. Módulos de integración incluidos.',
    limites: 'Usuarios · locales · productos ilimitados',
    color: 'border-violet-500',
  },
]

interface FormData {
  // Paso 1
  nombre: string
  rubro: string
  cuit: string
  ciudad: string
  telefono: string
  email: string
  // Paso 2
  modulosSeleccionados: string[]
  // Paso 3
  plan: string
  // Paso 4
  adminNombre: string
  adminEmail: string
  adminPassword: string
}

const INITIAL: FormData = {
  nombre: '', rubro: 'indumentaria', cuit: '', ciudad: '', telefono: '', email: '',
  modulosSeleccionados: ['catalogo', 'stock', 'ventas'],
  plan: 'starter',
  adminNombre: '', adminEmail: '', adminPassword: '',
}

// ── Step indicators ───────────────────────────────────────────────────────────

const PASOS = [
  { n: 1, label: 'Datos básicos',  icon: Building2   },
  { n: 2, label: 'Módulos',        icon: Package     },
  { n: 3, label: 'Plan',           icon: CreditCard  },
  { n: 4, label: 'Administrador',  icon: UserPlus    },
]

function StepBar({ paso }: { paso: number }) {
  return (
    <div className="flex items-center gap-0">
      {PASOS.map((p, i) => (
        <div key={p.n} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            paso === p.n
              ? 'bg-indigo-600 text-white font-medium'
              : paso > p.n
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'text-slate-500'
          }`}>
            {paso > p.n ? (
              <Check size={15} className="text-indigo-400" />
            ) : (
              <p.icon size={15} />
            )}
            <span className="hidden sm:inline">{p.label}</span>
            <span className="sm:hidden">{p.n}</span>
          </div>
          {i < PASOS.length - 1 && (
            <ChevronRight size={14} className="text-slate-700 mx-1" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Paso 1 — Datos básicos ────────────────────────────────────────────────────

function Paso1({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Nombre de la empresa *</label>
          <input
            value={data.nombre}
            onChange={e => onChange('nombre', e.target.value)}
            placeholder="ej: Mundo Outdoor SRL"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Rubro *</label>
          <select
            value={data.rubro}
            onChange={e => onChange('rubro', e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {RUBROS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">CUIT</label>
          <input
            value={data.cuit}
            onChange={e => onChange('cuit', e.target.value)}
            placeholder="20-12345678-9"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Ciudad</label>
          <input
            value={data.ciudad}
            onChange={e => onChange('ciudad', e.target.value)}
            placeholder="ej: Buenos Aires"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Teléfono</label>
          <input
            value={data.telefono}
            onChange={e => onChange('telefono', e.target.value)}
            placeholder="+54 11 1234-5678"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Email de contacto *</label>
          <input
            type="email"
            value={data.email}
            onChange={e => onChange('email', e.target.value)}
            placeholder="contacto@empresa.com"
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      {data.rubro && (
        <div className="flex items-start gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
          <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-xs text-indigo-300">
            Rubro <strong>{LABEL_RUBRO[data.rubro] ?? data.rubro}</strong>: en el siguiente paso verás
            los módulos recomendados para este tipo de negocio preseleccionados.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Paso 2 — Módulos ─────────────────────────────────────────────────────────

function Paso2({
  data, onChange
}: {
  data: FormData
  onChange: (k: keyof FormData, v: string[]) => void
}) {
  const [filtro, setFiltro] = useState<Categoria | 'todos'>('todos')

  const disponibles = modulosParaRubro(data.rubro)
  const mostrar = filtro === 'todos' ? disponibles : disponibles.filter(m => m.categoria === filtro)
  const seleccionados = data.modulosSeleccionados

  function toggle(slug: string) {
    if (seleccionados.includes(slug)) {
      onChange('modulosSeleccionados', seleccionados.filter(s => s !== slug))
    } else {
      onChange('modulosSeleccionados', [...seleccionados, slug])
    }
  }

  function selectAll() {
    onChange('modulosSeleccionados', disponibles.map(m => m.slug))
  }

  function clearAll() {
    onChange('modulosSeleccionados', [])
  }

  const precioTotal = calcularPrecio(seleccionados)
  const categorias: (Categoria | 'todos')[] = ['todos', 'operaciones', 'integraciones', 'reportes']

  return (
    <div className="space-y-4">
      {/* Header módulos */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300">
            {seleccionados.length} módulos seleccionados
            {data.rubro !== 'todas' && (
              <span className="text-slate-500"> · rubro {LABEL_RUBRO[data.rubro] ?? data.rubro}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-emerald-400 font-semibold">
            <DollarSign size={14} className="inline -mt-0.5" />{precioTotal}/mes
          </span>
          <button onClick={selectAll} className="text-xs text-indigo-400 hover:text-indigo-300">Todos</button>
          <span className="text-slate-700">|</span>
          <button onClick={clearAll} className="text-xs text-slate-400 hover:text-slate-300">Ninguno</button>
        </div>
      </div>

      {/* Aviso módulos core */}
      <div className="flex items-start gap-2 bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
        <Info size={13} className="mt-0.5 shrink-0 text-slate-500" />
        <span>
          Los módulos <strong className="text-slate-300">Auth, Multi-empresa y Notificaciones</strong> siempre
          están incluidos sin costo adicional.
        </span>
      </div>

      {/* Filtro por categoría */}
      <div className="flex gap-2 flex-wrap">
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {cat === 'todos' ? 'Todos' : LABEL_CATEGORIA[cat]}
          </button>
        ))}
      </div>

      {/* Grid de módulos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
        {mostrar.map(modulo => {
          const activo = seleccionados.includes(modulo.slug)
          const depsFaltantes = modulo.dependencias.filter(d => !seleccionados.includes(d))
          const bloqueado = depsFaltantes.length > 0

          return (
            <button
              key={modulo.slug}
              onClick={() => !bloqueado && toggle(modulo.slug)}
              disabled={bloqueado}
              className={`relative text-left p-3.5 rounded-xl border transition-all ${
                activo
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-sm shadow-indigo-500/20'
                  : bloqueado
                  ? 'border-slate-700 bg-slate-800/30 opacity-50 cursor-not-allowed'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
              }`}
            >
              {/* Check */}
              {activo && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                  <Check size={11} className="text-white" />
                </span>
              )}

              {/* Icono + nombre */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${modulo.color}22`, color: modulo.color }}
                >
                  <Package size={14} />
                </div>
                <span className="text-xs font-semibold text-white leading-tight pr-5">
                  {modulo.nombre}
                </span>
              </div>

              {/* Descripción */}
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-2">
                {modulo.descripcion}
              </p>

              {/* Footer: precio + rubro */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400">
                  {modulo.precioUsd === 0 ? 'Gratis' : `$${modulo.precioUsd}/mes`}
                </span>
                {modulo.rubros[0] !== 'todas' && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                    {modulo.rubros.map(r => LABEL_RUBRO[r] ?? r).join(', ')}
                  </span>
                )}
              </div>

              {/* Dependencias faltantes */}
              {bloqueado && (
                <p className="text-xs text-amber-400 mt-1.5">
                  Requiere: {depsFaltantes.join(', ')}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* Resumen precio */}
      <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Total módulos adicionales</p>
          <p className="text-sm text-slate-300 mt-0.5">
            {seleccionados.length} módulos · {disponibles.length - seleccionados.length} disponibles sin activar
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Costo mensual estimado</p>
          <p className="text-2xl font-bold text-emerald-400">${precioTotal}<span className="text-sm font-normal text-slate-400">/mes</span></p>
        </div>
      </div>
    </div>
  )
}

// ── Paso 3 — Plan ─────────────────────────────────────────────────────────────

function Paso3({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  const precioModulos = calcularPrecio(data.modulosSeleccionados)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">El plan define los límites de la empresa. Los módulos extra se cobran encima del precio base.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {PLANES.map(plan => {
          const activo = data.plan === plan.slug
          return (
            <button
              key={plan.slug}
              onClick={() => onChange('plan', plan.slug)}
              className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                activo ? `${plan.color} bg-slate-800` : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
              }`}
            >
              {plan.badge && (
                <span className="absolute top-3 right-3 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                  {plan.badge}
                </span>
              )}
              {activo && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                  <Check size={11} className="text-white" />
                </span>
              )}
              <p className="text-lg font-bold text-white">{plan.nombre}</p>
              <p className="text-2xl font-bold text-white mt-1">
                ${plan.precioBase}
                <span className="text-sm font-normal text-slate-400">/mes</span>
              </p>
              <p className="text-xs text-slate-400 mt-2 mb-3">{plan.desc}</p>
              <p className="text-xs text-slate-500">{plan.limites}</p>
            </button>
          )
        })}
      </div>

      {/* Resumen */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Plan {PLANES.find(p => p.slug === data.plan)?.nombre}</span>
          <span className="text-white font-medium">${PLANES.find(p => p.slug === data.plan)?.precioBase}/mes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Módulos adicionales ({data.modulosSeleccionados.length})</span>
          <span className="text-white font-medium">${precioModulos}/mes</span>
        </div>
        <div className="border-t border-slate-700 pt-2 flex justify-between">
          <span className="text-sm font-semibold text-white">Total estimado</span>
          <span className="text-lg font-bold text-emerald-400">
            ${(PLANES.find(p => p.slug === data.plan)?.precioBase ?? 0) + precioModulos}/mes
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Paso 4 — Admin ────────────────────────────────────────────────────────────

function Paso4({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-slate-400">
        Se creará un usuario ADMIN para acceder al ERP de esta empresa.
      </p>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Nombre completo *</label>
        <input
          value={data.adminNombre}
          onChange={e => onChange('adminNombre', e.target.value)}
          placeholder="Juan Pérez"
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
        <input
          type="email"
          value={data.adminEmail}
          onChange={e => onChange('adminEmail', e.target.value)}
          placeholder="admin@empresa.com"
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Contraseña inicial *</label>
        <input
          type="password"
          value={data.adminPassword}
          onChange={e => onChange('adminPassword', e.target.value)}
          placeholder="mínimo 8 caracteres"
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-slate-500 mt-1">El usuario deberá cambiarla en el primer inicio de sesión.</p>
      </div>

      {/* Resumen final */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-1.5 mt-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Resumen de creación</p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Empresa</span>
          <span className="text-white font-medium">{data.nombre || '—'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Rubro</span>
          <span className="text-white">{LABEL_RUBRO[data.rubro] ?? data.rubro}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Plan</span>
          <span className="text-white">{data.plan}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Módulos</span>
          <span className="text-white">{data.modulosSeleccionados.length} seleccionados</span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-700 pt-1.5">
          <span className="text-slate-400">MRR estimado</span>
          <span className="text-emerald-400 font-semibold">
            ${calcularPrecio(data.modulosSeleccionados)}/mes
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────

export default function NuevaEmpresa() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)
  const [creando, setCreando] = useState(false)
  const [exito, setExito] = useState(false)

  function updateField(key: keyof FormData, value: string | string[]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function validarPaso(): boolean {
    if (paso === 1) return !!data.nombre && !!data.email
    if (paso === 4) return !!data.adminNombre && !!data.adminEmail && data.adminPassword.length >= 8
    return true
  }

  async function crear() {
    setCreando(true)
    // Simula llamada a POST /api/v1/mega/companies/create-full
    await new Promise(r => setTimeout(r, 1500))
    setCreando(false)
    setExito(true)
  }

  if (exito) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">¡Empresa creada!</h2>
        <p className="text-slate-400 max-w-sm">
          <strong className="text-white">{data.nombre}</strong> fue creada con{' '}
          {data.modulosSeleccionados.length} módulos activados. El admin recibirá sus credenciales por email.
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => navigate('/empresas')}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Ver todas las empresas
          </button>
          <button
            onClick={() => { setExito(false); setData(INITIAL); setPaso(1) }}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Crear otra
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Nueva Empresa</h1>
        <p className="text-slate-400 text-sm mt-1">Wizard de 4 pasos · Alta y configuración completa</p>
      </div>

      {/* Steps */}
      <div className="mb-8">
        <StepBar paso={paso} />
      </div>

      {/* Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-5">
          {PASOS[paso - 1].label}
        </h2>

        {paso === 1 && <Paso1 data={data} onChange={(k, v) => updateField(k, v as string)} />}
        {paso === 2 && <Paso2 data={data} onChange={(k, v) => updateField(k, v as string[])} />}
        {paso === 3 && <Paso3 data={data} onChange={(k, v) => updateField(k, v as string)} />}
        {paso === 4 && <Paso4 data={data} onChange={(k, v) => updateField(k, v as string)} />}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-800">
          <button
            onClick={() => paso > 1 ? setPaso(p => p - 1) : navigate('/empresas')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          {paso < 4 ? (
            <button
              onClick={() => setPaso(p => p + 1)}
              disabled={!validarPaso()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={crear}
              disabled={!validarPaso() || creando}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {creando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando…
                </>
              ) : (
                <>
                  <Check size={16} />
                  Crear empresa
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info lateral condensada */}
      <div className="mt-4 text-xs text-slate-500 flex items-center gap-2">
        <Info size={12} />
        <span>
          Los módulos mostrados en el Paso 2 son los {MODULOS_VISIBLES.length} módulos reales del sistema ({MODULOS.filter(m => m.esCore).length} core siempre incluidos).
          El precio mostrado es el costo mensual adicional al plan base.
        </span>
      </div>
    </div>
  )
}
