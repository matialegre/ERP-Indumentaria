"""
bot-socios.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bot que:
  1. Consulta SQL Server → tickets del mes por local
  2. Raspa mtgpanel     → socios registrados este mes por local
  3. Calcula cumplimiento (objetivo: 15% de tickets mensuales)
  4. Genera mensaje personalizado con OpenAI
  5. Envía por WhatsApp vía whatsapp-sender.js (corre aparte)

Requisitos:
  pip install pyodbc openai playwright requests
  (whatsapp-sender.js debe estar corriendo en otra terminal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import asyncio
import calendar
import json
import os
import re
import requests
from datetime import datetime, date
from openai import OpenAI
from playwright.async_api import async_playwright

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
ESTADO_FILE  = os.path.join(BASE_DIR, "estado.json")
LOG_FILE     = os.path.join(BASE_DIR, "mensajes_log.json")

try:
    import pyodbc
    PYODBC_OK = True
except ImportError:
    PYODBC_OK = False

# ═══════════════════════════════════════════════════════
#  CONFIGURACIÓN
# ═══════════════════════════════════════════════════════

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
WA_SERVER      = "http://localhost:3456"

# Base de datos
SQL_CONN = (
    "DRIVER={SQL Server};"
    "SERVER=192.168.0.109,9970;"
    "DATABASE=DATOS;"
    "UID=MUNDO;"
    "PWD=sanmartin126;"
)

# ───────────────────────────────────────────────────────
#  LOCALES — agregar más filas cuando haya más franquicias
#
#  sql_codigos: lista de códigos en la tabla VENTAS que
#               corresponden a este local franquiciado.
#               ⚠️ Ajustar según confirmación del cliente.
# ───────────────────────────────────────────────────────
LOCALES = [
    {
        "nombre":            "Roca",
        "sql_codigos":       ["MTGROCA"],
        "mtgpanel_email":    "montagne.roca@gmail.com",
        "mtgpanel_password": "2kv5wigh",
        "whatsapp":          "5492984575009",
    },
    {
        "nombre":            "Alto Comahue",
        "sql_codigos":       ["MTGCOM"],
        "mtgpanel_email":    "altocomahuemontagne@gmail.com",
        "mtgpanel_password": "4alto.Mtg",
        "whatsapp":          "5492993261375",
    },
    {
        "nombre":            "Neuquén Centro",
        "sql_codigos":       ["NQNALB"],
        "mtgpanel_email":    "NEUQUENCENTRO@MONTAGNE.COM.AR",
        "mtgpanel_password": "fideos879",
        "whatsapp":          "5492994546969",
    },
    {
        "nombre":            "Neuquén Shopping",
        "sql_codigos":       ["NQNSHOP"],
        "mtgpanel_email":    "neuquenmontagne@gmail.com",
        "mtgpanel_password": "puerta727",
        "whatsapp":          "5492994546920",
    },
    {
        "nombre":            "Bahía Blanca Alsina",
        "sql_codigos":       ["MONBAHIA"],
        "mtgpanel_email":    "bahiablancaalsina@montagne.com.ar",
        "mtgpanel_password": "auto3119",
        "whatsapp":          "5492915727259",
    },
    {
        "nombre":            "Bahía Blanca PS",
        "sql_codigos":       ["MTGBBPS"],
        "mtgpanel_email":    "mtgbbps@interno.ar",
        "mtgpanel_password": "reu7dxu8",
        "whatsapp":          "5492915371128",
    },
    {
        "nombre":            "Villa María",
        "sql_codigos":       ["MTGCBA"],
        "mtgpanel_email":    "montagne.villamaria@gmail.com",
        "mtgpanel_password": "Vill.Marr*",
        "whatsapp":          "5491158633575",
    },
    {
        "nombre":            "Juan B. Justo",
        "sql_codigos":       ["MTGJBJ"],
        "mtgpanel_email":    "montagne.jbjusto@gmail.com",
        "mtgpanel_password": "control395",
        "whatsapp":          "5492233437326",
    },
    {
        "nombre":            "Mar del Plata Güemes",
        "sql_codigos":       ["MTGMDQ"],
        "mtgpanel_email":    "montagne.guemes@gmail.com",
        "mtgpanel_password": "balcon994",
        "whatsapp":          "5492236368419",
    },
]

# ═══════════════════════════════════════════════════════
#  1. SQL: tickets del mes y de ayer por local
# ═══════════════════════════════════════════════════════

SQL_TICKETS_MES = """
DECLARE @Inicio DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
DECLARE @Ayer   DATE = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);

