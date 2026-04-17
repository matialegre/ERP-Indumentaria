"""
Asistente IA del ERP — chat con GPT-4o-mini + herramientas de datos reales
Usa SSE streaming para mostrar respuestas en tiempo real.
"""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from openai import AsyncOpenAI
from sqlalchemy import text

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import User

router = APIRouter(prefix="/asistente", tags=["Asistente IA"])
settings = get_settings()

SYSTEM_PROMPT = """Sos Nexus, el Asistente IA del ERP Mundo Outdoor.
Mundo Outdoor es una empresa argentina de indumentaria outdoor que vende en múltiples locales y online.

Tenés acceso a datos reales del sistema vía herramientas. Cuando el usuario te pregunta sobre stock, pedidos, ventas o facturas, SIEMPRE usá las herramientas para obtener datos actualizados antes de responder.

Reglas:
- Respondé en español rioplatense (vos, etc.)
- Sé conciso y directo
- Usá emojis con moderación para claridad
- Usá markdown: **negrita**, listas con -, tablas cuando corresponda
- Si no sabés algo o no tenés herramienta para consultarlo, decilo honestamente
- Nunca inventes datos — siempre usá las herramientas disponibles
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_resumen",
            "description": "Obtiene un resumen del stock actual: total de productos, variantes con stock, alertas de stock bajo y sin stock.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_productos",
            "description": "Busca productos por nombre, SKU o descripción. Devuelve nombre, SKU, talle, color, stock y precio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Texto a buscar en nombre o SKU del producto"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pedidos_pendientes",
            "description": "Lista los pedidos de compra activos (no recibidos ni anulados). Muestra número, proveedor, estado y cantidad de ítems.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ventas_recientes",
            "description": "Obtiene las ventas más recientes (últimos 7 días) con totales y estado.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_facturas_pendientes",
            "description": "Lista facturas y remitos de proveedor pendientes de revisión o confirmación.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alertas_stock",
            "description": "Devuelve productos con stock bajo (≤5 unidades) o sin stock, agrupados por producto.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_locales_resumen",
            "description": "Obtiene un resumen de los locales activos con nombre y ciudad.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


def execute_tool(name: str, args: dict, company_id: int) -> str:
    """Ejecuta una herramienta de ERP y devuelve JSON con los resultados."""
    try:
        with SessionLocal() as db:
            if name == "get_stock_resumen":
                row = db.execute(text("""
                    SELECT
                        COUNT(DISTINCT p.id)                                       AS productos,
                        COUNT(pv.id)                                               AS variantes,
                        COALESCE(SUM(pv.stock), 0)                                 AS stock_total,
                        COUNT(pv.id) FILTER (WHERE pv.stock <= 5 AND pv.stock > 0) AS stock_bajo,
                        COUNT(pv.id) FILTER (WHERE pv.stock = 0)                   AS sin_stock
                    FROM products p
                    LEFT JOIN product_variants pv ON pv.product_id = p.id
                    WHERE p.company_id = :cid
                """), {"cid": company_id}).fetchone()
                return json.dumps({
                    "productos_totales": row.productos or 0,
                    "variantes_totales": row.variantes or 0,
                    "stock_total_unidades": int(row.stock_total or 0),
                    "variantes_stock_bajo": row.stock_bajo or 0,
                    "variantes_sin_stock": row.sin_stock or 0,
                })

            elif name == "buscar_productos":
                q = args.get("query", "")
                rows = db.execute(text("""
                    SELECT p.name, p.sku, pv.size, pv.color, pv.stock, p.price
                    FROM products p
                    LEFT JOIN product_variants pv ON pv.product_id = p.id
                    WHERE p.company_id = :cid
                      AND (p.name ILIKE :q OR p.sku ILIKE :q OR pv.sku ILIKE :q)
                    ORDER BY p.name, pv.size, pv.color
                    LIMIT 30
                """), {"cid": company_id, "q": f"%{q}%"}).fetchall()
                items = [
                    {"nombre": r.name, "sku": r.sku, "talle": r.size,
                     "color": r.color, "stock": r.stock, "precio": float(r.price or 0)}
                    for r in rows
                ]
                return json.dumps({"resultados": items, "total": len(items)})

            elif name == "get_pedidos_pendientes":
                rows = db.execute(text("""
                    SELECT po.id, po.order_number, po.status, po.created_at::date AS fecha,
                           pr.name AS proveedor,
                           COUNT(poi.id) AS items
                    FROM purchase_orders po
                    LEFT JOIN providers pr ON pr.id = po.provider_id
                    LEFT JOIN purchase_order_items poi ON poi.order_id = po.id
                    WHERE po.company_id = :cid
                      AND po.status NOT IN ('ANULADO', 'RECIBIDO')
                    GROUP BY po.id, po.order_number, po.status, po.created_at, pr.name
                    ORDER BY po.created_at DESC
                    LIMIT 15
                """), {"cid": company_id}).fetchall()
                items = [
                    {"id": r.id, "numero": r.order_number, "estado": r.status,
                     "fecha": str(r.fecha), "proveedor": r.proveedor, "items": r.items}
                    for r in rows
                ]
                return json.dumps({"pedidos": items, "total": len(items)})

            elif name == "get_ventas_recientes":
                rows = db.execute(text("""
                    SELECT s.id, s.sale_number, s.total, s.status, s.created_at::date AS fecha,
                           l.name AS local
                    FROM sales s
                    LEFT JOIN locals l ON l.id = s.local_id
                    WHERE s.company_id = :cid
                      AND s.created_at >= NOW() - INTERVAL '7 days'
                    ORDER BY s.created_at DESC
                    LIMIT 20
                """), {"cid": company_id}).fetchall()
                total_monto = sum(float(r.total or 0) for r in rows)
                items = [
                    {"numero": r.sale_number, "total": float(r.total or 0),
                     "estado": r.status, "fecha": str(r.fecha), "local": r.local}
                    for r in rows
                ]
                return json.dumps({
                    "ventas": items,
                    "cantidad_ventas": len(items),
                    "monto_total_7dias": round(total_monto, 2),
                })

            elif name == "get_facturas_pendientes":
                rows = db.execute(text("""
                    SELECT pi.id, pi.invoice_number, pi.status, pi.total, pi.created_at::date AS fecha,
                           pr.name AS proveedor
                    FROM purchase_invoices pi
                    LEFT JOIN providers pr ON pr.id = pi.provider_id
                    WHERE pi.company_id = :cid
                      AND pi.status NOT IN ('REVISADO', 'ANULADO', 'CONFIRMADO')
                    ORDER BY pi.created_at DESC
                    LIMIT 15
                """), {"cid": company_id}).fetchall()
                items = [
                    {"id": r.id, "numero": r.invoice_number, "estado": r.status,
                     "total": float(r.total or 0), "fecha": str(r.fecha), "proveedor": r.proveedor}
                    for r in rows
                ]
                return json.dumps({"facturas": items, "total": len(items)})

            elif name == "get_alertas_stock":
                rows = db.execute(text("""
                    SELECT p.name, p.sku,
                           COUNT(pv.id) FILTER (WHERE pv.stock = 0)     AS sin_stock,
                           COUNT(pv.id) FILTER (WHERE pv.stock BETWEEN 1 AND 5) AS stock_bajo,
                           MIN(pv.stock) AS stock_minimo
                    FROM products p
                    JOIN product_variants pv ON pv.product_id = p.id
                    WHERE p.company_id = :cid
                      AND pv.stock <= 5
                    GROUP BY p.id, p.name, p.sku
                    ORDER BY stock_minimo ASC
                    LIMIT 20
                """), {"cid": company_id}).fetchall()
                items = [
                    {"nombre": r.name, "sku": r.sku,
                     "variantes_sin_stock": r.sin_stock, "variantes_stock_bajo": r.stock_bajo,
                     "stock_minimo": r.stock_minimo}
                    for r in rows
                ]
                return json.dumps({"alertas": items, "total_productos_afectados": len(items)})

            elif name == "get_locales_resumen":
                rows = db.execute(text("""
                    SELECT name, city, is_active FROM locals
                    WHERE company_id = :cid
                    ORDER BY name
                """), {"cid": company_id}).fetchall()
                items = [
                    {"nombre": r.name, "ciudad": r.city, "activo": r.is_active}
                    for r in rows
                ]
                return json.dumps({"locales": items, "total": len(items)})

    except Exception as exc:
        return json.dumps({"error": str(exc)[:200]})

    return json.dumps({"error": "Herramienta desconocida"})


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
async def chat_stream(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Chat con streaming SSE. Devuelve eventos de tipo token, tool_start, tool_result y done."""
    if not settings.OPENAI_API_KEY:
        async def no_key():
            yield 'data: {"type":"error","message":"OpenAI API key no configurada."}\n\n'
        return StreamingResponse(no_key(), media_type="text/event-stream")

    company_id = current_user.company_id or 1

    # Construir historial incluyendo system prompt
    openai_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in req.messages:
        openai_messages.append({"role": m.role, "content": m.content})

    async def generate():
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        messages = list(openai_messages)  # copia mutable

        max_rounds = 3  # seguridad contra loops infinitos de tool calls
        for _ in range(max_rounds):
            tool_call_acc: dict[int, dict] = {}
            content_buf = ""
            finish_reason = None

            try:
                stream = await client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=messages,
                    tools=TOOLS,
                    stream=True,
                    max_tokens=1500,
                    temperature=0.4,
                )

                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    delta = choice.delta

                    # Tokens de texto
                    if delta.content:
                        content_buf += delta.content
                        yield f"data: {json.dumps({'type': 'token', 'delta': delta.content})}\n\n"

                    # Acumular tool calls
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_call_acc:
                                tool_call_acc[idx] = {"id": "", "name": "", "args": ""}
                            if tc.id:
                                tool_call_acc[idx]["id"] = tc.id
                            if tc.function:
                                if tc.function.name:
                                    tool_call_acc[idx]["name"] += tc.function.name
                                if tc.function.arguments:
                                    tool_call_acc[idx]["args"] += tc.function.arguments

                    if choice.finish_reason:
                        finish_reason = choice.finish_reason

            except Exception as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)[:150]})}\n\n"
                return

            if finish_reason == "tool_calls" and tool_call_acc:
                # Agregar el mensaje del assistant con tool_calls al historial
                messages.append({
                    "role": "assistant",
                    "content": content_buf or None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {"name": tc["name"], "arguments": tc["args"]},
                        }
                        for tc in tool_call_acc.values()
                    ],
                })

                # Ejecutar cada tool y enviar eventos al frontend
                for tc in tool_call_acc.values():
                    try:
                        args = json.loads(tc["args"] or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    yield f"data: {json.dumps({'type': 'tool_start', 'name': tc['name'], 'args': args})}\n\n"
                    result_str = execute_tool(tc["name"], args, company_id)
                    try:
                        result_data = json.loads(result_str)
                    except Exception:
                        result_data = {"raw": result_str}
                    yield f"data: {json.dumps({'type': 'tool_result', 'name': tc['name'], 'result': result_data})}\n\n"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result_str,
                    })
                # Continuar el loop para obtener la respuesta final
            else:
                break  # finish_reason = "stop" o similar

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
