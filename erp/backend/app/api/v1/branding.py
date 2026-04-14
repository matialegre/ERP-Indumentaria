"""
Router de branding — endpoint público para obtener config visual de la empresa
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.company import Company, IndustryType

router = APIRouter(prefix="/branding", tags=["branding"])


class BrandingOut(BaseModel):
    company_id: int | None = None
    app_name: str = "ERP Sistema"
    short_name: str = "ERP"
    primary_color: str = "#1e40af"
    secondary_color: str = "#3b82f6"
    logo_url: str | None = None
    favicon_url: str | None = None
    industry_type: str | None = None
    welcome_message: str | None = None
    company_name: str | None = None

    model_config = {"from_attributes": True}


# Defaults cuando no hay empresa o no tiene branding configurado
_DEFAULT_BRANDING = BrandingOut()


@router.get("/", response_model=BrandingOut)
def get_branding(
    company_id: int | None = Query(None, description="ID de empresa (opcional)"),
    db: Session = Depends(get_db),
):
    """
    Obtiene la configuración visual de una empresa.
    Público — se usa antes del login para mostrar el branding correcto.
    Si no se pasa company_id, devuelve el branding de la primera empresa activa.
    """
    if company_id:
        company = db.query(Company).filter(
            Company.id == company_id,
            Company.is_active == True,
        ).first()
    else:
        # Default: primera empresa activa
        company = db.query(Company).filter(
            Company.is_active == True,
        ).first()

    if not company:
        return _DEFAULT_BRANDING

    return BrandingOut(
        company_id=company.id,
        app_name=company.app_name or company.name or "ERP Sistema",
        short_name=company.short_name or (company.name or "ERP")[:2].upper(),
        primary_color=company.primary_color or "#1e40af",
        secondary_color=company.secondary_color or "#3b82f6",
        logo_url=company.logo_url,
        favicon_url=company.favicon_url,
        industry_type=company.industry_type.value if company.industry_type else None,
        welcome_message=company.welcome_message,
        company_name=company.name,
    )


@router.get("/icon/{company_id}")
def get_company_icon(company_id: int, db: Session = Depends(get_db)):
    """Get company icon as base64 data URI (public, no auth)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company or not company.icon_data:
        raise HTTPException(404, "Icon not found")
    return {"icon_data": company.icon_data}
