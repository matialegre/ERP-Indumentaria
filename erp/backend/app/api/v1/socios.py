"""
socios.py — Router Socios Montagne integrado al ERP
====================================================
Integra bot-socios.py + panel.py + whatsapp-sender.js
sin servidores separados: todo desde el ERP.

Endpoints:
  GET  /socios/estado           → lee estado.json
  GET  /socios/log              → lee mensajes_log.json
  POST /socios/actualizar       → dispara scraping + SQL (background)
  POST /socios/enviar/{nombre}  → genera mensaje OpenAI y envía por WA
  POST /socios/enviar-todos     → envía a todos los locales
  GET  /socios/wa/status        → estado WhatsApp
  POST /socios/wa/start         → arranca whatsapp-sender.js
  POST /socios/wa/stop          → detiene whatsapp-sender.js
  GET  /socios/wa/qr            → proxy del QR de WhatsApp
"""

import asyncio
import calendar
import json
import os
import subprocess
import sys
import time
from datetime import date, datetime
from typing import Optional

import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse

try:
    import pyodbc
    PYODBC_OK = True
except ImportError:
    PYODBC_OK = False

try:
    from openai import OpenAI
    OPENAI_OK = True
except ImportError:
    OPENAI_OK = False

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False

# ══════════════════════════════════════════════════
#  PATHS
# ══════════════════════════════════════════════════
SCRIPTS_DIR   = r"D:\ERP MUNDO OUTDOOR\A AGREGAR\OPENCLAW\scripts"
ESTADO_FILE   = os.path.join(SCRIPTS_DIR, "estado.json")
LOG_FILE      = os.path.join(SCRIPTS_DIR, "mensajes_log.json")
WA_SCRIPT     = os.path.join(SCRIPTS_DIR, "whatsapp-sender.js")
WA_SERVER     = "http://localhost:3456"

# ══════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

SQL_CONN = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
)

LOCALES = [
    {"nombre": "Roca",               "sql_codigos": ["MTGROCA"],   "mtgpanel_email": "montagne.roca@gmail.com",            "mtgpanel_password": "2kv5wigh",    "whatsapp": "5492984575009"},
    {"nombre": "Alto Comahue",       "sql_codigos": ["MTGCOM"],    "mtgpanel_email": "altocomahuemontagne@gmail.com",       "mtgpanel_password": "4alto.Mtg",   "whatsapp": "5492993261375"},
    {"nombre": "Neuquén Centro",     "sql_codigos": ["NQNALB"],    "mtgpanel_email": "NEUQUENCENTRO@MONTAGNE.COM.AR",       "mtgpanel_password": "fideos879",    "whatsapp": "5492994546969"},
    {"nombre": "Neuquén Shopping",   "sql_codigos": ["NQNSHOP"],   "mtgpanel_email": "neuquenmontagne@gmail.com",           "mtgpanel_password": "puerta727",    "whatsapp": "5492994546920"},
    {"nombre": "Bahía Blanca Alsina","sql_codigos": ["MONBAHIA"],  "mtgpanel_email": "bahiablancaalsina@montagne.com.ar",   "mtgpanel_password": "auto3119",     "whatsapp": "5492915727259"},
    {"nombre": "Bahía Blanca PS",    "sql_codigos": ["MTGBBPS"],   "mtgpanel_email": "mtgbbps@interno.ar",                 "mtgpanel_password": "reu7dxu8",     "whatsapp": "5492915371128"},
    {"nombre": "Villa María",        "sql_codigos": ["MTGCBA"],    "mtgpanel_email": "montagne.villamaria@gmail.com",       "mtgpanel_password": "Vill.Marr*",   "whatsapp": "5491158633575"},
    {"nombre": "Juan B. Justo",      "sql_codigos": ["MTGJBJ"],    "mtgpanel_email": "montagne.jbjusto@gmail.com",          "mtgpanel_password": "control395",   "whatsapp": "5492233437326"},
    {"nombre": "Mar del Plata Güemes","sql_codigos": ["MTGMDQ"],   "mtgpanel_email": "montagne.guemes@gmail.com",           "mtgpanel_password": "balcon994",    "whatsapp": "5492236368419"},
]

PAUSA    = 1.5
HEADLESS = True

