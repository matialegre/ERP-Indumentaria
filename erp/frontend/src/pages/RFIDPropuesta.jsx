import { useState, useMemo, useEffect } from "react";
import {
  ExternalLink, Calculator, Clock, TrendingUp, AlertTriangle, Package,
  ChevronDown, ChevronUp, Truck, Link, MapPin, Eye, User, ShieldAlert,
  CheckCircle2, DollarSign, BarChart2, RefreshCw, Search, Zap,
  BarChart, ShoppingBag, Layers, FileText, UserCheck, Repeat2, Tag,
  Flame, Building2, Wrench, CalendarRange, Globe, Users,
  Pencil, Trash2, Plus, Save, X, MessageSquare, Sparkles,
} from "lucide-react";

// Mapa de iconos para serializar / deserializar a localStorage
const ICON_MAP = {
  Eye, User, Package, Truck, Link, ShieldAlert, Search, BarChart, AlertTriangle,
  Zap, Repeat2, Layers, UserCheck, ShoppingBag, FileText, Tag, TrendingUp,
  RefreshCw, Flame, Building2, Wrench, CalendarRange, Globe, Users, MapPin,
  CheckCircle2, DollarSign, BarChart2, Clock, Calculator, ExternalLink,
};
const ICON_NAMES = Object.keys(ICON_MAP);
const iconToName = (Comp) => ICON_NAMES.find((k) => ICON_MAP[k] === Comp) || "Tag";

const PALETTE = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444",
  "#0ea5e9", "#14b8a6", "#f97316", "#eab308", "#8b5cf6", "#06b6d4",
  "#84cc16", "#f43f5e", "#64748b", "#d97706", "#22c55e", "#0284c7",
  "#dc2626", "#0891b2", "#7c3aed",
];

const fmtARS = (n) => {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
};

const fmtNum = (n) => {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
};

const BENEFITS_INITIAL = [
  {
    icon: Users,
    color: "#0891b2",
    title: "Gestión de personal mediante tarjeta de empleado",
    before: "El empleado marca presencia con papel o un sistema separado. No hay trazabilidad de a qué zona accedió, qué mercadería tocó o en qué horario estuvo en determinado sector.",
    after: "Cada empleado lleva una tarjeta RFID. El sistema registra acceso a sectores, qué operaciones realizó y en qué horario. Se integra con el control de asistencia, los movimientos de stock y las alertas de comportamiento.",
    kpi: "Personal identificado y trazado en cada operación",
  },
  {
    icon: Eye,
    color: "#6366f1",
    title: "Trazabilidad total por operario",
    before: "Desapareció un ingreso. Cientos de unidades. Nadie sabe quién lo tocó, a qué hora, si fue error o intencional.",
    after: "Cada movimiento queda registrado: usuario + timestamp + ubicación. \"Operario X, 14:32 hs, ingresó lote completo — OC #XXXX.\" Evidencia irrefutable, cero dudas.",
    kpi: "0 % de pérdidas sin explicación",
  },
  {
    icon: User,
    color: "#f59e0b",
    title: "Identificación de operario en cada acción",
    before: "¿Quién despachó ese bulto mal? ¿Quién firmó esa recepción sin contar? Imposible saberlo. Nadie se hace responsable.",
    after: "Tarjeta RFID por operario: cada picking, despacho, recepción o ajuste queda vinculado al empleado. Se detectan patrones: quién tiene más errores, quién es más rápido.",
    kpi: "Responsabilidad individual 100% trazada",
  },
  {
    icon: Package,
    color: "#10b981",
    title: "Generación automática de remito al pickear",
    before: "El operario pickea, anota en papel, después carga todo en el sistema. Doble trabajo. Errores de transcripción. Tiempo perdido.",
    after: "Al pasar cada artículo por el portal RFID durante el picking, el remito se genera solo en el ERP en tiempo real. Sin formularios, sin doble carga.",
    kpi: "−80 % tiempo de carga de remitos",
  },
  {
    icon: Truck,
    color: "#3b82f6",
    title: "Confirmación de llegada al destino",
    before: "El camión salió. ¿Llegó todo? ¿Cuándo? ¿Hubo diferencias? Nadie lo sabe hasta que el minorista llama — si llama.",
    after: "El portal RFID en destino confirma automáticamente: cuántas unidades llegaron, en qué horario, y detecta cualquier faltante al instante. Sin llamados, sin papeles.",
    kpi: "Diferencias detectadas en segundos",
  },
  {
    icon: Link,
    color: "#a855f7",
    title: "Recepción automática sin abrir cajas",
    before: "Llega mercadería. Hay que abrir cada caja, contar prenda por prenda, registrar en el sistema. Proceso de horas.",
    after: "Las cajas pasan por el portal RFID sin abrirse. El sistema lee cientos de artículos en segundos y los cruza automáticamente contra la orden de compra.",
    kpi: "Recepción hasta 12× más rápida",
  },
  {
    icon: ShieldAlert,
    color: "#ef4444",
    title: "Alertas de stock detenido (sin rotación)",
    before: "Hay mercadería parada hace meses en el depósito o en locales. Capital inmovilizado. Nadie lo nota hasta que se hace un inventario.",
    after: "Alerta automática: \"Artículo X — 90 días sin movimiento — 40 unidades — $X inmovilizados.\" Se puede liquidar, reubicar o transferir antes de que sea un problema.",
    kpi: "Capital liberado de stock muerto",
  },
  {
    icon: Search,
    color: "#0ea5e9",
    title: "Inventario sin cerrar el local",
    before: "Para hacer inventario hay que cerrar el local 2 a 3 horas, con 3 personas contando. Pérdida de ventas, desgaste del equipo.",
    after: "Un empleado camina el local con un lector portátil. En 20 minutos tiene el inventario completo, con el local abierto y atendiendo clientes.",
    kpi: "Inventario 10× más rápido, sin cerrar",
  },
  {
    icon: BarChart,
    color: "#14b8a6",
    title: "Exactitud de stock del 99 %",
    before: "El stock del sistema dice una cosa, el físico dice otra. Diferencias del 20–30% son habituales. Se vende algo que no hay, o no se vende algo que sobra.",
    after: "Cada movimiento físico actualiza el sistema en tiempo real. El stock lógico y el físico son idénticos. Cero sorpresas en ventas ni en pedidos.",
    kpi: "+99 % exactitud de inventario",
  },
  {
    icon: AlertTriangle,
    color: "#f97316",
    title: "Control de probadores — detección de hurto",
    before: "Una prenda entra al probador, no sale. ¿Se la llevaron? ¿Quedó tirada? Nadie sabe hasta que cuadra el inventario — semanas después.",
    after: "Lectores en la entrada y salida del probador. Si entra una prenda y no sale, alerta inmediata al supervisor. Qué tag, qué probador, qué horario. Evidencia en tiempo real.",
    kpi: "Hurto en probadores detectado al instante",
  },
  {
    icon: Zap,
    color: "#eab308",
    title: "Desactivación automática en caja",
    before: "El tag de seguridad debe desactivarse manualmente. Si el cajero se olvida, suena la alarma y el cliente queda detenido. Mala experiencia.",
    after: "Al procesar la venta, el tag se desactiva solo. Si una prenda sale sin haber sido vendida, la alarma suena y el sistema registra: qué artículo, qué hora, qué valor.",
    kpi: "Antihurto 100% automatizado",
  },
  {
    icon: Repeat2,
    color: "#8b5cf6",
    title: "Devoluciones verificadas y retrazadas",
    before: "Un cliente devuelve algo. ¿Es original? ¿De ese local? ¿En qué estado estaba? Imposible verificar sin historial.",
    after: "El tag RFID tiene el historial completo: de qué local salió, cuándo fue vendido, si es original. La devolución se verifica en segundos y el artículo vuelve al stock automáticamente.",
    kpi: "Devoluciones fraudulentas eliminadas",
  },
  {
    icon: Layers,
    color: "#06b6d4",
    title: "Transferencias entre locales sin errores",
    before: "Se manda mercadería de un local a otro. Hay que contar, anotar, enviar, confirmar. Errores frecuentes. Diferencias que nadie puede explicar.",
    after: "El local origen escanea el despacho. El local destino escanea la recepción. Si hay diferencia, el sistema la marca automáticamente con el tramo exacto donde ocurrió.",
    kpi: "Errores de transferencia eliminados",
  },
  {
    icon: UserCheck,
    color: "#84cc16",
    title: "Auditoría de comportamiento por empleado",
    before: "¿Algún vendedor habilita muchos probadores con diferencias? ¿Un cajero procesa muchas anulaciones fuera de horario? Nadie lo cruza.",
    after: "El sistema genera reportes de patrones: empleados con más alertas, horarios con más incidentes, cajeros con más anulaciones. Permite actuar antes de que el problema escale.",
    kpi: "Patrones sospechosos detectados automáticamente",
  },
  {
    icon: ShoppingBag,
    color: "#f43f5e",
    title: "Reposición automática en góndola",
    before: "Un producto se agota en el perchero. El vendedor no lo nota hasta que un cliente pregunta. Venta perdida.",
    after: "Cuando el stock de un artículo en el piso de ventas baja del mínimo, el sistema genera una alerta de reposición automática al depósito del local. Sin intervención humana.",
    kpi: "Quiebre de stock en góndola reducido a cero",
  },
  {
    icon: FileText,
    color: "#64748b",
    title: "Historia de vida completa de cada prenda",
    before: "¿De dónde vino esta prenda? ¿Cuándo entró? ¿Pasó por qué locales? ¿Quién la vendió? Ninguna respuesta posible.",
    after: "Cada tag tiene su historial: proveedor → depósito → transferencia → local → probador → venta. Consultar la trazabilidad completa de cualquier artículo en 2 segundos.",
    kpi: "Trazabilidad de extremo a extremo",
  },
  {
    icon: Tag,
    color: "#d97706",
    title: "Autenticidad y protección contra falsificaciones",
    before: "¿Es una prenda original de la marca o una réplica que ingresó al sistema con una etiqueta falsa? Imposible detectarlo sin el tag original.",
    after: "Cada tag RFID tiene un ID único e irrepetible en la base de datos. Si se intenta ingresar un artículo con un ID que no existe o ya fue vendido, el sistema lo rechaza.",
    kpi: "Producto falsificado o duplicado detectado al instante",
  },
  {
    icon: TrendingUp,
    color: "#22c55e",
    title: "Análisis de comportamiento en tienda",
    before: "¿Qué artículos se llevan al probador y terminan en venta? ¿Cuáles se prueban pero no se compran? Ningún dato disponible.",
    after: "Con RFID en probadores se conoce la tasa de conversión por artículo: cuántas veces fue a probador, cuántas resultaron en venta. Información valiosa para compras y visual merchandising.",
    kpi: "Datos de conversión por producto",
  },
  {
    icon: RefreshCw,
    color: "#0284c7",
    title: "Sincronización multilocal en tiempo real",
    before: "El stock de cada local se actualiza cada cierto tiempo o cuando alguien lo carga. Datos desactualizados. Decisiones sobre información vieja.",
    after: "Cada movimiento RFID en cualquier local actualiza el stock central en segundos. El dashboard muestra el estado real de todo el stock en toda la cadena, siempre.",
    kpi: "Stock multilocal actualizado en tiempo real",
  },
  {
    icon: Flame,
    color: "#dc2626",
    title: "Inventario post-siniestro para el seguro",
    before: "Hubo un robo o incendio. ¿Cuánto valía exactamente lo que se perdió? El perito del seguro pide pruebas. No hay nada más que estimaciones y planillas desactualizadas.",
    after: "El sistema tiene el snapshot exacto del inventario al momento del siniestro: qué artículos, cuántas unidades, valor a costo y a precio de venta. El reclamo se hace con datos irrefutables y trazados al instante.",
    kpi: "Reclamos al seguro con evidencia exacta",
  },
  {
    icon: Building2,
    color: "#0891b2",
    title: "Inventario verificado como garantía bancaria",
    before: "El banco pide valorización del stock. Se presenta una planilla que nadie puede auditar. La entidad desconfía y otorga menos crédito o a tasa más alta.",
    after: "El stock está medido y verificado por RFID en tiempo real. Se genera un reporte auditable con cantidad y valor por artículo y por local. El banco lo acepta como activo demostrable.",
    kpi: "Mejor crédito respaldado por stock real",
  },
  {
    icon: Wrench,
    color: "#7c3aed",
    title: "Taller y reparaciones — trazabilidad de la prenda",
    before: "Una prenda va a arreglo o personalización. Se anota en papel. El papel se pierde. ¿Quién la tiene? ¿Cuándo vuelve? ¿Qué trabajo se realizó? Nadie lo sabe.",
    after: "El tag RFID sigue a la prenda durante todo el proceso de taller: quién la recibió, qué trabajo se realizó, cuánto tardó y cuándo volvió al local. Trazabilidad sin papel, integrada al ERP.",
    kpi: "Prendas en taller rastreadas de punta a punta",
  },
  {
    icon: CalendarRange,
    color: "#d97706",
    title: "Liquidaciones y cambio de temporada sin caos",
    before: "Fin de temporada. ¿Qué no se vendió? ¿Cuánto hay? ¿Dónde está? Hay que contar todo de cero para saber qué va a outlet. Días de trabajo y errores garantizados.",
    after: "El RFID ya sabe qué no rotó, cuántos días lleva parado y en qué local está. Se genera automáticamente la lista de liquidación con valor y ubicación. Sin conteo adicional, sin papel.",
    kpi: "Lista de liquidación generada en segundos",
  },
];

