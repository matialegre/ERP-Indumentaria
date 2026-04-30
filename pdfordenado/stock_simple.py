"""
Consulta simple de stock - 3 artículos de ejemplo
Formato: CODIGO_BARRA | LOCAL | STOCK | FUENTE
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

# Traer 3 códigos de barra con diferencias entre DRAGONFISH y otros locales
cursor.execute("""
    SELECT TOP 3 CODIGO_BARRA
    FROM (
        SELECT CODIGO_BARRA,
               SUM(CASE WHEN RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END) as STOCK_DRAGON,
               SUM(CASE WHEN RTRIM(LOCAL) != 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END) as STOCK_OTROS
        FROM STOCKS
        GROUP BY CODIGO_BARRA
        HAVING SUM(CASE WHEN RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END) != 
               SUM(CASE WHEN RTRIM(LOCAL) != 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END)
        AND (SUM(CASE WHEN RTRIM(LOCAL) = 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END) > 0
             OR SUM(CASE WHEN RTRIM(LOCAL) != 'DRAGONFISH_MUNDOCAB' THEN STOCK ELSE 0 END) > 0)
    ) AS T
    ORDER BY ABS(STOCK_DRAGON - STOCK_OTROS) DESC
""")

codigos = [row[0].strip() for row in cursor.fetchall()]

print(f"{'CODIGO_BARRA':<25} {'LOCAL':<20} {'STOCK':>6}  {'FUENTE'}")
print("─" * 80)

for codigo in codigos:
    cursor.execute("""
        SELECT RTRIM(CODIGO_BARRA), RTRIM(LOCAL), STOCK
        FROM STOCKS
        WHERE RTRIM(CODIGO_BARRA) = ?
        ORDER BY LOCAL
    """, codigo)
    
    for row in cursor.fetchall():
        cod_barra, local, stock = row
        fuente = "DRAGONFISH" if local == "DRAGONFISH_MUNDOCAB" else "192.168.0.109:9970"
        print(f"{cod_barra:<25} {local:<20} {stock:>6}  {fuente}")

conn.close()
