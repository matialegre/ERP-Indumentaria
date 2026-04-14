import asyncio, re
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        await page.goto('https://www.mtgpanel.com.ar/', wait_until='load')
        await asyncio.sleep(1.5)
        await page.fill('input[placeholder="Email"]', 'NEUQUENCENTRO@MONTAGNE.COM.AR')
        await page.fill('input[placeholder="Password"]', 'fideos879')
        await page.click('button:has-text("Ingresar")')
        await page.wait_for_load_state('load')
        await asyncio.sleep(1.5)
        await page.goto('https://www.mtgpanel.com.ar/estadisticas', wait_until='load')
        await asyncio.sleep(1.5)

        # Workaround: Ayer -> Este mes
        btn = page.locator('button').filter(has_text=re.compile(r'Desde|Ayer|Hoy|Este mes', re.I)).first
        await btn.click()
        await asyncio.sleep(1.5)
        await page.click('text=Ayer')
        await asyncio.sleep(1.5)
        btn = page.locator('button').filter(has_text=re.compile(r'Desde|Ayer|Hoy|Este mes', re.I)).first
        await btn.click()
        await asyncio.sleep(1.5)
        await page.click('text=Este mes')
        await asyncio.sleep(3)
        await page.keyboard.press('Escape')
        await asyncio.sleep(2)

        resultado = await page.evaluate("""() => {
            const t = document.querySelectorAll('table')[0];
            return {
                outerHTML: t.outerHTML.slice(0, 2000),
                allTds: [...t.querySelectorAll('td')].map(td => td.innerText.trim()),
                allTrs: [...t.querySelectorAll('tr')].length
            };
        }""")
        print("TDs:", resultado['allTds'])
        print("TRs count:", resultado['allTrs'])
        print("HTML:", resultado['outerHTML'])

        await asyncio.sleep(3)
        await browser.close()

asyncio.run(debug())
