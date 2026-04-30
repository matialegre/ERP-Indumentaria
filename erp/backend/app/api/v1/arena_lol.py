"""
Mundo Outdoor — ARENA LoL 1v1 (MOBA top-down).
Server-authoritative. Solo accesible para usernames whitelisted.
Click para moverse / atacar. Q W E R poderes. Campeones: ORNN, DIANA.
"""

from __future__ import annotations

import asyncio
import math
import random
import time
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User

router = APIRouter(prefix="/arena-lol", tags=["ArenaLoL"])

ALLOWED_USERNAMES: Set[str] = {"malegre", "admindepo"}

WORLD_W = 1400
WORLD_H = 800
PLAYER_R = 22
TICK_HZ = 30
TICK_DT = 1.0 / TICK_HZ
RESPAWN_S = 8.0

WALLS: List[Dict] = [
    {"x": 0, "y": 0, "w": WORLD_W, "h": 12},
    {"x": 0, "y": WORLD_H - 12, "w": WORLD_W, "h": 12},
    {"x": 0, "y": 0, "w": 12, "h": WORLD_H},
    {"x": WORLD_W - 12, "y": 0, "w": 12, "h": WORLD_H},
    # arbustos / cobertura interior
    {"x": 320, "y": 200, "w": 90, "h": 90},
    {"x": WORLD_W - 410, "y": 200, "w": 90, "h": 90},
    {"x": 320, "y": WORLD_H - 290, "w": 90, "h": 90},
    {"x": WORLD_W - 410, "y": WORLD_H - 290, "w": 90, "h": 90},
    {"x": WORLD_W // 2 - 70, "y": WORLD_H // 2 - 30, "w": 140, "h": 60},
    {"x": 100, "y": WORLD_H // 2 - 25, "w": 70, "h": 50},
    {"x": WORLD_W - 170, "y": WORLD_H // 2 - 25, "w": 70, "h": 50},
]

SPAWNS = [(80, 80), (WORLD_W - 80, WORLD_H - 80), (80, WORLD_H - 80), (WORLD_W - 80, 80)]

# ── Campeones ─────────────────────────────────────────────────────────────
CHAMPIONS = {
    "ornn": {
        "name": "Ornn",
        "title": "El Forjador de las Montañas",
        "color": "#d97706",
        "hp": 750,
        "ad": 55,
        "armor": 0.30,        # mitiga 30% del daño físico
        "ms": 285,
        "aa_range": 95,
        "aa_cd": 1.05,
        "abilities": {
            "q": {"name": "Embestida Volcánica", "cd": 8.0,  "dmg": 180, "speed": 750, "range": 750, "slow": 0.40, "slow_dur": 1.5, "type": "line"},
            "w": {"name": "Forja del Maestro", "cd": 16.0, "shield": 250, "duration": 5.0, "aa_bonus": 50, "type": "self"},
            "e": {"name": "Llamada del Carnero", "cd": 12.0, "dist": 280, "speed": 950, "dmg": 150, "radius": 90, "type": "dash"},
            "r": {"name": "Ragnarok", "cd": 90.0, "dist": 800, "speed": 1100, "dmg": 350, "radius": 60, "knockback": 220, "type": "charge"},
        },
    },
    "diana": {
        "name": "Diana",
        "title": "Desprecio de la Luna",
        "color": "#a78bfa",
        "hp": 540,
        "ad": 62,
        "armor": 0.10,
        "ms": 340,
        "aa_range": 100,
        "aa_cd": 0.72,
        "abilities": {
            "q": {"name": "Filo de Luna Creciente", "cd": 7.0, "dmg": 175, "speed": 850, "range": 600, "radius": 70, "type": "skillshot_explode"},
            "w": {"name": "Resplandor Pálido", "cd": 14.0, "shield": 110, "duration": 3.5, "orb_dmg": 60, "orb_radius": 95, "type": "orbs"},
            "e": {"name": "Atracción Lunar", "cd": 16.0, "range": 400, "dist": 320, "speed": 1300, "type": "dash_to_target"},
            "r": {"name": "Eclipse Lunar", "cd": 60.0, "range": 420, "dmg": 260, "radius": 130, "type": "blink_aoe"},
        },
    },
}

ABILITY_KEYS = ("q", "w", "e", "r")


def _rect_circle(rx, ry, rw, rh, cx, cy, cr) -> bool:
    nx = max(rx, min(cx, rx + rw))
    ny = max(ry, min(cy, ry + rh))
    dx = cx - nx
    dy = cy - ny
    return dx * dx + dy * dy < cr * cr


def _segment_hits_rect(x1, y1, x2, y2, rx, ry, rw, rh) -> bool:
    dx = x2 - x1
    dy = y2 - y1
    tmin, tmax = 0.0, 1.0
    for p, q in ((-dx, x1 - rx), (dx, rx + rw - x1), (-dy, y1 - ry), (dy, ry + rh - y1)):
        if p == 0:
            if q < 0:
                return False
        else:
            t = q / p
            if p < 0:
                if t > tmax: return False
                if t > tmin: tmin = t
            else:
                if t < tmin: return False
                if t < tmax: tmax = t
    return tmax >= tmin


# ── Entidades ──────────────────────────────────────────────────────────────

class Player:
    def __init__(self, pid: str, username: str, ws: WebSocket):
        self.id = pid
        self.username = username
        self.ws = ws
        self.champ: Optional[str] = None
        self.spec: Optional[Dict] = None
        self.x, self.y = random.choice(SPAWNS)
        self.hp = 0.0
        self.max_hp = 0.0
        self.kills = 0
        self.deaths = 0
        self.alive = False
        self.respawn_at = 0.0
        # movimiento click-to-move
        self.dest_x: Optional[float] = None
        self.dest_y: Optional[float] = None
        self.target_id: Optional[str] = None  # AA target
        # AA
        self.last_aa = 0.0
        self.aa_count = 0  # para pasiva Diana
        # cooldowns
        self.cooldowns: Dict[str, float] = {k: 0.0 for k in ABILITY_KEYS}
        # buffs
        self.shield_hp = 0.0
        self.shield_until = 0.0
        self.slow_mult = 1.0
        self.slow_until = 0.0
        self.aa_bonus = 0.0
        self.aa_bonus_until = 0.0
        # dashes / charges activos
        self.dash_until = 0.0
        self.dash_dx = 0.0
        self.dash_dy = 0.0
        self.dash_speed = 0.0
        self.dash_dmg_radius = 0.0
        self.dash_dmg = 0.0
        self.dash_knockback = 0.0
        self.dash_hit_ids: Set[str] = set()
        self.dash_kind = ""  # "ornn_e" | "ornn_r"
        # Diana orbs
        self.orbs_until = 0.0
        self.orb_dmg = 0.0
        self.orb_radius = 0.0
        self.orb_last_hit: Dict[str, float] = {}
        # facing (para render)
        self.facing = 0.0


class Projectile:
    __slots__ = ("x", "y", "vx", "vy", "owner", "dmg", "kind", "radius", "life", "explode_on_end", "champ")

    def __init__(self, x, y, vx, vy, owner, dmg, kind, radius=0, life=1.0, explode_on_end=False, champ=""):
        self.x = x; self.y = y; self.vx = vx; self.vy = vy
        self.owner = owner; self.dmg = dmg; self.kind = kind
        self.radius = radius; self.life = life
        self.explode_on_end = explode_on_end; self.champ = champ


# ── Room ──────────────────────────────────────────────────────────────────

class Room:
    def __init__(self, rid: str):
        self.id = rid
        self.players: Dict[str, Player] = {}
        self.projectiles: List[Projectile] = []
        self.fx: List[Dict] = []  # efectos visuales: {kind, x, y, r, until, ...}
        self.task: Optional[asyncio.Task] = None
        self.last_tick = time.time()
        self.kill_feed: List[Dict] = []

    def is_full(self) -> bool:
        return len(self.players) >= 2

    async def add(self, p: Player):
        self.players[p.id] = p
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._loop())
        await self._send_init(p)

    async def remove(self, pid: str):
        self.players.pop(pid, None)

    async def _send_init(self, p: Player):
        try:
            await p.ws.send_json({
                "t": "init",
                "world": {"w": WORLD_W, "h": WORLD_H, "walls": WALLS},
                "you": p.id,
                "champions": {
                    cid: {
                        "name": c["name"], "title": c["title"], "color": c["color"],
                        "hp": c["hp"], "ad": c["ad"], "ms": c["ms"], "aa_range": c["aa_range"], "aa_cd": c["aa_cd"],
                        "abilities": {k: {"name": v["name"], "cd": v["cd"]} for k, v in c["abilities"].items()},
                    } for cid, c in CHAMPIONS.items()
                },
            })
        except Exception:
            pass

    def _spawn(self, p: Player):
        if not p.spec:
            return
        others = [o for o in self.players.values() if o.id != p.id and o.alive]
        best = None; bd = -1
        for sx, sy in SPAWNS:
            d = min((math.hypot(sx - o.x, sy - o.y) for o in others), default=1e9)
            if d > bd: bd = d; best = (sx, sy)
        p.x, p.y = best or random.choice(SPAWNS)
        p.hp = p.max_hp
        p.alive = True
        p.dest_x = p.dest_y = None
        p.target_id = None
        p.shield_hp = 0; p.shield_until = 0
        p.slow_mult = 1.0; p.slow_until = 0
        p.aa_bonus = 0; p.aa_bonus_until = 0
        p.dash_until = 0
        p.orbs_until = 0
        p.aa_count = 0

    def _select_champion(self, p: Player, cid: str):
        if cid not in CHAMPIONS: return
        spec = CHAMPIONS[cid]
        p.champ = cid
        p.spec = spec
        p.max_hp = float(spec["hp"])
        p.hp = p.max_hp
        p.alive = True
        p.cooldowns = {k: 0.0 for k in ABILITY_KEYS}

    # ── Daño ──
    def _apply_damage(self, target: Player, dmg: float, owner_id: str, now: float, source: str = "?"):
        if not target.alive or dmg <= 0:
            return
        # armadura
        if target.spec:
            dmg = dmg * (1.0 - target.spec.get("armor", 0))
        # escudo
        if target.shield_hp > 0 and now < target.shield_until:
            absorb = min(target.shield_hp, dmg)
            target.shield_hp -= absorb
            dmg -= absorb
            if target.shield_hp <= 0:
                target.shield_until = 0
        if dmg <= 0: return
        target.hp -= dmg
        if target.hp <= 0:
            target.alive = False
            target.deaths += 1
            target.respawn_at = now + RESPAWN_S
            killer = self.players.get(owner_id)
            if killer and killer.id != target.id:
                killer.kills += 1
            self.kill_feed.append({
                "t": now,
                "killer": killer.username if killer and killer.id != target.id else "—",
                "killer_champ": killer.champ if killer else "",
                "victim": target.username,
                "victim_champ": target.champ or "",
                "src": source,
            })
            self.kill_feed = self.kill_feed[-6:]

    # ── Movimiento ──
    def _try_move(self, p: Player, nx: float, ny: float) -> None:
        # mover X
        blocked = False
        for w in WALLS:
            if _rect_circle(w["x"], w["y"], w["w"], w["h"], nx, p.y, PLAYER_R):
                blocked = True; break
        if not blocked:
            p.x = max(PLAYER_R, min(WORLD_W - PLAYER_R, nx))
        # mover Y
        blocked = False
        for w in WALLS:
            if _rect_circle(w["x"], w["y"], w["w"], w["h"], p.x, ny, PLAYER_R):
                blocked = True; break
        if not blocked:
            p.y = max(PLAYER_R, min(WORLD_H - PLAYER_R, ny))

    def _step_player(self, p: Player, dt: float, now: float):
        if not p.alive or not p.spec:
            return
        # buffs expirados
        if now >= p.slow_until: p.slow_mult = 1.0
        if now >= p.aa_bonus_until: p.aa_bonus = 0
        # dash override
        if now < p.dash_until:
            old_x, old_y = p.x, p.y
            nx = p.x + p.dash_dx * p.dash_speed * dt
            ny = p.y + p.dash_dy * p.dash_speed * dt
            self._try_move(p, nx, ny)
            # daño en aterrizaje al final del dash
            if now + dt >= p.dash_until:
                if p.dash_dmg > 0:
                    for o in self.players.values():
                        if o.id == p.id or not o.alive: continue
                        if math.hypot(o.x - p.x, o.y - p.y) <= p.dash_dmg_radius + PLAYER_R:
                            self._apply_damage(o, p.dash_dmg, p.id, now, source=f"{p.champ}_{p.dash_kind}")
                            if p.dash_kind == "ornn_e":
                                # lift visual: victim es "levantado" en la interfaz
                                self.fx.append({"kind": "ornn_e_lift", "x": o.x, "y": o.y, "victim": o.id, "until": now + 0.5})
                    self.fx.append({"kind": "shockwave", "x": p.x, "y": p.y, "r": p.dash_dmg_radius, "until": now + 0.4, "color": "#f59e0b" if p.champ == "ornn" else "#a78bfa"})
                    if p.dash_kind == "ornn_e":
                        # dust ring + small debris
                        self.fx.append({"kind": "ornn_e_dust", "x": p.x, "y": p.y, "r": p.dash_dmg_radius, "until": now + 0.7, "color": "#d4a373"})
                    elif p.dash_kind == "diana_e":
                        self.fx.append({"kind": "diana_e_impact", "x": p.x, "y": p.y, "until": now + 0.5, "color": "#a78bfa"})
                p.dash_dmg = 0
            # daño en colisión durante carga (Ragnarok)
            if p.dash_kind == "ornn_r":
                for o in self.players.values():
                    if o.id == p.id or not o.alive or o.id in p.dash_hit_ids: continue
                    if math.hypot(o.x - p.x, o.y - p.y) <= p.dash_dmg_radius + PLAYER_R:
                        self._apply_damage(o, p.spec["abilities"]["r"]["dmg"], p.id, now, source="ornn_r")
                        p.dash_hit_ids.add(o.id)
                        # knockback
                        ang = math.atan2(o.y - p.y, o.x - p.x)
                        kb = p.dash_knockback
                        for _ in range(8):
                            self._try_move(o, o.x + math.cos(ang) * kb / 8, o.y + math.sin(ang) * kb / 8)
            return
        # auto-attack si tiene target
        if p.target_id:
            tgt = self.players.get(p.target_id)
            if tgt and tgt.alive:
                d = math.hypot(tgt.x - p.x, tgt.y - p.y)
                rng = p.spec["aa_range"] + PLAYER_R
                if d <= rng:
                    p.dest_x = p.dest_y = None
                    p.facing = math.atan2(tgt.y - p.y, tgt.x - p.x)
                    aa_cd = p.spec["aa_cd"]
                    if now - p.last_aa >= aa_cd:
                        p.last_aa = now
                        p.aa_count += 1
                        dmg = p.spec["ad"] + p.aa_bonus
                        # Diana pasiva: cada 3er AA crit
                        if p.champ == "diana" and p.aa_count % 3 == 0:
                            dmg += 100
                            self.fx.append({"kind": "crit", "x": tgt.x, "y": tgt.y, "until": now + 0.4})
                        self._apply_damage(tgt, dmg, p.id, now, source="aa")
                        self.fx.append({"kind": "aa", "x1": p.x, "y1": p.y, "x2": tgt.x, "y2": tgt.y, "until": now + 0.12, "color": p.spec["color"]})
                        # Forja Maestro: AA empoderado en W
                        if p.aa_bonus > 0:
                            self.fx.append({"kind": "spark", "x": tgt.x, "y": tgt.y, "until": now + 0.3})
                else:
                    p.dest_x = tgt.x; p.dest_y = tgt.y
            else:
                p.target_id = None
        # mover hacia destino
        if p.dest_x is not None and p.dest_y is not None:
            dx = p.dest_x - p.x
            dy = p.dest_y - p.y
            d = math.hypot(dx, dy)
            if d < 4:
                p.dest_x = p.dest_y = None
            else:
                speed = p.spec["ms"] * p.slow_mult
                step = min(d, speed * dt)
                ix = dx / d; iy = dy / d
                p.facing = math.atan2(iy, ix)
                self._try_move(p, p.x + ix * step, p.y + iy * step)
        # orbes Diana
        if now < p.orbs_until and p.orb_dmg > 0:
            for o in self.players.values():
                if o.id == p.id or not o.alive: continue
                d = math.hypot(o.x - p.x, o.y - p.y)
                if d <= p.orb_radius + PLAYER_R:
                    last = p.orb_last_hit.get(o.id, 0)
                    if now - last >= 0.6:
                        p.orb_last_hit[o.id] = now
                        self._apply_damage(o, p.orb_dmg, p.id, now, source="diana_w")

    # ── Habilidades ──
    def _use_ability(self, p: Player, key: str, mx: float, my: float, target_id: str, now: float):
        if not p.alive or not p.spec or key not in ABILITY_KEYS:
            return
        # ── Ornn R recast: si presiona R durante Ragnarok activo → segundo impacto AoE ──
        if (key == "r" and p.champ == "ornn" and now < p.dash_until
                and p.dash_kind == "ornn_r" and not getattr(p, "_r_recasted", False)):
            rspec = p.spec["abilities"]["r"]
            # AoE extra de golpe en la posición actual
            burst_r = rspec["radius"] * 1.6
            for o in self.players.values():
                if o.id == p.id or not o.alive: continue
                if math.hypot(o.x - p.x, o.y - p.y) <= burst_r + PLAYER_R:
                    self._apply_damage(o, rspec["dmg"] * 0.9, p.id, now, source="ornn_r2")
                    # knockback radial extra
                    ang2 = math.atan2(o.y - p.y, o.x - p.x)
                    kb2 = rspec["knockback"] * 0.7
                    for _ in range(6):
                        self._try_move(o, o.x + math.cos(ang2) * kb2 / 6, o.y + math.sin(ang2) * kb2 / 6)
            self.fx.append({"kind": "ornn_r_burst", "x": p.x, "y": p.y, "r": burst_r, "until": now + 0.6, "color": "#dc2626"})
            self.fx.append({"kind": "shockwave", "x": p.x, "y": p.y, "r": burst_r, "until": now + 0.5, "color": "#fbbf24"})
            p._r_recasted = True
            # corta el dash para que aterrice acá
            p.dash_until = now
            return
        if now < p.cooldowns.get(key, 0): return
        spec = p.spec["abilities"][key]
        ang = math.atan2(my - p.y, mx - p.x)
        cid = p.champ

        if cid == "ornn":
            if key == "q":
                p.cooldowns["q"] = now + spec["cd"]
                proj = Projectile(
                    p.x + math.cos(ang) * (PLAYER_R + 6),
                    p.y + math.sin(ang) * (PLAYER_R + 6),
                    math.cos(ang) * spec["speed"], math.sin(ang) * spec["speed"],
                    p.id, spec["dmg"], "ornn_q", radius=14, life=spec["range"]/spec["speed"], champ="ornn"
                )
                self.projectiles.append(proj)
            elif key == "w":
                p.cooldowns["w"] = now + spec["cd"]
                p.shield_hp = spec["shield"]; p.shield_until = now + spec["duration"]
                p.aa_bonus = spec["aa_bonus"]; p.aa_bonus_until = now + spec["duration"]
                self.fx.append({"kind": "buff", "x": p.x, "y": p.y, "owner": p.id, "until": now + spec["duration"], "color": "#f59e0b"})
            elif key == "e":
                p.cooldowns["e"] = now + spec["cd"]
                dist = spec["dist"]; sp = spec["speed"]
                p.dash_dx = math.cos(ang); p.dash_dy = math.sin(ang)
                p.dash_speed = sp
                p.dash_until = now + dist / sp
                p.dash_dmg = spec["dmg"]; p.dash_dmg_radius = spec["radius"]
                p.dash_kind = "ornn_e"; p.dash_hit_ids = set()
            elif key == "r":
                p.cooldowns["r"] = now + spec["cd"]
                dist = spec["dist"]; sp = spec["speed"]
                p.dash_dx = math.cos(ang); p.dash_dy = math.sin(ang)
                p.dash_speed = sp
                p.dash_until = now + dist / sp
                p.dash_dmg = 0; p.dash_dmg_radius = spec["radius"]
                p.dash_knockback = spec["knockback"]
                p.dash_kind = "ornn_r"; p.dash_hit_ids = set()
                p._r_recasted = False
                self.fx.append({"kind": "ult_telegraph", "x": p.x, "y": p.y, "ang": ang, "len": dist, "until": now + 0.6, "color": "#dc2626"})
                self.fx.append({"kind": "ornn_r_start", "x": p.x, "y": p.y, "ang": ang, "until": now + 0.4, "color": "#dc2626"})

        elif cid == "diana":
            if key == "q":
                p.cooldowns["q"] = now + spec["cd"]
                proj = Projectile(
                    p.x + math.cos(ang) * (PLAYER_R + 6),
                    p.y + math.sin(ang) * (PLAYER_R + 6),
                    math.cos(ang) * spec["speed"], math.sin(ang) * spec["speed"],
                    p.id, spec["dmg"], "diana_q", radius=spec["radius"],
                    life=spec["range"]/spec["speed"], explode_on_end=True, champ="diana"
                )
                self.projectiles.append(proj)
            elif key == "w":
                p.cooldowns["w"] = now + spec["cd"]
                p.shield_hp = spec["shield"]; p.shield_until = now + spec["duration"]
                p.orbs_until = now + spec["duration"]
                p.orb_dmg = spec["orb_dmg"]; p.orb_radius = spec["orb_radius"]
                p.orb_last_hit = {}
            elif key == "e":
                # dash hacia enemigo más cercano en rango, si no, en dirección al mouse
                p.cooldowns["e"] = now + spec["cd"]
                target = None; tdist = spec["range"] + 1
                for o in self.players.values():
                    if o.id == p.id or not o.alive: continue
                    d = math.hypot(o.x - p.x, o.y - p.y)
                    if d < tdist:
                        target = o; tdist = d
                if target and tdist <= spec["range"]:
                    a = math.atan2(target.y - p.y, target.x - p.x)
                else:
                    a = ang
                dist = min(spec["dist"], tdist - PLAYER_R * 2 if target else spec["dist"])
                dist = max(60, dist)
                sp = spec["speed"]
                p.dash_dx = math.cos(a); p.dash_dy = math.sin(a)
                p.dash_speed = sp
                p.dash_until = now + dist / sp
                p.dash_dmg = 0; p.dash_kind = "diana_e"
                if target:
                    p.target_id = target.id
            elif key == "r":
                p.cooldowns["r"] = now + spec["cd"]
                # blink al cursor (capado a range), daño en área de aterrizaje
                d = math.hypot(mx - p.x, my - p.y)
                d = min(d, spec["range"])
                tx = p.x + math.cos(ang) * d
                ty = p.y + math.sin(ang) * d
                # buscar punto válido (no dentro de pared)
                step = 10
                while step <= d:
                    cand_x = p.x + math.cos(ang) * (d - step)
                    cand_y = p.y + math.sin(ang) * (d - step)
                    bad = False
                    for w in WALLS:
                        if _rect_circle(w["x"], w["y"], w["w"], w["h"], cand_x, cand_y, PLAYER_R):
                            bad = True; break
                    if not bad:
                        tx, ty = cand_x, cand_y; break
                    step += 10
                self.fx.append({"kind": "blink_out", "x": p.x, "y": p.y, "until": now + 0.4})
                p.x = max(PLAYER_R, min(WORLD_W - PLAYER_R, tx))
                p.y = max(PLAYER_R, min(WORLD_H - PLAYER_R, ty))
                self.fx.append({"kind": "shockwave", "x": p.x, "y": p.y, "r": spec["radius"], "until": now + 0.5, "color": "#a78bfa"})
                for o in self.players.values():
                    if o.id == p.id or not o.alive: continue
                    if math.hypot(o.x - p.x, o.y - p.y) <= spec["radius"] + PLAYER_R:
                        self._apply_damage(o, spec["dmg"], p.id, now, source="diana_r")

    # ── Proyectiles ──
    def _step_projectiles(self, dt: float, now: float):
        survivors: List[Projectile] = []
        for pr in self.projectiles:
            pr.life -= dt
            nx = pr.x + pr.vx * dt
            ny = pr.y + pr.vy * dt
            ended = pr.life <= 0
            hit_wall = False
            for w in WALLS:
                if _segment_hits_rect(pr.x, pr.y, nx, ny, w["x"], w["y"], w["w"], w["h"]):
                    hit_wall = True; break
            hit_player = None
            if not hit_wall:
                for op in self.players.values():
                    if not op.alive or op.id == pr.owner: continue
                    dx = nx - op.x; dy = ny - op.y
                    if dx * dx + dy * dy < (PLAYER_R + max(6, pr.radius // 2)) ** 2:
                        hit_player = op; break
            if hit_wall or hit_player or ended:
                if pr.kind == "ornn_q":
                    if hit_player:
                        self._apply_damage(hit_player, pr.dmg, pr.owner, now, source="ornn_q")
                        hit_player.slow_mult = 1.0 - 0.40
                        hit_player.slow_until = now + 1.5
                    self.fx.append({"kind": "ornn_q_hit", "x": pr.x, "y": pr.y, "until": now + 0.3})
                elif pr.kind == "diana_q":
                    cx, cy = (hit_player.x, hit_player.y) if hit_player else (pr.x, pr.y)
                    for op in self.players.values():
                        if op.id == pr.owner or not op.alive: continue
                        if math.hypot(op.x - cx, op.y - cy) <= pr.radius + PLAYER_R:
                            self._apply_damage(op, pr.dmg, pr.owner, now, source="diana_q")
                    self.fx.append({"kind": "shockwave", "x": cx, "y": cy, "r": pr.radius, "until": now + 0.4, "color": "#a78bfa"})
                continue
            pr.x = nx; pr.y = ny
            survivors.append(pr)
        self.projectiles = survivors
        self.fx = [f for f in self.fx if f.get("until", 0) > now]

    # ── Broadcast ──
    async def _broadcast(self, now: float):
        state = {
            "t": "state", "now": now,
            "players": [
                {
                    "id": p.id, "u": p.username, "champ": p.champ, "color": (p.spec or {}).get("color", "#fff"),
                    "x": round(p.x, 1), "y": round(p.y, 1),
                    "hp": max(0, round(p.hp)), "max_hp": round(p.max_hp),
                    "k": p.kills, "d": p.deaths, "alive": p.alive,
                    "facing": round(p.facing, 3),
                    "respawn": max(0.0, round(p.respawn_at - now, 1)) if not p.alive else 0,
                    "shield": round(p.shield_hp) if p.shield_hp > 0 and now < p.shield_until else 0,
                    "slow": round(max(0.0, p.slow_until - now), 2),
                    "dash": round(max(0.0, p.dash_until - now), 2),
                    "dash_kind": p.dash_kind if now < p.dash_until else "",
                    "orbs": round(max(0.0, p.orbs_until - now), 2),
                    "buff": round(max(0.0, p.aa_bonus_until - now), 2),
                    "cd": {k: round(max(0.0, v - now), 2) for k, v in p.cooldowns.items()},
                    "dest": [round(p.dest_x, 0), round(p.dest_y, 0)] if p.dest_x is not None else None,
                    "tgt": p.target_id,
                }
                for p in self.players.values()
            ],
            "projectiles": [
                {"x": round(pr.x, 1), "y": round(pr.y, 1), "vx": round(pr.vx, 0), "vy": round(pr.vy, 0),
                 "kind": pr.kind, "r": pr.radius, "champ": pr.champ}
                for pr in self.projectiles
            ],
            "fx": [
                {**{k: (round(v, 2) if isinstance(v, float) else v) for k, v in f.items() if k != "owner"},
                 "left": round(f["until"] - now, 2)}
                for f in self.fx
            ],
            "feed": self.kill_feed,
        }
        dead: List[str] = []
        for p in list(self.players.values()):
            try:
                await p.ws.send_json(state)
            except Exception:
                dead.append(p.id)
        for pid in dead:
            self.players.pop(pid, None)

    async def _loop(self):
        while self.players:
            now = time.time()
            dt = min(0.1, now - self.last_tick)
            self.last_tick = now
            for p in self.players.values():
                if not p.alive and p.spec and now >= p.respawn_at:
                    self._spawn(p)
                self._step_player(p, dt, now)
            self._step_projectiles(dt, now)
            await self._broadcast(now)
            await asyncio.sleep(TICK_DT)


# ── Lobby ──────────────────────────────────────────────────────────────────

ROOMS: Dict[str, Room] = {}
_lock = asyncio.Lock()


async def _get_room() -> Room:
    async with _lock:
        for r in ROOMS.values():
            if not r.is_full():
                return r
        rid = f"lol{len(ROOMS)+1}"
        r = Room(rid)
        ROOMS[rid] = r
        return r


# ── WebSocket ──────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def arena_lol_ws(ws: WebSocket, token: str = ""):
    await ws.accept()
    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION); return
    try:
        payload = decode_access_token(token)
        username = payload.get("sub") or ""
    except Exception:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION); return
    if username not in ALLOWED_USERNAMES:
        await ws.send_json({"t": "error", "msg": "Acceso denegado"})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION); return
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION); return
    finally:
        db.close()

    pid = f"{username}-{int(time.time()*1000)%100000}"
    player = Player(pid, username, ws)
    room = await _get_room()
    await room.add(player)

    try:
        while True:
            msg = await ws.receive_json()
            mt = msg.get("t")
            if mt == "champ":
                cid = msg.get("c")
                room._select_champion(player, cid)
            elif mt == "move":
                if not player.spec or not player.alive: continue
                try:
                    player.dest_x = float(msg["x"])
                    player.dest_y = float(msg["y"])
                    player.target_id = None
                except Exception:
                    pass
            elif mt == "attack":
                if not player.spec or not player.alive: continue
                tid = msg.get("target")
                if tid in room.players and tid != pid:
                    player.target_id = tid
            elif mt == "ability":
                if not player.spec or not player.alive: continue
                k = msg.get("k")
                try:
                    mx = float(msg.get("x", player.x))
                    my = float(msg.get("y", player.y))
                except Exception:
                    mx = player.x; my = player.y
                tid = msg.get("target")
                room._use_ability(player, k, mx, my, tid, time.time())
            elif mt == "stop":
                player.dest_x = player.dest_y = None
                player.target_id = None
            elif mt == "ping":
                await ws.send_json({"t": "pong", "ts": msg.get("ts")})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await room.remove(pid)
