import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Sin datos', description = '', action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon className="w-12 h-12 text-gray-300" />
      <h3 className="text-lg font-medium text-gray-600">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          {actionLabel || 'Crear'}
        </button>
      )}
    </div>
  );
}
