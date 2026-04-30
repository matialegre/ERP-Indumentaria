"""
Consulta de Stock por Local - Últimas Ventas de MercadoLibre
Mundo Outdoor

Conecta a la base de datos DATOS, trae las últimas N ventas de MeLi,
y para cada una busca el stock en todos los locales.

SOLO LECTURA - No modifica ningún dato.
"""

import pyodbc
import sys
from datetime import datetime

# ─── Configuración de conexión ───
CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

# Locales conocidos (los que importan)
LOCALES_PRINCIPALES = [
    'MTGCBA', 'MONBAHIA', 'NQNSHOP', 'MUNDOAL', 'DEPOSITO',
    'MTGMDQ', 'MTGROCA', 'NQNALB', 'MTGJBJ', 'MUNDOBBPS',
    'MUNDOROCA', 'MTGBBPS', 'MTGCOM'
]


def seller_to_barcode(seller_field):
    """Convierte SELLER_FIELD de MeLi a CODIGO_BARRA de la DB.
    
    Ejemplo: NPGRB6EBUD-AH1-46 -> NPGRB6EBUDAH146
             NMIDKUDJUA-TB0-T39 -> NMIDKUDJUATB039
             IGDO1P1SCT-TV0-ST  -> IGDO1P1SCTTV0ST
    """
    sf = seller_field.strip()
    parts = sf.split('-')
    
    if len(parts) == 3:
        base = parts[0]
        color_code = parts[1]
        talle_part = parts[2]
        
        # Quitar la T del talle si es T + número (T39 -> 39)
        if talle_part.startswith('T') and talle_part[1:].isdigit():
            talle = talle_part[1:]
        else:
            talle = talle_part
        
        return base + color_code + talle
    elif len(parts) == 2:
        base = parts[0]
        rest = parts[1]
        if rest.startswith('T') and rest[1:].isdigit():
            return base + rest[1:]
        return base + rest
    else:
        return sf.replace('-', '')


def get_stock_por_local(cursor, codigo_barra):
    """Busca stock en todos los locales para un código de barra.
    Retorna dict {local: stock} solo para locales principales."""
    
    cursor.execute("""
        SELECT RTRIM(LOCAL), STOCK 
        FROM STOCKS 
        WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    """, codigo_barra.upper())
    
    rows = cursor.fetchall()
    stock_dict = {}
    for local, stock in rows:
        local_clean = local.strip() if local else ''
        if local_clean in LOCALES_PRINCIPALES:
            stock_dict[local_clean] = int(stock) if stock else 0
    
    return stock_dict


def get_info_articulo(cursor, codigo_barra):
    """Busca info del artículo en ARTICULOS por código de barra."""
    
    cursor.execute("""
        SELECT RTRIM(COLOR_DESCRIPCION), RTRIM(TALLE_DESCRIPCION), 
               RTRIM(CODIGO_ARTICULO), RTRIM(DESCRIPCION)
        FROM ARTICULOS WHERE UPPER(RTRIM(CODIGO_BARRAS)) = ?
    """, codigo_barra.upper())
    
    row = cursor.fetchone()
    if row:
        return {
            'color': row[0],
            'talle': row[1],
            'codigo_articulo': row[2],
            'descripcion': row[3]
        }
    return None


def get_info_desde_stocks(cursor, codigo_barra):
    """Si no está en ARTICULOS, intenta sacar la descripción de STOCKS."""
    
    cursor.execute("""
        SELECT TOP 1 RTRIM(DESCRIPCION), RTRIM(CODIGO_ARTICULO), 
               RTRIM(CODIGO_COLOR), RTRIM(CODIGO_TALLE)
        FROM STOCKS 
        WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    """, codigo_barra.upper())
    
    row = cursor.fetchone()
    if row:
        return {
            'descripcion': row[0],
            'codigo_articulo': row[1],
            'color': row[2],
            'talle': row[3]
        }
    return None


def consultar_ultimas_ventas(n_ventas=5):
    """Consulta las últimas N ventas de MeLi y muestra stock por local."""
    
    print("=" * 110)
    print(f"  STOCK POR LOCAL - ÚLTIMAS {n_ventas} VENTAS DE MERCADOLIBRE")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 110)
    
    try:
        conn = pyodbc.connect(CONN_STR, timeout=10)
        cursor = conn.cursor()
    except pyodbc.Error as e:
        print(f"\n❌ Error de conexión a la base de datos: {e}")
        print("   Verificar que el servidor 192.168.0.109:9970 esté accesible.")
        return
    
    # Traer últimas N ventas
    cursor.execute(f"""
        SELECT TOP {n_ventas} ORDER_ID, DATE_CREATED, PRODUCT_NAME, 
               SELLER_FIELD, CANTIDAD, LOCAL, TOTAL_AMOUNT, STATUS
        FROM VENTAS_MERCADOLIBRE 
        ORDER BY DATE_CREATED DESC
    """)
    ventas = cursor.fetchall()
    
    if not ventas:
        print("\n⚠️ No se encontraron ventas en VENTAS_MERCADOLIBRE")
        conn.close()
        return
    
    print(f"\n✅ {len(ventas)} ventas encontradas\n")
    
    for idx, v in enumerate(ventas, 1):
        order_id, fecha, producto, seller_field, cantidad, local_venta, monto, status = v
        sf = (seller_field or '').strip()
        barcode = seller_to_barcode(sf)
        
        print(f"{'━'*110}")
        print(f"  [{idx}] {producto}")
        print(f"      Fecha: {fecha} | Orden: {order_id} | Monto: ${monto:,.2f}")
        print(f"      SKU MeLi: {sf} → Código Barra: {barcode}")
        print(f"      Cantidad vendida: {cantidad} | Canal: {local_venta} | Estado: {status}")
        
        # Buscar info del artículo
        info = get_info_articulo(cursor, barcode)
        if info:
            print(f"      📋 {info['descripcion']} | Color: {info['color']} | Talle: {info['talle']}")
        else:
            info = get_info_desde_stocks(cursor, barcode)
            if info:
                print(f"      📋 {info['descripcion']} | Color: {info['color']} | Talle: {info['talle']}")
        
        # Buscar stock
        stock = get_stock_por_local(cursor, barcode)
        
        if stock:
            print(f"\n      {'LOCAL':<18} {'STOCK':>6}")
            print(f"      {'─'*26}")
            
            total_stock = 0
            for local in LOCALES_PRINCIPALES:
                if local in stock:
                    s = stock[local]
                    total_stock += max(s, 0)
                    icon = "🟢" if s > 0 else "🔴" if s == 0 else "⚠️"
                    print(f"      {icon} {local:<16} {s:>5}")
            
            print(f"      {'─'*26}")
            print(f"      {'TOTAL DISPONIBLE':<18} {total_stock:>5}")
        else:
            print(f"\n      ❌ No se encontró stock para código {barcode}")
        
        print()
    
    conn.close()
    print(f"{'━'*110}")
    print("✅ Consulta finalizada - Solo lectura, ningún dato fue modificado.")


if __name__ == "__main__":
    n = 5
    if len(sys.argv) > 1:
        try:
            n = int(sys.argv[1])
        except:
            pass
    
    consultar_ultimas_ventas(n)
