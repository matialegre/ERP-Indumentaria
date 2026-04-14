"""
Parser de PDFs de proveedores (Miding, Montagne, World Sport).
Ported desde CONTROL REMITOS/SISTEMA PEDIDOS/servidor/ENDPOINTS/comparar.py
"""

import re
from io import BytesIO
from typing import List

import pdfplumber
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/pdf-parser", tags=["PDF Parser"])


# ── Schemas ────────────────────────────────────────────

class ParsedItem(BaseModel):
    codigo_articulo: str
    descripcion: str
    packs: float
    unidades: float
    precio_unit: float
    model_config = {"from_attributes": True}


class ParsedDocument(BaseModel):
    filename: str
    proveedor: str  # MIDING | MONTAGNE | WORLD_SPORT | DESCONOCIDO
    tipo_doc: str   # FACTURA | REMITO | REMITO_FACTURA
    numero: str | None = None
    fecha: str | None = None
    remito_ref: str | None = None
    nota_venta: str | None = None
    total_unidades: float = 0.0
    total_items: int = 0
    items: List[ParsedItem] = []
    error: str | None = None
    model_config = {"from_attributes": True}


# ── Helpers internos ────────────────────────────────────

def _extraer_pares_por_pack(descripcion: str) -> int:
    """Extrae la cantidad de pares por pack desde la descripción (ej: 'X 10 PARES' -> 10)"""
    m = re.search(r'X\s*(\d+)\s*PARES', descripcion.upper())
    return int(m.group(1)) if m else 10


def _detectar_tipo_montagne(text: str) -> str:
    """Detecta tipo de documento Montagne por la PRIMERA línea del texto."""
    lines = text.strip().split('\n')
    if not lines:
        return 'DESCONOCIDO'
    first = lines[0].strip().upper()
    if first in ('REMITO-FACTURA', 'REMITO - FACTURA'):
        return 'REMITO_FACTURA'
    if first == 'FACTURA':
        return 'FACTURA'
    if first == 'REMITO':
        return 'REMITO'
    header = ' '.join(l.strip().upper() for l in lines[:3])
    if 'REMITO-FACTURA' in header:
        return 'REMITO_FACTURA'
    if 'FACTURA' in header and 'REMITO' not in header:
        return 'FACTURA'
    if 'REMITO' in header:
        return 'REMITO'
    return 'DESCONOCIDO'


def _detectar_tipo_miding(text: str) -> str:
    """Detecta si un PDF Miding es FACTURA o REMITO."""
    header = ' '.join(text.strip().split('\n')[:10]).upper()
    if 'FACTURA' in header:
        return 'FACTURA'
    if 'REMITO' in header:
        return 'REMITO'
    # Presencia de "Remito nro.:" en el body indica que es una factura que referencia un remito
    if re.search(r'Remito nro\.:', text):
        return 'FACTURA'
    return 'FACTURA'


def _detectar_tipo_world_sport(text: str) -> str:
    """Detecta si un PDF World Sport es FACTURA o REMITO."""
    header = ' '.join(text.strip().split('\n')[:5]).upper()
    if 'REMITO' in header and 'FACTURA' not in header:
        return 'REMITO'
    return 'FACTURA'


def _items_dict_to_list(items: dict) -> List[ParsedItem]:
    """Convierte el dict interno de items al schema de salida."""
    result = []
    for v in items.values():
        result.append(ParsedItem(
            codigo_articulo=str(v.get('codigo_articulo', '')),
            descripcion=str(v.get('descripcion', '')),
            packs=float(v.get('packs', 0)),
            unidades=float(v.get('unidades', 0)),
            precio_unit=float(v.get('precio_unit', 0)),
        ))
    return result


# ── Detección de proveedor ──────────────────────────────

def detectar_proveedor_pdf(file_bytes: bytes) -> str:
    """Detecta el proveedor del PDF por razón social. Retorna MIDING, MONTAGNE, WORLD_SPORT o DESCONOCIDO."""
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = (page.extract_text() or '').upper()
            if 'MIDING' in text:
                return 'MIDING'
            if 'MONTAGNE' in text:
                return 'MONTAGNE'
            if 'WORLD SPORT' in text or 'WORLDSPORT' in text:
                return 'WORLD_SPORT'
    return 'DESCONOCIDO'


