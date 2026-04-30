import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * ARENA — easter egg. Modo selector entre:
 *   FPS  → Counter-Strike top-down con poderes
 *   LoL  → MOBA top-down 1v1 con campeones (Ornn / Diana)
 * Solo whitelisted.
 */

const ALLOWED = ["malegre", "admindepo"];

const WEAPON_ORDER = ["pistol", "shotgun", "ak"];
const WEAPON_LABELS = {
  pistol:  "PISTOLA",
  shotgun: "ESCOPETA",
  ak:      "AK-47",
};

const ABILITIES = [
  { key: "1", id: "dash",    name: "DASH",    color: "#22d3ee", desc: "Salto rápido en dirección al cursor",     icon: "⇢" },
  { key: "2", id: "shield",  name: "ESCUDO",  color: "#3b82f6", desc: "Absorbe 60 de daño durante 3s",            icon: "◉" },
  { key: "3", id: "grenade", name: "GRANADA", color: "#f97316", desc: "Lanza una granada (75 daño en área)",      icon: "✸" },
  { key: "4", id: "rage",    name: "RAGE",    color: "#ef4444", desc: "ULTI: +disparo, +daño y +velocidad 5s",    icon: "★" },
];

export default function ArenaPage() {
  const { user } = useAuth();
  const allowed = ALLOWED.includes((user?.username || "").toLowerCase());
  const [mode, setMode] = useState(null); // null | "fps" | "lol"

  if (!allowed) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto bg-red-50 border border-red-300 rounded-lg p-6 text-center">
          <div className="text-4xl mb-2">🚫</div>
          <h2 className="text-lg font-bold text-red-800">Acceso restringido</h2>
          <p className="text-sm text-red-600 mt-2">Este módulo es solo para los usuarios autorizados.</p>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="p-8 bg-black min-h-screen text-white" style={{ fontFamily: "monospace" }}>
        <h1 className="text-3xl font-bold tracking-widest text-yellow-400 text-center mb-2">⚔️ ARENA ⚔️</h1>
        <p className="text-center text-gray-400 mb-10">Elegí tu modo de juego</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <button
            onClick={() => setMode("fps")}
            className="group relative overflow-hidden rounded-xl border-4 border-yellow-600 bg-gradient-to-br from-yellow-900 via-yellow-950 to-black p-8 text-left hover:scale-[1.02] transition-transform"
          >
            <div className="text-6xl mb-3">🔫</div>
            <div className="text-2xl font-black text-yellow-300 mb-1">SHOOTER 1v1</div>
            <div className="text-sm text-yellow-100 mb-3">Counter-Strike top-down</div>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• WASD para moverse, mouse para apuntar</li>
              <li>• 3 armas (pistola, escopeta, AK)</li>
              <li>• 4 poderes: dash, escudo, granada, ULTI rage</li>
              <li>• Cobertura, balas, kill feed</li>
            </ul>
          </button>
          <button
            onClick={() => setMode("lol")}
            className="group relative overflow-hidden rounded-xl border-4 border-purple-600 bg-gradient-to-br from-purple-900 via-purple-950 to-black p-8 text-left hover:scale-[1.02] transition-transform"
          >
            <div className="text-6xl mb-3">⚡</div>
            <div className="text-2xl font-black text-purple-300 mb-1">LoL 1v1</div>
            <div className="text-sm text-purple-100 mb-3">MOBA top-down · Click to move</div>
            <ul className="text-xs text-gray-300 space-y-1">
              <li>• Click izq. para mover / atacar</li>
              <li>• Q W E R poderes con cooldowns</li>
              <li>• Campeones: <b className="text-orange-400">ORNN</b> y <b className="text-purple-400">DIANA</b></li>
              <li>• Auto-attack, escudos, dashes, ultimate</li>
            </ul>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-black px-4 pt-3 -mb-2">
        <button
          onClick={() => setMode(null)}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded"
        >← Cambiar modo</button>
      </div>
      {mode === "fps" ? <ArenaFPS user={user} /> : <ArenaLoL user={user} />}
    </>
  );
}

