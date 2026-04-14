/**
 * StatCard — Tarjeta KPI para dashboards
 * Portada de eurotaller-cassano/src/pages/DashboardPage.tsx (líneas 233–261)
 */
import { Link } from "react-router-dom";

const COLOR_CLASSES = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-500",   ring: "ring-blue-100" },
  green:  { bg: "bg-green-50",  icon: "text-green-500",  ring: "ring-green-100" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500", ring: "ring-purple-100" },
  red:    { bg: "bg-red-50",    icon: "text-red-500",    ring: "ring-red-100" },
  orange: { bg: "bg-orange-50", icon: "text-orange-500", ring: "ring-orange-100" },
  yellow: { bg: "bg-yellow-50", icon: "text-yellow-500", ring: "ring-yellow-100" },
  gray:   { bg: "bg-gray-50",   icon: "text-gray-400",   ring: "ring-gray-100" },
};

/**
 * @param {object} props
 * @param {string} props.label — etiqueta del KPI
 * @param {string|number} props.value — valor a mostrar
 * @param {React.ElementType} props.icon — componente de icono (lucide-react)
 * @param {'blue'|'green'|'purple'|'red'|'orange'|'yellow'|'gray'} props.color
 * @param {string} [props.link] — ruta de react-router al hacer click
 * @param {boolean} [props.isText] — si true, muestra value como texto (no número grande)
 */
export default function StatCard({ label, value, icon: Icon, color = "blue", link, isText = false }) {
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.blue;

  const inner = (
    <div className={`${cls.bg} rounded-xl p-4 ring-1 ${cls.ring} flex items-center gap-4 hover:shadow-sm transition-shadow`}>
      <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-xs ring-1 ${cls.ring}`}>
        <Icon className={`w-5 h-5 ${cls.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`font-bold truncate ${isText ? "text-base" : "text-2xl"} text-gray-900`}>
          {value ?? "—"}
        </p>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link} className="block">{inner}</Link>;
  }
  return inner;
}
