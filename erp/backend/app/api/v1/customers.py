"""
Router CRUD de Clientes / CRM — cuenta corriente, vehículos, búsqueda.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from pydantic import BaseModel
from datetime import date as _Date, datetime as _DateTime

from app.db.session import get_db
from app.models.customer import (
    Customer, CustomerCompany, Vehicle, AccountMovement,
    CustomerType, TaxCondition, FuelType,
    MovementType as AccMovementType,
)
from app.models.user import User, UserRole
from app.api.deps import get_current_user, require_roles
from app.api.module_guard import RequireModule


# ── Pydantic Schemas (inline) ─────────────────────────

# -- Vehicle --

class VehicleCreate(BaseModel):
    plate: str
    brand: str
    model: str
    year: int | None = None
    color: str | None = None
    vin: str | None = None
    engine_number: str | None = None
    fuel_type: str | None = None
    last_km: int | None = None
    last_service_date: _Date | None = None
    next_service_km: int | None = None
    next_service_date: _Date | None = None
    vtv_expiry: _Date | None = None
    insurance_company: str | None = None
    insurance_policy: str | None = None
    insurance_expiry: _Date | None = None
    notes: str | None = None


class VehicleUpdate(BaseModel):
    plate: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    color: str | None = None
    vin: str | None = None
    engine_number: str | None = None
    fuel_type: str | None = None
    last_km: int | None = None
    last_service_date: _Date | None = None
    next_service_km: int | None = None
    next_service_date: _Date | None = None
    vtv_expiry: _Date | None = None
    insurance_company: str | None = None
    insurance_policy: str | None = None
    insurance_expiry: _Date | None = None
    notes: str | None = None
    is_active: bool | None = None


class VehicleOut(BaseModel):
    id: int
    customer_id: int
    plate: str
    brand: str
    model: str
    year: int | None = None
    color: str | None = None
    vin: str | None = None
    engine_number: str | None = None
    fuel_type: str | None = None
    last_km: int | None = None
    last_service_date: _Date | None = None
    next_service_km: int | None = None
    next_service_date: _Date | None = None
    vtv_expiry: _Date | None = None
    insurance_company: str | None = None
    insurance_policy: str | None = None
    insurance_expiry: _Date | None = None
    notes: str | None = None
    is_active: bool = True
    created_at: _DateTime | None = None
    updated_at: _DateTime | None = None
    model_config = {"from_attributes": True}


# -- CustomerCompany --

class CustomerCompanyCreate(BaseModel):
    company_id: int
    credit_limit: float = 0
    payment_terms_days: int = 0
    price_list_id: int | None = None
    discount_pct: float = 0
    extra_data: dict | None = None
    internal_notes: str | None = None


class CustomerCompanyUpdate(BaseModel):
    credit_limit: float | None = None
    payment_terms_days: int | None = None
    price_list_id: int | None = None
    discount_pct: float | None = None
    extra_data: dict | None = None
    internal_notes: str | None = None
    is_active: bool | None = None


class CustomerCompanyOut(BaseModel):
    id: int
    customer_id: int
    company_id: int
    company_name: str | None = None
    credit_limit: float = 0
    payment_terms_days: int = 0
    price_list_id: int | None = None
    discount_pct: float = 0
    balance: float = 0
    extra_data: dict | None = None
    is_active: bool = True
    internal_notes: str | None = None
    credit_alert: bool = False
    created_at: _DateTime | None = None
    updated_at: _DateTime | None = None
    model_config = {"from_attributes": True}


# -- Customer --

class CustomerCreate(BaseModel):
    cuit_dni: str
    customer_type: str = "CONSUMIDOR_FINAL"
    first_name: str | None = None
    last_name: str | None = None
    business_name: str | None = None
    phone: str | None = None
    phone2: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    notes: str | None = None
    tax_condition: str | None = None
    # Datos comerciales para la empresa del usuario
    credit_limit: float = 0
    payment_terms_days: int = 0
    price_list_id: int | None = None
    discount_pct: float = 0
    extra_data: dict | None = None


class CustomerUpdate(BaseModel):
    cuit_dni: str | None = None
    customer_type: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    business_name: str | None = None
    phone: str | None = None
    phone2: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    notes: str | None = None
    tax_condition: str | None = None


class CustomerOut(BaseModel):
    id: int
    cuit_dni: str
    customer_type: str
    tax_condition: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    business_name: str | None = None
    display_name: str
    phone: str | None = None
    phone2: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    notes: str | None = None
    is_active: bool = True
    company_data: list[CustomerCompanyOut] = []
    vehicles: list[VehicleOut] = []
    created_at: _DateTime | None = None
    updated_at: _DateTime | None = None
    model_config = {"from_attributes": True}


class CustomerListOut(BaseModel):
    """Versión resumida para listados"""
    id: int
    cuit_dni: str
    customer_type: str
    display_name: str
    phone: str | None = None
    email: str | None = None
    city: str | None = None
    is_active: bool = True
    balance: float | None = None
    credit_limit: float | None = None
    credit_alert: bool = False
    model_config = {"from_attributes": True}


# -- AccountMovement --

class AccountMovementOut(BaseModel):
    id: int
    customer_company_id: int
    movement_type: str
    reference_type: str | None = None
    reference_id: int | None = None
    amount: float
    balance_after: float
    description: str
    date: _Date
    created_by_id: int
    created_by_name: str | None = None
    created_at: _DateTime | None = None
    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    amount: float
    description: str | None = "Pago"
    date: _Date | None = None
    reference_type: str | None = None
    reference_id: int | None = None


class AccountSummaryOut(BaseModel):
    customer_id: int
    company_id: int
    customer_name: str
    company_name: str | None = None
    balance: float = 0
    credit_limit: float = 0
    credit_alert: bool = False
    payment_terms_days: int = 0
    model_config = {"from_attributes": True}


# ── Router ─────────────────────────────────────────────

router = APIRouter(
    prefix="/customers",
    tags=["clientes / CRM"],
    dependencies=[Depends(RequireModule("CRM"))],
)


# ── Helpers ────────────────────────────────────────────

def _build_display_name(data) -> str:
    """Genera display_name: 'Apellido, Nombre' o razón social"""
    if hasattr(data, "business_name") and data.business_name:
        return data.business_name
    parts = []
    last = getattr(data, "last_name", None)
    first = getattr(data, "first_name", None)
    if last:
        parts.append(last)
    if first:
        parts.append(first)
    return ", ".join(parts) if parts else data.cuit_dni


def _company_filter_customer(q, user: User, db: Session):
    """Filtra clientes que tengan relación con la empresa del usuario"""
    if user.company_id:
        q = q.filter(
            Customer.company_data.any(CustomerCompany.company_id == user.company_id)
        )
    return q


def _get_customer_or_404(customer_id: int, db: Session, user: User) -> Customer:
    cust = db.query(Customer).get(customer_id)
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")
    if user.company_id:
        has_rel = any(cd.company_id == user.company_id for cd in cust.company_data)
        if not has_rel:
            raise HTTPException(403, "Sin acceso a este cliente")
    return cust


def _get_custcomp_or_404(
    customer_id: int, company_id: int, db: Session, user: User,
) -> CustomerCompany:
    if user.company_id and user.company_id != company_id:
        raise HTTPException(403, "Sin acceso a esta empresa")
    cc = db.query(CustomerCompany).filter(
        CustomerCompany.customer_id == customer_id,
        CustomerCompany.company_id == company_id,
    ).first()
    if not cc:
        raise HTTPException(404, "Relación cliente-empresa no encontrada")
    return cc


def _custcomp_out(cc: CustomerCompany) -> CustomerCompanyOut:
    bal = float(cc.balance or 0)
    cl = float(cc.credit_limit or 0)
    alert = cl > 0 and bal > cl
    return CustomerCompanyOut(
        id=cc.id,
        customer_id=cc.customer_id,
        company_id=cc.company_id,
        company_name=cc.company.name if cc.company else None,
        credit_limit=cl,
        payment_terms_days=cc.payment_terms_days,
        price_list_id=cc.price_list_id,
        discount_pct=float(cc.discount_pct or 0),
        balance=bal,
        extra_data=cc.extra_data,
        is_active=cc.is_active,
        internal_notes=cc.internal_notes,
        credit_alert=alert,
        created_at=cc.created_at,
        updated_at=cc.updated_at,
    )


def _customer_list_out(cust: Customer, company_id: int | None) -> CustomerListOut:
    bal = None
    cl = None
    alert = False
    if company_id:
        cc = next((cd for cd in cust.company_data if cd.company_id == company_id), None)
        if cc:
            bal = float(cc.balance or 0)
            cl = float(cc.credit_limit or 0)
            alert = cl > 0 and bal > cl
    return CustomerListOut(
        id=cust.id,
        cuit_dni=cust.cuit_dni,
        customer_type=cust.customer_type.value,
        display_name=cust.display_name,
        phone=cust.phone,
        email=cust.email,
        city=cust.city,
        is_active=cust.is_active,
        balance=bal,
        credit_limit=cl,
        credit_alert=alert,
    )


def _customer_out(cust: Customer) -> CustomerOut:
    return CustomerOut(
        id=cust.id,
        cuit_dni=cust.cuit_dni,
        customer_type=cust.customer_type.value,
        tax_condition=cust.tax_condition.value if cust.tax_condition else None,
        first_name=cust.first_name,
        last_name=cust.last_name,
        business_name=cust.business_name,
        display_name=cust.display_name,
        phone=cust.phone,
        phone2=cust.phone2,
        email=cust.email,
        address=cust.address,
        city=cust.city,
        province=cust.province,
        postal_code=cust.postal_code,
        notes=cust.notes,
        is_active=cust.is_active,
        company_data=[_custcomp_out(cd) for cd in cust.company_data],
        vehicles=[VehicleOut.model_validate(v) for v in cust.vehicles],
        created_at=cust.created_at,
        updated_at=cust.updated_at,
    )


def _movement_out(m: AccountMovement) -> AccountMovementOut:
    return AccountMovementOut(
        id=m.id,
        customer_company_id=m.customer_company_id,
        movement_type=m.movement_type.value,
        reference_type=m.reference_type,
        reference_id=m.reference_id,
        amount=float(m.amount),
        balance_after=float(m.balance_after),
        description=m.description,
        date=m.date,
        created_by_id=m.created_by_id,
        created_by_name=m.created_by.full_name if m.created_by else None,
        created_at=m.created_at,
    )


# ══════════════════════════════════════════════════════
# CUSTOMERS CRUD
# ══════════════════════════════════════════════════════

@router.get("/search")
def search_customers(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Búsqueda rápida por nombre, CUIT, teléfono o patente"""
    term = f"%{q.strip()}%"

    query = db.query(Customer).filter(Customer.is_active == True)

    if current_user.company_id:
        query = query.filter(
            Customer.company_data.any(CustomerCompany.company_id == current_user.company_id)
        )

    # Buscar en clientes
    results = query.filter(
        or_(
            Customer.display_name.ilike(term),
            Customer.cuit_dni.ilike(term),
            Customer.phone.ilike(term),
            Customer.phone2.ilike(term),
            Customer.email.ilike(term),
        )
    ).limit(limit).all()

    # Buscar por patente de vehículo
    if not results:
        vehicle_custs = (
            db.query(Customer)
            .join(Vehicle, Vehicle.customer_id == Customer.id)
            .filter(Vehicle.plate.ilike(term), Vehicle.is_active == True)
        )
        if current_user.company_id:
            vehicle_custs = vehicle_custs.filter(
                Customer.company_data.any(
                    CustomerCompany.company_id == current_user.company_id
                )
            )
        results = vehicle_custs.limit(limit).all()

    return [_customer_list_out(c, current_user.company_id) for c in results]


