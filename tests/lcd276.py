# One screen style for every calculator: set from Settings, from a calculator's own menu, and followed by the TI-36X Pro.
import asyncio
from playwright.async_api import async_playwright
import os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + '/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        await E("__app.emuApply('hp','48gx',null)"); await pg.wait_for_timeout(6000)
        fr = lambda: next(f for f in pg.frames if '/hp/' in f.url)
        print('first lcd setting:', await E("__app.settings.lcd"), '| hp class', await fr().evaluate("document.querySelector('#lcd').className"))
        # set Night from the main Settings
        await E("__app.setLcd('night')"); await pg.wait_for_timeout(600)
        print('after main setting night:', await fr().evaluate("document.querySelector('#lcd').className"))
        await pg.screenshot(path=OUT+'lcd_hp_night.png')
        # set Paper from inside the HP's own menu
        await fr().evaluate("document.querySelector('#s-lcd button[data-v=paper]').click()"); await pg.wait_for_timeout(600)
        print('after HP menu paper → main:', await E("__app.settings.lcd"))
        # switch to the TI-36X Pro: it follows
        await E("__app.emuApply('ti36','36xpro',null)"); await pg.wait_for_timeout(1500)
        print('t36 classes:', await E("__app.page.t36.root.className"))
        await pg.screenshot(path=OUT+'lcd_t36_paper.png')
        await E("__app.setLcd('night')"); await pg.wait_for_timeout(300)
        print('t36 after night:', await E("__app.page.t36.root.className"))
        # back to the HP: it opens in Night
        await E("__app.emuApply('hp','48gx',null)"); await pg.wait_for_timeout(5000)
        print('hp reopened:', await fr().evaluate("document.querySelector('#lcd').className"))
        # tab menu item
        await E("__app.pageMenu(__app.active)"); await pg.wait_for_timeout(400)
        print('menu items:', await E("[...document.querySelectorAll('#sheet-body .mi .lbl')].map(x=>x.textContent).join(' | ')"))
        print('errors', errs)
        await b.close()
asyncio.run(main())