const BENEFITS_MAYORISTA_INITIAL = [
  { title: "Trazabilidad de extremo a extremo: de fábrica a venta minorista", kpi: "Cada prenda tiene historial completo desde el origen hasta el cliente final" },
  { title: "Control de ingreso y egreso de mercadería en cada punto de la cadena", kpi: "Quién recibió, quién despachó, cuándo y dónde — registrado automáticamente" },
  { title: "Identificación del operario responsable de cada movimiento", kpi: "Cero anonimato: cada ingreso o egreso vinculado a un empleado específico" },
  { title: "Control de probadores: cuántas prendas entran y cuántas salen", kpi: "Alerta inmediata si hay diferencia entre lo que entró al probador y lo que salió" },
  { title: "Desactivación automática del antihurto al momento de la venta", kpi: "El tag se desactiva al procesar la venta — sin intervención manual del cajero" },
  { title: "Gestión de personal mediante tarjeta RFID de empleado", kpi: "Acceso, horarios y operaciones de cada empleado registrados con su tarjeta" },
  { title: "Pedidos corporativos despachados sin error de unidades", kpi: "Cero reclamos por faltantes o sobrantes en grandes volúmenes" },
  { title: "Lectura masiva de cajas cerradas al despachar", kpi: "Carga de pedidos mayoristas en una fracción del tiempo" },
  { title: "Trazabilidad completa de cada pedido empresarial", kpi: "De fábrica a cliente final, con sello de quién, cuándo y dónde" },
  { title: "Personalización con logo y serialización RFID única", kpi: "Cada prenda corporativa identificada individualmente" },
  { title: "Control de talles especiales y confecciones a medida", kpi: "Producción a medida verificada unidad por unidad" },
  { title: "Picking de pedidos a franquicias automatizado", kpi: "Despachos a sucursales sin conteo manual" },
  { title: "Confirmación de recepción en franquicia o cliente B2B", kpi: "El cliente confirma con un escaneo, no con un papel" },
  { title: "Stock disponible para empresas en tiempo real", kpi: "El comercial cotiza con disponibilidad real, no estimada" },
  { title: "Diferenciación entre stock minorista y mayorista", kpi: "Reservas para empresas sin afectar la venta al público" },
  { title: "Validación de licencias de marca y autenticidad", kpi: "Antifalsificación garantizada para distribuidores y exportación" },
  { title: "Trazabilidad para exportación (For Export)", kpi: "Cumplimiento aduanero y de proveedores internacionales" },
  { title: "Auditoría de pedidos corporativos por cliente", kpi: "Historial completo de cada empresa cliente" },
  { title: "Devoluciones B2B verificadas pieza por pieza", kpi: "Conciliación sin discusión con el cliente corporativo" },
  { title: "Logística de despacho con confirmación digital", kpi: "Sistema avanzado de logística respaldado por datos reales" },
  { title: "Cotizaciones en el día con stock comprometido al instante", kpi: "Presupuestos personalizados respaldados por disponibilidad real" },
  { title: "Trazabilidad desde fábrica/origen antes del envío", kpi: "Tags colocados en producción permiten verificar el contenido de cada contenedor sin abrirlo" },
  { title: "Verificación de containers en aduana y recepción de importaciones", kpi: "Cruze automático entre lo declarado en la OC y lo leído por RFID al ingresar al país" },
  { title: "Inventario valorizado y auditable como garantía bancaria o para inversores", kpi: "Stock verificado en tiempo real que puede presentarse como activo formal ante entidades financieras" },
];

