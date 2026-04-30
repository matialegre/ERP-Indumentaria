import pyodbc

# Conexión a SQL Server - SOLO LECTURA
conn_str = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes;"
)

try:
    conn = pyodbc.connect(conn_str, timeout=10)
    cursor = conn.cursor()
    print("✅ Conexión exitosa a la base de datos DATOS\n")
    
    # 1. Explorar VENTAS_MERCADOLIBRE - columnas
    print("=" * 80)
    print("TABLA: VENTAS_MERCADOLIBRE - COLUMNAS")
    print("=" * 80)
    cursor.execute("SELECT TOP 1 * FROM VENTAS_MERCADOLIBRE")
    columns = [desc[0] for desc in cursor.description]
    for i, col in enumerate(columns):
        print(f"  [{i}] {col}")
    
    # 2. Últimas 5 filas de VENTAS_MERCADOLIBRE
    print("\n" + "=" * 80)
    print("TABLA: VENTAS_MERCADOLIBRE - ÚLTIMAS 5 FILAS")
    print("=" * 80)
    
    # Intentar ordenar por alguna columna de fecha o ID
    try:
        cursor.execute("SELECT TOP 5 * FROM VENTAS_MERCADOLIBRE ORDER BY 1 DESC")
    except:
        cursor.execute("SELECT TOP 5 * FROM VENTAS_MERCADOLIBRE")
    
    rows = cursor.fetchall()
    for row in rows:
        print("-" * 80)
        for i, col in enumerate(columns):
            val = row[i]
            if val is not None:
                print(f"  {col}: {val}")
    
    # 3. Explorar ARTICULOS - columnas
    print("\n" + "=" * 80)
    print("TABLA: ARTICULOS - COLUMNAS")
    print("=" * 80)
    cursor.execute("SELECT TOP 1 * FROM ARTICULOS")
    art_columns = [desc[0] for desc in cursor.description]
    for i, col in enumerate(art_columns):
        print(f"  [{i}] {col}")
    
    # 4. Explorar STOCKS - columnas
    print("\n" + "=" * 80)
    print("TABLA: STOCKS - COLUMNAS")
    print("=" * 80)
    cursor.execute("SELECT TOP 1 * FROM STOCKS")
    stock_columns = [desc[0] for desc in cursor.description]
    for i, col in enumerate(stock_columns):
        print(f"  [{i}] {col}")
    
    # 5. Muestra de STOCKS
    print("\n" + "=" * 80)
    print("TABLA: STOCKS - MUESTRA (3 filas)")
    print("=" * 80)
    cursor.execute("SELECT TOP 3 * FROM STOCKS")
    rows = cursor.fetchall()
    for row in rows:
        print("-" * 40)
        for i, col in enumerate(stock_columns):
            val = row[i]
            if val is not None:
                print(f"  {col}: {val}")
    
    conn.close()
    print("\n✅ Conexión cerrada correctamente")

except pyodbc.Error as e:
    print(f"❌ Error de conexión: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
