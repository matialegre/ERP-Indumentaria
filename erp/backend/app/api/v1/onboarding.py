"""
Onboarding — herramientas de distribución y configuración inicial por empresa
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.db.session import get_db
from app.api.deps import require_mega_admin
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.module import CompanyModule, MODULES_CATALOG
from app.models.plan import Plan, CompanySubscription, SubscriptionStatus, PlanTier

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class QuickSetupRequest(BaseModel):
    """Setup rápido — crea empresa con todo en un solo paso"""
    # Empresa
    company_name: str
    cuit: str | None = None
    industry_type: str = "OTRO"

    # Branding (auto-generado si no se provee)
    primary_color: str | None = None

    # Admin
    admin_username: str
    admin_password: str
    admin_full_name: str
    admin_email: str | None = None

    # Plan
    plan_tier: str = "STARTER"  # FREE, STARTER, PRO, ENTERPRISE
    trial_days: int = 30


class QuickSetupResponse(BaseModel):
    company_id: int
    company_name: str
    admin_username: str
    modules_enabled: list[str]
    plan_name: str
    subscription_status: str
    expires_at: str | None
    login_url: str

    model_config = {"from_attributes": True}


class CompanyExportData(BaseModel):
    """Datos exportables de una empresa para backup/migración"""
    company: dict
    users: list[dict]
    modules: list[str]
    plan: dict | None
    subscription: dict | None

    model_config = {"from_attributes": True}


@router.post("/quick-setup", response_model=QuickSetupResponse)
def quick_setup(
    data: QuickSetupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mega_admin),
):
    """
    Setup rápido de empresa — crea todo en un paso:
    1. Empresa con branding por defecto según industria
    2. Módulos según template de industria
    3. Usuario admin
    4. Suscripción con trial
    """
    from app.core.security import hash_password

    # Templates por industria
    industry_modules = {
        "INDUMENTARIA": ["stock", "ventas", "compras", "facturacion", "ingresos", "pedidos", "proveedores", "clientes", "reportes", "configuracion", "consultas"],
        "KIOSCO": ["stock", "ventas", "facturacion", "proveedores", "reportes"],
        "MECANICO": ["stock", "facturacion", "clientes", "ingresos", "reportes", "configuracion"],
        "DEPOSITO": ["stock", "ingresos", "pedidos", "proveedores", "reportes", "monitoreo"],
        "RESTAURANTE": ["stock", "ventas", "facturacion", "proveedores", "reportes"],
        "FERRETERIA": ["stock", "ventas", "compras", "facturacion", "proveedores", "clientes", "reportes", "consultas"],
        "FARMACIA": ["stock", "ventas", "facturacion", "proveedores", "clientes", "reportes", "configuracion", "consultas"],
        "LIBRERIA": ["stock", "ventas", "facturacion", "proveedores", "reportes", "consultas"],
        "OTRO": ["stock", "ventas", "facturacion", "reportes", "configuracion"],
    }

    industry_colors = {
        "INDUMENTARIA": "#7c3aed", "KIOSCO": "#ea580c", "MECANICO": "#0284c7",
        "DEPOSITO": "#059669", "RESTAURANTE": "#dc2626", "FERRETERIA": "#78716c",
        "FARMACIA": "#16a34a", "LIBRERIA": "#8b5cf6", "OTRO": "#1e40af",
    }

    # Verificar username único
    existing = db.query(User).filter(User.username == data.admin_username).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"El usuario '{data.admin_username}' ya existe")

    # Verificar nombre de empresa único
    existing_co = db.query(Company).filter(Company.name == data.company_name).first()
    if existing_co:
        raise HTTPException(status_code=400, detail=f"La empresa '{data.company_name}' ya existe")

    industry = data.industry_type.upper()
    color = data.primary_color or industry_colors.get(industry, "#1e40af")

    # 1. Crear empresa
    company = Company(
        name=data.company_name,
        cuit=data.cuit,
        is_active=True,
        app_name=f"{data.company_name} ERP",
        short_name=data.company_name[:2].upper(),
        primary_color=color,
        secondary_color="#3b82f6",
        industry_type=industry,
    )
    db.add(company)
    db.flush()

    # 2. Crear módulos
    modules = industry_modules.get(industry, industry_modules["OTRO"])
    for slug in modules:
        db.add(CompanyModule(company_id=company.id, module_slug=slug, is_active=True))

    # 3. Crear admin
    admin = User(
        username=data.admin_username,
        hashed_password=hash_password(data.admin_password),
        full_name=data.admin_full_name,
        email=data.admin_email,
        role=UserRole.ADMIN,
        company_id=company.id,
        is_active=True,
    )
    db.add(admin)

    # 4. Asignar plan
    plan = db.query(Plan).filter(Plan.tier == data.plan_tier.upper()).first()
    if not plan:
        plan = db.query(Plan).filter(Plan.is_default == True).first()

    subscription = None
    if plan:
        subscription = CompanySubscription(
            company_id=company.id,
            plan_id=plan.id,
            status=SubscriptionStatus.TRIAL,
            started_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=data.trial_days) if data.trial_days > 0 else None,
        )
        db.add(subscription)

    db.commit()
    db.refresh(company)

    return QuickSetupResponse(
        company_id=company.id,
        company_name=company.name,
        admin_username=data.admin_username,
        modules_enabled=modules,
        plan_name=plan.name if plan else "Sin plan",
        subscription_status="TRIAL",
        expires_at=subscription.expires_at.isoformat() if subscription and subscription.expires_at else None,
        login_url=f"/login?company={company.id}",
    )


@router.get("/export/{company_id}", response_model=CompanyExportData)
def export_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mega_admin),
):
    """Exporta toda la configuración de una empresa (backup/migración)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    users = db.query(User).filter(User.company_id == company_id).all()
    modules = db.query(CompanyModule).filter(
        CompanyModule.company_id == company_id,
        CompanyModule.is_active == True,
    ).all()

    sub = db.query(CompanySubscription).filter(
        CompanySubscription.company_id == company_id
    ).order_by(CompanySubscription.created_at.desc()).first()

    plan_data = None
    sub_data = None
    if sub:
        sub_data = {
            "status": sub.status.value,
            "started_at": sub.started_at.isoformat() if sub.started_at else None,
            "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        }
        if sub.plan:
            plan_data = {
                "name": sub.plan.name,
                "tier": sub.plan.tier.value,
                "max_users": sub.plan.max_users,
                "max_locals": sub.plan.max_locals,
                "max_products": sub.plan.max_products,
                "max_modules": sub.plan.max_modules,
            }

    return CompanyExportData(
        company={
            "name": company.name,
            "cuit": company.cuit,
            "industry_type": company.industry_type.value if company.industry_type else None,
            "app_name": company.app_name,
            "primary_color": company.primary_color,
            "secondary_color": company.secondary_color,
        },
        users=[{"username": u.username, "full_name": u.full_name, "role": u.role.value, "is_active": u.is_active} for u in users],
        modules=[m.module_slug for m in modules],
        plan=plan_data,
        subscription=sub_data,
    )


@router.get("/health/{company_id}")
def company_health(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mega_admin),
):
    """Diagnóstico rápido de una empresa — verifica que todo esté configurado"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    users = db.query(User).filter(User.company_id == company_id, User.is_active == True).count()
    modules = db.query(CompanyModule).filter(CompanyModule.company_id == company_id, CompanyModule.is_active == True).count()
    has_admin = db.query(User).filter(
        User.company_id == company_id,
        User.role == UserRole.ADMIN,
        User.is_active == True,
    ).count() > 0

    sub = db.query(CompanySubscription).filter(
        CompanySubscription.company_id == company_id
    ).order_by(CompanySubscription.created_at.desc()).first()

    issues = []
    if not has_admin:
        issues.append("⚠️ Sin usuario administrador activo")
    if modules == 0:
        issues.append("⚠️ Sin módulos habilitados")
    if not sub:
        issues.append("⚠️ Sin suscripción/plan asignado")
    elif sub.status == SubscriptionStatus.EXPIRED:
        issues.append("🔴 Suscripción vencida")
    elif sub.status == SubscriptionStatus.SUSPENDED:
        issues.append("🔴 Suscripción suspendida")
    elif sub.expires_at and sub.expires_at < datetime.utcnow():
        issues.append("🟡 Suscripción próxima a vencer o vencida")
    if not company.is_active:
        issues.append("🔴 Empresa desactivada")

    return {
        "company_id": company_id,
        "company_name": company.name,
        "is_active": company.is_active,
        "users_count": users,
        "modules_count": modules,
        "has_admin": has_admin,
        "subscription_status": sub.status.value if sub else None,
        "plan_name": sub.plan.name if sub and sub.plan else None,
        "healthy": len(issues) == 0,
        "issues": issues,
    }
