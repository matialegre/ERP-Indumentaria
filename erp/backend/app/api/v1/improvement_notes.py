from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone
import json
import os
import base64
import uuid

from app.db.session import get_db
from app.models.improvement_note import ImprovementNote
from app.api.deps import get_current_user
from app.models.user import User
from app.services.copilot_hook import trigger_copilot
from app.core.config import get_settings

router = APIRouter(prefix="/improvement-notes", tags=["improvement-notes"])

# Carpeta donde se guardan las imágenes de mejoras (accesible por Copilot)
MEJORAS_IMAGES_DIR = r"D:\ERP MUNDO OUTDOOR\erp\mejoras_images"
os.makedirs(MEJORAS_IMAGES_DIR, exist_ok=True)


def _save_base64_image(data_url: str, note_id: int, index: int) -> str:
    """Decode a base64 data URL, save to disk, return the relative URL path."""
    try:
        header, b64data = data_url.split(",", 1)
        ext = "png"
        if "image/jpeg" in header:
            ext = "jpg"
        elif "image/webp" in header:
            ext = "webp"
        elif "image/gif" in header:
            ext = "gif"

        filename = f"nota_{note_id}_{index}_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(MEJORAS_IMAGES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(b64data))
        return f"/mejoras-img/{filename}"
    except Exception:
        return data_url  # fallback: keep original if decode fails


def _process_images(images: List[str], note_id: int) -> List[str]:
    """Convert base64 data URLs to saved files, return list of URL paths."""
    result = []
    for i, img in enumerate(images):
        if img.startswith("data:image/"):
            result.append(_save_base64_image(img, note_id, i))
        else:
            result.append(img)  # already a path
    return result


def _image_disk_path(url_path: str) -> str:
    """Convert a /mejoras-img/filename URL to the absolute disk path."""
    if url_path.startswith("/mejoras-img/"):
        filename = url_path.split("/mejoras-img/", 1)[1]
        return os.path.join(MEJORAS_IMAGES_DIR, filename)
    return url_path


class NoteCreate(BaseModel):
    page: str
    page_label: Optional[str] = None
    text: str
    priority: str = "NORMAL"
    images: List[str] = []


class NoteUpdate(BaseModel):
    text: Optional[str] = None
    priority: Optional[str] = None
    images: Optional[List[str]] = None
    is_done: Optional[bool] = None


class NoteOut(BaseModel):
    id: int
    page: str
    page_label: Optional[str]
    text: str
    priority: str
    is_done: bool
    images: List[str]
    author_id: Optional[int]
    author_name: Optional[str]
    ai_reply: Optional[str]
    ai_reply_at: Optional[datetime]
    admin_note: Optional[str]
    admin_note_by: Optional[str]
    admin_note_at: Optional[datetime]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[NoteOut])
def list_notes(
    page: Optional[str] = None,
    include_done: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ImprovementNote)
    if page:
        q = q.filter(ImprovementNote.page == page)
    if not include_done:
        q = q.filter(ImprovementNote.is_done == False)
    return [_normalize(n) for n in q.order_by(ImprovementNote.created_at.asc()).all()]


# ── Endpoint interno — usado por copilot_automator.py (sin JWT, con secret) ──
class InternalStatusUpdate(BaseModel):
    note_id: int
    message: str
    secret: str