JS_LEER_TABLA = """
() => {
    const tabla = document.getElementById("tableEstadisticas");
    if (!tabla) return null;
    const filas = tabla.querySelectorAll("tr");
    if (filas.length < 2) return null;
    const headers = [...filas[0].querySelectorAll("th")].map(h => h.innerText.trim());
    const cells   = [...filas[1].querySelectorAll("td")].map(td => td.innerText.trim());
    const result  = {};
    headers.forEach((h, i) => { result[h] = cells[i] !== undefined ? cells[i] : "0"; });
    return result;
}
"""

# ══════════════════════════════════════════════════
#  PROCESO WHATSAPP (singleton global)
# ══════════════════════════════════════════════════
_wa_process: Optional[subprocess.Popen] = None


def wa_process_running() -> bool:
    global _wa_process
    if _wa_process is None:
        return False
    return _wa_process.poll() is None


def wa_listo() -> bool:
    try:
        r = requests.get(f"{WA_SERVER}/status", timeout=3)
        return r.json().get("listo", False)
    except Exception:
        return False


def start_wa_server():
    global _wa_process
    if wa_process_running():
        return {"ok": True, "msg": "Ya estaba corriendo"}
    if not os.path.exists(WA_SCRIPT):
        return {"ok": False, "msg": f"No se encontró {WA_SCRIPT}"}
    try:
        _wa_process = subprocess.Popen(
            ["node", "whatsapp-sender.js"],
            cwd=SCRIPTS_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
        time.sleep(2)
        return {"ok": True, "msg": f"Iniciado (PID {_wa_process.pid})"}
    except Exception as e:
        return {"ok": False, "msg": str(e)}


def stop_wa_server():
    global _wa_process
    if not wa_process_running():
        return {"ok": True, "msg": "No estaba corriendo"}
    try:
        _wa_process.terminate()
        _wa_process.wait(timeout=5)
        _wa_process = None
        return {"ok": True, "msg": "Detenido"}
    except Exception as e:
        return {"ok": False, "msg": str(e)}


# ══════════════════════════════════════════════════
#  LEER / GUARDAR JSON
# ══════════════════════════════════════════════════
ESTADO_VACIO = {"ultima_actualizacion": None, "wa_conectado": False, "locales": []}


def leer_estado() -> dict:
    if os.path.exists(ESTADO_FILE):
        with open(ESTADO_FILE, encoding="utf-8") as f:
            return json.load(f)
    return ESTADO_VACIO


def leer_log() -> list:
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []


def guardar_estado(locales_datos: list, wa_conectado: bool):
    estado = {
        "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "wa_conectado":         wa_conectado,
        "locales":              locales_datos,
    }
    with open(ESTADO_FILE, "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)


def guardar_log_mensaje(local: str, numero: str, mensaje: str, enviado: bool):
    log = leer_log()
    log.append({
        "fecha":   datetime.now().strftime("%d/%m/%Y %H:%M"),
        "local":   local,
        "numero":  numero,
        "mensaje": mensaje,
        "enviado": enviado,
    })
    log = log[-200:]
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


# ══════════════════════════════════════════════════
#  SQL SERVER: tickets
# ══════════════════════════════════════════════════
SQL_TICKETS_MES = """
DECLARE @Inicio DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
DECLARE @Ayer   DATE = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);
SELECT L.LOCAL AS CODIGO,
       COUNT(DISTINCT CONCAT(V.LOCAL,'-',V.COMPROBANTE_TIPO,'-',V.COMPROBANTE_NUMERO)) AS TICKETS_MES
FROM VENTAS V
INNER JOIN LOCALES L ON L.LOCAL = (CASE WHEN V.LOCAL = 'MDQ' THEN 'MTGMDQ' ELSE V.LOCAL END)
WHERE CAST(V.FECHA AS DATE) >= @Inicio AND CAST(V.FECHA AS DATE) <= @Ayer
  AND L.TIPO = 'MONTAGNE'
  AND (V.COMPROBANTE_TIPO = 'TIQUE' OR V.COMPROBANTE_TIPO LIKE 'TKF%')
GROUP BY L.LOCAL;
"""

SQL_TICKETS_AYER = """
DECLARE @Ayer DATE = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);
SELECT L.LOCAL AS CODIGO,
       COUNT(DISTINCT CONCAT(V.LOCAL,'-',V.COMPROBANTE_TIPO,'-',V.COMPROBANTE_NUMERO)) AS TICKETS_AYER
FROM VENTAS V
INNER JOIN LOCALES L ON L.LOCAL = (CASE WHEN V.LOCAL = 'MDQ' THEN 'MTGMDQ' ELSE V.LOCAL END)
WHERE CAST(V.FECHA AS DATE) = @Ayer
  AND L.TIPO = 'MONTAGNE'
  AND (V.COMPROBANTE_TIPO = 'TIQUE' OR V.COMPROBANTE_TIPO LIKE 'TKF%')
GROUP BY L.LOCAL;
"""


def get_tickets_sql() -> dict:
    data = {}
    if not PYODBC_OK:
        return data
    try:
        conn   = pyodbc.connect(SQL_CONN, timeout=15)
        cursor = conn.cursor()
        cursor.execute(SQL_TICKETS_MES)
        for row in cursor.fetchall():
            data.setdefault(row[0], {})["tickets_mes"] = row[1]
        cursor.execute(SQL_TICKETS_AYER)
        for row in cursor.fetchall():
            data.setdefault(row[0], {})["tickets_ayer"] = row[1]
        conn.close()
    except Exception as e:
        print(f"[socios] SQL error: {e}")
    return data


# ══════════════════════════════════════════════════
#  PLAYWRIGHT: socios de mtgpanel
# ══════════════════════════════════════════════════
async def get_socios_mtgpanel(locales: list) -> dict:
    resultados = {}
    if not PLAYWRIGHT_OK:
        for local in locales:
            resultados[local["mtgpanel_email"]] = {"total": 0, "por_dia": {}}
        return resultados

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=HEADLESS)
            context = await browser.new_context(viewport={"width": 1280, "height": 800})
            page    = await context.new_page()

            for local in locales:
                email = local["mtgpanel_email"]
                try:
                    await page.goto("https://www.mtgpanel.com.ar/", wait_until="load")
                    await asyncio.sleep(PAUSA)
                    await page.fill('input[placeholder="Email"]',    email)
                    await asyncio.sleep(0.4)
                    await page.fill('input[placeholder="Password"]', local["mtgpanel_password"])
                    await asyncio.sleep(0.4)
                    await page.click('button:has-text("Ingresar")')
                    await page.wait_for_load_state("load")
                    await asyncio.sleep(PAUSA)

                    await page.goto("https://www.mtgpanel.com.ar/estadisticas", wait_until="load")
                    await asyncio.sleep(PAUSA)

                    # Aplicar filtro "Este mes"
                    btn = page.locator("button").filter(has_text=__import__("re").compile(
                        r"Desde|Hoy|Ayer|ltimos|Este mes|Mes pasado|Personalizado", __import__("re").IGNORECASE
                    )).first
                    await btn.click()
                    await asyncio.sleep(PAUSA)
                    await page.wait_for_selector("text=Ayer", timeout=8000)
                    await page.click("text=Ayer")
                    await asyncio.sleep(PAUSA)
                    await btn.click()
                    await asyncio.sleep(PAUSA)
                    await page.wait_for_selector("text=Este mes", timeout=8000)
                    await page.click("text=Este mes")
                    await asyncio.sleep(PAUSA)
                    await page.keyboard.press("Escape")
                    await asyncio.sleep(PAUSA * 1.5)

                    datos = await page.evaluate(JS_LEER_TABLA)
                    total = int(datos.get("Total", 0)) if datos else 0
                    resultados[email] = {"total": total, "por_dia": {k: v for k, v in (datos or {}).items() if k != "Total"}}

                    await page.goto("https://www.mtgpanel.com.ar/logout", wait_until="load")
                    await asyncio.sleep(PAUSA)
                except Exception as e:
                    print(f"[socios] mtgpanel error {email}: {e}")
                    resultados[email] = {"total": 0, "por_dia": {}}

            await browser.close()
    except Exception as e:
        print(f"[socios] playwright error: {e}")

    return resultados


# ══════════════════════════════════════════════════
#  CALCULAR CUMPLIMIENTO
# ══════════════════════════════════════════════════
def calcular_cumplimiento(local: dict, tickets_sql: dict, socios_mtg: dict) -> dict:
    hoy            = date.today()
    dias_en_mes    = calendar.monthrange(hoy.year, hoy.month)[1]
    dia_actual     = hoy.day
    dias_restantes = max(dias_en_mes - dia_actual, 1)

    tickets_mes  = sum(tickets_sql.get(c, {}).get("tickets_mes",  0) for c in local["sql_codigos"])
    tickets_ayer = sum(tickets_sql.get(c, {}).get("tickets_ayer", 0) for c in local["sql_codigos"])

    objetivo_mes    = round(tickets_mes * 0.15)
    socios_data     = socios_mtg.get(local["mtgpanel_email"], {})
    socios_actuales = socios_data.get("total", 0)
    por_dia         = socios_data.get("por_dia", {})

    faltan          = max(objetivo_mes - socios_actuales, 0)
    ritmo_ideal     = round(objetivo_mes / dias_en_mes, 1)
    ritmo_necesario = round(faltan / dias_restantes, 1) if faltan > 0 else 0
    avance_pct      = round(socios_actuales / objetivo_mes * 100, 1) if objetivo_mes > 0 else 0

    return {
        "nombre":           local["nombre"],
        "whatsapp":         local["whatsapp"],
        "dia_actual":       dia_actual,
        "dias_en_mes":      dias_en_mes,
        "dias_restantes":   dias_restantes,
        "tickets_mes":      tickets_mes,
        "tickets_ayer":     tickets_ayer,
        "objetivo_mes":     objetivo_mes,
        "socios_actuales":  socios_actuales,
        "faltan":           faltan,
        "ritmo_ideal":      ritmo_ideal,
        "ritmo_necesario":  ritmo_necesario,
        "avance_pct":       avance_pct,
        "por_dia":          por_dia,
    }


# ══════════════════════════════════════════════════
#  OPENAI: generar mensaje
# ══════════════════════════════════════════════════
def generar_mensaje(datos: dict) -> str:
    """Mensaje claro y simple para encargados de local — sin promedios, con emoji de color"""
    pct = datos["avance_pct"]

    if pct >= 100:
        emoji_estado = "🟢"
        estado_texto = "¡Están cumpliendo el objetivo!"
    elif pct >= 80:
        emoji_estado = "🟡"
        estado_texto = "Casi llegan, sigan así!"
    else:
        emoji_estado = "🔴"
        estado_texto = "Están atrasados, necesitan ponerse las pilas."

    if not OPENAI_OK:
        return (
            f"Hola {datos['nombre']}! {emoji_estado}\n\n"
            f"*Socios del mes:* {datos['socios_actuales']} de {datos['objetivo_mes']}\n"
            f"*Faltan dar de alta:* {datos['faltan']} socios\n\n"
            f"{estado_texto}\n\n"
            f"_Equipo Mundo Outdoor 🏔️_"
        )

    por_dia_str = "\n".join(f"  {d}: {v}" for d, v in datos["por_dia"].items()) or "  (ninguna)"

    prompt = f"""
Sos el coordinador de franquicias de Montagne / Mundo Outdoor.
Tenés que mandar un mensaje de WhatsApp al encargado del local "{datos['nombre']}".

REGLAS IMPORTANTES:
- Escribí como si le hablaras a alguien que no entiende mucho de números
- Usá frases CORTAS y DIRECTAS
- NO digas "ritmo promedio", "ritmo ideal" ni "pro-rata"
- Solo decí cuántos socios les faltan y qué tienen que hacer HOY
- Máximo 5 líneas
- Empezá con "Hola {datos['nombre']}! {emoji_estado}"
- Firmar con "Equipo Mundo Outdoor 🏔️"

DATOS:
- Socios dados de alta este mes: {datos['socios_actuales']}
- Objetivo del mes (15% de los tickets): {datos['objetivo_mes']}
- Socios que faltan: {datos['faltan']}
- Altas por día:
{por_dia_str}
- Estado: {estado_texto}
- Quedan {datos['dias_restantes']} días en el mes
"""
    try:
        ai   = OpenAI(api_key=OPENAI_API_KEY, base_url="https://api.openai.com/v1")
        resp = ai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[socios] OpenAI error: {e}")
        return (
            f"Hola {datos['nombre']}! {emoji_estado}\n\n"
            f"*Socios del mes:* {datos['socios_actuales']} de {datos['objetivo_mes']}\n"
            f"*Faltan dar de alta:* {datos['faltan']} socios\n\n"
            f"{estado_texto}\n\n"
            f"_Equipo Mundo Outdoor 🏔️_"
        )


# ══════════════════════════════════════════════════
#  WHATSAPP: enviar
# ══════════════════════════════════════════════════
def enviar_whatsapp(numero: str, mensaje: str) -> bool:
    try:
        r = requests.post(f"{WA_SERVER}/send", json={"numero": numero, "mensaje": mensaje}, timeout=15)
        return r.json().get("ok", False)
    except Exception:
        return False


# ══════════════════════════════════════════════════
#  TAREAS EN BACKGROUND
# ══════════════════════════════════════════════════
async def _task_actualizar():
    """Corre scraping + SQL y actualiza estado.json"""
    print("[socios] Iniciando actualización...")
    tickets_sql = get_tickets_sql()
    socios_mtg  = await get_socios_mtgpanel(LOCALES)

    todos_datos = []
    for local in LOCALES:
        datos = calcular_cumplimiento(local, tickets_sql, socios_mtg)
        todos_datos.append(datos)

    guardar_estado(todos_datos, wa_listo())
    print("[socios] Actualización completada")


async def _task_enviar(nombre_local: str, solo_uno: bool = True):
    """Genera mensaje y envía por WhatsApp"""
    estado = leer_estado()
    locales_data = {l["nombre"]: l for l in estado.get("locales", [])}

    targets = []
    if solo_uno:
        if nombre_local not in locales_data:
            return
        targets = [locales_data[nombre_local]]
    else:
        targets = list(locales_data.values())

    for datos in targets:
        local_cfg = next((l for l in LOCALES if l["nombre"] == datos["nombre"]), None)
        if not local_cfg:
            continue
        mensaje = generar_mensaje(datos)
        enviado = enviar_whatsapp(datos["whatsapp"], mensaje) if wa_listo() else False
        guardar_log_mensaje(datos["nombre"], datos["whatsapp"], mensaje, enviado)
        print(f"[socios] {datos['nombre']}: {'enviado' if enviado else 'no enviado'}")


# ══════════════════════════════════════════════════
#  ROUTER
# ══════════════════════════════════════════════════
router = APIRouter(prefix="/socios", tags=["socios"])


@router.get("/estado")
def get_estado():
    return leer_estado()


@router.get("/log")
def get_log():
    return leer_log()


@router.get("/locales-config")
def get_locales_config():
    return [{"nombre": l["nombre"], "whatsapp": l["whatsapp"]} for l in LOCALES]


@router.post("/actualizar")
async def actualizar(background_tasks: BackgroundTasks):
    """Dispara scraping en background — retorna inmediatamente"""
    background_tasks.add_task(_task_actualizar)
    return {"ok": True, "msg": "Actualización iniciada en background"}


@router.post("/enviar/{nombre_local}")
async def enviar_local(nombre_local: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(_task_enviar, nombre_local, True)
    return {"ok": True, "msg": f"Enviando mensaje a {nombre_local}"}


@router.post("/enviar-todos")
async def enviar_todos(background_tasks: BackgroundTasks):
    background_tasks.add_task(_task_enviar, "", False)
    return {"ok": True, "msg": "Enviando mensajes a todos los locales"}


# ── WhatsApp ──────────────────────────────────────

@router.get("/wa/status")
def wa_status():
    running = wa_process_running()
    listo   = wa_listo()
    return {
        "proceso_corriendo": running,
        "wa_listo":          listo,
        "pid":               _wa_process.pid if running and _wa_process else None,
    }


@router.post("/wa/start")
def wa_start():
    result = start_wa_server()
    return result


@router.post("/wa/stop")
def wa_stop():
    result = stop_wa_server()
    return result


@router.get("/wa/qr", response_class=HTMLResponse)
def wa_qr():
    """Proxy del QR de whatsapp-sender.js"""
    try:
        r = requests.get(f"{WA_SERVER}/qr", timeout=5)
        return HTMLResponse(content=r.text, status_code=r.status_code)
    except Exception:
        return HTMLResponse(
            content='<h2 style="font-family:sans-serif;text-align:center;margin-top:80px">⚠️ whatsapp-sender.js no está corriendo.<br><small>Hacé click en "Iniciar WhatsApp" en el ERP.</small></h2>',
            status_code=503,
        )
