"""
Dependencias de la API — autenticación, permisos, scope multi-tenant
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import oauth2_scheme, decode_access_token
from app.models.user import User, UserRole
from app.models.plan import CompanySubscription, SubscriptionStatus


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    username: str | None = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    # Bloqueo instantáneo por licencia — aplica a cada request, no solo al login
    # MEGAADMIN (sin company_id) nunca se bloquea
    if user.company_id and user.role != UserRole.MEGAADMIN:
        sub = (
            db.query(CompanySubscription)
            .filter(CompanySubscription.company_id == user.company_id)
            .order_by(CompanySubscription.created_at.desc())
            .first()
        )
        if sub:
            if sub.status == SubscriptionStatus.SUSPENDED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="LICENCIA_SUSPENDIDA: El acceso a este sistema ha sido suspendido. Contacte al administrador.",
                )
            if sub.status == SubscriptionStatus.CANCELLED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="LICENCIA_CANCELADA: La licencia de este sistema fue cancelada. Contacte al administrador.",
                )

    return user


def require_roles(*roles: UserRole):
    """Dependency factory: requiere que el usuario tenga uno de los roles dados"""

    def _check(current_user: User = Depends(get_current_user)) -> User:
        # MEGAADMIN siempre pasa (accede a todo)
        if current_user.role == UserRole.MEGAADMIN:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol {current_user.role.value} no tiene permiso para esta acción",
            )
        return current_user

    return _check


def require_mega_admin(current_user: User = Depends(get_current_user)) -> User:
    """Solo MEGAADMIN puede acceder"""
    if current_user.role != UserRole.MEGAADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el administrador de la plataforma puede realizar esta acción",
        )
    return current_user
