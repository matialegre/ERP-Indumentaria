import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_NAMES = {
  "/":                  "Dashboard",
  "/dashboard":         "Dashboard",
  "/resumen":           "Resumen",
  "/pedidos-compras":   "Notas de Pedido",
  "/facturas-proveedor":"Facturas / Remitos",
  "/gestion-pagos":     "Gestión de Pagos",
  "/ingreso":           "Ingreso Mercadería",
  "/recepcion":         "Recepción",
  "/transporte":        "Transporte",
  "/completados":       "Completados",
  "/stock":             "Stock",
  "/facturacion":       "Facturación",
  "/consultas":         "Consultas ERP",
  "/comparador":        "Comparador Precios",
  "/kanban":            "TrellOutdoor",
  "/productos":         "Productos",
  "/proveedores":       "Proveedores",
  "/locales":           "Locales",
  "/usuarios":          "Usuarios",
  "/reportes":          "Estadísticas",
  "/config":            "Configuración",
  "/configurador-menu": "Configurador Menú",
  "/monitoreo":         "Monitoreo",
};

export default function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  if (path === "/" || path === "/dashboard") return null;

  const name = ROUTE_NAMES[path] || path.replace("/", "").replace(/-/g, " ");

  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mb-3">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition"
      >
        <Home size={11} />
        <span>Inicio</span>
      </Link>
      <ChevronRight size={11} />
      <span className="text-gray-600 dark:text-gray-300 font-medium capitalize">{name}</span>
    </nav>
  );
}