SELECT
    L.LOCAL AS CODIGO,
    COUNT(DISTINCT CONCAT(V.LOCAL,'-',V.COMPROBANTE_TIPO,'-',V.COMPROBANTE_NUMERO))
        AS TICKETS_MES
FROM VENTAS V
INNER JOIN LOCALES L
    ON L.LOCAL = (CASE WHEN V.LOCAL = 'MDQ' THEN 'MTGMDQ' ELSE V.LOCAL END)
WHERE
    CAST(V.FECHA AS DATE) >= @Inicio
    AND CAST(V.FECHA AS DATE) <= @Ayer
    AND L.TIPO = 'MONTAGNE'
    AND (V.COMPROBANTE_TIPO = 'TIQUE' OR V.COMPROBANTE_TIPO LIKE 'TKF%')
GROUP BY L.LOCAL;
"""

SQL_TICKETS_AYER = """
DECLARE @Ayer DATE = CAST(DATEADD(DAY, -1, GETDATE()) AS DATE);

SELECT
    L.LOCAL AS CODIGO,
    COUNT(DISTINCT CONCAT(V.LOCAL,'-',V.COMPROBANTE_TIPO,'-',V.COMPROBANTE_NUMERO))
        AS TICKETS_AYER
FROM VENTAS V
INNER JOIN LOCALES L
    ON L.LOCAL = (CASE WHEN V.LOCAL = 'MDQ' THEN 'MTGMDQ' ELSE V.LOCAL END)
WHERE
    CAST(V.FECHA AS DATE) = @Ayer
    AND L.TIPO = 'MONTAGNE'
    AND (V.COMPROBANTE_TIPO = 'TIQUE' OR V.COMPROBANTE_TIPO LIKE 'TKF%')
GROUP BY L.LOCAL;
"""


def get_tickets_sql() -> dict:
    """
    Retorna dict con estructura:
    { "NQNALB": {"tickets_mes": 320, "tickets_ayer": 34}, ... }
    """
    print("  Consultando SQL Server...")
    data = {}
    try:
        conn   = pyodbc.connect(SQL_CONN, timeout=15)
        cursor = conn.cursor()

        cursor.execute(SQL_TICKETS_MES)
        for row in cursor.fetchall():
            codigo, tickets_mes = row
            data.setdefault(codigo, {})["tickets_mes"] = tickets_mes

        cursor.execute(SQL_TICKETS_AYER)
        for row in cursor.fetchall():
            codigo, tickets_ayer = row
            data.setdefault(codigo, {})["tickets_ayer"] = tickets_ayer

        conn.close()
        print(f"  ✓ SQL OK — {len(data)} locales encontrados")
    except Exception as e:
        print(f"  ✗ Error SQL: {e}")
    return data


# ═══════════════════════════════════════════════════════
#  2. mtgpanel: socios registrados este mes (playwright)
# ═══════════════════════════════════════════════════════

BASE_URL = "https://www.mtgpanel.com.ar"
PAUSA    = 1.5
HEADLESS = False  # ← True = invisible | False = ver Chrome

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


async def click_periodo_btn(page):
    btn = page.locator("button").filter(
        has_text=re.compile(r"Desde|Hoy|Ayer|ltimos|Este mes|Mes pasado|Personalizado", re.IGNORECASE)
    ).first
    await btn.click()
    await asyncio.sleep(PAUSA)


async def aplicar_filtro_este_mes(page):
    await click_periodo_btn(page)
    await page.wait_for_selector("text=Ayer", timeout=8000)
    await page.click("text=Ayer")
    await asyncio.sleep(PAUSA)
    await click_periodo_btn(page)
    await page.wait_for_selector("text=Este mes", timeout=8000)
    await page.click("text=Este mes")
    await asyncio.sleep(PAUSA)
    await page.keyboard.press("Escape")
    await asyncio.sleep(PAUSA * 1.5)


async def get_socios_mtgpanel(locales: list) -> dict:
    """
    Retorna dict: { "NEUQUENCENTRO@MONTAGNE.COM.AR": 14, ... }
    """
    print("  Consultando mtgpanel...")
    resultados = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page    = await context.new_page()

        for local in locales:
            email = local["mtgpanel_email"]
            try:
                await page.goto(f"{BASE_URL}/", wait_until="load")
                await asyncio.sleep(PAUSA)
                await page.fill('input[placeholder="Email"]',    email)
                await asyncio.sleep(0.4)
                await page.fill('input[placeholder="Password"]', local["mtgpanel_password"])
                await asyncio.sleep(0.4)
                await page.click('button:has-text("Ingresar")')
                await page.wait_for_load_state("load")
                await asyncio.sleep(PAUSA)

                await page.goto(f"{BASE_URL}/estadisticas", wait_until="load")
                await asyncio.sleep(PAUSA)

                await aplicar_filtro_este_mes(page)

                datos = await page.evaluate(JS_LEER_TABLA)
                total = int(datos.get("Total", 0)) if datos else 0
                resultados[email] = {"total": total, "por_dia": datos or {}}
                print(f"  ✓ {local['nombre']}: {total} socios este mes")

                await page.goto(f"{BASE_URL}/logout", wait_until="load")
                await asyncio.sleep(PAUSA)

            except Exception as e:
                print(f"  ✗ Error mtgpanel {email}: {e}")
                resultados[email] = {"total": 0, "por_dia": {}}

        await browser.close()

    return resultados


# ═══════════════════════════════════════════════════════
#  3. Calcular cumplimiento
# ═══════════════════════════════════════════════════════

def calcular_cumplimiento(local: dict, tickets_sql: dict, socios_mtg: dict) -> dict:
    hoy           = date.today()
    dias_en_mes   = calendar.monthrange(hoy.year, hoy.month)[1]
    dia_actual    = hoy.day
    dias_restantes = max(dias_en_mes - dia_actual, 1)

    # Suma tickets de todos los SQL codes del local
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
        "nombre":          local["nombre"],
        "whatsapp":        local["whatsapp"],
        "dia_actual":      dia_actual,
        "dias_en_mes":     dias_en_mes,
        "dias_restantes":  dias_restantes,
        "tickets_mes":     tickets_mes,
        "tickets_ayer":    tickets_ayer,
        "objetivo_mes":    objetivo_mes,
        "socios_actuales": socios_actuales,
        "faltan":          faltan,
        "ritmo_ideal":     ritmo_ideal,
        "ritmo_necesario": ritmo_necesario,
        "avance_pct":      avance_pct,
        "por_dia":         {k: v for k, v in por_dia.items() if k != "Total"},
    }


# ═══════════════════════════════════════════════════════
#  4. OpenAI: generar mensaje WhatsApp
# ═══════════════════════════════════════════════════════

def generar_mensaje(datos: dict) -> str:
    # Forzar base_url a api.openai.com real (ignorar OPENAI_BASE_URL del entorno)
    ai = OpenAI(
        api_key=OPENAI_API_KEY,
        base_url="https://api.openai.com/v1",
    )

    por_dia_str = "\n".join(f"   {d}: {v} socios" for d, v in datos["por_dia"].items()) or "   (sin datos diarios)"

    estado = "bien encaminado" if datos["avance_pct"] >= 75 else \
             "en riesgo" if datos["avance_pct"] >= 40 else "muy atrasado"

    prompt = f"""