const BENEFITS_MINORISTA_INITIAL = [
  { bloque: "Inventario y stock en sala", items: [
    { title: "Inventario sin cerrar el local", kpi: "El local sigue vendiendo mientras se cuenta" },
    { title: "Exactitud de stock cercana al 100%", kpi: "Lo que dice el sistema es lo que hay en sala" },
    { title: "Sincronización multilocal en tiempo real", kpi: "Las 40+ sucursales ven el stock global al instante" },
    { title: "Reposición automática de góndola", kpi: "El local nunca se queda sin talles en piso" },
    { title: "Alertas de stock detenido sin rotación", kpi: "El stock que no se mueve se identifica solo" },
    { title: "Búsqueda instantánea de prenda en el local", kpi: "\"¿Hay este talle?\" se responde en segundos" },
  ]},
  { bloque: "Logística entre locales y depósito", items: [
    { title: "Transferencias entre sucursales sin errores", kpi: "Lo que sale de un local llega exacto al otro" },
    { title: "Recepción de mercadería sin abrir cajas", kpi: "Las cajas se leen cerradas al ingresar al local" },
    { title: "Generación automática de remito al pickear", kpi: "El remito se arma solo mientras el operario carga" },
    { title: "Confirmación de llegada al destino", kpi: "Diferencias entre lo enviado y lo recibido en segundos" },
  ]},
  { bloque: "Antihurto y prevención de pérdida", items: [
    { title: "Control de probadores con detección de hurto", kpi: "Si una prenda entra al probador y no sale, alerta inmediata" },
    { title: "Desactivación antihurto automática en caja", kpi: "El cajero no tiene que hacer nada manual" },
    { title: "Devoluciones verificadas pieza por pieza", kpi: "Imposible devolver una prenda distinta a la que se llevó" },
    { title: "Autenticidad y protección antifalsificación", kpi: "Productos truchos detectados al instante en mostrador" },
    { title: "Antihurto en accesos sin etiqueta extra", kpi: "La misma etiqueta de producto funciona como antirrobo" },
  ]},
  { bloque: "Empleados y operación de tienda", items: [
    { title: "Trazabilidad total por operario", kpi: "Cada movimiento queda asociado a una persona" },
    { title: "Auditoría de comportamiento por empleado", kpi: "Patrones inusuales detectados automáticamente" },
    { title: "Identificación de operario en cada acción", kpi: "Responsabilidad individual trazada de punta a punta" },
    { title: "Tarjeta RFID de empleado — acceso a sectores y trazabilidad completa", kpi: "El empleado usa la misma tecnología RFID: control de acceso + operaciones integradas" },
    { title: "Control de quién ingresó y egresó mercadería en cada turno", kpi: "Historial de movimientos por persona, turno y sector — sin depender de declaraciones" },
  ]},
  { bloque: "Inteligencia comercial en local", items: [
    { title: "Análisis de comportamiento en tienda", kpi: "Qué se prueba, qué se compra y qué se devuelve" },
    { title: "Datos de conversión por producto y por talle", kpi: "Decisiones de compra basadas en lo que pasa en sala" },
    { title: "Mapa de calor de prendas más manipuladas", kpi: "Saber qué llama la atención aunque no se venda" },
    { title: "Historia de vida completa de cada prenda", kpi: "De fábrica → depósito → local → cliente, sin huecos" },
  ]},
  { bloque: "Finanzas, seguros y gestión de temporada", items: [
    { title: "Inventario exacto post-siniestro para el seguro", kpi: "Reclamo al seguro respaldado con datos irrefutables del sistema" },
    { title: "Stock verificado como garantía bancaria", kpi: "Mejor acceso a crédito con inventario auditable en tiempo real" },
    { title: "Lista de liquidación automática al cierre de temporada", kpi: "Sin conteo extra: el sistema sabe qué no rotó y cuánto vale" },
    { title: "Taller y reparaciones rastreadas con RFID", kpi: "Prenda enviada a arreglo o personalización trazada de punta a punta" },
  ]},
];

const SOFTWARE_SECTIONS_INITIAL = [
  {
    bloque: "Dashboard y estadísticas en tiempo real",
    color: "#6366f1",
    bg: "bg-indigo-50/40",
    border: "border-indigo-100",
    kpiColor: "text-indigo-700",
    items: [
      { title: "Stock en tiempo real por local, depósito y tránsito", kpi: "Visibilidad total de dónde está cada unidad en cada momento" },
      { title: "Mapa de calor de movimiento de prendas en tienda", kpi: "Visualizar por dónde circula la mercadería dentro del local" },
      { title: "Rotación de stock por artículo, talle, color y categoría", kpi: "Identificar qué vende bien y qué está parado" },
      { title: "Tasa de conversión en probadores", kpi: "Cuántas prendas entran al probador vs. cuántas terminan en caja" },
      { title: "Tiempo promedio de estadía de una prenda en góndola", kpi: "Antes de venderse, transferirse o liquidarse" },
      { title: "Alertas automáticas de stock bajo por local y talle", kpi: "Aviso antes de quebrarse el stock, no después" },
      { title: "Ranking de artículos más y menos rotados", kpi: "Por local, por período, por categoría" },
      { title: "Histórico de inventarios con comparación entre fechas", kpi: "Ver la evolución del stock semana a semana o mes a mes" },
    ],
  },
  {
    bloque: "Conexión con el ERP — datos que fluyen automáticamente",
    color: "#0ea5e9",
    bg: "bg-sky-50/40",
    border: "border-sky-100",
    kpiColor: "text-sky-700",
    items: [
      { title: "Ingreso de mercadería confirmado por RFID → Ingreso automático en ERP", kpi: "Sin carga manual de remitos: el portal lee la caja y el ERP la registra solo" },
      { title: "Despacho por picking RFID → Remito generado automáticamente en ERP", kpi: "Cada ítem pickeado actualiza el remito en tiempo real" },
      { title: "Transferencia entre locales → Movimiento de stock bilateral en ERP", kpi: "Sale de un local, llega al otro, ambos actualizados sin intervención" },
      { title: "Venta en POS → Desactivación de tag + baja de stock en ERP simultánea", kpi: "Una sola acción dispara antihurto + facturación + stock" },
      { title: "Inventario RFID → Ajuste de stock en ERP con un click", kpi: "El conteo físico del lector se aplica directamente al ERP para conciliar diferencias" },
      { title: "Alerta de stock detenido → Notificación push en ERP al responsable", kpi: "Stock muerto identificado y comunicado al encargado automáticamente" },
      { title: "Devolución verificada por RFID → Reingreso validado en ERP", kpi: "El tag confirma que el producto devuelto es el que salió" },
      { title: "Producción con serialización RFID → Alta de variante en ERP con código único", kpi: "Cada prenda producida tiene identidad digital desde fábrica" },
    ],
  },
  {
    bloque: "Reportes exportables y toma de decisiones",
    color: "#10b981",
    bg: "bg-emerald-50/40",
    border: "border-emerald-100",
    kpiColor: "text-emerald-700",
    items: [
      { title: "Reporte de pérdidas por local con causa (hurto / error / diferencia)", kpi: "Saber exactamente qué se perdió, dónde y en qué período" },
      { title: "Reporte de performance por operario", kpi: "Quién tiene más errores de picking, quién es más rápido, quién tiene desvíos" },
      { title: "Reporte de transferencias con diferencias detectadas", kpi: "Qué salió vs. qué llegó en cada movimiento entre locales" },
      { title: "Reporte de comportamiento de compradores en tienda", kpi: "Interacción con prendas, frecuencia de prueba, conversión" },
      { title: "Reporte de artículos falsificados o sin tag válido detectados", kpi: "Historial de alertas de autenticidad por local y fecha" },
      { title: "Exportación de datos a Excel / CSV para análisis externo", kpi: "Compatible con cualquier herramienta de BI o planilla" },
      { title: "Reporte de payback y ROI actualizable con datos reales", kpi: "La calculadora de ROI alimentada con datos del sistema, no estimaciones" },
    ],
  },
  {
    bloque: "Automatizaciones y alertas inteligentes",
    color: "#f59e0b",
    bg: "bg-amber-50/40",
    border: "border-amber-100",
    kpiColor: "text-amber-700",
    items: [
      { title: "Reposición automática sugerida al bajar de umbral de stock", kpi: "El sistema propone el pedido al proveedor sin que nadie lo pida" },
      { title: "Alerta de prenda en probador sin salida pasado X minutos", kpi: "Detección de hurto en probadores configurable por tiempo" },
      { title: "Notificación de diferencia en recepción al responsable", kpi: "El encargado de depósito sabe al instante si llegó algo mal" },
      { title: "Alerta de artículo sin movimiento pasados N días", kpi: "Capital inmovilizado identificado automáticamente para liquidar o reubicar" },
      { title: "Disparo automático de conteo de inventario programado", kpi: "Inventarios sin intervención humana de iniciación" },
      { title: "Sincronización automática con MercadoLibre al actualizar stock RFID", kpi: "El stock de ML se actualiza con el físico real sin delay" },
    ],
  },
  {
    bloque: "CRM, taller, seguros e inteligencia financiera",
    color: "#8b5cf6",
    bg: "bg-violet-50/40",
    border: "border-violet-100",
    kpiColor: "text-violet-700",
    items: [
      { title: "Venta en POS con RFID → Ticket enriquecido en CRM con historial de la prenda", kpi: "El CRM registra qué artículo específico (talle, color, lote) compró cada cliente" },
      { title: "Prenda probada pero no comprada → Alerta de oportunidad en CRM", kpi: "El sistema sabe qué artículo le interesó al cliente para hacer seguimiento" },
      { title: "Perfil de cliente enriquecido con comportamiento real en tienda", kpi: "El vendedor sabe qué probó y qué compró cada cliente registrado" },
      { title: "Prenda en taller rastreada por RFID con historial completo", kpi: "Quién la recibió, qué trabajo se hizo, cuánto tardó, cuándo volvió al local" },
      { title: "Módulo de Órdenes de Trabajo con trazabilidad RFID integrada", kpi: "Cada OT vinculada al tag específico de la prenda afectada" },
      { title: "Snapshot de inventario para reclamos al seguro post-siniestro", kpi: "Reporte generado al instante con evidencia irrefutable para el perito" },
      { title: "Informe de inventario auditable para garantías bancarias o inversores", kpi: "Activo verificado en tiempo real con sello de auditoría digital" },
      { title: "Reporte automático de liquidaciones por temporada sin conteo adicional", kpi: "Lista de prendas sin rotación, por local, con días paradas y valor inmovilizado" },
    ],
  },
];

