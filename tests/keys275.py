# 2.7.5 CAS keypad: wider esc/tab, √ π x² x⁻¹ ⌫ row, TI-style EE.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':393,'height':852}, device_scale_factor=2.75, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page && __app.cas"); await pg.wait_for_timeout(2500)
        E=lambda js: pg.evaluate(js)
        key = lambda l: pg.locator('.kpage[data-id="num"] .key', has=pg.locator('.kf', has_text=l)).first
        async def tap(*ls):
            for l in ls:
                i = await E(f"[...document.querySelectorAll('.kpage[data-id=num] .key')].findIndex(b=>b.querySelector('.kf').textContent.trim()==={l!r})")
                await pg.locator('.kpage[data-id="num"] .key').nth(i).tap(); await pg.wait_for_timeout(120)
        print('strip:', await E("[...document.querySelectorAll('#strip .sk')].map(b=>b.textContent.trim()||b.getAttribute('aria-label')).join(' | ')"))
        print('widths esc/menu:', await E("[...document.querySelectorAll('#strip .sk')].slice(0,3).map(b=>Math.round(b.getBoundingClientRect().width)).join(' / ')"))
        await tap('6', '.', '0', '2', 'EE', '2', '3')
        print('entry:', await E("__app.pages[0].mf.value"))
        await tap('enter'); await pg.wait_for_timeout(1200)
        print('history:', await E("(h=>h.tex+' = '+h.out)(__app.pages[0].history.at(-1))"))
        await tap('1', '.', '5', 'EE', '(−)', '3', '×', '2', 'enter'); await pg.wait_for_timeout(1200)
        print('history:', await E("(h=>h.tex+' = '+h.out)(__app.pages[0].history.at(-1))"))
        await tap('√', '2', 'enter'); await pg.wait_for_timeout(1200)
        await tap('π', 'x²', 'enter'); await pg.wait_for_timeout(1200)
        print('√ / π:', await E("__app.pages[0].history.slice(-2).map(h=>h.tex+' = '+h.out).join(' ; ')"))
        await tap('1', '2', '3'); await pg.locator('#strip [data-a=del]').tap(); await pg.wait_for_timeout(100)
        print('after ⌫:', await E("__app.pages[0].mf.value"))
        print('strip height vs key:', await E("Math.round(document.querySelector('#strip .sk').getBoundingClientRect().height)+' / '+Math.round(document.querySelector('.kpage[data-id=num] .key').getBoundingClientRect().height)"))
        await pg.screenshot(path='out/keys275.png')
        print('errors', errs); await b.close()
asyncio.run(main())
