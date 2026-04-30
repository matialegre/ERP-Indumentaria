"""
WebAuthn / Windows Hello — registro y autenticación biométrica
"""

import time
import base64
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

import webauthn
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    AuthenticatorAttachment,
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
from webauthn.helpers.exceptions import InvalidCBORData, InvalidAuthenticatorDataStructure

from app.db.session import get_db
from app.models.webauthn_credential import WebAuthnCredential
from app.models.user import User
from app.models.plan import CompanySubscription, SubscriptionStatus
from app.api.deps import get_current_user
from app.core.security import create_access_token

router = APIRouter(prefix="/auth/webauthn", tags=["WebAuthn"])

# ── Config ──────────────────────────────────────────────────────────────────
RP_NAME = "ERP Mundo Outdoor"
RP_ID   = "localhost"
ALLOWED_ORIGINS = [
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
]
CHALLENGE_TTL = 300  # segundos

# In-memory challenge store: challenge_b64 → { user_id, expires_at }
_challenges: dict[str, dict] = {}


def _store_challenge(user_id: int, challenge: bytes) -> str:
    c64 = base64.b64encode(challenge).decode()
    _expire_old()
    _challenges[c64] = {"user_id": user_id, "expires_at": time.time() + CHALLENGE_TTL}
    return c64


def _consume_challenge(c64: str, user_id: int) -> bool:
    entry = _challenges.pop(c64, None)
    if not entry:
        return False
    if entry["user_id"] != user_id:
        return False
    if time.time() > entry["expires_at"]:
        return False
    return True


def _expire_old():
    now = time.time()
    dead = [k for k, v in _challenges.items() if v["expires_at"] < now]
    for k in dead:
        del _challenges[k]


# ── Schemas ─────────────────────────────────────────────────────────────────

class RegisterBeginOut(BaseModel):
    challenge: str
    rp_id: str
    rp_name: str
    user_id: int
    user_name: str
    user_display_name: str


class RegisterCompleteIn(BaseModel):
    challenge: str
    credential_id: str
    client_data_json: str
    attestation_object: str
    device_name: Optional[str] = None


class AuthBeginIn(BaseModel):
    username: str


class AuthBeginOut(BaseModel):
    challenge: str
    rp_id: str
    user_id: int
    allow_credentials: list[str]


class AuthCompleteIn(BaseModel):
    username: str
    challenge: str
    credential_id: str
    client_data_json: str
    authenticator_data: str
    signature: str
    user_handle: Optional[str] = None


class CredentialOut(BaseModel):
    id: int
    device_name: Optional[str]
    is_active: bool
    created_at: Optional[str]
    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/register/begin", response_model=RegisterBeginOut)
def register_begin(
    current_user: User = Depends(get_current_user),
):
    challenge = secrets.token_bytes(32)
    _store_challenge(current_user.id, challenge)
    return RegisterBeginOut(
        challenge=base64.b64encode(challenge).decode(),
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=current_user.id,
        user_name=current_user.username,
        user_display_name=current_user.full_name or current_user.username,
    )


@router.post("/register/complete", status_code=201)
def register_complete(
    body: RegisterCompleteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _consume_challenge(body.challenge, current_user.id):
        raise HTTPException(400, "Challenge inválido o expirado")

    try:
        reg_credential = webauthn.verify_registration_response(
            credential=webauthn.RegistrationCredential(
                id=body.credential_id,
                raw_id=_b64decode_flex(body.credential_id),
                response=webauthn.AuthenticatorAttestationResponse(
                    client_data_json=_b64decode_flex(body.client_data_json),
                    attestation_object=_b64decode_flex(body.attestation_object),
                ),
                type="public-key",
            ),
            expected_challenge=base64.b64decode(body.challenge),
            expected_rp_id=RP_ID,
            expected_origin=ALLOWED_ORIGINS,
            require_user_verification=False,
        )
    except Exception as e:
        raise HTTPException(400, f"Registro WebAuthn fallido: {str(e)}")

    existing = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.credential_id == body.credential_id
    ).first()
    if existing:
        raise HTTPException(409, "Esta credencial ya está registrada")

    cred = WebAuthnCredential(
        user_id=current_user.id,
        credential_id=body.credential_id,
        public_key=base64.b64encode(reg_credential.credential_public_key).decode(),
        sign_count=reg_credential.sign_count,
        device_name=body.device_name,
        is_active=True,
    )
    db.add(cred)
    db.commit()
    return {"message": "Credencial registrada correctamente", "id": cred.id}


