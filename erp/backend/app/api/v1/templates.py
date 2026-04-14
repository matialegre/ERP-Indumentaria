"""
Templates de industria — configuraciones predefinidas por tipo de negocio
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/templates", tags=["templates"])


class ModulePreset(BaseModel):
    slug: str
    name: str
    description: str
    icon: str  # lucide icon name

class IndustryTemplate(BaseModel):
    industry_type: str
    label: str
    description: str
    icon: str
    suggested_color: str
    modules: list[str]
    sample_categories: list[str]
    features: list[str]

MODULES_CATALOG = [
    ModulePreset(slug="stock", name="Control de Stock", description="Inventario, movimientos y ajustes de stock", icon="Package"),
    ModulePreset(slug="ventas", name="Ventas", description="Punto de venta y cobros rápidos", icon="ShoppingCart"),
    ModulePreset(slug="compras", name="Compras", description="Órdenes de compra a proveedores", icon="ShoppingBag"),
    ModulePreset(slug="facturacion", name="Facturación", description="Emisión de comprobantes y facturas", icon="FileText"),
    ModulePreset(slug="ingresos", name="Ingresos", description="Recepción de mercadería y remitos", icon="PackageCheck"),
    ModulePreset(slug="pedidos", name="Pedidos", description="Notas de pedido a proveedores", icon="ClipboardList"),
    ModulePreset(slug="proveedores", name="Proveedores", description="Gestión de proveedores y contactos", icon="Truck"),
    ModulePreset(slug="clientes", name="Clientes", description="Base de datos de clientes", icon="UserCheck"),
    ModulePreset(slug="reportes", name="Reportes", description="Estadísticas y reportes del negocio", icon="BarChart3"),
    ModulePreset(slug="configuracion", name="Configuración", description="Ajustes generales del sistema", icon="Settings"),
    ModulePreset(slug="monitoreo", name="Monitoreo", description="Estado del servidor y métricas", icon="Activity"),
    ModulePreset(slug="gestion-pagos", name="Gestión de Pagos", description="Control de pagos, cuentas corrientes", icon="Wallet"),
    ModulePreset(slug="consultas", name="Consultas", description="Búsqueda de precios, stock y artículos", icon="Search"),
]

INDUSTRY_TEMPLATES = [
    IndustryTemplate(
        industry_type="INDUMENTARIA",
        label="Indumentaria / Moda",
        description="Tiendas de ropa, calzado y accesorios. Multi-local con talles y colores.",
        icon="Shirt",
        suggested_color="#7c3aed",
        modules=["stock", "ventas", "compras", "facturacion", "ingresos", "pedidos", "proveedores", "clientes", "reportes", "configuracion", "consultas"],
        sample_categories=["Remeras", "Pantalones", "Camperas", "Calzado", "Accesorios"],
        features=["Variantes talle/color", "Multi-local", "Temporadas", "Listas de precio"],
    ),
    IndustryTemplate(
        industry_type="KIOSCO",
        label="Kiosco / Almacén",
        description="Venta minorista de golosinas, bebidas y productos de consumo masivo.",
        icon="Store",
        suggested_color="#ea580c",
        modules=["stock", "ventas", "facturacion", "proveedores", "reportes"],
        sample_categories=["Golosinas", "Bebidas", "Cigarrillos", "Snacks", "Lácteos"],
        features=["Código de barras", "Venta rápida", "Control de vencimientos"],
    ),
    IndustryTemplate(
        industry_type="MECANICO",
        label="Taller Mecánico",
        description="Talleres de reparación de vehículos. Control de repuestos y órdenes de trabajo.",
        icon="Wrench",
        suggested_color="#0284c7",
        modules=["stock", "facturacion", "clientes", "ingresos", "reportes", "configuracion"],
        sample_categories=["Repuestos", "Aceites", "Filtros", "Neumáticos", "Herramientas"],
        features=["Órdenes de trabajo", "Historial por vehículo", "Presupuestos"],
    ),
    IndustryTemplate(
        industry_type="DEPOSITO",
        label="Depósito / Logística",
        description="Centros de distribución y depósitos de mercadería.",
        icon="Warehouse",
        suggested_color="#059669",
        modules=["stock", "ingresos", "pedidos", "proveedores", "reportes", "monitoreo"],
        sample_categories=["Mercadería general", "Productos secos", "Refrigerados"],
        features=["Multi-depósito", "Ubicaciones", "Trazabilidad", "Remitos"],
    ),
    IndustryTemplate(
        industry_type="RESTAURANTE",
        label="Restaurante / Gastronomía",
        description="Restaurantes, bares, cafeterías. Control de insumos y ventas.",
        icon="UtensilsCrossed",
        suggested_color="#dc2626",
        modules=["stock", "ventas", "facturacion", "proveedores", "reportes"],
        sample_categories=["Carnes", "Verduras", "Bebidas", "Lácteos", "Secos"],
        features=["Comandas", "Mesas", "Recetas con ingredientes", "Costos"],
    ),
    IndustryTemplate(
        industry_type="FERRETERIA",
        label="Ferretería",
        description="Venta de artículos de ferretería, herramientas y materiales.",
        icon="Hammer",
        suggested_color="#78716c",
        modules=["stock", "ventas", "compras", "facturacion", "proveedores", "clientes", "reportes", "consultas"],
        sample_categories=["Herramientas", "Tornillería", "Pinturas", "Electricidad", "Plomería"],
        features=["Unidades múltiples", "Venta por metro/kg", "Códigos mixtos"],
    ),
    IndustryTemplate(
        industry_type="FARMACIA",
        label="Farmacia",
        description="Farmacias y droguerías. Control de medicamentos y obras sociales.",
        icon="Pill",
        suggested_color="#16a34a",
        modules=["stock", "ventas", "facturacion", "proveedores", "clientes", "reportes", "configuracion", "consultas"],
        sample_categories=["Medicamentos", "Perfumería", "OTC", "Pañales", "Suplementos"],
        features=["Control de vencimientos", "Trazabilidad ANMAT", "Obras sociales"],
    ),
    IndustryTemplate(
        industry_type="LIBRERIA",
        label="Librería / Papelería",
        description="Librerías, papelerías y artículos de oficina.",
        icon="BookOpen",
        suggested_color="#8b5cf6",
        modules=["stock", "ventas", "facturacion", "proveedores", "reportes", "consultas"],
        sample_categories=["Útiles escolares", "Papelería", "Libros", "Artículos de oficina"],
        features=["Temporada escolar", "Listas de útiles", "Venta rápida"],
    ),
    IndustryTemplate(
        industry_type="OTRO",
        label="Otro / Personalizado",
        description="Configuración personalizada. Elegí los módulos que necesites.",
        icon="LayoutGrid",
        suggested_color="#1e40af",
        modules=["stock", "ventas", "facturacion", "reportes", "configuracion"],
        sample_categories=[],
        features=["Configuración libre", "Todos los módulos disponibles"],
    ),
]


@router.get("/modules", response_model=list[ModulePreset])
def list_modules():
    """Lista todos los módulos disponibles en la plataforma"""
    return MODULES_CATALOG


@router.get("/industries", response_model=list[IndustryTemplate])
def list_industries():
    """Lista todas las plantillas de industria con módulos sugeridos"""
    return INDUSTRY_TEMPLATES


@router.get("/industries/{industry_type}", response_model=IndustryTemplate | None)
def get_industry_template(industry_type: str):
    """Obtiene la plantilla de una industria específica"""
    for t in INDUSTRY_TEMPLATES:
        if t.industry_type == industry_type.upper():
            return t
    return None
