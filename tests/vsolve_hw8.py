# A p–n junction solar cell worked through the Variable Solver (GaAs, OSE 5414 homework 8 problem 1): the
# diffusion lengths, J_s, the short-circuit current density, V_oc and the thermalization heat all follow from the
# given values, and n_i stays an input (the majority-carrier approximations don't apply once both dopings are known).
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
        vals = [('T', '300', 'K'), ('Eg', '1.42', 'eV'), ('ni', '1.8e6', '1/cm^3'), ('Na', '1e17', '1/cm^3'), ('Nd', '2e16', '1/cm^3'),
                ('Dn', '190', 'cm^2/s'), ('taun', '100', 'ns'), ('Dp', '10', 'cm^2/s'), ('taup', '10', 'ns'), ('I0', '31', 'mW/cm^2'), ('lam0', '800', 'nm')]
        await E("(vals) => { const p = __app.page, Q = VarSolver.VS.Q; for (const [id, raw, u] of vals) { const r = p.parseInput(Q[id], raw, u); p.S.user[id] = { v: r.v, raw }; p.S.units[id] = u; } return p.solve(); }", vals)
        await pg.wait_for_timeout(4000)
        want = ['Ln', 'Lp', 'Js', 'Eph', 'phiph', 'JL', 'Voc', 'Qth', 'Vbi', 'Wdep', 'n0', 'p0']
        got = await E("(want) => { const p = __app.page, Q = VarSolver.VS.Q; return want.map((id) => { const k = p.known.get(id); if (!k) return id + ': —'; const s = p.shown(Q[id], k.v); return id + ' = ' + Units.num(s.x, 4) + ' ' + s.u + (k.src === 'calc' ? '  [' + k.f.title + ']' : ' (' + k.src + ')'); }); }", want)
        print('\n'.join(got))
        await E("(() => { const p = __app.page; p.open.add('Js'); p.S.q = 'saturation'; p.render(); })()"); await pg.wait_for_timeout(800)
        row = pg.locator('.vs-row', has=pg.locator('.vs-n', has_text='Saturation current density')).first
        await row.scroll_into_view_if_needed(); await row.screenshot(path=OUT + '/vsolve_js.png')
        print('errors', errs[:5])
        await b.close()
asyncio.run(main())