# ── Parser MIDING ───────────────────────────────────────

def extraer_items_factura_miding(file_bytes: bytes) -> dict:
    """
    Extrae items de una factura PDF MIDING.
    Retorna dict con factura_nro, remito_nro, nota_venta, items, total_unidades, etc.
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        factura_nro = None
        remito_nro = None
        nota_venta = None
        fecha_documento = None
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not factura_nro:
                m = re.search(r'Nro\.\s*(\d+-\d+)', text)
                if m:
                    factura_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'FECHA\s+(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            if not remito_nro:
                m = re.search(r'Remito nro\.:\s*(\d+-\d+)', text)
                if m:
                    remito_nro = m.group(1)

            if not nota_venta:
                m = re.search(r'nota de venta:\s*(\d+)', text, re.IGNORECASE)
                if m:
                    nota_venta = m.group(1)

            for i, line in enumerate(lines):
                m = re.match(
                    r'^(\d{2,3}\w{10,20})\s*(.+?)\s+(\d+\.\d{2})\s+([\d,.]+)\s+(\d+\.\d{2})\s+([\d,.]+)\s+',
                    line,
                )
                if m:
                    codigo_articulo = m.group(1)
                    descripcion = m.group(2).strip()
                    packs = float(m.group(3))
                    unidades = float(m.group(5))
                    try:
                        precio_unit = float(m.group(6).replace(',', ''))
                    except Exception:
                        precio_unit = 0.0

                    cod_fabricante = None
                    for j in range(i + 1, min(i + 4, len(lines))):
                        mf = re.search(r'Codigo de Fabricante:\s*(\S+)', lines[j])
                        if mf:
                            cod_fabricante = mf.group(1)
                            break

                    if not cod_fabricante:
                        cod_fabricante = re.sub(r'^\d{2}', '', codigo_articulo)

                    if cod_fabricante in items:
                        items[cod_fabricante]['packs'] += packs
                        items[cod_fabricante]['unidades'] += unidades
                    else:
                        items[cod_fabricante] = {
                            'codigo_articulo': codigo_articulo,
                            'cod_fabricante': cod_fabricante,
                            'descripcion': descripcion,
                            'packs': packs,
                            'unidades': unidades,
                            'precio_unit': precio_unit,
                        }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'factura_nro': factura_nro,
        'remito_nro': remito_nro,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'items': items,
        'total_unidades': total_unidades,
        'total_items': len(items),
    }


def extraer_items_remito_miding(file_bytes: bytes) -> dict:
    """
    Extrae items de un remito PDF MIDING.
    La cantidad en el remito es en PACKS. Unidades = packs × pares_por_pack (default 10).
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        remito_nro = None
        nota_venta = None
        fecha_documento = None
        total_unidades_declarado = 0
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not remito_nro:
                m = re.search(r'(\d{5}-\d{8})', text)
                if m:
                    remito_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'FECHA\s+(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            for m_iter in re.finditer(r'Unidades:\s*(\d+)', text):
                total_unidades_declarado = int(m_iter.group(1))

            if not nota_venta:
                m = re.search(r'Nota de Venta:\s*(\d+)', text, re.IGNORECASE)
                if m:
                    nota_venta = m.group(1)

            for i, line in enumerate(lines):
                m = re.match(r'^(\d{2,3}\w{10,20})\s+(.+?)\s+(\d+\.\d{2})\s*$', line)
                if m:
                    codigo_articulo = m.group(1)
                    descripcion = m.group(2).strip()
                    packs = float(m.group(3))
                    pares_por_pack = _extraer_pares_por_pack(descripcion)
                    unidades = packs * pares_por_pack

                    if i + 1 < len(lines):
                        next_line = lines[i + 1]
                        ms = re.match(r'^\d+\s+\d*(\w+)OC:', next_line)
                        if ms and ms.group(1):
                            codigo_articulo = codigo_articulo + ms.group(1)

                    cod_fabricante = re.sub(r'^\d{2}', '', codigo_articulo)

                    if cod_fabricante in items:
                        items[cod_fabricante]['packs'] += packs
                        items[cod_fabricante]['unidades'] += unidades
                    else:
                        items[cod_fabricante] = {
                            'codigo_articulo': codigo_articulo,
                            'cod_fabricante': cod_fabricante,
                            'descripcion': descripcion,
                            'packs': packs,
                            'unidades': unidades,
                            'precio_unit': 0.0,
                        }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'remito_nro': remito_nro,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'items': items,
        'total_unidades': total_unidades,
        'total_unidades_declarado': total_unidades_declarado,
        'total_items': len(items),
    }