function ArenaFPS({ user }) {
  const allowed = true;
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const stateRef = useRef({
    world: { w: 1200, h: 700, walls: [] },
    you: null,
    players: [],
    bullets: [],
    grenades: [],
    explosions: [],
    feed: [],
  });
  const inputRef = useRef({
    up: false, down: false, left: false, right: false,
    aim: 0, shoot: false, mouseX: 0, mouseY: 0,
  });
  const weaponRef = useRef("pistol");
  const [, forceTick] = useState(0); // para refrescar HUD
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(0);

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    if (!allowed) return;
    const token = sessionStorage.getItem("token");
    if (!token) {
      setError("Sin token de sesión");
      return;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;
    if (host.endsWith(":5173")) host = host.replace(":5173", ":8001");
    const url = `${proto}//${host}/api/v1/arena/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 1008) setError("Acceso denegado por el servidor");
    };
    ws.onerror = () => setError("Error de conexión al servidor de Arena");
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.t === "init") {
          stateRef.current.world = m.world;
          stateRef.current.you = m.you;
        } else if (m.t === "state") {
          stateRef.current.players = m.players;
          stateRef.current.bullets = m.bullets;
          stateRef.current.grenades = m.grenades || [];
          stateRef.current.explosions = m.explosions || [];
          stateRef.current.feed = m.feed || [];
        } else if (m.t === "pong") {
          setLatency(Math.round(performance.now() - m.ts));
        }
      } catch {}
    };

    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: "ping", ts: performance.now() }));
      }
    }, 2000);

    // refresco HUD a 10 Hz
    const hudTimer = setInterval(() => forceTick(t => (t + 1) % 1000), 100);

    return () => {
      clearInterval(pingTimer);
      clearInterval(hudTimer);
      try { ws.close(); } catch {}
    };
  }, [allowed]);

  // ── Envío de inputs a 30 Hz ────────────────────────────────
  useEffect(() => {
    if (!allowed) return;
    const t = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const i = inputRef.current;
      ws.send(JSON.stringify({
        t: "input",
        up: i.up, down: i.down, left: i.left, right: i.right,
        shoot: i.shoot, aim: i.aim,
      }));
    }, 1000 / 30);
    return () => clearInterval(t);
  }, [allowed]);

  // ── Helpers ─────────────────────────────────────────────────
  const sendAbility = useCallback((id) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "ability", a: id }));
    }
  }, []);

  const cycleWeapon = useCallback(() => {
    const cur = weaponRef.current;
    const idx = WEAPON_ORDER.indexOf(cur);
    const next = WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length];
    weaponRef.current = next;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "weapon", w: next }));
    }
    forceTick(t => (t + 1) % 1000);
  }, []);

  const setWeapon = useCallback((w) => {
    if (!WEAPON_ORDER.includes(w)) return;
    weaponRef.current = w;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: "weapon", w }));
    }
    forceTick(t => (t + 1) % 1000);
  }, []);

  // ── Input handlers ─────────────────────────────────────────
  useEffect(() => {
    if (!allowed) return;

    const setKey = (e, val) => {
      const k = e.key.toLowerCase();
      const i = inputRef.current;
      if (k === "w" || k === "arrowup")    i.up = val;
      else if (k === "s" || k === "arrowdown")  i.down = val;
      else if (k === "a" || k === "arrowleft")  i.left = val;
      else if (k === "d" || k === "arrowright") i.right = val;
      else if (val && (k === "1" || k === "2" || k === "3" || k === "4")) {
        const ab = ABILITIES.find(a => a.key === k);
        if (ab) sendAbility(ab.id);
      } else if (val && k === "q") {
        // Q también cicla armas (alternativa a click derecho)
        cycleWeapon();
      }
    };
    const kd = (e) => setKey(e, true);
    const ku = (e) => setKey(e, false);

    const onMouse = (e) => {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const sx = c.width / rect.width;
      const sy = c.height / rect.height;
      const mx = (e.clientX - rect.left) * sx;
      const my = (e.clientY - rect.top) * sy;
      inputRef.current.mouseX = mx;
      inputRef.current.mouseY = my;
      const me = stateRef.current.players.find(p => p.id === stateRef.current.you);
      if (me) {
        inputRef.current.aim = Math.atan2(my - me.y, mx - me.x);
      }
    };
    const md = (e) => {
      if (e.button === 0) inputRef.current.shoot = true;
      else if (e.button === 2) cycleWeapon();
    };
    const mu = (e) => {
      if (e.button === 0) inputRef.current.shoot = false;
    };
    const ctx = (e) => e.preventDefault();

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    const c = canvasRef.current;
    if (c) {
      c.addEventListener("mousemove", onMouse);
      c.addEventListener("mousedown", md);
      window.addEventListener("mouseup", mu);
      c.addEventListener("contextmenu", ctx);
    }
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mouseup", mu);
      if (c) {
        c.removeEventListener("mousemove", onMouse);
        c.removeEventListener("mousedown", md);
        c.removeEventListener("contextmenu", ctx);
      }
    };
  }, [allowed, sendAbility, cycleWeapon]);

  // ── Render loop ────────────────────────────────────────────
  useEffect(() => {
    if (!allowed) return;
    let raf;
    const draw = () => {
      const c = canvasRef.current;
      if (!c) { raf = requestAnimationFrame(draw); return; }
      const ctx = c.getContext("2d");
      const s = stateRef.current;
      const W = s.world.w, H = s.world.h;

      // piso con textura (gradiente radial + grilla)
      const floorGrd = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, Math.max(W, H));
      floorGrd.addColorStop(0, "#3a3530");
      floorGrd.addColorStop(1, "#1a1714");
      ctx.fillStyle = floorGrd;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // manchas decorativas
      ctx.fillStyle = "rgba(60, 45, 30, 0.4)";
      [[200, 150, 80], [600, 380, 100], [950, 220, 70], [400, 550, 90], [800, 600, 85]].forEach(([cx, cy, cr]) => {
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
      });

      // paredes estilo ladrillo con sombra
      for (const w of s.world.walls) {
        // sombra
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(w.x + 4, w.y + 4, w.w, w.h);
        // cuerpo
        const wallGrd = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
        wallGrd.addColorStop(0, "#8b5e3b");
        wallGrd.addColorStop(1, "#5a3b20");
        ctx.fillStyle = wallGrd;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        // líneas de ladrillo
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 1;
        for (let by = w.y + 10; by < w.y + w.h; by += 12) {
          ctx.beginPath(); ctx.moveTo(w.x, by); ctx.lineTo(w.x + w.w, by); ctx.stroke();
        }
        const offsetRow = ((w.y / 12) | 0) % 2;
        for (let by = 0; by < w.h; by += 12) {
          const rowOdd = (((by / 12) | 0) + offsetRow) % 2;
          for (let bx = rowOdd * 15; bx < w.w; bx += 30) {
            ctx.beginPath();
            ctx.moveTo(w.x + bx, w.y + by);
            ctx.lineTo(w.x + bx, w.y + by + 12);
            ctx.stroke();
          }
        }
        // borde
        ctx.strokeStyle = "#1a0f05";
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      }

      // explosiones (por debajo de jugadores) con debris y ondas
      for (const e of s.explosions) {
        const t = Math.max(0, Math.min(1, 1 - e.left / 0.45));
        const r = e.r * (0.4 + 0.6 * t);
        // núcleo
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        grad.addColorStop(0,   `rgba(255, 255, 200, ${0.95 * (1 - t)})`);
        grad.addColorStop(0.3, `rgba(255, 200,  60, ${0.85 * (1 - t)})`);
        grad.addColorStop(0.7, `rgba(255, 100,  20, ${0.6 * (1 - t)})`);
        grad.addColorStop(1,   `rgba(80,  15,   0, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
        // onda exterior
        ctx.strokeStyle = `rgba(255, 220, 100, ${1 - t})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
        // segunda onda expansiva
        ctx.strokeStyle = `rgba(255, 150, 60, ${0.6 * (1 - t)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.3, 0, Math.PI * 2); ctx.stroke();
        // debris lanzados
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + (e.x * 0.01);
          const rd = r * 0.7 + t * r * 0.5;
          ctx.fillStyle = `rgba(40, 30, 20, ${1 - t})`;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * rd, e.y + Math.sin(a) * rd, 3 * (1 - t * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        // chispas brillantes
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + t;
          const rd = r * (0.5 + t * 0.8);
          ctx.fillStyle = `rgba(255, 240, 150, ${1 - t})`;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * rd, e.y + Math.sin(a) * rd, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // granadas en vuelo
      for (const g of s.grenades) {
        // halo de radio (dónde va a explotar)
        ctx.strokeStyle = "rgba(255, 80, 80, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // cuerpo de la granada con pulso según fuse
        const pulse = 1 - g.f / 0.7;
        ctx.fillStyle = pulse > 0.5 ? "#ff4d4d" : "#1a1a1a";
        ctx.beginPath();
        ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff8800";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // balas (tracer con glow)
      for (const b of s.bullets) {
        // glow
        const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
        bg.addColorStop(0, "rgba(255, 240, 150, 0.9)");
        bg.addColorStop(1, "rgba(255, 200, 0, 0)");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();
        // núcleo
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
        // tracer line
        const trLen = 0.04;
        const tg = ctx.createLinearGradient(b.x, b.y, b.x - b.vx * trLen, b.y - b.vy * trLen);
        tg.addColorStop(0, "rgba(255, 240, 120, 0.9)");
        tg.addColorStop(1, "rgba(255, 140, 0, 0)");
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * trLen, b.y - b.vy * trLen);
        ctx.stroke();
      }

      // jugadores
      for (const p of s.players) {
        if (!p.alive) {
          ctx.fillStyle = "#444";
          ctx.fillRect(p.x - 12, p.y - 6, 24, 12);
          ctx.fillStyle = "#fff";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`RESP ${p.respawn}s`, p.x, p.y + 24);
          ctx.fillText(p.u, p.x, p.y - 12);
          continue;
        }

        // aura RAGE (debajo del cuerpo)
        if (p.rage > 0) {
          const t = (Date.now() / 100) % (Math.PI * 2);
          const r = 22 + Math.sin(t) * 3;
          ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // estela DASH
        if (p.dash > 0) {
          ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
          for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            ctx.arc(p.x - Math.cos(p.aim) * k * 6, p.y - Math.sin(p.aim) * k * 6, 16 - k * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // sombra bajo el cuerpo
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 18, 14, 5, 0, 0, Math.PI * 2); ctx.fill();

        // cuerpo con gradiente
        const bodyGrd = ctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, 18);
        bodyGrd.addColorStop(0, "#fff");
        bodyGrd.addColorStop(0.3, p.color || "#0f0");
        bodyGrd.addColorStop(1, "#000");
        ctx.fillStyle = bodyGrd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.id === s.you ? "#0ff" : "#000";
        ctx.lineWidth = p.id === s.you ? 3 : 2;
        ctx.stroke();

        // ESCUDO (ring exterior)
        if (p.shield > 0) {
          const t = (Date.now() / 200) % (Math.PI * 2);
          ctx.strokeStyle = `rgba(96, 165, 250, ${0.6 + 0.4 * Math.sin(t)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 21, 0, Math.PI * 2);
          ctx.stroke();
        }

        // arma apuntando con gradiente metálico
        const gunGrd = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26);
        gunGrd.addColorStop(0, "#111");
        gunGrd.addColorStop(0.6, "#444");
        gunGrd.addColorStop(1, "#222");
        ctx.strokeStyle = gunGrd;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26);
        ctx.stroke();
        ctx.lineCap = "butt";

        // muzzle flash si está disparando (mío) o si el servidor reporta p.firing
        const isMeShooting = p.id === s.you && inputRef.current.shoot;
        if (isMeShooting || p.firing) {
          const tipX = p.x + Math.cos(p.aim) * 30;
          const tipY = p.y + Math.sin(p.aim) * 30;
          const flashGrd = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14);
          flashGrd.addColorStop(0, "rgba(255, 255, 220, 0.95)");
          flashGrd.addColorStop(0.4, "rgba(255, 200, 80, 0.7)");
          flashGrd.addColorStop(1, "rgba(255, 100, 0, 0)");
          ctx.fillStyle = flashGrd;
          ctx.beginPath(); ctx.arc(tipX, tipY, 14, 0, Math.PI * 2); ctx.fill();
          // rayos
          ctx.strokeStyle = "rgba(255, 240, 150, 0.8)";
          ctx.lineWidth = 2;
          for (let k = -2; k <= 2; k++) {
            const aa = p.aim + k * 0.15;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX + Math.cos(aa) * 16, tipY + Math.sin(aa) * 16);
            ctx.stroke();
          }
        }

        // nombre
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.u, p.x, p.y - 22);

        // barra HP + escudo
        const hpw = 36;
        ctx.fillStyle = "#600";
        ctx.fillRect(p.x - hpw / 2, p.y - 36, hpw, 4);
        ctx.fillStyle = p.hp > 50 ? "#0c0" : p.hp > 25 ? "#cc0" : "#c00";
        ctx.fillRect(p.x - hpw / 2, p.y - 36, hpw * (p.hp / 100), 4);
        if (p.shield > 0) {
          ctx.fillStyle = "#60a5fa";
          ctx.fillRect(p.x - hpw / 2, p.y - 41, hpw * Math.min(1, p.shield / 60), 3);
        }
      }

      // mira
      const i = inputRef.current;
      ctx.strokeStyle = "#f00";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i.mouseX - 8, i.mouseY); ctx.lineTo(i.mouseX + 8, i.mouseY);
      ctx.moveTo(i.mouseX, i.mouseY - 8); ctx.lineTo(i.mouseX, i.mouseY + 8);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [allowed]);

  // ── UI Restricción ──────────────────────────────────────────
  if (!allowed) { return null; }

  const me = stateRef.current.players.find(p => p.id === stateRef.current.you);
  const cooldowns = me?.cd || {};
  const ABILITY_MAX_CD = { dash: 6, shield: 14, grenade: 10, rage: 35 };

  return (
    <div className="p-4 bg-black min-h-screen text-white" style={{ fontFamily: "monospace" }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold tracking-widest text-yellow-400">⚔️ ARENA 1v1 ⚔️</h1>
        <div className="flex items-center gap-4 text-xs">
          <span className={connected ? "text-green-400" : "text-red-400"}>
            {connected ? `● ONLINE (${latency}ms)` : "● DESCONECTADO"}
          </span>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      {/* HUD superior: jugadores */}
      <div className="flex flex-wrap gap-3 mb-2 text-xs">
        {stateRef.current.players.length === 0 && (
          <span className="text-gray-400">Esperando jugadores...</span>
        )}
        {stateRef.current.players.map(p => (
          <div key={p.id} className={`px-3 py-1 rounded border ${p.id === stateRef.current.you ? "border-cyan-400" : "border-gray-600"}`}>
            <span style={{ color: p.color }}>●</span>{" "}
            <b>{p.u}</b> · HP {p.hp}{p.shield > 0 ? <span className="text-blue-400"> +{p.shield}🛡</span> : null} · K {p.k} / D {p.d}
            {p.rage > 0 && <span className="text-red-400 ml-1">★RAGE {p.rage}s</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            className="bg-gray-900 border-4 border-yellow-600 cursor-crosshair w-full"
            style={{ imageRendering: "pixelated", maxWidth: "1200px" }}
          />

          {/* ── Barra de habilidades estilo LoL ── */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ABILITIES.map(ab => {
              const cd = cooldowns[ab.id] ?? 0;
              const maxCd = ABILITY_MAX_CD[ab.id] || 1;
              const ready = cd <= 0;
              const pct = Math.min(1, cd / maxCd);
              return (
                <button
                  key={ab.id}
                  onClick={() => sendAbility(ab.id)}
                  className={`relative overflow-hidden rounded-lg border-2 px-3 py-2 text-left transition-all ${ready ? "hover:scale-[1.02]" : "opacity-60"}`}
                  style={{ borderColor: ab.color, background: ready ? `${ab.color}22` : "#0a0a0a" }}
                  title={ab.desc}
                >
                  {/* overlay cooldown */}
                  {!ready && (
                    <div
                      className="absolute inset-0 bg-black/70 pointer-events-none"
                      style={{ transform: `translateY(${(1 - pct) * 100}%)` }}
                    />
                  )}
                  <div className="relative flex items-center gap-3">
                    <div className="text-3xl font-black" style={{ color: ab.color }}>{ab.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: ab.color }}>{ab.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-black/60 text-white">{ab.key}</span>
                      </div>
                      <div className="text-[10px] text-gray-300 truncate">{ab.desc}</div>
                      {!ready && (
                        <div className="text-xs font-mono text-yellow-300 font-bold mt-0.5">{cd.toFixed(1)}s</div>
                      )}
                      {ready && (
                        <div className="text-xs font-bold text-green-400 mt-0.5">LISTO</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span><b>WASD</b> moverse</span>
            <span><b>Mouse</b> apuntar</span>
            <span><b>Click izq.</b> disparar</span>
            <span className="text-yellow-400"><b>Click der. / Q</b> cambiar arma</span>
            <span className="text-cyan-400"><b>1</b> Dash</span>
            <span className="text-blue-400"><b>2</b> Escudo</span>
            <span className="text-orange-400"><b>3</b> Granada</span>
            <span className="text-red-400"><b>4</b> ULTI Rage</span>
          </div>
        </div>

        {/* Panel lateral: armas + kill feed */}
        <div className="w-56 flex-shrink-0 space-y-3">
          <div className="border border-gray-700 p-2">
            <div className="text-xs text-gray-400 mb-1">ARMAS <span className="text-yellow-500">(click der.)</span></div>
            {WEAPON_ORDER.map((k, idx) => (
              <div
                key={k}
                className={`px-2 py-1 text-sm cursor-pointer ${weaponRef.current === k ? "bg-yellow-700 text-white" : "text-gray-300 hover:bg-gray-800"}`}
                onClick={() => setWeapon(k)}
              >
                <span className="text-yellow-500 mr-2">{idx + 1}·</span>{WEAPON_LABELS[k]}
              </div>
            ))}
          </div>

          <div className="border border-gray-700 p-2">
            <div className="text-xs text-gray-400 mb-1">KILL FEED</div>
            {stateRef.current.feed.length === 0
              ? <div className="text-xs text-gray-600">— sin bajas —</div>
              : stateRef.current.feed.slice().reverse().map((f, idx) => (
                <div key={idx} className="text-xs">
                  <span className="text-yellow-300">{f.killer}</span>
                  {" "}<span className="text-gray-500">[{f.weapon}]</span>{" "}
                  <span className="text-red-400">› {f.victim}</span>
                </div>
              ))
            }
          </div>

          {me && !me.alive && (
            <div className="border border-red-700 bg-red-950 p-3 text-center">
              <div className="text-red-400 text-lg font-bold">☠ MUERTO</div>
              <div className="text-xs text-gray-300">Respawn en {me.respawn}s</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ARENA LoL — MOBA top-down 1v1
// ═══════════════════════════════════════════════════════════════

const CHAMP_INFO = {
  ornn:  { color: "#d97706", emoji: "🐏", name: "ORNN",  title: "El Forjador",
           q: "Embestida Volcánica · lanza un cacho de piedra que golpea y frena",
           w: "Forja del Maestro · se envuelve en llamas (escudo + AA de fuego)",
           e: "Llamada del Carnero · embiste y levanta al rival por los aires",
           r: "RAGNAROK · carga del TORO GIGANTE — apretá R otra vez para estampido extra" },
  diana: { color: "#a78bfa", emoji: "🌙", name: "DIANA", title: "Desprecio de la Luna",
           q: "Filo Lunar · filo en forma de luna creciente que estalla al impactar",
           w: "Resplandor Pálido · escudo + 3 orbes de luna que orbitan y dañan",
           e: "Atracción Lunar · salta encima del enemigo con destello lunar",
           r: "Eclipse Lunar · blink con estrella de impacto y daño masivo" },
};
const ABILITY_KEYS = ["q", "w", "e", "r"];

function ArenaLoL({ user }) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(0);
  const [champ, setChamp] = useState(null); // null hasta seleccionar
  const [, force] = useState(0);
  const stateRef = useRef({
    world: { w: 1400, h: 800, walls: [] },
    you: null,
    players: [],
    projectiles: [],
    fx: [],
    feed: [],
    champions: {},
  });
  const mouseRef = useRef({ x: 0, y: 0 });

  // ── WebSocket ──
  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { setError("Sin token"); return; }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;
    if (host.endsWith(":5173")) host = host.replace(":5173", ":8001");
    const url = `${proto}//${host}/api/v1/arena-lol/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = (e) => { setConnected(false); if (e.code === 1008) setError("Acceso denegado"); };
    ws.onerror = () => setError("Error de conexión");
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.t === "init") {
          stateRef.current.world = m.world;
          stateRef.current.you = m.you;
          stateRef.current.champions = m.champions;
        } else if (m.t === "state") {
          stateRef.current.players = m.players;
          stateRef.current.projectiles = m.projectiles;
          stateRef.current.fx = m.fx || [];
          stateRef.current.feed = m.feed || [];
        } else if (m.t === "pong") {
          setLatency(Math.round(performance.now() - m.ts));
        }
      } catch {}
    };
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "ping", ts: performance.now() }));
    }, 2000);
    const tick = setInterval(() => force(t => (t + 1) % 1000), 100);
    return () => { clearInterval(ping); clearInterval(tick); try { ws.close(); } catch {} };
  }, []);

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const pickChamp = (c) => { setChamp(c); send({ t: "champ", c }); };

  // ── Input handlers ──
  useEffect(() => {
    if (!champ) return;
    const c = canvasRef.current; if (!c) return;

    const toWorld = (e) => {
      const rect = c.getBoundingClientRect();
      const sx = c.width / rect.width;
      const sy = c.height / rect.height;
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    };

    const findEnemyAt = (wx, wy) => {
      const me = stateRef.current.you;
      for (const p of stateRef.current.players) {
        if (p.id === me || !p.alive) continue;
        if (Math.hypot(p.x - wx, p.y - wy) < 30) return p.id;
      }
      return null;
    };

    const onMove = (e) => {
      const w = toWorld(e); mouseRef.current = w;
    };
    const onMouseDown = (e) => {
      const w = toWorld(e);
      if (e.button === 2) {
        // click der. → mover (estilo LoL)
        const tgt = findEnemyAt(w.x, w.y);
        if (tgt) send({ t: "attack", target: tgt });
        else send({ t: "move", x: w.x, y: w.y });
      } else if (e.button === 0) {
        // click izq. también mueve / ataca (más cómodo)
        const tgt = findEnemyAt(w.x, w.y);
        if (tgt) send({ t: "attack", target: tgt });
        else send({ t: "move", x: w.x, y: w.y });
      }
    };
    const onCtx = (e) => e.preventDefault();
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (ABILITY_KEYS.includes(k)) {
        const w = mouseRef.current;
        const tgt = findEnemyAt(w.x, w.y);
        send({ t: "ability", k, x: w.x, y: w.y, target: tgt });
      } else if (k === "s") {
        send({ t: "stop" });
      }
    };
    c.addEventListener("mousemove", onMove);
    c.addEventListener("mousedown", onMouseDown);
    c.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey);
    return () => {
      c.removeEventListener("mousemove", onMove);
      c.removeEventListener("mousedown", onMouseDown);
      c.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
    };
  }, [champ, send]);

  // ── Render loop ──
  useEffect(() => {
    if (!champ) return;
    let raf;
    const draw = () => {
      const c = canvasRef.current;
      if (!c) { raf = requestAnimationFrame(draw); return; }
      const ctx = c.getContext("2d");
      const s = stateRef.current;
      const W = s.world.w, H = s.world.h;

      // piso (degradado tipo Summoner's Rift simplificado)
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "#1a2a1a");
      grad.addColorStop(1, "#0a1a0a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(80, 120, 80, 0.15)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // paredes (arbustos)
      for (const w of s.world.walls) {
        ctx.fillStyle = "#2d4a2d";
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = "#1a2a1a"; ctx.lineWidth = 2;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      }

      // FX bajo jugadores
      for (const f of s.fx) {
        const t = Math.max(0, Math.min(1, 1 - (f.left || 0) / 0.5));
        if (f.kind === "shockwave") {
          const r = (f.r || 80) * (0.4 + 0.6 * t);
          ctx.strokeStyle = f.color || "#fff";
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === "ult_telegraph") {
          ctx.strokeStyle = f.color || "#dc2626";
          ctx.globalAlpha = 0.6 * (1 - t);
          ctx.lineWidth = 60;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x + Math.cos(f.ang) * f.len, f.y + Math.sin(f.ang) * f.len);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === "blink_out") {
          ctx.strokeStyle = "#a78bfa";
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath(); ctx.arc(f.x, f.y, 10 + i * 12 * (1 - t), 0, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (f.kind === "aa") {
          ctx.strokeStyle = f.color || "#fff";
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === "spark") {
          ctx.fillStyle = `rgba(245, 158, 11, ${1 - t})`;
          ctx.beginPath(); ctx.arc(f.x, f.y, 18 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
        } else if (f.kind === "crit") {
          ctx.fillStyle = `rgba(255, 60, 60, ${1 - t})`;
          ctx.font = "bold 22px monospace";
          ctx.textAlign = "center";
          ctx.fillText("CRIT!", f.x, f.y - 30 - t * 20);
        } else if (f.kind === "ornn_q_hit") {
          // impacto de piedra: chispas + debris
          ctx.fillStyle = `rgba(245, 158, 11, ${1 - t})`;
          ctx.beginPath(); ctx.arc(f.x, f.y, 24 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
          // debris proyectados
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const rd = 20 + t * 30;
            ctx.fillStyle = `rgba(120, 113, 108, ${1 - t})`;
            ctx.beginPath();
            ctx.arc(f.x + Math.cos(a) * rd, f.y + Math.sin(a) * rd, 3 * (1 - t), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (f.kind === "ornn_e_dust") {
          // anillo de polvo que se expande + pequeñas rocas despedidas
          const r = (f.r || 90) * (0.3 + 0.9 * t);
          ctx.globalAlpha = 0.8 * (1 - t);
          const grd = ctx.createRadialGradient(f.x, f.y, r * 0.3, f.x, f.y, r);
          grd.addColorStop(0, "rgba(212, 163, 115, 0.8)");
          grd.addColorStop(1, "rgba(120, 80, 40, 0)");
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          // rocas voladoras
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2 + (f.x + f.y) * 0.01;
            const rd = 30 + t * 80;
            ctx.fillStyle = `rgba(80, 60, 40, ${1 - t})`;
            ctx.beginPath();
            ctx.arc(f.x + Math.cos(a) * rd, f.y + Math.sin(a) * rd, 4 * (1 - t * 0.8), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (f.kind === "ornn_e_lift") {
          // víctima "levantada" — líneas ascendentes + sombra abajo
          const lift = 40 * t;
          ctx.strokeStyle = `rgba(245, 158, 11, ${1 - t})`;
          ctx.lineWidth = 2;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(f.x + k * 8, f.y + 20);
            ctx.lineTo(f.x + k * 8, f.y + 20 - lift);
            ctx.stroke();
          }
          // sombra
          ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * (1 - t)})`;
          ctx.beginPath(); ctx.ellipse(f.x, f.y + 28, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
          // texto "¡ARRIBA!"
          if (t < 0.6) {
            ctx.fillStyle = `rgba(251, 191, 36, ${1 - t})`;
            ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
            ctx.fillText("¡ARRIBA!", f.x, f.y - 40 - t * 30);
          }
        } else if (f.kind === "ornn_r_start") {
          // nubes de polvo y fuego al arrancar el Ragnarok
          ctx.globalAlpha = 1 - t;
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            const rd = 10 + t * 40;
            const grd = ctx.createRadialGradient(f.x + Math.cos(a) * rd, f.y + Math.sin(a) * rd, 2,
                                                 f.x + Math.cos(a) * rd, f.y + Math.sin(a) * rd, 12);
            grd.addColorStop(0, "#fbbf24");
            grd.addColorStop(1, "rgba(220, 38, 38, 0)");
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(f.x + Math.cos(a) * rd, f.y + Math.sin(a) * rd, 12, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (f.kind === "ornn_r_burst") {
          // segundo impacto (recast R) — MEGA explosión con anillos de fuego
          const rMax = f.r || 100;
          for (let ring = 0; ring < 3; ring++) {
            const rr = rMax * (0.3 + 0.8 * t) - ring * 15;
            if (rr <= 0) continue;
            const grd = ctx.createRadialGradient(f.x, f.y, rr * 0.5, f.x, f.y, rr);
            grd.addColorStop(0, `rgba(251, 191, 36, ${0.7 * (1 - t)})`);
            grd.addColorStop(0.6, `rgba(239, 68, 68, ${0.5 * (1 - t)})`);
            grd.addColorStop(1, "rgba(100, 20, 0, 0)");
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = `rgba(251, 191, 36, ${1 - t})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(f.x, f.y, rMax * t, 0, Math.PI * 2); ctx.stroke();
          // texto
          if (t < 0.5) {
            ctx.fillStyle = `rgba(251, 191, 36, ${1 - t * 2})`;
            ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
            ctx.fillText("¡ESTAMPIDO!", f.x, f.y - rMax - 10);
          }
        } else if (f.kind === "diana_e_impact") {
          // aterrizaje con estrellitas lunares
          const r = 50 * t;
          ctx.strokeStyle = `rgba(167, 139, 250, ${1 - t})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + t * 3;
            const rd = 20 + t * 40;
            const sx = f.x + Math.cos(a) * rd;
            const sy = f.y + Math.sin(a) * rd;
            ctx.fillStyle = `rgba(237, 233, 254, ${1 - t})`;
            ctx.beginPath();
            // estrella de 4 puntas
            for (let j = 0; j < 4; j++) {
              const aa = j * Math.PI / 2;
              ctx.lineTo(sx + Math.cos(aa) * 5, sy + Math.sin(aa) * 5);
              ctx.lineTo(sx + Math.cos(aa + Math.PI / 4) * 2, sy + Math.sin(aa + Math.PI / 4) * 2);
            }
            ctx.closePath(); ctx.fill();
          }
        }
      }

      // proyectiles
      for (const pr of s.projectiles) {
        if (pr.kind === "ornn_q") {
          // ── CACHO DE PIEDRA rotando con chispas ───────────
          const ang = Math.atan2(pr.vy, pr.vx);
          const rot = ang + (Date.now() / 80);
          // trail de humo/polvo
          for (let k = 1; k <= 6; k++) {
            const tx = pr.x - Math.cos(ang) * k * 10;
            const ty = pr.y - Math.sin(ang) * k * 10;
            ctx.fillStyle = `rgba(180, 120, 60, ${0.35 - k * 0.05})`;
            ctx.beginPath(); ctx.arc(tx, ty, 9 - k, 0, Math.PI * 2); ctx.fill();
          }
          // roca (polígono jagged)
          ctx.save();
          ctx.translate(pr.x, pr.y);
          ctx.rotate(rot);
          const R = 14;
          const pts = [
            [ 1.0,  0.0], [ 0.55,  0.75], [-0.35,  0.95], [-0.95,  0.35],
            [-0.75, -0.55], [-0.15, -0.95], [ 0.55, -0.8], [ 0.9,  -0.25],
          ];
          ctx.fillStyle = "#78716c";
          ctx.strokeStyle = "#1c1917"; ctx.lineWidth = 2;
          ctx.beginPath();
          pts.forEach(([px, py], i) => {
            const x = px * R * (0.85 + (i % 2) * 0.2);
            const y = py * R * (0.85 + ((i + 1) % 2) * 0.2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // vetas
          ctx.strokeStyle = "#44403c"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 0.2); ctx.lineTo(R * 0.4, R * 0.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.5); ctx.lineTo(R * 0.3, -R * 0.4); ctx.stroke();
          // chispas lava
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath(); ctx.arc(-R * 0.3, R * 0.1, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f97316";
          ctx.beginPath(); ctx.arc(R * 0.2, -R * 0.3, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (pr.kind === "diana_q") {
          // ── FILO LUNAR (luna creciente que gira) ───────────
          const ang = Math.atan2(pr.vy, pr.vx);
          // halo radio de impacto (pulsante)
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 140);
          ctx.setLineDash([3, 5]);
          ctx.strokeStyle = `rgba(167, 139, 250, ${0.25 + 0.15 * pulse})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // trail de partículas de luz
          for (let k = 1; k <= 5; k++) {
            ctx.fillStyle = `rgba(196, 181, 253, ${0.4 - k * 0.06})`;
            ctx.beginPath();
            ctx.arc(pr.x - Math.cos(ang) * k * 9, pr.y - Math.sin(ang) * k * 9, 8 - k, 0, Math.PI * 2);
            ctx.fill();
          }
          // luna creciente
          ctx.save();
          ctx.translate(pr.x, pr.y);
          ctx.rotate(ang);
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
          g.addColorStop(0, "#ede9fe");
          g.addColorStop(1, "#7c3aed");
          ctx.fillStyle = g;
          // círculo grande
          ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
          // recorte: pequeño círculo desplazado (globalCompositeOperation = 'destination-out')
          ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath(); ctx.arc(5, -2, 12, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          // borde brillante
          ctx.strokeStyle = "#f5f3ff"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
          // destello central
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(-2, 1, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // jugadores
      for (const p of s.players) {
        const me = p.id === s.you;
        const info = CHAMP_INFO[p.champ];
        if (!p.alive) {
          ctx.fillStyle = "#222";
          ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
          ctx.fillText(`☠ ${p.respawn}s`, p.x, p.y + 4);
          ctx.fillText(p.u, p.x, p.y - 28);
          continue;
        }
        // dest indicator (solo el mío)
        if (me && p.dest) {
          ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.dest[0], p.dest[1], 10, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.dest[0] - 6, p.dest[1]); ctx.lineTo(p.dest[0] + 6, p.dest[1]); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.dest[0], p.dest[1] - 6); ctx.lineTo(p.dest[0], p.dest[1] + 6); ctx.stroke();
        }
        // orbes Diana
        if (p.orbs > 0 && p.champ === "diana") {
          ctx.strokeStyle = "rgba(167, 139, 250, 0.3)";
          ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.arc(p.x, p.y, 95, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          for (let i = 0; i < 3; i++) {
            const ang = (Date.now() / 400 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
            const ox = p.x + Math.cos(ang) * 95;
            const oy = p.y + Math.sin(ang) * 95;
            ctx.fillStyle = "#a78bfa";
            ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#ddd6fe"; ctx.lineWidth = 2; ctx.stroke();
          }
        }
        // ── FORJA MAESTRO (Ornn W) — llamas lamiéndolo ──
        if (p.buff > 0 && p.champ === "ornn") {
          const t2 = Date.now() / 100;
          // anillo base pulsante
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.5 + 0.4 * Math.sin(t2)})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke();
          // llamas animadas (8 lenguas oscilantes)
          for (let k = 0; k < 8; k++) {
            const baseA = (k / 8) * Math.PI * 2;
            const wiggle = Math.sin(t2 + k) * 0.15;
            const a = baseA + wiggle;
            const r0 = 24;
            const r1 = 40 + Math.sin(t2 * 1.7 + k * 2) * 6;
            const grd = ctx.createLinearGradient(
              p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0,
              p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1
            );
            grd.addColorStop(0, "#fef3c7");
            grd.addColorStop(0.4, "#f97316");
            grd.addColorStop(1, "rgba(127, 29, 29, 0)");
            ctx.strokeStyle = grd;
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
            ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
            ctx.stroke();
          }
          ctx.lineCap = "butt";
        }
        // ── RAGNAROK (Ornn R dash) — silueta de TORO GIGANTE ──
        if (p.dash > 0 && p.dash_kind === "ornn_r") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.facing);
          // cuerpo del toro (elipse alargada con glow)
          ctx.globalAlpha = 0.55;
          const bullGrd = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
          bullGrd.addColorStop(0, "#dc2626");
          bullGrd.addColorStop(0.6, "#78350f");
          bullGrd.addColorStop(1, "rgba(30, 10, 0, 0)");
          ctx.fillStyle = bullGrd;
          ctx.beginPath(); ctx.ellipse(0, 0, 55, 32, 0, 0, Math.PI * 2); ctx.fill();
          // cabeza + cuernos
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "#1c1917";
          ctx.beginPath(); ctx.ellipse(38, 0, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#fef3c7"; ctx.lineWidth = 3;
          // cuerno izquierdo
          ctx.beginPath();
          ctx.moveTo(45, -10); ctx.quadraticCurveTo(60, -22, 68, -8); ctx.stroke();
          // cuerno derecho
          ctx.beginPath();
          ctx.moveTo(45, 10); ctx.quadraticCurveTo(60, 22, 68, 8); ctx.stroke();
          // ojos rojos
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath(); ctx.arc(45, -5, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(45, 5, 2.5, 0, Math.PI * 2); ctx.fill();
          // humo de narices
          const puff = (Date.now() / 120) % 1;
          ctx.fillStyle = `rgba(200, 200, 200, ${0.6 * (1 - puff)})`;
          ctx.beginPath(); ctx.arc(58 + puff * 10, -4, 4 + puff * 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(58 + puff * 10,  4, 4 + puff * 3, 0, Math.PI * 2); ctx.fill();
          // pezuñas traseras (rastro de fuego)
          ctx.globalAlpha = 0.7;
          for (let k = 1; k <= 6; k++) {
            ctx.fillStyle = `rgba(251, 146, 60, ${0.6 - k * 0.08})`;
            ctx.beginPath(); ctx.arc(-25 - k * 12, 0, 8 + k, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        // ── ATRACCIÓN LUNAR (Diana E dash) — halo lunar ──
        if (p.dash > 0 && p.dash_kind === "diana_e") {
          ctx.strokeStyle = "rgba(196, 181, 253, 0.5)";
          ctx.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const r = 30 + k * 10;
            ctx.globalAlpha = 0.5 - k * 0.15;
            ctx.beginPath();
            ctx.arc(p.x - Math.cos(p.facing) * k * 6, p.y - Math.sin(p.facing) * k * 6, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        // dash trail estándar (cualquier dash)
        if (p.dash > 0) {
          ctx.fillStyle = `${(info?.color) || "#fff"}66`;
          for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            ctx.arc(p.x - Math.cos(p.facing) * k * 8, p.y - Math.sin(p.facing) * k * 8, 18 - k * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // cuerpo
        ctx.fillStyle = (info?.color) || p.color || "#0f0";
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = me ? "#22d3ee" : "#000";
        ctx.lineWidth = me ? 4 : 2;
        ctx.stroke();
        // emoji del champion
        ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(info?.emoji || "?", p.x, p.y + 1);
        ctx.textBaseline = "alphabetic";
        // facing
        ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.facing) * 30, p.y + Math.sin(p.facing) * 30);
        ctx.stroke();
        // shield
        if (p.shield > 0) {
          const t = (Date.now() / 200) % (Math.PI * 2);
          ctx.strokeStyle = `rgba(96, 165, 250, ${0.6 + 0.4 * Math.sin(t)})`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke();
        }
        // nombre
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
        ctx.fillText(p.u, p.x, p.y - 32);
        // barra HP grande
        const hpw = 70;
        ctx.fillStyle = "#000"; ctx.fillRect(p.x - hpw / 2 - 1, p.y - 47, hpw + 2, 9);
        ctx.fillStyle = "#5b1a1a"; ctx.fillRect(p.x - hpw / 2, p.y - 46, hpw, 7);
        const hpRatio = p.hp / Math.max(1, p.max_hp);
        ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#eab308" : "#ef4444";
        ctx.fillRect(p.x - hpw / 2, p.y - 46, hpw * hpRatio, 7);
        ctx.fillStyle = "#fff"; ctx.font = "bold 9px monospace";
        ctx.fillText(`${p.hp}/${p.max_hp}`, p.x, p.y - 39);
        // shield bar
        if (p.shield > 0) {
          ctx.fillStyle = "#60a5fa";
          ctx.fillRect(p.x - hpw / 2, p.y - 52, hpw * Math.min(1, p.shield / 250), 3);
        }
        // slow indicator
        if (p.slow > 0) {
          ctx.fillStyle = "#67e8f9";
          ctx.font = "10px monospace";
          ctx.fillText("⊘ SLOW", p.x, p.y + 40);
        }
      }

      // mira (sólo punto bajo el cursor)
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [champ]);

  // ── Pantalla de selección de campeón ──
  if (!champ) {
    return (
      <div className="p-8 bg-black min-h-screen text-white" style={{ fontFamily: "monospace" }}>
        <h1 className="text-3xl font-bold tracking-widest text-purple-400 text-center mb-2">⚡ ARENA LoL ⚡</h1>
        <p className="text-center text-gray-400 mb-6">Elegí tu campeón</p>
        <div className="text-center text-xs mb-2">
          <span className={connected ? "text-green-400" : "text-red-400"}>
            {connected ? `● ONLINE (${latency}ms)` : "● Conectando..."}
          </span>
          {error && <span className="ml-2 text-red-400">{error}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-6">
          {Object.entries(CHAMP_INFO).map(([id, info]) => (
            <button
              key={id}
              onClick={() => pickChamp(id)}
              disabled={!connected}
              className="rounded-xl border-4 p-6 text-left hover:scale-[1.02] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: info.color, background: `linear-gradient(135deg, ${info.color}22, #000)` }}
            >
              <div className="text-7xl mb-2">{info.emoji}</div>
              <div className="text-2xl font-black" style={{ color: info.color }}>{info.name}</div>
              <div className="text-xs text-gray-400 italic mb-3">{info.title}</div>
              <ul className="text-xs space-y-1">
                <li><b className="text-yellow-300">Q</b> · {info.q}</li>
                <li><b className="text-yellow-300">W</b> · {info.w}</li>
                <li><b className="text-yellow-300">E</b> · {info.e}</li>
                <li><b className="text-yellow-300">R</b> · {info.r}</li>
              </ul>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── HUD principal ──
  const me = stateRef.current.players.find(p => p.id === stateRef.current.you);
  const cd = me?.cd || {};
  const champData = stateRef.current.champions[champ] || {};
  const abilDefs = champData.abilities || {};
  const info = CHAMP_INFO[champ];

  return (
    <div className="p-3 bg-black min-h-screen text-white" style={{ fontFamily: "monospace" }}>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold tracking-widest" style={{ color: info.color }}>
          {info.emoji} ARENA LoL · {info.name}
        </h1>
        <div className="flex items-center gap-3 text-xs">
          <span className={connected ? "text-green-400" : "text-red-400"}>
            {connected ? `● ${latency}ms` : "● OFF"}
          </span>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      {/* Scoreboard arriba */}
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        {stateRef.current.players.length === 0 && <span className="text-gray-400">Esperando jugadores...</span>}
        {stateRef.current.players.map(p => {
          const ci = CHAMP_INFO[p.champ] || {};
          return (
            <div key={p.id} className={`px-3 py-1 rounded border ${p.id === stateRef.current.you ? "border-cyan-400" : "border-gray-600"}`}>
              <span style={{ color: ci.color }}>{ci.emoji || "?"}</span>{" "}
              <b>{p.u}</b> <span className="text-gray-500">[{ci.name || "?"}]</span> · HP {p.hp}/{p.max_hp}
              {p.shield > 0 && <span className="text-blue-400"> +{p.shield}🛡</span>} · {p.k}/{p.d}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={1400}
            height={800}
            className="border-4 cursor-crosshair w-full"
            style={{ borderColor: info.color, maxWidth: "1400px" }}
          />

          {/* Barra Q W E R */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {ABILITY_KEYS.map(k => {
              const def = abilDefs[k] || { name: "?", cd: 1 };
              const cur = cd[k] || 0;
              const ready = cur <= 0;
              const pct = Math.min(1, cur / Math.max(1, def.cd));
              const desc = info[k];
              return (
                <button
                  key={k}
                  onClick={() => {
                    const w = mouseRef.current;
                    send({ t: "ability", k, x: w.x, y: w.y, target: null });
                  }}
                  className={`relative overflow-hidden rounded-lg border-2 px-3 py-2 text-left transition-all ${ready ? "hover:scale-[1.02]" : "opacity-60"}`}
                  style={{ borderColor: info.color, background: ready ? `${info.color}22` : "#0a0a0a" }}
                  title={desc}
                >
                  {!ready && (
                    <div className="absolute inset-0 bg-black/70 pointer-events-none"
                         style={{ transform: `translateY(${(1 - pct) * 100}%)` }} />
                  )}
                  <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 rounded flex items-center justify-center text-xl font-black border"
                         style={{ borderColor: info.color, color: info.color }}>
                      {k.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold" style={{ color: info.color }}>{def.name}</div>
                      <div className="text-[10px] text-gray-300 truncate">{desc}</div>
                      {ready
                        ? <div className="text-xs font-bold text-green-400">LISTO</div>
                        : <div className="text-xs font-mono text-yellow-300 font-bold">{cur.toFixed(1)}s / {def.cd}s</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            <span><b className="text-cyan-400">Click</b> mover</span>
            <span><b className="text-red-400">Click sobre enemigo</b> atacar</span>
            <span><b className="text-yellow-300">Q W E R</b> habilidades (apuntan al cursor)</span>
            <span><b>S</b> detener</span>
          </div>
        </div>

        {/* Lateral: kill feed + estado del muerto */}
        <div className="w-60 flex-shrink-0 space-y-3">
          <div className="border border-gray-700 p-2">
            <div className="text-xs text-gray-400 mb-1">CAMPEÓN</div>
            <div className="text-3xl">{info.emoji}</div>
            <div className="text-sm font-bold" style={{ color: info.color }}>{info.name}</div>
            <div className="text-xs text-gray-500 italic">{info.title}</div>
            <div className="mt-2 text-xs space-y-0.5">
              <div>HP: <b>{champData.hp}</b></div>
              <div>AD: <b>{champData.ad}</b> · MS: <b>{champData.ms}</b></div>
              <div>Rango AA: <b>{champData.aa_range}</b> · CD AA: <b>{champData.aa_cd}s</b></div>
            </div>
          </div>

          <div className="border border-gray-700 p-2">
            <div className="text-xs text-gray-400 mb-1">KILL FEED</div>
            {stateRef.current.feed.length === 0
              ? <div className="text-xs text-gray-600">— sin bajas —</div>
              : stateRef.current.feed.slice().reverse().map((f, i) => (
                <div key={i} className="text-xs">
                  <span style={{ color: (CHAMP_INFO[f.killer_champ] || {}).color || "#fde68a" }}>{f.killer}</span>
                  {" "}<span className="text-gray-500">[{f.src}]</span>{" "}
                  <span className="text-red-400">› {f.victim}</span>
                </div>
              ))
            }
          </div>

          {me && !me.alive && (
            <div className="border border-red-700 bg-red-950 p-3 text-center">
              <div className="text-red-400 text-lg font-bold">☠ MUERTO</div>
              <div className="text-xs text-gray-300">Respawn en {me.respawn}s</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
