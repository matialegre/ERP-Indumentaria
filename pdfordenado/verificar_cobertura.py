"""
Verifica si todos los códigos de barra están en todos los locales
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

# Tomar un código de barra de ejemplo que esté en DRAGONFISH
cursor.execute("""
    SELECT TOP 1 CODIGO_BARRA 
    FROM STOCKS 
    WHERE RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB'
    AND STOCK > 0
""")
codigo_dragon = cursor.fetchone()[0].strip()

print(f"Código de barra en DRAGONFISH con stock: {codigo_dragon}")
print("\nLocales donde aparece este código:")

cursor.execute("""
    SELECT RTRIM(LOCAL), STOCK
    FROM STOCKS
    WHERE RTRIM(CODIGO_BARRA) = ?
    ORDER BY LOCAL
""", codigo_dragon)

locales_encontrados = []
for row in cursor.fetchall():
    local, stock = row
    locales_encontrados.append(local)
    print(f"  {local:<25} Stock: {stock}")

print(f"\nTotal de locales para este código: {len(locales_encontrados)}")

# Ver cuántos códigos de barra están SOLO en DRAGONFISH
print("\n" + "="*80)
print("Códigos que están SOLO en DRAGONFISH (no en otros locales):")

cursor.execute("""
    SELECT CODIGO_BARRA, COUNT(DISTINCT LOCAL) as NUM_LOCALES
    FROM STOCKS
    GROUP BY CODIGO_BARRA
    HAVING COUNT(DISTINCT LOCAL) = 1
    AND MAX(CASE WHEN RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB' THEN 1 ELSE 0 END) = 1
""")

solo_dragon = cursor.fetchall()
print(f"\nTotal: {len(solo_dragon)} códigos de barra están SOLO en DRAGONFISH")

if solo_dragon:
    print("\nPrimeros 5 ejemplos:")
    for i, (cod, num) in enumerate(solo_dragon[:5], 1):
        cursor.execute("SELECT RTRIM(DESCRIPCION), STOCK FROM STOCKS WHERE CODIGO_BARRA = ?", cod)
        desc, stock = cursor.fetchone()
        print(f"  {i}. {cod.strip():<25} Stock: {stock:>4}  {desc}")

conn.close()