@router.get("/", response_model=dict)
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Listar clientes con paginación y filtro"""
    query = db.query(Customer)

    if current_user.company_id:
        query = query.filter(
            Customer.company_data.any(CustomerCompany.company_id == current_user.company_id)
        )

    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.display_name.ilike(term),
                Customer.cuit_dni.ilike(term),
                Customer.phone.ilike(term),
                Customer.email.ilike(term),
            )
        )

    total = query.count()
    customers = (
        query
        .order_by(Customer.display_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [_customer_list_out(c, current_user.company_id) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post("/", response_model=CustomerOut, status_code=201)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crear cliente + relación comercial con la empresa del usuario"""
    # Verificar CUIT/DNI único
    existing = db.query(Customer).filter(Customer.cuit_dni == body.cuit_dni).first()
    if existing:
        # Si ya existe pero no está vinculado a esta empresa, vincular
        if current_user.company_id:
            already_linked = any(
                cd.company_id == current_user.company_id for cd in existing.company_data
            )
            if already_linked:
                raise HTTPException(409, f"Ya existe un cliente con CUIT/DNI {body.cuit_dni} en esta empresa")
            # Vincular a la empresa del usuario
            cc = CustomerCompany(
                customer_id=existing.id,
                company_id=current_user.company_id,
                credit_limit=body.credit_limit,
                payment_terms_days=body.payment_terms_days,
                price_list_id=body.price_list_id,
                discount_pct=body.discount_pct,
                extra_data=body.extra_data,
            )
            db.add(cc)
            db.commit()
            db.refresh(existing)
            return _customer_out(existing)
        raise HTTPException(409, f"Ya existe un cliente con CUIT/DNI {body.cuit_dni}")

    # Crear customer master
    cust = Customer(
        cuit_dni=body.cuit_dni,
        customer_type=CustomerType(body.customer_type),
        first_name=body.first_name,
        last_name=body.last_name,
        business_name=body.business_name,
        display_name=_build_display_name(body),
        phone=body.phone,
        phone2=body.phone2,
        email=body.email,
        address=body.address,
        city=body.city,
        province=body.province,
        postal_code=body.postal_code,
        notes=body.notes,
        tax_condition=TaxCondition(body.tax_condition) if body.tax_condition else None,
    )
    db.add(cust)
    db.flush()

    # Crear relación comercial con la empresa del usuario
    if current_user.company_id:
        cc = CustomerCompany(
            customer_id=cust.id,
            company_id=current_user.company_id,
            credit_limit=body.credit_limit,
            payment_terms_days=body.payment_terms_days,
            price_list_id=body.price_list_id,
            discount_pct=body.discount_pct,
            extra_data=body.extra_data,
        )
        db.add(cc)

    db.commit()
    db.refresh(cust)
    return _customer_out(cust)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _get_customer_or_404(customer_id, db, current_user)
    return _customer_out(cust)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar datos maestros (se propaga a todas las empresas)"""
    cust = _get_customer_or_404(customer_id, db, current_user)

    update_data = body.model_dump(exclude_unset=True)

    # Verificar unicidad de cuit_dni si se cambia
    if "cuit_dni" in update_data and update_data["cuit_dni"] != cust.cuit_dni:
        dup = db.query(Customer).filter(
            Customer.cuit_dni == update_data["cuit_dni"],
            Customer.id != cust.id,
        ).first()
        if dup:
            raise HTTPException(409, f"Ya existe un cliente con CUIT/DNI {update_data['cuit_dni']}")

    # Mapear tax_condition string a enum
    if "tax_condition" in update_data:
        val = update_data.pop("tax_condition")
        cust.tax_condition = TaxCondition(val) if val else None

    if "customer_type" in update_data:
        val = update_data.pop("customer_type")
        cust.customer_type = CustomerType(val)

    for k, v in update_data.items():
        setattr(cust, k, v)

    # Recalcular display_name
    cust.display_name = _build_display_name(cust)

    db.commit()
    db.refresh(cust)
    return _customer_out(cust)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete — desactiva el cliente"""
    cust = _get_customer_or_404(customer_id, db, current_user)
    cust.is_active = False
    # Desactivar también las relaciones con empresas
    for cd in cust.company_data:
        cd.is_active = False
    db.commit()
    return {"detail": "Cliente desactivado"}


