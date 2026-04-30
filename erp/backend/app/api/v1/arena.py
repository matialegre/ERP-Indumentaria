"""
Mundo Outdoor — ARENA 1v1 (modo Counter-Strike feo)
Server-authoritative, WebSocket. Solo accesible para usernames whitelisted.
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

router = APIRouter(prefix="/arena", tags=["Arena"])

# Whitelist absoluta — solo estos usuarios pueden conectarse
ALLOWED_USERNAMES: Set[str] = {"malegre", "admindepo"}

# ── Constantes del mundo ────────────────────────────────────────────────────
WORLD_W = 1200
WORLD_H = 700
PLAYER_R = 16
TICK_HZ = 30
TICK_DT = 1.0 / TICK_HZ
RESPAWN_S = 3.0
MAX_HP = 100

# Mapa: paredes rectangulares (x, y, w, h)
WALLS: List[Dict] = [
    {"x": 0, "y": 0, "w": WORLD_W, "h": 10},
    {"x": 0, "y": WORLD_H - 10, "w": WORLD_W, "h": 10},
    {"x": 0, "y": 0, "w": 10, "h": WORLD_H},
    {"x": WORLD_W - 10, "y": 0, "w": 10, "h": WORLD_H},
    # cajas / cobertura interior
    {"x": 250, "y": 150, "w": 80, "h": 80},
    {"x": 870, "y": 150, "w": 80, "h": 80},
    {"x": 250, "y": 470, "w": 80, "h": 80},
    {"x": 870, "y": 470, "w": 80, "h": 80},
    {"x": 540, "y": 320, "w": 120, "h": 60},
    {"x": 100, "y": 330, "w": 60, "h": 40},
    {"x": WORLD_W - 160, "y": 330, "w": 60, "h": 40},
]

SPAWNS = [(60, 60), (WORLD_W - 60, WORLD_H - 60), (60, WORLD_H - 60), (WORLD_W - 60, 60)]

# weapon stats: damage, speed (px/s), fire_rate (s entre disparos), spread (rad), pellets, ammo
WEAPONS = {
    "pistol":  {"dmg": 18, "speed": 700, "rate": 0.30, "spread": 0.04, "pellets": 1, "ammo": 999},
    "shotgun": {"dmg": 11, "speed": 600, "rate": 0.85, "spread": 0.30, "pellets": 6, "ammo": 999},
    "ak":      {"dmg": 14, "speed": 850, "rate": 0.10, "spread": 0.10, "pellets": 1, "ammo": 999},
}
WEAPON_ORDER = ["pistol", "shotgun", "ak"]

PLAYER_SPEED = 220  # px/s

# ── Habilidades estilo LoL (1=Q, 2=W, 3=E, 4=R) ────────────────────────────
ABILITIES = {
    "dash":    {"cd": 6.0,  "duration": 0.18},
    "shield":  {"cd": 14.0, "duration": 3.0,  "absorb": 60},
    "grenade": {"cd": 10.0, "speed": 480, "fuse": 0.7, "radius": 90, "dmg": 75},
    "rage":    {"cd": 35.0, "duration": 5.0, "fire_mult": 1.7, "speed_mult": 1.35, "dmg_mult": 1.25},
}
DASH_SPEED = 1400  # px/s durante el dash


# ── Helpers ────────────────────────────────────────────────────────────────

def _rect_circle_collide(rx, ry, rw, rh, cx, cy, cr) -> bool:
    nx = max(rx, min(cx, rx + rw))
    ny = max(ry, min(cy, ry + rh))
    dx = cx - nx
    dy = cy - ny
    return dx * dx + dy * dy < cr * cr


def _segment_hits_rect(x1, y1, x2, y2, rx, ry, rw, rh) -> bool:
    # AABB vs segment (slab method)
    dx = x2 - x1
    dy = y2 - y1
    tmin = 0.0
    tmax = 1.0
    for p, q, lo, hi in (
        (-dx, x1 - rx, 0, 0),
        (dx, rx + rw - x1, 0, 0),
        (-dy, y1 - ry, 0, 0),
        (dy, ry + rh - y1, 0, 0),
    ):
        if p == 0:
            if q < 0:
                return False
        else:
            t = q / p
            if p < 0:
                if t > tmax:
                    return False
                if t > tmin:
                    tmin = t
            else:
                if t < tmin:
                    return False
                if t < tmax:
                    tmax = t
    return tmax >= tmin


# ── Player & Bullet ────────────────────────────────────────────────────────

class Player:
    def __init__(self, pid: str, username: str, ws: WebSocket):
        self.id = pid
        self.username = username
        self.ws = ws
        self.x, self.y = random.choice(SPAWNS)
        self.hp = MAX_HP
        self.kills = 0
        self.deaths = 0
        self.weapon = "pistol"
        self.last_shot = 0.0
        self.alive = True
        self.respawn_at = 0.0
        self.input = {"up": 0, "down": 0, "left": 0, "right": 0,
                      "aim": 0.0, "shoot": False, "mx": 0.0, "my": 0.0}
        self.color = "#" + "".join(random.choice("3456789abcdef") for _ in range(6))
        # ── Habilidades ──
        self.cooldowns: Dict[str, float] = {k: 0.0 for k in ABILITIES}
        self.dash_until = 0.0
        self.dash_dx = 0.0
        self.dash_dy = 0.0
        self.shield_hp = 0.0
        self.shield_until = 0.0
        self.rage_until = 0.0


class Grenade:
    __slots__ = ("x", "y", "vx", "vy", "fuse", "owner", "dmg", "radius")

    def __init__(self, x, y, vx, vy, fuse, owner, dmg, radius):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.fuse = fuse
        self.owner = owner
        self.dmg = dmg
        self.radius = radius


class Bullet:
    __slots__ = ("x", "y", "vx", "vy", "life", "owner", "dmg")

    def __init__(self, x, y, vx, vy, owner, dmg):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.life = 1.5
        self.owner = owner
        self.dmg = dmg


# ── Room ───────────────────────────────────────────────────────────────────

class Room:
    def __init__(self, rid: str):
        self.id = rid
        self.players: Dict[str, Player] = {}
        self.bullets: List[Bullet] = []
        self.grenades: List[Grenade] = []
        self.explosions: List[Dict] = []  # [{x, y, r, until}]
        self.task: Optional[asyncio.Task] = None
        self.last_tick = time.time()
        self.kill_feed: List[Dict] = []  # [{t, killer, victim, weapon}]

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
                "weapons": list(WEAPONS.keys()),
                "abilities": {k: {"cd": v["cd"]} for k, v in ABILITIES.items()},
            })
        except Exception:
            pass

    def _spawn(self, p: Player):
        # spawn lejos del enemigo si lo hay
        others = [o for o in self.players.values() if o.id != p.id and o.alive]
        best = None
        bd = -1
        for sx, sy in SPAWNS:
            d = min((math.hypot(sx - o.x, sy - o.y) for o in others), default=1e9)
            if d > bd:
                bd = d
                best = (sx, sy)
        p.x, p.y = best or random.choice(SPAWNS)
        p.hp = MAX_HP
        p.alive = True
        # limpiar buffs al respawn
        p.shield_hp = 0.0
        p.shield_until = 0.0
        p.rage_until = 0.0
        p.dash_until = 0.0

    def _use_ability(self, p: Player, ability: str, now: float):
        if not p.alive:
            return
        spec = ABILITIES.get(ability)
        if not spec:
            return
        if now < p.cooldowns.get(ability, 0.0):
            return
        p.cooldowns[ability] = now + spec["cd"]
        ang = p.input.get("aim", 0.0)
        if ability == "dash":
            p.dash_dx = math.cos(ang)
            p.dash_dy = math.sin(ang)
            p.dash_until = now + spec["duration"]
        elif ability == "shield":
            p.shield_hp = float(spec["absorb"])
            p.shield_until = now + spec["duration"]
        elif ability == "grenade":
            gx = p.x + math.cos(ang) * (PLAYER_R + 6)
            gy = p.y + math.sin(ang) * (PLAYER_R + 6)
            gvx = math.cos(ang) * spec["speed"]
            gvy = math.sin(ang) * spec["speed"]
            self.grenades.append(Grenade(gx, gy, gvx, gvy, spec["fuse"], p.id, spec["dmg"], spec["radius"]))
        elif ability == "rage":
            p.rage_until = now + spec["duration"]

    def _apply_damage(self, target: Player, dmg: float, owner_id: str, now: float, weapon: str = "?"):
        if not target.alive or dmg <= 0:
            return
        # escudo absorbe primero
        if target.shield_hp > 0 and now < target.shield_until:
            absorbed = min(target.shield_hp, dmg)
            target.shield_hp -= absorbed
            dmg -= absorbed
            if target.shield_hp <= 0:
                target.shield_until = 0
        if dmg <= 0:
            return
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
                "victim": target.username,
                "weapon": weapon if weapon != "?" else (killer.weapon if killer else "?"),
            })
            self.kill_feed = self.kill_feed[-6:]

    def _move_player(self, p: Player, dt: float, now: float):
        if not p.alive:
            return
        # dash override
        if now < p.dash_until:
            ix, iy = p.dash_dx, p.dash_dy
            speed = DASH_SPEED
        else:
            ix = (p.input["right"] - p.input["left"])
            iy = (p.input["down"] - p.input["up"])
            if ix == 0 and iy == 0:
                return
            ln = math.hypot(ix, iy) or 1
            ix /= ln
            iy /= ln
            speed = PLAYER_SPEED
            if now < p.rage_until:
                speed *= ABILITIES["rage"]["speed_mult"]
        nx = p.x + ix * speed * dt
        ny = p.y + iy * speed * dt
        # colisión X
        blocked = False
        for w in WALLS:
            if _rect_circle_collide(w["x"], w["y"], w["w"], w["h"], nx, p.y, PLAYER_R):
                blocked = True
                break
        if not blocked:
            p.x = max(PLAYER_R, min(WORLD_W - PLAYER_R, nx))
        # colisión Y
        blocked = False
        for w in WALLS:
            if _rect_circle_collide(w["x"], w["y"], w["w"], w["h"], p.x, ny, PLAYER_R):
                blocked = True
                break
        if not blocked:
            p.y = max(PLAYER_R, min(WORLD_H - PLAYER_R, ny))

    def _shoot(self, p: Player, now: float):
        if not p.alive or not p.input.get("shoot"):
            return
        spec = WEAPONS.get(p.weapon, WEAPONS["pistol"])
        rate = spec["rate"]
        dmg_mult = 1.0
        if now < p.rage_until:
            rate /= ABILITIES["rage"]["fire_mult"]
            dmg_mult = ABILITIES["rage"]["dmg_mult"]
        if now - p.last_shot < rate:
            return
        p.last_shot = now
        ang = p.input.get("aim", 0.0)
        for _ in range(spec["pellets"]):
            a = ang + random.uniform(-spec["spread"], spec["spread"])
            vx = math.cos(a) * spec["speed"]
            vy = math.sin(a) * spec["speed"]
            sx = p.x + math.cos(a) * (PLAYER_R + 4)
            sy = p.y + math.sin(a) * (PLAYER_R + 4)
            self.bullets.append(Bullet(sx, sy, vx, vy, p.id, spec["dmg"] * dmg_mult))

    def _step_bullets(self, dt: float, now: float):
        survivors: List[Bullet] = []
        for b in self.bullets:
            nx = b.x + b.vx * dt
            ny = b.y + b.vy * dt
            b.life -= dt
            if b.life <= 0:
                continue
            hit_wall = False
            for w in WALLS:
                if _segment_hits_rect(b.x, b.y, nx, ny, w["x"], w["y"], w["w"], w["h"]):
                    hit_wall = True
                    break
            if hit_wall:
                continue
            hit_player = None
            for p in self.players.values():
                if not p.alive or p.id == b.owner:
                    continue
                dx = nx - p.x
                dy = ny - p.y
                if dx * dx + dy * dy < (PLAYER_R + 3) ** 2:
                    hit_player = p
                    break
            if hit_player:
                killer = self.players.get(b.owner)
                wname = killer.weapon if killer else "?"
                self._apply_damage(hit_player, b.dmg, b.owner, now, weapon=wname)
                continue
            b.x = nx
            b.y = ny
            survivors.append(b)
        self.bullets = survivors

    def _step_grenades(self, dt: float, now: float):
        survivors: List[Grenade] = []
        for g in self.grenades:
            g.fuse -= dt
            if g.fuse <= 0:
                # explosión: daño en área con falloff
                for p in list(self.players.values()):
                    if not p.alive:
                        continue
                    d = math.hypot(p.x - g.x, p.y - g.y)
                    if d < g.radius:
                        falloff = max(0.4, 1.0 - (d / g.radius))
                        self._apply_damage(p, g.dmg * falloff, g.owner, now, weapon="grenade")
                self.explosions.append({"x": g.x, "y": g.y, "r": g.radius, "until": now + 0.45})
                continue
            # drag suave
            g.vx *= 0.94
            g.vy *= 0.94
            nx = g.x + g.vx * dt
            ny = g.y + g.vy * dt
            blocked = False
            for w in WALLS:
                if _rect_circle_collide(w["x"], w["y"], w["w"], w["h"], nx, ny, 6):
                    blocked = True
                    break
            if blocked:
                g.vx *= -0.4
                g.vy *= -0.4
            else:
                g.x = nx
                g.y = ny
            survivors.append(g)
        self.grenades = survivors
        self.explosions = [e for e in self.explosions if e["until"] > now]

    async def _broadcast_state(self, now: float):
        state = {
            "t": "state",
            "now": now,
            "players": [
                {
                    "id": p.id, "u": p.username, "x": round(p.x, 1), "y": round(p.y, 1),
                    "hp": max(0, round(p.hp)), "k": p.kills, "d": p.deaths, "alive": p.alive,
                    "w": p.weapon, "aim": round(p.input.get("aim", 0.0), 3),
                    "color": p.color,
                    "respawn": max(0.0, round(p.respawn_at - now, 1)) if not p.alive else 0,
                    "shield": round(p.shield_hp) if p.shield_hp > 0 and now < p.shield_until else 0,
                    "rage": round(max(0.0, p.rage_until - now), 2),
                    "dash": round(max(0.0, p.dash_until - now), 2),
                    "cd": {k: round(max(0.0, v - now), 2) for k, v in p.cooldowns.items()},
                }
                for p in self.players.values()
            ],
            "bullets": [
                {"x": round(b.x, 1), "y": round(b.y, 1), "vx": round(b.vx, 1), "vy": round(b.vy, 1)}
                for b in self.bullets
            ],
            "grenades": [
                {"x": round(g.x, 1), "y": round(g.y, 1), "f": round(g.fuse, 2), "r": g.radius}
                for g in self.grenades
            ],
            "explosions": [
                {"x": e["x"], "y": e["y"], "r": e["r"], "left": round(e["until"] - now, 2)}
                for e in self.explosions
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
                if not p.alive and now >= p.respawn_at:
                    self._spawn(p)
                self._move_player(p, dt, now)
                self._shoot(p, now)
            self._step_bullets(dt, now)
            self._step_grenades(dt, now)
            await self._broadcast_state(now)
            await asyncio.sleep(TICK_DT)


# ── Lobby ──────────────────────────────────────────────────────────────────

ROOMS: Dict[str, Room] = {}
_lock = asyncio.Lock()


async def _get_room() -> Room:
    async with _lock:
        # buscar room con espacio
        for r in ROOMS.values():
            if not r.is_full():
                return r
        rid = f"r{len(ROOMS)+1}"
        r = Room(rid)
        ROOMS[rid] = r
        return r


# ── Endpoint WebSocket ─────────────────────────────────────────────────────

@router.websocket("/ws")
async def arena_ws(ws: WebSocket, token: str = ""):
    await ws.accept()
    # Auth por query param ?token=...
    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = decode_access_token(token)
        username = payload.get("sub") or ""
    except Exception:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if username not in ALLOWED_USERNAMES:
        await ws.send_json({"t": "error", "msg": "Acceso denegado"})
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    # Validar usuario activo
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
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
            if mt == "input":
                inp = player.input
                inp["up"] = 1 if msg.get("up") else 0
                inp["down"] = 1 if msg.get("down") else 0
                inp["left"] = 1 if msg.get("left") else 0
                inp["right"] = 1 if msg.get("right") else 0
                inp["shoot"] = bool(msg.get("shoot"))
                if "aim" in msg:
                    try:
                        inp["aim"] = float(msg["aim"])
                    except Exception:
                        pass
            elif mt == "weapon":
                w = msg.get("w")
                if w in WEAPONS:
                    player.weapon = w
            elif mt == "ability":
                a = msg.get("a")
                if a in ABILITIES:
                    self_room = None
                    for r in ROOMS.values():
                        if pid in r.players:
                            self_room = r
                            break
                    if self_room:
                        self_room._use_ability(player, a, time.time())
            elif mt == "ping":
                await ws.send_json({"t": "pong", "ts": msg.get("ts")})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await room.remove(pid)