Sos el coordinador de franquicias de Montagne / Mundo Outdoor.
Tenés que mandar un mensaje de WhatsApp al responsable del local "{datos['nombre']}"
informando el estado mensual de carga de socios al programa de fidelización.

DATOS:
- Hoy es día {datos['dia_actual']} de {datos['dias_en_mes']}, quedan {datos['dias_restantes']} días.
- Tickets emitidos en el mes hasta ayer: {datos['tickets_mes']}
- Objetivo de socios a dar de alta este mes (15% de tickets): {datos['objetivo_mes']}
- Socios dados de alta hasta hoy: {datos['socios_actuales']} ({datos['avance_pct']}% del objetivo)
- Faltan dar de alta: {datos['faltan']} socios
- Ritmo ideal por día: {datos['ritmo_ideal']}
- Ritmo necesario de aquí al fin de mes: {datos['ritmo_necesario']} por día
- Tickets ayer: {datos['tickets_ayer']}
- Detalle por día:
{por_dia_str}
- Estado general: {estado}

INSTRUCCIONES:
- Tono amable y motivador, lenguaje coloquial argentino (tuteo, emojis moderados).
- Si va bien: felicitarlos y animarlos a mantener el ritmo.
- Si va atrasado: ser directo pero no agresivo, dar el número exacto que necesitan por día.
- Máximo 5-6 líneas, concreto.
- Empezar con "Hola [nombre del local]!" o similar, NO con "Buenos días".
- NO mencionar precios ni penalidades, solo los números de socios.
- Firmar como "Equipo Mundo Outdoor 🏔️"
"""

    try:
        resp = ai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"    ✗ OpenAI error: {e}")
        # Mensaje de fallback sin OpenAI
        estado = "bien" if datos['avance_pct'] >= 75 else "atrasado"
        return (
            f"Hola {datos['nombre']}! 👋\n"
            f"Socios este mes: {datos['socios_actuales']} / {datos['objetivo_mes']} ({datos['avance_pct']}%)\n"
            f"Tickets del mes: {datos['tickets_mes']} | Ayer: {datos['tickets_ayer']}\n"
            f"Faltan {datos['faltan']} socios — necesitan {datos['ritmo_necesario']}/día hasta fin de mes.\n"
            f"Estado: {estado}\n"
            f"Equipo Mundo Outdoor 🏔️"
        )


# ═══════════════════════════════════════════════════════
#  5. Enviar por WhatsApp
# ═══════════════════════════════════════════════════════

def enviar_whatsapp(numero: str, mensaje: str) -> bool:
    try:
        r = requests.post(
            f"{WA_SERVER}/send",
            json={"numero": numero, "mensaje": mensaje},
            timeout=15,
        )
        return r.json().get("ok", False)
    except Exception as e:
        print(f"  ✗ Error WhatsApp: {e}")
        print("  ⚠️  Asegurate de que whatsapp-sender.js esté corriendo.")
        return False


def wa_listo() -> bool:
    try:
        r = requests.get(f"{WA_SERVER}/status", timeout=5)
        return r.json().get("listo", False)
    except Exception:
        return False


# ═══════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════

def guardar_estado(locales_datos: list, wa_conectado: bool):
    estado = {
        "ultima_actualizacion": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "wa_conectado": wa_conectado,
        "locales": locales_datos,
    }
    with open(ESTADO_FILE, "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)


def guardar_log_mensaje(local: str, numero: str, mensaje: str, enviado: bool):
    log = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, encoding="utf-8") as f:
            log = json.load(f)
    log.append({
        "fecha":   datetime.now().strftime("%d/%m/%Y %H:%M"),
        "local":   local,
        "numero":  numero,
        "mensaje": mensaje,
        "enviado": enviado,
    })
    # Guardar últimos 200
    log = log[-200:]
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


async def main():
    print("\n" + "=" * 60)
    print(f"  BOT SOCIOS MONTAGNE — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    # 1. Chequear WhatsApp
    wa_ok = wa_listo()
    if not wa_ok:
        print("\n⚠️  WhatsApp no conectado.")
        print("   Abrí OTRA terminal y corré:  node scripts/whatsapp-sender.js")
        print("   Esperá a que aparezca el QR, escanealo, y volvé a correr este bot.\n")
        print("   (Continuando igual para ver los cálculos...)\n")
    else:
        print("  ✓ WhatsApp conectado")

    # 2. Tickets SQL
    print("\n── SQL Server ───────────────────────────────────────")
    tickets_sql = get_tickets_sql() if PYODBC_OK else {}

    # 3. Socios mtgpanel
    print("\n── mtgpanel ─────────────────────────────────────────")
    socios_mtg = await get_socios_mtgpanel(LOCALES)

    # 4. Procesar cada local
    print("\n── Procesando locales ───────────────────────────────")
    todos_datos = []
    for local in LOCALES:
        print(f"\n  ▸ {local['nombre']}")
        datos = calcular_cumplimiento(local, tickets_sql, socios_mtg)
        todos_datos.append(datos)

        print(f"    Tickets mes: {datos['tickets_mes']}  |  Objetivo: {datos['objetivo_mes']}  |  Socios: {datos['socios_actuales']}  |  Avance: {datos['avance_pct']}%")
        print(f"    Faltan: {datos['faltan']}  |  Necesitan {datos['ritmo_necesario']}/día hasta fin de mes")

        # Generar mensaje
        print(f"    Generando mensaje OpenAI...")
        mensaje = generar_mensaje(datos)
        print(f"\n    MENSAJE:\n    {'─'*50}")
        for linea in mensaje.split("\n"):
            print(f"    {linea}")
        print(f"    {'─'*50}")

        # Enviar
        enviado = False
        if wa_ok:
            enviado = enviar_whatsapp(datos["whatsapp"], mensaje)
            print(f"    WhatsApp {'✓ enviado' if enviado else '✗ falló'} a +{datos['whatsapp']}")
        else:
            print(f"    (No enviado — WhatsApp no conectado)")

        guardar_log_mensaje(datos["nombre"], datos["whatsapp"], mensaje, enviado)

    # 5. Guardar estado para el panel
    guardar_estado(todos_datos, wa_ok)
    print(f"\n  ✓ Estado guardado → http://localhost:9010")
    print("\n" + "=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
