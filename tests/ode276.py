# The Differential Equations tab: every example is solved, exact and numeric results are checked against known
# solutions, and the page is photographed.
import asyncio, os, sys, math
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(3000)
        E = pg.evaluate
        await E("__app.addPage('ode')"); await pg.wait_for_timeout(500)
        n = await E("Ode.EXAMPLES.length")
        for i in range(n):
            name = await E(f"Ode.EXAMPLES[{i}][0]")
            await E(f"""(() => {{ const p = __app.page, [nm, sub, eqs, ics, o] = Ode.EXAMPLES[{i}];
                Object.assign(p.s, {{ eqs: eqs.slice(), ics: ics.slice(), ind: o.ind || 'auto', from: o.from || '', to: o.to || '', step: '', at: '', view: o.view || 't', px: '', py: '' }});
                p.render(); return p.solve(); }})()""")
            await pg.wait_for_timeout(300)
            r = await E("""(() => { const o = __app.page.out; const cards = o.querySelectorAll('.card');
                const ex = cards[0] ? cards[0].innerText.replace(/\\s+/g, ' ').slice(0, 170) : '';
                const nu = cards[1] ? cards[1].innerText.replace(/\\s+/g, ' ') : '';
                const vals = [...o.querySelectorAll('.ode-vals .md-ov')].map(x => x.textContent).join(' ; ');
                return { sum: (o.querySelector('.ode-sum') || {}).textContent, ex, nu: nu.slice(0, 120), vals: vals.slice(0,160), err: [...o.querySelectorAll('.ode-err')].map(x=>x.textContent).join(' | ') }; })()""")
            print(f"--- {name}: {r['sum']}\n  EXACT {r['ex']}\n  NUM {r['nu']}\n  AT {r['vals']}\n  ERR {r['err']}")
            if name in ('Damped oscillator', 'Predator–prey', 'Logistic growth', 'Forced, resonant', 'Coupled springs'):
                await E("__app.page.body.scrollTop = 0"); await pg.screenshot(path=OUT + '/ode_' + str(i) + '.png', full_page=False)
                await E("__app.page.body.scrollTop = 520"); await pg.wait_for_timeout(200); await pg.screenshot(path=OUT + '/ode_' + str(i) + 'b.png')
        # accuracy: y'' + 0.4y' + 4y = 0, y(0)=1, y'(0)=0 → compare with the analytic solution at t = 7
        acc = await E("""(async () => { const app = __app; const P = Ode.readProblem(app, ["y''+0.4y'+4y=0"], ['y\\\\left(0\\\\right)=1', "y'\\\\left(0\\\\right)=0"], 'auto');
            const sys = await Ode.firstOrder(app, P); const S = Ode.solveRange(sys.F, 0, Float64Array.of(1, 0), 0, 10);
            const w = Math.sqrt(4 - 0.04), y = (t) => Math.exp(-0.2*t) * (Math.cos(w*t) + 0.2/w*Math.sin(w*t));
            let e = 0; for (let t = 0; t <= 10; t += 0.137) e = Math.max(e, Math.abs(S.at(t)[0] - y(t))); return e; })()""")
        print('max error, damped oscillator:', acc)
        # typed with Leibniz notation
        lz = await E("""(async () => { const P = Ode.readProblem(__app, ['\\\\frac{dy}{dx}=xy'], ['y\\\\left(0\\\\right)=1'], 'auto'); const r = await Ode.exact(__app, P); return P.ind + ' ' + JSON.stringify(r.sols); })()""")
        print('dy/dx = xy:', lz)
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
