"""
Router de autenticación — login + /me + profile setup
"""

import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

from app.db.session import get_db
from app.core.security import verify_password, hash_password, create_access_token
from app.models.user import User
from app.models.plan import CompanySubscription, SubscriptionStatus
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=Token)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario deshabilitado",
        )

    # ── Verificar licencia de la empresa ──────────────────────────────────
    if user.company_id:
        active_sub = (
            db.query(CompanySubscription)
            .filter(CompanySubscription.company_id == user.company_id)
            .order_by(CompanySubscription.created_at.desc())
            .first()
        )
        if active_sub:
            if active_sub.status == SubscriptionStatus.SUSPENDED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="LICENCIA_SUSPENDIDA: El acceso a este sistema ha sido suspendido. Contacte al administrador.",
                )
            if active_sub.status == SubscriptionStatus.CANCELLED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="LICENCIA_CANCELADA: La licencia de este sistema fue cancelada. Contacte al administrador.",
                )
    token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "company_id": user.company_id,
        }
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Re-query with joinedload to get local relationship
    user = db.query(User).options(joinedload(User.local)).filter(User.id == current_user.id).first()
    return UserOut.from_user(user)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/me/password")
def change_password(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


# ── Profile Setup (primera vez) ──────────────────────────────────────────

class ProfileSetup(BaseModel):
    full_name: str
    username: str
    new_password: Optional[str] = None
    email: Optional[str] = None


class EmailSetRequest(BaseModel):
    email: str


@router.put("/me/email")
def set_email(
    body: EmailSetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permite que cualquier usuario logueado registre/actualice su email.
    Se usa para forzar el registro de email cuando aún no lo cargó.
    """
    email = (body.email or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Email inválido. Verificá el formato (ej: nombre@dominio.com).")
    if len(email) > 254:
        raise HTTPException(400, "Email demasiado largo.")

    existing = (
        db.query(User)
        .filter(User.email == email, User.id != current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(409, "Ese email ya está registrado por otra cuenta.")

    current_user.email = email
    db.commit()

    user = db.query(User).options(joinedload(User.local)).filter(User.id == current_user.id).first()
    return {"user": UserOut.from_user(user)}


@router.put("/me/profile")
def setup_profile(
    body: ProfileSetup,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    El usuario configura su perfil la primera vez:
    - Elige su nombre completo
    - Elige su username (debe ser único)
    - Opcionalmente cambia contraseña
    """
    # Validate username length
    username = body.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(400, "El nombre de usuario debe tener al menos 3 caracteres")
    if not username.isalnum() and not all(c.isalnum() or c in ("_", ".") for c in username):
        raise HTTPException(400, "El nombre de usuario solo puede tener letras, números, punto y guion bajo")

    full_name = body.full_name.strip()
    if len(full_name) < 2:
        raise HTTPException(400, "El nombre completo es obligatorio")

    # Check username unique (excluding self)
    existing = db.query(User).filter(User.username == username, User.id != current_user.id).first()
    if existing:
        raise HTTPException(409, "Ese nombre de usuario ya está ocupado. Elegí otro.")

    current_user.username = username
    current_user.full_name = full_name
    current_user.profile_complete = True

    if body.email:
        email_norm = body.email.strip().lower()
        if not EMAIL_RE.match(email_norm):
            raise HTTPException(400, "Email inválido.")
        existing_email = (
            db.query(User)
            .filter(User.email == email_norm, User.id != current_user.id)
            .first()
        )
        if existing_email:
            raise HTTPException(409, "Ese email ya está registrado por otra cuenta.")
        current_user.email = email_norm

    if body.new_password:
        if len(body.new_password) < 4:
            raise HTTPException(400, "La contraseña debe tener al menos 4 caracteres")
        current_user.hashed_password = hash_password(body.new_password)

    db.commit()

    # Refresh with local
    user = db.query(User).options(joinedload(User.local)).filter(User.id == current_user.id).first()

    # Issue new token with updated username
    token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "company_id": user.company_id,
        }
    )
    return {
        "user": UserOut.from_user(user),
        "access_token": token,
        "token_type": "bearer",
    }
