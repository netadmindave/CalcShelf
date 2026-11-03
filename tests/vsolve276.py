# The Variable Solver: optics values flow through the optics formulas, a semiconductor chain (N_d → n₀ → p₀ → E_F),
# a machinist chain from another module, the How panel with the rearranged and filled-in formula, Reset, Ignore.
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
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        await E("__app.addPage('vsolve')"); await pg.wait_for_timeout(2500)
        print('master list:', await E("(() => { const V = VarSolver.VS, by = {}; V.F.forEach((f) => { by[f.src] = (by[f.src] || 0) + 1; }); return V.F.length + ' formulas ' + JSON.stringify(by) + ', ' + Object.keys(V.Q).length + ' variables'; })()"))
        async def setv(id, raw, unit=''):
            await E("([id, raw, unit]) => __app.page.setUser(VarSolver.VS.Q[id], raw, unit)", [id, raw, unit]); await pg.wait_for_timeout(2200)
        calc = "(() => { const p = __app.page, Q = VarSolver.VS.Q; return [...p.known.entries()].filter(([id, k]) => k.src === 'calc' && !Q[id].local).map(([id, k]) => { const s = p.shown(Q[id], k.v); return id + '=' + Units.num(s.x, 5) + ' ' + s.u; }).join(' | '); })()"
        await setv('lam0', '1550', 'nm'); await setv('n', '1.444'); await setv('Ls', '2', 'm')
        print('optics:', await E(calc))
        order = await E("[...document.querySelectorAll('.page:not([hidden]) .vs-sec')].map((s) => s.firstChild.textContent).join(' > ')")
        print('sections:', order)
        await E("__app.page.open.add('k'); __app.page.render()"); await pg.wait_for_timeout(600)
        row = pg.locator('.vs-row', has=pg.locator('.vs-n', has_text='Wavenumber')).first
        await row.scroll_into_view_if_needed(); await row.screenshot(path=OUT + '/vsolve_how.png')
        print('how steps:', await row.locator('.vs-step').all_inner_texts())
        await E("__app.page.reset()"); await pg.wait_for_timeout(1500)
        print('after reset, entered:', await E("Object.keys(__app.page.S.user).length"))
        await setv('T', '300'); await setv('Nd', '1e16', '1/cm^3'); await setv('ni', '1.5e10', '1/cm^3')
        print('semiconductor:', await E(calc))
        await E("__app.page.reset()"); await pg.wait_for_timeout(1000)
        await setv('mVc', '400'); await setv('mD', '0.5'); await setv('mz', '4'); await setv('mfz', '0.002'); await setv('mae', '0.25'); await setv('map', '0.5')
        print('machinist:', await E(calc))
        await pg.screenshot(path=OUT + '/vsolve.png')
        # ignore a variable: formulas that use it are left out
        await E("(() => { const p = __app.page; p.S.ignored.push('mz'); return p.solve(); })()"); await pg.wait_for_timeout(1500)
        print('feed rate known after ignoring z:', await E("__app.page.known.has('mF')"))
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
