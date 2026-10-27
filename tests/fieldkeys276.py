# Value fields (conversion tool, formula solver, module calculators, triangle solver) use the CAS keypad, with a row
# of fraction and unit keys; the phone keyboard stays closed. Checks typing 1 3/8 in, done, tapping away, and that
# the CAS tab still types into its own entry line afterwards.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2.5, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        key = lambda t: pg.locator('#kpages .kpage[data-id="num"] .key', has=pg.locator('.kf', has_text=t)).first.tap()
        fk = lambda t: pg.locator('.fkrow .fk', has_text=t).first.tap()
        state = "({ on: document.body.classList.contains('fieldkeys'), kp: getComputedStyle(document.querySelector('#kp')).display, im: document.activeElement && document.activeElement.getAttribute('inputmode'), row: document.querySelector('.fkrow') ? [...document.querySelectorAll('.fkrow .fk')].map(k => k.textContent).join(' ') : '' })"
        # the conversion tool
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(600)
        vi = pg.locator('.page:not([hidden]) input.cv-in').first
        await vi.tap(); await pg.wait_for_timeout(300)
        print('focus value:', await E(state))
        await E("(() => { const i = document.activeElement; i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()")
        await key('1'); await fk('␣'); await key('3'); await key('÷'); await key('8'); await fk('in'); await pg.wait_for_timeout(300)
        print('typed:', repr(await vi.input_value()), '| From list:', await E("document.querySelector('.page:not([hidden]) .cv-stack select').value"))
        print('result:', await E("[...document.querySelectorAll('.page:not([hidden]) .cv-row.main')].map(r => r.textContent.replace(/Insert|Copy/g,'').trim()).join(' | ')"))
        await pg.screenshot(path=OUT + '/fieldkeys_convert.png')
        await key('⌫') if False else None
        await pg.locator('#strip [data-a="del"]').tap(); await pg.wait_for_timeout(200)
        print('after ⌫:', repr(await vi.input_value()))
        await fk('done'); await pg.wait_for_timeout(400)
        print('after done:', await E(state), '| value', repr(await vi.input_value()))
        # tapping elsewhere closes it
        await vi.tap(); await pg.wait_for_timeout(200)
        await pg.locator('.page:not([hidden]) .chip', has_text='Mass').first.tap(); await pg.wait_for_timeout(300)
        print('tap away:', await E(state))
        # the formula solver: circle area with r = 3/8 in, done runs Solve
        await E("Library.open(__app, 'form')"); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body input[type=search]').fill('circle area'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi', has_text='Circle area').first.click(); await pg.wait_for_timeout(500)
        await E("(() => { const s = [...document.querySelectorAll('#sheet-body select.fs-unit')]; s[0].value = 'in²'; })()")
        r = pg.locator('#sheet-body input[type=text]').nth(1)
        await r.tap(); await pg.wait_for_timeout(300)
        print('solver field:', await E(state))
        await key('3'); await key('÷'); await key('8'); await fk('in'); await pg.wait_for_timeout(200)
        print('typed:', repr(await r.input_value()))
        await pg.screenshot(path=OUT + '/fieldkeys_solver.png')
        await pg.locator('#kp .kbar [data-a="enter"]').tap(); await pg.wait_for_timeout(2500)
        print('enter → solved:', await E("[...document.querySelectorAll('#sheet-body .card')].pop().textContent.replace(/\\s+/g,' ').slice(0,40)"), '|', await E(state))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # a module calculator
        await E("__app.addPage('module', { id: 'machinist' })"); await pg.wait_for_timeout(800)
        await pg.locator('.page:not([hidden]) .md-search').fill('Inch and metric'); await pg.wait_for_timeout(300)
        await pg.locator('.page:not([hidden]) .mi', has_text='Inch and metric').first.click(); await pg.wait_for_timeout(1500)
        mi = pg.locator('#sheet-body .md-in').first
        await mi.tap(); await pg.wait_for_timeout(200)
        await E("(() => { const i = document.activeElement; i.value = ''; })()")
        await key('5'); await key('÷'); await key('8'); await pg.wait_for_timeout(100)
        await fk('done'); await pg.wait_for_timeout(1800)
        print('module 5/8:', await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => r.querySelector('.md-ov').dataset.copy).join(' | ')"), '|', await E(state))
        await pg.screenshot(path=OUT + '/fieldkeys_module.png')
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(300)
        # the CAS tab still types into its entry line
        await E("__app.select(0)"); await pg.wait_for_timeout(400)
        await E("__app.page.mf.value = ''; __app.page.mf.focus()")
        await key('7'); await key('×'); await key('6'); await pg.wait_for_timeout(200)
        print('CAS entry:', await E("__app.page.mf.value"), '| fieldkeys on:', await E("document.body.classList.contains('fieldkeys')"))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
