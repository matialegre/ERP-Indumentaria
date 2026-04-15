"""
Servicio de publicación de notas en órdenes MercadoLibre.
Multi-cuenta: selecciona token según seller_id.
Porta la lógica de 10_note_publisher.py del standalone.
"""
from __future__ import annotations

import re
import logging
import requests
from typing import Optional, Dict

logger = logging.getLogger(__name__)

API_BASE = "https://api.mercadolibre.com"
API_BLOCK_RE = re.compile(r"\[APPMATI:.*?\]", re.IGNORECASE)
STOCK_TAG_RE = re.compile(r"\[STOCK\s*-\s*\d+\s+MOV\s+\d+\]", re.IGNORECASE)


def _refresh_token(client_id: str, client_secret: str, refresh_token: str) -> Optional[str]:
    """Refresca token OAuth y retorna el nuevo access_token."""
    try:
        resp = requests.post(
            f"{API_BASE}/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
            },
            timeout=20,
        )
        if resp.status_code == 200:
            return resp.json().get("access_token")
    except Exception:
        pass
    return None


def _fetch_notes_with_ids(order_id: str, token: str):
    """Retorna (texto_concatenado, note_id_con_appmati)."""
    url = f"{API_BASE}/orders/{order_id}/notes"
    try:
        r = requests.get(url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }, params={"role": "seller"}, timeout=20)
        if r.status_code != 200:
            return "", None
        data = r.json()

        notes_list = []
        if isinstance(data, list):
            for it in data:
                if isinstance(it, dict):
                    if "results" in it and isinstance(it["results"], list):
                        notes_list.extend(it["results"])
                    else:
                        notes_list.append(it)
        elif isinstance(data, dict):
            if "results" in data and isinstance(data["results"], list):
                notes_list.extend(data["results"])
            else:
                notes_list.append(data)

        texts = []
        appmati_note_id = None
        for n in notes_list:
            t = (n.get("note") or n.get("text") or n.get("plain_text") or "").strip()
            if t:
                texts.append(t)
                if API_BLOCK_RE.search(t) and not appmati_note_id:
                    appmati_note_id = n.get("id")

        return " | ".join(texts), appmati_note_id
    except Exception:
        return "", None


def _build_api_block(deposito: str, qty: int, agotado: bool, observacion: str) -> str:
    ag = "SI" if agotado else "NO"
    dep_print = "DEPOSITO" if str(deposito or "").strip().upper() == "DEP" else deposito
    return f"[APPMATI: {dep_print} qty={qty} agotado={ag} | {observacion}]"


def _merge_notes(existing: str, api_block: str, stock_tag: Optional[str]) -> str:
    base = API_BLOCK_RE.sub("", existing or "").strip()
    parts = [p for p in [api_block, base] if p]
    final = " ".join(parts).strip()
    if stock_tag and not STOCK_TAG_RE.search(final):
        final = f"{final} {stock_tag}" if final else stock_tag
    return final[:2000]


def publish_note(
    *,
    order_id: str,
    access_token: str,
    client_id: str = "",
    client_secret: str = "",
    refresh_token_str: str = "",
    deposito: str,
    qty: int,
    agotado: bool = False,
    observacion: str = "",
    numero_mov: Optional[int] = None,
) -> Dict:
    """Publica nota idempotente en orden ML."""
    api_block = _build_api_block(deposito, qty, agotado, observacion)
    stock_tag = f"[STOCK -{qty} MOV {numero_mov}]" if numero_mov and qty > 0 else None

    existing, appmati_note_id = _fetch_notes_with_ids(order_id, access_token)
    final_text = _merge_notes(existing, api_block, stock_tag)

    def _post(tok, text):
        return requests.post(
            f"{API_BASE}/orders/{order_id}/notes",
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            json={"note": text}, timeout=20,
        )

    def _put(tok, text, nid):
        return requests.put(
            f"{API_BASE}/orders/{order_id}/notes/{nid}",
            headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
            json={"note": text}, timeout=20,
        )

    tok = access_token
    if appmati_note_id:
        resp = _put(tok, final_text, appmati_note_id)
    else:
        resp = _post(tok, final_text)

    # Retry on 401
    if resp.status_code == 401 and client_id and client_secret and refresh_token_str:
        new_tok = _refresh_token(client_id, client_secret, refresh_token_str)
        if new_tok:
            tok = new_tok
            if appmati_note_id:
                resp = _put(tok, final_text, appmati_note_id)
            else:
                resp = _post(tok, final_text)

    ok = resp.status_code in (200, 201)
    return {
        "ok": ok,
        "status": resp.status_code,
        "error": "" if ok else resp.text[:300],
        "note": final_text,
        "new_token": tok if tok != access_token else None,
    }