// =====================================================================
// Discurso de presentación para reunión con Montagne (editable)
// =====================================================================
const SPEECH_INITIAL = {
  apertura: "Bueno, como ya les adelanté por arriba — no les vengo a vender nada raro. Estuvimos viendo con Mati un sistema que armamos para nosotros, para los locales nuestros, y mirándolo dijimos: 'esto es para Montagne'. Literal. Por escala, por fábrica, por la cantidad de puntos de venta que manejan ustedes. Así que más que una presentación formal, es mostrarles algo que nos copó y queremos compartir.",

  porQueNosotros: "¿Por qué venimos nosotros con esto? Porque lo vivimos del otro lado del mostrador todos los días. Yo arranqué con el rubro hace años, conozco la cadena entera. Mati es ingeniero electrónico, programador, mete IA en todo lo que toca — y juntos armamos esto adentro de nuestra propia operación. No es una demo de PowerPoint: es un sistema corriendo, con plata real adentro. Y cuando lo vimos andar, pensamos en ustedes antes que en nadie.",

  // ===== BLOQUE MAYORISTA / FÁBRICA (lo principal) =====
  mayoristaIntro: "Empecemos por lo que más nos interesa mostrarles a ustedes: la parte mayorista y de fábrica. Porque ahí es donde la diferencia se nota muchísimo más que en un local. Un local pierde una prenda y te enojás. Una fábrica pierde control de un lote y se te complica medio mes.",

  mayoristaProblema: "Pensemos un segundo cómo es un día normal en la fábrica. Sale producción, se arman cajas, se cargan al transporte, llega a un franquiciado, alguien cuenta, alguien firma, alguien dice 'me faltó tal talle'. Y ahí empieza la novela: ¿se perdió en la fábrica?, ¿se perdió en el flete?, ¿lo agarró alguien en el local? Nadie lo sabe con certeza. Se termina poniendo de buena fe del lado de uno o del otro. Y eso multiplicado por la cantidad de envíos por mes, es plata, tiempo y desgaste con los franquiciados.",

  mayoristaSolucion: "Con RFID en fábrica eso desaparece. Cada prenda nace con su chip cuando sale del taller. Cuando se arma una caja para mandar a un franquiciado, pasás la caja por un arco — sin abrir nada — y en 3 segundos sabés exactamente qué hay adentro. El que la recibe hace lo mismo del otro lado. Si falta algo, queda registrado en el momento, con foto, hora y persona. Se acabó la discusión. Y para ustedes, como dueños del 25% de la franquicia, eso es oro: porque la relación con los franquiciados deja de tener fricción operativa.",

  mayoristaTrazabilidad: "Pero hay algo todavía más interesante para una marca como Montagne: trazabilidad. Saber que la campera que vendieron en el local de Pinamar salió del lote 847 producido en marzo. Si aparece un defecto, ya sabés exactamente qué franquicias recibieron ese lote y podés actuar antes de que sea un problema. Esto es lo que hace cualquier marca seria del mundo. Y se hace una sola vez: poner el tag al final de la línea.",

  // ===== BLOQUE MINORISTA =====
  minoristaIntro: "Ahora bien, una vez que la prenda ya salió de fábrica con su tag, todo lo que viene después en los locales es regalo. Porque el chip ya está puesto, no hay trabajo extra. Y ahí se abre todo otro mundo de cosas que les van a interesar.",

  minoristaProblema: "En un local hoy, ¿qué pasa? Inventario una vez por mes, con el local cerrado, dos chicas contando hasta las once de la noche. Una prenda que se busca y no aparece — y al final estaba colgada en otro perchero. Probadores donde entran tres prendas y salen dos. Transferencias entre sucursales que tardan días en conciliar. Son cosas chicas que sumadas son una locura.",

  minoristaSolucion: "Con RFID, el inventario lo hace una persona en 20 minutos con el local abierto vendiendo. Pasás un lector tipo pistola por los percheros y listo. Buscás una prenda y el sistema te dice exactamente en qué perchero está, en qué probador, o si está en el depósito. El probador detecta solo si entraron tres y salieron dos. Y todo se ve en tiempo real desde la oficina central — ustedes pueden saber qué está pasando en cualquier local sin llamar por teléfono.",

  experiencia: "Y hay un plus que para una marca como Montagne suma: el cliente final. Probador inteligente que reconoce la prenda y sugiere talles, colores o combinaciones. Caja sin colas — pasás todo el carrito junto y se cobra en segundos. Esas cosas que hoy ven en las marcas top del mundo, las pueden tener acá, hechas en Argentina, con soporte local.",

  cierre: "Eso es lo que les queríamos mostrar. No vinimos con una cotización ni con un contrato — vinimos a tirarles la idea, a que la masquen, y si les hace ruido seguimos charlando. Total, lo nuestro ya está andando. Lo que sí: a esta altura del partido, el que se sube primero al tren del RFID en Argentina se queda con una ventaja muy difícil de igualar después. Y nos parecía que ustedes tenían que verlo antes que el resto.",
};

