from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os

from app.db.session import get_db
from app.models.mobile_improvement import MobileImprovement
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/mobile-app", tags=["mobile-app"])

# Ruta al APK en DISTRIBUIBLES
_APK_PATH = r"D:\ERP MUNDO OUTDOOR\DISTRIBUIBLES\ERP Mundo Outdoor.apk"


@router.get("/download-apk")
def download_apk(current_user: User = Depends(get_current_user)):
    """Sirve el APK Android para descarga directa."""
    if not os.path.exists(_APK_PATH):
        raise HTTPException(404, "APK no disponible. Compilar primero con Capacitor.")
    return FileResponse(
        path=_APK_PATH,
        filename="ERP-MundoOutdoor.apk",
        media_type="application/vnd.android.package-archive",
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class ImprovementCreate(BaseModel):
    title:       str
    description: Optional[str] = None
    platform:    str = "both"       # android / ios / both
    priority:    str = "NORMAL"
    category:    Optional[str] = None

class ImprovementUpdate(BaseModel):
    title:       Optional[str] = None
    description: Optional[str] = None
    platform:    Optional[str] = None
    priority:    Optional[str] = None
    category:    Optional[str] = None
    status:      Optional[str] = None
    admin_reply: Optional[str] = None

class ImprovementOut(BaseModel):
    id:          int
    title:       str
    description: Optional[str]
    platform:    str
    status:      str
    priority:    str
    category:    Optional[str]
    author_name: Optional[str]
    votes:       int
    admin_reply: Optional[str]
    created_at:  Optional[datetime]
    updated_at:  Optional[datetime]

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/improvements", response_model=List[ImprovementOut])
def list_improvements(
    platform: Optional[str] = None,
    status:   Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MobileImprovement)
    if current_user.company_id:
        q = q.filter(MobileImprovement.company_id == current_user.company_id)
    if platform and platform != "all":
        q = q.filter(MobileImprovement.platform == platform)
    if status and status != "all":
        q = q.filter(MobileImprovement.status == status)
    return q.order_by(MobileImprovement.created_at.desc()).all()


@router.post("/improvements", response_model=ImprovementOut)
def create_improvement(
    body: ImprovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    imp = MobileImprovement(
        title=body.title,
        description=body.description,
        platform=body.platform,
        priority=body.priority,
        category=body.category,
        author_name=current_user.full_name or current_user.username,
        author_id=current_user.id,
        company_id=current_user.company_id,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    return imp


@router.put("/improvements/{imp_id}", response_model=ImprovementOut)
def update_improvement(
    imp_id: int,
    body: ImprovementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    imp = db.query(MobileImprovement).filter(MobileImprovement.id == imp_id).first()
    if not imp:
        raise HTTPException(404, "Mejora no encontrada")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(imp, field, val)
    db.commit()
    db.refresh(imp)
    return imp


@router.delete("/improvements/{imp_id}")
def delete_improvement(
    imp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    imp = db.query(MobileImprovement).filter(MobileImprovement.id == imp_id).first()
    if not imp:
        raise HTTPException(404, "Mejora no encontrada")
    db.delete(imp)
    db.commit()
    return {"ok": True}


@router.post("/improvements/{imp_id}/vote")
def vote_improvement(
    imp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    imp = db.query(MobileImprovement).filter(MobileImprovement.id == imp_id).first()
    if not imp:
        raise HTTPException(404, "Mejora no encontrada")
    imp.votes = (imp.votes or 0) + 1
    db.commit()
    return {"votes": imp.votes}
