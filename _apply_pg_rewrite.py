"""
Reescribe informes.py: SQL Server -> Postgres (snapshot local)
"""
import re, io
from pathlib import Path

PATH = Path(r"D:\ERP MUNDO OUTDOOR\erp\backend\app\api\v1\informes.py")
src = PATH.read_text(encoding="utf-8")

# --- 1. Reemplazar bloque de conexión ----------------------------------------
old_conn = '''_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
    "TrustServerCertificate=yes"
)

_CONN_STR_FALLBACK = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
)


def _get_conn():
    try:
        import pyodbc
        try:
            return pyodbc.connect(_CONN_STR, timeout=0)
        except Exception:
            return pyodbc.connect(_CONN_STR_FALLBACK, timeout=0)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SQL Server no disponible: {exc}")'''

new_conn = '''# Postgres local snapshot (sincronizado cada 15 min desde SQL Server por snapshot_worker)
_PG_DSN = (
    "host=localhost port=2048 dbname=informes_snapshot "
    "user=erp_user password=MundoOutdoor2026!"
)


def _get_conn():
    try:
        import psycopg2
        return psycopg2.connect(_PG_DSN, client_encoding="UTF8")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Postgres snapshot no disponible: {exc}")'''

assert old_conn in src, "bloque conexion no encontrado"
src = src.replace(old_conn, new_conn)

# --- 2. _rows_to_dicts: uppercase keys (mantener compat con frontend) --------
old_rd = '''def _rows_to_dicts(cursor) -> list[dict]:
    cols = [c[0] for c in cursor.description]
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = {}
        for i, col in enumerate(cols):
            val = row[i]
            if hasattr(val, 'isoformat'):
                val = val.isoformat()[:10]
            elif isinstance(val, float):
                val = round(val, 2)
            d[col] = val
        result.append(d)
    return result'''

new_rd = '''def _rows_to_dicts(cursor) -> list[dict]:
    # Postgres devuelve identificadores unquoted en minúsculas.
    # Mantenemos compat con el frontend forzando UPPER.
    cols = [c[0].upper() for c in cursor.description]
    rows = cursor.fetchall()
    result = []
    for row in rows:
        d = {}
        for i, col in enumerate(cols):
            val = row[i]
            if hasattr(val, 'isoformat'):
                val = val.isoformat()[:10]
            elif isinstance(val, float):
                val = round(val, 2)
            from decimal import Decimal
            if isinstance(val, Decimal):
                val = float(val)
                val = round(val, 2)
            d[col] = val
        result.append(d)
    return result'''

assert old_rd in src
src = src.replace(old_rd, new_rd)

# --- 3. Transformaciones SQL (regex) -----------------------------------------
# 3a. ISNULL( -> COALESCE(
src = re.sub(r'\bISNULL\(', 'COALESCE(', src)

# 3b. CONVERT(VARCHAR(N), expr)  ->  (expr)::text
#    también CONVERT(VARCHAR, expr)
def _conv_varchar(m):
    expr = m.group(1).strip()
    return f"({expr})::text"

src = re.sub(
    r'CONVERT\s*\(\s*VARCHAR\s*(?:\(\s*\d+\s*\))?\s*,\s*([^)]+?)\s*\)',
    _conv_varchar, src, flags=re.IGNORECASE,
)

# 3c. CHARINDEX(needle, haystack)  ->  POSITION(needle IN haystack)
src = re.sub(
    r'CHARINDEX\s*\(\s*([^,()]+?)\s*,\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*\)',
    lambda m: f"POSITION({m.group(1).strip()} IN {m.group(2).strip()})",
    src,
)

# 3d. CAST(GETDATE() AS DATE)  ->  CURRENT_DATE
src = re.sub(r'CAST\s*\(\s*GETDATE\(\)\s*AS\s*DATE\s*\)', 'CURRENT_DATE', src, flags=re.IGNORECASE)
src = re.sub(r'\bGETDATE\(\)', 'CURRENT_TIMESTAMP', src)

# 3e. DATEDIFF(DAY, a, b) -> (b::date - a::date)
def _datediff(m):
    a = m.group(1).strip()
    b = m.group(2).strip()
    return f"(({b})::date - ({a})::date)"

src = re.sub(
    r'DATEDIFF\s*\(\s*DAY\s*,\s*([^,]+?)\s*,\s*([^)]+?)\s*\)',
    _datediff, src, flags=re.IGNORECASE,
)

# 3f. Placeholders pyodbc '?'  ->  psycopg2 '%s'
#     SOLO dentro de strings SQL. Como el archivo no usa f-strings ni
#     interpolación %s en otros lados, podemos hacer reemplazo global de
#     "?" rodeado por whitespace/coma/paréntesis en strings SQL.
#     Para ser conservadores: solo dentro de literales triple-quoted (""" o ''').
def _replace_q_in_sql_strings(text: str) -> str:
    out = []
    i = 0
    n = len(text)
    while i < n:
        # detectar inicio de triple-quoted string
        if text[i:i+3] in ('"""', "'''"):
            quote = text[i:i+3]
            j = text.find(quote, i + 3)
            if j == -1:
                out.append(text[i:])
                break
            block = text[i:j+3]
            block = block.replace('?', '%s')
            out.append(block)
            i = j + 3
        else:
            out.append(text[i])
            i += 1
    return ''.join(out)

src = _replace_q_in_sql_strings(src)

# Y también en _locales_clause donde se generan strings simples con f-string
src = src.replace(
    'placeholders = ",".join(["?"] * len(vals))',
    'placeholders = ",".join(["%s"] * len(vals))',
)

PATH.write_text(src, encoding="utf-8")
print("OK informes.py reescrito")
