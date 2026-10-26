# Fractions and units typed with a value (3/8in, 1 3/8, 1-1/2", ⅜ in) in the conversion tool, module calculators
# and the formula solver; and the "All formulas" list of a module tab.
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
        for t in ['3/8in', '3/8 in', '1 3/8', '1-3/8"', '⅜ in', '1⅝', '12.7 mm', '2.5e-3', 'pi/4', '3/8', '-1 1/2 ft', '5 µm']:
            r = await E("(t) => { const s = splitValueUnit(t); return [s.text, s.unit, evalNum(s.text)]; }", t)
            print(f'{t!r:12} ->', r)
        # the conversion tool: a unit typed after the value is the From unit
        await E("__app.addPage('convert')"); await pg.wait_for_timeout(600)
        vi = pg.locator('.page:not([hidden]) input.cv-in').first
        await vi.fill('3/8in'); await pg.wait_for_timeout(400)
        print('convert 3/8in:', await E("[...document.querySelectorAll('.page:not([hidden]) .cv-row.main')].map(r => r.textContent.replace(/Insert|Copy/g,'').trim()).join(' | ')"))
        await vi.dispatch_event('change'); await pg.wait_for_timeout(400)
        print('  after leaving the field: value', await vi.input_value(), '| from', await E("Converter.from"), '| qty', await E("Converter.qty"))
        await vi.fill('1-1/2'); await pg.wait_for_timeout(400)
        print('convert 1-1/2 in:', await E("[...document.querySelectorAll('.page:not([hidden]) .cv-row.main')].map(r => r.textContent.replace(/Insert|Copy/g,'').trim()).join(' | ')"))
        await pg.screenshot(path=OUT + '/frac_convert.png')
        # a module calculator: inch and metric, given in mm
        await E("__app.addPage('module', { id: 'machinist' })"); await pg.wait_for_timeout(800)
        async def calc(title, value):
            await pg.locator('.page:not([hidden]) .md-search').fill(title); await pg.wait_for_timeout(300)
            await pg.locator('.page:not([hidden]) .mi', has_text=title).first.click(); await pg.wait_for_timeout(1500)
            await pg.locator('#sheet-body .md-in').first.fill(value)
            await pg.locator('#sheet-body .btn.pri', has_text='Calculate').click(); await pg.wait_for_timeout(1800)
            r = await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => r.querySelector('.md-ol').textContent + '=' + (r.querySelector('.md-ov').dataset.copy || r.querySelector('.md-ov').textContent)).join(' | ')")
            await E("UI.Sheet.close()"); await pg.wait_for_timeout(200)
            return r
        print('inch & metric, 9.525 mm:', await calc('Inch and metric', '9.525 mm'))
        print('inch & metric, 1-3/8:', await calc('Inch and metric', '1-3/8'))
        print('nearest fraction, 1 3/8:', await calc('Decimal to nearest fraction', '1 3/8'))
        print('spindle speed, D = 1/2in:', await calc('Spindle speed from surface speed', '300'))
        # the formula solver: circle area with r = 3/8 in
        await E("Library.open(__app, 'form')"); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body input[type=search]').fill('circle area'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet-body .mi', has_text='Circle area').first.click(); await pg.wait_for_timeout(500)
        await E("(() => { const i = [...document.querySelectorAll('#sheet-body input[type=text]')]; const s = [...document.querySelectorAll('#sheet-body select.fs-unit')]; i[1].value = '3/8 in'; s[0].value = 'in²'; })()")
        await pg.locator('#sheet-body .btn.pri', has_text='Solve').click(); await pg.wait_for_timeout(2500)
        print('circle r = 3/8 in, A in in²:', await E("[...document.querySelectorAll('#sheet-body .card')].pop().textContent.replace(/\\s+/g,' ').slice(0,40)"))
        await E("UI.Sheet.close()"); await pg.wait_for_timeout(200)
        # All formulas
        await E("__app.addPage('module', { id: 'optics' })"); await pg.wait_for_timeout(800)
        await pg.locator('.page:not([hidden]) .md-secs .chip', has_text='All formulas').click(); await pg.wait_for_timeout(800)
        print('all formulas:', await E("document.querySelector('.page:not([hidden]) .gd-body .desc').textContent"), '| groups', await E("document.querySelectorAll('.page:not([hidden]) .md-grp').length"), '| rows', await E("document.querySelectorAll('.page:not([hidden]) .gd-body .mi').length"))
        await pg.screenshot(path=OUT + '/frac_allformulas.png')
        await pg.locator('.page:not([hidden]) .gd-body .seg button', has_text='A–Z').click(); await pg.wait_for_timeout(800)
        print('A–Z first:', await E("[...document.querySelectorAll('.page:not([hidden]) .gd-body .mi .lbl')].slice(0,3).map(x => x.textContent).join(' | ')"))
        await pg.locator('.page:not([hidden]) .gd-body .mi').first.click(); await pg.wait_for_timeout(500)
        print('opens:', await E("document.querySelector('#sheet-title').textContent"))
        await E("UI.Sheet.close()")
        print('machinist has All formulas chip:', await E("(() => { __app.select(__app.pages.findIndex(p => p.id === 'machinist')); return !!document.querySelector('.page:not([hidden]) .md-all'); })()"))
        await E("__app.saveNow()"); await pg.reload(); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        print('after reload optics view:', await E("__app.pages.find(p => p.id === 'optics').sec"), await E("__app.pages.find(p => p.id === 'optics').allSort"))
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
