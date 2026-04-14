"""
Dump completo del SQL Server legacy — muestras de todas las tablas + estadísticas.
Guarda todo en un archivo local para referencia futura.
"""
import pyodbc
import json
from datetime import datetime, date
from decimal import Decimal

CONN_STR = (
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=192.168.0.109,9970;'
    'DATABASE=DATOS;'
    'UID=MUNDO;'
    'PWD=sanmartin126;'
    'TrustServerCertificate=yes'
)

def safe_val(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return str(v)
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return f"<bytes:{len(v)}>"
    return str(v)

def run():
    conn = pyodbc.connect(CONN_STR, timeout=15)
    cursor = conn.cursor()
    print("Conectado a SQL Server OK")

    result = {
        "generated_at": str(datetime.now()),
        "server": "192.168.0.109,9970",
        "database": "DATOS",
        "tables": {}
    }

    # Get all tables
    cursor.execute("""
        SELECT t.name, p.rows
        FROM sys.tables t
        JOIN sys.partitions p ON t.object_id = p.object_id
        WHERE p.index_id IN (0,1)
        ORDER BY p.rows DESC
    """)
    tables = [(r.name, r.rows) for r in cursor.fetchall()]

    for tabla, row_count in tables:
        print(f"\n{'='*60}")
        print(f"Procesando: {tabla} ({row_count:,} registros)")

        tbl = {
            "row_count": row_count,
            "columns": [],
            "sample_rows": [],
            "stats": {}
        }

        # Schema
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        """, tabla)
        cols_info = cursor.fetchall()
        col_names = []
        for c in cols_info:
            col_names.append(c.COLUMN_NAME)
            tbl["columns"].append({
                "name": c.COLUMN_NAME,
                "type": c.DATA_TYPE,
                "max_length": c.CHARACTER_MAXIMUM_LENGTH,
                "nullable": c.IS_NULLABLE == "YES"
            })

        # Sample rows (TOP 20)
        try:
            cursor.execute(f"SELECT TOP 20 * FROM [{tabla}]")
            rows = cursor.fetchall()
            for row in rows:
                record = {}
                for i, col in enumerate(col_names):
                    record[col] = safe_val(row[i])
                tbl["sample_rows"].append(record)
        except Exception as e:
            tbl["sample_rows"] = [{"error": str(e)}]

        # Stats — distinct counts for key columns (strings and dates)
        for c in cols_info:
            if c.DATA_TYPE in ('varchar', 'nvarchar', 'char', 'date', 'datetime', 'datetime2') and row_count > 0:
                try:
                    cursor.execute(f"SELECT COUNT(DISTINCT [{c.COLUMN_NAME}]) FROM [{tabla}]")
                    distinct = cursor.fetchone()[0]
                    if distinct <= 50:
                        cursor.execute(f"""
                            SELECT TOP 30 [{c.COLUMN_NAME}], COUNT(*) as cnt
                            FROM [{tabla}]
                            WHERE [{c.COLUMN_NAME}] IS NOT NULL
                            GROUP BY [{c.COLUMN_NAME}]
                            ORDER BY COUNT(*) DESC
                        """)
                        top_vals = [(safe_val(r[0]), r[1]) for r in cursor.fetchall()]
                        tbl["stats"][c.COLUMN_NAME] = {
                            "distinct_count": distinct,
                            "top_values": top_vals
                        }
                    else:
                        tbl["stats"][c.COLUMN_NAME] = {"distinct_count": distinct}
                except:
                    pass

            # Min/Max/Avg for numeric columns
            if c.DATA_TYPE in ('int', 'bigint', 'decimal', 'numeric', 'float', 'money') and row_count > 0:
                try:
                    cursor.execute(f"""
                        SELECT MIN([{c.COLUMN_NAME}]), MAX([{c.COLUMN_NAME}]),
                               AVG(CAST([{c.COLUMN_NAME}] AS FLOAT))
                        FROM [{tabla}]
                        WHERE [{c.COLUMN_NAME}] IS NOT NULL
                    """)
                    r = cursor.fetchone()
                    tbl["stats"][c.COLUMN_NAME] = {
                        "min": safe_val(r[0]),
                        "max": safe_val(r[1]),
                        "avg": round(float(r[2]), 2) if r[2] else None
                    }
                except:
                    pass

            # Date ranges
            if c.DATA_TYPE in ('date', 'datetime', 'datetime2') and row_count > 0:
                try:
                    cursor.execute(f"""
                        SELECT MIN([{c.COLUMN_NAME}]), MAX([{c.COLUMN_NAME}])
                        FROM [{tabla}]
                        WHERE [{c.COLUMN_NAME}] IS NOT NULL
                    """)
                    r = cursor.fetchone()
                    stats = tbl["stats"].get(c.COLUMN_NAME, {})
                    stats["date_min"] = safe_val(r[0])
                    stats["date_max"] = safe_val(r[1])
                    tbl["stats"][c.COLUMN_NAME] = stats
                except:
                    pass

        result["tables"][tabla] = tbl
        print(f"  → {len(tbl['sample_rows'])} muestras, {len(tbl['stats'])} stats")

    conn.close()

    # Save to file
    output_path = r"x:\ERP MUNDO OUTDOOR\sqlserver_dump_completo.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Guardado en {output_path}")
    print(f"  Tablas procesadas: {len(result['tables'])}")

    # Also save a human-readable summary
    summary_path = r"x:\ERP MUNDO OUTDOOR\sqlserver_resumen.txt"
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write(f"RESUMEN SQL SERVER LEGACY — {datetime.now()}\n")
        f.write(f"Server: 192.168.0.109,9970 / DB: DATOS\n")
        f.write("=" * 80 + "\n\n")

        total_rows = 0
        for tabla, tbl in result["tables"].items():
            total_rows += tbl["row_count"]
            f.write(f"\n{'='*80}\n")
            f.write(f"TABLA: {tabla} — {tbl['row_count']:,} registros\n")
            f.write(f"{'='*80}\n\n")

            f.write("COLUMNAS:\n")
            for col in tbl["columns"]:
                ml = f"({col['max_length']})" if col['max_length'] else ""
                null = "" if col['nullable'] else " NOT NULL"
                f.write(f"  {col['name']:<40} {col['type']}{ml}{null}\n")

            if tbl["stats"]:
                f.write("\nESTADÍSTICAS:\n")
                for col_name, st in tbl["stats"].items():
                    if "top_values" in st:
                        vals = ", ".join([f"{v[0]} ({v[1]})" for v in st["top_values"][:10]])
                        f.write(f"  {col_name}: {st['distinct_count']} valores únicos → [{vals}]\n")
                    elif "min" in st and "date_min" not in st:
                        f.write(f"  {col_name}: min={st['min']}, max={st['max']}, avg={st.get('avg')}\n")
                    if "date_min" in st:
                        f.write(f"  {col_name}: rango {st['date_min']} → {st['date_max']}\n")

            if tbl["sample_rows"] and "error" not in tbl["sample_rows"][0]:
                f.write(f"\nMUESTRA (primeros {len(tbl['sample_rows'])} registros):\n")
                for i, row in enumerate(tbl["sample_rows"][:5]):
                    f.write(f"  [{i+1}] {json.dumps(row, ensure_ascii=False, default=str)[:300]}\n")

        f.write(f"\n\n{'='*80}\n")
        f.write(f"TOTAL: {len(result['tables'])} tablas, {total_rows:,} registros totales\n")

    print(f"✓ Resumen legible en {summary_path}")

if __name__ == "__main__":
    run()
