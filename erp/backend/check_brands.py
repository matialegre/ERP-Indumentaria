from app.db.session import get_db
from sqlalchemy import text

db = next(get_db())
rows = db.execute(text("SELECT id, name, brands FROM providers WHERE brands IS NOT NULL AND brands != '' LIMIT 20")).fetchall()
print(f"Rows with brands: {len(rows)}")
for r in rows:
    print(f"  id={r[0]} name={r[1]} brands={r[2]}")

# Check if column exists
col_check = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='providers' AND column_name='brands'")).fetchone()
print(f"Column 'brands' in schema: {col_check}")

# Check provider model
from app.models.provider import Provider
p = db.query(Provider).filter(Provider.id==314).first()
if p:
    print(f"Provider 314: name={p.name} brands={p.brands}")
    print(f"Has brands attr: {hasattr(p, 'brands')}")
else:
    print("Provider 314 not found")
