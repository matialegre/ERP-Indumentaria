"""
Guard de módulos — verifica que la empresa tenga habilitado el módulo antes de permitir acceso.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_user


class RequireModule:
    """
    Dependency que verifica que el módulo esté habilitado para la empresa del usuario.

    Uso:
        @router.get("/", dependencies=[Depends(RequireModule("stock"))])
        def list_stock(...):
    """

    def __init__(self, module_slug: str):
        self.module_slug = module_slug

    def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        # MEGAADMIN y SUPERADMIN bypasean el check
        if current_user.role in (UserRole.MEGAADMIN, UserRole.SUPERADMIN):
            return current_user

        if not current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario sin empresa asignada",
            )

        # Verificar si el módulo está habilitado para la empresa
        from app.models.module import CompanyModule
        module = db.query(CompanyModule).filter(
            CompanyModule.company_id == current_user.company_id,
            CompanyModule.module_slug == self.module_slug,
            CompanyModule.is_active == True,
        ).first()

        if not module:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo '{self.module_slug}' no está habilitado para tu empresa",
            )

        return current_user
