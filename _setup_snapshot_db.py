"""Descubre schemas SQL Server de las tablas que usa Informes y las crea en Postgres."""
import os, pyodbc, psycopg2

os.environ['PGCLIENTENCODING'] = 'UTF8'

SRC_CS = 'DRIVER={SQL Server};SERVER=192.168.0.109,9970;DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126'

# Tablas usadas por informes.py (case-sensitive en SQL Server: en realidad SS es case-insensitive por default)
TABLES = ["VENTAS", "ARTICULOS", "STOCKS", "FICHACOMPRO", "VENTAS_MERCADOLIBRE", "MEDIOS_PAGOS"]

# Map SQL Server -> Postgres
def map_type(dt: str, char_max: int | None, num_prec: int | None, num_scale: int | None) -> str:
    dt = dt.lower()
    if dt in ("int", "smallint", "tinyint"):
        return "integer"
    if dt == "bigint":
        return "bigint"
    if dt in ("decimal", "numeric"):
        if num_prec and num_scale is not None:
            return f"numeric({num_prec},{num_scale})"
        return "numeric"
    if dt in ("float", "real"):
        return "double precision"
    if dt in ("money", "smallmoney"):
        return "numeric(19,4)"
    if dt == "bit":
        return "boolean"
    if dt in ("datetime", "datetime2", "smalldatetime"):
        return "timestamp"
    if dt == "date":
        return "date"
    if dt == "time":
        return "time"
    if dt in ("char", "nchar"):
        n = char_max if char_max and char_max > 0 else 1
        return f"char({n})"
    if dt in ("varchar", "nvarchar"):
        if char_max == -1 or not char_max:
            return "text"
        return f"varchar({char_max})"
    if dt == "text" or dt == "ntext":
        return "text"
    if dt == "uniqueidentifier":
        return "uuid"
    if dt in ("varbinary", "binary", "image"):
        return "bytea"
    return "text"

src = pyodbc.connect(SRC_CS, timeout=10)
cur = src.cursor()

# Crear DB snapshot si no existe
pg_admin = psycopg2.connect(host='localhost', port=2048, user='postgres', password='0896', dbname='postgres', client_encoding='UTF8')
pg_admin.autocommit = True
acur = pg_admin.cursor()
acur.execute("SELECT 1 FROM pg_database WHERE datname='informes_snapshot'")
if not acur.fetchone():
    acur.execute('CREATE DATABASE informes_snapshot OWNER erp_user ENCODING UTF8 TEMPLATE template0')
    print('Database informes_snapshot creada')
else:
    print('Database informes_snapshot ya existe')
pg_admin.close()

pg = psycopg2.connect(host='localhost', port=2048, user='postgres', password='0896', dbname='informes_snapshot', client_encoding='UTF8')
pg.autocommit = True
pcur = pg.cursor()

# Crear tabla _meta_sync
pcur.execute("""
    CREATE TABLE IF NOT EXISTS _meta_sync (
        table_name text PRIMARY KEY,
        last_sync timestamp,
        rows_synced bigint,
        duration_ms integer,
        status text,
        error_message text
    )
""")

ddl_dict = {}

for tbl in TABLES:
    cur.execute(f"""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """, (tbl,))
    cols = cur.fetchall()
    if not cols:
        print(f'!! Tabla {tbl} no encontrada en SQL Server')
        continue

    col_defs = []
    for cn, dt, cm, npc, nsc in cols:
        pg_type = map_type(dt, cm, npc, nsc)
        col_defs.append(f'    "{cn.lower()}" {pg_type}')
    pg_table = tbl.lower()
    ddl = f'DROP TABLE IF EXISTS "{pg_table}";\nCREATE TABLE "{pg_table}" (\n' + ',\n'.join(col_defs) + '\n);'
    ddl_dict[tbl] = ddl
    print(f'\n--- {tbl} ({len(cols)} cols) ---')
    print(ddl)
    pcur.execute(ddl)

# Permisos a erp_user
for tbl in TABLES:
    pcur.execute(f'GRANT ALL ON "{tbl.lower()}" TO erp_user')
pcur.execute('GRANT ALL ON _meta_sync TO erp_user')

print('\nOK: tablas creadas en informes_snapshot')
src.close()
pg.close()
