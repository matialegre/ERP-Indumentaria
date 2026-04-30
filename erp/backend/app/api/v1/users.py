"""
Router CRUD de Usuarios
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
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


class AdminPasswordReset(BaseModel):
    new_password: str


@router.get("/")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(User).options(joinedload(User.local))
    if current_user.role not in (UserRole.SUPERADMIN, UserRole.MEGAADMIN) and current_user.company_id:
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
    return {
        "items": [UserOut.from_user(u) for u in items],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).options(joinedload(User.local)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role not in (UserRole.SUPERADMIN, UserRole.MEGAADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso a este usuario")
    return UserOut.from_user(user)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    # No permitir crear SUPERADMIN
    if body.role == UserRole.SUPERADMIN and current_user.role not in (UserRole.SUPERADMIN, UserRole.MEGAADMIN):
        raise HTTPException(status_code=403, detail="Solo SUPERADMIN puede crear SUPERADMIN")
    # Username único
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="El username ya existe")
    # ADMIN fuerza su company_id
    company_id = body.company_id
    if current_user.role not in (UserRole.SUPERADMIN, UserRole.MEGAADMIN):
        company_id = current_user.company_id

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        email=body.email,
        role=body.role,
        company_id=company_id,
        local_id=body.local_id,
        is_active=True,
        modules_override=body.modules_override,
        profile_complete=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    user = db.query(User).options(joinedload(User.local)).filter(User.id == user.id).first()
    return UserOut.from_user(user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: UserCreate,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role not in (UserRole.SUPERADMIN, UserRole.MEGAADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    # Check username no choque con otro
    existing = db.query(User).filter(User.username == body.username, User.id != user_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username ya existe")

    user.username = body.username
    user.full_name = body.full_name
    user.email = body.email
    user.role = body.role
    user.local_id = body.local_id
    user.modules_override = body.modules_override
    if body.password:
        user.hashed_password = hash_password(body.password)
    if current_user.role in (UserRole.SUPERADMIN, UserRole.MEGAADMIN):
        user.company_id = body.company_id

    db.commit()
    user = db.query(User).options(joinedload(User.local)).filter(User.id == user.id).first()
    return UserOut.from_user(user)


@router.patch("/{user_id}/modules")
def set_user_modules(
    user_id: int,
    body: ModulesOverrideBody,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
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
    user = db.query(User).options(joinedload(User.local)).filter(User.id == user.id).first()
    return UserOut.from_user(user)


@router.patch("/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    body: AdminPasswordReset,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    """Admin resetea la contraseña de un usuario (sin necesitar la actual)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Contraseña muy corta (mín 4 caracteres)")
    user.hashed_password = hash_password(body.new_password)
    # Reset profile_complete so user can reconfigure on next login
    user.profile_complete = False
    db.commit()
    return {"message": f"Contraseña de '{user.username}' reseteada. Deberá configurar su perfil en el próximo login."}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés eliminarte a vos mismo")
    if current_user.role not in (UserRole.MEGAADMIN, UserRole.SUPERADMIN) and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    db.delete(user)
    db.commit()


@router.patch("/{user_id}/toggle")
def toggle_user(
    user_id: int,
    current_user: User = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.MEGAADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés desactivarte a vos mismo")
    user.is_active = not user.is_active
    db.commit()
    user = db.query(User).options(joinedload(User.local)).filter(User.id == user.id).first()
    return UserOut.from_user(user)
