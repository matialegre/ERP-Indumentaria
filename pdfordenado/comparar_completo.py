"""
Comparación completa: Dragonfish vs DATOS
Para la última venta de MeLi, muestra stock en ambas bases de datos
"""

import pyodbc
import sys

# Conexión a DATOS (nueva DB)
CONN_DATOS = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

# Conexión a Dragonfish (vieja DB) - NECESITO ESTOS DATOS
CONN_DRAGONFISH = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=???;"  # SERVIDOR DE DRAGONFISH
    "DATABASE=???;"  # BASE DE DATOS DE DRAGONFISH
    "UID=???;"  # USUARIO
    "PWD=???;"  # CONTRASEÑA
    "TrustServerCertificate=yes;"
)


def seller_to_barcode(seller_field):
    """Convierte SELLER_FIELD de MeLi a CODIGO_BARRA"""
    sf = seller_field.strip()
    parts = sf.split('-')
    
    if len(parts) == 3:
        base, color_code, talle_part = parts
        if talle_part.startswith('T') and talle_part[1:].isdigit():
            talle = talle_part[1:]
        else:
            talle = talle_part
        return base + color_code + talle
    elif len(parts) == 2:
        base, rest = parts
        if rest.startswith('T') and rest[1:].isdigit():
            return base + rest[1:]
        return base + rest
    else:
        return sf.replace('-', '')


print("=" * 100)
print("COMPARACIÓN DRAGONFISH vs DATOS - ÚLTIMA VENTA MERCADOLIBRE")
print("=" * 100)

# Conectar a DATOS
conn_datos = pyodbc.connect(CONN_DATOS, timeout=10)
cursor_datos = conn_datos.cursor()

# 1. Traer última venta de MeLi
print("\n[1] Obteniendo última venta de MercadoLibre...")
cursor_datos.execute("""
    SELECT TOP 1 ORDER_ID, DATE_CREATED, PRODUCT_NAME, SELLER_FIELD, CANTIDAD, LOCAL
    FROM VENTAS_MERCADOLIBRE
    ORDER BY DATE_CREATED DESC
""")

venta = cursor_datos.fetchone()
if not venta:
    print("❌ No se encontraron ventas")
    sys.exit(1)

order_id, fecha, producto, seller_field, cantidad, local_venta = venta
sku = (seller_field or '').strip()
barcode = seller_to_barcode(sku)

print(f"    ✅ Venta encontrada:")
print(f"       Orden: {order_id}")
print(f"       Fecha: {fecha}")
print(f"       Producto: {producto}")
print(f"       SKU MeLi: {sku}")
print(f"       Código Barra: {barcode}")
print(f"       Cantidad: {cantidad}")

# 2. Buscar en Dragonfish (NECESITO CONEXIÓN)
print(f"\n[2] Buscando en DRAGONFISH...")
print("    ⚠️  NECESITO DATOS DE CONEXIÓN A DRAGONFISH:")
print("       - Servidor")
print("       - Base de datos")
print("       - Usuario")
print("       - Contraseña")
print("\n    Por ahora, voy a mostrar solo los datos de DATOS (192.168.0.109:9970)")

# 3. Buscar en DATOS
print(f"\n[3] Buscando en DATOS (192.168.0.109:9970)...")
cursor_datos.execute("""
    SELECT RTRIM(CODIGO_BARRA), RTRIM(LOCAL), STOCK, RTRIM(DESCRIPCION)
    FROM STOCKS
    WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    ORDER BY LOCAL
""", barcode.upper())

stocks_datos = cursor_datos.fetchall()

if stocks_datos:
    print(f"    ✅ Encontrado en {len(stocks_datos)} locales\n")
    
    print(f"{'CODIGO_BARRA':<25} {'LOCAL':<20} {'STOCK':>6}  {'FUENTE'}")
    print("─" * 85)
    
    for cod, local, stock, desc in stocks_datos:
        fuente = "192.168.0.109:9970"
        print(f"{cod:<25} {local:<20} {stock:>6}  {fuente}")
    
    print(f"\n    📋 Descripción: {stocks_datos[0][3]}")
    
    total_stock = sum(max(s[2], 0) for s in stocks_datos)
    print(f"\n    📊 TOTAL STOCK EN DATOS: {total_stock} unidades")
else:
    print(f"    ❌ No encontrado en DATOS")

conn_datos.close()

print("\n" + "=" * 100)
print("⚠️  Para completar la comparación, necesito los datos de conexión a DRAGONFISH")
print("=" * 100)
