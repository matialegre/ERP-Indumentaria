// Nueva OT — formulario completo migrado a FastAPI
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'

const schema = z.object({
  plate: z.string().min(1, 'La patente es obligatoria').toUpperCase(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2099).optional(),
  color: z.string().optional(),
  km_in: z.coerce.number().int().min(0).optional(),
  customer_name: z.string().min(2, 'El nombre del cliente es obligatorio'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  assigned_mechanic_id: z.coerce.number().optional(),
  reception_notes: z.string().min(5, 'Describí el problema'),
  items_mo: z.array(z.object({
    description: z.string().min(2, 'Descripción requerida'),
    hours: z.coerce.number().positive('Horas requeridas'),
    hourly_rate: z.coerce.number().min(0),
  })),
  items_rep: z.array(z.object({
    description: z.string().min(2, 'Descripción requerida'),
    quantity: z.coerce.number().positive('Cantidad requerida'),
    unit_price: z.coerce.number().min(0),
  })),
})

type FormData = z.infer<typeof schema>

export default function OTNewPage() {
  const navigate = useNavigate()
  const [mechanics, setMechanics] = useState<any[]>([])

  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
    control,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items_mo: [], items_rep: [] },
  })

  const { fields: fieldsMO, append: appendMO, remove: removeMO } = useFieldArray({ control, name: 'items_mo' })
  const { fields: fieldsRep, append: appendRep, remove: removeRep } = useFieldArray({ control, name: 'items_rep' })

  useEffect(() => {
    api.get<{ items: any[] }>('/users/').then(r => setMechanics(r?.items ?? [])).catch(() => {})
  }, [])

  const itemsMO = watch('items_mo')
  const itemsRep = watch('items_rep')
  const subtotalMO = (itemsMO ?? []).reduce((s, i) => s + (i.hours || 0) * (i.hourly_rate || 0), 0)
  const subtotalRep = (itemsRep ?? []).reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0)
  const total = subtotalMO + subtotalRep

  const onSubmit = async (data: FormData) => {
    const items = [
      ...(data.items_mo ?? []).map(i => ({
        type: 'MANO_DE_OBRA',
        description: i.description,
        hours: i.hours,
        hourly_rate: i.hourly_rate,
        quantity: 1,
        unit_price: 0,
      })),
      ...(data.items_rep ?? []).map(i => ({
        type: 'REPUESTO',
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        hours: 0,
        hourly_rate: 0,
      })),
    ]

    const payload: Record<string, any> = {
      plate: data.plate,
      brand: data.brand || null,
      model: data.model || null,
      year: data.year || null,
      color: data.color || null,
      km_in: data.km_in || null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone || null,
      customer_email: data.customer_email || null,
      assigned_mechanic_id: data.assigned_mechanic_id || null,
      reception_notes: data.reception_notes,
      items,
    }

    const res = await api.post<any>('/work-orders', payload).catch(e => { alert(e.message); return null })
    if (res?.id) navigate(`/ot/${res.id}`)
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none'
  const errCls = 'text-red-500 text-xs mt-1'

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/ot')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Nueva Orden de Trabajo</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Vehículo */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Vehículo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patente *</label>
              <input {...register('plate')} placeholder="ABC 123" className={inputCls} />
              {errors.plate && <p className={errCls}>{errors.plate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input {...register('brand')} placeholder="Toyota" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input {...register('model')} placeholder="Corolla" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input type="number" {...register('year')} placeholder="2020" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input {...register('color')} placeholder="Blanco" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KM entrada</label>
              <input type="number" {...register('km_in')} placeholder="0" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input {...register('customer_name')} placeholder="Nombre y apellido" className={inputCls} />
              {errors.customer_name && <p className={errCls}>{errors.customer_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input {...register('customer_phone')} placeholder="+54 9 11 1234 5678" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" {...register('customer_email')} placeholder="correo@ejemplo.com" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Ingreso */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Datos del trabajo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mecánico asignado</label>
              <select {...register('assigned_mechanic_id')} className={inputCls}>
                <option value="">Sin asignar</option>
                {mechanics.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.username}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del problema *</label>
            <textarea {...register('reception_notes')} rows={3}
              className={inputCls} placeholder="¿Qué falla? ¿Qué trae el vehículo?" />
            {errors.reception_notes && <p className={errCls}>{errors.reception_notes.message}</p>}
          </div>
        </div>

        {/* Mano de obra */}
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Mano de obra</h2>
            <button type="button"
              onClick={() => appendMO({ description: '', hours: 1, hourly_rate: 0 })}
              className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {fieldsMO.map((f, i) => (
            <div key={f.id} className="flex items-start gap-3">
              <div className="flex-1">
                <input {...register(`items_mo.${i}.description`)} placeholder="Descripción del trabajo" className={inputCls} />
                {errors.items_mo?.[i]?.description && <p className={errCls}>{errors.items_mo[i]?.description?.message}</p>}
              </div>
              <div className="w-24">
                <input type="number" step="0.5" {...register(`items_mo.${i}.hours`)} placeholder="Hs" className={inputCls} />
              </div>
              <div className="w-36">
                <input type="number" {...register(`items_mo.${i}.hourly_rate`)} placeholder="$/hora" className={inputCls} />
              </div>
              <button type="button" onClick={() => removeMO(i)} className="text-gray-300 hover:text-red-500 pt-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {fieldsMO.length === 0 && <p className="text-sm text-gray-400 italic">Sin ítems</p>}
        </div>

        {/* Repuestos */}
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Repuestos</h2>
            <button type="button"
              onClick={() => appendRep({ description: '', quantity: 1, unit_price: 0 })}
              className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          {fieldsRep.map((f, i) => (
            <div key={f.id} className="flex items-start gap-3">
              <div className="flex-1">
                <input {...register(`items_rep.${i}.description`)} placeholder="Descripción del repuesto" className={inputCls} />
              </div>
              <div className="w-24">
                <input type="number" step="0.01" {...register(`items_rep.${i}.quantity`)} placeholder="Cant." className={inputCls} />
              </div>
              <div className="w-36">
                <input type="number" {...register(`items_rep.${i}.unit_price`)} placeholder="Precio unit." className={inputCls} />
              </div>
              <button type="button" onClick={() => removeRep(i)} className="text-gray-300 hover:text-red-500 pt-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {fieldsRep.length === 0 && <p className="text-sm text-gray-400 italic">Sin repuestos</p>}
        </div>

        {/* Totales y submit */}
        <div className="bg-white border rounded-xl p-5 flex items-center justify-between">
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex gap-8">
              <span>Mano de obra: <strong>${subtotalMO.toLocaleString('es-AR')}</strong></span>
              <span>Repuestos: <strong>${subtotalRep.toLocaleString('es-AR')}</strong></span>
            </div>
            <div className="text-base font-bold text-gray-900">
              Total estimado: ${total.toLocaleString('es-AR')}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/ot')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Crear OT'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
