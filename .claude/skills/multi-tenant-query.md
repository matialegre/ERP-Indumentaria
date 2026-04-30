---
name: multi-tenant-query
description: Pattern for safely querying tenant-scoped data. Required for every endpoint that touches user-owned data.
---

# Multi-Tenant Query Skill

## Core rule

Every query to a model with `company_id` **must filter by `current_user.company_id`** unless the user is MEGAADMIN or SUPERADMIN.

## Standard pattern

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.my_entity import MyEntity

router = APIRouter(prefix="/my-entity", tags=["MyEntity"])

def _scope_query(q, user: User):
    """Apply company_id scope unless user is super-role."""
    if user.role not in ("MEGAADMIN", "SUPERADMIN"):
        q = q.filter(MyEntity.company_id == user.company_id)
    return q

@router.get("/")
def list_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MyEntity)
    q = _scope_query(q, current_user)
    return q.all()

@router.get("/{entity_id}")
def get_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MyEntity).filter(MyEntity.id == entity_id)
    q = _scope_query(q, current_user)
    obj = q.first()
    if not obj:
        raise HTTPException(404, "No encontrado")
    return obj

@router.post("/")
def create_entity(
    body: MyEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = MyEntity(
        **body.model_dump(),
        company_id=current_user.company_id,  # enforce scope on write
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
```

## Module-gated endpoint

```python
from app.api.module_guard import RequireModule

@router.get("/", dependencies=[Depends(RequireModule("compras"))])
def list_entities(...):
    ...
```

## Role-gated endpoint

```python
from app.api.deps import require_roles

@router.post(
    "/",
    dependencies=[Depends(require_roles("ADMIN", "COMPRAS"))],
)
def create_entity(...):
    ...
```

## Common mistakes to avoid

- ❌ Forgetting the scope filter on a `GET /entity/{id}` endpoint (data leak across tenants)
- ❌ Using `current_user.company_id` on write without checking the user has one (MEGAADMIN can have NULL)
- ❌ Filtering on the joined table but not on the root table
- ❌ Trusting a `company_id` sent in the request body instead of the one on `current_user`

## Testing multi-tenant

Create two companies in seed data and verify:
- User of company A cannot read/modify rows of company B
- MEGAADMIN can see all
- Endpoints that accept `?company_id=` filter only honor it for MEGAADMIN
