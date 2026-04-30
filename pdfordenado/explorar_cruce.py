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

# Traer últimas 5 ventas
print("=" * 100)
print("ÚLTIMAS 5 VENTAS DE MERCADOLIBRE")
print("=" * 100)

cursor.execute("SELECT TOP 5 ORDER_ID, DATE_CREATED, PRODUCT_NAME, SELLER_FIELD, CANTIDAD, LOCAL FROM VENTAS_MERCADOLIBRE ORDER BY DATE_CREATED DESC")
ventas = cursor.fetchall()

for v in ventas:
    order_id, fecha, producto, seller_field, cantidad, local_venta = v
    seller_field = (seller_field or '').strip()
    
    print(f"\n{'='*100}")
    print(f"VENTA: {order_id} | {fecha} | Local: {local_venta}")
    print(f"Producto: {producto}")
    print(f"SELLER_FIELD (SKU): {seller_field}")
    print(f"Cantidad: {cantidad}")
    
    # Intento 1: Buscar en ARTICULOS por CODIGO_BARRAS = SELLER_FIELD
    print(f"\n  >> Buscando en ARTICULOS con CODIGO_BARRAS = '{seller_field}'...")
    cursor.execute("""
        SELECT RTRIM(COLOR_DESCRIPCION) as COLOR, RTRIM(TALLE_DESCRIPCION) AS TALLE, 
               RTRIM(CODIGO_ARTICULO) AS COD_ART, RTRIM(CODIGO_BARRAS) AS COD_BARRA, 
               RTRIM(DESCRIPCION) AS ARTDES
        FROM ARTICULOS WHERE RTRIM(CODIGO_BARRAS) = ?
    """, seller_field)
    art_rows = cursor.fetchall()
    
    if art_rows:
        for art in art_rows:
            color, talle, cod_art, cod_barra, desc = art
            print(f"  ✅ ENCONTRADO en ARTICULOS:")
            print(f"     Descripción: {desc}")
            print(f"     Color: {color} | Talle: {talle}")
            print(f"     Código Artículo: {cod_art} | Código Barra: {cod_barra}")
            
            # Buscar stock por código de barra
            print(f"\n  >> Buscando STOCK por CODIGO_BARRA = '{cod_barra}'...")
            cursor.execute("SELECT CODIGO_BARRA, LOCAL, STOCK FROM STOCKS WHERE CODIGO_BARRA = ?", cod_barra)
            stock_rows = cursor.fetchall()
            
            if stock_rows:
                print(f"  ✅ STOCK encontrado en {len(stock_rows)} locales:")
                for sr in stock_rows:
                    print(f"     Local: {sr[1]:<15} Stock: {sr[2]}")
            else:
                # Intento con articulo + color + talle
                print(f"  ⚠️ No encontrado por código barra. Intentando por ARTICULO+COLOR+TALLE...")
                cursor.execute("""
                    SELECT CODIGO_BARRA, LOCAL, STOCK FROM STOCKS 
                    WHERE CODIGO_ARTICULO = ? AND CODIGO_COLOR = ? AND CODIGO_TALLE = ?
                """, cod_art, color, talle)
                stock_rows2 = cursor.fetchall()
                if stock_rows2:
                    print(f"  ✅ STOCK encontrado por ART+COLOR+TALLE en {len(stock_rows2)} locales:")
                    for sr in stock_rows2:
                        print(f"     Local: {sr[1]:<15} Stock: {sr[2]}")
                else:
                    print(f"  ❌ Sin stock en ningún local")
    else:
        print(f"  ❌ No encontrado en ARTICULOS")
        
        # Intentar buscar directamente en STOCKS por CODIGO_BARRA = seller_field
        print(f"\n  >> Intentando STOCKS directamente con CODIGO_BARRA = '{seller_field}'...")
        cursor.execute("SELECT CODIGO_BARRA, LOCAL, STOCK, DESCRIPCION FROM STOCKS WHERE CODIGO_BARRA = ?", seller_field)
        stock_direct = cursor.fetchall()
        if stock_direct:
            print(f"  ✅ STOCK directo encontrado en {len(stock_direct)} locales:")
            for sr in stock_direct:
                print(f"     Local: {sr[1]:<15} Stock: {sr[2]}  ({sr[3]})")
        else:
            # Quizás el seller_field tiene guiones y el código de barra no
            seller_clean = seller_field.replace('-', '')
            print(f"  >> Intentando sin guiones: '{seller_clean}'...")
            cursor.execute("SELECT CODIGO_BARRA, LOCAL, STOCK, DESCRIPCION FROM STOCKS WHERE RTRIM(CODIGO_BARRA) = ?", seller_clean)
            stock_clean = cursor.fetchall()
            if stock_clean:
                print(f"  ✅ STOCK encontrado (sin guiones) en {len(stock_clean)} locales:")
                for sr in stock_clean:
                    print(f"     Local: {sr[1]:<15} Stock: {sr[2]}  ({sr[3]})")
            else:
                # Buscar con LIKE
                print(f"  >> Intentando con LIKE '%{seller_field[:10]}%'...")
                cursor.execute("SELECT TOP 5 CODIGO_BARRA, LOCAL, STOCK, DESCRIPCION FROM STOCKS WHERE CODIGO_BARRA LIKE ?", f'%{seller_field[:10]}%')
                stock_like = cursor.fetchall()
                if stock_like:
                    print(f"  🔍 Resultados parciales:")
                    for sr in stock_like:
                        print(f"     Barra: {sr[0]:<25} Local: {sr[1]:<15} Stock: {sr[2]}")
                else:
                    print(f"  ❌ No se encontró nada")

conn.close()
print(f"\n{'='*100}")
print("✅ Exploración completada")
