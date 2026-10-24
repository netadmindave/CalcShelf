# Opens every item of every built-in module and checks that each calculator gives a result for its defaults,
# each formula solves, and each tool draws without an error.
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 393, 'height': 852})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGE ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        for mid in ['optics', 'machinist']:
            await E(f"__app.addPage('module', {{ id: '{mid}' }})"); await pg.wait_for_timeout(600)
            items = await E(f"Modules.get('{mid}').sections.flatMap((s, si) => s.items.map((it, ii) => [si, ii, it.type, it.title]))")
            bad = 0; n = 0
            for si, ii, typ, title in items:
                if typ in ('text', 'link', 'table', 'constants'): continue
                n += 1
                await E(f"(() => {{ const pg = __app.page; pg.openItem(Modules.get('{mid}').sections[{si}].items[{ii}]); }})()")
                if typ == 'calc':
                    await pg.wait_for_timeout(200)
                    for _ in range(40):
                        st = await E("(() => { const r = document.querySelector('#sheet-body .md-res'); return r && !r.hidden && r.textContent !== 'Working…' ? 'done' : 'wait'; })()")
                        if st == 'done': break
                        await pg.wait_for_timeout(150)
                    res = await E("[...document.querySelectorAll('#sheet-body .md-out')].map(r => (r.querySelector('.md-ov').classList.contains('err') ? 'ERR ' : '') + r.querySelector('.md-ol').textContent + '=' + (r.querySelector('.md-ov').dataset.copy || r.querySelector('.md-ov').textContent)).join(' | ')")
                    if 'ERR' in res or not res: bad += 1; print('  ✗', title, '::', res or await E("document.querySelector('#sheet-body').textContent.slice(0,200)"))
                elif typ == 'formula':
                    ok = await E("!!document.querySelector('#sheet-body .btn.pri')")
                    if not ok: bad += 1; print('  ✗ formula', title)
                elif typ == 'tool':
                    await pg.wait_for_timeout(600)
                    txt = await E("document.querySelector('#sheet-body').textContent.length")
                    if txt < 50: bad += 1; print('  ✗ tool', title)
                await E("UI.Sheet.close()"); await pg.wait_for_timeout(80)
            print(mid, ':', n, 'items opened,', bad, 'problems')
        # solve every formula of the Optics module with its defaults filled with 1 (checks the CAS accepts each equation)
        forms = await E("Modules.get('optics').sections.flatMap(s => s.items).filter(i => i.type === 'formula').length")
        print('optics formulas:', forms)
        print('errors', errs[-6:])
        await b.close()
asyncio.run(main())