# ── Parser MONTAGNE ─────────────────────────────────────

def extraer_items_factura_montagne(file_bytes: bytes) -> dict:
    """
    Extrae items de una factura o remito-factura PDF MONTAGNE.
    Maneja tipo FACTURA y REMITO_FACTURA (detectado por primera línea).
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        factura_nro = None
        remito_ref = None
        nota_venta = None
        fecha_documento = None
        tipo_doc = None
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not tipo_doc:
                tipo_doc = _detectar_tipo_montagne(text)

            if not factura_nro:
                m = re.search(r'Compr\.\s*Nro:\s*(\d{5}-\d{8})', text)
                if m:
                    factura_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'Fecha de Emisi[oó]n:\s*(\d{2}/\d{2}/\d{4})', text)
                if not m:
                    m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            if not remito_ref:
                m = re.search(r'REM\s+(\d{8,})', text)
                if m:
                    remito_ref = m.group(1)

            if not nota_venta:
                m = re.search(r'Numero:\s*(\d+)', text)
                if m:
                    nota_venta = m.group(1)

            for line in lines:
                m = re.match(
                    r'^([A-Z0-9][A-Z0-9]{4,20})\s*(\d{12})(.+?)\s+([\d,]+\.\d{2})\s*([\d,.]+)\s+([\d,.]+)$',
                    line,
                )
                if m:
                    codigo = m.group(1)
                    descripcion = m.group(3).strip()
                    cantidad = float(m.group(4).replace(',', ''))
                    try:
                        precio = float(m.group(5).replace(',', ''))
                    except Exception:
                        precio = 0.0

                    if codigo in items:
                        items[codigo]['unidades'] += cantidad
                        items[codigo]['packs'] += cantidad
                    else:
                        items[codigo] = {
                            'codigo_articulo': codigo,
                            'cod_fabricante': codigo,
                            'descripcion': descripcion,
                            'packs': cantidad,
                            'unidades': cantidad,
                            'precio_unit': precio,
                        }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'factura_nro': factura_nro,
        'remito_ref': remito_ref,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'tipo_doc': tipo_doc or 'FACTURA',
        'items': items,
        'total_unidades': total_unidades,
        'total_items': len(items),
    }


def extraer_items_remito_montagne(file_bytes: bytes) -> dict:
    """
    Extrae items de un remito PDF MONTAGNE.
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        remito_nro = None
        nota_venta = None
        fecha_documento = None
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not remito_nro:
                m = re.search(r'Nro\.\s*(\d{5}-\d{8})', text)
                if m:
                    remito_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            if not nota_venta:
                m = re.search(r'Numero:\s*(\d+)', text)
                if m:
                    nota_venta = m.group(1)

            for line in lines:
                m = re.match(r'^([A-Z][A-Z0-9]{8,20})\s+(.+?)\s+(\d+\.\d{2})\s*$', line)
                if m:
                    codigo = m.group(1)
                    descripcion = m.group(2).strip()
                    cantidad = float(m.group(3))

                    if codigo in items:
                        items[codigo]['unidades'] += cantidad
                        items[codigo]['packs'] += cantidad
                    else:
                        items[codigo] = {
                            'codigo_articulo': codigo,
                            'cod_fabricante': codigo,
                            'descripcion': descripcion,
                            'packs': cantidad,
                            'unidades': cantidad,
                            'precio_unit': 0.0,
                        }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'remito_nro': remito_nro,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'tipo_doc': 'REMITO',
        'items': items,
        'total_unidades': total_unidades,
        'total_items': len(items),
    }


# ── Parser WORLD SPORT (stub) ───────────────────────────

