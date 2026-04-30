import { useState, useMemo } from "react";
import {
  Tag, Printer, Radio, Antenna, Cpu, Package, GraduationCap, Wrench,
  ExternalLink, Search, DollarSign, Filter, MapPin, Truck, Store,
  Building2, ShieldCheck, Smartphone, Warehouse, AlertTriangle,
} from "lucide-react";

/* ════════════════════════════════════════════════════════════════════ */
/*  PRESUPUESTO RFID — datos curados del mercado profesional            */
/*                                                                      */
/*  Aclaración: precios son referenciales (mercado USD oficial 2025-26).*/
/*  Antes de comprar, validar con el proveedor — varían fuerte por      */
/*  cantidad, importación y disponibilidad. Los links son búsquedas     */
/*  parametrizadas, no items específicos (los items se venden y         */
/*  rompen los links rápido).                                           */
/* ════════════════════════════════════════════════════════════════════ */

// USD → ARS (oficial dolar mayorista aprox abril 2026)
const USD_ARS = 1180;

const fmtUSD = (n) => `US$ ${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtARS = (n) => `$ ${Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

const ML_SEARCH = (q) => `https://listado.mercadolibre.com.ar/${encodeURIComponent(q).replace(/%20/g, "-")}`;
const AMZ_SEARCH = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
const GOOGLE_SHOPPING = (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`;
const GOOGLE_IMG = (q) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
const ATLAS_SEARCH = (q) => `https://www.atlasrfidstore.com/search?q=${encodeURIComponent(q)}`;
const RFID4U_SEARCH = (q) => `https://www.rfid4ustore.com/?s=${encodeURIComponent(q)}`;

/* ════════════════════════════════════════════════════════════════════ */
/*  CASOS DE USO                                                        */
/* ════════════════════════════════════════════════════════════════════ */
const CASOS = [
  { id: "local",      label: "Local minorista",     icon: Store,        color: "blue" },
  { id: "mayorista",  label: "Mayorista",            icon: Building2,    color: "indigo" },
  { id: "deposito",   label: "Depósito",             icon: Warehouse,    color: "amber" },
  { id: "camiones",   label: "Camiones / Logística", icon: Truck,        color: "orange" },
  { id: "portal",     label: "Portal de puerta",     icon: MapPin,       color: "purple" },
  { id: "handheld",   label: "Mobile / Handheld",    icon: Smartphone,   color: "pink" },
  { id: "antihurto",  label: "Anti-hurto / EAS",     icon: ShieldCheck,  color: "red" },
  { id: "capacitacion", label: "Capacitación",       icon: GraduationCap, color: "teal" },
];

const CATEGORIAS = [
  { id: "etiquetas",   label: "Etiquetas / Tags",  icon: Tag },
  { id: "impresoras",  label: "Impresoras",        icon: Printer },
  { id: "lectores",    label: "Lectores fijos",    icon: Radio },
  { id: "antenas",     label: "Antenas",           icon: Antenna },
  { id: "handhelds",   label: "Lectores móviles",  icon: Smartphone },
  { id: "software",    label: "Software",          icon: Cpu },
  { id: "accesorios",  label: "Accesorios",        icon: Wrench },
  { id: "capacitacion",label: "Capacitación",      icon: GraduationCap },
];

/* ════════════════════════════════════════════════════════════════════ */
/*  CATÁLOGO DE PRODUCTOS                                               */
/*  Cada item tiene: id, nombre, marca, modelo, categoria, specs,       */
/*  casos[] (en qué casos aplica), precio_usd, calidad (entry/mid/pro), */
/*  proveedores[] {nombre, link}                                        */
/* ════════════════════════════════════════════════════════════════════ */
const PRODUCTOS = [
  /* ─── ETIQUETAS / TAGS UHF ───────────────────────────────────── */
  {
    id: "tag-dogbone",
    nombre: "Smartrac DogBone (Impinj Monza R6)",
    marca: "Smartrac / Avery Dennison",
    modelo: "DogBone R6 / R6P",
    categoria: "etiquetas",
    casos: ["local", "mayorista", "deposito", "camiones", "antihurto"],
    calidad: "pro",
    precio_usd: 0.13,
    imagen: "https://www.atlasrfidstore.com/cdn/shop/products/Smartrac_DogBone_RFID_Wet_Inlay_Monza_R6.jpg",
    unidad: "por etiqueta (rollos 1000-5000u)",
    specs: [
      "UHF Gen2 902-928 MHz (Argentina/USA)",
      "Chip Impinj Monza R6 (96-bit EPC)",
      "Rango lectura: 8-12 metros",
      "Tamaño: 97 × 27 mm",
      "Mejor relación precio/performance del mercado",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("smartrac dogbone rfid uhf") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("dogbone monza") },
      { nombre: "Amazon", link: AMZ_SEARCH("smartrac dogbone uhf rfid") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("smartrac dogbone monza r6") },
    ],
  },
  {
    id: "tag-ad237",
    nombre: "Avery Dennison AD-237u8",
    marca: "Avery Dennison",
    modelo: "AD-237u8",
    categoria: "etiquetas",
    casos: ["local", "mayorista", "deposito"],
    calidad: "mid",
    precio_usd: 0.09,
    imagen: "https://rfid.averydennison.com/content/dam/averydennison/rfid/global/en/products/inlays-tags/uhf/ad-237u8/ad-237u8-product.png",
    unidad: "por etiqueta",
    specs: [
      "Wet inlay UHF Gen2",
      "Chip Impinj M730",
      "Tamaño: 50 × 30 mm",
      "Pensada para retail (ropa, accesorios)",
      "Lectura masiva en cajas",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("avery dennison ad-237") },
      { nombre: "MercadoLibre AR", link: ML_SEARCH("avery rfid uhf etiqueta") },
      { nombre: "Amazon", link: AMZ_SEARCH("avery dennison rfid uhf") },
    ],
  },
  {
    id: "tag-hangtag",
    nombre: "Hang tag RFID indumentaria (estilo RZ-1)",
    marca: "Avery / Smartrac / genérico",
    modelo: "Hang tag con loop",
    categoria: "etiquetas",
    casos: ["local", "mayorista"],
    calidad: "mid",
    precio_usd: 0.18,
    unidad: "por hang tag impreso",
    specs: [
      "Cartón con inlay RFID embebido",
      "Loop para colgar en prenda",
      "Personalizable con marca / código de barra impreso",
      "Ideal para retail de ropa (ej. uso típico Mundo Outdoor)",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("hang tag rfid ropa") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("rfid hang tag apparel") },
      { nombre: "Atlas RFID", link: ATLAS_SEARCH("apparel hang tag") },
    ],
  },
  {
    id: "tag-confidex-steel",
    nombre: "Confidex Steelwave Micro II",
    marca: "Confidex",
    modelo: "Steelwave Micro II",
    categoria: "etiquetas",
    casos: ["deposito", "camiones", "portal"],
    calidad: "pro",
    precio_usd: 1.80,
    imagen: "https://www.confidex.com/wp-content/uploads/2019/03/Steelwave_Micro_II.png",
    unidad: "por etiqueta",
    specs: [
      "Tag para superficies metálicas",
      "Resistente a temperatura -35°C / +85°C",
      "IP68 (sumergible)",
      "Rango: 4-7 metros sobre metal",
      "Tamaño: 38 × 13 × 3 mm",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("confidex steelwave") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("confidex steelwave micro ii") },
      { nombre: "RFID4U Store", link: RFID4U_SEARCH("confidex steelwave") },
    ],
  },
  {
    id: "tag-confidex-carrier",
    nombre: "Confidex Carrier Pro",
    marca: "Confidex",
    modelo: "Carrier Pro",
    categoria: "etiquetas",
    casos: ["camiones"],
    calidad: "pro",
    precio_usd: 4.50,
    unidad: "por etiqueta",
    specs: [
      "Tag para parabrisas de vehículos",
      "Adhesivo permanente con marca de seguridad",
      "Rango: 8-15 metros (lectura desde portal)",
      "Resistente a UV y temperatura extrema",
      "Ideal para control de flota / acceso vehicular",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("confidex carrier pro") },
      { nombre: "Amazon", link: AMZ_SEARCH("confidex carrier pro windshield") },
    ],
  },
  {
    id: "tag-xerafy-dot",
    nombre: "Xerafy Dot On Metal",
    marca: "Xerafy",
    modelo: "Dot On",
    categoria: "etiquetas",
    casos: ["deposito", "antihurto"],
    calidad: "pro",
    precio_usd: 2.20,
    unidad: "por etiqueta",
    specs: [
      "Mini tag metal-resistente",
      "Tamaño: 6.5 × 6.5 × 2 mm",
      "Para herramientas / activos pequeños",
      "Rango: 1-2 metros sobre metal",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("xerafy dot on") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("xerafy dot on metal tag") },
    ],
  },
  {
    id: "tag-hard-eas",
    nombre: "Hard tag RFID + EAS (anti-hurto)",
    marca: "Checkpoint / Sensormatic / Genérico",
    modelo: "Hard tag combo RF + RFID",
    categoria: "etiquetas",
    casos: ["antihurto", "local"],
    calidad: "mid",
    precio_usd: 0.65,
    unidad: "por tag re-utilizable",
    specs: [
      "Tag duro re-utilizable con pin",
      "Combina RFID UHF + EAS (anti-hurto)",
      "Se activa al sacarlo sin desactivar en caja",
      "Necesita pinza desactivadora en POS",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("hard tag rfid antihurto") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("rfid eas hard tag") },
      { nombre: "Atlas RFID", link: ATLAS_SEARCH("hard tag rfid") },
    ],
  },

  /* ─── IMPRESORAS ─────────────────────────────────────────────── */
  {
    id: "impr-zebra-zd420",
    nombre: "Zebra ZD420t RFID",
    marca: "Zebra",
    modelo: "ZD420t-RFID",
    categoria: "impresoras",
    casos: ["local", "mayorista"],
    calidad: "entry",
    precio_usd: 1500,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/printers/desktop/zd420/zd420-detail-rfid.jpg",
    unidad: "USD c/u",
    specs: [
      "Desktop, transferencia térmica",
      "203 dpi (versión 300 dpi disponible)",
      "Velocidad: 152 mm/s",
      "Codifica + imprime UHF Gen2",
      "Conectividad: USB / Ethernet / Wi-Fi",
      "Para volúmenes bajos-medios (< 5000/día)",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra zd420 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra ZD420t rfid") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra zd420") },
    ],
  },
  {
    id: "impr-zebra-zt411",
    nombre: "Zebra ZT411 RFID",
    marca: "Zebra",
    modelo: "ZT411-RFID",
    categoria: "impresoras",
    casos: ["mayorista", "deposito"],
    calidad: "pro",
    precio_usd: 3500,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/printers/industrial/zt411/zt411-photography-product-front-1-r.jpg",
    unidad: "USD c/u",
    specs: [
      "Industrial mid-range",
      "203 / 300 / 600 dpi",
      "Velocidad: 305 mm/s",
      "Codifica UHF Gen2 con ATR (Adaptive Antenna)",
      "Pantalla LCD color",
      "Para volúmenes altos (10k-50k/día)",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra zt411 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra zt411 rfid") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra zt411") },
    ],
  },
  {
    id: "impr-zebra-zt231",
    nombre: "Zebra ZT231 RFID",
    marca: "Zebra",
    modelo: "ZT231-RFID",
    categoria: "impresoras",
    casos: ["local", "mayorista"],
    calidad: "mid",
    precio_usd: 2200,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/printers/industrial/zt231/zt231-photography-product-3qrtr-1.jpg",
    unidad: "USD c/u",
    specs: [
      "Industrial entry-level",
      "203 / 300 dpi",
      "Velocidad: 203 mm/s",
      "Codifica UHF Gen2",
      "Reemplazo del ZT230 — puerto USB+Ethernet+Bluetooth",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra zt231 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra zt231 rfid") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("zebra zt231 rfid printer") },
    ],
  },
  {
    id: "impr-honeywell-pm45",
    nombre: "Honeywell PM45 RFID",
    marca: "Honeywell",
    modelo: "PM45-RFID",
    categoria: "impresoras",
    casos: ["mayorista", "deposito"],
    calidad: "pro",
    precio_usd: 3800,
    imagen: "https://sps.honeywell.com/content/dam/his-sandbox/products/printers/pm45/pm45-photography-product-3qrtr-1.png",
    unidad: "USD c/u",
    specs: [
      "Industrial high-volume",
      "203 / 300 / 600 dpi",
      "Velocidad: 300 mm/s",
      "Codifica UHF",
      "Pantalla touch color",
      "Diseñada para entornos industriales 24/7",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("honeywell pm45 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("honeywell pm45 rfid printer") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("honeywell pm45") },
    ],
  },
  {
    id: "impr-tsc-ml240",
    nombre: "TSC ML240P RFID",
    marca: "TSC",
    modelo: "ML240P-RFID",
    categoria: "impresoras",
    casos: ["local"],
    calidad: "entry",
    precio_usd: 950,
    unidad: "USD c/u",
    specs: [
      "Desktop budget",
      "203 dpi",
      "Velocidad: 152 mm/s",
      "Codifica UHF (modelo RFID)",
      "Buena para empezar / locales pequeños",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("tsc ml240 rfid") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("tsc ml240p rfid") },
    ],
  },

  /* ─── LECTORES FIJOS ─────────────────────────────────────────── */
  {
    id: "rdr-impinj-r700",
    nombre: "Impinj R700 (flagship)",
    marca: "Impinj",
    modelo: "R700",
    categoria: "lectores",
    casos: ["mayorista", "deposito", "portal", "antihurto"],
    calidad: "pro",
    precio_usd: 1800,
    imagen: "https://www.impinj.com/hubfs/r700-reader.png",
    unidad: "USD c/u",
    specs: [
      "4 puertos de antena monoestáticos",
      "Soporta IoT (apps en el lector)",
      "PoE+ / Ethernet",
      "Throughput: 1100 lecturas/seg",
      "API REST + MQTT nativo",
      "Sucesor del Speedway R420",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("impinj r700") },
      { nombre: "MercadoLibre AR", link: ML_SEARCH("impinj r700 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("impinj r700 reader") },
    ],
  },
  {
    id: "rdr-impinj-r420",
    nombre: "Impinj Speedway R420",
    marca: "Impinj",
    modelo: "Speedway Revolution R420",
    categoria: "lectores",
    casos: ["mayorista", "deposito", "portal"],
    calidad: "pro",
    precio_usd: 1300,
    imagen: "https://www.atlasrfidstore.com/cdn/shop/products/impinj-speedway-r420-rfid-reader_1024x1024.png",
    unidad: "USD c/u (modelo anterior, mucho stock)",
    specs: [
      "4 puertos de antena",
      "Generación anterior al R700",
      "Más económico, muy probado en producción",
      "PoE+ / Ethernet",
      "Throughput: 750 lecturas/seg",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("impinj speedway r420") },
      { nombre: "MercadoLibre AR", link: ML_SEARCH("impinj r420 speedway") },
      { nombre: "Amazon", link: AMZ_SEARCH("impinj r420") },
    ],
  },
  {
    id: "rdr-zebra-fx9600",
    nombre: "Zebra FX9600",
    marca: "Zebra",
    modelo: "FX9600",
    categoria: "lectores",
    casos: ["deposito", "camiones", "portal"],
    calidad: "pro",
    precio_usd: 2000,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/rfid/rfid-readers/fx9600/fx9600-photography-product-3qtr-1.jpg",
    unidad: "USD c/u",
    specs: [
      "4 u 8 puertos de antena",
      "Versión rugged industrial (IP53)",
      "Diseñado para depósitos / dock doors",
      "PoE+ + 802.11 Wi-Fi opcional",
      "Cabezal removible para servicio",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra fx9600") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra fx9600 rfid reader") },
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra fx9600") },
    ],
  },
  {
    id: "rdr-zebra-fx7500",
    nombre: "Zebra FX7500",
    marca: "Zebra",
    modelo: "FX7500",
    categoria: "lectores",
    casos: ["local", "mayorista", "antihurto"],
    calidad: "mid",
    precio_usd: 1200,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/rfid/rfid-readers/fx7500/fx7500-photography-product-3qtr-1.jpg",
    unidad: "USD c/u",
    specs: [
      "2 o 4 puertos de antena",
      "Indoor (no rugged)",
      "Diseñado para retail / smart shelf",
      "PoE / Ethernet",
      "Compacto",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra fx7500") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra fx7500") },
    ],
  },
  {
    id: "rdr-alien-f800",
    nombre: "Alien ALR-F800",
    marca: "Alien Technology",
    modelo: "ALR-F800",
    categoria: "lectores",
    casos: ["mayorista", "portal"],
    calidad: "pro",
    precio_usd: 1400,
    unidad: "USD c/u",
    specs: [
      "4 puertos de antena monoestáticos",
      "Throughput alto (~700 reads/seg)",
      "PoE / Ethernet",
      "Compatibilidad con tags de gen anterior (Higgs)",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("alien alr-f800") },
      { nombre: "Amazon", link: AMZ_SEARCH("alien alr-f800") },
    ],
  },

  /* ─── ANTENAS ────────────────────────────────────────────────── */
  {
    id: "ant-times7-a6055",
    nombre: "Times-7 A6055 Slimline",
    marca: "Times-7",
    modelo: "A6055",
    categoria: "antenas",
    casos: ["local", "mayorista", "portal"],
    calidad: "pro",
    precio_usd: 320,
    imagen: "https://www.atlasrfidstore.com/cdn/shop/products/times-7-a6055-circular-polarized-rfid-antenna_1024x1024.png",
    unidad: "USD c/u",
    specs: [
      "Slim profile (ideal para puertas / smart shelf)",
      "Polarización circular",
      "Ganancia: 5.5 dBic",
      "Tamaño: 250 × 250 × 12 mm",
      "Plug-and-play con readers Impinj/Zebra",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("times-7 a6055") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("times-7 a6055 antenna") },
    ],
  },
  {
    id: "ant-times7-a1090",
    nombre: "Times-7 A1090",
    marca: "Times-7",
    modelo: "A1090",
    categoria: "antenas",
    casos: ["portal"],
    calidad: "pro",
    precio_usd: 380,
    unidad: "USD c/u",
    specs: [
      "Diseñada para portal / dock door angosto",
      "Polarización circular",
      "Ganancia: 8.5 dBic (más rango que A6055)",
      "Material rígido para industria",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("times-7 a1090") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("times-7 a1090 portal antenna") },
    ],
  },
  {
    id: "ant-laird-s9028",
    nombre: "Laird S9028PCRJ",
    marca: "Laird Connectivity",
    modelo: "S9028PCRJ",
    categoria: "antenas",
    casos: ["mayorista", "deposito", "portal"],
    calidad: "mid",
    precio_usd: 240,
    imagen: "https://www.atlasrfidstore.com/cdn/shop/products/laird-s9028pcrj-circular-polarized-rfid-antenna_1024x1024.png",
    unidad: "USD c/u",
    specs: [
      "Patch antenna estándar",
      "Polarización circular",
      "Ganancia: 8 dBic",
      "Tamaño: 260 × 260 × 33 mm",
      "El estándar de facto para installs RFID",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("laird s9028") },
      { nombre: "Amazon", link: AMZ_SEARCH("laird s9028pcrj rfid") },
      { nombre: "MercadoLibre AR", link: ML_SEARCH("laird s9028 antena rfid") },
    ],
  },
  {
    id: "ant-mti-overhead",
    nombre: "MTI MT-263013 Overhead",
    marca: "MTI Wireless",
    modelo: "MT-263013",
    categoria: "antenas",
    casos: ["deposito", "portal"],
    calidad: "mid",
    precio_usd: 200,
    unidad: "USD c/u",
    specs: [
      "Antena overhead (techo)",
      "Pensada para zonas amplias de lectura",
      "Polarización circular",
      "Ganancia: 5 dBic",
    ],
    proveedores: [
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("mti mt-263013 overhead antenna") },
      { nombre: "Atlas RFID", link: ATLAS_SEARCH("overhead antenna") },
    ],
  },

  /* ─── HANDHELDS / MOBILE ─────────────────────────────────────── */
  {
    id: "hh-zebra-mc3300",
    nombre: "Zebra MC3300xR Pistola",
    marca: "Zebra",
    modelo: "MC3300xR",
    categoria: "handhelds",
    casos: ["handheld", "deposito", "mayorista"],
    calidad: "pro",
    precio_usd: 2500,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/mobile-computers/handheld/mc3300x/mc3300x-photography-product-3qrtr-1.jpg",
    unidad: "USD c/u",
    specs: [
      "Form factor pistola con gatillo",
      "Android 10+",
      "Lector RFID UHF integrado + escáner 1D/2D",
      "Rango RFID: 4-7 metros",
      "Batería 7000 mAh (turno completo)",
      "IP54",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra mc3300 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra mc3300xr") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra mc3300") },
    ],
  },
  {
    id: "hh-zebra-rfd90",
    nombre: "Zebra RFD90 (sled)",
    marca: "Zebra",
    modelo: "RFD90",
    categoria: "handhelds",
    casos: ["handheld", "local", "deposito"],
    calidad: "pro",
    precio_usd: 2000,
    imagen: "https://www.zebra.com/content/dam/zebra_new_ia/en-us/products-services/rfid/rfid-handheld/rfd90/rfd90-photography-product-front-1.jpg",
    unidad: "USD c/u (sin smartphone)",
    specs: [
      "Sled — se conecta a un smartphone Android (TC22, etc)",
      "Rango: 8-10 metros",
      "Bluetooth o cable USB-C",
      "Batería intercambiable",
      "Más barato que un MC3300 dedicado, mejor UX moderna",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("zebra rfd90") },
      { nombre: "Amazon", link: AMZ_SEARCH("zebra rfd90 rfid sled") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("zebra rfd90") },
    ],
  },
  {
    id: "hh-honeywell-ih40",
    nombre: "Honeywell IH40 RFID",
    marca: "Honeywell",
    modelo: "IH40",
    categoria: "handhelds",
    casos: ["handheld", "deposito", "mayorista"],
    calidad: "pro",
    precio_usd: 2200,
    imagen: "https://sps.honeywell.com/content/dam/his-sandbox/products/rfid/handheld-readers/ih40/ih40-photography-product-3qrtr-1.png",
    unidad: "USD c/u",
    specs: [
      "Pistola Android con lector UHF integrado",
      "Pantalla 5\" táctil",
      "Rango RFID: 6-10 metros",
      "Escáner 2D imager",
      "IP54, drop-resistant 1.5m",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("honeywell ih40 rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("honeywell ih40 rfid") },
    ],
  },
  {
    id: "hh-cipherlab-rk25",
    nombre: "CipherLab RK25 RFID",
    marca: "CipherLab",
    modelo: "RK25 RFID",
    categoria: "handhelds",
    casos: ["handheld", "local"],
    calidad: "entry",
    precio_usd: 1500,
    unidad: "USD c/u",
    specs: [
      "Pistola Android entry-level",
      "Mucho más barata que Zebra/Honeywell",
      "Rango: 4-6 metros",
      "Buena para inventarios de local",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("cipherlab rk25 rfid") },
      { nombre: "Google Shopping", link: GOOGLE_SHOPPING("cipherlab rk25 rfid") },
    ],
  },
  {
    id: "hh-tsl-1128",
    nombre: "TSL 1128 Bluetooth Sled",
    marca: "Technology Solutions UK (TSL)",
    modelo: "1128",
    categoria: "handhelds",
    casos: ["handheld", "local", "deposito"],
    calidad: "mid",
    precio_usd: 1800,
    imagen: "https://www.atlasrfidstore.com/cdn/shop/products/TSL-1128-Bluetooth-UHF-RFID-Reader_1024x1024.png",
    unidad: "USD c/u (sin smartphone)",
    specs: [
      "Sled Bluetooth para iPhone/Android",
      "Rango: 6-8 metros",
      "Form factor compacto (tipo pistolita)",
      "App propia + SDK",
    ],
    proveedores: [
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("tsl 1128") },
      { nombre: "Amazon", link: AMZ_SEARCH("tsl 1128 bluetooth rfid") },
    ],
  },

  /* ─── SOFTWARE ───────────────────────────────────────────────── */
  {
    id: "sw-impinj-itemsense",
    nombre: "Impinj ItemSense (cloud)",
    marca: "Impinj",
    modelo: "ItemSense",
    categoria: "software",
    casos: ["mayorista", "deposito", "portal"],
    calidad: "pro",
    precio_usd: 200,
    unidad: "USD/mes (varía por escala)",
    specs: [
      "Plataforma oficial de Impinj",
      "Localiza items en tiempo real (room/zone)",
      "API REST + WebSocket",
      "Integra con readers Impinj y de terceros",
      "Cloud o on-prem",
    ],
    proveedores: [
      { nombre: "Sitio oficial", link: "https://www.impinj.com/products/software" },
    ],
  },
  {
    id: "sw-tagmatiks",
    nombre: "TagMatiks Cloud",
    marca: "TagMatiks (RFID4U)",
    modelo: "TagMatiks Cloud Suite",
    categoria: "software",
    casos: ["local", "mayorista", "deposito"],
    calidad: "mid",
    precio_usd: 150,
    unidad: "USD/mes (por usuario)",
    specs: [
      "Suite cloud RFID lista para usar",
      "Inventario, asset tracking, recepción, despacho",
      "App móvil incluida",
      "Mucho más rápido de implementar que ItemSense",
    ],
    proveedores: [
      { nombre: "Sitio oficial", link: "https://tagmatiks.com" },
      { nombre: "RFID4U", link: "https://rfid4u.com" },
    ],
  },
  {
    id: "sw-sensitech",
    nombre: "Sensitech / SAP RFID Connector",
    marca: "Sensitech / SAP",
    modelo: "EPCIS Connector",
    categoria: "software",
    casos: ["mayorista", "camiones"],
    calidad: "pro",
    precio_usd: 0,
    unidad: "Cotización (proyecto)",
    specs: [
      "Para integraciones empresariales con SAP/Oracle",
      "Estándar EPCIS (GS1)",
      "Trazabilidad fina (cadena de frío, logística)",
      "Implementación con consultora — no plug-and-play",
    ],
    proveedores: [
      { nombre: "Sitio oficial", link: "https://www.sensitech.com" },
    ],
  },
  {
    id: "sw-scanvenger",
    nombre: "Scanvenger Studio (gratis)",
    marca: "Scanvenger",
    modelo: "Studio",
    categoria: "software",
    casos: ["local"],
    calidad: "entry",
    precio_usd: 0,
    unidad: "Gratis (versión basic)",
    specs: [
      "App Windows/Android gratis",
      "Inventarios simples con readers Zebra/Impinj/CipherLab",
      "Para empezar / pruebas / locales chicos",
      "No tiene escala empresarial",
    ],
    proveedores: [
      { nombre: "Sitio oficial", link: "https://www.scanvenger.com" },
    ],
  },

  /* ─── ACCESORIOS ─────────────────────────────────────────────── */
  {
    id: "acc-cable-lmr400",
    nombre: "Cable coaxial LMR-400 (1m a 6m)",
    marca: "Times Microwave / genérico",
    modelo: "LMR-400 con conectores TNC/RP-TNC",
    categoria: "accesorios",
    casos: ["local", "mayorista", "deposito", "portal", "camiones"],
    calidad: "mid",
    precio_usd: 35,
    unidad: "USD por metro (con conectores)",
    specs: [
      "Cable necesario entre reader y antena",
      "Bajísima pérdida (0.7 dB / 3m)",
      "Conectores: TNC macho ↔ RP-TNC macho (verificar reader/antena)",
      "Largos típicos: 1, 3, 6 metros",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("cable lmr-400 tnc rfid") },
      { nombre: "Amazon", link: AMZ_SEARCH("LMR-400 tnc rfid cable") },
      { nombre: "Atlas RFID Store", link: ATLAS_SEARCH("lmr-400") },
    ],
  },
  {
    id: "acc-portal-frame",
    nombre: "Estructura portal RFID (puerta de paso)",
    marca: "Genérico / Custom",
    modelo: "Portal frame — perfil aluminio",
    categoria: "accesorios",
    casos: ["portal", "antihurto"],
    calidad: "mid",
    precio_usd: 600,
    unidad: "USD c/u (estructura sola, sin antenas/reader)",
    specs: [
      "Estructura tipo arco para puerta de salida",
      "Aloja 2-4 antenas + reader",
      "Generalmente fabricado a medida en Argentina (más barato)",
      "Pedir cotización local antes de importar",
    ],
    proveedores: [
      { nombre: "MercadoLibre AR", link: ML_SEARCH("portal antihurto puerta rfid") },
      { nombre: "Buscar en Google AR", link: "https://www.google.com/search?q=portal+rfid+argentina+fabricaci%C3%B3n" },
    ],
  },
  {
    id: "acc-tagformance",
    nombre: "Voyantic Tagformance Pro (lab tester)",
    marca: "Voyantic",
    modelo: "Tagformance Pro",
    categoria: "accesorios",
    casos: ["mayorista"],
    calidad: "pro",
    precio_usd: 25000,
    unidad: "USD c/u (equipo de laboratorio)",
    specs: [
      "Equipo profesional para testear y caracterizar etiquetas",
      "Mide sensitividad, retorno, pattern de antena",
      "Solo si fabricás/integrás a gran escala",
      "Caro — generalmente se contrata como servicio",
    ],
    proveedores: [
      { nombre: "Sitio oficial", link: "https://voyantic.com/products/tagformance-pro/" },
    ],
  },

  /* ─── CAPACITACIÓN ──────────────────────────────────────────── */
  {
    id: "cap-comptia-rfid",
    nombre: "CompTIA RFID+ (curso + certificación)",
    marca: "CompTIA",
    modelo: "RFID+ Certification",
    categoria: "capacitacion",
    casos: ["capacitacion"],
    calidad: "pro",
    precio_usd: 500,
    unidad: "USD por persona (curso online + examen)",
    specs: [
      "Certificación reconocida internacionalmente",
      "Cubre fundamentos de RFID, instalación, troubleshooting",
      "Examen online tipo multiple-choice",
      "Vigencia: 3 años",
    ],
    proveedores: [
      { nombre: "Sitio CompTIA", link: "https://www.comptia.org/training/by-certification/rfid" },
    ],
  },
  {
    id: "cap-atlas-academy",
    nombre: "Atlas RFID Academy (cursos online)",
    marca: "Atlas RFID Store",
    modelo: "Academy",
    categoria: "capacitacion",
    casos: ["capacitacion"],
    calidad: "mid",
    precio_usd: 200,
    unidad: "USD por curso",
    specs: [
      "Cursos online cortos (4-8 hs)",
      "Temas: básico, retail, asset tracking, vehículos",
      "Inglés con material práctico",
      "Buena puerta de entrada para equipos técnicos",
    ],
    proveedores: [
      { nombre: "Atlas RFID Academy", link: "https://www.atlasrfidstore.com/atlas-academy/" },
    ],
  },
  {
    id: "cap-gs1-arg",
    nombre: "GS1 Argentina — Cursos RFID/EPCIS",
    marca: "GS1 Argentina",
    modelo: "Cursos in-company / abiertos",
    categoria: "capacitacion",
    casos: ["capacitacion"],
    calidad: "mid",
    precio_usd: 350,
    unidad: "USD por persona (varía)",
    specs: [
      "Capacitación en estándares GS1 (EPC, codificación, EPCIS)",
      "Disponible en Buenos Aires + virtual",
      "Habla castellano — más fácil para equipos locales",
      "Útil si trabajás con grandes cadenas (Cencosud, Carrefour, etc.)",
    ],
    proveedores: [
      { nombre: "Sitio GS1 AR", link: "https://www.gs1.org.ar/capacitaciones" },
    ],
  },
  {
    id: "cap-incompany",
    nombre: "Capacitación in-company custom",
    marca: "Integradores RFID locales",
    modelo: "On-site / virtual personalizado",
    categoria: "capacitacion",
    casos: ["capacitacion"],
    calidad: "mid",
    precio_usd: 1500,
    unidad: "USD por jornada (varía)",
    specs: [
      "Charla técnica + práctica en tu local/depósito",
      "Operación de impresora, lector, app",
      "Solución de problemas comunes",
      "Mejor antes del go-live para que el equipo no se pierda",
    ],
    proveedores: [
      { nombre: "Integradores AR", link: "https://www.google.com/search?q=integrador+rfid+argentina" },
    ],
  },
];

