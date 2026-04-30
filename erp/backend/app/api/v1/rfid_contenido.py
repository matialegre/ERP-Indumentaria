"""
Router RFID Contenido — subida y gestión de archivos (imágenes, videos, PDFs, presentaciones).
Los archivos se guardan en D:/ERP MUNDO OUTDOOR/erp/rfid_contenido/<company_id>/
"""

import os
import uuid
import mimetypes
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.rfid import RFIDContenido
from app.api.deps import get_current_user, require_roles
from app.api.module_guard import RequireModule
from app.models.user import User

router = APIRouter(prefix="/rfid/contenido", tags=["RFID Contenido"])

# Directorio base para archivos RFID
BASE_DIR = Path(r"D:\ERP MUNDO OUTDOOR\erp\rfid_contenido")

ALLOWED_EXTENSIONS = {
    # Imágenes
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp",
    # Videos
    ".mp4", ".webm", ".mov", ".avi", ".mkv",
    # Documentos
    ".pdf", ".pptx", ".ppt", ".key", ".odp",
    # Otros
    ".xlsx", ".xls", ".docx", ".doc", ".zip",
}

MAX_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}


def _tipo_from_mime(mime: str, ext: str) -> str:
    mime = (mime or "").lower()
    ext = (ext or "").lower()
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    if mime == "application/pdf" or ext == ".pdf":
        return "pdf"
    return "other"


class ContenidoOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str]
    tipo: str
    nombre_original: str
    size_bytes: Optional[int]
    mime_type: Optional[str]
    path_archivo: str
    uploaded_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── GET /rfid/contenido ─────────────────────────────────────────────────────

@router.get(
    "",
    response_model=list[ContenidoOut],
    dependencies=[Depends(RequireModule("RFID_CONTENIDO"))],
)
def listar_contenido(
    tipo: Optional[str] = Query(None, description="image | video | pdf | other"),
    q: Optional[str] = Query(None, description="Buscar por nombre"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RFIDContenido)
    if current_user.company_id:
        query = query.filter(RFIDContenido.company_id == current_user.company_id)
    if q:
        query = query.filter(RFIDContenido.nombre.ilike(f"%{q}%"))
    items = query.order_by(RFIDContenido.created_at.desc()).all()
    result = []
    for item in items:
        ext = Path(item.nombre_original or item.path_archivo or "").suffix.lower()
        inferred_tipo = _tipo_from_mime(item.mime_type or "", ext)
        if tipo and inferred_tipo != tipo:
            continue
        out = ContenidoOut.model_validate(item)
        out.tipo = inferred_tipo
        out.uploaded_by = item.uploader.full_name if item.uploader else None
        result.append(out)
    return result


# ── POST /rfid/contenido/upload ─────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=ContenidoOut,
    dependencies=[Depends(RequireModule("RFID_CONTENIDO"))],
)
async def subir_archivo(
    file: UploadFile = File(...),
    nombre: str = Form(...),
    descripcion: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Tipo de archivo no permitido: {ext}")

    # Leer contenido
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(400, "El archivo supera el límite de 500 MB")

    # Determinar tipo y mime
    mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    tipo = _tipo_from_mime(mime_type, ext)

    # Crear directorio por empresa (MEGAADMIN sin company → carpeta "0")
    company_id = current_user.company_id
    dest_dir = BASE_DIR / str(company_id or 0)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Nombre único para evitar colisiones
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = dest_dir / unique_name
    dest_path.write_bytes(content)

    path_relativo = f"{company_id or 0}/{unique_name}"

    item = RFIDContenido(
        company_id=company_id,
        nombre=nombre.strip() or file.filename,
        descripcion=descripcion.strip() or None,
        tipo=tipo,
        path_archivo=path_relativo,
        nombre_original=file.filename,
        size_bytes=len(content),
        mime_type=mime_type,
        uploaded_by_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    out = ContenidoOut.model_validate(item)
    out.uploaded_by = item.uploader.full_name if item.uploader else None
    return out


# ── DELETE /rfid/contenido/{id} ──────────────────────────────────────────────

@router.delete(
    "/{item_id}",
    dependencies=[Depends(RequireModule("RFID_CONTENIDO"))],
)
def eliminar_contenido(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(RFIDContenido).filter(RFIDContenido.id == item_id).first()
    if not item:
        raise HTTPException(404, "Archivo no encontrado")
    if current_user.company_id and item.company_id != current_user.company_id:
        raise HTTPException(403, "Sin acceso")

    # Eliminar archivo físico
    file_path = BASE_DIR / item.path_archivo
    if file_path.exists():
        file_path.unlink()

    db.delete(item)
    db.commit()
    return {"ok": True}


# ── PATCH /rfid/contenido/{id} ───────────────────────────────────────────────

class ContenidoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


@router.patch(
    "/{item_id}",
    response_model=ContenidoOut,
    dependencies=[Depends(RequireModule("RFID_CONTENIDO"))],
)
def actualizar_contenido(
    item_id: int,
    body: ContenidoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(RFIDContenido).filter(RFIDContenido.id == item_id).first()
    if not item:
        raise HTTPException(404, "Archivo no encontrado")
    if current_user.company_id and item.company_id != current_user.company_id:
        raise HTTPException(403, "Sin acceso")
    if body.nombre is not None:
        item.nombre = body.nombre
    if body.descripcion is not None:
        item.descripcion = body.descripcion
    db.commit()
    db.refresh(item)
    out = ContenidoOut.model_validate(item)
    out.uploaded_by = item.uploader.full_name if item.uploader else None
    return out