# ══════════════════════════════════════════════════════
# CUSTOMER ↔ COMPANY
# ══════════════════════════════════════════════════════

@router.post("/{customer_id}/companies", response_model=CustomerCompanyOut, status_code=201)
def link_customer_to_company(
    customer_id: int,
    body: CustomerCompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.MEGAADMIN, UserRole.SUPERADMIN, UserRole.ADMIN,
    )),
):
    """Vincular un cliente existente a una empresa con condiciones comerciales"""
    cust = _get_customer_or_404(customer_id, db, current_user)

    # Verificar que no exista ya la relación
    existing = db.query(CustomerCompany).filter(
        CustomerCompany.customer_id == customer_id,
        CustomerCompany.company_id == body.company_id,
    ).first()
    if existing:
        raise HTTPException(409, "El cliente ya está vinculado a esta empresa")

    cc = CustomerCompany(
        customer_id=customer_id,
        company_id=body.company_id,
        credit_limit=body.credit_limit,
        payment_terms_days=body.payment_terms_days,
        price_list_id=body.price_list_id,
        discount_pct=body.discount_pct,
        extra_data=body.extra_data,
        internal_notes=body.internal_notes,
    )
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return _custcomp_out(cc)


@router.put("/{customer_id}/companies/{company_id}", response_model=CustomerCompanyOut)
def update_customer_company(
    customer_id: int,
    company_id: int,
    body: CustomerCompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualizar condiciones comerciales para una empresa"""
    cc = _get_custcomp_or_404(customer_id, company_id, db, current_user)

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cc, k, v)

    db.commit()
    db.refresh(cc)
    return _custcomp_out(cc)


# ══════════════════════════════════════════════════════
# CUENTA CORRIENTE
# ══════════════════════════════════════════════════════

@router.get("/{customer_id}/account/{company_id}", response_model=AccountSummaryOut)
def get_account_summary(
    customer_id: int,
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resumen de cuenta corriente para una empresa"""
    cc = _get_custcomp_or_404(customer_id, company_id, db, current_user)
    cust = db.query(Customer).get(customer_id)
    bal = float(cc.balance or 0)
    cl = float(cc.credit_limit or 0)
    return AccountSummaryOut(
        customer_id=customer_id,
        company_id=company_id,
        customer_name=cust.display_name if cust else "",
        company_name=cc.company.name if cc.company else None,
        balance=bal,
        credit_limit=cl,
        credit_alert=cl > 0 and bal > cl,
        payment_terms_days=cc.payment_terms_days,
    )


@router.get("/{customer_id}/account/{company_id}/statement", response_model=list[AccountMovementOut])
def get_account_statement(
    customer_id: int,
    company_id: int,
    from_date: _Date | None = None,
    to_date: _Date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Estado de cuenta — lista de movimientos"""
    cc = _get_custcomp_or_404(customer_id, company_id, db, current_user)

    query = db.query(AccountMovement).filter(
        AccountMovement.customer_company_id == cc.id,
    )

    if from_date:
        query = query.filter(AccountMovement.date >= from_date)
    if to_date:
        query = query.filter(AccountMovement.date <= to_date)

    movements = (
        query
        .order_by(AccountMovement.date.desc(), AccountMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return [_movement_out(m) for m in movements]


@router.post("/{customer_id}/account/{company_id}/payment", response_model=AccountMovementOut, status_code=201)
def register_payment(
    customer_id: int,
    company_id: int,
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registrar un pago del cliente (reduce balance)"""
    cc = _get_custcomp_or_404(customer_id, company_id, db, current_user)

    if body.amount <= 0:
        raise HTTPException(400, "El monto del pago debe ser positivo")

    # El pago reduce el balance (amount negativo en el movimiento)
    new_balance = float(cc.balance or 0) - body.amount

    mov = AccountMovement(
        customer_company_id=cc.id,
        movement_type=AccMovementType.PAGO,
        reference_type=body.reference_type,
        reference_id=body.reference_id,
        amount=-body.amount,
        balance_after=new_balance,
        description=body.description or "Pago",
        date=body.date or _Date.today(),
        created_by_id=current_user.id,
    )
    db.add(mov)

    # Actualizar balance en la relación
    cc.balance = new_balance

    # Alerta de crédito (no bloquea)
    credit_limit = float(cc.credit_limit or 0)
    db.commit()
    db.refresh(mov)

    result = _movement_out(mov)

    return result


# ══════════════════════════════════════════════════════
# VEHICLES
# ══════════════════════════════════════════════════════

@router.get("/{customer_id}/vehicles", response_model=list[VehicleOut])
def list_vehicles(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _get_customer_or_404(customer_id, db, current_user)
    return [VehicleOut.model_validate(v) for v in cust.vehicles if v.is_active]


@router.post("/{customer_id}/vehicles", response_model=VehicleOut, status_code=201)
def create_vehicle(
    customer_id: int,
    body: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = _get_customer_or_404(customer_id, db, current_user)

    # Verificar patente única
    dup = db.query(Vehicle).filter(Vehicle.plate == body.plate.upper().strip()).first()
    if dup:
        raise HTTPException(409, f"Ya existe un vehículo con patente {body.plate}")

    veh = Vehicle(
        customer_id=cust.id,
        plate=body.plate.upper().strip(),
        brand=body.brand,
        model=body.model,
        year=body.year,
        color=body.color,
        vin=body.vin,
        engine_number=body.engine_number,
        fuel_type=FuelType(body.fuel_type) if body.fuel_type else None,
        last_km=body.last_km,
        last_service_date=body.last_service_date,
        next_service_km=body.next_service_km,
        next_service_date=body.next_service_date,
        vtv_expiry=body.vtv_expiry,
        insurance_company=body.insurance_company,
        insurance_policy=body.insurance_policy,
        insurance_expiry=body.insurance_expiry,
        notes=body.notes,
    )
    db.add(veh)
    db.commit()
    db.refresh(veh)
    return VehicleOut.model_validate(veh)


@router.put("/{customer_id}/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    customer_id: int,
    vehicle_id: int,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_customer_or_404(customer_id, db, current_user)

    veh = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.customer_id == customer_id,
    ).first()
    if not veh:
        raise HTTPException(404, "Vehículo no encontrado")

    update_data = body.model_dump(exclude_unset=True)

    # Verificar patente única si se cambia
    if "plate" in update_data:
        new_plate = update_data["plate"].upper().strip()
        dup = db.query(Vehicle).filter(
            Vehicle.plate == new_plate, Vehicle.id != veh.id,
        ).first()
        if dup:
            raise HTTPException(409, f"Ya existe un vehículo con patente {new_plate}")
        update_data["plate"] = new_plate

    if "fuel_type" in update_data:
        val = update_data.pop("fuel_type")
        veh.fuel_type = FuelType(val) if val else None

    for k, v in update_data.items():
        setattr(veh, k, v)

    db.commit()
    db.refresh(veh)
    return VehicleOut.model_validate(veh)


# ══════════════════════════════════════════════════════
# VEHICLE HISTORY (por patente)
# ══════════════════════════════════════════════════════

@router.get("/vehicles/{plate}/history")
def vehicle_history(
    plate: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historial de un vehículo por patente (OTs, etc.)"""
    veh = db.query(Vehicle).filter(Vehicle.plate == plate.upper().strip()).first()
    if not veh:
        raise HTTPException(404, "Vehículo no encontrado")

    # Verificar acceso
    if current_user.company_id:
        cust = db.query(Customer).get(veh.customer_id)
        if cust:
            has_rel = any(cd.company_id == current_user.company_id for cd in cust.company_data)
            if not has_rel:
                raise HTTPException(403, "Sin acceso")

    result = {
        "vehicle": VehicleOut.model_validate(veh),
        "work_orders": [],
    }

    # Buscar OTs asociadas a esta patente
    try:
        from app.models.work_order import WorkOrder
        wos = db.query(WorkOrder).filter(
            WorkOrder.plate == plate.upper().strip(),
        )
        if current_user.company_id:
            wos = wos.filter(WorkOrder.company_id == current_user.company_id)
        wos = wos.order_by(WorkOrder.created_at.desc()).limit(50).all()
        result["work_orders"] = [
            {
                "id": wo.id,
                "number": wo.number,
                "status": wo.status.value,
                "km_in": wo.km_in,
                "km_out": wo.km_out,
                "received_at": wo.received_at.isoformat() if wo.received_at else None,
                "delivered_at": wo.delivered_at.isoformat() if wo.delivered_at else None,
                "estimated_total": float(wo.estimated_total) if wo.estimated_total else None,
                "final_total": float(wo.final_total) if wo.final_total else None,
            }
            for wo in wos
        ]
    except Exception:
        pass

    return result
