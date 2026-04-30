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
    local_id: int | None = None
    local_name: str | None = None
    modules_override: Optional[list] = None
    modules_readonly: Optional[list] = None
    profile_complete: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, user):
        """Build UserOut with local_name populated from the relationship."""
        data = {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "company_id": user.company_id,
            "local_id": user.local_id,
            "local_name": user.local.name if user.local else None,
            "modules_override": user.modules_override,
            "modules_readonly": user.modules_readonly,
            "profile_complete": user.profile_complete,
            "created_at": user.created_at,
        }
        return cls(**data)


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: str | None = None
    role: UserRole = UserRole.VENDEDOR
    company_id: int | None = None
    local_id: int | None = None
    modules_override: Optional[list] = None  # slugs de módulos a mostrar (None = sin restricción)
