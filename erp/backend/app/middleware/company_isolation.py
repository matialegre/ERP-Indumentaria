"""
Middleware de aislamiento por empresa.
Asegura que cada request sólo acceda a datos de su propia empresa.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from jose import jwt, JWTError
from app.core.config import get_settings


class CompanyIsolationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extraer company_id del JWT si hay token
        request.state.company_id = None
        request.state.user_role = None
        request.state.user_id = None

        settings = get_settings()
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            try:
                payload = jwt.decode(
                    token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
                )
                request.state.company_id = payload.get("company_id")
                request.state.user_role = payload.get("role")
                request.state.user_id = payload.get("sub")
            except JWTError:
                pass  # Token inválido — se manejará en la autenticación normal

        response = await call_next(request)
        return response
