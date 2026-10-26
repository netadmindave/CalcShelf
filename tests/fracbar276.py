# The key bar for fractions above the number keyboard: it appears on number fields, types / and a space, and in the
# conversion tool also units, so 3/8 in can be typed with the phone's number keyboard.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e)))
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(600)
        vi = pg.locator('.page:not([hidden]) input.cv-in').first
        await vi.fill(''); await vi.focus(); await pg.wait_for_timeout(300)
        print('bar shown:', await E("!document.querySelector('.frac-bar').hidden"), '| keys:', await E("[...document.querySelectorAll('.frac-bar .fb-key')].map(k => k.textContent).join(' ')"))
        await pg.keyboard.type('1')
        await pg.locator('.frac-bar .fb-key', has_text='␣').tap(); await pg.keyboard.type('3')
        await pg.locator('.frac-bar .fb-key', has_text='/').tap(); await pg.keyboard.type('8')
        await pg.locator('.frac-bar .fb-key', has_text='in').first.tap(); await pg.wait_for_timeout(400)
        print('typed:', repr(await vi.input_value()), '| From list:', await E("document.querySelector('.page:not([hidden]) .cv-stack select').value"), '| focus kept:', await E("document.activeElement === document.querySelector('.page:not([hidden]) input.cv-in')"))
        print('result:', await E("[...document.querySelectorAll('.page:not([hidden]) .cv-row.main')].map(r => r.textContent.replace(/Insert|Copy/g,'').trim()).join(' | ')"))
        await pg.screenshot(path=OUT + '/fracbar.png')
        await E("document.activeElement.blur()"); await pg.wait_for_timeout(400)
        print('bar hidden after leaving:', await E("document.querySelector('.frac-bar').hidden"), '| value now', repr(await vi.input_value()), '| from', await E("Converter.from"))
        # the triangle solver: a fraction in a side
        await E("Library.open(__app, 'trig')"); await pg.wait_for_timeout(800)
        a = pg.locator('#sheet-body .tri-in input').first
        await a.focus(); await pg.wait_for_timeout(200)
        print('trig bar keys:', await E("[...document.querySelectorAll('.frac-bar .fb-key')].map(k => k.textContent).join(' ')"))
        print('errors', errs[-4:])
        await b.close()
asyncio.run(main())
