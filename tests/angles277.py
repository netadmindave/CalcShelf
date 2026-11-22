# Trig and angle units show the other angle mode under the result (RAD: … in DEG, DEG: … in RAD); plain arithmetic does not.
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2)).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        for mode in ['deg', 'rad']:
            await pg.evaluate("(m) => { __app.settings.angle = m; return __app.applyCasSettings(); }", mode)
            for t in ['\\sin(30)', '\\arcsin(0.5)', '\\cos(\\pi)', '30\\degree', '\\tan(45\\degree)', '2+3', '\\sinh(1)', '\\arg(1+i)']:
                await pg.evaluate("(t) => { const p = __app.page; p.mf.value = t; return p.enter(); }", t); await pg.wait_for_timeout(1500)
                o = await pg.evaluate("(() => { const r = document.querySelectorAll('.page:not([hidden]) .hist .row'); const x = r[r.length-1]; return x.querySelector('.out').innerText.replace(/\\n/g,' ') + '  ||  ' + [...x.querySelectorAll('.dec')].map(d => d.innerText.replace(/\\n/g,' ')).join(' | '); })()")
                print(mode, t.ljust(22), o)
        await pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'angles.png'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
