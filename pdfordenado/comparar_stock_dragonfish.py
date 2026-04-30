"""
Comparativa de Stock: Dragonfish vs Locales Nuevos
Mundo Outdoor

Para las últimas ventas de MeLi, compara el stock que dice Dragonfish
vs el stock en los locales nuevos (DATOS).

SOLO LECTURA - No modifica ningún dato.
"""

import pyodbc
from datetime import datetime

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

LOCALES_NUEVOS = [
    'MTGCBA', 'MONBAHIA', 'NQNSHOP', 'MUNDOAL', 'DEPOSITO',
    'MTGMDQ', 'MTGROCA', 'NQNALB', 'MTGJBJ', 'MUNDOBBPS',
    'MUNDOROCA', 'MTGBBPS', 'MTGCOM'
]

LOCAL_DRAGONFISH = 'DRAGONFISH_MUNDOCAB'


def seller_to_barcode(seller_field):
    """Convierte SELLER_FIELD de MeLi a CODIGO_BARRA."""
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


def get_stock_completo(cursor, codigo_barra):
    """Retorna dict con stock de Dragonfish y todos los locales nuevos."""
    cursor.execute("""
        SELECT RTRIM(LOCAL), STOCK 
        FROM STOCKS 
        WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    """, codigo_barra.upper())
    
    rows = cursor.fetchall()
    
    stock_dragon = 0
    stock_nuevos = {}
    
    for local, stock in rows:
        local_clean = local.strip() if local else ''
        stock_val = int(stock) if stock else 0
        
        if local_clean == LOCAL_DRAGONFISH:
            stock_dragon = stock_val
        elif local_clean in LOCALES_NUEVOS:
            stock_nuevos[local_clean] = stock_val
    
    return {
        'dragonfish': stock_dragon,
        'locales_nuevos': stock_nuevos,
        'total_nuevos': sum(max(s, 0) for s in stock_nuevos.values())
    }


def get_descripcion(cursor, codigo_barra):
    """Obtiene descripción del artículo."""
    cursor.execute("""
        SELECT TOP 1 RTRIM(DESCRIPCION), RTRIM(CODIGO_COLOR), RTRIM(CODIGO_TALLE)
        FROM STOCKS 
        WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    """, codigo_barra.upper())
    
    row = cursor.fetchone()
    if row:
        return f"{row[0]} | Color: {row[1]} | Talle: {row[2]}"
    return "Descripción no disponible"


def comparar_stock_ventas(n_ventas=5):
    """Compara stock Dragonfish vs Locales Nuevos para últimas ventas."""
    
    print("=" * 120)
    print(f"  COMPARATIVA STOCK: DRAGONFISH vs LOCALES NUEVOS")
    print(f"  Últimas {n_ventas} ventas de MercadoLibre")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 120)
    
    try:
        conn = pyodbc.connect(CONN_STR, timeout=10)
        cursor = conn.cursor()
    except pyodbc.Error as e:
        print(f"\n❌ Error de conexión: {e}")
        return
    
    cursor.execute(f"""
        SELECT TOP {n_ventas} ORDER_ID, DATE_CREATED, PRODUCT_NAME, 
               SELLER_FIELD, CANTIDAD, LOCAL, TOTAL_AMOUNT
        FROM VENTAS_MERCADOLIBRE 
        ORDER BY DATE_CREATED DESC
    """)
    ventas = cursor.fetchall()
    
    if not ventas:
        print("\n⚠️ No se encontraron ventas")
        conn.close()
        return
    
    print(f"\n✅ {len(ventas)} ventas encontradas\n")
    
    total_discrepancias = 0
    
    for idx, v in enumerate(ventas, 1):
        order_id, fecha, producto, seller_field, cantidad, local_venta, monto = v
        sf = (seller_field or '').strip()
        barcode = seller_to_barcode(sf)
        
        print(f"{'━'*120}")
        print(f"  [{idx}] {producto}")
        print(f"      Fecha: {fecha} | Orden: {order_id}")
        print(f"      SKU: {sf} → Código: {barcode}")
        
        desc = get_descripcion(cursor, barcode)
        print(f"      📋 {desc}")
        
        stock_info = get_stock_completo(cursor, barcode)
        stock_dragon = stock_info['dragonfish']
        stock_nuevos = stock_info['locales_nuevos']
        total_nuevos = stock_info['total_nuevos']
        
        # Comparativa
        diferencia = stock_dragon - total_nuevos
        
        print(f"\n      {'SISTEMA':<25} {'STOCK':>8}   {'DETALLE'}")
        print(f"      {'─'*80}")
        
        # Dragonfish
        icon_dragon = "🟢" if stock_dragon > 0 else "🔴"
        print(f"      {icon_dragon} {'DRAGONFISH (viejo)':<23} {stock_dragon:>8}")
        
        # Locales nuevos
        print(f"\n      {'LOCALES NUEVOS:':<25}")
        for local in LOCALES_NUEVOS:
            if local in stock_nuevos:
                s = stock_nuevos[local]
                icon = "🟢" if s > 0 else "🔴" if s == 0 else "⚠️"
                print(f"        {icon} {local:<21} {s:>6}")
        
        print(f"      {'─'*80}")
        print(f"      {'TOTAL LOCALES NUEVOS':<25} {total_nuevos:>8}")
        
        # Análisis de diferencia
        print(f"\n      {'ANÁLISIS:':<25}")
        if diferencia > 0:
            print(f"      ⚠️  DRAGONFISH tiene {diferencia} unidades MÁS que los locales nuevos")
            print(f"          → Dragonfish puede estar desactualizado (no refleja ventas recientes)")
            total_discrepancias += 1
        elif diferencia < 0:
            print(f"      ⚠️  DRAGONFISH tiene {abs(diferencia)} unidades MENOS que los locales nuevos")
            print(f"          → Los locales nuevos tienen más stock del esperado")
            total_discrepancias += 1
        else:
            if stock_dragon == 0 and total_nuevos == 0:
                print(f"      ✅ Ambos sin stock (coinciden)")
            else:
                print(f"      ✅ Stock coincide perfectamente ({stock_dragon} unidades)")
        
        print()
    
    # Resumen final
    print(f"{'━'*120}")
    print(f"\n📊 RESUMEN:")
    print(f"   • Total ventas analizadas: {len(ventas)}")
    print(f"   • Artículos con discrepancias: {total_discrepancias}")
    print(f"   • Artículos con stock coincidente: {len(ventas) - total_discrepancias}")
    
    if total_discrepancias > 0:
        porcentaje = (total_discrepancias / len(ventas)) * 100
        print(f"\n   ⚠️  {porcentaje:.1f}% de los artículos tienen diferencias entre Dragonfish y los locales nuevos")
        print(f"   💡 Recomendación: Usar los locales nuevos como fuente de verdad para stock actual")
    else:
        print(f"\n   ✅ Todos los artículos tienen stock coincidente")
    
    conn.close()
    print(f"\n{'━'*120}")
    print("✅ Comparativa finalizada - Solo lectura, ningún dato fue modificado.")


if __name__ == "__main__":
    import sys
    n = 5
    if len(sys.argv) > 1:
        try:
            n = int(sys.argv[1])
        except:
            pass
    
    comparar_stock_ventas(n)
