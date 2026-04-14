"""
Schemas Pydantic v2 — User
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.user import UserRole


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    email: str | None = None
    role: UserRole
    is_active: bool
    company_id: int | None = None
    modules_override: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str | None = None
    role: UserRole = UserRole.VENDEDOR
    company_id: int | None = None
    modules_override: Optional[list] = None  # slugs de módulos a mostrar (None = sin restricción)
