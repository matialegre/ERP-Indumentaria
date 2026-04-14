"""
Router de autenticación — login + /me
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

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
    # MEGAADMIN y usuarios sin empresa (SUPERADMIN plataforma) no se bloquean
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


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


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
