import pyodbc

conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

conn = pyodbc.connect(conn_str, timeout=10)
cursor = conn.cursor()

# Analizar el patrón del SELLER_FIELD vs CODIGO_BARRA
# SELLER_FIELD: NPGRB6EBUD-AH1-46  -> sin guiones: NPGRB6EBUDAH146
# CODIGO_BARRA: NPGRB6EBUDAH146    -> match!
#
# SELLER_FIELD: NMIDKUDJUA-TB0-T39 -> sin guiones: NMIDKUDJUATB0T39
# CODIGO_BARRA: NMIDKUDJUATB039    -> NO match (TB0T39 vs TB039)
#
# El patrón parece ser: quitar guiones, y el "T" antes del talle es extra en MeLi
# NMIDKUDJUA-TB0-T39 -> NMIDKUDJUA + TB0 + 39 = NMIDKUDJUATB039
# NMIDKUDJUA-NN0-T38 -> NMIDKUDJUA + NN0 + 38 = NMIDKUDJUANN038
# NMIDKUHJUB-NN0-T42 -> NMIDKUHJUB + NN0 + 42 = NMIDKUHJUBNN042

import re

def seller_to_barcode(seller_field):
    """Convierte SELLER_FIELD de MeLi a CODIGO_BARRA de la DB"""
    sf = seller_field.strip()
    
    # Patrón: XXXXX-YYY-TZZZ o XXXXX-YYY-ZZZ
    parts = sf.split('-')
    if len(parts) == 3:
        base = parts[0]
        color_code = parts[1]
        talle_part = parts[2]
        
        # Quitar la T del talle si existe (T39 -> 39, ST -> ST)
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


print("=" * 100)
print("TEST DE CONVERSIÓN SELLER_FIELD -> CODIGO_BARRA")
print("=" * 100)

test_cases = [
    'NPGRB6EBUD-AH1-46',
    'NMIDKUDJUA-TB0-T39',
    'NMIDKUDJUA-NN0-T38',
    'NMIDKUHJUB-NN0-T42',
    'NMIDKRHZSS-NN0-T42',
    'IGDO1P1SCT-TV0-ST',
    'IFLO2A2CRX-TT5-ST',
]

for sf in test_cases:
    barcode = seller_to_barcode(sf)
    print(f"  {sf:<30} -> {barcode}")
    
    # Verificar si existe en STOCKS
    cursor.execute("SELECT TOP 1 CODIGO_BARRA, LOCAL, STOCK, DESCRIPCION FROM STOCKS WHERE RTRIM(CODIGO_BARRA) = ?", barcode)
    row = cursor.fetchone()
    if row:
        print(f"     ✅ Encontrado: {row[3]} | Local: {row[1]} | Stock: {row[2]}")
    else:
        # Intentar case-insensitive
        cursor.execute("SELECT TOP 1 CODIGO_BARRA, LOCAL, STOCK, DESCRIPCION FROM STOCKS WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?", barcode.upper())
        row = cursor.fetchone()
        if row:
            print(f"     ✅ Encontrado (case-insensitive): {row[3]} | Local: {row[1]} | Stock: {row[2]}")
        else:
            # LIKE
            cursor.execute("SELECT TOP 3 CODIGO_BARRA, LOCAL, STOCK FROM STOCKS WHERE UPPER(RTRIM(CODIGO_BARRA)) LIKE ?", f'%{barcode[:10].upper()}%{barcode[-2:]}%')
            rows = cursor.fetchall()
            if rows:
                print(f"     🔍 Parcial:")
                for r in rows:
                    print(f"        Barra: {r[0]:<25} Local: {r[1]:<15} Stock: {r[2]}")
            else:
                print(f"     ❌ No encontrado")

# Ahora probar con las últimas 5 ventas reales
print("\n" + "=" * 100)
print("ÚLTIMAS 5 VENTAS CON STOCK POR LOCAL")
print("=" * 100)

cursor.execute("SELECT TOP 5 ORDER_ID, DATE_CREATED, PRODUCT_NAME, SELLER_FIELD, CANTIDAD, LOCAL FROM VENTAS_MERCADOLIBRE ORDER BY DATE_CREATED DESC")
ventas = cursor.fetchall()

for v in ventas:
    order_id, fecha, producto, seller_field, cantidad, local_venta = v
    sf = (seller_field or '').strip()
    barcode = seller_to_barcode(sf)
    
    print(f"\n{'─'*100}")
    print(f"📦 {producto}")
    print(f"   Fecha: {fecha} | SKU MeLi: {sf} | Código Barra: {barcode} | Cant: {cantidad}")
    
    # Buscar stock en todos los locales
    cursor.execute("""
        SELECT RTRIM(CODIGO_BARRA), RTRIM(LOCAL), STOCK, RTRIM(DESCRIPCION) 
        FROM STOCKS WHERE UPPER(RTRIM(CODIGO_BARRA)) = ?
    """, barcode.upper())
    stocks = cursor.fetchall()
    
    if stocks:
        print(f"   📊 Stock por local:")
        for s in stocks:
            indicator = "🟢" if s[2] > 0 else "🔴"
            print(f"      {indicator} {s[1]:<20} Stock: {s[2]}")
    else:
        print(f"   ❌ No encontrado con código {barcode}")

conn.close()