/* ════════════════════════════════════════════════════════════════════ */
/*  COMPONENTE PRINCIPAL                                                */
/* ════════════════════════════════════════════════════════════════════ */
export default function RFIDPresupuesto() {
  const [casoActivo, setCasoActivo] = useState("local");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroCalidad, setFiltroCalidad] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [moneda, setMoneda] = useState("USD"); // USD o ARS

  const productosFiltrados = useMemo(() => {
    return PRODUCTOS.filter((p) => {
      if (!p.casos.includes(casoActivo)) return false;
      if (filtroCategoria && p.categoria !== filtroCategoria) return false;
      if (filtroCalidad && p.calidad !== filtroCalidad) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const text = `${p.nombre} ${p.marca} ${p.modelo} ${p.specs.join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [casoActivo, filtroCategoria, filtroCalidad, busqueda]);

  // Agrupar por categoría
  const porCategoria = useMemo(() => {
    const map = new Map();
    productosFiltrados.forEach((p) => {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria).push(p);
    });
    return map;
  }, [productosFiltrados]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Presupuesto RFID — catálogo curado
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Productos profesionales del mercado RFID por caso de uso. Precios referenciales en USD oficial 2025-26 — validá con el proveedor antes de comprar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMoneda(moneda === "USD" ? "ARS" : "USD")}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium"
            >
              Mostrar en {moneda === "USD" ? "ARS (≈ $" + USD_ARS.toLocaleString("es-AR") + "/USD)" : "USD"}
            </button>
          </div>
        </div>

        {/* Tabs casos de uso */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CASOS.map((c) => {
            const Icon = c.icon;
            const active = casoActivo === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCasoActivo(c.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
                  active
                    ? `bg-${c.color}-600 text-white border-${c.color}-700`
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
                style={active ? { backgroundColor: COLOR_BG[c.color], borderColor: COLOR_BORDER[c.color], color: "white" } : {}}
              >
                <Icon className="w-4 h-4" />
                {c.label}
                <span className="text-[10px] opacity-80">
                  ({PRODUCTOS.filter((p) => p.casos.includes(c.id)).length})
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <select
            value={filtroCalidad}
            onChange={(e) => setFiltroCalidad(e.target.value)}
            className="text-sm border border-gray-200 rounded px-2 py-1"
          >
            <option value="">Toda calidad</option>
            <option value="entry">Entry / Budget</option>
            <option value="mid">Mid-range</option>
            <option value="pro">Pro / Industrial</option>
          </select>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar marca, modelo, spec…"
            className="text-sm border border-gray-200 rounded px-2 py-1 flex-1 min-w-[180px]"
          />
          {(filtroCategoria || filtroCalidad || busqueda) && (
            <button
              onClick={() => { setFiltroCategoria(""); setFiltroCalidad(""); setBusqueda(""); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {productosFiltrados.length} productos
          </span>
        </div>
      </div>

      {/* Resumen presupuesto del caso activo */}
      <ResumenCaso productos={productosFiltrados} moneda={moneda} caso={casoActivo} />

      {/* Cards por categoría */}
      {productosFiltrados.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Sin productos para los filtros seleccionados.
        </div>
      )}
      {Array.from(porCategoria.entries()).map(([catId, items]) => {
        const cat = CATEGORIAS.find((c) => c.id === catId);
        const Icon = cat?.icon || Package;
        return (
          <div key={catId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center gap-2">
              <Icon className="w-4 h-4 text-gray-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                {cat?.label || catId}
              </h2>
              <span className="text-xs text-gray-400 ml-auto">{items.length} {items.length === 1 ? "producto" : "productos"}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
              {items.map((p) => (
                <ProductoCard key={p.id} producto={p} moneda={moneda} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Aclaración importante:</b> los precios son referenciales del mercado USD oficial.
          En Argentina sumar impuestos de importación (~50-65%), envío internacional, despachante,
          y costo de instalación / integración. Pedir cotización a un integrador RFID local
          (Buenos Aires) antes de importar — muchas veces el costo total es similar al
          comprar fabricado/distribuido localmente.
        </div>
      </div>
    </div>
  );
}

const COLOR_BG = {
  blue: "#2563eb", indigo: "#4f46e5", amber: "#d97706", orange: "#ea580c",
  purple: "#9333ea", pink: "#db2777", red: "#dc2626", teal: "#0d9488",
};
const COLOR_BORDER = {
  blue: "#1d4ed8", indigo: "#4338ca", amber: "#b45309", orange: "#c2410c",
  purple: "#7e22ce", pink: "#be185d", red: "#b91c1c", teal: "#0f766e",
};

/* ─── Resumen presupuesto del caso activo ─── */
function ResumenCaso({ productos, moneda, caso }) {
  const stats = useMemo(() => {
    const byCat = {};
    productos.forEach((p) => {
      if (!byCat[p.categoria]) byCat[p.categoria] = { count: 0, min: Infinity, max: -Infinity };
      byCat[p.categoria].count++;
      const price = p.precio_usd || 0;
      if (price > 0) {
        byCat[p.categoria].min = Math.min(byCat[p.categoria].min, price);
        byCat[p.categoria].max = Math.max(byCat[p.categoria].max, price);
      }
    });
    return byCat;
  }, [productos]);

  if (productos.length === 0) return null;

  const fmt = (n) => moneda === "USD" ? fmtUSD(n) : fmtARS(n * USD_ARS);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <div className="text-xs font-bold text-gray-700 uppercase mb-2">
        Rango de presupuesto — {CASOS.find((c) => c.id === caso)?.label}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {Object.entries(stats).map(([catId, s]) => {
          const cat = CATEGORIAS.find((c) => c.id === catId);
          const Icon = cat?.icon || Package;
          return (
            <div key={catId} className="px-2 py-1.5 bg-gray-50 rounded">
              <div className="text-[10px] uppercase text-gray-500 flex items-center gap-1">
                <Icon className="w-3 h-3" />
                {cat?.label || catId}
              </div>
              <div className="text-xs font-bold text-gray-900">
                {s.min === Infinity ? "Cotizar" : `${fmt(s.min)}${s.min !== s.max ? " – " + fmt(s.max) : ""}`}
              </div>
              <div className="text-[10px] text-gray-400">{s.count} opc.</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Card de producto ─── */
function ProductoCard({ producto, moneda }) {
  const [imgFailed, setImgFailed] = useState(false);
  const calidadCls =
    producto.calidad === "pro" ? "bg-purple-100 text-purple-700"
    : producto.calidad === "mid" ? "bg-blue-100 text-blue-700"
    : "bg-green-100 text-green-700";
  const calidadLabel =
    producto.calidad === "pro" ? "Pro / Industrial"
    : producto.calidad === "mid" ? "Mid-range"
    : "Entry";

  // Determinar cómo mostrar el precio
  const unidadLow = (producto.unidad || "").toLowerCase();
  const esGratis = producto.precio_usd === 0 && unidadLow.includes("gratis");
  const esCotizar = producto.precio_usd === 0 || unidadLow.includes("cotiz");
  let precioDisplay;
  let precioCls = "text-emerald-700";
  if (esGratis) {
    precioDisplay = "GRATIS";
    precioCls = "text-green-700";
  } else if (esCotizar) {
    precioDisplay = "Cotizar";
    precioCls = "text-blue-600";
  } else {
    precioDisplay = moneda === "USD"
      ? fmtUSD(producto.precio_usd)
      : fmtARS(producto.precio_usd * USD_ARS);
  }

  // Imagen via Google Images (preview link)
  const imgQuery = `${producto.marca} ${producto.modelo}`;
  const tieneImagen = producto.imagen && !imgFailed;

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition bg-white">
      <div className="flex items-start gap-3">
        <a
          href={GOOGLE_IMG(imgQuery)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 w-24 h-24 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-200 overflow-hidden"
          title="Ver más imágenes en Google"
        >
          {tieneImagen ? (
            <img
              src={producto.imagen}
              alt={producto.nombre}
              className="w-full h-full object-contain p-1"
              onError={() => setImgFailed(true)}
              loading="lazy"
            />
          ) : (
            <Package className="w-8 h-8" />
          )}
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate" title={producto.nombre}>
                {producto.nombre}
              </div>
              <div className="text-xs text-gray-500">
                {producto.marca} · <span className="font-mono">{producto.modelo}</span>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${calidadCls} whitespace-nowrap`}>
              {calidadLabel}
            </span>
          </div>
          <div className={`mt-1.5 text-base font-bold ${precioCls}`}>
            {precioDisplay}
            <span className="text-[10px] text-gray-400 font-normal ml-1">{producto.unidad}</span>
          </div>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5">
        {producto.specs.map((s, i) => (
          <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
            <span className="text-gray-400 shrink-0">•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
        {producto.proveedores.map((prov, i) => (
          <a
            key={i}
            href={prov.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            {prov.nombre}
          </a>
        ))}
      </div>
    </div>
  );
}
