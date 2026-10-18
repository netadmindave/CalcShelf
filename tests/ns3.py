import asyncio, sys
from playwright.async_api import async_playwright
PROF='/tmp/ns_profile_ns2'
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8091'
async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(PROF, viewport={'width':393,'height':852}, device_scale_factor=2.5)
        pg = ctx.pages[0]; errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE+'/index.html'); await pg.wait_for_timeout(2500)
        idx = await pg.evaluate("__app.pages.findIndex(p=>p.kind==='emu')"); await pg.evaluate(f"__app.select({idx})")
        fr = next(f for f in pg.frames if 'nspire' in f.url)
        for i in range(30):
            await pg.wait_for_timeout(1000)
            if await fr.evaluate("!!window.__ns && __ns.mode()==='run'"): break
        await pg.wait_for_timeout(1500)
        await fr.evaluate("__ns.typeText('factor(x^2-5x+6)', true)"); await pg.wait_for_timeout(5000)
        await fr.evaluate("__ns.typeText('solve(x^2=2^(x+1),x)', true)"); await pg.wait_for_timeout(9000)
        await pg.screenshot(path='./ns3.png')
        print('status', await fr.evaluate("document.querySelector('#status').textContent"), errs)
        await ctx.close()
asyncio.run(main())
