# The Periodic Table module: opens in landscape on its table, colours by category and by a property, shows an
# element's details, works out molar masses, and its formulas join the Variable Solver.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 852, 'height': 393}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        await E("window.TiBridge = { setOrientation: (o) => { window.__or = o; } }")
        await E("__app.addPage('module', { id: 'periodic' })"); await pg.wait_for_timeout(1500)
        print('landscape asked:', await E("window.__or") == 6, '| elements drawn:', await pg.locator('.pt-el').count())
        await pg.screenshot(path=OUT + '/periodic.png')
        await E("(() => { const s = document.querySelector('.pt-sel'); s.value = 'Density (g/cm³)'; s.onchange(); })()"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + '/periodic_density.png')
        await pg.locator('.pt-el[aria-label="Silicon"]').click(); await pg.wait_for_timeout(500)
        print('Si sheet:', (await pg.locator('#sheet-body').inner_text()).replace('\n', ' | ')[:300])
        await pg.screenshot(path=OUT + '/periodic_si.png')
        await E("UI.Sheet.close()")
        print('molar masses:', await E("(() => { const d = Periodic.data(Modules.get('periodic')); return ['H2O', 'Ca(OH)2', 'CuSO4·5H2O', 'GaAs', 'K4[Fe(CN)6]'].map((f) => f + ' = ' + Periodic.molarMass(f, d.bySym).M.toFixed(3)).join(', '); })()"))
        await pg.locator('.page:not([hidden]) .md-secs .chip', has_text='Isotopes').click(); await pg.wait_for_timeout(400)
        print('other sections upright:', await E("window.__or") == -1)
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
