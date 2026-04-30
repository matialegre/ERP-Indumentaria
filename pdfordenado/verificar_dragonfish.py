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

print("=" * 80)
print("VERIFICANDO LOCALES EN LA BASE DE DATOS")
print("=" * 80)

# Ver todos los locales únicos
cursor.execute("SELECT DISTINCT RTRIM(LOCAL) as LOCAL FROM STOCKS ORDER BY LOCAL")
locales = cursor.fetchall()

print(f"\nTotal de locales encontrados: {len(locales)}\n")
for local in locales:
    print(f"  • {local[0]}")

# Ver si hay datos en DRAGONFISH_MUNDOCAB
print("\n" + "=" * 80)
print("STOCK EN DRAGONFISH_MUNDOCAB (muestra)")
print("=" * 80)

cursor.execute("""
    SELECT TOP 5 RTRIM(CODIGO_BARRA), RTRIM(DESCRIPCION), STOCK 
    FROM STOCKS 
    WHERE RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB' AND STOCK > 0
    ORDER BY STOCK DESC
""")
rows = cursor.fetchall()

for row in rows:
    print(f"  Barra: {row[0]:<25} Stock: {row[2]:>4}  {row[1]}")

conn.close()
