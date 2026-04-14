"""
Bot para obtener estadísticas de socios de mtgpanel.com.ar
Requiere: pip install playwright && playwright install chromium
"""

import asyncio
import re
from datetime import datetime
from playwright.async_api import async_playwright

# ──────────────── CONFIG ────────────────
CUENTAS = [
    {"email": "NEUQUENCENTRO@MONTAGNE.COM.AR",    "password": "fideos879"},
    {"email": "bahiablancaalsina@montagne.com.ar", "password": "auto3119"},
]

BASE_URL = "https://www.mtgpanel.com.ar"
PAUSA    = 1.5    # segundos entre acciones
HEADLESS = False  # False = ventana visible | True = invisible en background
# ─────────────────────────────────────────

# JS que lee la tabla #tableEstadisticas (2 <tr> sin thead/tbody)
JS_LEER_TABLA = """
() => {
    const tabla = document.getElementById("tableEstadisticas");
    if (!tabla) return null;
    const filas = tabla.querySelectorAll("tr");
    if (filas.length < 2) return null;
    const headers = [...filas[0].querySelectorAll("th")].map(h => h.innerText.trim());
    const cells   = [...filas[1].querySelectorAll("td")].map(td => td.innerText.trim());
    const result  = {};
    headers.forEach((h, i) => { result[h] = cells[i] !== undefined ? cells[i] : "?"; });
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
    """Workaround: elige Ayer primero y luego Este mes para forzar recarga."""
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


async def obtener_stats(page, cuenta):
    print(f"\n-> Procesando cuenta: {cuenta['email']}")

    await page.goto(f"{BASE_URL}/", wait_until="load")
    await asyncio.sleep(PAUSA)
    await page.fill('input[placeholder="Email"]',    cuenta["email"])
    await asyncio.sleep(0.4)
    await page.fill('input[placeholder="Password"]', cuenta["password"])
    await asyncio.sleep(0.4)
    await page.click('button:has-text("Ingresar")')
    await page.wait_for_load_state("load")
    await asyncio.sleep(PAUSA)
    print("  OK Login")

    await page.goto(f"{BASE_URL}/estadisticas", wait_until="load")
    await asyncio.sleep(PAUSA)
    print("  OK Estadisticas cargadas")

    await aplicar_filtro_este_mes(page)
    print("  OK Filtro Este mes aplicado")

    datos = await page.evaluate(JS_LEER_TABLA)
    if not datos:
        print("  ERROR: tabla no encontrada")
        datos = {"Total": "ERROR"}
    else:
        print(f"  Total: {datos.get('Total','?')}")
        for k, v in datos.items():
            if k != "Total":
                print(f"       {k}: {v}")

    await asyncio.sleep(PAUSA)
    await page.goto(f"{BASE_URL}/logout", wait_until="load")
    await asyncio.sleep(PAUSA)
    return {"cuenta": cuenta["email"], "datos": datos}


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page    = await context.new_page()

        resultados = []
        for cuenta in CUENTAS:
            try:
                resultado = await obtener_stats(page, cuenta)
                resultados.append(resultado)
            except Exception as e:
                print(f"  ERROR con {cuenta['email']}: {e}")
                resultados.append({"cuenta": cuenta["email"], "datos": {"Total": "ERROR"}})

        await asyncio.sleep(2)
        await browser.close()

    ahora  = datetime.now().strftime("%Y-%m-%d %H:%M")
    lineas = []
    lineas.append("=" * 55)
    lineas.append(f"  ESTADISTICAS - ESTE MES   ({ahora})")
    lineas.append("=" * 55)

    for r in resultados:
        lineas.append(f"\n  Cuenta: {r['cuenta']}")
        lineas.append(f"  {'-'*45}")
        for fecha, valor in r["datos"].items():
            if fecha == "Total":
                continue
            lineas.append(f"    {fecha:<14} {valor} socios")
        lineas.append(f"    {'TOTAL':<14} {r['datos'].get('Total','?')} socios")

    lineas.append("\n" + "=" * 55)
    reporte = "\n".join(lineas)
    print("\n" + reporte)

    nombre_archivo = f"scripts/stats_{datetime.now().strftime('%Y-%m-%d_%H-%M')}.txt"
    with open(nombre_archivo, "w", encoding="utf-8") as f:
        f.write(reporte)
    print(f"\nGuardado en: {nombre_archivo}")


if __name__ == "__main__":
    asyncio.run(main())
