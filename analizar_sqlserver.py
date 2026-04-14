"""
Análisis completo del SQL Server legacy de Mundo Outdoor.
Server: 192.168.0.109,9970 / DB: DATOS
"""
import pyodbc
import json
from datetime import datetime

CONN_STR = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=192.168.0.109,9970;'
    'DATABASE=DATOS;'
    'UID=MUNDO;'
    'PWD=sanmartin126;'
    'TrustServerCertificate=yes'
)

def run():
    print("Conectando a SQL Server...")
    conn = pyodbc.connect(CONN_STR, timeout=15)
    cursor = conn.cursor()
    print("Conectado OK\n")

    # ── 1. Tablas con row counts ──────────────────────────────
    print("=" * 60)
    print("TABLAS Y REGISTROS")
    print("=" * 60)
    cursor.execute("""
        SELECT t.name AS tabla, p.rows AS registros
        FROM sys.tables t
        JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0,1)
        ORDER BY p.rows DESC
    """)
    tables = cursor.fetchall()
    for row in tables:
        print(f"  {row.tabla:<40} {row.registros:>12,}")

    # ── 2. Schema completo de cada tabla ──────────────────────
    print("\n" + "=" * 60)
    print("SCHEMA COMPLETO DE TODAS LAS TABLAS")
    print("=" * 60)
    for row in tables:
        tabla = row.tabla
        print(f"\n── {tabla} ({row.registros:,} registros) ──")
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        """, tabla)
        cols = cursor.fetchall()
        for col in cols:
            max_len = f"({col.CHARACTER_MAXIMUM_LENGTH})" if col.CHARACTER_MAXIMUM_LENGTH else ""
            nullable = "" if col.IS_NULLABLE == "YES" else " NOT NULL"
            print(f"    {col.COLUMN_NAME:<35} {col.DATA_TYPE}{max_len}{nullable}")

    # ── 3. Índices ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("ÍNDICES")
    print("=" * 60)
    cursor.execute("""
        SELECT t.name AS tabla, i.name AS indice, i.type_desc,
               STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columnas
        FROM sys.indexes i
        JOIN sys.tables t ON i.object_id = t.object_id
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.name IS NOT NULL
        GROUP BY t.name, i.name, i.type_desc
        ORDER BY t.name, i.name
    """)
    indexes = cursor.fetchall()
    for idx in indexes:
        print(f"  {idx.tabla:<30} {idx.indice:<40} [{idx.columnas}]")

    # ── 4. Muestras de tablas clave ───────────────────────────
    tablas_clave = ['ARTICULOS', 'LOCALES', 'LISTAPRECIOS', 'CAJAS', 'FICHACOMPRO']
    print("\n" + "=" * 60)
    print("MUESTRAS DE TABLAS CLAVE (TOP 3)")
    print("=" * 60)
    for tabla in tablas_clave:
        try:
            cursor.execute(f"SELECT TOP 3 * FROM [{tabla}]")
            rows = cursor.fetchall()
            cols_names = [desc[0] for desc in cursor.description]
            print(f"\n── {tabla} ──")
            print("  Columnas:", " | ".join(cols_names))
            for r in rows:
                vals = [str(v)[:50] if v is not None else "NULL" for v in r]
                print("  →", " | ".join(vals))
        except Exception as e:
            print(f"  Error en {tabla}: {e}")

    # ── 5. Valores únicos de campos de control ────────────────
    print("\n" + "=" * 60)
    print("VALORES ÚNICOS DE CAMPOS IMPORTANTES")
    print("=" * 60)

    campos = [
        ("VENTAS", "COMPROBANTE_TIPO"),
        ("VENTAS", "MEDIO_PAGO"),
        ("LISTAPRECIOS", "LISTADEPRECIOS"),
        ("LISTAPRECIOS", "NombreListaPrecio"),
        ("VENTAS", "LOCAL"),
    ]
    for tabla, campo in campos:
        try:
            cursor.execute(f"SELECT DISTINCT [{campo}] FROM [{tabla}] WHERE [{campo}] IS NOT NULL ORDER BY [{campo}]")
            vals = [str(r[0]) for r in cursor.fetchall()]
            print(f"  {tabla}.{campo}: {vals[:20]}")
        except Exception as e:
            print(f"  Error en {tabla}.{campo}: {e}")

    conn.close()
    print("\n✓ Análisis completo.")

if __name__ == "__main__":
    run()
