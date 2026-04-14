import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, ArrowRight, ShoppingCart, FileText, Users,
  Package, BarChart3, Settings, Activity, Warehouse,
  Store, CreditCard, CheckCircle, Truck, GitCompare,
  Kanban, LayoutDashboard, Receipt,
} from "lucide-react";

const NAV_SHORTCUTS = [
  { label: "Dashboard",       path: "/",                  icon: LayoutDashboard, keywords: "inicio home dashboard" },
  { label: "Resumen",             path: "/resumen",           icon: Activity,        keywords: "resumen monitoring alertas" },
  { label: "Notas de Pedido",     path: "/pedidos-compras",   icon: ShoppingCart,    keywords: "pedidos compras notas orden" },
  { label: "Facturas / Remitos",  path: "/facturas-proveedor",icon: Receipt,         keywords: "facturas proveedor remitos rv" },
  { label: "Gestión de Pagos",    path: "/gestion-pagos",     icon: CreditCard,      keywords: "pagos vouchers comprobantes cobranzas" },
  { label: "Ingreso Mercadería",  path: "/ingreso",           icon: Package,         keywords: "ingreso mercaderia deposito entrada" },
  { label: "Recepción",           path: "/recepcion",         icon: CheckCircle,     keywords: "recepcion ingreso deposito" },
  { label: "Transporte",          path: "/transporte",        icon: Truck,           keywords: "transporte envio flete" },
  { label: "Completados",         path: "/completados",       icon: CheckCircle,     keywords: "completados finalizados historial" },
  { label: "Stock",               path: "/stock",             icon: Warehouse,       keywords: "stock inventario ajustes saldo" },
  { label: "Facturación",         path: "/facturacion",       icon: FileText,        keywords: "facturacion ventas comprobantes" },
  { label: "Consultas ERP",       path: "/consultas",         icon: Search,          keywords: "consultas precios barcode articulos" },
  { label: "Comparador Precios",  path: "/comparador",        icon: GitCompare,      keywords: "comparador precios costos" },
  { label: "TrellOutdoor",        path: "/kanban",            icon: Kanban,          keywords: "kanban trello tareas tablero" },
  { label: "Productos",           path: "/productos",         icon: Package,         keywords: "productos catalogo variantes sku" },
  { label: "Proveedores",         path: "/proveedores",       icon: Truck,           keywords: "proveedores marcas contactos" },
  { label: "Locales",             path: "/locales",           icon: Store,           keywords: "locales tiendas sucursales" },
  { label: "Usuarios",            path: "/usuarios",          icon: Users,           keywords: "usuarios roles permisos" },
  { label: "Estadísticas",        path: "/reportes",          icon: BarChart3,       keywords: "reportes estadisticas graficos metricas" },
  { label: "Configuración",       path: "/config",            icon: Settings,        keywords: "config ajustes configuracion empresa" },
  { label: "Configurador Menú",   path: "/configurador-menu", icon: Settings,        keywords: "menu configurador sidebar" },
  { label: "Monitoreo",           path: "/monitoreo",         icon: Activity,        keywords: "monitoreo sistema health server" },
];

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const results = NAV_SHORTCUTS.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q);
  });

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      handleSelect(results[activeIdx].path);
    }
  };

  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar sección... (Esc para cerrar)"
            className="flex-1 text-base outline-none placeholder-gray-400 bg-transparent text-gray-800 dark:text-gray-100"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:block text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.path}
                onClick={() => handleSelect(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 transition text-left group ${
                  idx === activeIdx
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition ${
                    idx === activeIdx
                      ? "bg-blue-100 dark:bg-blue-800"
                      : "bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-800"
                  }`}
                >
                  <item.icon
                    size={15}
                    className={
                      idx === activeIdx
                        ? "text-blue-600 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-300 group-hover:text-blue-600"
                    }
                  />
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      idx === activeIdx
                        ? "text-blue-700 dark:text-blue-200"
                        : "text-gray-800 dark:text-gray-100 group-hover:text-blue-700"
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{item.path}</div>
                </div>
                <ArrowRight
                  size={14}
                  className={
                    idx === activeIdx
                      ? "text-blue-400"
                      : "text-gray-300 group-hover:text-blue-400 transition"
                  }
                />
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-4 text-xs text-gray-400">
          <span>
            <kbd className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">Enter</kbd> seleccionar
          </span>
          <span>
            <kbd className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">Ctrl+K</kbd> abrir
          </span>
        </div>
      </div>
    </div>
  );
}
