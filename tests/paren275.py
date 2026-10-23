# ) closes a ( whose ) was deleted, instead of wrapping everything again; ±.02 numbers work
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':393,'height':852}, has_touch=True)).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8091/index.html'); await pg.wait_for_function("window.__app && __app.page"); await pg.wait_for_timeout(2500)
        E = pg.evaluate
        V = "__app.page.mf.value"
        # 1. delete a ) and press ) again
        await E("(()=>{const mf=__app.page.mf; mf.value=''; mf.focus(); UI.Edit.open(mf); mf.insert('1550\\\\pm1'); UI.Edit.close(mf); mf.executeCommand('deleteBackward'); UI.Edit.close(mf);})()")
        print('1 re-close:', await E(V))
        # 2. two groups, delete the last ), press )
        await E("(()=>{const mf=__app.page.mf; mf.value=''; UI.Edit.open(mf); mf.insert('1550\\\\pm.02'); UI.Edit.close(mf); mf.insert('\\\\times'); UI.Edit.open(mf); mf.insert('1550\\\\pm1'); UI.Edit.close(mf); mf.executeCommand('deleteBackward'); UI.Edit.close(mf);})()")
        print('2 two groups:', await E(V))
        await E("__app.page.enter(false)"); await pg.wait_for_timeout(2000)
        h = await E("JSON.stringify([__app.page.history.at(-1).outTex, __app.page.history.at(-1).error])"); print('  result', h)
        # 3. deleted ) in the middle, cursor moved to the end
        await E("(()=>{const mf=__app.page.mf; mf.value=''; UI.Edit.open(mf); mf.insert('2+3'); UI.Edit.close(mf); mf.executeCommand('deleteBackward'); mf.insert('\\\\times4'); UI.Edit.close(mf);})()")
        print('3 typed on, then ):', await E(V))
        # 4. plain ( typed as text
        await E("(()=>{const mf=__app.page.mf; mf.value='(2+3'; mf.position=99; UI.Edit.close(mf);})()")
        print('4 plain (:', await E(V))
        # 5. nothing open: wraps, as before
        await E("(()=>{const mf=__app.page.mf; mf.value='2+3'; mf.position=99; UI.Edit.close(mf);})()")
        print('5 none open:', await E(V))
        for t in ['(1550\\pm.02)\\times(1550\\pm1)', '\\left(1550\\pm.02\\right)\\times\\left(1550\\pm1\\right)', '(5\\pm1)\\times\\frac{(25\\pm3)}{12\\pm1}']:
            await E("async (t)=>{const p=__app.page; p.mf.value=t; await p.enter(false);}", t); await pg.wait_for_timeout(1500)
            print(t, '->', await E("JSON.stringify([__app.page.history.at(-1).outTex, __app.page.history.at(-1).error])"))
        print('errors', errs)
        await b.close()
asyncio.run(main())
