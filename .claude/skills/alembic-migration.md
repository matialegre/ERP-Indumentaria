---
name: alembic-migration
description: Steps to safely add a database migration when changing SQLAlchemy models.
---

# Alembic Migration Skill

## When to use

After editing any file in `erp/backend/app/models/`.

## Steps

```powershell
cd "D:\ERP MUNDO OUTDOOR\erp\backend"
.\venv\Scripts\activate
alembic revision --autogenerate -m "descripcion corta y clara"
```

## Review the generated file

Open the newest file in `erp/backend/alembic/versions/` and check:

- [ ] New columns have correct types (`Numeric` for money, `DateTime(timezone=True)` for dates)
- [ ] Foreign keys have explicit `ondelete` behavior
- [ ] Enum changes are handled (autogenerate doesn't always catch)
- [ ] Default values are in the migration, not just the model
- [ ] No unrelated changes (autogenerate can detect ghost diffs)
- [ ] `down_revision` points to the latest existing migration
- [ ] Indexes for frequently queried columns are included

## Apply

```powershell
alembic upgrade head
```

## Verify

```powershell
# Check current revision
alembic current

# Check table structure
psql -h localhost -p 2048 -U erp_user -d erp_mundooutdoor -c "\d <table_name>"
```

## Rollback if needed (only local)

```powershell
alembic downgrade -1
```

## Rules

- **Never edit migrations** already in `alembic/versions/` that have been applied in production. Only add new ones.
- **Never commit a migration** you haven't verified locally.
- Multi-tenant tables always include `company_id` FK with an index.
- If adding a unique constraint, confirm there are no existing duplicates in the DB.
- `Base.metadata.create_all()` in `main.py` is a safety net, not a substitute for migrations.

## Production reminder

Production migrations are applied manually via SSH on the Windows Server. Never auto-run on production DBs.
