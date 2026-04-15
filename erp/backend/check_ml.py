from app.db.session import get_db
from sqlalchemy import text
db = next(get_db())
r = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'ml_%' ORDER BY table_name")).fetchall()
for x in r: print(x[0])