@router.post("/internal/set-ai-reply")
def internal_set_ai_reply(
    data: InternalStatusUpdate,
    db: Session = Depends(get_db),
):
    """Endpoint interno sin JWT. Solo acepta peticiones con el AUTOMATOR_SECRET correcto."""
    settings = get_settings()
    expected = getattr(settings, "AUTOMATOR_SECRET", "")
    if not expected or data.secret != expected:
        raise HTTPException(403, "Secreto inválido")
    note = db.query(ImprovementNote).filter(ImprovementNote.id == data.note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")
    note.ai_reply = data.message
    note.ai_reply_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


@router.post("/", response_model=NoteOut)
def create_note(
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = ImprovementNote(
        page=data.page,
        page_label=data.page_label,
        text=data.text,
        priority=data.priority,
        images=[],
        author_id=current_user.id,
        author_name=current_user.full_name or current_user.username,
    )
    db.add(note)
    db.flush()  # get the ID before saving images

    # Save base64 images to disk and store paths
    if data.images:
        note.images = _process_images(data.images, note.id)

    db.commit()
    db.refresh(note)
    _export_markdown(db)
    return _normalize(note)


@router.get("/my-updates", response_model=List[NoteOut])
def my_completed_updates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns notes authored by the current user that are marked as done."""
    notes = (
        db.query(ImprovementNote)
        .filter(
            ImprovementNote.author_id == current_user.id,
            ImprovementNote.is_done == True,
        )
        .order_by(ImprovementNote.updated_at.desc())
        .limit(50)
        .all()
    )
    return [_normalize(n) for n in notes]


@router.get("/{note_id}/ai-stream")
async def ai_stream(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE — Stream de respuesta IA para una nota de mejora.
    El frontend consume esto con fetch + ReadableStream.
    Devuelve chunks de texto y al final guarda el reply completo en la DB.
    """
    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")

    settings = get_settings()

    # Contexto del ERP para el prompt
    pending_count = db.query(ImprovementNote).filter(
        ImprovementNote.is_done == False,
        ImprovementNote.page == note.page,
    ).count()
    done_count = db.query(ImprovementNote).filter(
        ImprovementNote.is_done == True,
        ImprovementNote.page == note.page,
    ).count()

    system_prompt = f"""Sos el asistente de mejoras del ERP Mundo Outdoor, un sistema de gestión
para una empresa de indumentaria y artículos outdoor.

Tu rol es responder las sugerencias de mejora que hacen los usuarios del equipo.
Respondé siempre en español, de forma amigable y directa.

Contexto de la sección "{note.page_label or note.page}":
- Sugerencias pendientes en esta sección: {pending_count}
- Sugerencias ya resueltas: {done_count}
- Usuario que escribe: {note.author_name or "desconocido"}
- Prioridad asignada: {note.priority}

Al responder:
1. Reconocé la sugerencia brevemente
2. Indicá si parece algo factible, complejo o que ya existe
3. Si es técnicamente posible, decí que se va a analizar para implementar
4. Si ya existe algo similar, mencionalo
5. Sé conciso (máximo 3-4 oraciones)
6. No uses asteriscos ni markdown, solo texto plano"""

    user_message = note.text

    async def stream_response():
        full_reply = ""

        if not settings.OPENAI_API_KEY:
            # Sin clave configurada — respuesta mock
            mock = (
                f"Gracias {note.author_name or 'por tu sugerencia'}, "
                f"recibimos tu nota sobre \"{note.text[:60]}{'...' if len(note.text) > 60 else ''}\". "
                f"La vamos a revisar y si es viable la incorporamos al backlog de mejoras. "
                f"(Configurá OPENAI_API_KEY en .env para respuestas reales con IA)"
            )
            for char in mock:
                full_reply += char
                yield f"data: {json.dumps({'chunk': char})}\n\n"
            # Guardar en DB
            _save_ai_reply(note_id, full_reply)
            yield f"data: {json.dumps({'done': True})}\n\n"
            return

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

            stream = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                stream=True,
                max_tokens=300,
                temperature=0.7,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_reply += delta
                    yield f"data: {json.dumps({'chunk': delta})}\n\n"

            # Guardar reply completo en DB
            _save_ai_reply(note_id, full_reply)
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            error_msg = f"No se pudo conectar con la IA: {str(e)[:100]}"
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    def _save_ai_reply(nid: int, reply: str):
        try:
            from app.db.session import SessionLocal
            with SessionLocal() as session:
                n = session.query(ImprovementNote).filter(ImprovementNote.id == nid).first()
                if n:
                    n.ai_reply = reply
                    n.ai_reply_at = datetime.now(timezone.utc)
                    session.commit()
        except Exception:
            pass

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


class AdminNoteBody(BaseModel):
    admin_note: Optional[str] = None   # None o "" = borrar la nota


@router.patch("/{note_id}/admin-note", response_model=NoteOut)
def set_admin_note(
    note_id: int,
    body: AdminNoteBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin escribe una crítica/feedback visible para el empleado que creó la nota."""
    if current_user.role not in ("MEGAADMIN", "SUPERADMIN", "ADMIN"):
        raise HTTPException(403, "Solo administradores pueden escribir feedback")

    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")

    note.admin_note = body.admin_note or None
    note.admin_note_by = (current_user.full_name or current_user.username) if body.admin_note else None
    note.admin_note_at = datetime.now(timezone.utc) if body.admin_note else None
    db.commit()
    db.refresh(note)
    return _normalize(note)


@router.post("/{note_id}/approve", response_model=NoteOut)
def approve_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin marca una nota como APROBADA / aplicada.
    Dispara el Copilot Automator para que implemente el cambio.
    """
    if current_user.role not in ("MEGAADMIN", "SUPERADMIN", "ADMIN"):
        raise HTTPException(403, "Solo administradores pueden aprobar mejoras")

    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")

    note.is_done = True
    note.approved_by = current_user.full_name or current_user.username
    note.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    _export_markdown(db)

    # ── Disparar Copilot Automator con prefijo [APROBADO] ─────────────────
    image_paths = ""
    if note.images:
        paths = [_image_disk_path(p) for p in note.images]
        image_paths = " [IMÁGENES: " + ", ".join(paths) + "]"
    trigger_copilot(
        module=note.page_label or note.page,
        user=current_user.full_name or current_user.username,
        text=f"[APROBADO PARA IMPLEMENTAR] {note.text}{image_paths}",
        note_id=note.id,
    )
    return _normalize(note)


@router.post("/{note_id}/unapprove", response_model=NoteOut)
def unapprove_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin revierte una nota a pendiente."""
    if current_user.role not in ("MEGAADMIN", "SUPERADMIN", "ADMIN"):
        raise HTTPException(403, "Solo administradores pueden editar el estado")

    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")

    note.is_done = False
    note.approved_by = None
    note.approved_at = None
    db.commit()
    db.refresh(note)
    _export_markdown(db)
    return _normalize(note)


@router.put("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")
    if note.author_id != current_user.id and current_user.role not in ("SUPERADMIN", "ADMIN"):
        raise HTTPException(403, "No tenés permiso para editar esta nota")
    if data.text is not None:
        note.text = data.text
    if data.priority is not None:
        note.priority = data.priority
    if data.images is not None:
        note.images = _process_images(data.images, note.id)
    if data.is_done is not None:
        note.is_done = data.is_done
    db.commit()
    db.refresh(note)
    _export_markdown(db)
    return _normalize(note)


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(ImprovementNote).filter(ImprovementNote.id == note_id).first()
    if not note:
        raise HTTPException(404, "Nota no encontrada")
    if note.author_id != current_user.id and current_user.role not in ("SUPERADMIN", "ADMIN"):
        raise HTTPException(403, "No tenés permiso para eliminar esta nota")
    db.delete(note)
    db.commit()
    _export_markdown(db)
    return {"ok": True}


@router.get("/export/markdown")
def export_markdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all pending improvement notes as Markdown for AI assistant consumption."""
    content = _build_markdown(db)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content, media_type="text/markdown")


def _normalize(note: ImprovementNote) -> ImprovementNote:
    """Ensure images is always a list (JSON column can return None)."""
    if note.images is None:
        note.images = []
    return note


def _build_markdown(db: Session) -> str:
    notes = db.query(ImprovementNote).filter(
        ImprovementNote.is_done == False
    ).order_by(ImprovementNote.page, ImprovementNote.created_at.desc()).all()

    if not notes:
        return "# Notas de Mejora ERP\n\n_No hay notas pendientes._\n"

    lines = ["# Notas de Mejora — ERP Mundo Outdoor", f"_Exportado: {datetime.now().strftime('%Y-%m-%d %H:%M')}_", ""]

    current_page = None
    for n in notes:
        if n.page != current_page:
            current_page = n.page
            lines.append(f"\n## {n.page_label or n.page}")

        priority_emoji = {"CRITICA": "🔴", "HIGH": "🟠", "NORMAL": "🟡", "LOW": "🟢"}.get(n.priority, "🟡")
        lines.append(f"\n### {priority_emoji} [{n.priority}] Nota #{n.id}")
        lines.append(f"**Autor:** {n.author_name or 'Anónimo'} | **Fecha:** {n.created_at.strftime('%d/%m/%Y %H:%M') if n.created_at else '—'}")
        lines.append(f"\n{n.text}")
        if n.images:
            lines.append(f"\n**Imágenes adjuntas ({len(n.images)}):**")
            for img_path in n.images:
                disk_path = _image_disk_path(img_path)
                lines.append(f"  - `{disk_path}`")
        lines.append("")

    return "\n".join(lines)


def _export_markdown(db: Session):
    """Write markdown to disk after every create/update/delete so AI can read it."""
    try:
        content = _build_markdown(db)
        path = r"D:\ERP MUNDO OUTDOOR\NOTAS_MEJORAS.md"
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        pass
