"""
employee_scores.py — CRUD de Puntuación de Empleados
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.employee_score import EmployeeScore, CATEGORIAS_DEFAULT
from app.models.sale import Sale, SaleStatus

router = APIRouter(prefix="/employee-scores", tags=["Puntuación de Empleados"])


# ── Schemas ────────────────────────────────────────────────────────────────

class ScoreCreate(BaseModel):
    employee_id: int
    categoria:   str
    puntuacion:  int
    comentario:  Optional[str] = None
    periodo:     str  # "YYYY-MM"

    @field_validator("puntuacion")
    @classmethod
    def check_range(cls, v):
        if not (1 <= v <= 10):
            raise ValueError("La puntuación debe estar entre 1 y 10")
        return v

    @field_validator("periodo")
    @classmethod
    def check_periodo(cls, v):
        import re
        if not re.match(r"^\d{4}-\d{2}$", v):
            raise ValueError("El periodo debe tener formato YYYY-MM")
        return v


class ScoreOut(BaseModel):
    id:            int
    employee_id:   int
    employee_name: str
    scored_by_id:  int
    scored_by_name: str
    categoria:     str
    puntuacion:    int
    comentario:    Optional[str] = None
    periodo:       str

    model_config = {"from_attributes": True}


class EmployeeSummary(BaseModel):
    employee_id:   int
    employee_name: str
    promedio:      float
    total_scores:  int
    por_categoria: dict[str, float]
    total_ventas:  float


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/categorias")
def get_categorias():
    """Devuelve las categorías por defecto disponibles para puntuar."""
    return {"categorias": CATEGORIAS_DEFAULT}


@router.get("", response_model=list[ScoreOut])
def list_scores(
    periodo:     Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    if user.company_id is None:
        raise HTTPException(400, "Sin empresa asignada")
    q = db.query(EmployeeScore).filter(EmployeeScore.company_id == user.company_id)
    if periodo:
        q = q.filter(EmployeeScore.periodo == periodo)
    if employee_id:
        q = q.filter(EmployeeScore.employee_id == employee_id)
    return [_to_out(s) for s in q.order_by(EmployeeScore.id.desc()).all()]


@router.get("/resumen", response_model=list[EmployeeSummary])
def get_resumen(
    periodo: Optional[str] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Resumen de promedios por empleado (opcionalmente filtrado por periodo)."""
    if user.company_id is None:
        raise HTTPException(400, "Sin empresa asignada")

    q = db.query(EmployeeScore).filter(EmployeeScore.company_id == user.company_id)
    if periodo:
        q = q.filter(EmployeeScore.periodo == periodo)
    scores = q.all()

    # Agrupar en Python
    emp_map: dict[int, dict] = {}
    for s in scores:
        eid = s.employee_id
        if eid not in emp_map:
            emp_map[eid] = {
                "employee_id":   eid,
                "employee_name": s.employee.full_name if s.employee else str(eid),
                "scores":        [],
                "por_cat":       {},
            }
        emp_map[eid]["scores"].append(s.puntuacion)
        cat = s.categoria
        if cat not in emp_map[eid]["por_cat"]:
            emp_map[eid]["por_cat"][cat] = []
        emp_map[eid]["por_cat"][cat].append(s.puntuacion)

    # Ventas por empleado para el periodo
    ventas_q = (
        db.query(Sale.created_by_id, func.coalesce(func.sum(Sale.total), 0))
        .filter(
            Sale.company_id == user.company_id,
            Sale.status != SaleStatus.ANULADA,
        )
    )
    if periodo:
        year, month = int(periodo[:4]), int(periodo[5:7])
        ventas_q = ventas_q.filter(
            extract("year", Sale.date) == year,
            extract("month", Sale.date) == month,
        )
    ventas_map = {uid: float(total) for uid, total in ventas_q.group_by(Sale.created_by_id).all()}

    result = []
    for info in emp_map.values():
        prom_cat = {cat: round(sum(vs)/len(vs), 2) for cat, vs in info["por_cat"].items()}
        result.append(EmployeeSummary(
            employee_id=info["employee_id"],
            employee_name=info["employee_name"],
            promedio=round(sum(info["scores"]) / len(info["scores"]), 2),
            total_scores=len(info["scores"]),
            por_categoria=prom_cat,
            total_ventas=ventas_map.get(info["employee_id"], 0.0),
        ))
    result.sort(key=lambda x: x.promedio, reverse=True)
    return result


@router.post("", response_model=ScoreOut, status_code=201)
def create_score(
    body: ScoreCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(
        UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SUPERVISOR,
    )),
):
    if user.company_id is None:
        raise HTTPException(400, "Sin empresa asignada")
    # Verificar que el empleado pertenece a la misma empresa
    emp = db.query(User).filter(User.id == body.employee_id, User.company_id == user.company_id).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado en esta empresa")

    score = EmployeeScore(
        company_id=user.company_id,
        employee_id=body.employee_id,
        scored_by_id=user.id,
        categoria=body.categoria,
        puntuacion=body.puntuacion,
        comentario=body.comentario,
        periodo=body.periodo,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return _to_out(score)


@router.delete("/{score_id}", status_code=204)
def delete_score(
    score_id: int,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_roles(UserRole.SUPERADMIN, UserRole.ADMIN)),
):
    score = db.query(EmployeeScore).filter(
        EmployeeScore.id == score_id,
        EmployeeScore.company_id == user.company_id,
    ).first()
    if not score:
        raise HTTPException(404, "Puntuación no encontrada")
    db.delete(score)
    db.commit()


# ── Helper ─────────────────────────────────────────────────────────────────

def _to_out(s: EmployeeScore) -> ScoreOut:
    return ScoreOut(
        id=s.id,
        employee_id=s.employee_id,
        employee_name=s.employee.full_name if s.employee else str(s.employee_id),
        scored_by_id=s.scored_by_id,
        scored_by_name=s.scored_by.full_name if s.scored_by else str(s.scored_by_id),
        categoria=s.categoria,
        puntuacion=s.puntuacion,
        comentario=s.comentario,
        periodo=s.periodo,
    )
