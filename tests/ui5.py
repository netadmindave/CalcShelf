import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':412,'height':915}, device_scale_factor=2.625, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type=='error' else None); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)))
        await pg.goto("http://localhost:8091/index.html"); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(1500)
        E=lambda js: pg.evaluate(js)
        async def run(t, approx=False):
            await E(f"(async()=>{{const p=__app.page; p.mf.value={t!r}; await p.enter({'true' if approx else 'false'});}})()")
        await run('5\\to aa'); await run('\\operatorname{Define}g\\left(x\\right)=x^2+aa')
        # long computation then stop
        await E("(()=>{const p=__app.page; p.mf.value='\\\\operatorname{ifactor}\\\\left(2^{311}-1\\\\right)'; p.enter(); return 1})()")
        await pg.wait_for_timeout(2500)
        vis = await E("!document.querySelector('.page.calc .stop').hidden")
        await pg.tap('.page.calc .stop'); await pg.wait_for_timeout(2500)
        await run('g\\left(2\\right)')
        await pg.wait_for_timeout(500)
        rows = await E("__app.page.history.map(h=>(h.code||'')+' => '+(h.out||h.error))")
        print('stop visible:', vis); print('\n'.join(rows))
        print(logs[-8:])
        await b.close()
asyncio.run(main())