@router.post("/authenticate/begin", response_model=AuthBeginOut)
def authenticate_begin(
    body: AuthBeginIn,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == body.username).first()
    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    creds = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == user.id,
        WebAuthnCredential.is_active == True,
    ).all()
    if not creds:
        raise HTTPException(404, "No hay credencial biométrica registrada para este usuario")

    challenge = secrets.token_bytes(32)
    _store_challenge(user.id, challenge)

    return AuthBeginOut(
        challenge=base64.b64encode(challenge).decode(),
        rp_id=RP_ID,
        user_id=user.id,
        allow_credentials=[c.credential_id for c in creds],
    )


@router.post("/authenticate/complete")
def authenticate_complete(
    body: AuthCompleteIn,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not user.is_active:
        raise HTTPException(401, "Usuario no encontrado o deshabilitado")

    if not _consume_challenge(body.challenge, user.id):
        raise HTTPException(400, "Challenge inválido o expirado")

    cred_row = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.credential_id == body.credential_id,
        WebAuthnCredential.user_id == user.id,
        WebAuthnCredential.is_active == True,
    ).first()
    if not cred_row:
        raise HTTPException(404, "Credencial no encontrada")

    try:
        result = webauthn.verify_authentication_response(
            credential=webauthn.AuthenticationCredential(
                id=body.credential_id,
                raw_id=_b64decode_flex(body.credential_id),
                response=webauthn.AuthenticatorAssertionResponse(
                    client_data_json=_b64decode_flex(body.client_data_json),
                    authenticator_data=_b64decode_flex(body.authenticator_data),
                    signature=_b64decode_flex(body.signature),
                    user_handle=_b64decode_flex(body.user_handle) if body.user_handle else None,
                ),
                type="public-key",
            ),
            expected_challenge=base64.b64decode(body.challenge),
            expected_rp_id=RP_ID,
            expected_origin=ALLOWED_ORIGINS,
            credential_public_key=base64.b64decode(cred_row.public_key),
            credential_current_sign_count=cred_row.sign_count,
            require_user_verification=False,
        )
    except Exception as e:
        raise HTTPException(401, f"Verificación biométrica fallida: {str(e)}")

    cred_row.sign_count = result.new_sign_count
    db.commit()

    if user.company_id:
        active_sub = (
            db.query(CompanySubscription)
            .filter(CompanySubscription.company_id == user.company_id)
            .order_by(CompanySubscription.created_at.desc())
            .first()
        )
        if active_sub:
            if active_sub.status == SubscriptionStatus.SUSPENDED:
                raise HTTPException(403, "LICENCIA_SUSPENDIDA: El acceso ha sido suspendido.")
            if active_sub.status == SubscriptionStatus.CANCELLED:
                raise HTTPException(403, "LICENCIA_CANCELADA: La licencia fue cancelada.")

    token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "company_id": user.company_id,
        }
    )
    return {"access_token": token, "token_type": "bearer"}


@router.get("/credentials", response_model=list[CredentialOut])
def list_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    creds = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.user_id == current_user.id,
    ).all()
    return [
        CredentialOut(
            id=c.id,
            device_name=c.device_name,
            is_active=c.is_active,
            created_at=c.created_at.isoformat() if c.created_at else None,
        )
        for c in creds
    ]


@router.delete("/credentials/{cred_id}", status_code=204)
def delete_credential(
    cred_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cred = db.query(WebAuthnCredential).filter(
        WebAuthnCredential.id == cred_id,
        WebAuthnCredential.user_id == current_user.id,
    ).first()
    if not cred:
        raise HTTPException(404, "Credencial no encontrada")
    db.delete(cred)
    db.commit()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _b64decode_flex(s: str) -> bytes:
    """Acepta base64 estándar y base64url, con o sin padding."""
    s = s.replace("-", "+").replace("_", "/")
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    return base64.b64decode(s)
