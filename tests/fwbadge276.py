# The calculator chooser marks models whose OS or ROM is installed, and a model's page says what is installed.
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2000)
        E = pg.evaluate
        # stand-in files (not firmware): the chooser only reads the index
        await E("Promise.all([FwStore.put('ti68k', '89', { name: 'TI89Titanium_OS.89u', bytes: new Uint8Array(2700000) }), FwStore.put('z80', 'z', { name: 'ti84se.rom', bytes: new Uint8Array(2097152) })])")
        await E("__app.emuChooser(false, null)"); await pg.wait_for_timeout(600)
        rows = await E("[...document.querySelectorAll('#sheet-body [data-emu]')].map((x) => x.dataset.emu + (x.querySelector('.fw-ok') ? ' INSTALLED ' + x.querySelector('.sub').textContent : ''))")
        print('installed rows:', [r for r in rows if 'INSTALLED' in r])
        print('others unmarked:', sum('INSTALLED' not in r for r in rows), 'of', len(rows))
        await pg.screenshot(path=OUT + '/fwbadge_list.png')
        await pg.locator('#sheet-body [data-emu="ti68k:89"]').click(); await pg.wait_for_timeout(600)
        print('TI-89 page:', (await pg.locator('#sheet-body .fw-state').inner_text()).replace('\n', ' '), '|', (await pg.locator('#sheet-body [data-act^="Open"] .sub').inner_text()))
        await pg.screenshot(path=OUT + '/fwbadge_89.png')
        await E("UI.Sheet.close()"); await E("__app.emuChooser(false, null)"); await pg.wait_for_timeout(500)
        await pg.locator('#sheet-body [data-emu="ti68k:v200"]').click(); await pg.wait_for_timeout(600)
        print('V200 page:', (await pg.locator('#sheet-body .fw-state').inner_text()).replace('\n', ' '))
        await E("Promise.all([FwStore.remove('ti68k:89'), FwStore.remove('z80:z')])")
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
