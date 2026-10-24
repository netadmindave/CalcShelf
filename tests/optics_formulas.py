# Solves every formula of the Optics module for its first variable, with the other variables at their defaults
# (or a test value), and then solves the same formula back for its second variable, which must give the value used.
import asyncio, json, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
# test values by unit, for variables without a default
VAL = {'m': '2e-3', 'Hz': '1e9', 'W': '1e-3', 'W/m²': '1e6', 's': '1e-9', '1/m': '50', 'rad': '0.3', 'K': '300', 'J': '2e-19', 'eV': '1.4',
       'V': '0.7', 'A': '1e-3', '1/m³': '1e22', 'm²': '1e-10', 'F/m²': '3e-3', 'kg': '9e-31', 'm/s': '1e5', 'F': '1e-12', 'S': '1e-3', 'C/m²': '1e-4'}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': 393, 'height': 852})).new_page()
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(3000)
        forms = await pg.evaluate("Modules.get('optics').sections.flatMap(s => s.items.filter(i => i.type === 'formula').map(i => ({ t: i.title, eq: i.eq, v: i.vars, sec: s.title })))")
        print(len(forms), 'formulas')
        bad = 0
        for f in forms:
            # distinct values, so that no two variables are equal by accident
            vals = {v[0]: (v[3] or repr(float(VAL.get(v[2], '0.5')) * (1 + 0.37 * k))) for k, v in enumerate(f['v'])}
            r = await pg.evaluate("""async ([f, vals]) => {
              Library.app = __app;
              const fake = { n: f.t, eq: f.eq, v: f.v };
              const map = {}; f.v.forEach(([n], i) => { map[n] = 'zv' + i; });
              const eq = f.eq.replace(/\\b[A-Za-z]\\w*\\b/g, (w) => map[w] || w);
              const solveFor = async (u, given) => {
                const known = [], valOf = {};
                for (const [n] of f.v) if (n !== u) { valOf[map[n]] = '(' + given[n] + ')'; known.push('(' + given[n] + ')'); }
                const sub = eq.replace(/\\bzv\\d+\\b/g, (z) => valOf[z] || z);
                return Library.findSolutions(sub, map[u], known);
              };
              const a = f.v[0][0], b = f.v[1] ? f.v[1][0] : null;
              const s1 = await solveFor(a, vals);
              if (!s1.length) return { ok: false, why: 'no solution for ' + a };
              if (!b) return { ok: true, a: s1[0] };
              const g = Object.assign({}, vals, { [a]: s1[0] });
              const s2 = await solveFor(b, g);
              const want = Number(vals[b]);
              const hit = s2.some((x) => Math.abs(Number(x) - want) <= 1e-6 * Math.max(1e-30, Math.abs(want)));
              return { ok: hit, a: s1[0], back: s2.join(','), want: vals[b], why: hit ? '' : 'round trip for ' + b };
            }""", [f, vals])
            if not r['ok']:
                bad += 1; print('✗', f['sec'], '|', f['t'], '|', r)
        print('problems:', bad)
        await b.close()
asyncio.run(main())
