"""
Router CRUD de Usuarios
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserCreate
from app.core.security import hash_password
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Usuarios"])


class ModulesOverrideBody(BaseModel):
    modules_override: Optional[list] = None  # list[str] | None


@router.get("/")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if current_user.role != UserRole.SUPERADMIN and current_user.company_id:
        q = q.filter(User.company_id == current_user.company_id)
    if search:
        q = q.filter(
            (User.username.ilike(f"%{search}%"))
            | (User.full_name.ilike(f"%{search}%"))
        )
    if role:
        q = q.filter(User.role == role)
    q = q.order_by(User.id)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Scoping
    if current_user.role != UserRole.SUPERADMIN and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este usuario")
    return user


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    # No permitir crear SUPERADMIN
    if body.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo SUPERADMIN puede crear SUPERADMIN")
    # Username único
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="El username ya existe")
    # ADMIN fuerza su company_id
    company_id = body.company_id
    if current_user.role != UserRole.SUPERADMIN:
        company_id = current_user.company_id

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        company_id=company_id,
        is_active=True,
        modules_override=body.modules_override,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role != UserRole.SUPERADMIN and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    # Check username no choque con otro
    existing = db.query(User).filter(User.username == body.username, User.id != user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username ya existe")

    user.username = body.username
    user.full_name = body.full_name
    user.email = body.email
    user.role = body.role
    user.modules_override = body.modules_override
    if body.password:
        user.hashed_password = hash_password(body.password)
    if current_user.role == UserRole.SUPERADMIN:
        user.company_id = body.company_id

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/modules", response_model=UserOut)
def set_user_modules(
    user_id: int,
    body: ModulesOverrideBody,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Establece qué módulos puede ver el usuario (override). None = sin restricción."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    user.modules_override = body.modules_override
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés eliminarte a vos mismo")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    db.commit()


@router.patch("/{user_id}/toggle", response_model=UserOut)
def toggle_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés desactivarte a vos mismo")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