const STORAGE_KEY = "rfid_propuesta_v2";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// Serializa BENEFITS (con icon component) a forma persistible
const serializeBenefits = (arr) => arr.map((b) => ({ ...b, iconName: iconToName(b.icon), icon: undefined }));
const deserializeBenefits = (arr) => arr.map((b) => ({ ...b, icon: ICON_MAP[b.iconName] || Tag }));

// =====================================================================
// Modal genérico de edición de campos
// =====================================================================
function EditorModal({ title, fields, initial, onSave, onClose }) {
  const [data, setData] = useState(initial || {});
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  rows={f.rows || 3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              ) : f.type === "select" ? (
                <select
                  value={data[f.key] || f.options[0]}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : f.type === "color" ? (
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => setData({ ...data, [f.key]: c })}
                      className={`w-7 h-7 rounded-md border-2 ${data[f.key] === c ? "border-slate-900 scale-110" : "border-white"}`}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
          <button onClick={() => { onSave(data); onClose(); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Save size={14} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// Botones de acción inline (editar/borrar) — visibles solo en modo edición
function ItemActions({ onEdit, onDelete, editMode }) {
  if (!editMode) return null;
  return (
    <div className="flex gap-1 ml-2 shrink-0">
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Editar"><Pencil size={13} /></button>
      <button onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este ítem?")) onDelete(); }} className="p-1 rounded hover:bg-red-100 text-red-600" title="Eliminar"><Trash2 size={13} /></button>
    </div>
  );
}
function BenefitAccordion({ icon: Icon, color, title, kpi, before, after, onEdit, onDelete, editMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 flex-1 text-left">
          <div className="rounded-lg p-2 flex-shrink-0" style={{ background: color + "18" }}>
            <Icon size={18} style={{ color }} />
          </div>
          <span className="flex-1 font-semibold text-slate-800 text-sm">{title}</span>
          <span className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0" style={{ background: color + "18", color }}>
            {kpi}
          </span>
          {open ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
        </button>
        <ItemActions onEdit={onEdit} onDelete={onDelete} editMode={editMode} />
      </div>
      {open && (
        <div className="px-5 pb-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs font-bold text-red-600 mb-1">❌ Sin RFID hoy</p>
            <p className="text-sm text-red-700">{before}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs font-bold text-emerald-600 mb-1">✅ Con RFID</p>
            <p className="text-sm text-emerald-700">{after}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function NumInput({ label, symbol, value, onChange, step, suffix, note }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs">{symbol}</span>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step={step ?? 1}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {suffix && <span className="text-xs text-slate-400 whitespace-nowrap">{suffix}</span>}
      </div>
      {note && <p className="text-xs text-slate-400 leading-tight">{note}</p>}
    </div>
  );
}

export default function RFIDPropuesta() {
  const [showSpeech, setShowSpeech] = useState(false);
  const [showBenef, setShowBenef] = useState(false);
  const [showMayorista, setShowMayorista] = useState(false);
  const [showMinorista, setShowMinorista] = useState(false);
  const [showSoftware, setShowSoftware] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showLeyenda, setShowLeyenda] = useState(false);

  // ── Modo edición global ──
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState(null); // {title, fields, initial, onSave}

  // ── Estado editable (con persistencia en localStorage) ──
  const stored = useMemo(() => loadFromStorage(), []);
  const [BENEFITS, setBENEFITS] = useState(() =>
    stored?.benefits ? deserializeBenefits(stored.benefits) : BENEFITS_INITIAL
  );
  const [BENEFITS_MAYORISTA, setBENEFITS_MAYORISTA] = useState(() =>
    stored?.mayorista || BENEFITS_MAYORISTA_INITIAL
  );
  const [BENEFITS_MINORISTA, setBENEFITS_MINORISTA] = useState(() =>
    stored?.minorista || BENEFITS_MINORISTA_INITIAL
  );
  const [SOFTWARE_SECTIONS, setSOFTWARE_SECTIONS] = useState(() =>
    stored?.software || SOFTWARE_SECTIONS_INITIAL
  );
  const [SPEECH, setSPEECH] = useState(() => stored?.speech || SPEECH_INITIAL);

  useEffect(() => {
    saveToStorage({
      benefits: serializeBenefits(BENEFITS),
      mayorista: BENEFITS_MAYORISTA,
      minorista: BENEFITS_MINORISTA,
      software: SOFTWARE_SECTIONS,
      speech: SPEECH,
    });
  }, [BENEFITS, BENEFITS_MAYORISTA, BENEFITS_MINORISTA, SOFTWARE_SECTIONS, SPEECH]);

  const resetAll = () => {
    if (!confirm("¿Restaurar todos los textos originales? Se perderán tus ediciones.")) return;
    setBENEFITS(BENEFITS_INITIAL);
    setBENEFITS_MAYORISTA(BENEFITS_MAYORISTA_INITIAL);
    setBENEFITS_MINORISTA(BENEFITS_MINORISTA_INITIAL);
    setSOFTWARE_SECTIONS(SOFTWARE_SECTIONS_INITIAL);
    setSPEECH(SPEECH_INITIAL);
  };

  // ── Helpers CRUD ──
  const editBenefit = (idx) => {
    const b = BENEFITS[idx];
    setEditor({
      title: idx == null ? "Nuevo beneficio" : "Editar beneficio",
      fields: [
        { key: "title", label: "Título" },
        { key: "kpi", label: "KPI / resultado breve" },
        { key: "before", label: "Antes (sin RFID)", type: "textarea", rows: 3 },
        { key: "after", label: "Después (con RFID)", type: "textarea", rows: 3 },
        { key: "iconName", label: "Ícono", type: "select", options: ICON_NAMES },
        { key: "color", label: "Color", type: "color" },
      ],
      initial: idx == null
        ? { title: "", kpi: "", before: "", after: "", iconName: "Tag", color: PALETTE[0] }
        : { ...b, iconName: iconToName(b.icon) },
      onSave: (data) => {
        const next = { ...data, icon: ICON_MAP[data.iconName] || Tag };
        if (idx == null) setBENEFITS([...BENEFITS, next]);
        else setBENEFITS(BENEFITS.map((x, i) => (i === idx ? next : x)));
      },
    });
  };
  const delBenefit = (idx) => setBENEFITS(BENEFITS.filter((_, i) => i !== idx));

  const editMayorista = (idx) => {
    setEditor({
      title: idx == null ? "Nuevo beneficio mayorista" : "Editar beneficio mayorista",
      fields: [{ key: "title", label: "Título" }, { key: "kpi", label: "KPI", type: "textarea", rows: 2 }],
      initial: idx == null ? { title: "", kpi: "" } : BENEFITS_MAYORISTA[idx],
      onSave: (data) => {
        if (idx == null) setBENEFITS_MAYORISTA([...BENEFITS_MAYORISTA, data]);
        else setBENEFITS_MAYORISTA(BENEFITS_MAYORISTA.map((x, i) => (i === idx ? data : x)));
      },
    });
  };
  const delMayorista = (idx) => setBENEFITS_MAYORISTA(BENEFITS_MAYORISTA.filter((_, i) => i !== idx));

  const editMinoristaItem = (bi, ii) => {
    const item = ii == null ? { title: "", kpi: "" } : BENEFITS_MINORISTA[bi].items[ii];
    setEditor({
      title: ii == null ? "Nuevo ítem" : "Editar ítem",
      fields: [{ key: "title", label: "Título" }, { key: "kpi", label: "KPI", type: "textarea", rows: 2 }],
      initial: item,
      onSave: (data) => {
        setBENEFITS_MINORISTA(BENEFITS_MINORISTA.map((bloque, i) => {
          if (i !== bi) return bloque;
          const items = ii == null ? [...bloque.items, data] : bloque.items.map((x, j) => (j === ii ? data : x));
          return { ...bloque, items };
        }));
      },
    });
  };
  const delMinoristaItem = (bi, ii) => {
    setBENEFITS_MINORISTA(BENEFITS_MINORISTA.map((bloque, i) =>
      i !== bi ? bloque : { ...bloque, items: bloque.items.filter((_, j) => j !== ii) }
    ));
  };
  const editMinoristaBlock = (bi) => {
    const bloque = bi == null ? { bloque: "", items: [] } : BENEFITS_MINORISTA[bi];
    setEditor({
      title: bi == null ? "Nuevo bloque minorista" : "Editar bloque",
      fields: [{ key: "bloque", label: "Nombre del bloque" }],
      initial: bloque,
      onSave: (data) => {
        if (bi == null) setBENEFITS_MINORISTA([...BENEFITS_MINORISTA, { bloque: data.bloque, items: [] }]);
        else setBENEFITS_MINORISTA(BENEFITS_MINORISTA.map((b, i) => (i === bi ? { ...b, bloque: data.bloque } : b)));
      },
    });
  };
  const delMinoristaBlock = (bi) => setBENEFITS_MINORISTA(BENEFITS_MINORISTA.filter((_, i) => i !== bi));

  const editSoftwareItem = (si, ii) => {
    const item = ii == null ? { title: "", kpi: "" } : SOFTWARE_SECTIONS[si].items[ii];
    setEditor({
      title: ii == null ? "Nuevo ítem de software" : "Editar ítem",
      fields: [{ key: "title", label: "Título" }, { key: "kpi", label: "KPI", type: "textarea", rows: 2 }],
      initial: item,
      onSave: (data) => {
        setSOFTWARE_SECTIONS(SOFTWARE_SECTIONS.map((sec, i) => {
          if (i !== si) return sec;
          const items = ii == null ? [...sec.items, data] : sec.items.map((x, j) => (j === ii ? data : x));
          return { ...sec, items };
        }));
      },
    });
  };
  const delSoftwareItem = (si, ii) => {
    setSOFTWARE_SECTIONS(SOFTWARE_SECTIONS.map((sec, i) =>
      i !== si ? sec : { ...sec, items: sec.items.filter((_, j) => j !== ii) }
    ));
  };
  const editSoftwareBlock = (si) => {
    const sec = si == null
      ? { bloque: "", color: PALETTE[0], bg: "bg-slate-50/40", border: "border-slate-100", kpiColor: "text-slate-700", items: [] }
      : SOFTWARE_SECTIONS[si];
    setEditor({
      title: si == null ? "Nuevo bloque de software" : "Editar bloque",
      fields: [{ key: "bloque", label: "Nombre del bloque" }, { key: "color", label: "Color", type: "color" }],
      initial: sec,
      onSave: (data) => {
        if (si == null) setSOFTWARE_SECTIONS([...SOFTWARE_SECTIONS, { ...sec, bloque: data.bloque, color: data.color }]);
        else setSOFTWARE_SECTIONS(SOFTWARE_SECTIONS.map((s, i) => (i === si ? { ...s, bloque: data.bloque, color: data.color } : s)));
      },
    });
  };
  const delSoftwareBlock = (si) => setSOFTWARE_SECTIONS(SOFTWARE_SECTIONS.filter((_, i) => i !== si));

  const editSpeechSection = (key, label) => {
    setEditor({
      title: `Editar — ${label}`,
      fields: [{ key: "value", label, type: "textarea", rows: 8 }],
      initial: { value: SPEECH[key] },
      onSave: (data) => setSPEECH({ ...SPEECH, [key]: data.value }),
    });
  };


  // Variables COSTO ANTES
  const [E, setE] = useState(20);
  const [Pi, setPi] = useState(200);
  const [C, setC] = useState(10000);
  const [Pg, setPg] = useState(100);
  const [Ps, setPs] = useState(60);
  const [Q, setQ] = useState(80000);
  const [V, setV] = useState(50);
  const [M, setM] = useState(100_000_000);
  const [R, setR] = useState(2);

  // Variables COSTO AHORA
  const [En, setEn] = useState(6);
  const [Qt, setQt] = useState(40);
  const [Pss, setPss] = useState(20);
  const [N, setN] = useState(200);

  // Inversión
  const [INV, setINV] = useState(30_000_000);

  const calc = useMemo(() => {
    const r = R / 100;

    const term_EPiC = E * Pi * C;
    const term_EPgC = E * Pg * C;
    const term_EpsC = E * Ps * C;
    const term_QV   = Q * V;
    const term_MR   = M * r;
    const costoAntes = term_EPiC + term_EPgC + term_EpsC + term_QV + term_MR;

    // COSTO AHORA: En*Qt*C + En*(En/E)*C + En*C*Pss + Q*N
    const term_EnQtC  = En * Qt * C;
    const term_EnRatC = En * (En / E) * C;
    const term_EnCPss = En * C * Pss;
    const term_QN     = Q * N;
    const costoAhora = term_EnQtC + term_EnRatC + term_EnCPss + term_QN;

    const ahorro = costoAntes - costoAhora;
    const payback = ahorro > 0 ? INV / ahorro : null;

    return {
      term_EPiC, term_EPgC, term_EpsC, term_QV, term_MR, costoAntes,
      term_EnQtC, term_EnRatC, term_EnCPss, term_QN, costoAhora,
      ahorro, payback,
    };
  }, [E, Pi, C, Pg, Ps, Q, V, M, R, En, Qt, Pss, N, INV]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">Propuesta RFID · Montagne</h1>
          <p className="text-slate-600 mt-2 text-base font-medium">Beneficios operativos + Análisis económico de ROI</p>
          <p className="text-slate-400 mt-0.5 text-sm">De fábrica → depósito → distribución → locales → cliente final</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border ${editMode ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}
            title="Activa para agregar / editar / eliminar"
          >
            <Pencil className="w-4 h-4" />
            {editMode ? "Modo edición ON" : "Editar contenido"}
          </button>
          {editMode && (
            <button onClick={resetAll} className="px-3 py-2 text-xs text-red-700 border border-red-300 rounded-lg hover:bg-red-50">
              Restaurar original
            </button>
          )}
        </div>
      </div>

      {editor && <EditorModal {...editor} onClose={() => setEditor(null)} />}

      {/* ── Discurso para presentar a Montagne ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden text-white">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
          onClick={() => setShowSpeech(!showSpeech)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg flex items-center gap-2">
                Speech para la reunión
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xs text-slate-400">Tono distendido — primero MAYORISTA / fábrica, después MINORISTA</div>
            </div>
          </div>
          {showSpeech ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
        </button>
        {showSpeech && (
          <div className="px-6 pb-6 border-t border-slate-700 pt-4 space-y-3">
            {[
              { type: "section", key: "apertura", label: "1 · Apertura — distendida", hint: "Romper el hielo. Ya saben de qué viene la mano." },
              { type: "section", key: "porQueNosotros", label: "2 · Por qué venimos nosotros con esto", hint: "Vivimos el rubro + Mati lo armó adentro de nuestra operación." },
              { type: "group", label: "🏭  BLOQUE 1 — MAYORISTA / FÁBRICA  (lo principal)" },
              { type: "section", key: "mayoristaIntro", label: "3 · Por qué arrancamos por acá", hint: "Justificar que lo mayorista es donde más impacta." },
              { type: "section", key: "mayoristaProblema", label: "4 · El problema de fábrica → franquiciado", hint: "Pintarles la novela actual sin acusar a nadie." },
              { type: "section", key: "mayoristaSolucion", label: "5 · Cómo cambia con RFID en fábrica", hint: "Foco en: se acaba la discusión con franquiciados." },
              { type: "section", key: "mayoristaTrazabilidad", label: "6 · Trazabilidad de marca", hint: "Lo que hace cualquier marca seria del mundo." },
              { type: "group", label: "🛍️  BLOQUE 2 — MINORISTA  (después de fábrica)" },
              { type: "section", key: "minoristaIntro", label: "7 · El tag ya está puesto, todo lo que viene es regalo", hint: "Conectar bloque 1 con bloque 2." },
              { type: "section", key: "minoristaProblema", label: "8 · El día a día actual del local", hint: "Inventario, prendas perdidas, probadores, transferencias." },
              { type: "section", key: "minoristaSolucion", label: "9 · Cómo cambia el local", hint: "20 minutos vs cerrar el local. Tiempo real." },
              { type: "section", key: "experiencia", label: "10 · Experiencia para el cliente final", hint: "Probador inteligente, caja sin colas." },
              { type: "section", key: "cierre", label: "11 · Cierre suave", hint: "Sin pedir nada concreto. Sembrar FOMO sin presionar." },
            ].map((row, i) => {
              if (row.type === "group") {
                return (
                  <div key={`g-${i}`} className="pt-3 pb-1">
                    <div className="text-amber-400 font-bold text-sm uppercase tracking-wider border-b border-amber-500/30 pb-2">
                      {row.label}
                    </div>
                  </div>
                );
              }
              const { key, label, hint } = row;
              return (
                <div key={key} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-amber-400/40 transition">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-amber-300 text-xs font-bold uppercase tracking-wider">{label}</h4>
                    {editMode && (
                      <button onClick={() => editSpeechSection(key, label)} className="p-1 rounded hover:bg-white/10 text-amber-300" title="Editar">
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  {hint && <div className="text-[10px] text-slate-500 italic mb-2">{hint}</div>}
                  <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{SPEECH[key]}</p>
                </div>
              );
            })}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200">
              💡 Tip: leelo distendido, como charla entre gente del rubro. Activá <b>Modo edición</b> arriba para ajustar cualquier párrafo.
            </div>
          </div>
        )}
      </div>

      {/* ── Beneficios operativos ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setShowBenef(!showBenef)}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-slate-900 text-lg">Beneficios operativos concretos</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{BENEFITS.length} beneficios</span>
          </div>
          {showBenef ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {showBenef && (
          <div className="px-6 pb-6 border-t border-slate-100 space-y-3 pt-4">
            {BENEFITS.map((b, i) => (
              <BenefitAccordion
                key={i}
                {...b}
                editMode={editMode}
                onEdit={() => editBenefit(i)}
                onDelete={() => delBenefit(i)}
              />
            ))}
            {editMode && (
              <button onClick={() => editBenefit(null)} className="w-full border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Plus size={16} /> Agregar beneficio
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Beneficios MAYORISTA / B2B ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setShowMayorista(!showMayorista)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">B2B</div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-lg">Beneficios — Venta MAYORISTA / Empresas / Franquicias</div>
              <div className="text-xs text-slate-500">Ventas a empresas · Mayorista · Licencias de marca · For Export · Despacho a 40+ sucursales</div>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{BENEFITS_MAYORISTA.length} beneficios</span>
          </div>
          {showMayorista ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {showMayorista && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BENEFITS_MAYORISTA.map((b, i) => (
                <div key={i} className="border border-indigo-100 bg-indigo-50/30 rounded-lg p-3 hover:shadow-sm transition">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{b.title}</div>
                      <div className="text-xs text-indigo-700 mt-1">→ {b.kpi}</div>
                    </div>
                    <ItemActions onEdit={() => editMayorista(i)} onDelete={() => delMayorista(i)} editMode={editMode} />
                  </div>
                </div>
              ))}
              {editMode && (
                <button onClick={() => editMayorista(null)} className="border-2 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-lg p-3 text-sm font-semibold flex items-center justify-center gap-2">
                  <Plus size={16} /> Agregar beneficio mayorista
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Beneficios MINORISTA / Locales al público ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setShowMinorista(!showMinorista)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">B2C</div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-lg">Beneficios — Venta MINORISTA / Locales al público</div>
              <div className="text-xs text-slate-500">40+ sucursales Montagne en Argentina · Locales propios y franquiciados</div>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{BENEFITS_MINORISTA.reduce((a, b) => a + b.items.length, 0)} beneficios</span>
          </div>
          {showMinorista ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {showMinorista && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-5">
            {BENEFITS_MINORISTA.map((bloque, bi) => (
              <div key={bi}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                  <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{bloque.bloque}</h4>
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-xs text-slate-400">{bloque.items.length} ítems</span>
                  {editMode && (
                    <>
                      <button onClick={() => editMinoristaBlock(bi)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Renombrar bloque"><Pencil size={12} /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar el bloque "${bloque.bloque}" y todos sus ítems?`)) delMinoristaBlock(bi); }} className="p-1 rounded hover:bg-red-100 text-red-600" title="Eliminar bloque"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {bloque.items.map((b, i) => (
                    <div key={i} className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3 hover:shadow-sm transition">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-800">{b.title}</div>
                          <div className="text-xs text-emerald-700 mt-1">→ {b.kpi}</div>
                        </div>
                        <ItemActions onEdit={() => editMinoristaItem(bi, i)} onDelete={() => delMinoristaItem(bi, i)} editMode={editMode} />
                      </div>
                    </div>
                  ))}
                  {editMode && (
                    <button onClick={() => editMinoristaItem(bi, null)} className="border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg p-3 text-xs font-semibold flex items-center justify-center gap-2">
                      <Plus size={14} /> Agregar ítem
                    </button>
                  )}
                </div>
              </div>
            ))}
            {editMode && (
              <button onClick={() => editMinoristaBlock(null)} className="w-full border-2 border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Plus size={16} /> Agregar nuevo bloque
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Sistema Software / ERP / Estadísticas ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setShowSoftware(!showSoftware)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-bold text-slate-900 text-lg">Sistema de Software — Datos, Estadísticas y ERP</div>
              <div className="text-xs text-slate-500">Lo que el sistema genera, informa y automatiza conectado al ERP Mundo Outdoor</div>
            </div>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              {SOFTWARE_SECTIONS.reduce((a, s) => a + s.items.length, 0)} funcionalidades
            </span>
          </div>
          {showSoftware ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {showSoftware && (
          <div className="px-6 pb-6 border-t border-slate-100 pt-4 space-y-6">
            {SOFTWARE_SECTIONS.map((sec, si) => (
              <div key={si}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full" style={{ background: sec.color }}></div>
                  <h4 className="font-semibold text-slate-800 text-sm">{sec.bloque}</h4>
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-xs text-slate-400">{sec.items.length} ítems</span>
                  {editMode && (
                    <>
                      <button onClick={() => editSoftwareBlock(si)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Editar bloque"><Pencil size={12} /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar bloque "${sec.bloque}"?`)) delSoftwareBlock(si); }} className="p-1 rounded hover:bg-red-100 text-red-600" title="Eliminar bloque"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sec.items.map((it, i) => (
                    <div key={i} className={`border ${sec.border} ${sec.bg} rounded-lg p-3 hover:shadow-sm transition`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-800 leading-snug">{it.title}</div>
                          <div className={`text-xs mt-1 ${sec.kpiColor}`}>→ {it.kpi}</div>
                        </div>
                        <ItemActions onEdit={() => editSoftwareItem(si, i)} onDelete={() => delSoftwareItem(si, i)} editMode={editMode} />
                      </div>
                    </div>
                  ))}
                  {editMode && (
                    <button onClick={() => editSoftwareItem(si, null)} className="border-2 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg p-3 text-xs font-semibold flex items-center justify-center gap-2">
                      <Plus size={14} /> Agregar ítem
                    </button>
                  )}
                </div>
              </div>
            ))}
            {editMode && (
              <button onClick={() => editSoftwareBlock(null)} className="w-full border-2 border-dashed border-violet-400 text-violet-700 hover:bg-violet-50 rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Plus size={16} /> Agregar nuevo bloque de software
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Calculadora económica ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          onClick={() => setShowCalc(!showCalc)}
        >
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900 text-lg">Calculadora económica de ROI</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">modelo Montagne fábrica</span>
          </div>
          {showCalc ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {showCalc && (
          <div className="px-6 pb-6 border-t border-slate-100 space-y-6 pt-4">

            {/* Fórmula visual */}
            <div className="bg-slate-800 rounded-xl p-5 space-y-3 font-mono text-sm">
              <p className="text-slate-400 text-xs font-sans font-semibold uppercase tracking-wider mb-1">Modelo económico</p>
              <div>
                <span className="text-red-400 font-bold">COSTO_ANTES</span>
                <span className="text-slate-300"> = E·Pi·C + E·Pg·C + E·Ps·C + Q·V + M·R</span>
              </div>
              <div>
                <span className="text-blue-400 font-bold">COSTO_AHORA</span>
                <span className="text-slate-300"> = En·Q'·C + En·(En/E)·C + En·C·Pss + Q·N</span>
              </div>
              <div>
                <span className="text-emerald-400 font-bold">PAYBACK</span>
                <span className="text-slate-300"> = INV / (COSTO_ANTES − COSTO_AHORA)</span>
              </div>
            </div>

            {/* Variables COSTO ANTES */}
            <div>
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Variables — Costo Antes (sin RFID)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <NumInput symbol="E" label="Empleados fábrica" value={E} onChange={setE} note="Ej.: 20 operarios (pickers + control + guardar)" />
                <NumInput symbol="Pi" label="Hs picking / emp. / año" value={Pi} onChange={setPi} suffix="hs" note="Ej.: 200 hs anuales por operario" />
                <NumInput symbol="C" label="Costo hora (ARS)" value={C} onChange={setC} step={500} suffix="$/h" note="Ej.: $10.000/h (incluye cargas)" />
                <NumInput symbol="Pg" label="Hs guardar / emp. / año" value={Pg} onChange={setPg} suffix="hs" note="Ej.: 100 hs anuales por operario" />
                <NumInput symbol="Ps" label="Hs control / emp. / año" value={Ps} onChange={setPs} suffix="hs" note="Ej.: 60 hs anuales por operario" />
                <NumInput symbol="Q" label="Cantidad artículos" value={Q} onChange={setQ} step={5000} note="Ej.: 80.000 SKUs etiquetados al año" />
                <NumInput symbol="V" label="Precio etiqueta actual" value={V} onChange={setV} suffix="$/u" note="Ej.: $50 por etiqueta de código de barras" />
                <NumInput symbol="M" label="Stock valorizado (ARS)" value={M} onChange={setM} step={5_000_000} note="Ej.: $100.000.000 stock a costo" />
                <NumInput symbol="R" label="% robo estimado" value={R} onChange={setR} step={0.5} suffix="%" note="Ej.: 2% anual (referencia sector)" />
              </div>
            </div>

            {/* Variables COSTO AHORA */}
            <div>
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Variables — Costo Ahora (con RFID)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <NumInput symbol="En" label="Empleados c/RFID" value={En} onChange={setEn} note="Ej.: 6 operarios necesarios con RFID" />
                <NumInput symbol="Q'" label="Hs picking RFID / emp. / año" value={Qt} onChange={setQt} suffix="hs" note="Ej.: 40 hs anuales (vs 200 sin RFID)" />
                <NumInput symbol="Pss" label="Hs control RFID / emp. / año" value={Pss} onChange={setPss} suffix="hs" note="Ej.: 20 hs anuales (vs 60 sin RFID)" />
                <NumInput symbol="N" label="Precio tag RFID" value={N} onChange={setN} suffix="$/u" note="Ej.: $200 por tag (varía por volumen)" />
                <NumInput symbol="INV" label="Inversión inicial (ARS)" value={INV} onChange={setINV} step={5_000_000} note="Ej.: $30.000.000 (hardware + impl.)" />
              </div>
            </div>

            {/* Resultados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Desglose Antes */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-3">Desglose Costo Antes</p>
                <table className="w-full text-xs">
                  <tbody className="space-y-1">
                    {[
                      ["E·Pi·C", "Costo laboral picking", calc.term_EPiC],
                      ["E·Pg·C", "Costo laboral guardar", calc.term_EPgC],
                      ["E·Ps·C", "Costo laboral control", calc.term_EpsC],
                      ["Q·V",   "Etiquetas código barras", calc.term_QV],
                      ["M·R",   "Pérdida por robo",       calc.term_MR],
                    ].map(([sym, desc, val]) => (
                      <tr key={sym} className="border-b border-red-100">
                        <td className="py-1.5 font-mono text-red-700 font-bold w-16">{sym}</td>
                        <td className="py-1.5 text-slate-600 flex-1">{desc}</td>
                        <td className="py-1.5 text-right font-semibold text-red-800">{fmtARS(val)}</td>
                      </tr>
                    ))}
                    <tr className="bg-red-100">
                      <td colSpan={2} className="py-2 font-bold text-red-800 text-sm">TOTAL COSTO ANTES</td>
                      <td className="py-2 text-right font-bold text-red-800 text-sm">{fmtARS(calc.costoAntes)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Desglose Ahora */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Desglose Costo Ahora (RFID)</p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      ["En·Q'·C",      "Costo laboral picking RFID",  calc.term_EnQtC],
                      ["En·(En/E)·C",  "Overhead proporcional staff", calc.term_EnRatC],
                      ["En·C·Pss",     "Costo laboral control RFID",  calc.term_EnCPss],
                      ["Q·N",          "Etiquetas RFID (tags)",       calc.term_QN],
                    ].map(([sym, desc, val]) => (
                      <tr key={sym} className="border-b border-blue-100">
                        <td className="py-1.5 font-mono text-blue-700 font-bold w-28">{sym}</td>
                        <td className="py-1.5 text-slate-600">{desc}</td>
                        <td className="py-1.5 text-right font-semibold text-blue-800">{fmtARS(val)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-100">
                      <td colSpan={2} className="py-2 font-bold text-blue-800 text-sm">TOTAL COSTO AHORA</td>
                      <td className="py-2 text-right font-bold text-blue-800 text-sm">{fmtARS(calc.costoAhora)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* KPIs finales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`rounded-xl p-5 text-center border ${calc.ahorro > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                <DollarSign className={`w-6 h-6 mx-auto mb-2 ${calc.ahorro > 0 ? "text-emerald-500" : "text-red-500"}`} />
                <p className="text-xs font-semibold text-slate-500 mb-1">Ahorro anual</p>
                <p className={`text-2xl font-bold ${calc.ahorro > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {fmtARS(calc.ahorro)}
                </p>
                <p className="text-xs text-slate-400 mt-1">COSTO_ANTES − COSTO_AHORA</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500 mb-1">Inversión inicial</p>
                <p className="text-2xl font-bold text-amber-700">{fmtARS(INV)}</p>
                <p className="text-xs text-slate-400 mt-1">hardware + software + tags</p>
              </div>
              <div className={`rounded-xl p-5 text-center border ${calc.payback !== null && calc.payback < 2 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${calc.payback !== null && calc.payback < 2 ? "text-emerald-500" : "text-slate-400"}`} />
                <p className="text-xs font-semibold text-slate-500 mb-1">Payback</p>
                <p className={`text-2xl font-bold ${calc.payback !== null && calc.payback < 2 ? "text-emerald-700" : "text-slate-600"}`}>
                  {calc.payback !== null ? `${fmtNum(calc.payback)} años` : "n/a"}
                </p>
                <p className="text-xs text-slate-400 mt-1">INV / Ahorro anual</p>
              </div>
            </div>

            {/* Leyenda de variables */}
            <div>
              <button
                onClick={() => setShowLeyenda(!showLeyenda)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
              >
                {showLeyenda ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Referencia completa de variables
              </button>
              {showLeyenda && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
                  {[
                    ["E",    "Empleados fábrica actuales (picking + guardar + control)"],
                    ["Pi",   "Horas/año dedicadas a picking por empleado"],
                    ["C",    "Costo hora empleado (ARS) — default $9.500"],
                    ["Pg",   "Horas/año dedicadas a guardar/ordenar por empleado"],
                    ["Ps",   "Horas/año dedicadas a control/conteo por empleado"],
                    ["Q",    "Cantidad total de artículos (SKUs) etiquetados"],
                    ["V",    "Precio unitario etiqueta código de barras (ARS)"],
                    ["M",    "Valor total del stock a costo (ARS)"],
                    ["R",    "Porcentaje de robo/shrinkage sobre stock (%)"],
                    ["En",   "Cantidad de empleados necesarios con RFID"],
                    ["Q'",   "Horas/año de picking por empleado con RFID (nuevo tiempo)"],
                    ["Pss",  "Horas/año de control por empleado con RFID (nuevo tiempo)"],
                    ["N",    "Precio unitario tag RFID (ARS)"],
                    ["INV",  "Inversión inicial total: hardware, software, tags, implantación"],
                  ].map(([sym, desc]) => (
                    <div key={sym} className="flex gap-2">
                      <span className="font-mono bg-white border border-slate-200 px-1.5 rounded text-slate-700 font-bold flex-shrink-0 h-fit">{sym}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
