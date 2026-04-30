import os, psycopg2, pyodbc
os.environ['PGCLIENTENCODING'] = 'UTF8'
try:
    c = psycopg2.connect(host='localhost', port=2048, user='postgres', password='0896', dbname='postgres', client_encoding='UTF8')
    cur = c.cursor()
    cur.execute('SELECT version()')
    print('PG OK:', cur.fetchone()[0][:60])
    cur.execute("SELECT datname FROM pg_database WHERE datname LIKE '%snapshot%' OR datname LIKE '%erp%'")
    print('DBs:', cur.fetchall())
    c.close()
except Exception as e:
    print('PG FAIL:', repr(e))

try:
    print('Drivers:', [d for d in pyodbc.drivers()])
    cs = 'DRIVER={SQL Server};SERVER=192.168.0.109,9970;DATABASE=DATOS;UID=MUNDO;PWD=sanmartin126'
    c = pyodbc.connect(cs, timeout=10)
    cur = c.cursor()
    cur.execute('SELECT @@VERSION')
    print('SQLSRV OK:', cur.fetchone()[0][:60])
    c.close()
except Exception as e:
    print('SQLSRV FAIL:', repr(e))
