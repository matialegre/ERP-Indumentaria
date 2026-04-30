import { Eye } from 'lucide-react'

/**
 * Banner shown at the top of a page when the user has read-only access to a module.
 * Usage: <ReadOnlyBanner />  (inside a page that checks useModulePermission)
 */
export default function ReadOnlyBanner({ message }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
      <Eye size={15} className="shrink-0" />
      <span>{message ?? 'Tenés acceso de solo lectura a este módulo. Contactá al administrador para hacer cambios.'}</span>
    </div>
  )
}
