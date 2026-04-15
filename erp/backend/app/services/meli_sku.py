"""
Servicio de resolución de SKU para productos con sufijo -OUT.
Porta la lógica de sku_resolver.py del standalone.
"""
from __future__ import annotations

import logging
import requests
from typing import Optional, Dict, Any
from functools import lru_cache

logger = logging.getLogger(__name__)


class SKUResolver:
    """Resuelve SKUs reales para productos con sufijo OUT."""

    def __init__(self, access_token: str):
        self.access_token = access_token

    @lru_cache(maxsize=500)
    def get_real_sku(self, item_id: str, variation_id: Optional[str], current_sku: str) -> str:
        if not current_sku or not current_sku.endswith("OUT"):
            return current_sku

        try:
            item_data = self._get_item(item_id)
            if not item_data:
                return current_sku

            variations = item_data.get("variations", [])
            if variations and variation_id:
                real_sku = self._get_sku_from_variation(variations, variation_id)
                if real_sku:
                    return real_sku

            custom_field = item_data.get("seller_custom_field")
            if custom_field and custom_field != current_sku:
                return custom_field

            return current_sku
        except Exception:
            return current_sku

    def _get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        try:
            resp = requests.get(
                f"https://api.mercadolibre.com/items/{item_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def _get_sku_from_variation(self, variations: list, variation_id: str) -> Optional[str]:
        try:
            vid = int(variation_id)
            for var in variations:
                if var.get("id") == vid:
                    return var.get("seller_custom_field")
        except (ValueError, TypeError):
            pass
        return None

    def clear_cache(self):
        self.get_real_sku.cache_clear()


def resolve_sku(access_token: str, item_id: str, variation_id: Optional[str], current_sku: str) -> str:
    if not current_sku or not current_sku.endswith("OUT"):
        return current_sku
    resolver = SKUResolver(access_token)
    return resolver.get_real_sku(item_id, variation_id, current_sku)


def is_out_sku(sku: str) -> bool:
    return bool(sku and sku.endswith("OUT"))