def extraer_items_factura_world_sport(file_bytes: bytes) -> dict:
    """
    Stub parser para facturas PDF de World Sport.
    Asume layout similar a Miding: CODE  DESC  PACKS/UNITS  PRICE por columna.
    Patron generico: ^([A-Z0-9]{6,20})\\s+(.+?)\\s+(\\d+\\.?\\d*)\\s+([\\d.]+)$
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        factura_nro = None
        fecha_documento = None
        nota_venta = None
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not factura_nro:
                m = re.search(r'(?:Factura|FACTURA|Nro\.?)\s*[:\s]*(\d[\d-]+)', text)
                if m:
                    factura_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            if not nota_venta:
                m = re.search(r'(?:nota de venta|nota venta|NV)[:\s]*(\d+)', text, re.IGNORECASE)
                if m:
                    nota_venta = m.group(1)

            for line in lines:
                m = re.match(
                    r'^([A-Z0-9]{6,20})\s+(.+?)\s+(\d+\.?\d*)\s+([\d.]+)$',
                    line,
                )
                if m:
                    codigo = m.group(1)
                    descripcion = m.group(2).strip()
                    unidades = float(m.group(3))
                    try:
                        precio_unit = float(m.group(4))
                    except Exception:
                        precio_unit = 0.0

                    if codigo in items:
                        items[codigo]['unidades'] += unidades
                        items[codigo]['packs'] += unidades
                    else:
                        items[codigo] = {
                            'codigo_articulo': codigo,
                            'cod_fabricante': codigo,
                            'descripcion': descripcion,
                            'packs': unidades,
                            'unidades': unidades,
                            'precio_unit': precio_unit,
                        }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'factura_nro': factura_nro,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'tipo_doc': 'FACTURA',
        'items': items,
        'total_unidades': total_unidades,
        'total_items': len(items),
    }


def extraer_items_remito_world_sport(file_bytes: bytes) -> dict:
    """
    Stub parser para remitos PDF de World Sport.
    Misma estructura de columnas que la factura pero sin precio.
    """
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        remito_nro = None
        fecha_documento = None
        nota_venta = None
        items = {}

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            lines = text.split('\n')

            if not remito_nro:
                m = re.search(r'(?:Remito|REMITO|Nro\.?)\s*[:\s]*(\d[\d-]+)', text)
                if m:
                    remito_nro = m.group(1)

            if not fecha_documento:
                m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
                if m:
                    fecha_documento = m.group(1)

            if not nota_venta:
                m = re.search(r'(?:nota de venta|nota venta|NV)[:\s]*(\d+)', text, re.IGNORECASE)
                if m:
                    nota_venta = m.group(1)

            for line in lines:
                # Intenta con precio al final, si no sin precio
                m = re.match(
                    r'^([A-Z0-9]{6,20})\s+(.+?)\s+(\d+\.?\d*)\s+([\d.]+)$',
                    line,
                )
                if not m:
                    m_no_price = re.match(r'^([A-Z0-9]{6,20})\s+(.+?)\s+(\d+\.?\d*)\s*$', line)
                    if m_no_price:
                        codigo = m_no_price.group(1)
                        descripcion = m_no_price.group(2).strip()
                        unidades = float(m_no_price.group(3))
                        precio_unit = 0.0
                    else:
                        continue
                else:
                    codigo = m.group(1)
                    descripcion = m.group(2).strip()
                    unidades = float(m.group(3))
                    try:
                        precio_unit = float(m.group(4))
                    except Exception:
                        precio_unit = 0.0

                if codigo in items:
                    items[codigo]['unidades'] += unidades
                    items[codigo]['packs'] += unidades
                else:
                    items[codigo] = {
                        'codigo_articulo': codigo,
                        'cod_fabricante': codigo,
                        'descripcion': descripcion,
                        'packs': unidades,
                        'unidades': unidades,
                        'precio_unit': precio_unit,
                    }

    total_unidades = sum(v['unidades'] for v in items.values())
    return {
        'remito_nro': remito_nro,
        'nota_venta': nota_venta,
        'fecha_documento': fecha_documento,
        'tipo_doc': 'REMITO',
        'items': items,
        'total_unidades': total_unidades,
        'total_items': len(items),
    }


# ── Lógica de despacho ──────────────────────────────────

def _parse_pdf_bytes(file_bytes: bytes, filename: str) -> ParsedDocument:
    """
    Lógica central: detecta proveedor y tipo de documento, llama al parser correcto
    y devuelve un ParsedDocument normalizado.
    """
    proveedor = detectar_proveedor_pdf(file_bytes)

    # Leer primera página para detectar tipo de documento
    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            first_text = pdf.pages[0].extract_text() or '' if pdf.pages else ''
    except Exception as exc:
        return ParsedDocument(filename=filename, proveedor='DESCONOCIDO', tipo_doc='FACTURA', error=str(exc))

    try:
        if proveedor == 'MIDING':
            tipo_doc = _detectar_tipo_miding(first_text)
            if tipo_doc == 'REMITO':
                raw = extraer_items_remito_miding(file_bytes)
                numero = raw.get('remito_nro')
                remito_ref = None
            else:
                raw = extraer_items_factura_miding(file_bytes)
                numero = raw.get('factura_nro')
                remito_ref = raw.get('remito_nro')
            tipo_doc_out = tipo_doc

        elif proveedor == 'MONTAGNE':
            tipo_doc = _detectar_tipo_montagne(first_text)
            if tipo_doc == 'REMITO':
                raw = extraer_items_remito_montagne(file_bytes)
                numero = raw.get('remito_nro')
                remito_ref = None
            else:
                raw = extraer_items_factura_montagne(file_bytes)
                numero = raw.get('factura_nro')
                remito_ref = raw.get('remito_ref')
                tipo_doc = raw.get('tipo_doc', tipo_doc)
            tipo_doc_out = tipo_doc

        elif proveedor == 'WORLD_SPORT':
            tipo_doc = _detectar_tipo_world_sport(first_text)
            if tipo_doc == 'REMITO':
                raw = extraer_items_remito_world_sport(file_bytes)
                numero = raw.get('remito_nro')
                remito_ref = None
            else:
                raw = extraer_items_factura_world_sport(file_bytes)
                numero = raw.get('factura_nro')
                remito_ref = None
            tipo_doc_out = tipo_doc

        else:
            return ParsedDocument(
                filename=filename,
                proveedor='DESCONOCIDO',
                tipo_doc='FACTURA',
                error='Proveedor no reconocido en el PDF',
            )

        items_list = _items_dict_to_list(raw.get('items', {}))
        return ParsedDocument(
            filename=filename,
            proveedor=proveedor,
            tipo_doc=tipo_doc_out or 'FACTURA',
            numero=numero,
            fecha=raw.get('fecha_documento'),
            remito_ref=remito_ref,
            nota_venta=raw.get('nota_venta'),
            total_unidades=raw.get('total_unidades', 0.0),
            total_items=raw.get('total_items', len(items_list)),
            items=items_list,
            error=None,
        )

    except Exception as exc:
        return ParsedDocument(
            filename=filename,
            proveedor=proveedor,
            tipo_doc='FACTURA',
            error=str(exc),
        )


# ── Endpoints ───────────────────────────────────────────

@router.post("/parse-pdf", response_model=ParsedDocument)
async def parse_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Recibe un PDF de proveedor, detecta proveedor y tipo de documento,
    y retorna los items parseados.
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF (.pdf)")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    result = _parse_pdf_bytes(file_bytes, file.filename)
    return result


@router.post("/parse-pdfs-masivo", response_model=List[ParsedDocument])
async def parse_pdfs_masivo(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Recibe múltiples PDFs de proveedor y retorna una lista de resultados parseados.
    Los errores por archivo se incluyen en el campo `error` sin abortar el batch completo.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Se requiere al menos un archivo")

    results = []
    for upload in files:
        try:
            file_bytes = await upload.read()
        except Exception as exc:
            results.append(ParsedDocument(
                filename=upload.filename or 'unknown',
                proveedor='DESCONOCIDO',
                tipo_doc='FACTURA',
                error=f"Error leyendo archivo: {exc}",
            ))
            continue

        if not file_bytes:
            results.append(ParsedDocument(
                filename=upload.filename or 'unknown',
                proveedor='DESCONOCIDO',
                tipo_doc='FACTURA',
                error='Archivo vacío',
            ))
            continue

        results.append(_parse_pdf_bytes(file_bytes, upload.filename or 'unknown'))

    return results
