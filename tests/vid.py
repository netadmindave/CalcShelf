import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':393,'height':852})).new_page()
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        await pg.evaluate("Library.trigSub('id')"); await pg.wait_for_timeout(500)
        vs = pg.locator('#sheet .tri-ids .chip', has_text='Verify'); n = await vs.count()
        for i in range(n): await vs.nth(i).click()
        await pg.wait_for_timeout(6000)
        r = await pg.evaluate("[...document.querySelectorAll('#sheet .tri-ids .row')].filter(r=>r.querySelector('.chip+.chip')).map(r=>r.querySelector('.sub').textContent)")
        print(n, 'ok:', sum(1 for x in r if x.startswith('✓')), [ (i,x) for i,x in enumerate(r) if not x.startswith('✓')])
        await b.close()
asyncio.run(main())
