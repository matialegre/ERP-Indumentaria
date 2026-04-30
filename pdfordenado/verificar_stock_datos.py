"""
Verificación de Stock en la base DATOS
Ejecuta las consultas que pasó el compañero para ver cuánto stock hay.
"""

import pyodbc

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

conn = pyodbc.connect(CONN_STR, timeout=10)
cursor = conn.cursor()

print("=" * 100)
print("VERIFICACIÓN DE STOCK EN BASE DATOS (192.168.0.109:9970)")
print("=" * 100)

# 1. Cuántos registros hay en STOCKS
print("\n1️⃣ TOTAL DE REGISTROS EN TABLA STOCKS:")
cursor.execute("SELECT COUNT(*) FROM STOCKS")
total = cursor.fetchone()[0]
print(f"   📦 {total:,} registros totales")

# 2. Cuántos artículos únicos
print("\n2️⃣ ARTÍCULOS ÚNICOS (por código de barra):")
cursor.execute("SELECT COUNT(DISTINCT CODIGO_BARRA) FROM STOCKS")
unicos = cursor.fetchone()[0]
print(f"   🏷️  {unicos:,} códigos de barra únicos")

# 3. Stock por local
print("\n3️⃣ STOCK POR LOCAL:")
cursor.execute("""
    SELECT RTRIM(LOCAL) as LOCAL, 
           COUNT(*) as REGISTROS,
           SUM(CASE WHEN STOCK > 0 THEN 1 ELSE 0 END) as CON_STOCK,
           SUM(STOCK) as STOCK_TOTAL
    FROM STOCKS 
    GROUP BY RTRIM(LOCAL)
    ORDER BY SUM(STOCK) DESC
""")
rows = cursor.fetchall()

print(f"\n   {'LOCAL':<20} {'REGISTROS':>12} {'CON STOCK':>12} {'STOCK TOTAL':>15}")
print(f"   {'─'*65}")
for row in rows:
    local, registros, con_stock, stock_total = row
    print(f"   {local:<20} {registros:>12,} {con_stock:>12,} {stock_total:>15,}")

# 4. Probar la consulta del compañero - ejemplo con un código de barra real
print("\n4️⃣ PRUEBA DE CONSULTA DEL COMPAÑERO:")
print("   Consulta: SELECT CODIGO_BARRA, LOCAL, STOCK FROM STOCKS WHERE CODIGO_BARRA = ?")

# Buscar un código de barra que tenga stock
cursor.execute("SELECT TOP 1 RTRIM(CODIGO_BARRA) FROM STOCKS WHERE STOCK > 0")
codigo_ejemplo = cursor.fetchone()[0]

print(f"\n   Probando con código: {codigo_ejemplo}")
cursor.execute("SELECT CODIGO_BARRA, LOCAL, STOCK FROM STOCKS WHERE CODIGO_BARRA = ?", codigo_ejemplo)
resultados = cursor.fetchall()

print(f"\n   {'CODIGO_BARRA':<25} {'LOCAL':<20} {'STOCK':>8}")
print(f"   {'─'*60}")
for r in resultados:
    print(f"   {r[0]:<25} {r[1]:<20} {r[2]:>8}")

# 5. Probar consulta por ARTICULO + COLOR + TALLE
print("\n5️⃣ PRUEBA DE CONSULTA POR ARTICULO+COLOR+TALLE:")
print("   Consulta: SELECT CODIGO_BARRA, LOCAL, STOCK FROM STOCKS")
print("             WHERE CODIGO_ARTICULO = ? AND CODIGO_COLOR = ? AND CODIGO_TALLE = ?")

cursor.execute("""
    SELECT TOP 1 RTRIM(CODIGO_ARTICULO), RTRIM(CODIGO_COLOR), RTRIM(CODIGO_TALLE)
    FROM STOCKS WHERE STOCK > 0
""")
ejemplo = cursor.fetchone()

if ejemplo:
    cod_art, cod_color, cod_talle = ejemplo
    print(f"\n   Probando con:")
    print(f"   - CODIGO_ARTICULO: {cod_art}")
    print(f"   - CODIGO_COLOR: {cod_color}")
    print(f"   - CODIGO_TALLE: {cod_talle}")
    
    cursor.execute("""
        SELECT CODIGO_BARRA, LOCAL, STOCK 
        FROM STOCKS 
        WHERE CODIGO_ARTICULO = ? AND CODIGO_COLOR = ? AND CODIGO_TALLE = ?
    """, cod_art, cod_color, cod_talle)
    
    resultados2 = cursor.fetchall()
    print(f"\n   {'CODIGO_BARRA':<25} {'LOCAL':<20} {'STOCK':>8}")
    print(f"   {'─'*60}")
    for r in resultados2:
        print(f"   {r[0]:<25} {r[1]:<20} {r[2]:>8}")

# 6. Artículos en ARTICULOS
print("\n6️⃣ TABLA ARTICULOS:")
cursor.execute("SELECT COUNT(*) FROM ARTICULOS")
total_art = cursor.fetchone()[0]
print(f"   📋 {total_art:,} registros en tabla ARTICULOS")

cursor.execute("SELECT COUNT(DISTINCT CODIGO_BARRAS) FROM ARTICULOS")
unicos_art = cursor.fetchone()[0]
print(f"   🏷️  {unicos_art:,} códigos de barra únicos en ARTICULOS")

# 7. Muestra de ARTICULOS
print("\n7️⃣ MUESTRA DE ARTICULOS (primeros 3):")
cursor.execute("""
    SELECT TOP 3 RTRIM(CODIGO_BARRAS), RTRIM(DESCRIPCION), 
           RTRIM(COLOR_DESCRIPCION), RTRIM(TALLE_DESCRIPCION)
    FROM ARTICULOS
""")
arts = cursor.fetchall()

for a in arts:
    print(f"\n   Código: {a[0]}")
    print(f"   Descripción: {a[1]}")
    print(f"   Color: {a[2]} | Talle: {a[3]}")

conn.close()

print("\n" + "=" * 100)
print("✅ Verificación completada")
