"""
Schemas Pydantic v2 — Auth
"""

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: str
    company_id: int | None = None


class LoginRequest(BaseModel):
    username: str
    password: str
